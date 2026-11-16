package com.example.service

import android.content.Intent
import android.util.Log
import com.example.MainActivity
import com.example.model.Order
import com.example.model.OrderStatus
import com.example.util.OrderAlarmPlayer
import com.example.util.OrderNotificationHelper
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject

class NutrolixFirebaseMessagingService : FirebaseMessagingService() {

  companion object {
    private const val TAG = "NutrolixFCM"
    const val PREFS_NAME = "nutrolix_fcm_prefs"
    const val KEY_FCM_TOKEN = "fcm_token"
    const val ACTION_ORDER_PUSH_RECEIVED = "com.example.NUTROLIX_ORDER_PUSH_RECEIVED"
  }

  private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

  override fun onNewToken(token: String) {
    super.onNewToken(token)
    Log.i(TAG, "Refreshed FCM token received")
    getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
      .edit()
      .putString(KEY_FCM_TOKEN, token)
      .apply()

    val isAdminApp = applicationContext.packageName.contains("admin", ignoreCase = true)
    val currentUser = try { FirebaseAuth.getInstance().currentUser } catch (_: Throwable) { null }
    val authPrefs = getSharedPreferences(MainActivity.PREFS_AUTH, MODE_PRIVATE)
    val prefUid = authPrefs.getString(MainActivity.KEY_AUTH_UID, "") ?: ""
    val prefPhone = authPrefs.getString(MainActivity.KEY_AUTH_PHONE, "") ?: ""
    val rawPhone = (currentUser?.phoneNumber ?: "").ifBlank { prefPhone }
    val cleanPhone = rawPhone.filter { it.isDigit() }.takeLast(10)
    val resolvedUid = when {
      isAdminApp -> "nutrolix_admin_device"
      cleanPhone.length == 10 && cleanPhone.first() in '6'..'9' -> "phone_$cleanPhone"
      else -> (currentUser?.uid ?: "").ifBlank { prefUid }
    }

    serviceScope.launch {
      if (!isAdminApp && resolvedUid.isNotBlank()) {
        try {
          com.example.data.FirestoreService(applicationContext).saveFcmToken(
            uid = resolvedUid,
            token = token,
            phone = cleanPhone,
            email = currentUser?.email ?: ""
          )
        } catch (e: Exception) {
          Log.w(TAG, "Firestore FCM token sync error: ${e.message}")
        }
      }
      val idToken = try {
        val cur = FirebaseAuth.getInstance().currentUser
        if (cur != null) com.google.android.gms.tasks.Tasks.await(cur.getIdToken(false)).token ?: "" else ""
      } catch (_: Throwable) { "" }

      registerTokenOnServer(
        uid = resolvedUid,
        token = token,
        phone = if (isAdminApp) "" else cleanPhone,
        email = if (isAdminApp) "" else (currentUser?.email ?: ""),
        idToken = idToken,
        isAdminApp = isAdminApp
      )
    }
  }

  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    super.onMessageReceived(remoteMessage)
    val data = remoteMessage.data
    val msgType = data["type"] ?: ""
    val targetRole = data["role"] ?: ""
    val orderId = data["orderId"] ?: ""
    val isAdminOrderPush = msgType == "ADMIN_NEW_ORDER" || targetRole == "admin" ||
      (applicationContext.packageName.contains("admin", ignoreCase = true) && orderId.isNotBlank())

    if (isAdminOrderPush) {
      val resolvedOrderId = orderId.ifBlank { "LIVE_${System.currentTimeMillis()}" }
      val custName = data["customerName"]?.takeIf { it.isNotBlank() } ?: "Customer"
      val custPhone = data["customerPhone"] ?: ""
      val paymentMethod = data["paymentMethod"]?.takeIf { it.isNotBlank() } ?: "Online"
      val totalAmount = data["total"]?.toDoubleOrNull() ?: 0.0
      val adminOrder = Order(
        id = resolvedOrderId,
        orderNumber = data["orderNumber"]?.takeIf { it.isNotBlank() } ?: resolvedOrderId,
        customerPhone = custPhone,
        customerName = custName,
        items = emptyList(),
        subtotal = totalAmount,
        discount = 0.0,
        deliveryFee = 0.0,
        tax = 0.0,
        tip = 0.0,
        total = totalAmount,
        status = OrderStatus.CONFIRMED,
        paymentMethod = paymentMethod,
        paymentStatus = "PAID",
        orderTimeMillis = System.currentTimeMillis(),
        deliveryAddress = data["deliveryAddress"] ?: ""
      )
      OrderAlarmPlayer.playOrderAlarm(applicationContext)
      OrderNotificationHelper.sendAdminNewOrderNotification(applicationContext, adminOrder)
      return
    }

    val title = remoteMessage.notification?.title ?: data["title"] ?: "Nutrolix Order Update"
    val body = remoteMessage.notification?.body ?: data["message"] ?: data["body"] ?: "Your order status has been updated."
    val status = data["status"] ?: ""
    val openUrl = data["url"] ?: if (orderId.isNotBlank()) "/orders.html?orderId=$orderId" else "/orders.html"

    // Show system notification for background/locked/closed states
    OrderNotificationHelper.sendFcmOrderNotification(
      context = applicationContext,
      title = title,
      body = body,
      orderId = orderId,
      openUrl = openUrl
    )

    // Broadcast to active MainActivity so WebView shows a clean in-app toast & refreshes orders
    val broadcast = Intent(ACTION_ORDER_PUSH_RECEIVED).apply {
      setPackage(packageName)
      putExtra("title", title)
      putExtra("body", body)
      putExtra("order_id", orderId)
      putExtra("status", status)
      putExtra("open_url", openUrl)
    }
    sendBroadcast(broadcast)
  }

  private fun registerTokenOnServer(
    uid: String,
    token: String,
    phone: String,
    email: String,
    idToken: String = "",
    isAdminApp: Boolean = false
  ) {
    try {
      val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
      val deviceId = prefs.getString("device_id", null) ?: java.util.UUID.randomUUID().toString().also {
        prefs.edit().putString("device_id", it).apply()
      }
      val endpoint = MainActivity.LIVE_SERVER_URL.trimEnd('/') + "/api/notifications/register-token"
      val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 8000
        readTimeout = 8000
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        if (idToken.isNotBlank()) {
          setRequestProperty("Authorization", "Bearer $idToken")
        }
      }
      val payload = JSONObject().apply {
        put("uid", uid)
        put("deviceId", deviceId)
        put("role", if (isAdminApp) "admin" else "customer")
        put("fcmToken", token)
        put("token", token)
        put("customerPhone", phone)
        put("customerEmail", email)
        put("platform", if (isAdminApp) "android-admin-apk" else "android-apk")
      }
      conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
      conn.responseCode
      conn.disconnect()
    } catch (e: Exception) {
      Log.w(TAG, "Server FCM token registration failed: ${e.message}")
    }
  }
}
