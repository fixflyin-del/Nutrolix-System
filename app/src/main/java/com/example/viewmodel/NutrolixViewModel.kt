package com.example.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.NutrolixRepository
import com.example.model.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

enum class DietaryFilter(val label: String) {
  ALL("All"),
  VEG_ONLY("🌱 100% Veg"),
  HIGH_PROTEIN("💪 High Protein (30g+)"),
  LOW_CALORIE("🥗 Under 350 kcal"),
  KETO("🥑 Keto Friendly")
}

enum class SortOption(val label: String) {
  POPULAR("Popularity"),
  HIGH_PROTEIN("Highest Protein"),
  RATING("Rating 4.8+"),
  PRICE_LOW_HIGH("Price: Low to High"),
  PRICE_HIGH_LOW("Price: High to Low")
}

class NutrolixViewModel(
  val repository: NutrolixRepository = NutrolixRepository()
) : ViewModel() {

  val currentRole = repository.currentRole
  val storeSettings = repository.storeSettings
  val userProfile = repository.userProfile
  val banners = repository.banners
  val categories = repository.categories
  val cartItems = repository.cartItems
  val appliedCoupon = repository.appliedCoupon
  val coupons = repository.coupons
  val deliveryTip = repository.deliveryTip
  val contactless = repository.contactless
  val cookingInstruction = repository.cookingInstruction
  val orders = repository.orders
  val activeTrackingOrder = repository.activeTrackingOrder

  // Customer UI Filters
  private val _selectedCategoryId = MutableStateFlow("cat_all")
  val selectedCategoryId: StateFlow<String> = _selectedCategoryId.asStateFlow()

  private val _searchQuery = MutableStateFlow("")
  val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

  private val _dietaryFilter = MutableStateFlow(DietaryFilter.ALL)
  val dietaryFilter: StateFlow<DietaryFilter> = _dietaryFilter.asStateFlow()

  private val _sortOption = MutableStateFlow(SortOption.POPULAR)
  val sortOption: StateFlow<SortOption> = _sortOption.asStateFlow()

  // Meal Customization Sheet (Addons & Portion)
  private val _selectedMeal = MutableStateFlow<MealItem?>(null)
  val selectedMeal: StateFlow<MealItem?> = _selectedMeal.asStateFlow()

  private val _selectedPortion = MutableStateFlow<PortionSize?>(null)
  val selectedPortion: StateFlow<PortionSize?> = _selectedPortion.asStateFlow()

  private val _selectedAddons = MutableStateFlow<Set<AddonOption>>(emptySet())
  val selectedAddons: StateFlow<Set<AddonOption>> = _selectedAddons.asStateFlow()

  val adminSession = repository.adminSession

  // Active Screen: "home", "cart", "tracking", "profile"
  private val _activeScreen = MutableStateFlow("home")
  val activeScreen: StateFlow<String> = _activeScreen.asStateFlow()

  private val _showPaymentModal = MutableStateFlow(false)
  val showPaymentModal: StateFlow<Boolean> = _showPaymentModal.asStateFlow()

  private val _showAddressModal = MutableStateFlow(false)
  val showAddressModal: StateFlow<Boolean> = _showAddressModal.asStateFlow()

  private val _showAdminLoginModal = MutableStateFlow(false)
  val showAdminLoginModal: StateFlow<Boolean> = _showAdminLoginModal.asStateFlow()

  private val _showCustomerAuthModal = MutableStateFlow(false)
  val showCustomerAuthModal: StateFlow<Boolean> = _showCustomerAuthModal.asStateFlow()

  private val _orderConfirmationMessage = MutableStateFlow<String?>(null)
  val orderConfirmationMessage: StateFlow<String?> = _orderConfirmationMessage.asStateFlow()

  private val _isRefreshing = MutableStateFlow(false)
  val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

  fun init(context: android.content.Context) {
    repository.init(context)
  }

  fun refreshFromCloud(onComplete: (() -> Unit)? = null) {
    viewModelScope.launch {
      _isRefreshing.value = true
      try {
        repository.forceFetchFromCloud()
      } finally {
        kotlinx.coroutines.delay(600)
        _isRefreshing.value = false
        onComplete?.invoke()
      }
    }
  }

  // Filtered Meals Flow (Customer View)
  val filteredMeals: StateFlow<List<MealItem>> = combine(
    repository.meals,
    _selectedCategoryId,
    _searchQuery,
    _dietaryFilter,
    _sortOption
  ) { mealsList, categoryId, query, diet, sort ->
    var result = mealsList.filter { it.isAvailable }

    if (categoryId != "cat_all") {
      result = result.filter { it.categoryId == categoryId }
    }

    if (query.isNotBlank()) {
      val q = query.trim().lowercase()
      result = result.filter {
        it.name.lowercase().contains(q) ||
        it.description.lowercase().contains(q) ||
        it.verifiedHealthTag.lowercase().contains(q) ||
        it.ingredients.any { ing -> ing.lowercase().contains(q) }
      }
    }

    when (diet) {
      DietaryFilter.ALL -> {}
      DietaryFilter.VEG_ONLY -> result = result.filter { it.isVeg }
      DietaryFilter.HIGH_PROTEIN -> result = result.filter { it.proteinGrams >= 30 }
      DietaryFilter.LOW_CALORIE -> result = result.filter { it.calories <= 350 }
      DietaryFilter.KETO -> result = result.filter { it.carbsGrams <= 15 }
    }

    when (sort) {
      SortOption.POPULAR -> result.sortedByDescending { it.isBestseller }
      SortOption.HIGH_PROTEIN -> result.sortedByDescending { it.proteinGrams }
      SortOption.RATING -> result.sortedByDescending { it.rating }
      SortOption.PRICE_LOW_HIGH -> result.sortedBy { it.discountedPrice }
      SortOption.PRICE_HIGH_LOW -> result.sortedByDescending { it.discountedPrice }
    }
  }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

  fun setRole(role: UserRole) {
    repository.setRole(role)
  }

  fun navigateTo(screen: String) {
    _activeScreen.value = screen
  }

  fun selectCategory(id: String) {
    _selectedCategoryId.value = id
  }

  fun setSearchQuery(query: String) {
    _searchQuery.value = query
  }

  fun setDietaryFilter(filter: DietaryFilter) {
    _dietaryFilter.value = filter
  }

  fun setSortOption(option: SortOption) {
    _sortOption.value = option
  }

  // Meal Customization Sheet
  fun openMealCustomization(meal: MealItem) {
    _selectedMeal.value = meal
    _selectedPortion.value = meal.portionSizes.firstOrNull()
    _selectedAddons.value = emptySet()
  }

  fun closeMealCustomization() {
    _selectedMeal.value = null
  }

  fun selectPortion(portion: PortionSize) {
    _selectedPortion.value = portion
  }

  fun toggleAddon(addon: AddonOption) {
    val current = _selectedAddons.value
    _selectedAddons.value = if (current.contains(addon)) {
      current - addon
    } else {
      current + addon
    }
  }

  fun addCustomizedMealToCart() {
    val meal = _selectedMeal.value ?: return
    val portion = _selectedPortion.value ?: meal.portionSizes.first()
    repository.addToCart(meal, portion, _selectedAddons.value.toList())
    _selectedMeal.value = null
  }

  fun quickAddToCart(meal: MealItem) {
    repository.addToCart(meal, meal.portionSizes.first(), emptyList())
  }

  fun updateCartQuantity(cartItemId: String, newQty: Int) {
    repository.updateCartItemQuantity(cartItemId, newQty)
  }

  fun openPaymentModal() {
    _showPaymentModal.value = true
  }

  fun closePaymentModal() {
    _showPaymentModal.value = false
  }

  fun processPayment(paymentMethod: String): Order {
    _showPaymentModal.value = false
    val order = repository.placeOrder(paymentMethod)
    _orderConfirmationMessage.value = "Your order has been confirmed successfully!"
    _activeScreen.value = "tracking"
    return order
  }

  fun clearOrderConfirmation() {
    _orderConfirmationMessage.value = null
  }

  fun openAdminLoginModal() {
    _showAdminLoginModal.value = true
  }

  fun closeAdminLoginModal() {
    _showAdminLoginModal.value = false
  }

  fun loginAdmin(email: String, passcode: String): Boolean {
    val success = repository.authenticateAdmin(email, passcode)
    if (success) {
      _showAdminLoginModal.value = false
      _activeScreen.value = "home"
    }
    return success
  }

  fun directAdminLogin(email: String = "nutrolix.in@gmail.com") {
    repository.directAdminLogin(email)
    _showAdminLoginModal.value = false
    _activeScreen.value = "home"
  }

  fun logoutAdmin() {
    repository.logoutAdmin()
    _activeScreen.value = "home"
  }

  fun updateAdminPassword(oldPwd: String, newPwd: String): Boolean {
    return repository.updateAdminPassword(oldPwd, newPwd)
  }

  // Customer Authentication Modal & Actions
  fun openCustomerAuthModal() {
    _showCustomerAuthModal.value = true
  }

  fun closeCustomerAuthModal() {
    _showCustomerAuthModal.value = false
  }

  fun registerCustomer(phone: String, name: String, pin: String): Result<UserProfile> {
    val result = repository.registerCustomer(phone, name, pin)
    if (result.isSuccess) {
      _showCustomerAuthModal.value = false
    }
    return result
  }

  fun loginCustomer(phone: String, pin: String): Result<UserProfile> {
    val result = repository.loginCustomer(phone, pin)
    if (result.isSuccess) {
      _showCustomerAuthModal.value = false
    }
    return result
  }

  fun loginWithGoogleUser(name: String, email: String, phone: String = ""): Result<UserProfile> {
    val result = repository.loginWithGoogleUser(name, email, phone)
    if (result.isSuccess) {
      _showCustomerAuthModal.value = false
    }
    return result
  }

  fun loginWithOtp(phone: String, name: String = ""): Result<UserProfile> {
    val result = repository.loginWithOtp(phone, name)
    if (result.isSuccess) {
      _showCustomerAuthModal.value = false
    }
    return result
  }

  fun logoutCustomer() {
    repository.logoutCustomer()
    _activeScreen.value = "home"
  }

  fun openAddressModal() {
    _showAddressModal.value = true
  }

  fun closeAddressModal() {
    _showAddressModal.value = false
  }

  fun selectAddress(address: String, fullName: String? = null, phone: String? = null) {
    repository.updateDeliveryAddress(address, fullName, phone)
    _showAddressModal.value = false
  }

  fun updateProfileName(name: String, phone: String? = null) {
    repository.updateDeliveryAddress(repository.userProfile.value.currentAddress, name, phone)
  }

  fun viewOrderTracking(order: Order) {
    repository.setActiveTrackingOrder(order)
    _activeScreen.value = "tracking"
  }

  // ---------------------------------------------------------------------------
  // ADMIN DELEGATES (Full Admin control over Banners, Menu, Orders & Store)
  // ---------------------------------------------------------------------------

  fun adminAddBanner(banner: PromoBanner) {
    repository.addBanner(banner)
  }

  fun adminUpdateBanner(banner: PromoBanner) {
    repository.updateBanner(banner)
  }

  fun adminDeleteBanner(bannerId: String) {
    repository.deleteBanner(bannerId)
  }

  fun adminToggleBanner(bannerId: String) {
    repository.toggleBannerStatus(bannerId)
  }

  fun adminAddMeal(meal: MealItem) {
    repository.addMeal(meal)
  }

  fun adminUpdateMeal(meal: MealItem) {
    repository.updateMeal(meal)
  }

  fun adminDeleteMeal(mealId: String) {
    repository.deleteMeal(mealId)
  }

  val reviews = repository.reviews

  // Selected Order for Full Details View
  private val _selectedOrderDetail = MutableStateFlow<Order?>(null)
  val selectedOrderDetail: StateFlow<Order?> = _selectedOrderDetail.asStateFlow()

  fun openOrderDetail(order: Order) {
    _selectedOrderDetail.value = order
  }

  fun closeOrderDetail() {
    _selectedOrderDetail.value = null
  }

  // Active Review Dialog (Delivered Order review popup)
  private val _orderToReview = MutableStateFlow<Order?>(null)
  val orderToReview: StateFlow<Order?> = _orderToReview.asStateFlow()

  fun openReviewDialog(order: Order) {
    _orderToReview.value = order
  }

  fun closeReviewDialog() {
    _orderToReview.value = null
  }

  fun submitProductReview(
    mealId: String,
    mealName: String,
    orderId: String,
    orderNumber: String,
    rating: Int,
    reviewText: String
  ): ProductReview {
    return repository.submitProductReview(mealId, mealName, orderId, orderNumber, rating, reviewText)
  }

  fun getReviewsForMeal(mealId: String): List<ProductReview> {
    return repository.getReviewsForMeal(mealId)
  }

  fun isOrderReviewed(orderId: String): Boolean {
    return repository.isOrderReviewed(orderId)
  }

  fun markOrderReviewed(orderId: String) {
    repository.markOrderReviewed(orderId)
  }

  fun toggleMealStock(mealId: String) {
    repository.toggleMealAvailability(mealId)
  }

  fun adminUpdateOrderStatus(orderId: String, newStatus: OrderStatus, reason: String? = null) {
    repository.updateOrderStatus(orderId, newStatus, reason)
  }

  fun adminProcessRefund(orderId: String, refTxnId: String = "") {
    repository.adminProcessRefund(orderId, refTxnId)
  }

  fun adminToggleStoreOpen() {
    repository.toggleStoreOpen()
  }

  fun adminUpdateAnnouncement(announcement: String) {
    repository.updateAnnouncement(announcement)
  }

  fun adminUpdateStoreSettings(settings: StoreSettings) {
    repository.updateStoreSettings(settings)
  }

  fun adminAddCoupon(coupon: Coupon) {
    repository.adminAddCoupon(coupon)
  }

  fun adminUpdateCoupon(coupon: Coupon) {
    repository.adminUpdateCoupon(coupon)
  }

  fun adminDeleteCoupon(code: String) {
    repository.adminDeleteCoupon(code)
  }

  fun adminToggleCoupon(code: String) {
    repository.adminToggleCoupon(code)
  }

  fun adminCleanupOldOrders(olderThanDays: Int = 30, onDone: (Int) -> Unit = {}) {
    viewModelScope.launch {
      val count = repository.cleanupDeliveredOrders(olderThanDays)
      onDone(count)
    }
  }

  fun adminDeleteOrder(orderId: String) {
    viewModelScope.launch {
      repository.deleteOrder(orderId)
    }
  }
}
