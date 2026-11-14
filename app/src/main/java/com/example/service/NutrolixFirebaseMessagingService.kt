package com.example.service

import android.content.Intent
import android.util.Log
import com.example.MainActivity
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

    val currentUser = try { FirebaseAuth.getInstance().currentUser } catch (_: Throwable) { null }
    if (currentUser != null) {
      serviceScope.launch {
        try {
          com.example.data.FirestoreService(applicationContext).saveFcmToken(
            uid = currentUser.uid,
            token = token,
            phone = currentUser.phoneNumber ?: "",
            email = currentUser.email ?: ""
          )
        } catch (e: Exception) {
          Log.w(TAG, "Firestore FCM token sync error: ${e.message}")
        }
        registerTokenOnServer(
          uid = currentUser.uid,
          token = token,
          phone = currentUser.phoneNumber ?: "",
          email = currentUser.email ?: ""
        )
      }
    }
  }

  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    super.onMessageReceived(remoteMessage)
    val data = remoteMessage.data
    val title = remoteMessage.notification?.title ?: data["title"] ?: "Nutrolix Order Update"
    val body = remoteMessage.notification?.body ?: data["message"] ?: data["body"] ?: "Your order status has been updated."
    val orderId = data["orderId"] ?: ""
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

  private fun registerTokenOnServer(uid: String, token: String, phone: String, email: String) {
    try {
      val endpoint = MainActivity.LIVE_SERVER_URL.trimEnd('/') + "/api/notifications/register-token"
      val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 8000
        readTimeout = 8000
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
      }
      val payload = JSONObject().apply {
        put("uid", uid)
        put("fcmToken", token)
        put("token", token)
        put("customerPhone", phone)
        put("customerEmail", email)
        put("platform", "android-apk")
      }
      conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
      conn.responseCode
      conn.disconnect()
    } catch (e: Exception) {
      Log.w(TAG, "Server FCM token registration failed: ${e.message}")
    }
  }
}
