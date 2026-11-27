package com.example.service

import android.app.*
import android.content.Context
import android.content.Intent
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
import com.example.receiver.AdminOrderWatchdogReceiver
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
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

private const val TAG = "AdminOrderService"
private const val FOREGROUND_NOTIFICATION_ID = 9076
private const val PREFS_NAME = "nutrolix_admin_service_prefs"
private const val KEY_KNOWN_IDS = "known_order_ids_v2"
private const val KEY_SEEDED = "initial_seed_done_v2"
private const val WATCHDOG_INTERVAL_MS = 60_000L
private const val POLL_INTERVAL_MS = 20_000L
private const val RECENT_ORDER_WINDOW_MS = 6L * 60L * 60L * 1000L // 6 hours

class AdminOrderBackgroundService : Service() {

  private var firestoreService: FirestoreService? = null
  private var defaultFirestoreListener: ListenerRegistration? = null
  private var namedFirestoreListener: ListenerRegistration? = null
  private var cpuWakeLock: PowerManager.WakeLock? = null
  private var wifiLock: WifiManager.WifiLock? = null

  private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

  @Volatile
  private var firebaseSdkUnavailable = false

  companion object {
    const val ACTION_STOP_ALARM = "com.example.nutrolix.ACTION_STOP_ALARM"
    const val ACTION_WATCHDOG_POLL = "com.example.nutrolix.ACTION_WATCHDOG_POLL"
    private const val WATCHDOG_REQ_CODE = 44109

    private const val LIVE_POLL_URL = "https://nutrolix.in/api/admin/live-orders-poll"
    private const val FALLBACK_ORDERS_URL = "https://nutrolix.in/api/nutrition-orders"

    private val stateLock = Any()
    private val knownOrderIds = mutableSetOf<String>()
    @Volatile
    private var prefsLoaded = false
    @Volatile
    private var hasCompletedBaselineSeed = false
    @Volatile
    private var firstSeenAtMs = 0L
    @Volatile
    private var isDirectPollInFlight = false

    fun start(context: Context) {
      try {
        val intent = Intent(context, AdminOrderBackgroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
      } catch (e: Throwable) {
        Log.w(TAG, "Failed starting AdminOrderBackgroundService: ${e.message}")
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
        val appCtx = context.applicationContext
        val am = appCtx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val intent = Intent(appCtx, AdminOrderWatchdogReceiver::class.java).apply {
          action = ACTION_WATCHDOG_POLL
        }
        val pi = PendingIntent.getBroadcast(
          appCtx,
          WATCHDOG_REQ_CODE,
          intent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
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
        val appCtx = context.applicationContext
        val am = appCtx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val intent = Intent(appCtx, AdminOrderWatchdogReceiver::class.java).apply {
          action = ACTION_WATCHDOG_POLL
        }
        val pi = PendingIntent.getBroadcast(
          appCtx,
          WATCHDOG_REQ_CODE,
          intent,
          PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pi != null) am.cancel(pi)
      } catch (_: Exception) {}
    }

    private fun ensureStateLoadedLocked(context: Context) {
      if (prefsLoaded) return
      try {
        val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val saved = prefs.getStringSet(KEY_KNOWN_IDS, emptySet()) ?: emptySet()
        knownOrderIds.addAll(saved)
        hasCompletedBaselineSeed = prefs.getBoolean(KEY_SEEDED, false)
        if (firstSeenAtMs == 0L) firstSeenAtMs = System.currentTimeMillis()
        prefsLoaded = true
      } catch (_: Exception) {}
    }

    private fun persistStateLocked(context: Context, markSeeded: Boolean) {
      try {
        val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val list = knownOrderIds.toList()
        val trimmed = if (list.size > 500) list.takeLast(500).toSet() else list.toSet()
        prefs.edit()
          .putStringSet(KEY_KNOWN_IDS, trimmed)
          .putBoolean(KEY_SEEDED, markSeeded)
          .apply()
      } catch (_: Exception) {}
    }

    internal fun mapOrderStatus(rawStatus: String?): OrderStatus {
      val s = (rawStatus ?: "").trim().lowercase()
      return when {
        s.isEmpty() || s == "placed" || s.contains("order placed") || s == "new" || s == "pending" -> OrderStatus.PLACED
        s.contains("accepted") || s.contains("confirmed") -> OrderStatus.CONFIRMED
        s.contains("prepar") -> OrderStatus.PREPARING
        s.contains("ready") || s.contains("packed") -> OrderStatus.READY
        s.contains("out_for_delivery") || s.contains("out for delivery") || s.contains("dispatch") || s.contains("transit") -> OrderStatus.OUT_FOR_DELIVERY
        s.contains("deliver") -> OrderStatus.DELIVERED
        s.contains("cancel") || s.contains("reject") || s.contains("fail") -> OrderStatus.CANCELLED
        else -> OrderStatus.CONFIRMED
      }
    }

    internal fun normalizeTimestampMs(rawTs: Long, createdAtIso: String? = null): Long {
      if (rawTs > 0L) {
        return if (rawTs < 1_000_000_000_000L) rawTs * 1000L else rawTs
      }
      if (!createdAtIso.isNullOrBlank()) {
        val patterns = listOf(
          "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
          "yyyy-MM-dd'T'HH:mm:ss'Z'",
          "yyyy-MM-dd'T'HH:mm:ss"
        )
        for (p in patterns) {
          try {
            val sdf = SimpleDateFormat(p, Locale.US).apply {
              timeZone = TimeZone.getTimeZone("UTC")
            }
            val parsed = sdf.parse(createdAtIso.trim())?.time ?: 0L
            if (parsed > 0L) return parsed
          } catch (_: Exception) {}
        }
      }
      return System.currentTimeMillis()
    }

    fun pollRemoteOrdersDirect(context: Context, sourceName: String = "http_poll") {
      if (isDirectPollInFlight) return
      isDirectPollInFlight = true
      val appCtx = context.applicationContext
      try {
        // 1. Primary ultra-fast compact endpoint
        val primaryOrders = fetchOrdersFromEndpoint(LIVE_POLL_URL)
        if (primaryOrders != null) {
          processIncomingOrders(appCtx, primaryOrders, sourceName = "$sourceName:live_poll")
          return
        }

        // 2. Fallback full orders endpoint if compact endpoint fails or returns non-200
        val fallbackOrders = fetchOrdersFromEndpoint(FALLBACK_ORDERS_URL)
        if (fallbackOrders != null) {
          processIncomingOrders(appCtx, fallbackOrders, sourceName = "$sourceName:fallback_orders")
        }
      } catch (e: Exception) {
        Log.w(TAG, "Direct poll error ($sourceName): ${e.message}")
      } finally {
        isDirectPollInFlight = false
      }
    }

    private fun fetchOrdersFromEndpoint(endpoint: String): List<Order>? {
      var conn: HttpURLConnection? = null
      return try {
        val sep = if (endpoint.contains("?")) "&" else "?"
        val url = URL("${endpoint}${sep}_t=${System.currentTimeMillis()}")
        conn = (url.openConnection() as HttpURLConnection).apply {
          connectTimeout = 12_000
          readTimeout = 15_000
          useCaches = false
          setRequestProperty("Accept", "application/json")
          setRequestProperty("Cache-Control", "no-cache, no-store")
        }
        if (conn.responseCode != 200) return null
        val text = conn.inputStream.bufferedReader().use { it.readText() }
        val trimmed = text.trim()
        val array: JSONArray = when {
          trimmed.startsWith("[") -> JSONArray(trimmed)
          trimmed.startsWith("{") -> {
            val root = JSONObject(trimmed)
            root.optJSONArray("orders") ?: JSONArray()
          }
          else -> return null
        }

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
          val rawTs = obj.optLong("orderTimeMillis", 0L).let {
            if (it > 0L) it else obj.optLong("confirmedAt", 0L)
          }.let {
            if (it > 0L) it else obj.optLong("timestamp", 0L)
          }
          val timeMs = normalizeTimestampMs(rawTs, obj.optString("createdAt", ""))

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
              deliveryAddress = obj.optString("deliveryAddress", "")
            )
          )
        }
        orders
      } catch (e: Exception) {
        Log.w(TAG, "Fetch $endpoint failed: ${e.message}")
        null
      } finally {
        try { conn?.disconnect() } catch (_: Exception) {}
      }
    }

    fun processIncomingOrders(context: Context, orders: List<Order>, sourceName: String) {
      val appCtx = context.applicationContext
      val now = System.currentTimeMillis()
      val freshlyTriggered = mutableListOf<Order>()

      synchronized(stateLock) {
        ensureStateLoadedLocked(appCtx)

        if (!hasCompletedBaselineSeed) {
          orders.forEach { if (it.id.isNotBlank()) knownOrderIds.add(it.id) }
          // Complete baseline seed right away once we have successfully fetched orders (or after 3s)
          if (orders.isNotEmpty() || (now - firstSeenAtMs >= 3_000L)) {
            hasCompletedBaselineSeed = true
            persistStateLocked(appCtx, markSeeded = true)
            Log.d(TAG, "Baseline seed finalized from $sourceName (${knownOrderIds.size} orders tracked)")
          } else {
            persistStateLocked(appCtx, markSeeded = false)
          }
          return
        }

        var addedAny = false
        orders.forEach { order ->
          if (order.id.isBlank()) return@forEach
          val alreadyKnown = knownOrderIds.contains(order.id)
          if (!alreadyKnown) {
            knownOrderIds.add(order.id)
            addedAny = true

            val isActiveNewOrder = (order.status == OrderStatus.PLACED || order.status == OrderStatus.CONFIRMED)
            val isRecent = (order.orderTimeMillis <= 0L) || (now - order.orderTimeMillis < RECENT_ORDER_WINDOW_MS)
            if (isActiveNewOrder && isRecent) {
              freshlyTriggered.add(order)
            }
          }
        }

        if (addedAny) {
          persistStateLocked(appCtx, markSeeded = true)
        }
      }

      if (freshlyTriggered.isNotEmpty()) {
        val newest = freshlyTriggered.first()
        Log.i(TAG, "🚨 NEW LIVE ORDER DETECTED ($sourceName): #${newest.id} - Triggering Lockscreen Order Alert")

        // 1. Play single clean Order Notification Chime & wake screen
        OrderAlarmPlayer.playOrderAlarm(appCtx)

        // 2. Post visual-only full-screen lockscreen notification (no duplicate sound)
        freshlyTriggered.forEach { newOrder ->
          OrderNotificationHelper.sendAdminNewOrderNotification(appCtx, newOrder)
        }
      }
    }
  }

  override fun onCreate() {
    super.onCreate()
    synchronized(stateLock) {
      ensureStateLoadedLocked(this)
    }

    OrderNotificationHelper.initChannel(this)
    createForegroundChannel()

    val notification = buildForegroundNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        FOREGROUND_NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
      )
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
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
    Log.d(TAG, "AdminOrderBackgroundService started in FOREGROUND (specialUse) - 24/7 monitoring active")
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

  private fun createForegroundChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        "nutrolix_admin_service_channel",
        "Nutrolix Terminal Background Monitor",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Keeps Nutrolix live order listener running 24/7 even when screen is locked"
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
        serviceScope.launch { pollRemoteOrdersDirect(applicationContext, sourceName = "service_watchdog") }
      }
    }
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun ensureFirestoreListeners() {
    if (firebaseSdkUnavailable) return
    if (defaultFirestoreListener == null || namedFirestoreListener == null) {
      startListeningToOrders()
    }
  }

  private fun isDefaultFirebaseAppReady(): Boolean {
    return try {
      if (FirebaseApp.getApps(this).isNotEmpty()) {
        true
      } else {
        FirebaseApp.initializeApp(this) != null && FirebaseApp.getApps(this).isNotEmpty()
      }
    } catch (_: Throwable) {
      false
    }
  }

  private fun startListeningToOrders() {
    if (firebaseSdkUnavailable) return
    if (!isDefaultFirebaseAppReady()) {
      firebaseSdkUnavailable = true
      Log.i(TAG, "Default FirebaseApp not configured in this build; using direct HTTP & Watchdog polling")
      return
    }

    if (defaultFirestoreListener == null) {
      try {
        val defaultDb = FirebaseFirestore.getInstance()
        defaultFirestoreListener = defaultDb.collection("orders").addSnapshotListener { snapshot, error ->
          if (error != null) {
            val msg = error.message ?: ""
            Log.w(TAG, "Default Firestore listen notice: $msg")
            if (msg.contains("NOT_FOUND", ignoreCase = true) || msg.contains("does not exist", ignoreCase = true)) {
              try { defaultFirestoreListener?.remove() } catch (_: Exception) {}
              defaultFirestoreListener = null
            }
            return@addSnapshotListener
          }
          if (snapshot == null) return@addSnapshotListener
          val orders = snapshot.documents.mapNotNull { parseFirestoreDoc(it) }
          processIncomingOrders(applicationContext, orders, sourceName = "default_firestore")
        }
      } catch (e: Exception) {
        Log.w(TAG, "Default Firestore listener unavailable: ${e.message}")
      }
    }

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
            processIncomingOrders(applicationContext, orders, sourceName = "named_firestore")
          }
        }
      } catch (e: Exception) {
        Log.w(TAG, "Named Firestore listener unavailable: ${e.message}")
      }
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
      val rawTs = (doc.get("orderTimeMillis") as? Number)?.toLong()
        ?: (doc.get("confirmedAt") as? Number)?.toLong()
        ?: (doc.get("timestamp") as? Number)?.toLong()
        ?: 0L
      val orderTime = normalizeTimestampMs(rawTs, doc.getString("createdAt"))
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

  private fun startBackupPollingLoop() {
    serviceScope.launch {
      pollRemoteOrdersDirect(applicationContext, sourceName = "service_boot")
      while (isActive) {
        delay(POLL_INTERVAL_MS)
        pollRemoteOrdersDirect(applicationContext, sourceName = "service_loop")
      }
    }
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    super.onTaskRemoved(rootIntent)
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
    // Keep watchdog alive even if service is destroyed by OEM memory killer
    scheduleWatchdogAlarm(applicationContext, WATCHDOG_INTERVAL_MS)
    super.onDestroy()
  }
}
