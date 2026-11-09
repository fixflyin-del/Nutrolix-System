package com.example.data

import android.content.Context
import android.util.Log
import com.example.R
import com.example.model.*
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.tasks.await

private const val TAG = "FirestoreService"

class FirestoreService(
  private val context: Context
) {
  val db: FirebaseFirestore? = try {
    if (com.google.firebase.FirebaseApp.getApps(context).isEmpty()) {
      com.google.firebase.FirebaseApp.initializeApp(context)
    }
    val databaseId = try {
      context.getString(R.string.firestore_database_id)
    } catch (_: Exception) { "" }

    if (databaseId.isNotBlank() && databaseId != "(default)") {
      try {
        FirebaseFirestore.getInstance(databaseId)
      } catch (e: Throwable) {
        Log.w(TAG, "Named database '$databaseId' failed, falling back to default instance: ${e.message}")
        FirebaseFirestore.getInstance()
      }
    } else {
      FirebaseFirestore.getInstance()
    }
  } catch (e: Throwable) {
    Log.e(TAG, "Critical: Failed to initialize FirebaseFirestore: ${e.message}", e)
    try { FirebaseFirestore.getInstance() } catch (_: Throwable) { null }
  }

  // -------------------------------------------------------------
  // USER PROFILE
  // -------------------------------------------------------------
  suspend fun syncUserProfile(userProfile: UserProfile, userId: String) {
    val firestore = db ?: return
    try {
      val data = mapOf(
        "uid" to userId,
        "name" to userProfile.name,
        "email" to userProfile.email,
        "phone" to userProfile.phone,
        "currentAddress" to userProfile.currentAddress,
        "savedAddresses" to userProfile.savedAddresses
      )
      firestore.collection("users").document(userId).set(data, SetOptions.merge()).await()
      Log.d(TAG, "User profile successfully synced to Firestore for $userId")
    } catch (e: Exception) {
      Log.e(TAG, "Error syncing user profile to Firestore", e)
    }
  }

  suspend fun saveUserProfile(userProfile: UserProfile) {
    val firestore = db ?: return
    val key = if (userProfile.email.isNotBlank()) userProfile.email.lowercase().trim() else userProfile.phone.trim()
    if (key.isBlank()) return
    try {
      val data = mapOf(
        "name" to userProfile.name,
        "email" to userProfile.email,
        "phone" to userProfile.phone,
        "currentAddress" to userProfile.currentAddress,
        "savedAddresses" to userProfile.savedAddresses,
        "updatedAtMillis" to System.currentTimeMillis()
      )
      firestore.collection("users").document(key).set(data, SetOptions.merge()).await()
      Log.d(TAG, "User profile saved to Firestore for $key")
    } catch (e: Exception) {
      Log.e(TAG, "Error saving user profile to Firestore for $key", e)
    }
  }

  suspend fun fetchUserProfile(email: String): UserProfile? {
    val firestore = db ?: return null
    val cleanEmail = email.trim().lowercase()
    if (cleanEmail.isBlank()) return null
    return try {
      val doc = firestore.collection("users").document(cleanEmail).get().await()
      if (doc.exists()) {
        val name = doc.getString("name") ?: ""
        val phone = doc.getString("phone") ?: ""
        val currentAddress = doc.getString("currentAddress") ?: ""
        @Suppress("UNCHECKED_CAST")
        val addresses = (doc.get("savedAddresses") as? List<String>) ?: listOfNotNull(currentAddress.takeIf { it.isNotBlank() })
        UserProfile(
          phone = phone,
          name = name,
          email = cleanEmail,
          savedAddresses = addresses,
          currentAddress = currentAddress,
          isVerified = true,
          isLoggedIn = true
        )
      } else {
        null
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error fetching user profile for $cleanEmail", e)
      null
    }
  }

  // -------------------------------------------------------------
  // STORE SETTINGS (LIVE SYNC)
  // -------------------------------------------------------------
  fun listenToStoreSettings(onUpdate: (StoreSettings) -> Unit): ListenerRegistration? {
    val firestore = db ?: return null
    return firestore.collection("settings").document("store_config")
      .addSnapshotListener { snapshot, error ->
        if (error != null) {
          Log.w(TAG, "Listen store settings failed", error)
          return@addSnapshotListener
        }
        if (snapshot != null && snapshot.exists()) {
          try {
            val settings = StoreSettings(
              storeName = snapshot.getString("storeName") ?: "Nutrolix",
              tagline = snapshot.getString("tagline") ?: "Nutrition That Works",
              isOpen = snapshot.getBoolean("isOpen") ?: true,
              deliveryFee = snapshot.getDouble("deliveryFee") ?: 29.0,
              freeDeliveryAbove = snapshot.getDouble("freeDeliveryAbove") ?: 199.0,
              announcement = snapshot.getString("announcement") ?: "⚡ 100% Fresh Healthy Meals • Delivered in 25 mins",
              payuEnabled = snapshot.getBoolean("payuEnabled") ?: true,
              payuIsLive = snapshot.getBoolean("payuIsLive") ?: true,
              payuMerchantKey = snapshot.getString("payuMerchantKey") ?: "",
              payuMerchantSalt = snapshot.getString("payuMerchantSalt") ?: ""
            )
            onUpdate(settings)
            Log.d(TAG, "Store settings updated live from Firestore: isOpen=${settings.isOpen}")
          } catch (e: Exception) {
            Log.e(TAG, "Error parsing store settings", e)
          }
        }
      }
  }

  suspend fun syncStoreSettings(settings: StoreSettings) {
    val firestore = db ?: return
    try {
      val data = mapOf(
        "storeName" to settings.storeName,
        "tagline" to settings.tagline,
        "isOpen" to settings.isOpen,
        "deliveryFee" to settings.deliveryFee,
        "freeDeliveryAbove" to settings.freeDeliveryAbove,
        "announcement" to settings.announcement,
        "payuEnabled" to settings.payuEnabled,
        "payuIsLive" to settings.payuIsLive,
        "payuMerchantKey" to settings.payuMerchantKey,
        "payuMerchantSalt" to settings.payuMerchantSalt
      )
      firestore.collection("settings").document("store_config").set(data, SetOptions.merge()).await()
      Log.d(TAG, "Store settings synced to Firestore successfully")
    } catch (e: Exception) {
      Log.e(TAG, "Error syncing store settings to Firestore", e)
    }
  }

  // -------------------------------------------------------------
  // PROMO BANNERS (LIVE SYNC)
  // -------------------------------------------------------------
  fun listenToBanners(onUpdate: (List<PromoBanner>) -> Unit): ListenerRegistration? {
    val firestore = db ?: return null
    return firestore.collection("banners").addSnapshotListener { snapshot, error ->
      if (error != null) {
        Log.w(TAG, "Listen banners failed", error)
        return@addSnapshotListener
      }
      if (snapshot != null && !snapshot.isEmpty) {
        val list = snapshot.documents.mapNotNull { doc ->
          try {
            PromoBanner(
              id = doc.getString("id") ?: doc.id,
              title = doc.getString("title") ?: "",
              subtitle = doc.getString("subtitle") ?: "",
              badge = doc.getString("badge") ?: "SPECIAL",
              imageUrl = doc.getString("imageUrl") ?: "",
              discountCode = doc.getString("discountCode") ?: "",
              isActive = doc.getBoolean("isActive") ?: true
            )
          } catch (e: Exception) {
            null
          }
        }
        if (list.isNotEmpty()) {
          onUpdate(list)
          Log.d(TAG, "Banners updated live from Firestore: ${list.size} banners")
        }
      }
    }
  }

  suspend fun syncBanner(banner: PromoBanner) {
    val firestore = db ?: return
    try {
      val data = mapOf(
        "id" to banner.id,
        "title" to banner.title,
        "subtitle" to banner.subtitle,
        "badge" to banner.badge,
        "imageUrl" to banner.imageUrl,
        "discountCode" to banner.discountCode,
        "isActive" to banner.isActive
      )
      firestore.collection("banners").document(banner.id).set(data, SetOptions.merge()).await()
      Log.d(TAG, "Banner ${banner.id} synced to Firestore")
    } catch (e: Exception) {
      Log.e(TAG, "Error syncing banner to Firestore", e)
    }
  }

  suspend fun deleteBanner(bannerId: String) {
    val firestore = db ?: return
    try {
      firestore.collection("banners").document(bannerId).delete().await()
    } catch (e: Exception) {
      Log.e(TAG, "Error deleting banner from Firestore", e)
    }
  }

  // -------------------------------------------------------------
  // MEALS & FOOD CATALOG (LIVE SYNC)
  // -------------------------------------------------------------
  fun listenToMeals(onUpdate: (List<MealItem>) -> Unit): ListenerRegistration? {
    val firestore = db ?: return null
    return firestore.collection("meals").addSnapshotListener { snapshot, error ->
      if (error != null) {
        Log.w(TAG, "Listen meals failed", error)
        return@addSnapshotListener
      }
      if (snapshot != null && !snapshot.isEmpty) {
        val list = snapshot.documents.mapNotNull { doc ->
          try {
            MealItem(
              id = doc.getString("id") ?: doc.id,
              name = doc.getString("name") ?: "",
              description = doc.getString("description") ?: "",
              categoryId = doc.getString("categoryId") ?: "cat_protein",
              price = doc.getDouble("price") ?: 249.0,
              discountedPrice = doc.getDouble("discountedPrice") ?: (doc.getDouble("price") ?: 249.0),
              imageUrl = doc.getString("imageUrl") ?: "",
              isVeg = doc.getBoolean("isVeg") ?: true,
              isVegan = doc.getBoolean("isVegan") ?: false,
              proteinGrams = (doc.getLong("proteinGrams") ?: 30L).toInt(),
              carbsGrams = (doc.getLong("carbsGrams") ?: 25L).toInt(),
              fatsGrams = (doc.getLong("fatsGrams") ?: 12L).toInt(),
              fiberGrams = (doc.getLong("fiberGrams") ?: 8L).toInt(),
              calories = (doc.getLong("calories") ?: 400L).toInt(),
              verifiedHealthTag = doc.getString("verifiedHealthTag") ?: "Clean Healthy Nutrition",
              prepTimeMinutes = (doc.getLong("prepTimeMinutes") ?: 18L).toInt(),
              rating = doc.getDouble("rating") ?: 4.8,
              reviewCount = (doc.getLong("reviewCount") ?: 0L).toInt(),
              isBestseller = doc.getBoolean("isBestseller") ?: false,
              isNew = doc.getBoolean("isNew") ?: false,
              isAvailable = doc.getBoolean("isAvailable") ?: true
            )
          } catch (e: Exception) {
            null
          }
        }
        if (list.isNotEmpty()) {
          onUpdate(list)
          Log.d(TAG, "Meals catalog updated live from Firestore: ${list.size} meals")
        }
      }
    }
  }

  suspend fun syncMeal(meal: MealItem) {
    val firestore = db ?: return
    try {
      val data = mapOf(
        "id" to meal.id,
        "name" to meal.name,
        "description" to meal.description,
        "categoryId" to meal.categoryId,
        "price" to meal.price,
        "discountedPrice" to meal.discountedPrice,
        "imageUrl" to meal.imageUrl,
        "isVeg" to meal.isVeg,
        "isVegan" to meal.isVegan,
        "proteinGrams" to meal.proteinGrams,
        "carbsGrams" to meal.carbsGrams,
        "fatsGrams" to meal.fatsGrams,
        "fiberGrams" to meal.fiberGrams,
        "calories" to meal.calories,
        "verifiedHealthTag" to meal.verifiedHealthTag,
        "prepTimeMinutes" to meal.prepTimeMinutes,
        "rating" to meal.rating,
        "reviewCount" to meal.reviewCount,
        "isBestseller" to meal.isBestseller,
        "isNew" to meal.isNew,
        "isAvailable" to meal.isAvailable
      )
      firestore.collection("meals").document(meal.id).set(data, SetOptions.merge()).await()
      Log.d(TAG, "Meal ${meal.name} synced to Firestore (isAvailable=${meal.isAvailable})")
    } catch (e: Exception) {
      Log.e(TAG, "Error syncing meal to Firestore", e)
    }
  }

  suspend fun deleteMeal(mealId: String) {
    val firestore = db ?: return
    try {
      firestore.collection("meals").document(mealId).delete().await()
    } catch (e: Exception) {
      Log.e(TAG, "Error deleting meal from Firestore", e)
    }
  }

  // -------------------------------------------------------------
  // COUPONS & DISCOUNTS (LIVE SYNC)
  // -------------------------------------------------------------
  fun listenToCoupons(onUpdate: (List<Coupon>) -> Unit): ListenerRegistration? {
    val firestore = db ?: return null
    return firestore.collection("coupons").addSnapshotListener { snapshot, error ->
      if (error != null) return@addSnapshotListener
      if (snapshot != null && !snapshot.isEmpty) {
        val list = snapshot.documents.mapNotNull { doc ->
          try {
            val code = doc.getString("code") ?: doc.id
            val title = doc.getString("title") ?: code
            val discVal = doc.getDouble("discountValue") ?: doc.getDouble("discountAmount") ?: 50.0
            val typeStr = doc.getString("discountType") ?: "FIXED_AMOUNT"
            val discType = if (typeStr.contains("PERCENTAGE", ignoreCase = true)) DiscountType.PERCENTAGE else DiscountType.FIXED_AMOUNT
            Coupon(
              code = code,
              title = title,
              discountAmount = discVal,
              minOrder = doc.getDouble("minOrder") ?: 199.0,
              description = doc.getString("description") ?: "",
              discountType = discType,
              discountValue = discVal,
              maxDiscount = doc.getDouble("maxDiscount") ?: 150.0,
              isAutoApplied = doc.getBoolean("isAutoApplied") ?: false,
              isActive = doc.getBoolean("isActive") ?: true
            )
          } catch (e: Exception) {
            null
          }
        }
        if (list.isNotEmpty()) onUpdate(list)
      }
    }
  }

  suspend fun syncCoupon(coupon: Coupon) {
    val firestore = db ?: return
    try {
      val data = mapOf(
        "code" to coupon.code,
        "title" to coupon.title,
        "discountAmount" to coupon.discountAmount,
        "discountValue" to coupon.discountValue,
        "discountType" to coupon.discountType.name,
        "minOrder" to coupon.minOrder,
        "maxDiscount" to coupon.maxDiscount,
        "description" to coupon.description,
        "isAutoApplied" to coupon.isAutoApplied,
        "isActive" to coupon.isActive
      )
      firestore.collection("coupons").document(coupon.code).set(data, SetOptions.merge()).await()
    } catch (e: Exception) {
      Log.e(TAG, "Error syncing coupon", e)
    }
  }

  suspend fun deleteCoupon(couponCode: String) {
    val firestore = db ?: return
    try {
      firestore.collection("coupons").document(couponCode).delete().await()
    } catch (e: Exception) {
      Log.e(TAG, "Error deleting coupon", e)
    }
  }

  // -------------------------------------------------------------
  // ORDERS (LIVE SYNC)
  // -------------------------------------------------------------
  fun listenToOrders(onUpdate: (List<Order>) -> Unit): ListenerRegistration? {
    val firestore = db ?: return null
    return firestore.collection("orders").addSnapshotListener { snapshot, error ->
      if (error != null) {
        Log.w(TAG, "Listen orders failed", error)
        return@addSnapshotListener
      }
      if (snapshot != null && !snapshot.isEmpty) {
        val list = snapshot.documents.mapNotNull { doc ->
          try {
            val statusStr = doc.getString("status") ?: "PLACED"
            val status = try { OrderStatus.valueOf(statusStr) } catch (e: Exception) { OrderStatus.PLACED }
            val rawItems = doc.get("items") as? List<Map<String, Any>> ?: emptyList()
            val cartItems = rawItems.map { itm ->
              val mealName = itm["mealName"] as? String ?: "Nutrition Dish"
              val price = (itm["price"] as? Number)?.toDouble() ?: 0.0
              val qty = (itm["quantity"] as? Number)?.toInt() ?: 1
              val portion = itm["portion"] as? String ?: "Regular"
              CartItem(
                cartItemId = java.util.UUID.randomUUID().toString(),
                meal = MealItem(
                  id = itm["mealId"] as? String ?: "meal",
                  name = mealName,
                  description = "",
                  categoryId = "cat_all",
                  price = price,
                  discountedPrice = price,
                  imageUrl = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
                  isVeg = true,
                  proteinGrams = 30,
                  calories = 400
                ),
                selectedPortion = PortionSize(portion, 0.0),
                quantity = qty
              )
            }

            Order(
              id = doc.getString("id") ?: doc.id,
              orderNumber = doc.getString("orderNumber") ?: "NUTRO-${doc.id.take(4)}",
              customerPhone = doc.getString("customerPhone") ?: "",
              customerName = doc.getString("customerName") ?: "Customer",
              customerEmail = doc.getString("customerEmail") ?: "",
              items = cartItems,
              subtotal = doc.getDouble("subtotal") ?: 0.0,
              discount = doc.getDouble("discount") ?: 0.0,
              deliveryFee = doc.getDouble("deliveryFee") ?: 0.0,
              tax = doc.getDouble("tax") ?: 0.0,
              packagingFee = 0.0,
              tip = doc.getDouble("tip") ?: 0.0,
              total = doc.getDouble("total") ?: 0.0,
              status = status,
              paymentMethod = doc.getString("paymentMethod") ?: "Online Payment",
              paymentStatus = doc.getString("paymentStatus") ?: "PAID",
              orderTimeMillis = doc.getLong("orderTimeMillis") ?: System.currentTimeMillis(),
              estimatedDeliveryMinutes = (doc.getLong("estimatedDeliveryMinutes") ?: 25L).toInt(),
              deliveryAddress = doc.getString("deliveryAddress") ?: "",
              deliveryOtp = doc.getString("deliveryOtp") ?: "",
              specialInstructions = doc.getString("specialInstructions") ?: "",
              ratingSubmitted = doc.getLong("ratingSubmitted")?.toInt(),
              reviewText = doc.getString("reviewText"),
              statusHistory = listOf(
                OrderStatusHistoryItem(status, doc.getLong("orderTimeMillis") ?: System.currentTimeMillis(), "Status: ${status.title}")
              ),
              cancellationReason = doc.getString("cancellationReason"),
              refundStatus = doc.getString("refundStatus") ?: "Not Applicable",
              refundAmount = doc.getDouble("refundAmount"),
              refundTransactionId = doc.getString("refundTransactionId"),
              customerOrderCount = (doc.getLong("customerOrderCount") ?: doc.getDouble("customerOrderCount"))?.toInt() ?: 1
            )
          } catch (e: Exception) {
            null
          }
        }.sortedByDescending { it.orderTimeMillis }
        if (list.isNotEmpty()) onUpdate(list)
      }
    }
  }

  suspend fun syncOrder(order: Order) {
    val firestore = db ?: return
    try {
      val data = mutableMapOf<String, Any>(
        "id" to order.id,
        "orderNumber" to order.orderNumber,
        "customerName" to order.customerName,
        "customerEmail" to order.customerEmail,
        "customerPhone" to order.customerPhone,
        "status" to order.status.name,
        "subtotal" to order.subtotal,
        "discount" to order.discount,
        "deliveryFee" to order.deliveryFee,
        "tax" to order.tax,
        "packagingFee" to 0.0,
        "tip" to order.tip,
        "total" to order.total,
        "paymentMethod" to order.paymentMethod,
        "paymentStatus" to order.paymentStatus,
        "orderTimeMillis" to order.orderTimeMillis,
        "estimatedDeliveryMinutes" to order.estimatedDeliveryMinutes,
        "deliveryAddress" to order.deliveryAddress,
        "specialInstructions" to order.specialInstructions,
        "refundStatus" to order.refundStatus,
        "storeName" to "Nutrolix",
        "customerOrderCount" to order.customerOrderCount
      )
      order.cancellationReason?.let { data["cancellationReason"] = it }
      order.refundAmount?.let { data["refundAmount"] = it }
      order.refundTransactionId?.let { data["refundTransactionId"] = it }
      order.ratingSubmitted?.let { data["ratingSubmitted"] = it }
      order.reviewText?.let { data["reviewText"] = it }

      val itemsSummary = order.items.map { itm ->
        mapOf(
          "mealId" to itm.meal.id,
          "mealName" to itm.meal.name,
          "quantity" to itm.quantity,
          "price" to itm.totalPrice,
          "portion" to itm.selectedPortion.name
        )
      }
      data["items"] = itemsSummary

      firestore.collection("orders").document(order.id).set(data, SetOptions.merge()).await()
      Log.d(TAG, "Order ${order.orderNumber} successfully synced to Firestore")

      // Upsert customer into "users" collection
      if (order.customerPhone.isNotBlank()) {
        val userMap = mutableMapOf<String, Any>(
          "id" to order.customerPhone,
          "phone" to order.customerPhone,
          "name" to order.customerName,
          "lastAddress" to order.deliveryAddress,
          "lastOrderNumber" to order.orderNumber,
          "lastOrderAmount" to order.total,
          "lastOrderTime" to order.orderTimeMillis,
          "updatedAt" to System.currentTimeMillis()
        )
        firestore.collection("users").document(order.customerPhone).set(userMap, SetOptions.merge()).await()
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error syncing order to Firestore", e)
    }
  }

  suspend fun deleteOrder(orderId: String) {
    val firestore = db ?: return
    try {
      firestore.collection("orders").document(orderId).delete().await()
      Log.d(TAG, "Order $orderId deleted from Firestore")
    } catch (e: Exception) {
      Log.e(TAG, "Error deleting order from Firestore", e)
    }
  }

  suspend fun cleanupDeliveredOrders(olderThanDays: Int = 30): Int {
    val firestore = db ?: return 0
    return try {
      val cutoffTime = if (olderThanDays > 0) {
        System.currentTimeMillis() - (olderThanDays.toLong() * 24 * 60 * 60 * 1000)
      } else {
        System.currentTimeMillis()
      }

      val snapshot = firestore.collection("orders").get().await()
      var count = 0
      val batch = firestore.batch()

      for (doc in snapshot.documents) {
        val status = doc.getString("status") ?: ""
        val isDone = status == "DELIVERED" || status == "CANCELLED"
        val orderTime = doc.getLong("orderTimeMillis") ?: 0L

        if (isDone && (olderThanDays == 0 || orderTime < cutoffTime)) {
          batch.delete(doc.reference)
          count++
        }
      }

      if (count > 0) {
        batch.commit().await()
      }
      Log.d(TAG, "Cleaned up $count completed orders from Firestore (olderThanDays: $olderThanDays)")
      count
    } catch (e: Exception) {
      Log.e(TAG, "Error cleaning up orders from Firestore", e)
      0
    }
  }

  suspend fun syncUser(userId: String, name: String, phone: String, email: String = "", address: String = "") {
    val firestore = db ?: return
    try {
      val data = mapOf(
        "id" to userId,
        "name" to name,
        "phone" to phone,
        "email" to email,
        "lastAddress" to address,
        "updatedAt" to System.currentTimeMillis()
      )
      firestore.collection("users").document(userId).set(data, SetOptions.merge()).await()
    } catch (e: Exception) {
      Log.e(TAG, "Error syncing user to Firestore", e)
    }
  }

  // -------------------------------------------------------------
  // REVIEWS (LIVE SYNC)
  // -------------------------------------------------------------
  fun listenToReviews(onUpdate: (List<ProductReview>) -> Unit): ListenerRegistration? {
    val firestore = db ?: return null
    return firestore.collection("reviews").addSnapshotListener { snapshot, error ->
      if (error != null) return@addSnapshotListener
      if (snapshot != null && !snapshot.isEmpty) {
        val list = snapshot.documents.mapNotNull { doc ->
          try {
            ProductReview(
              id = doc.getString("id") ?: doc.id,
              mealId = doc.getString("mealId") ?: "",
              mealName = doc.getString("mealName") ?: "",
              orderId = doc.getString("orderId") ?: "",
              orderNumber = doc.getString("orderNumber") ?: "",
              customerPhone = doc.getString("customerPhone") ?: "",
              customerName = doc.getString("customerName") ?: "",
              rating = (doc.getLong("rating") ?: 5L).toInt(),
              reviewText = doc.getString("reviewText") ?: "",
              timestampMillis = doc.getLong("timestampMillis") ?: System.currentTimeMillis()
            )
          } catch (e: Exception) {
            null
          }
        }
        if (list.isNotEmpty()) onUpdate(list)
      }
    }
  }

  suspend fun syncReview(review: ProductReview) {
    val firestore = db ?: return
    try {
      val data = mapOf(
        "id" to review.id,
        "mealId" to review.mealId,
        "mealName" to review.mealName,
        "orderId" to review.orderId,
        "orderNumber" to review.orderNumber,
        "customerPhone" to review.customerPhone,
        "customerName" to review.customerName,
        "rating" to review.rating,
        "reviewText" to review.reviewText,
        "timestampMillis" to review.timestampMillis
      )
      firestore.collection("reviews").document(review.id).set(data, SetOptions.merge()).await()
      Log.d(TAG, "Review ${review.id} synced to Firestore for meal ${review.mealName}")
    } catch (e: Exception) {
      Log.e(TAG, "Error syncing review to Firestore", e)
    }
  }

  // -------------------------------------------------------------
  // ACTIVE ONE-SHOT FETCH FOR PULL-TO-REFRESH
  // -------------------------------------------------------------
  suspend fun fetchOrders(): List<Order> {
    val firestore = db ?: return emptyList()
    return try {
      val snapshot = firestore.collection("orders").get().await()
      snapshot.documents.mapNotNull { doc ->
        try {
          val statusStr = doc.getString("status") ?: "PLACED"
          val status = try { OrderStatus.valueOf(statusStr) } catch (_: Exception) { OrderStatus.PLACED }
          val rawItems = doc.get("items") as? List<Map<String, Any>> ?: emptyList()
          val cartItems = rawItems.map { itm ->
            val mealName = itm["mealName"] as? String ?: "Nutrition Dish"
            val price = (itm["price"] as? Number)?.toDouble() ?: 0.0
            val qty = (itm["quantity"] as? Number)?.toInt() ?: 1
            val portion = itm["portion"] as? String ?: "Regular"
            CartItem(
              cartItemId = java.util.UUID.randomUUID().toString(),
              meal = MealItem(
                id = itm["mealId"] as? String ?: "meal",
                name = mealName,
                description = "",
                categoryId = "cat_all",
                price = price,
                discountedPrice = price,
                imageUrl = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
                isVeg = true,
                proteinGrams = 30,
                calories = 400
              ),
              selectedPortion = PortionSize(portion, 0.0),
              quantity = qty
            )
          }

          Order(
            id = doc.getString("id") ?: doc.id,
            orderNumber = doc.getString("orderNumber") ?: "NUTRO-${doc.id.take(4)}",
            customerPhone = doc.getString("customerPhone") ?: "",
            customerName = doc.getString("customerName") ?: "Customer",
            customerEmail = doc.getString("customerEmail") ?: "",
            items = cartItems,
            subtotal = doc.getDouble("subtotal") ?: 0.0,
            discount = doc.getDouble("discount") ?: 0.0,
            deliveryFee = doc.getDouble("deliveryFee") ?: 0.0,
            tax = doc.getDouble("tax") ?: 0.0,
            packagingFee = 0.0,
            tip = doc.getDouble("tip") ?: 0.0,
            total = doc.getDouble("total") ?: 0.0,
            status = status,
            paymentMethod = doc.getString("paymentMethod") ?: "Online Payment",
            paymentStatus = doc.getString("paymentStatus") ?: "PAID",
            orderTimeMillis = doc.getLong("orderTimeMillis") ?: System.currentTimeMillis(),
            estimatedDeliveryMinutes = (doc.getLong("estimatedDeliveryMinutes") ?: 25L).toInt(),
            deliveryAddress = doc.getString("deliveryAddress") ?: "",
            deliveryOtp = doc.getString("deliveryOtp") ?: "",
            specialInstructions = doc.getString("specialInstructions") ?: "",
            ratingSubmitted = doc.getLong("ratingSubmitted")?.toInt(),
            reviewText = doc.getString("reviewText"),
            statusHistory = listOf(
              OrderStatusHistoryItem(status, doc.getLong("orderTimeMillis") ?: System.currentTimeMillis(), "Status: ${status.title}")
            ),
            cancellationReason = doc.getString("cancellationReason"),
            refundStatus = doc.getString("refundStatus") ?: "Not Applicable",
            refundAmount = doc.getDouble("refundAmount"),
            refundTransactionId = doc.getString("refundTransactionId")
          )
        } catch (_: Exception) {
          null
        }
      }.sortedByDescending { it.orderTimeMillis }
    } catch (e: Exception) {
      Log.e(TAG, "Error fetching orders from Firestore", e)
      emptyList()
    }
  }

  suspend fun fetchMeals(): List<MealItem> {
    val firestore = db ?: return emptyList()
    return try {
      val snapshot = firestore.collection("meals").get().await()
      snapshot.documents.mapNotNull { doc ->
        try {
          MealItem(
            id = doc.getString("id") ?: doc.id,
            name = doc.getString("name") ?: "",
            description = doc.getString("description") ?: "",
            categoryId = doc.getString("categoryId") ?: "cat_protein",
            price = doc.getDouble("price") ?: 249.0,
            discountedPrice = doc.getDouble("discountedPrice") ?: (doc.getDouble("price") ?: 249.0),
            imageUrl = doc.getString("imageUrl") ?: "",
            isVeg = doc.getBoolean("isVeg") ?: true,
            isVegan = doc.getBoolean("isVegan") ?: false,
            proteinGrams = (doc.getLong("proteinGrams") ?: 30L).toInt(),
            carbsGrams = (doc.getLong("carbsGrams") ?: 25L).toInt(),
            fatsGrams = (doc.getLong("fatsGrams") ?: 12L).toInt(),
            fiberGrams = (doc.getLong("fiberGrams") ?: 8L).toInt(),
            calories = (doc.getLong("calories") ?: 400L).toInt(),
            verifiedHealthTag = doc.getString("verifiedHealthTag") ?: "Clean Healthy Nutrition",
            prepTimeMinutes = (doc.getLong("prepTimeMinutes") ?: 18L).toInt(),
            rating = doc.getDouble("rating") ?: 4.8,
            reviewCount = (doc.getLong("reviewCount") ?: 0L).toInt(),
            isBestseller = doc.getBoolean("isBestseller") ?: false,
            isNew = doc.getBoolean("isNew") ?: false,
            isAvailable = doc.getBoolean("isAvailable") ?: true
          )
        } catch (_: Exception) {
          null
        }
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error fetching meals from Firestore", e)
      emptyList()
    }
  }

  suspend fun fetchStoreSettings(): StoreSettings? {
    val firestore = db ?: return null
    return try {
      val snapshot = firestore.collection("settings").document("store_config").get().await()
      if (snapshot.exists()) {
        StoreSettings(
          storeName = snapshot.getString("storeName") ?: "Nutrolix",
          tagline = snapshot.getString("tagline") ?: "Nutrition That Works",
          isOpen = snapshot.getBoolean("isOpen") ?: true,
          deliveryFee = snapshot.getDouble("deliveryFee") ?: 29.0,
          freeDeliveryAbove = snapshot.getDouble("freeDeliveryAbove") ?: 199.0,
          announcement = snapshot.getString("announcement") ?: "⚡ 100% Fresh Healthy Meals • Delivered in 25 mins",
          payuEnabled = snapshot.getBoolean("payuEnabled") ?: true,
          payuIsLive = snapshot.getBoolean("payuIsLive") ?: true,
          payuMerchantKey = snapshot.getString("payuMerchantKey") ?: "",
          payuMerchantSalt = snapshot.getString("payuMerchantSalt") ?: ""
        )
      } else null
    } catch (e: Exception) {
      Log.e(TAG, "Error fetching store settings", e)
      null
    }
  }

  suspend fun fetchBanners(): List<PromoBanner> {
    val firestore = db ?: return emptyList()
    return try {
      val snapshot = firestore.collection("banners").get().await()
      snapshot.documents.mapNotNull { doc ->
        try {
          PromoBanner(
            id = doc.getString("id") ?: doc.id,
            title = doc.getString("title") ?: "",
            subtitle = doc.getString("subtitle") ?: "",
            badge = doc.getString("badge") ?: "SPECIAL",
            imageUrl = doc.getString("imageUrl") ?: "",
            discountCode = doc.getString("discountCode") ?: "",
            isActive = doc.getBoolean("isActive") ?: true
          )
        } catch (_: Exception) {
          null
        }
      }
    } catch (e: Exception) {
      emptyList()
    }
  }

  suspend fun fetchCoupons(): List<Coupon> {
    val firestore = db ?: return emptyList()
    return try {
      val snapshot = firestore.collection("coupons").get().await()
      snapshot.documents.mapNotNull { doc ->
        try {
          val code = doc.getString("code") ?: doc.id
          val title = doc.getString("title") ?: code
          val discVal = doc.getDouble("discountValue") ?: doc.getDouble("discountAmount") ?: 50.0
          val typeStr = doc.getString("discountType") ?: "FIXED_AMOUNT"
          val discType = if (typeStr.contains("PERCENTAGE", ignoreCase = true)) DiscountType.PERCENTAGE else DiscountType.FIXED_AMOUNT
          Coupon(
            code = code,
            title = title,
            discountAmount = discVal,
            minOrder = doc.getDouble("minOrder") ?: 199.0,
            description = doc.getString("description") ?: "",
            discountType = discType,
            discountValue = discVal,
            maxDiscount = doc.getDouble("maxDiscount") ?: 150.0,
            isAutoApplied = doc.getBoolean("isAutoApplied") ?: false,
            isActive = doc.getBoolean("isActive") ?: true
          )
        } catch (_: Exception) {
          null
        }
      }
    } catch (e: Exception) {
      emptyList()
    }
  }
}
