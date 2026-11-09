package com.example.util

import android.content.Context
import com.example.model.AdminSession
import com.example.model.CustomerAccount
import com.example.model.UserProfile
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.util.UUID

object SecurityUtils {
  fun generateSalt(): String = UUID.randomUUID().toString().take(8)

  fun hashPin(pin: String, salt: String): String {
    val input = "$salt:$pin:nutrolix_pin_secure_2026"
    val md = MessageDigest.getInstance("SHA-256")
    val bytes = md.digest(input.toByteArray(Charsets.UTF_8))
    return bytes.joinToString("") { "%02x".format(it) }
  }

  fun hashPassword(password: String, salt: String): String {
    val input = "$salt:$password:nutrolix_admin_auth_2026"
    val md = MessageDigest.getInstance("SHA-256")
    val bytes = md.digest(input.toByteArray(Charsets.UTF_8))
    return bytes.joinToString("") { "%02x".format(it) }
  }
}

/**
 * In-memory rate limiter to prevent brute-force 4-digit PIN guesses
 */
object RateLimiter {
  private data class AttemptRecord(var count: Int, var firstAttemptMillis: Long, var lockedUntilMillis: Long = 0L)
  private val attemptsMap = mutableMapOf<String, AttemptRecord>()
  private const val MAX_ATTEMPTS = 5
  private const val LOCKOUT_DURATION_MS = 60_000L // 60 seconds lockout
  private const val WINDOW_MS = 300_000L // 5 minutes window

  @Synchronized
  fun checkIsLocked(identifier: String): Pair<Boolean, Long> {
    val record = attemptsMap[identifier] ?: return Pair(false, 0L)
    val now = System.currentTimeMillis()
    if (record.lockedUntilMillis > now) {
      val remainingSeconds = (record.lockedUntilMillis - now) / 1000
      return Pair(true, remainingSeconds.coerceAtLeast(1L))
    }
    // If window expired, reset
    if (now - record.firstAttemptMillis > WINDOW_MS) {
      attemptsMap.remove(identifier)
    }
    return Pair(false, 0L)
  }

  @Synchronized
  fun recordFailedAttempt(identifier: String): Int {
    val now = System.currentTimeMillis()
    val record = attemptsMap.getOrPut(identifier) { AttemptRecord(0, now) }
    record.count++
    if (record.count >= MAX_ATTEMPTS) {
      record.lockedUntilMillis = now + LOCKOUT_DURATION_MS
    }
    return record.count
  }

  @Synchronized
  fun recordSuccess(identifier: String) {
    attemptsMap.remove(identifier)
  }
}

/**
 * Persistent storage for Customer Accounts, Customer Active Session, and Admin Credentials
 */
object NutrolixStorageManager {
  private const val PREFS_NAME = "nutrolix_store_prefs"

  private const val KEY_IS_LOGGED_IN = "customer_is_logged_in"
  private const val KEY_CUSTOMER_PHONE = "customer_phone"
  private const val KEY_CUSTOMER_NAME = "customer_name"
  private const val KEY_CUSTOMER_EMAIL = "customer_email"
  private const val KEY_CUSTOMER_ADDRESSES = "customer_addresses_json"
  private const val KEY_CURRENT_ADDRESS = "customer_current_address"

  private const val KEY_ACCOUNTS_JSON = "customer_accounts_store"
  private const val KEY_ADMIN_EMAIL = "admin_auth_email"
  private const val KEY_ADMIN_PASSWORD_HASH = "admin_auth_pwd_hash"
  private const val KEY_ADMIN_SALT = "admin_auth_salt"
  private const val KEY_ADMIN_IS_LOGGED_IN = "admin_is_logged_in"

  // First admin account initialization credentials
  const val DEFAULT_ADMIN_EMAIL = "nutrolix.in@gmail.com"
  private const val DEFAULT_INITIAL_ADMIN_PWD = "Nutrolix@Admin2026"

  fun saveCustomerSession(context: Context, profile: UserProfile) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit().apply {
      putBoolean(KEY_IS_LOGGED_IN, profile.isLoggedIn)
      putString(KEY_CUSTOMER_PHONE, profile.phone)
      putString(KEY_CUSTOMER_NAME, profile.name)
      putString(KEY_CUSTOMER_EMAIL, profile.email)
      putString(KEY_CURRENT_ADDRESS, profile.currentAddress)
      val jsonArray = JSONArray(profile.savedAddresses)
      putString(KEY_CUSTOMER_ADDRESSES, jsonArray.toString())
      apply()
    }
  }

  fun saveUserForEmail(context: Context, email: String, name: String, phone: String, currentAddress: String, addresses: List<String>) {
    val cleanEmail = email.trim().lowercase()
    if (cleanEmail.isBlank()) return
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val key = "user_email_data_$cleanEmail"
    val obj = JSONObject().apply {
      put("email", cleanEmail)
      put("name", name)
      put("phone", phone)
      put("currentAddress", currentAddress)
      put("addresses", JSONArray(addresses))
    }
    prefs.edit().putString(key, obj.toString()).apply()
  }

  fun loadUserForEmail(context: Context, email: String): UserProfile? {
    val cleanEmail = email.trim().lowercase()
    if (cleanEmail.isBlank()) return null
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val key = "user_email_data_$cleanEmail"
    val raw = prefs.getString(key, null) ?: return null
    return try {
      val obj = JSONObject(raw)
      val name = obj.optString("name", "")
      val phone = obj.optString("phone", "")
      val currentAddress = obj.optString("currentAddress", "")
      val addrsArray = obj.optJSONArray("addresses")
      val addrs = mutableListOf<String>()
      if (addrsArray != null) {
        for (i in 0 until addrsArray.length()) {
          addrs.add(addrsArray.getString(i))
        }
      }
      UserProfile(
        phone = phone,
        name = name,
        email = cleanEmail,
        savedAddresses = addrs,
        currentAddress = currentAddress,
        isVerified = true,
        isLoggedIn = true
      )
    } catch (_: Exception) {
      null
    }
  }

  fun loadCustomerSession(context: Context): UserProfile? {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val isLoggedIn = prefs.getBoolean(KEY_IS_LOGGED_IN, false)
    val phone = prefs.getString(KEY_CUSTOMER_PHONE, "") ?: ""
    val email = prefs.getString(KEY_CUSTOMER_EMAIL, "") ?: ""
    if (!isLoggedIn || (phone.isBlank() && email.isBlank())) return null

    val name = prefs.getString(KEY_CUSTOMER_NAME, "") ?: ""
    val currentAddr = prefs.getString(KEY_CURRENT_ADDRESS, "") ?: ""
    val addressesRaw = prefs.getString(KEY_CUSTOMER_ADDRESSES, "[]") ?: "[]"
    val addresses = mutableListOf<String>()
    try {
      val jsonArray = JSONArray(addressesRaw)
      for (i in 0 until jsonArray.length()) {
        addresses.add(jsonArray.getString(i))
      }
    } catch (_: Exception) {}

    return UserProfile(
      phone = phone,
      name = name,
      email = email,
      savedAddresses = addresses,
      currentAddress = currentAddr,
      isVerified = true,
      isLoggedIn = true
    )
  }

  fun clearCustomerSession(context: Context) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit().apply {
      putBoolean(KEY_IS_LOGGED_IN, false)
      putString(KEY_CUSTOMER_PHONE, "")
      putString(KEY_CUSTOMER_NAME, "")
      putString(KEY_CUSTOMER_EMAIL, "")
      putString(KEY_CURRENT_ADDRESS, "")
      apply()
    }
  }

  // Customer Accounts Dictionary
  fun loadCustomerAccounts(context: Context): MutableMap<String, CustomerAccount> {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val jsonString = prefs.getString(KEY_ACCOUNTS_JSON, "{}") ?: "{}"
    val result = mutableMapOf<String, CustomerAccount>()
    try {
      val root = JSONObject(jsonString)
      val keys = root.keys()
      while (keys.hasNext()) {
        val phone = keys.next()
        val obj = root.getJSONObject(phone)
        val name = obj.optString("name", "")
        val pinHash = obj.optString("pinHash", "")
        val salt = obj.optString("salt", "")
        val createdAt = obj.optLong("createdAt", System.currentTimeMillis())
        val addrs = mutableListOf<String>()
        val addrsArray = obj.optJSONArray("addresses")
        if (addrsArray != null) {
          for (i in 0 until addrsArray.length()) {
            addrs.add(addrsArray.getString(i))
          }
        }
        result[phone] = CustomerAccount(phone, name, pinHash, salt, addrs, createdAt)
      }
    } catch (_: Exception) {}
    return result
  }

  fun saveCustomerAccounts(context: Context, accounts: Map<String, CustomerAccount>) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val root = JSONObject()
    try {
      for ((phone, acc) in accounts) {
        val obj = JSONObject()
        obj.put("name", acc.name)
        obj.put("pinHash", acc.pinHash)
        obj.put("salt", acc.salt)
        obj.put("createdAt", acc.createdAtMillis)
        obj.put("addresses", JSONArray(acc.savedAddresses))
        root.put(phone, obj)
      }
      prefs.edit().putString(KEY_ACCOUNTS_JSON, root.toString()).apply()
    } catch (_: Exception) {}
  }

  // Admin Credentials Storage
  fun initAdminCredentialsIfMissing(context: Context) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    if (!prefs.contains(KEY_ADMIN_EMAIL)) {
      val salt = SecurityUtils.generateSalt()
      val pwdHash = SecurityUtils.hashPassword(DEFAULT_INITIAL_ADMIN_PWD, salt)
      prefs.edit().apply {
        putString(KEY_ADMIN_EMAIL, DEFAULT_ADMIN_EMAIL)
        putString(KEY_ADMIN_PASSWORD_HASH, pwdHash)
        putString(KEY_ADMIN_SALT, salt)
        apply()
      }
    }
  }

  fun getAuthorizedAdminEmail(context: Context): String {
    initAdminCredentialsIfMissing(context)
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return prefs.getString(KEY_ADMIN_EMAIL, DEFAULT_ADMIN_EMAIL) ?: DEFAULT_ADMIN_EMAIL
  }

  fun verifyAdminPassword(context: Context, email: String, rawPassword: String): Boolean {
    initAdminCredentialsIfMissing(context)
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val authorizedEmail = prefs.getString(KEY_ADMIN_EMAIL, DEFAULT_ADMIN_EMAIL) ?: DEFAULT_ADMIN_EMAIL
    if (!email.trim().equals(authorizedEmail, ignoreCase = true)) return false

    val salt = prefs.getString(KEY_ADMIN_SALT, "") ?: ""
    val storedHash = prefs.getString(KEY_ADMIN_PASSWORD_HASH, "") ?: ""
    val computedHash = SecurityUtils.hashPassword(rawPassword.trim(), salt)
    return computedHash == storedHash
  }

  fun updateAdminPassword(context: Context, oldRawPwd: String, newRawPwd: String): Boolean {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val email = getAuthorizedAdminEmail(context)
    if (!verifyAdminPassword(context, email, oldRawPwd)) return false

    val newSalt = SecurityUtils.generateSalt()
    val newHash = SecurityUtils.hashPassword(newRawPwd.trim(), newSalt)
    prefs.edit().apply {
      putString(KEY_ADMIN_PASSWORD_HASH, newHash)
      putString(KEY_ADMIN_SALT, newSalt)
      apply()
    }
    return true
  }

  private const val KEY_ADMIN_ACTIVE_ROLE = "admin_active_role"
  private const val KEY_STORE_SETTINGS_JSON = "store_settings_json"
  private const val KEY_COUPONS_JSON = "store_coupons_json"
  private const val KEY_ORDERS_JSON = "store_orders_json"
  private const val KEY_REVIEWS_JSON = "store_reviews_json"
  private const val KEY_REVIEWED_ORDERS_SET = "store_reviewed_orders_set"
  private const val KEY_PAYU_MERCHANT_KEY = "payu_merchant_key"
  private const val KEY_PAYU_MERCHANT_SALT = "payu_merchant_salt"
  private const val KEY_PAYU_IS_LIVE = "payu_is_live"
  private const val KEY_PAYU_ENABLED = "payu_enabled"

  fun saveAdminSession(context: Context, isAuthenticated: Boolean, adminEmail: String, isRoleAdmin: Boolean = true) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit().apply {
      putBoolean(KEY_ADMIN_IS_LOGGED_IN, isAuthenticated)
      putBoolean(KEY_ADMIN_ACTIVE_ROLE, isAuthenticated && isRoleAdmin)
      if (isAuthenticated) {
        putString(KEY_ADMIN_EMAIL, adminEmail)
      }
      apply()
    }
  }

  fun loadAdminSession(context: Context): AdminSession {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val isAuth = prefs.getBoolean(KEY_ADMIN_IS_LOGGED_IN, false)
    val email = prefs.getString(KEY_ADMIN_EMAIL, DEFAULT_ADMIN_EMAIL) ?: DEFAULT_ADMIN_EMAIL
    return AdminSession(isAuthenticated = isAuth, adminEmail = if (isAuth) email else "")
  }

  fun isStoredAdminRoleActive(context: Context): Boolean {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return prefs.getBoolean(KEY_ADMIN_ACTIVE_ROLE, false)
  }

  fun saveStoreSettings(context: Context, settings: com.example.model.StoreSettings) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    // Never allow existing saved keys to be overwritten with blank strings
    val currentSavedKey = prefs.getString(KEY_PAYU_MERCHANT_KEY, "") ?: ""
    val currentSavedSalt = prefs.getString(KEY_PAYU_MERCHANT_SALT, "") ?: ""

    val finalKey = if (settings.payuMerchantKey.isNotBlank()) settings.payuMerchantKey else currentSavedKey
    val finalSalt = if (settings.payuMerchantSalt.isNotBlank()) settings.payuMerchantSalt else currentSavedSalt

    val obj = JSONObject().apply {
      put("storeName", settings.storeName)
      put("tagline", settings.tagline)
      put("isOpen", settings.isOpen)
      put("deliveryFee", settings.deliveryFee)
      put("freeDeliveryAbove", settings.freeDeliveryAbove)
      put("announcement", settings.announcement)
      put("payuEnabled", settings.payuEnabled)
      put("payuIsLive", settings.payuIsLive)
      put("payuMerchantKey", finalKey)
      put("payuMerchantSalt", finalSalt)
    }

    prefs.edit().apply {
      putString(KEY_STORE_SETTINGS_JSON, obj.toString())
      if (finalKey.isNotBlank()) {
        putString(KEY_PAYU_MERCHANT_KEY, finalKey)
      }
      if (finalSalt.isNotBlank()) {
        putString(KEY_PAYU_MERCHANT_SALT, finalSalt)
      }
      putBoolean(KEY_PAYU_ENABLED, settings.payuEnabled)
      putBoolean(KEY_PAYU_IS_LIVE, settings.payuIsLive)
      apply()
    }
  }

  fun loadStoreSettings(context: Context): com.example.model.StoreSettings {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val standaloneKey = prefs.getString(KEY_PAYU_MERCHANT_KEY, "") ?: ""
    val standaloneSalt = prefs.getString(KEY_PAYU_MERCHANT_SALT, "") ?: ""
    val standaloneLive = prefs.getBoolean(KEY_PAYU_IS_LIVE, true)
    val standaloneEnabled = prefs.getBoolean(KEY_PAYU_ENABLED, true)

    val json = prefs.getString(KEY_STORE_SETTINGS_JSON, null)
    if (json == null) {
      return com.example.model.StoreSettings(
        payuEnabled = standaloneEnabled,
        payuIsLive = standaloneLive,
        payuMerchantKey = standaloneKey,
        payuMerchantSalt = standaloneSalt
      )
    }
    return try {
      val obj = JSONObject(json)
      val keyFromObj = obj.optString("payuMerchantKey", "")
      val saltFromObj = obj.optString("payuMerchantSalt", "")
      val resolvedKey = if (keyFromObj.isNotBlank()) keyFromObj else standaloneKey
      val resolvedSalt = if (saltFromObj.isNotBlank()) saltFromObj else standaloneSalt

      com.example.model.StoreSettings(
        storeName = obj.optString("storeName", "Nutrolix"),
        tagline = obj.optString("tagline", "Nutrition That Works"),
        isOpen = obj.optBoolean("isOpen", true),
        deliveryFee = obj.optDouble("deliveryFee", 29.0),
        freeDeliveryAbove = obj.optDouble("freeDeliveryAbove", 199.0),
        announcement = obj.optString("announcement", "⚡ 100% Fresh Healthy Meals • Delivered in 25 mins"),
        payuEnabled = obj.optBoolean("payuEnabled", standaloneEnabled),
        payuIsLive = obj.optBoolean("payuIsLive", standaloneLive),
        payuMerchantKey = resolvedKey,
        payuMerchantSalt = resolvedSalt
      )
    } catch (_: Exception) {
      com.example.model.StoreSettings(
        payuEnabled = standaloneEnabled,
        payuIsLive = standaloneLive,
        payuMerchantKey = standaloneKey,
        payuMerchantSalt = standaloneSalt
      )
    }
  }

  fun saveCoupons(context: Context, coupons: List<com.example.model.Coupon>) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val array = JSONArray()
    for (c in coupons) {
      val obj = JSONObject().apply {
        put("code", c.code)
        put("title", c.title)
        put("discountAmount", c.discountAmount)
        put("minOrder", c.minOrder)
        put("description", c.description)
        put("discountType", c.discountType.name)
        put("discountValue", c.discountValue)
        put("maxDiscount", c.maxDiscount)
        put("isAutoApplied", c.isAutoApplied)
        put("isActive", c.isActive)
      }
      array.put(obj)
    }
    prefs.edit().putString(KEY_COUPONS_JSON, array.toString()).apply()
  }

  fun loadCoupons(context: Context): List<com.example.model.Coupon>? {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val json = prefs.getString(KEY_COUPONS_JSON, null) ?: return null
    return try {
      val array = JSONArray(json)
      val list = mutableListOf<com.example.model.Coupon>()
      for (i in 0 until array.length()) {
        val obj = array.getJSONObject(i)
        val typeStr = obj.optString("discountType", "FIXED_AMOUNT")
        val dType = try { com.example.model.DiscountType.valueOf(typeStr) } catch (_: Exception) { com.example.model.DiscountType.FIXED_AMOUNT }
        list.add(
          com.example.model.Coupon(
            code = obj.optString("code", ""),
            title = obj.optString("title", ""),
            discountAmount = obj.optDouble("discountAmount", 50.0),
            minOrder = obj.optDouble("minOrder", 199.0),
            description = obj.optString("description", ""),
            discountType = dType,
            discountValue = obj.optDouble("discountValue", obj.optDouble("discountAmount", 50.0)),
            maxDiscount = obj.optDouble("maxDiscount", 150.0),
            isAutoApplied = obj.optBoolean("isAutoApplied", false),
            isActive = obj.optBoolean("isActive", true)
          )
        )
      }
      list
    } catch (_: Exception) {
      null
    }
  }

  fun saveOrders(context: Context, orders: List<com.example.model.Order>) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val array = JSONArray()
    for (ord in orders) {
      val obj = JSONObject().apply {
        put("id", ord.id)
        put("orderNumber", ord.orderNumber)
        put("customerPhone", ord.customerPhone)
        put("customerName", ord.customerName)
        put("subtotal", ord.subtotal)
        put("discount", ord.discount)
        put("deliveryFee", ord.deliveryFee)
        put("tax", ord.tax)
        put("packagingFee", 0.0) // Eco Packaging Fee permanently removed
        put("tip", ord.tip)
        put("total", ord.total)
        put("status", ord.status.name)
        put("paymentMethod", ord.paymentMethod)
        put("paymentStatus", ord.paymentStatus)
        put("orderTimeMillis", ord.orderTimeMillis)
        put("estimatedDeliveryMinutes", ord.estimatedDeliveryMinutes)
        put("deliveryAddress", ord.deliveryAddress)
        put("deliveryOtp", ord.deliveryOtp)
        put("specialInstructions", ord.specialInstructions)
        if (ord.ratingSubmitted != null) put("ratingSubmitted", ord.ratingSubmitted)
        if (ord.reviewText != null) put("reviewText", ord.reviewText)
        if (ord.cancellationReason != null) put("cancellationReason", ord.cancellationReason)
        put("refundStatus", ord.refundStatus)
        if (ord.refundAmount != null) put("refundAmount", ord.refundAmount)
        if (ord.refundTransactionId != null) put("refundTransactionId", ord.refundTransactionId)

        // Status history
        val histArray = JSONArray()
        for (h in ord.statusHistory) {
          val hObj = JSONObject().apply {
            put("status", h.status.name)
            put("timestampMillis", h.timestampMillis)
            put("note", h.note)
          }
          histArray.put(hObj)
        }
        put("statusHistory", histArray)

        // Items
        val itemsArray = JSONArray()
        for (item in ord.items) {
          val itmObj = JSONObject().apply {
            put("cartItemId", item.cartItemId)
            put("mealId", item.meal.id)
            put("mealName", item.meal.name)
            put("mealDesc", item.meal.description)
            put("mealPrice", item.meal.price)
            put("mealDiscountedPrice", item.meal.discountedPrice)
            put("mealImage", item.meal.imageUrl)
            put("mealIsVeg", item.meal.isVeg)
            put("proteinGrams", item.meal.proteinGrams)
            put("calories", item.meal.calories)
            put("portionName", item.selectedPortion.name)
            put("portionDelta", item.selectedPortion.priceDelta)
            put("portionMultiplier", item.selectedPortion.multiplier)
            put("quantity", item.quantity)
            put("cookingInstruction", item.cookingInstruction)
          }
          itemsArray.put(itmObj)
        }
        put("items", itemsArray)
      }
      array.put(obj)
    }
    prefs.edit().putString(KEY_ORDERS_JSON, array.toString()).apply()
  }

  fun loadOrders(context: Context): List<com.example.model.Order>? {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val json = prefs.getString(KEY_ORDERS_JSON, null) ?: return null
    return try {
      val array = JSONArray(json)
      val list = mutableListOf<com.example.model.Order>()
      for (i in 0 until array.length()) {
        val obj = array.getJSONObject(i)
        val statusStr = obj.optString("status", "PLACED")
        val status = try { com.example.model.OrderStatus.valueOf(statusStr) } catch (_: Exception) { com.example.model.OrderStatus.PLACED }

        val histList = mutableListOf<com.example.model.OrderStatusHistoryItem>()
        val histArray = obj.optJSONArray("statusHistory")
        if (histArray != null) {
          for (hIdx in 0 until histArray.length()) {
            val hObj = histArray.getJSONObject(hIdx)
            val hStatus = try { com.example.model.OrderStatus.valueOf(hObj.optString("status", "PLACED")) } catch (_: Exception) { com.example.model.OrderStatus.PLACED }
            histList.add(
              com.example.model.OrderStatusHistoryItem(
                status = hStatus,
                timestampMillis = hObj.optLong("timestampMillis", System.currentTimeMillis()),
                note = hObj.optString("note", "")
              )
            )
          }
        }

        val itemsList = mutableListOf<com.example.model.CartItem>()
        val itemsArray = obj.optJSONArray("items")
        if (itemsArray != null) {
          for (itIdx in 0 until itemsArray.length()) {
            val itmObj = itemsArray.getJSONObject(itIdx)
            val meal = com.example.model.MealItem(
              id = itmObj.optString("mealId", "meal_item"),
              name = itmObj.optString("mealName", "Clean Meal"),
              description = itmObj.optString("mealDesc", "Nutritious meal"),
              categoryId = "high_protein",
              price = itmObj.optDouble("mealPrice", 299.0),
              discountedPrice = itmObj.optDouble("mealDiscountedPrice", 249.0),
              imageUrl = itmObj.optString("mealImage", ""),
              isVeg = itmObj.optBoolean("mealIsVeg", true),
              proteinGrams = itmObj.optInt("proteinGrams", 25),
              calories = itmObj.optInt("calories", 450)
            )
            val portion = com.example.model.PortionSize(
              name = itmObj.optString("portionName", "Regular"),
              priceDelta = itmObj.optDouble("portionDelta", 0.0),
              multiplier = itmObj.optDouble("portionMultiplier", 1.0)
            )
            itemsList.add(
              com.example.model.CartItem(
                cartItemId = itmObj.optString("cartItemId", java.util.UUID.randomUUID().toString()),
                meal = meal,
                selectedPortion = portion,
                quantity = itmObj.optInt("quantity", 1),
                cookingInstruction = itmObj.optString("cookingInstruction", "")
              )
            )
          }
        }

        list.add(
          com.example.model.Order(
            id = obj.optString("id", java.util.UUID.randomUUID().toString()),
            orderNumber = obj.optString("orderNumber", "NUTRO-1000"),
            customerPhone = obj.optString("customerPhone", ""),
            customerName = obj.optString("customerName", "Customer"),
            items = itemsList,
            subtotal = obj.optDouble("subtotal", 0.0),
            discount = obj.optDouble("discount", 0.0),
            deliveryFee = obj.optDouble("deliveryFee", 0.0),
            tax = obj.optDouble("tax", 0.0),
            packagingFee = 0.0,
            tip = obj.optDouble("tip", 0.0),
            total = obj.optDouble("total", 0.0),
            status = status,
            paymentMethod = obj.optString("paymentMethod", "Cash on Delivery"),
            paymentStatus = obj.optString("paymentStatus", "PENDING"),
            orderTimeMillis = obj.optLong("orderTimeMillis", System.currentTimeMillis()),
            estimatedDeliveryMinutes = obj.optInt("estimatedDeliveryMinutes", 25),
            deliveryAddress = obj.optString("deliveryAddress", ""),
            deliveryOtp = obj.optString("deliveryOtp", ""),
            specialInstructions = obj.optString("specialInstructions", ""),
            ratingSubmitted = if (obj.has("ratingSubmitted")) obj.getInt("ratingSubmitted") else null,
            reviewText = if (obj.has("reviewText")) obj.getString("reviewText") else null,
            statusHistory = histList,
            cancellationReason = if (obj.has("cancellationReason")) obj.getString("cancellationReason") else null,
            refundStatus = obj.optString("refundStatus", "Not Applicable"),
            refundAmount = if (obj.has("refundAmount")) obj.getDouble("refundAmount") else null,
            refundTransactionId = if (obj.has("refundTransactionId")) obj.getString("refundTransactionId") else null
          )
        )
      }
      list
    } catch (_: Exception) {
      null
    }
  }

  fun saveReviews(context: Context, reviews: List<com.example.model.ProductReview>) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val array = JSONArray()
    for (rev in reviews) {
      val obj = JSONObject().apply {
        put("id", rev.id)
        put("mealId", rev.mealId)
        put("mealName", rev.mealName)
        put("orderId", rev.orderId)
        put("orderNumber", rev.orderNumber)
        put("customerPhone", rev.customerPhone)
        put("customerName", rev.customerName)
        put("rating", rev.rating)
        put("reviewText", rev.reviewText)
        put("timestampMillis", rev.timestampMillis)
      }
      array.put(obj)
    }
    prefs.edit().putString(KEY_REVIEWS_JSON, array.toString()).apply()
  }

  fun loadReviews(context: Context): List<com.example.model.ProductReview>? {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val json = prefs.getString(KEY_REVIEWS_JSON, null) ?: return null
    return try {
      val array = JSONArray(json)
      val list = mutableListOf<com.example.model.ProductReview>()
      for (i in 0 until array.length()) {
        val obj = array.getJSONObject(i)
        list.add(
          com.example.model.ProductReview(
            id = obj.optString("id", java.util.UUID.randomUUID().toString()),
            mealId = obj.optString("mealId", ""),
            mealName = obj.optString("mealName", ""),
            orderId = obj.optString("orderId", ""),
            orderNumber = obj.optString("orderNumber", ""),
            customerPhone = obj.optString("customerPhone", ""),
            customerName = obj.optString("customerName", "Customer"),
            rating = obj.optInt("rating", 5),
            reviewText = obj.optString("reviewText", ""),
            timestampMillis = obj.optLong("timestampMillis", System.currentTimeMillis())
          )
        )
      }
      list
    } catch (_: Exception) {
      null
    }
  }

  fun markOrderReviewed(context: Context, orderId: String) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val existing = prefs.getStringSet(KEY_REVIEWED_ORDERS_SET, emptySet())?.toMutableSet() ?: mutableSetOf()
    existing.add(orderId)
    prefs.edit().putStringSet(KEY_REVIEWED_ORDERS_SET, existing).apply()
  }

  fun isOrderReviewed(context: Context, orderId: String): Boolean {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val set = prefs.getStringSet(KEY_REVIEWED_ORDERS_SET, emptySet()) ?: emptySet()
    return set.contains(orderId)
  }
}
