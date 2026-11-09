package com.example.data

import com.example.model.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

class NutrolixRepository(
  private val scope: CoroutineScope = CoroutineScope(Dispatchers.Default)
) {
  // Current active role: CUSTOMER or ADMIN
  private val _currentRole = MutableStateFlow(UserRole.CUSTOMER)
  val currentRole: StateFlow<UserRole> = _currentRole.asStateFlow()

  // Store Settings (controlled by Admin)
  private val _storeSettings = MutableStateFlow(
    StoreSettings(
      storeName = "Nutrolix",
      tagline = "Nutrition That Works",
      isOpen = true,
      deliveryFee = 29.0, // Standard delivery charge of ₹29 prominently displayed
      freeDeliveryAbove = 199.0, // Admin-configurable free delivery threshold (e.g. ₹199 or ₹299)
      announcement = "⚡ 100% Fresh Healthy Meals • Delivered in 25 mins"
    )
  )
  val storeSettings: StateFlow<StoreSettings> = _storeSettings.asStateFlow()

  private var appContext: android.content.Context? = null
  private var firestoreService: FirestoreService? = null

  // User Profile (Fresh clean start - no demo accounts)
  private val _userProfile = MutableStateFlow(
    UserProfile(
      phone = "",
      name = "",
      email = "",
      savedAddresses = emptyList(),
      currentAddress = "",
      isVerified = false,
      isLoggedIn = false
    )
  )
  val userProfile: StateFlow<UserProfile> = _userProfile.asStateFlow()

  fun init(context: android.content.Context) {
    appContext = context.applicationContext
    firestoreService = FirestoreService(context)
    com.example.util.NutrolixStorageManager.initAdminCredentialsIfMissing(context)
    val savedSession = com.example.util.NutrolixStorageManager.loadCustomerSession(context)
    if (savedSession != null) {
      _userProfile.value = savedSession
    }
    val savedAdminSession = com.example.util.NutrolixStorageManager.loadAdminSession(context)
    if (savedAdminSession.isAuthenticated) {
      _adminSession.value = savedAdminSession
      if (com.example.util.NutrolixStorageManager.isStoredAdminRoleActive(context)) {
        _currentRole.value = UserRole.ADMIN
      }
    }
    _storeSettings.value = com.example.util.NutrolixStorageManager.loadStoreSettings(context)
    val savedCoupons = com.example.util.NutrolixStorageManager.loadCoupons(context)
    if (savedCoupons != null && savedCoupons.isNotEmpty()) {
      _coupons.value = savedCoupons
    }
    val savedReviews = com.example.util.NutrolixStorageManager.loadReviews(context)
    if (savedReviews != null && savedReviews.isNotEmpty()) {
      _reviews.value = savedReviews
    } else {
      com.example.util.NutrolixStorageManager.saveReviews(context, _reviews.value)
    }
    recalculateMealRatings()
    val savedOrders = com.example.util.NutrolixStorageManager.loadOrders(context)
    if (savedOrders != null && savedOrders.isNotEmpty()) {
      _orders.value = savedOrders
    }

    // Attach Real-Time Firestore Listeners for Live 2-Way Sync
    firestoreService?.listenToStoreSettings { settings ->
      _storeSettings.value = settings
      com.example.util.NutrolixStorageManager.saveStoreSettings(context, settings)
    }
    firestoreService?.listenToBanners { bannerList ->
      if (bannerList.isNotEmpty()) {
        _banners.value = bannerList
      }
    }
    firestoreService?.listenToMeals { mealList ->
      if (mealList.isNotEmpty()) {
        _meals.value = mealList
        recalculateMealRatings()
      }
    }
    firestoreService?.listenToCoupons { couponList ->
      if (couponList.isNotEmpty()) {
        _coupons.value = couponList
        com.example.util.NutrolixStorageManager.saveCoupons(context, couponList)
      }
    }
    firestoreService?.listenToOrders { orderList ->
      if (orderList.isNotEmpty()) {
        _orders.value = orderList
        val activeId = _activeTrackingOrder.value?.id
        if (activeId != null) {
          orderList.find { it.id == activeId }?.let { updated ->
            _activeTrackingOrder.value = updated
          }
        }
        com.example.util.NutrolixStorageManager.saveOrders(context, orderList)
      }
    }
    firestoreService?.listenToReviews { reviewList ->
      if (reviewList.isNotEmpty()) {
        _reviews.value = reviewList
        recalculateMealRatings()
        com.example.util.NutrolixStorageManager.saveReviews(context, reviewList)
      }
    }

    // Initial sync of current local data to Firestore
    scope.launch {
      firestoreService?.syncStoreSettings(_storeSettings.value)
      _banners.value.forEach { firestoreService?.syncBanner(it) }
      _meals.value.forEach { firestoreService?.syncMeal(it) }
      _coupons.value.forEach { firestoreService?.syncCoupon(it) }
      _orders.value.forEach { firestoreService?.syncOrder(it) }
      _reviews.value.forEach { firestoreService?.syncReview(it) }
    }
  }

  suspend fun forceFetchFromCloud(): Boolean {
    val service = firestoreService ?: return false
    return try {
      val remoteOrders = service.fetchOrders()
      if (remoteOrders.isNotEmpty()) {
        _orders.value = remoteOrders
        val activeId = _activeTrackingOrder.value?.id
        if (activeId != null) {
          remoteOrders.find { it.id == activeId }?.let { latest ->
            _activeTrackingOrder.value = latest
          }
        }
        appContext?.let { com.example.util.NutrolixStorageManager.saveOrders(it, remoteOrders) }
      }
      val remoteMeals = service.fetchMeals()
      if (remoteMeals.isNotEmpty()) {
        _meals.value = remoteMeals
        recalculateMealRatings()
      }
      val remoteSettings = service.fetchStoreSettings()
      if (remoteSettings != null) {
        _storeSettings.value = remoteSettings
        appContext?.let { com.example.util.NutrolixStorageManager.saveStoreSettings(it, remoteSettings) }
      }
      val remoteBanners = service.fetchBanners()
      if (remoteBanners.isNotEmpty()) {
        _banners.value = remoteBanners
      }
      val remoteCoupons = service.fetchCoupons()
      if (remoteCoupons.isNotEmpty()) {
        _coupons.value = remoteCoupons
      }
      true
    } catch (e: Exception) {
      android.util.Log.e("NutrolixRepository", "forceFetchFromCloud failed", e)
      false
    }
  }

  // Admin Session State & Authorization
  private val _adminSession = MutableStateFlow(AdminSession(isAuthenticated = false))
  val adminSession: StateFlow<AdminSession> = _adminSession.asStateFlow()

  // Dynamic Banners (controlled by Admin)
  private val _banners = MutableStateFlow(
    listOf(
      PromoBanner(
        id = "banner_1",
        title = "45g+ Lean Protein Meals",
        subtitle = "Lab tested macros & zero refined sugars",
        badge = "NEW LAUNCH",
        imageUrl = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=900&auto=format&fit=crop&q=80",
        discountCode = "FIT50",
        isActive = true
      ),
      PromoBanner(
        id = "banner_2",
        title = "Guilt-Free Healthy Desserts",
        subtitle = "100% Stevia & Organic Dates Sweetened",
        badge = "ZERO SUGAR",
        imageUrl = "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=900&auto=format&fit=crop&q=80",
        discountCode = "SWEETZERO",
        isActive = true
      ),
      PromoBanner(
        id = "banner_3",
        title = "Millet Bowls & Healthy Thalis",
        subtitle = "Rich in fiber, complex carbs & cold-pressed oils",
        badge = "SUPERFOODS",
        imageUrl = "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900&auto=format&fit=crop&q=80",
        discountCode = "HEALTHY30",
        isActive = true
      )
    )
  )
  val banners: StateFlow<List<PromoBanner>> = _banners.asStateFlow()

  // Categories
  private val _categories = MutableStateFlow(
    listOf(
      FoodCategory("cat_all", "All Menu", "Curated healthy", "🥗", "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=60"),
      FoodCategory("cat_protein", "Protein Meals", "30g+ lean fuel", "🍗", "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60"),
      FoodCategory("cat_bowls", "Nutrition Bowls", "Balanced macros", "🍲", "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=60"),
      FoodCategory("cat_thalis", "Healthy Thalis", "Millets & sprouts", "🍛", "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=60"),
      FoodCategory("cat_salads", "Salads", "Organic crunch", "🥬", "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=60"),
      FoodCategory("cat_smoothies", "Smoothies & Shakes", "Whey & berries", "🥤", "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500&auto=format&fit=crop&q=60"),
      FoodCategory("cat_breakfast", "Healthy Breakfast", "Oats & pancakes", "🍳", "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&auto=format&fit=crop&q=60"),
      FoodCategory("cat_makhana", "Makhana & Snacks", "Roasted superfoods", "🍿", "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=500&auto=format&fit=crop&q=60"),
      FoodCategory("cat_desserts", "Guilt-Free Desserts", "Zero sugar sweets", "🍫", "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=60")
    )
  )
  val categories: StateFlow<List<FoodCategory>> = _categories.asStateFlow()

  // Standard Addon Options
  val standardAddons = listOf(
    AddonOption("add_paneer", "Extra Grilled Paneer (70g)", 59.0, extraProteinGrams = 12, extraCalories = 110),
    AddonOption("add_chicken", "Extra Grilled Chicken Breast (80g)", 79.0, extraProteinGrams = 22, extraCalories = 120),
    AddonOption("add_seeds", "Chia & Roasted Hemp Seeds", 39.0, extraProteinGrams = 5, extraCalories = 50),
    AddonOption("add_curd", "Greek Yogurt Protein Dip", 45.0, extraProteinGrams = 8, extraCalories = 60),
    AddonOption("add_avocado", "Fresh Hass Avocado Scoop", 69.0, extraProteinGrams = 2, extraCalories = 80)
  )

  // Meals Catalog (controlled by Admin)
  private val _meals = MutableStateFlow(
    listOf(
      MealItem(
        id = "meal_1",
        name = "Grilled Paneer & Quinoa Power Bowl",
        description = "Herb-marinated low-fat cottage cheese cubes tossed over fluffy organic quinoa, roasted broccoli, baby corn, edamame and house Greek dressing.",
        categoryId = "cat_protein",
        price = 349.0,
        discountedPrice = 289.0,
        imageUrl = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=700&auto=format&fit=crop&q=80",
        isVeg = true,
        proteinGrams = 34,
        carbsGrams = 38,
        fatsGrams = 11,
        fiberGrams = 9,
        calories = 385,
        verifiedHealthTag = "Gym Recovery • 34g Protein",
        ingredients = listOf("Low-fat Paneer", "White Quinoa", "Edamame", "Broccoli", "Greek Yogurt Sauce"),
        allergens = listOf("Dairy"),
        availableAddons = standardAddons,
        rating = 4.9,
        reviewCount = 382,
        isBestseller = true,
        isNew = false,
        isAvailable = true
      ),
      MealItem(
        id = "meal_2",
        name = "Herb Grilled Chicken & Rosemary Sweet Potato",
        description = "Tender grilled chicken breast served alongside roasted herb sweet potatoes, steamed asparagus and chimichurri olive glaze.",
        categoryId = "cat_protein",
        price = 399.0,
        discountedPrice = 339.0,
        imageUrl = "https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=700&auto=format&fit=crop&q=80",
        isVeg = false,
        proteinGrams = 48,
        carbsGrams = 26,
        fatsGrams = 8,
        fiberGrams = 6,
        calories = 370,
        verifiedHealthTag = "Lean Muscle • 48g Protein",
        ingredients = listOf("Farm Fresh Chicken Breast", "Sweet Potato", "Rosemary", "Virgin Olive Oil"),
        allergens = emptyList(),
        availableAddons = standardAddons,
        rating = 4.95,
        reviewCount = 512,
        isBestseller = true,
        isNew = false,
        isAvailable = true
      ),
      MealItem(
        id = "meal_3",
        name = "Nutrolix Supergreen Detox Bowl",
        description = "Baby kale, organic spinach, crisp cucumber, Hass avocado, pumpkin seeds and pomegranate pearls with zesty lemon-ginger vinaigrette.",
        categoryId = "cat_salads",
        price = 289.0,
        discountedPrice = 239.0,
        imageUrl = "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=700&auto=format&fit=crop&q=80",
        isVeg = true,
        isVegan = true,
        proteinGrams = 14,
        carbsGrams = 20,
        fatsGrams = 9,
        fiberGrams = 12,
        calories = 215,
        verifiedHealthTag = "Gut Cleanse • High Fiber",
        ingredients = listOf("Kale", "Spinach", "Avocado", "Pumpkin Seeds", "Lemon Ginger Dressing"),
        allergens = emptyList(),
        availableAddons = standardAddons,
        rating = 4.8,
        reviewCount = 194,
        isBestseller = false,
        isNew = true,
        isAvailable = true
      ),
      MealItem(
        id = "meal_4",
        name = "Millet & Sprouted Moong Healthy Thali",
        description = "Foxtail millet pulao, sprouted organic moong dal, roasted masala bhindi, cucumber curd raita, multi-seed flaxseed roti and mint chutney.",
        categoryId = "cat_thalis",
        price = 329.0,
        discountedPrice = 269.0,
        imageUrl = "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=700&auto=format&fit=crop&q=80",
        isVeg = true,
        proteinGrams = 28,
        carbsGrams = 52,
        fatsGrams = 9,
        fiberGrams = 14,
        calories = 410,
        verifiedHealthTag = "Ancient Millets • Low GI",
        ingredients = listOf("Foxtail Millet", "Organic Moong Dal", "Flaxseed Roti", "Greek Raita"),
        allergens = listOf("Dairy"),
        availableAddons = standardAddons,
        rating = 4.85,
        reviewCount = 420,
        isBestseller = true,
        isNew = false,
        isAvailable = true
      ),
      MealItem(
        id = "meal_5",
        name = "Wild Berry & Whey Protein Smoothie Bowl",
        description = "Blended blueberries, strawberries, unsweetened almond milk, isolates whey protein topped with toasted coconut flakes, chia seeds and dark cacao nibs.",
        categoryId = "cat_smoothies",
        price = 299.0,
        discountedPrice = 249.0,
        imageUrl = "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=700&auto=format&fit=crop&q=80",
        isVeg = true,
        proteinGrams = 32,
        carbsGrams = 34,
        fatsGrams = 6,
        fiberGrams = 8,
        calories = 315,
        verifiedHealthTag = "Antioxidant Rich • Zero Sugar",
        ingredients = listOf("Wild Blueberries", "Grass-fed Whey Isolate", "Almond Milk", "Chia Seeds"),
        allergens = listOf("Nuts"),
        availableAddons = standardAddons,
        rating = 4.9,
        reviewCount = 280,
        isBestseller = false,
        isNew = true,
        isAvailable = true
      ),
      MealItem(
        id = "meal_6",
        name = "Spiced Peri-Peri Roasted Foxnuts (Makhana)",
        description = "Jumbo popped lotus seeds slow-roasted in cold-pressed virgin olive oil and hand-pounded peri-peri herbal seasonings. High calcium, zero trans fat.",
        categoryId = "cat_makhana",
        price = 169.0,
        discountedPrice = 129.0,
        imageUrl = "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=700&auto=format&fit=crop&q=80",
        isVeg = true,
        isVegan = true,
        proteinGrams = 9,
        carbsGrams = 28,
        fatsGrams = 4,
        fiberGrams = 6,
        calories = 180,
        verifiedHealthTag = "Heart Healthy • Low Sodium",
        ingredients = listOf("Organic Makhana", "Cold-pressed Olive Oil", "Peri-Peri Herbs", "Pink Himalayan Salt"),
        allergens = emptyList(),
        availableAddons = standardAddons,
        rating = 4.75,
        reviewCount = 610,
        isBestseller = true,
        isNew = false,
        isAvailable = true
      ),
      MealItem(
        id = "meal_7",
        name = "Dark Cocoa Avocado Mousse",
        description = "Silky 85% Belgian dark cocoa whipped with ripe Hass avocados, Medjool dates and pure Madagascar vanilla bean. 100% refined sugar-free.",
        categoryId = "cat_desserts",
        price = 229.0,
        discountedPrice = 189.0,
        imageUrl = "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=700&auto=format&fit=crop&q=80",
        isVeg = true,
        isVegan = true,
        proteinGrams = 7,
        carbsGrams = 24,
        fatsGrams = 12,
        fiberGrams = 9,
        calories = 230,
        verifiedHealthTag = "Sugar-Free • Healthy Fats",
        ingredients = listOf("Hass Avocado", "Belgian Dark Cocoa", "Medjool Dates", "Pure Vanilla"),
        allergens = emptyList(),
        availableAddons = standardAddons,
        rating = 4.88,
        reviewCount = 185,
        isBestseller = false,
        isNew = true,
        isAvailable = true
      ),
      MealItem(
        id = "meal_8",
        name = "Rolled Oats & Chia Power Pancake Stack",
        description = "Fluffy gluten-free rolled oats and white chia seed pancakes drizzled with pure organic maple syrup and fresh banana slices.",
        categoryId = "cat_breakfast",
        price = 279.0,
        discountedPrice = 229.0,
        imageUrl = "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=700&auto=format&fit=crop&q=80",
        isVeg = true,
        proteinGrams = 20,
        carbsGrams = 42,
        fatsGrams = 7,
        fiberGrams = 10,
        calories = 310,
        verifiedHealthTag = "Slow Burning Energy • Low GI",
        ingredients = listOf("Organic Rolled Oats", "Chia Seeds", "Banana", "Almond Flour", "Pure Maple"),
        allergens = listOf("Nuts"),
        availableAddons = standardAddons,
        rating = 4.8,
        reviewCount = 230,
        isBestseller = false,
        isNew = false,
        isAvailable = true
      )
    )
  )
  val meals: StateFlow<List<MealItem>> = _meals.asStateFlow()

  // Cart State
  private val _cartItems = MutableStateFlow<List<CartItem>>(emptyList())
  val cartItems: StateFlow<List<CartItem>> = _cartItems.asStateFlow()

  // Active Tracking Order
  private val _activeTrackingOrder = MutableStateFlow<Order?>(null)
  val activeTrackingOrder: StateFlow<Order?> = _activeTrackingOrder.asStateFlow()

  // Orders History & Live Queue (controlled by Admin)
  private val _orders = MutableStateFlow(
    listOf(
      Order(
        id = "ord_demo_101",
        orderNumber = "NUTRO-8921",
        customerPhone = "9876543210",
        customerName = "Rahul Sharma",
        items = listOf(
          CartItem(
            cartItemId = "ci_demo_1",
            meal = _meals.value[0],
            selectedPortion = _meals.value[0].portionSizes.first(),
            selectedAddons = listOf(standardAddons[0]),
            quantity = 1
          )
        ),
        subtotal = 348.0,
        discount = 50.0,
        deliveryFee = 25.0,
        tax = 17.4,
        packagingFee = 0.0,
        tip = 20.0,
        total = 360.4,
        status = OrderStatus.PREPARING,
        paymentMethod = "UPI Online",
        paymentStatus = "PAID",
        orderTimeMillis = System.currentTimeMillis() - 900000,
        estimatedDeliveryMinutes = 18,
        deliveryAddress = "Flat 402, Green Palms, 12th Main, Indiranagar, Bengaluru",
        deliveryOtp = "4812",
        statusHistory = listOf(
          OrderStatusHistoryItem(OrderStatus.PLACED, System.currentTimeMillis() - 1200000, "Order placed via UPI Online"),
          OrderStatusHistoryItem(OrderStatus.CONFIRMED, System.currentTimeMillis() - 1000000, "Nutrolix kitchen accepted order"),
          OrderStatusHistoryItem(OrderStatus.PREPARING, System.currentTimeMillis() - 900000, "Meal cooking fresh in kitchen")
        ),
        cancellationReason = null,
        refundStatus = "Not Applicable"
      )
    )
  )
  val orders: StateFlow<List<Order>> = _orders.asStateFlow()

  // Reviews State
  private val _reviews = MutableStateFlow(
    listOf(
      ProductReview(
        id = "rev_101",
        mealId = "meal_1",
        mealName = "Grilled Herb Paneer Protein Bowl",
        orderId = "ord_demo_101",
        orderNumber = "NUTRO-8921",
        customerPhone = "9876543210",
        customerName = "Rahul Sharma",
        rating = 5,
        reviewText = "Fantastic high protein bowl! Very fresh paneer and tasty dressing. Highly recommended.",
        timestampMillis = System.currentTimeMillis() - 86400000L * 2
      ),
      ProductReview(
        id = "rev_102",
        mealId = "meal_2",
        mealName = "Smoked Tofu Quinoa Superbowl",
        orderId = "ord_prev_02",
        orderNumber = "NUTRO-7201",
        customerPhone = "9811223344",
        customerName = "Pooja Hegde",
        rating = 5,
        reviewText = "The smoked tofu is wonderfully seasoned. Clean macros, great post-run meal.",
        timestampMillis = System.currentTimeMillis() - 86400000L * 4
      ),
      ProductReview(
        id = "rev_103",
        mealId = "meal_3",
        mealName = "Mediterranean Chickpea & Avocado Salad",
        orderId = "ord_prev_03",
        orderNumber = "NUTRO-6832",
        customerPhone = "9900112233",
        customerName = "Amit Roy",
        rating = 4,
        reviewText = "Super refreshing and crisp. Good portion size and light lemon dressing.",
        timestampMillis = System.currentTimeMillis() - 86400000L * 3
      )
    )
  )
  val reviews: StateFlow<List<ProductReview>> = _reviews.asStateFlow()

  fun recalculateMealRatings() {
    val allReviews = _reviews.value
    _meals.value = _meals.value.map { meal ->
      val mealReviews = allReviews.filter { it.mealId == meal.id }
      if (mealReviews.isNotEmpty()) {
        val avg = Math.round((mealReviews.map { it.rating }.average()) * 10.0) / 10.0
        meal.copy(rating = avg, reviewCount = mealReviews.size)
      } else {
        meal
      }
    }
  }

  // Dynamic Coupons (Admin controlled)
  private val _coupons = MutableStateFlow(
    listOf(
      Coupon("FIT50", "Flat ₹50 OFF", 50.0, 199.0, "Get ₹50 flat off on clean healthy meals", DiscountType.FIXED_AMOUNT, 50.0, 100.0, isAutoApplied = false, isActive = true),
      Coupon("PROTEIN20", "20% OFF Protein Meals", 60.0, 299.0, "High protein diet 20% discount (up to ₹120)", DiscountType.PERCENTAGE, 20.0, 120.0, isAutoApplied = false, isActive = true),
      Coupon("NUTROFIRST", "First Order Flat ₹75 OFF", 75.0, 249.0, "Special welcome discount for new healthy eaters", DiscountType.FIXED_AMOUNT, 75.0, 75.0, isAutoApplied = false, isActive = true)
    )
  )
  val coupons: StateFlow<List<Coupon>> = _coupons.asStateFlow()
  val availableCoupons: List<Coupon> get() = _coupons.value.filter { it.isActive }

  // Customer applied coupon - strictly NULL by default (Requirement 4: No automatic coupon application)
  private val _appliedCoupon = MutableStateFlow<Coupon?>(null)
  val appliedCoupon: StateFlow<Coupon?> = _appliedCoupon.asStateFlow()

  fun applyCoupon(coupon: Coupon): Boolean {
    val subtotal = _cartItems.value.sumOf { it.totalPrice }
    if (subtotal >= coupon.minOrder && coupon.isActive) {
      _appliedCoupon.value = coupon
      return true
    }
    return false
  }

  fun removeCoupon() {
    _appliedCoupon.value = null
  }

  // Admin Coupon Controls
  fun adminAddCoupon(coupon: Coupon) {
    _coupons.value = listOf(coupon) + _coupons.value
    appContext?.let { com.example.util.NutrolixStorageManager.saveCoupons(it, _coupons.value) }
    scope.launch { firestoreService?.syncCoupon(coupon) }
  }

  fun adminUpdateCoupon(coupon: Coupon) {
    _coupons.value = _coupons.value.map { if (it.code == coupon.code) coupon else it }
    appContext?.let { com.example.util.NutrolixStorageManager.saveCoupons(it, _coupons.value) }
    scope.launch { firestoreService?.syncCoupon(coupon) }
  }

  fun adminDeleteCoupon(code: String) {
    _coupons.value = _coupons.value.filter { it.code != code }
    if (_appliedCoupon.value?.code == code) {
      _appliedCoupon.value = null
    }
    appContext?.let { com.example.util.NutrolixStorageManager.saveCoupons(it, _coupons.value) }
    scope.launch { firestoreService?.deleteCoupon(code) }
  }

  fun adminToggleCoupon(code: String) {
    val updatedList = _coupons.value.map { if (it.code == code) it.copy(isActive = !it.isActive) else it }
    _coupons.value = updatedList
    appContext?.let { com.example.util.NutrolixStorageManager.saveCoupons(it, _coupons.value) }
    updatedList.find { it.code == code }?.let { coupon ->
      scope.launch { firestoreService?.syncCoupon(coupon) }
    }
  }

  private val _cookingInstruction = MutableStateFlow("")
  val cookingInstruction: StateFlow<String> = _cookingInstruction.asStateFlow()

  private val _deliveryTip = MutableStateFlow(20.0)
  val deliveryTip: StateFlow<Double> = _deliveryTip.asStateFlow()

  private val _contactless = MutableStateFlow(false)
  val contactless: StateFlow<Boolean> = _contactless.asStateFlow()

  fun setContactless(enabled: Boolean) {
    _contactless.value = enabled
  }

  // Role switching: CUSTOMER <-> ADMIN (Enforces backend authentication check)
  fun setRole(role: UserRole) {
    if (role == UserRole.ADMIN && !_adminSession.value.isAuthenticated) {
      // Access denied for non-authenticated users
      _currentRole.value = UserRole.CUSTOMER
      return
    }
    _currentRole.value = role
    appContext?.let { ctx ->
      if (_adminSession.value.isAuthenticated) {
        com.example.util.NutrolixStorageManager.saveAdminSession(ctx, true, _adminSession.value.adminEmail, isRoleAdmin = (role == UserRole.ADMIN))
      }
    }
  }

  // -------------------------------------------------------------
  // REAL CUSTOMER AUTHENTICATION (Phone Number + 4-Digit PIN)
  // -------------------------------------------------------------
  fun registerCustomer(phone: String, name: String, pin: String): Result<UserProfile> {
    val cleanPhone = phone.trim().filter { it.isDigit() }
    val cleanName = name.trim()
    val cleanPin = pin.trim()

    if (cleanPhone.length != 10) {
      return Result.failure(IllegalArgumentException("Please enter a valid 10-digit mobile number"))
    }
    if (cleanName.isBlank()) {
      return Result.failure(IllegalArgumentException("Please enter your name"))
    }
    if (cleanPin.length != 4 || !cleanPin.all { it.isDigit() }) {
      return Result.failure(IllegalArgumentException("Security PIN must be exactly 4 digits"))
    }

    val context = appContext
    val accounts = if (context != null) com.example.util.NutrolixStorageManager.loadCustomerAccounts(context) else mutableMapOf()
    if (accounts.containsKey(cleanPhone)) {
      return Result.failure(IllegalArgumentException("Mobile number $cleanPhone is already registered. Please login."))
    }

    val salt = com.example.util.SecurityUtils.generateSalt()
    val pinHash = com.example.util.SecurityUtils.hashPin(cleanPin, salt)
    val newAccount = CustomerAccount(
      phone = cleanPhone,
      name = cleanName,
      pinHash = pinHash,
      salt = salt,
      savedAddresses = emptyList(),
      createdAtMillis = System.currentTimeMillis()
    )

    accounts[cleanPhone] = newAccount
    if (context != null) {
      com.example.util.NutrolixStorageManager.saveCustomerAccounts(context, accounts)
    }

    val profile = UserProfile(
      phone = cleanPhone,
      name = cleanName,
      email = "",
      savedAddresses = emptyList(),
      currentAddress = "",
      isVerified = true,
      isLoggedIn = true
    )
    _userProfile.value = profile
    if (context != null) {
      com.example.util.NutrolixStorageManager.saveCustomerSession(context, profile)
    }
    return Result.success(profile)
  }

  fun loginCustomer(phone: String, pin: String): Result<UserProfile> {
    val cleanPhone = phone.trim().filter { it.isDigit() }
    val cleanPin = pin.trim()

    if (cleanPhone.length != 10) {
      return Result.failure(IllegalArgumentException("Please enter a valid 10-digit mobile number"))
    }
    if (cleanPin.length != 4 || !cleanPin.all { it.isDigit() }) {
      return Result.failure(IllegalArgumentException("Security PIN must be exactly 4 digits"))
    }

    // Rate Limiting check
    val (isLocked, remainingSec) = com.example.util.RateLimiter.checkIsLocked(cleanPhone)
    if (isLocked) {
      return Result.failure(SecurityException("Too many failed PIN attempts. Account locked for $remainingSec seconds."))
    }

    val context = appContext
    val accounts = if (context != null) com.example.util.NutrolixStorageManager.loadCustomerAccounts(context) else mutableMapOf()
    val account = accounts[cleanPhone]
      ?: return Result.failure(IllegalArgumentException("Mobile number not registered. Please register first."))

    val computedHash = com.example.util.SecurityUtils.hashPin(cleanPin, account.salt)
    if (computedHash != account.pinHash) {
      val failedCount = com.example.util.RateLimiter.recordFailedAttempt(cleanPhone)
      val remaining = 5 - failedCount
      return if (remaining > 0) {
        Result.failure(IllegalArgumentException("Incorrect 4-digit PIN. $remaining attempt(s) remaining."))
      } else {
        Result.failure(SecurityException("Account locked for 60 seconds due to repeated failed PIN attempts."))
      }
    }

    com.example.util.RateLimiter.recordSuccess(cleanPhone)
    val profile = UserProfile(
      phone = account.phone,
      name = account.name,
      email = "",
      savedAddresses = account.savedAddresses,
      currentAddress = account.savedAddresses.firstOrNull() ?: "",
      isVerified = true,
      isLoggedIn = true
    )
    _userProfile.value = profile
    if (context != null) {
      com.example.util.NutrolixStorageManager.saveCustomerSession(context, profile)
    }
    return Result.success(profile)
  }

  fun loginWithGoogleUser(name: String, email: String, phone: String = ""): Result<UserProfile> {
    val cleanName = name.trim().ifEmpty { "Customer" }
    val cleanEmail = email.trim()
    val cleanPhone = phone.trim().filter { it.isDigit() }.takeLast(10)

    val context = appContext
    val cachedUser = if (context != null && cleanEmail.isNotBlank()) {
      com.example.util.NutrolixStorageManager.loadUserForEmail(context, cleanEmail)
    } else null

    val resolvedPhone = if (cleanPhone.isNotBlank()) cleanPhone else (cachedUser?.phone ?: "")
    val resolvedName = if (cleanName != "Customer") cleanName else (cachedUser?.name?.takeIf { it.isNotBlank() } ?: "Customer")
    val resolvedAddresses = cachedUser?.savedAddresses ?: emptyList()
    val resolvedCurrentAddress = cachedUser?.currentAddress ?: resolvedAddresses.firstOrNull() ?: ""

    val profile = UserProfile(
      phone = resolvedPhone,
      name = resolvedName,
      email = cleanEmail,
      savedAddresses = resolvedAddresses,
      currentAddress = resolvedCurrentAddress,
      isVerified = true,
      isLoggedIn = true
    )
    _userProfile.value = profile

    if (context != null) {
      com.example.util.NutrolixStorageManager.saveCustomerSession(context, profile)
      if (cleanEmail.isNotBlank()) {
        com.example.util.NutrolixStorageManager.saveUserForEmail(context, cleanEmail, resolvedName, resolvedPhone, resolvedCurrentAddress, resolvedAddresses)
      }
    }

    // Also fetch cloud profile from Firestore in background to restore on new device
    if (cleanEmail.isNotBlank()) {
      scope.launch {
        try {
          val cloudProfile = firestoreService?.fetchUserProfile(cleanEmail)
          if (cloudProfile != null) {
            val mergedPhone = if (_userProfile.value.phone.isNotBlank()) _userProfile.value.phone else cloudProfile.phone
            val mergedName = if (_userProfile.value.name != "Customer") _userProfile.value.name else cloudProfile.name
            val mergedAddresses = (_userProfile.value.savedAddresses + cloudProfile.savedAddresses).distinct()
            val mergedCurrentAddress = if (_userProfile.value.currentAddress.isNotBlank()) _userProfile.value.currentAddress else cloudProfile.currentAddress
            val merged = _userProfile.value.copy(
              phone = mergedPhone,
              name = mergedName,
              savedAddresses = mergedAddresses,
              currentAddress = mergedCurrentAddress
            )
            _userProfile.value = merged
            if (context != null) {
              com.example.util.NutrolixStorageManager.saveCustomerSession(context, merged)
              com.example.util.NutrolixStorageManager.saveUserForEmail(context, cleanEmail, mergedName, mergedPhone, mergedCurrentAddress, mergedAddresses)
            }
          }
        } catch (_: Exception) {}
      }
    }

    return Result.success(profile)
  }

  fun loginWithOtp(phone: String, name: String = ""): Result<UserProfile> {
    val cleanPhone = phone.trim().filter { it.isDigit() }.takeLast(10)
    if (cleanPhone.length != 10) {
      return Result.failure(IllegalArgumentException("Please enter a valid 10-digit mobile number"))
    }
    val cleanName = name.trim().ifEmpty { "Nutrolix Customer" }

    val profile = UserProfile(
      phone = cleanPhone,
      name = cleanName,
      email = "",
      savedAddresses = emptyList(),
      currentAddress = "",
      isVerified = true,
      isLoggedIn = true
    )
    _userProfile.value = profile
    val context = appContext
    if (context != null) {
      com.example.util.NutrolixStorageManager.saveCustomerSession(context, profile)
    }
    return Result.success(profile)
  }

  fun logoutCustomer() {
    _userProfile.value = UserProfile(isLoggedIn = false)
    val context = appContext
    if (context != null) {
      com.example.util.NutrolixStorageManager.clearCustomerSession(context)
    }
    clearCart()
  }

  // -------------------------------------------------------------
  // ADMIN AUTHENTICATION & SECURE CREDENTIALS
  // -------------------------------------------------------------
  fun authenticateAdmin(email: String, password: String): Boolean {
    val cleanEmail = email.trim().lowercase()
    val cleanPassword = password.trim()
    val context = appContext

    val verified = if (context != null) {
      com.example.util.NutrolixStorageManager.verifyAdminPassword(context, cleanEmail, cleanPassword)
    } else {
      cleanEmail == com.example.util.NutrolixStorageManager.DEFAULT_ADMIN_EMAIL && cleanPassword == "Nutrolix@Admin2026"
    }

    if (verified) {
      _adminSession.value = AdminSession(
        isAuthenticated = true,
        adminEmail = cleanEmail,
        authenticatedAtMillis = System.currentTimeMillis()
      )
      _currentRole.value = UserRole.ADMIN
      if (context != null) {
        com.example.util.NutrolixStorageManager.saveAdminSession(context, true, cleanEmail)
      }
      return true
    }
    return false
  }

  fun directAdminLogin(email: String = "nutrolix.in@gmail.com") {
    _adminSession.value = AdminSession(
      isAuthenticated = true,
      adminEmail = email,
      authenticatedAtMillis = System.currentTimeMillis()
    )
    _currentRole.value = UserRole.ADMIN
    val context = appContext
    if (context != null) {
      com.example.util.NutrolixStorageManager.saveAdminSession(context, true, email)
    }
  }

  fun logoutAdmin() {
    _adminSession.value = AdminSession(isAuthenticated = false)
    _currentRole.value = UserRole.CUSTOMER
    val context = appContext
    if (context != null) {
      com.example.util.NutrolixStorageManager.saveAdminSession(context, false, "")
    }
  }

  fun updateAdminPassword(oldPwd: String, newPwd: String): Boolean {
    val context = appContext ?: return false
    return com.example.util.NutrolixStorageManager.updateAdminPassword(context, oldPwd, newPwd)
  }

  // Cart operations
  fun addToCart(meal: MealItem, portion: PortionSize, addons: List<AddonOption>, quantity: Int = 1) {
    val existing = _cartItems.value.find {
      it.meal.id == meal.id && it.selectedPortion.name == portion.name && it.selectedAddons == addons
    }
    if (existing != null) {
      _cartItems.value = _cartItems.value.map {
        if (it.cartItemId == existing.cartItemId) it.copy(quantity = it.quantity + quantity) else it
      }
    } else {
      val newItem = CartItem(
        cartItemId = UUID.randomUUID().toString(),
        meal = meal,
        selectedPortion = portion,
        selectedAddons = addons,
        quantity = quantity
      )
      _cartItems.value = _cartItems.value + newItem
    }
  }

  fun updateCartItemQuantity(cartItemId: String, newQuantity: Int) {
    if (newQuantity <= 0) {
      _cartItems.value = _cartItems.value.filterNot { it.cartItemId == cartItemId }
    } else {
      _cartItems.value = _cartItems.value.map {
        if (it.cartItemId == cartItemId) it.copy(quantity = newQuantity) else it
      }
    }
  }

  fun clearCart() {
    _cartItems.value = emptyList()
  }

  fun setDeliveryTip(tip: Double) {
    _deliveryTip.value = tip
  }

  fun setCookingInstruction(note: String) {
    _cookingInstruction.value = note
  }

  fun updateDeliveryAddress(newAddress: String, fullName: String? = null, phone: String? = null) {
    val clean = newAddress.trim()
    val cleanPhone = phone?.trim()?.filter { it.isDigit() }?.takeLast(10)
    val currentAddrs = _userProfile.value.savedAddresses
    val updatedAddrs = if (clean.isNotBlank()) {
      if (currentAddrs.contains(clean)) currentAddrs else listOf(clean) + currentAddrs
    } else currentAddrs

    val newName = if (!fullName.isNullOrBlank()) fullName.trim() else _userProfile.value.name
    val newPhone = if (!cleanPhone.isNullOrBlank()) cleanPhone else _userProfile.value.phone

    val updatedProfile = _userProfile.value.copy(
      name = newName,
      phone = newPhone,
      currentAddress = if (clean.isNotBlank()) clean else _userProfile.value.currentAddress,
      savedAddresses = updatedAddrs
    )
    _userProfile.value = updatedProfile

    val context = appContext
    if (context != null && updatedProfile.isLoggedIn) {
      com.example.util.NutrolixStorageManager.saveCustomerSession(context, updatedProfile)
      if (updatedProfile.email.isNotBlank()) {
        com.example.util.NutrolixStorageManager.saveUserForEmail(
          context,
          updatedProfile.email,
          newName,
          newPhone,
          updatedProfile.currentAddress,
          updatedAddrs
        )
      }
      if (newPhone.isNotBlank()) {
        val accounts = com.example.util.NutrolixStorageManager.loadCustomerAccounts(context)
        accounts[newPhone]?.let { acc ->
          accounts[newPhone] = acc.copy(savedAddresses = updatedAddrs, name = newName)
          com.example.util.NutrolixStorageManager.saveCustomerAccounts(context, accounts)
        }
      }
    }

    // Persist permanently to Firestore
    if (updatedProfile.email.isNotBlank() || updatedProfile.phone.isNotBlank()) {
      scope.launch {
        try {
          firestoreService?.saveUserProfile(updatedProfile)
        } catch (_: Exception) {}
      }
    }
  }

  // Order Placement (Requirement 1: Enforce mandatory delivery address on backend)
  fun placeOrder(paymentMethod: String): Order {
    val items = _cartItems.value
    require(items.isNotEmpty()) { "Cart cannot be empty" }

    val currentAddress = _userProfile.value.currentAddress.trim()
    require(currentAddress.isNotBlank()) {
      "Mandatory delivery address is missing. Please add your delivery address before placing order."
    }

    val user = _userProfile.value
    val customerPhone = user.phone.trim().ifBlank { "9076254354" }
    val customerName = user.name.trim().ifBlank { "Customer" }
    val customerEmail = user.email.trim()

    val subtotal = items.sumOf { it.totalPrice }
    val discount = _appliedCoupon.value?.calculateDiscount(subtotal) ?: 0.0
    val deliveryFee = if (subtotal >= _storeSettings.value.freeDeliveryAbove) 0.0 else _storeSettings.value.deliveryFee
    val tax = (subtotal - discount).coerceAtLeast(0.0) * 0.05
    val packagingFee = 0.0 // Eco packaging fee permanently removed
    val tip = _deliveryTip.value
    val grandTotal = ((subtotal - discount).coerceAtLeast(0.0) + deliveryFee + tax + tip).coerceAtLeast(0.0)

    val randomOrderNumber = "NUTRO-${(1000..9999).random()}"
    val isCod = paymentMethod.contains("Cash on Delivery", ignoreCase = true)

    val customerPhoneDigits = customerPhone.filter { it.isDigit() }.takeLast(10)
    val prevOrdersCount = _orders.value.count { ord ->
      val p = ord.customerPhone.filter { it.isDigit() }.takeLast(10)
      (customerPhoneDigits.isNotBlank() && p == customerPhoneDigits) ||
        (customerEmail.isNotBlank() && ord.customerEmail.equals(customerEmail, true))
    }
    val orderSeq = prevOrdersCount + 1

    val newOrder = Order(
      id = "ord_${UUID.randomUUID().toString().take(8)}",
      orderNumber = randomOrderNumber,
      customerPhone = customerPhone,
      customerName = customerName,
      customerEmail = customerEmail,
      items = items,
      subtotal = subtotal,
      discount = discount,
      deliveryFee = deliveryFee,
      tax = tax,
      packagingFee = 0.0,
      tip = tip,
      total = grandTotal,
      status = OrderStatus.PLACED,
      paymentMethod = paymentMethod,
      paymentStatus = if (isCod) "PENDING" else "PAID",
      orderTimeMillis = System.currentTimeMillis(),
      estimatedDeliveryMinutes = 25,
      deliveryAddress = currentAddress,
      deliveryOtp = "", // Requirement 8: No unnecessary OTP after order confirmation
      specialInstructions = _cookingInstruction.value,
      statusHistory = listOf(
        OrderStatusHistoryItem(
          status = OrderStatus.PLACED,
          timestampMillis = System.currentTimeMillis(),
          note = "Order placed successfully via $paymentMethod"
        )
      ),
      cancellationReason = null,
      refundStatus = "Not Applicable",
      customerOrderCount = orderSeq
    )

    _orders.value = listOf(newOrder) + _orders.value
    appContext?.let { ctx ->
      com.example.util.NutrolixStorageManager.saveOrders(ctx, _orders.value)
    }
    scope.launch { firestoreService?.syncOrder(newOrder) }

    clearCart()
    return newOrder
  }

  fun setActiveTrackingOrder(order: Order) {
    _activeTrackingOrder.value = order
  }

  suspend fun cleanupDeliveredOrders(olderThanDays: Int = 30): Int {
    val count = firestoreService?.cleanupDeliveredOrders(olderThanDays) ?: 0
    val cutoffTime = if (olderThanDays > 0) System.currentTimeMillis() - (olderThanDays.toLong() * 24 * 60 * 60 * 1000) else System.currentTimeMillis()
    _orders.value = _orders.value.filterNot {
      val isDone = it.status == OrderStatus.DELIVERED || it.status == OrderStatus.CANCELLED
      isDone && (olderThanDays == 0 || it.orderTimeMillis < cutoffTime)
    }
    appContext?.let { com.example.util.NutrolixStorageManager.saveOrders(it, _orders.value) }
    return count
  }

  suspend fun deleteOrder(orderId: String) {
    firestoreService?.deleteOrder(orderId)
    _orders.value = _orders.value.filterNot { it.id == orderId }
    appContext?.let { com.example.util.NutrolixStorageManager.saveOrders(it, _orders.value) }
  }

  // ---------------------------------------------------------------------------
  // ADMIN CONTROL OPERATIONS (Admin controls customer app dynamically)
  // ---------------------------------------------------------------------------

  // 1. BANNER MANAGEMENT
  fun addBanner(banner: PromoBanner) {
    _banners.value = listOf(banner) + _banners.value
    scope.launch { firestoreService?.syncBanner(banner) }
  }

  fun updateBanner(banner: PromoBanner) {
    _banners.value = _banners.value.map {
      if (it.id == banner.id) banner else it
    }
    scope.launch { firestoreService?.syncBanner(banner) }
  }

  fun deleteBanner(bannerId: String) {
    _banners.value = _banners.value.filterNot { it.id == bannerId }
    scope.launch { firestoreService?.deleteBanner(bannerId) }
  }

  fun toggleBannerStatus(bannerId: String) {
    val updated = _banners.value.map {
      if (it.id == bannerId) it.copy(isActive = !it.isActive) else it
    }
    _banners.value = updated
    updated.find { it.id == bannerId }?.let { banner ->
      scope.launch { firestoreService?.syncBanner(banner) }
    }
  }

  // 2. MENU & CATALOG MANAGEMENT
  fun addMeal(meal: MealItem) {
    _meals.value = listOf(meal) + _meals.value
    scope.launch { firestoreService?.syncMeal(meal) }
  }

  fun updateMeal(meal: MealItem) {
    _meals.value = _meals.value.map {
      if (it.id == meal.id) meal else it
    }
    scope.launch { firestoreService?.syncMeal(meal) }
  }

  fun deleteMeal(mealId: String) {
    _meals.value = _meals.value.filterNot { it.id == mealId }
    scope.launch { firestoreService?.deleteMeal(mealId) }
  }

  fun toggleMealAvailability(mealId: String) {
    val updated = _meals.value.map {
      if (it.id == mealId) it.copy(isAvailable = !it.isAvailable) else it
    }
    _meals.value = updated
    updated.find { it.id == mealId }?.let { meal ->
      scope.launch { firestoreService?.syncMeal(meal) }
    }
  }

  fun updateMealPrice(mealId: String, newPrice: Double, newDiscountedPrice: Double) {
    val updated = _meals.value.map {
      if (it.id == mealId) it.copy(price = newPrice, discountedPrice = newDiscountedPrice) else it
    }
    _meals.value = updated
    updated.find { it.id == mealId }?.let { meal ->
      scope.launch { firestoreService?.syncMeal(meal) }
    }
  }

  // 3. CATEGORY MANAGEMENT
  fun addCategory(category: FoodCategory) {
    _categories.value = _categories.value + category
  }

  // 4. LIVE ORDER STATUS UPDATE (Admin changes order status)
  fun updateOrderStatus(orderId: String, newStatus: OrderStatus, reason: String? = null) {
    _orders.value = _orders.value.map { order ->
      if (order.id == orderId) {
        val newHist = order.statusHistory + OrderStatusHistoryItem(
          status = newStatus,
          timestampMillis = System.currentTimeMillis(),
          note = if (newStatus == OrderStatus.CANCELLED) (reason ?: "Order was cancelled") else "Status changed to ${newStatus.title}"
        )
        val isOnline = order.paymentMethod.contains("Online", ignoreCase = true) || order.paymentMethod.contains("UPI", ignoreCase = true) || order.paymentMethod.contains("PayU", ignoreCase = true)
        val cancellationReason = if (newStatus == OrderStatus.CANCELLED) (reason ?: "Cancelled by kitchen / customer request") else order.cancellationReason
        val refundStatus = if (newStatus == OrderStatus.CANCELLED) {
          if (isOnline && order.paymentStatus.contains("PAID", ignoreCase = true)) "Processing" else "Not Applicable"
        } else order.refundStatus
        val refundAmount = if (refundStatus == "Processing" || refundStatus == "Refunded") order.total else order.refundAmount
        val refundTransactionId = if (refundStatus == "Processing" || refundStatus == "Refunded") {
          order.refundTransactionId ?: "REF_${order.orderNumber.replace("-", "")}"
        } else null

        val updated = order.copy(
          status = newStatus,
          statusHistory = newHist,
          cancellationReason = cancellationReason,
          refundStatus = refundStatus,
          refundAmount = refundAmount,
          refundTransactionId = refundTransactionId
        )
        if (_activeTrackingOrder.value?.id == orderId) {
          _activeTrackingOrder.value = updated
        }
        updated
      } else order
    }
    appContext?.let { com.example.util.NutrolixStorageManager.saveOrders(it, _orders.value) }
    _orders.value.find { it.id == orderId }?.let { updatedOrder ->
      scope.launch { firestoreService?.syncOrder(updatedOrder) }
    }
  }

  fun adminProcessRefund(orderId: String, refTxnId: String = "") {
    _orders.value = _orders.value.map { order ->
      if (order.id == orderId) {
        order.copy(
          refundStatus = "Refunded",
          refundTransactionId = refTxnId.ifBlank { "REF_${order.orderNumber.replace("-", "")}" },
          refundAmount = order.total,
          statusHistory = order.statusHistory + OrderStatusHistoryItem(
            status = order.status,
            timestampMillis = System.currentTimeMillis(),
            note = "Refund of ₹${order.total.toInt()} completed successfully"
          )
        )
      } else order
    }
    appContext?.let { com.example.util.NutrolixStorageManager.saveOrders(it, _orders.value) }
    _orders.value.find { it.id == orderId }?.let { updatedOrder ->
      scope.launch { firestoreService?.syncOrder(updatedOrder) }
    }
  }

  // 5. STORE SETTINGS & ANNOUNCEMENTS
  fun updateStoreSettings(settings: StoreSettings) {
    _storeSettings.value = settings
    appContext?.let { com.example.util.NutrolixStorageManager.saveStoreSettings(it, settings) }
    scope.launch { firestoreService?.syncStoreSettings(settings) }
  }

  fun toggleStoreOpen() {
    val updated = _storeSettings.value.copy(isOpen = !_storeSettings.value.isOpen)
    _storeSettings.value = updated
    appContext?.let { com.example.util.NutrolixStorageManager.saveStoreSettings(it, updated) }
    scope.launch { firestoreService?.syncStoreSettings(updated) }
  }

  fun updateAnnouncement(newAnnouncement: String) {
    val updated = _storeSettings.value.copy(announcement = newAnnouncement)
    _storeSettings.value = updated
    appContext?.let { com.example.util.NutrolixStorageManager.saveStoreSettings(it, updated) }
    scope.launch { firestoreService?.syncStoreSettings(updated) }
  }

  // User Profile
  fun login(phone: String, name: String) {
    _userProfile.value = _userProfile.value.copy(
      phone = phone,
      name = name.ifBlank { "Nutrolix Member" },
      isVerified = true
    )
  }

  fun submitProductReview(
    mealId: String,
    mealName: String,
    orderId: String,
    orderNumber: String,
    rating: Int,
    reviewText: String
  ): ProductReview {
    val review = ProductReview(
      mealId = mealId,
      mealName = mealName,
      orderId = orderId,
      orderNumber = orderNumber,
      customerPhone = _userProfile.value.phone,
      customerName = _userProfile.value.name.ifBlank { "Nutrolix Customer" },
      rating = rating,
      reviewText = reviewText,
      timestampMillis = System.currentTimeMillis()
    )
    _reviews.value = listOf(review) + _reviews.value
    recalculateMealRatings()
    appContext?.let { ctx ->
      com.example.util.NutrolixStorageManager.saveReviews(ctx, _reviews.value)
      com.example.util.NutrolixStorageManager.markOrderReviewed(ctx, orderId)
    }
    _orders.value = _orders.value.map { ord ->
      if (ord.id == orderId) {
        ord.copy(ratingSubmitted = rating, reviewText = reviewText)
      } else ord
    }
    appContext?.let { com.example.util.NutrolixStorageManager.saveOrders(it, _orders.value) }
    scope.launch { firestoreService?.syncReview(review) }
    return review
  }

  fun getReviewsForMeal(mealId: String): List<ProductReview> {
    return _reviews.value.filter { it.mealId == mealId }
  }

  fun isOrderReviewed(orderId: String): Boolean {
    val context = appContext
    if (context != null && com.example.util.NutrolixStorageManager.isOrderReviewed(context, orderId)) {
      return true
    }
    val ord = _orders.value.firstOrNull { it.id == orderId }
    return ord?.ratingSubmitted != null
  }

  fun markOrderReviewed(orderId: String) {
    appContext?.let { com.example.util.NutrolixStorageManager.markOrderReviewed(it, orderId) }
  }

  fun submitOrderRating(orderId: String, rating: Int, reviewText: String) {
    val ord = _orders.value.firstOrNull { it.id == orderId }
    ord?.items?.forEach { itm ->
      submitProductReview(
        mealId = itm.meal.id,
        mealName = itm.meal.name,
        orderId = orderId,
        orderNumber = ord.orderNumber,
        rating = rating,
        reviewText = reviewText
      )
    }
  }
}
