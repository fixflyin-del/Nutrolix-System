package com.example.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.example.AdminActivity
import com.example.R
import com.example.data.FirestoreService
import com.example.model.Order
import com.example.model.OrderStatus
import com.example.util.OrderAlarmPlayer
import com.example.util.OrderNotificationHelper
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.*
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL

private const val TAG = "AdminOrderService"
private const val FOREGROUND_NOTIFICATION_ID = 9076

class AdminOrderBackgroundService : Service() {

  private var firestoreService: FirestoreService? = null
  private var firestoreListener: ListenerRegistration? = null
  private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
  private val knownOrderIds = java.util.Collections.synchronizedSet(mutableSetOf<String>())
  private var isInitialLoad = true

  companion object {
    fun start(context: Context) {
      try {
        val intent = Intent(context, AdminOrderBackgroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
      } catch (e: Exception) {
        Log.e(TAG, "Failed starting AdminOrderBackgroundService: ${e.message}")
      }
    }

    fun stop(context: Context) {
      try {
        val intent = Intent(context, AdminOrderBackgroundService::class.java)
        context.stopService(intent)
      } catch (_: Exception) {}
    }
  }

  override fun onCreate() {
    super.onCreate()
    OrderNotificationHelper.initChannel(this)
    createForegroundChannel()

    val notification = buildForegroundNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        FOREGROUND_NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
      )
    } else {
      startForeground(FOREGROUND_NOTIFICATION_ID, notification)
    }

    firestoreService = FirestoreService(this)
    startListeningToOrders()
    startBackupPolling()
    Log.d(TAG, "AdminOrderBackgroundService started in FOREGROUND - Listening 24/7 for live orders")
  }

  private fun createForegroundChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        "nutrolix_admin_service_channel",
        "Nutrolix Terminal Background Monitor",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Keeps Nutrolix order alarm listener active in the background"
        setShowBadge(false)
      }
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      nm?.createNotificationChannel(channel)
    }
  }

  private fun buildForegroundNotification(): Notification {
    val openIntent = Intent(this, AdminActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
      this, 0, openIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return NotificationCompat.Builder(this, "nutrolix_admin_service_channel")
      .setSmallIcon(R.drawable.nutrolix_app_icon)
      .setContentTitle("Nutrolix Kitchen Live Terminal")
      .setContentText("Monitoring live customer orders • Instant loud ringtone active")
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun startListeningToOrders() {
    val db = firestoreService?.db ?: return
    try {
      firestoreListener = db.collection("orders").addSnapshotListener { snapshot, error ->
        if (error != null) {
          Log.w(TAG, "Firestore listen error: ${error.message}")
          return@addSnapshotListener
        }
        if (snapshot == null) return@addSnapshotListener

        val orders = snapshot.documents.mapNotNull { doc ->
          try {
            val statusStr = doc.getString("status") ?: "PLACED"
            val status = try { OrderStatus.valueOf(statusStr) } catch (_: Exception) { OrderStatus.PLACED }
            val orderNumber = doc.getString("orderNumber") ?: doc.id
            val total = (doc.get("total") as? Number)?.toDouble() ?: 0.0
            val custName = doc.getString("customerName") ?: "Customer"
            val custPhone = doc.getString("customerPhone") ?: ""
            val address = doc.getString("deliveryAddress") ?: ""
            val orderTime = doc.getLong("orderTimeMillis") ?: System.currentTimeMillis()

            Order(
              id = doc.id,
              orderNumber = orderNumber,
              customerPhone = custPhone,
              customerName = custName,
              items = emptyList(),
              subtotal = total,
              discount = 0.0,
              deliveryFee = 0.0,
              tax = 0.0,
              tip = 0.0,
              total = total,
              status = status,
              paymentMethod = "Online",
              paymentStatus = "PAID",
              orderTimeMillis = orderTime,
              deliveryAddress = address
            )
          } catch (_: Exception) { null }
        }

        handleIncomingOrders(orders)
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error setting up Firestore listener", e)
    }
  }

  private val remoteOrderEndpoints = listOf(
    "https://ais-dev-hdct4zqciie73skb7kah2l-760738801567.asia-northeast1.run.app/api/nutrition-orders",
    "https://nutrolixweb.vercel.app/api/nutrition-orders",
    "http://10.0.2.2:3000/api/nutrition-orders",
    "http://127.0.0.1:3000/api/nutrition-orders"
  )

  // Fast background HTTP polling across cloud endpoints to ensure zero orders are ever missed
  private fun startBackupPolling() {
    serviceScope.launch {
      while (isActive) {
        delay(8000L) // every 8 seconds for real-time responsiveness
        for (endpoint in remoteOrderEndpoints) {
          try {
            val url = URL(endpoint)
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 5000
            conn.readTimeout = 5000
            conn.setRequestProperty("Accept", "application/json")
            if (conn.responseCode == 200) {
              val text = conn.inputStream.bufferedReader().use { it.readText() }
              val array = JSONArray(text)
              val orders = mutableListOf<Order>()
              for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val id = obj.optString("id", "")
                val statusStr = obj.optString("status", "Order Placed")
                val isPlaced = statusStr.contains("Placed", ignoreCase = true) ||
                               statusStr.contains("New", ignoreCase = true) ||
                               statusStr.contains("Pending", ignoreCase = true) ||
                               statusStr.contains("Accepted", ignoreCase = true)
                val status = if (isPlaced) OrderStatus.PLACED else OrderStatus.CONFIRMED
                val cust = obj.optJSONObject("customer")
                val custName = cust?.optString("name", "Customer") ?: "Customer"
                val custPhone = cust?.optString("phone", "") ?: ""
                val total = obj.optDouble("grandTotal", obj.optDouble("total", 0.0))

                orders.add(
                  Order(
                    id = id,
                    orderNumber = id,
                    customerPhone = custPhone,
                    customerName = custName,
                    items = emptyList(),
                    subtotal = total,
                    discount = 0.0,
                    deliveryFee = 0.0,
                    tax = 0.0,
                    tip = 0.0,
                    total = total,
                    status = status,
                    paymentMethod = obj.optString("paymentMethod", "Online"),
                    paymentStatus = "PAID",
                    orderTimeMillis = System.currentTimeMillis(),
                    deliveryAddress = "Direct Customer Address"
                  )
                )
              }
              handleIncomingOrders(orders)
              break // Successfully polled this cycle, move to next cycle
            }
          } catch (_: Exception) {
            // Try next fallback endpoint
          }
        }
      }
    }
  }

  private fun handleIncomingOrders(orders: List<Order>) {
    if (isInitialLoad) {
      // Record existing orders on initial boot so we don't ring for historical orders
      orders.forEach { knownOrderIds.add(it.id) }
      isInitialLoad = false
      return
    }

    orders.filter { it.status == OrderStatus.PLACED || it.status == OrderStatus.CONFIRMED }.forEach { newOrder ->
      if (!knownOrderIds.contains(newOrder.id)) {
        knownOrderIds.add(newOrder.id)
        Log.i(TAG, "🚨 NEW LIVE ORDER DETECTED: #${newOrder.id} - TRIGGERING LOUD CONTINUOUS RINGTONE ALARM")

        // 1. Wake screen & play continuous loud ringtone alarm with vibration
        OrderAlarmPlayer.playOrderAlarm(applicationContext)

        // 2. Post full-screen high-priority alert notification
        OrderNotificationHelper.sendAdminNewOrderNotification(applicationContext, newOrder)
      }
    }
  }

  override fun onDestroy() {
    firestoreListener?.remove()
    serviceScope.cancel()
    super.onDestroy()
  }
}
