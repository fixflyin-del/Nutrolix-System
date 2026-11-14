package com.example.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import com.example.AdminActivity
import com.example.R
import com.example.data.FirestoreService
import com.example.model.Order
import com.example.model.OrderStatus
import com.example.util.OrderAlarmPlayer
import com.example.util.OrderNotificationHelper
import com.google.firebase.FirebaseApp
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

private const val TAG = "AdminOrderService"
private const val FOREGROUND_NOTIFICATION_ID = 9076
private const val PREFS_NAME = "nutrolix_admin_service_prefs"
private const val KEY_KNOWN_IDS = "known_order_ids_v2"
private const val KEY_SEEDED = "initial_seed_done_v2"
private const val WATCHDOG_INTERVAL_MS = 20_000L
private const val POLL_INTERVAL_MS = 6_000L

class AdminOrderBackgroundService : Service() {

  private var firestoreService: FirestoreService? = null
  private var defaultFirestoreListener: ListenerRegistration? = null
  private var namedFirestoreListener: ListenerRegistration? = null
  private var cpuWakeLock: PowerManager.WakeLock? = null
  private var wifiLock: WifiManager.WifiLock? = null

  private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
  private val knownOrderIds = java.util.Collections.synchronizedSet(mutableSetOf<String>())
  private lateinit var prefs: SharedPreferences

  @Volatile
  private var isPollInFlight = false
  @Volatile
  private var hasCompletedBaselineSeed = false
  private val serviceCreatedAtMs = System.currentTimeMillis()

  companion object {
    const val ACTION_STOP_ALARM = "com.example.nutrolix.ACTION_STOP_ALARM"
    const val ACTION_WATCHDOG_POLL = "com.example.nutrolix.ACTION_WATCHDOG_POLL"
    private const val WATCHDOG_REQ_CODE = 44109

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
        cancelWatchdogAlarm(context)
        val intent = Intent(context, AdminOrderBackgroundService::class.java)
        context.stopService(intent)
      } catch (_: Exception) {}
    }

    fun scheduleWatchdogAlarm(context: Context, delayMs: Long = WATCHDOG_INTERVAL_MS) {
      try {
        val am = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val intent = Intent(context, AdminOrderBackgroundService::class.java).apply {
          action = ACTION_WATCHDOG_POLL
        }
        val pi = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          PendingIntent.getForegroundService(
            context,
            WATCHDOG_REQ_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
          )
        } else {
          PendingIntent.getService(
            context,
            WATCHDOG_REQ_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
          )
        }
        val triggerAt = SystemClock.elapsedRealtime() + delayMs
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()) {
              am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
            } else {
              am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
            }
          } catch (_: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
          }
        } else {
          am.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
        }
      } catch (e: Exception) {
        Log.w(TAG, "Watchdog alarm schedule notice: ${e.message}")
      }
    }

    private fun cancelWatchdogAlarm(context: Context) {
      try {
        val am = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val intent = Intent(context, AdminOrderBackgroundService::class.java).apply {
          action = ACTION_WATCHDOG_POLL
        }
        val pi = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          PendingIntent.getForegroundService(
            context,
            WATCHDOG_REQ_CODE,
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
          )
        } else {
          PendingIntent.getService(
            context,
            WATCHDOG_REQ_CODE,
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
          )
        }
        if (pi != null) am.cancel(pi)
      } catch (_: Exception) {}
    }
  }

  override fun onCreate() {
    super.onCreate()
    prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    loadPersistedKnownOrders()

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

    acquireBackgroundLocks()

    firestoreService = FirestoreService(this)
    startListeningToOrders()
    startBackupPollingLoop()
    scheduleWatchdogAlarm(this, WATCHDOG_INTERVAL_MS)
    Log.d(TAG, "AdminOrderBackgroundService started in FOREGROUND - Lockscreen & 24/7 monitoring active")
  }

  private fun acquireBackgroundLocks() {
    try {
      val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
      cpuWakeLock = pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Nutrolix:OrderListenerCpuLock")?.apply {
        setReferenceCounted(false)
        acquire()
      }
    } catch (e: Exception) {
      Log.w(TAG, "CPU WakeLock notice: ${e.message}")
    }

    try {
      val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
      val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        WifiManager.WIFI_MODE_FULL_LOW_LATENCY
      } else {
        @Suppress("DEPRECATION")
        WifiManager.WIFI_MODE_FULL_HIGH_PERF
      }
      wifiLock = wm?.createWifiLock(mode, "Nutrolix:OrderListenerWifiLock")?.apply {
        setReferenceCounted(false)
        acquire()
      }
    } catch (e: Exception) {
      Log.w(TAG, "WifiLock notice: ${e.message}")
    }
  }

  private fun loadPersistedKnownOrders() {
    try {
      val saved = prefs.getStringSet(KEY_KNOWN_IDS, emptySet()) ?: emptySet()
      knownOrderIds.addAll(saved)
      hasCompletedBaselineSeed = prefs.getBoolean(KEY_SEEDED, false)
    } catch (_: Exception) {}
  }

  private fun persistKnownOrders(markSeeded: Boolean = hasCompletedBaselineSeed) {
    try {
      // Keep bounded to latest 500 IDs to avoid unbounded SharedPreferences growth
      val trimmed = synchronized(knownOrderIds) {
        val list = knownOrderIds.toList()
        if (list.size > 500) list.takeLast(500).toSet() else list.toSet()
      }
      prefs.edit()
        .putStringSet(KEY_KNOWN_IDS, trimmed)
        .putBoolean(KEY_SEEDED, markSeeded)
        .apply()
    } catch (_: Exception) {}
  }

  private fun createForegroundChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        "nutrolix_admin_service_channel",
        "Nutrolix Terminal Background Monitor",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Keeps Nutrolix live order listener running even when screen is locked"
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
      .setContentText("Listening 24/7 for new orders • Lockscreen alerts active")
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP_ALARM -> {
        OrderAlarmPlayer.stopOrderAlarm(applicationContext)
        OrderNotificationHelper.cancelAdminOrderNotification(applicationContext, intent.getStringExtra("order_id"))
        return START_STICKY
      }
      ACTION_WATCHDOG_POLL -> {
        scheduleWatchdogAlarm(this, WATCHDOG_INTERVAL_MS)
        ensureFirestoreListeners()
        serviceScope.launch { pollAllEndpointsOnce() }
      }
    }
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun ensureFirestoreListeners() {
    if (defaultFirestoreListener == null || namedFirestoreListener == null) {
      startListeningToOrders()
    }
  }

  private fun startListeningToOrders() {
    try {
      if (FirebaseApp.getApps(this).isEmpty()) {
        FirebaseApp.initializeApp(this)
      }
    } catch (_: Exception) {}

    // 1. Listen to the (default) Firestore database (used by nutrolixweb.vercel.app, cart.html, and Customer APK)
    if (defaultFirestoreListener == null) {
      try {
        val defaultDb = FirebaseFirestore.getInstance()
        defaultFirestoreListener = defaultDb.collection("orders").addSnapshotListener { snapshot, error ->
          if (error != null) {
            Log.w(TAG, "Default Firestore listen notice: ${error.message}")
            return@addSnapshotListener
          }
          if (snapshot == null) return@addSnapshotListener
          val orders = snapshot.documents.mapNotNull { parseFirestoreDoc(it) }
          handleIncomingOrders(orders, sourceName = "default_firestore")
        }
      } catch (e: Exception) {
        Log.e(TAG, "Failed attaching default Firestore listener: ${e.message}")
      }
    }

    // 2. Listen to the named Firestore database (used by native Kotlin repository if configured)
    if (namedFirestoreListener == null) {
      try {
        val namedDb = firestoreService?.db
        if (namedDb != null) {
          namedFirestoreListener = namedDb.collection("orders").addSnapshotListener { snapshot, error ->
            if (error != null) {
              Log.w(TAG, "Named Firestore listen notice: ${error.message}")
              return@addSnapshotListener
            }
            if (snapshot == null) return@addSnapshotListener
            val orders = snapshot.documents.mapNotNull { parseFirestoreDoc(it) }
            handleIncomingOrders(orders, sourceName = "named_firestore")
          }
        }
      } catch (e: Exception) {
        Log.e(TAG, "Failed attaching named Firestore listener: ${e.message}")
      }
    }
  }

  private fun mapOrderStatus(rawStatus: String?): OrderStatus {
    val s = (rawStatus ?: "").trim().lowercase()
    return when {
      s.isEmpty() || s == "placed" || s.contains("order placed") || s == "new" || s == "pending" -> OrderStatus.PLACED
      s.contains("accepted") || s.contains("confirmed") -> OrderStatus.CONFIRMED
      s.contains("prepar") -> OrderStatus.PREPARING
      s.contains("ready") || s.contains("packed") -> OrderStatus.READY
      s.contains("out_for_delivery") || s.contains("dispatch") || s.contains("transit") -> OrderStatus.OUT_FOR_DELIVERY
      s.contains("deliver") -> OrderStatus.DELIVERED
      s.contains("cancel") || s.contains("reject") -> OrderStatus.CANCELLED
      else -> OrderStatus.CONFIRMED
    }
  }

  private fun parseFirestoreDoc(doc: DocumentSnapshot): Order? {
    return try {
      val orderId = doc.getString("orderId")?.takeIf { it.isNotBlank() }
        ?: doc.getString("id")?.takeIf { it.isNotBlank() }
        ?: doc.id
      val status = mapOrderStatus(doc.getString("status"))
      val orderNumber = doc.getString("orderNumber")?.takeIf { it.isNotBlank() } ?: orderId

      val customerMap = doc.get("customer") as? Map<*, *>
      val custName = doc.getString("customerName")?.takeIf { it.isNotBlank() }
        ?: customerMap?.get("name")?.toString()?.takeIf { it.isNotBlank() }
        ?: "Customer"
      val custPhone = doc.getString("customerPhone")?.takeIf { it.isNotBlank() }
        ?: customerMap?.get("phone")?.toString()?.takeIf { it.isNotBlank() }
        ?: ""

      val total = (doc.get("grandTotal") as? Number)?.toDouble()
        ?: (doc.get("total") as? Number)?.toDouble()
        ?: 0.0
      val orderTime = (doc.get("orderTimeMillis") as? Number)?.toLong()
        ?: (doc.get("timestamp") as? Number)?.toLong()
        ?: System.currentTimeMillis()
      val paymentMethod = doc.getString("paymentMethod") ?: "Online"

      val rawAddr = doc.get("deliveryAddress")
      val address = when (rawAddr) {
        is String -> rawAddr
        is Map<*, *> -> listOfNotNull(
          rawAddr["address1"]?.toString(),
          rawAddr["city"]?.toString(),
          rawAddr["pincode"]?.toString()
        ).filter { it.isNotBlank() }.joinToString(", ")
        else -> ""
      }

      Order(
        id = orderId,
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
        paymentMethod = paymentMethod,
        paymentStatus = "PAID",
        orderTimeMillis = orderTime,
        deliveryAddress = address
      )
    } catch (_: Exception) {
      null
    }
  }

  private val remoteOrderEndpoints = listOf(
    "https://ais-dev-hdct4zqciie73skb7kah2l-760738801567.asia-northeast1.run.app/api/nutrition-orders",
    "https://nutrolixweb.vercel.app/api/nutrition-orders"
  )

  private val firestoreRestOrdersUrl =
    "https://firestore.googleapis.com/v1/projects/com-aistudio-nutrolix-fo-56ac8/databases/(default)/documents/orders?pageSize=50"

  private fun startBackupPollingLoop() {
    serviceScope.launch {
      // Immediate first seed/check right on launch
      pollAllEndpointsOnce()
      while (isActive) {
        delay(POLL_INTERVAL_MS)
        pollAllEndpointsOnce()
      }
    }
  }

  private fun pollAllEndpointsOnce() {
    if (isPollInFlight) return
    isPollInFlight = true
    try {
      // 1. Poll Firestore REST API (Doze-proof HTTP check on (default) database)
      try {
        val url = URL(firestoreRestOrdersUrl)
        val conn = (url.openConnection() as HttpURLConnection).apply {
          connectTimeout = 5000
          readTimeout = 5000
          setRequestProperty("Accept", "application/json")
        }
        if (conn.responseCode == 200) {
          val text = conn.inputStream.bufferedReader().use { it.readText() }
          val root = JSONObject(text)
          val docs = root.optJSONArray("documents")
          if (docs != null) {
            val orders = mutableListOf<Order>()
            for (i in 0 until docs.length()) {
              val docObj = docs.optJSONObject(i) ?: continue
              parseFirestoreRestDoc(docObj)?.let { orders.add(it) }
            }
            handleIncomingOrders(orders, sourceName = "firestore_rest")
          }
        }
        conn.disconnect()
      } catch (_: Exception) {}

      // 2. Poll ALL remote HTTP API endpoints without breaking on the first 200
      for (endpoint in remoteOrderEndpoints) {
        try {
          val url = URL(endpoint)
          val conn = (url.openConnection() as HttpURLConnection).apply {
            connectTimeout = 5000
            readTimeout = 5000
            setRequestProperty("Accept", "application/json")
          }
          if (conn.responseCode == 200) {
            val text = conn.inputStream.bufferedReader().use { it.readText() }
            val array = JSONArray(text)
            val orders = mutableListOf<Order>()
            for (i in 0 until array.length()) {
              val obj = array.optJSONObject(i) ?: continue
              val id = obj.optString("id").ifBlank { obj.optString("orderId") }
              if (id.isBlank()) continue
              val status = mapOrderStatus(obj.optString("status", "Order Placed"))
              val cust = obj.optJSONObject("customer")
              val custName = obj.optString("customerName")
                .ifBlank { cust?.optString("name") ?: "Customer" }
              val custPhone = obj.optString("customerPhone")
                .ifBlank { cust?.optString("phone") ?: "" }
              val total = obj.optDouble("grandTotal", obj.optDouble("total", 0.0))
              val timeMs = obj.optLong("orderTimeMillis", obj.optLong("timestamp", System.currentTimeMillis()))

              orders.add(
                Order(
                  id = id,
                  orderNumber = obj.optString("orderNumber").ifBlank { id },
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
                  orderTimeMillis = timeMs,
                  deliveryAddress = "Direct Customer Address"
                )
              )
            }
            handleIncomingOrders(orders, sourceName = endpoint)
          }
          conn.disconnect()
        } catch (_: Exception) {}
      }
    } finally {
      isPollInFlight = false
    }
  }

  private fun parseFirestoreRestDoc(docObj: JSONObject): Order? {
    return try {
      val namePath = docObj.optString("name", "")
      val fallbackDocId = namePath.substringAfterLast('/', "")
      val fields = docObj.optJSONObject("fields") ?: return null

      fun strField(key: String): String {
        return fields.optJSONObject(key)?.optString("stringValue", "") ?: ""
      }

      fun numField(key: String): Double {
        val f = fields.optJSONObject(key) ?: return 0.0
        if (f.has("doubleValue")) return f.optDouble("doubleValue", 0.0)
        if (f.has("integerValue")) return f.optString("integerValue", "0").toDoubleOrNull() ?: 0.0
        return 0.0
      }

      val orderId = strField("orderId").ifBlank { strField("id") }.ifBlank { fallbackDocId }
      if (orderId.isBlank()) return null

      val status = mapOrderStatus(strField("status"))
      val custFields = fields.optJSONObject("customer")
        ?.optJSONObject("mapValue")
        ?.optJSONObject("fields")
      val custName = strField("customerName").ifBlank {
        custFields?.optJSONObject("name")?.optString("stringValue", "Customer") ?: "Customer"
      }
      val custPhone = strField("customerPhone").ifBlank {
        custFields?.optJSONObject("phone")?.optString("stringValue", "") ?: ""
      }

      val total = numField("grandTotal").let { if (it > 0.0) it else numField("total") }
      val ts = numField("orderTimeMillis").toLong().let {
        if (it > 0L) it else numField("timestamp").toLong()
      }.let { if (it > 0L) it else System.currentTimeMillis() }

      Order(
        id = orderId,
        orderNumber = strField("orderNumber").ifBlank { orderId },
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
        paymentMethod = strField("paymentMethod").ifBlank { "Online" },
        paymentStatus = "PAID",
        orderTimeMillis = ts,
        deliveryAddress = strField("deliveryAddress")
      )
    } catch (_: Exception) {
      null
    }
  }

  @Synchronized
  private fun handleIncomingOrders(orders: List<Order>, sourceName: String) {
    val now = System.currentTimeMillis()
    if (!hasCompletedBaselineSeed) {
      // First-install 4-second grace window so all async sources (Firestore + HTTP) seed historical orders cleanly
      orders.forEach { if (it.id.isNotBlank()) knownOrderIds.add(it.id) }
      if (now - serviceCreatedAtMs >= 4_000L) {
        hasCompletedBaselineSeed = true
        persistKnownOrders(markSeeded = true)
        Log.d(TAG, "Baseline seed finalized from $sourceName (${knownOrderIds.size} orders tracked)")
      } else {
        persistKnownOrders(markSeeded = false)
      }
      return
    }

    var addedAny = false
    val freshlyTriggered = mutableListOf<Order>()

    orders.forEach { order ->
      if (order.id.isBlank()) return@forEach
      val alreadyKnown = knownOrderIds.contains(order.id)
      if (!alreadyKnown) {
        knownOrderIds.add(order.id)
        addedAny = true

        // Only alert for newly placed active orders (never historical/completed ones)
        val isActiveNewOrder = order.status == OrderStatus.PLACED
        val isRecent = (order.orderTimeMillis <= 0L) || (now - order.orderTimeMillis < 45 * 60 * 1000L)
        if (isActiveNewOrder && isRecent) {
          freshlyTriggered.add(order)
        }
      }
    }

    if (addedAny) {
      persistKnownOrders(markSeeded = true)
    }

    if (freshlyTriggered.isNotEmpty()) {
      val newest = freshlyTriggered.first()
      Log.i(TAG, "🚨 NEW LIVE ORDER DETECTED ($sourceName): #${newest.id} - Triggering Lockscreen Order Alert")

      // 1. Play single clean Order Notification Chime & wake screen
      OrderAlarmPlayer.playOrderAlarm(applicationContext)

      // 2. Post visual-only full-screen lockscreen notification (no duplicate sound)
      freshlyTriggered.forEach { newOrder ->
        OrderNotificationHelper.sendAdminNewOrderNotification(applicationContext, newOrder)
      }
    }
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    super.onTaskRemoved(rootIntent)
    // Auto-restart background listener if user swipes the app away from Recents
    scheduleWatchdogAlarm(applicationContext, 1500L)
  }

  override fun onDestroy() {
    defaultFirestoreListener?.remove()
    defaultFirestoreListener = null
    namedFirestoreListener?.remove()
    namedFirestoreListener = null
    serviceScope.cancel()
    try {
      if (cpuWakeLock?.isHeld == true) cpuWakeLock?.release()
    } catch (_: Exception) {}
    try {
      if (wifiLock?.isHeld == true) wifiLock?.release()
    } catch (_: Exception) {}
    super.onDestroy()
  }
}
