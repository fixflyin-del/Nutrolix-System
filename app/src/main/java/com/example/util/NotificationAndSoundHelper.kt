package com.example.util

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.ToneGenerator
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.example.AdminActivity
import com.example.MainActivity
import com.example.R
import com.example.service.AdminOrderBackgroundService
import kotlinx.coroutines.*

object OrderNotificationHelper {
  private const val CHANNEL_ID = "nutrolix_orders_channel"
  private const val CHANNEL_NAME = "Nutrolix Order Notifications"
  // Bumped channel ID (v3) so Android discards older cached channels that used TYPE_RINGTONE.
  // Sound is set to null on this visual channel so OrderAlarmPlayer alone plays the single custom order chime.
  private const val ADMIN_CHANNEL_ID = "nutrolix_admin_orders_channel_v3"
  private const val ADMIN_CHANNEL_NAME = "Nutrolix Admin Order Alerts"

  // Prevent duplicate notifications for the same order in the current process
  private val notifiedAdminOrderIds = java.util.Collections.synchronizedSet(mutableSetOf<String>())

  fun initChannel(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      val customerChannel = NotificationChannel(
        CHANNEL_ID,
        CHANNEL_NAME,
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Order status and confirmation notifications"
        enableVibration(true)
      }

      // Visual-only high-priority lockscreen channel (no system ringtone audio;
      // OrderAlarmPlayer plays our custom order chime exclusively to prevent double-ringing)
      val adminChannel = NotificationChannel(
        ADMIN_CHANNEL_ID,
        ADMIN_CHANNEL_NAME,
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Instant lockscreen visual alerts for new customer orders"
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 600, 250, 600, 250, 600)
        setSound(null, null)
        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        setBypassDnd(true)
        enableLights(true)
      }
      notificationManager?.createNotificationChannel(customerChannel)
      notificationManager?.createNotificationChannel(adminChannel)
    }
  }

  fun sendOrderConfirmationNotification(context: Context, orderId: String) {
    initChannel(context)
    val intent = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra("navigate_to", "orders")
    }
    val pendingIntent = PendingIntent.getActivity(
      context,
      orderId.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.nutrolix_app_icon)
      .setContentTitle("Nutrolix Order Confirmed")
      .setContentText("Your order has been received and sent to the kitchen!")
      .setStyle(
        NotificationCompat.BigTextStyle()
          .bigText("Your order has been placed successfully!\nOrder ID: $orderId • Preparing fresh in our kitchen.")
      )
      .setContentIntent(pendingIntent)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setDefaults(NotificationCompat.DEFAULT_ALL)

    try {
      NotificationManagerCompat.from(context).notify(orderId.hashCode(), builder.build())
    } catch (_: SecurityException) {
      // Handled gracefully if notifications are disabled
    }
  }

  fun sendOrderStatusNotification(context: Context, order: com.example.model.Order, newStatus: com.example.model.OrderStatus) {
    initChannel(context)

    val (title, body) = when (newStatus) {
      com.example.model.OrderStatus.PREPARING, com.example.model.OrderStatus.CONFIRMED -> {
        "🍳 Order Accepted & Preparing!" to "Aapka order #${order.orderNumber} accept kar liya gaya hai aur kitchen me prepare ho raha hai."
      }
      com.example.model.OrderStatus.READY -> {
        "📦 Order Ready for Dispatch!" to "Aapka order #${order.orderNumber} ready ho gaya hai aur delivery partner dispatch ke liye waiting hai."
      }
      com.example.model.OrderStatus.OUT_FOR_DELIVERY -> {
        "🚀 Out for Delivery!" to "Aapka order #${order.orderNumber} dispatch ho chuka hai aur delivery partner aapke doorstep par aa raha hai!"
      }
      com.example.model.OrderStatus.DELIVERED -> {
        "🎉 Order Successfully Delivered!" to "Aapka order #${order.orderNumber} successfully deliver ho gaya hai. Tap karke rate aur review karein ⭐"
      }
      com.example.model.OrderStatus.CANCELLED -> {
        "❌ Order Cancelled" to "Order #${order.orderNumber} cancel ho gaya hai. Refund process kar diya gaya hai."
      }
      else -> return
    }

    val intent = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra("navigate_to", if (newStatus == com.example.model.OrderStatus.DELIVERED) "review_dialog" else "orders")
      putExtra("order_id", order.id)
    }
    val pendingIntent = PendingIntent.getActivity(
      context,
      (order.id + newStatus.name).hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.nutrolix_app_icon)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setContentIntent(pendingIntent)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVibrate(longArrayOf(0, 300, 200, 300))
      .setAutoCancel(true)
      .setDefaults(NotificationCompat.DEFAULT_ALL)

    try {
      NotificationManagerCompat.from(context).notify((order.id + newStatus.name).hashCode(), builder.build())
    } catch (_: SecurityException) {
      // Handled gracefully
    }
  }

  fun sendFcmOrderNotification(
    context: Context,
    title: String,
    body: String,
    orderId: String = "",
    openUrl: String = ""
  ) {
    initChannel(context)
    val intent = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra("navigate_to", "orders")
      if (orderId.isNotBlank()) putExtra("order_id", orderId)
      if (openUrl.isNotBlank()) putExtra("open_url", openUrl)
    }
    val notifId = if (orderId.isNotBlank()) ("fcm_" + orderId + "_" + title).hashCode() else ("fcm_" + System.currentTimeMillis()).hashCode()
    val pendingIntent = PendingIntent.getActivity(
      context,
      notifId,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.nutrolix_app_icon)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setContentIntent(pendingIntent)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVibrate(longArrayOf(0, 300, 150, 300))
      .setAutoCancel(true)
      .setDefaults(NotificationCompat.DEFAULT_ALL)

    try {
      NotificationManagerCompat.from(context).notify(notifId, builder.build())
    } catch (_: SecurityException) {
      // Handled gracefully
    }
  }

  fun sendAdminNewOrderNotification(context: Context, order: com.example.model.Order) {
    if (notifiedAdminOrderIds.contains(order.id)) return
    notifiedAdminOrderIds.add(order.id)
    initChannel(context)

    val itemsSummary = if (order.items.isNotEmpty()) {
      order.items.joinToString(", ") { "${it.quantity}x ${it.meal.name}" }
    } else {
      "Open Nutrolix Admin to view order items"
    }
    val timeFormatted = java.text.SimpleDateFormat("hh:mm a", java.util.Locale.getDefault())
      .format(java.util.Date(order.orderTimeMillis))

    // User-tapped notification: opens AdminActivity and silences the bell
    val clickIntent = Intent(context, AdminActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra("order_id", order.id)
      putExtra("stop_alarm_on_open", true)
    }
    val clickPendingIntent = PendingIntent.getActivity(
      context,
      ("click_" + order.id).hashCode(),
      clickIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    // Full-screen lockscreen wake intent: wakes locked screen WITHOUT silently stopping the bell
    val fullScreenIntent = Intent(context, AdminActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra("order_id", order.id)
      putExtra("from_lockscreen_alert", true)
    }
    val fullScreenPendingIntent = PendingIntent.getActivity(
      context,
      ("fs_" + order.id).hashCode(),
      fullScreenIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    // Notification shade "Silence Bell" quick action
    val stopAlarmIntent = Intent(context, AdminOrderBackgroundService::class.java).apply {
      action = AdminOrderBackgroundService.ACTION_STOP_ALARM
      putExtra("order_id", order.id)
    }
    val stopAlarmPendingIntent = PendingIntent.getService(
      context,
      ("stop_" + order.id).hashCode(),
      stopAlarmIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val builder = NotificationCompat.Builder(context, ADMIN_CHANNEL_ID)
      .setSmallIcon(R.drawable.nutrolix_app_icon)
      .setContentTitle("🔔 NEW ORDER: ${order.orderNumber} (₹${order.total.toInt()})")
      .setContentText("Customer: ${order.customerName} • $timeFormatted")
      .setStyle(
        NotificationCompat.BigTextStyle()
          .bigText(
            "Order ${order.orderNumber} placed at $timeFormatted\n" +
              "Customer: ${order.customerName} ${if (order.customerPhone.isNotBlank()) "(+91 ${order.customerPhone})" else ""}\n" +
              "Items: $itemsSummary\n" +
              "Total: ₹${order.total.toInt()} (${order.paymentMethod})"
          )
      )
      .setContentIntent(clickPendingIntent)
      .setFullScreenIntent(fullScreenPendingIntent, true)
      .addAction(0, "Silence Bell", stopAlarmPendingIntent)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setSilent(true) // Audio is handled exclusively by OrderAlarmPlayer (no ringtone overlap)
      .setVibrate(longArrayOf(0, 600, 250, 600, 250, 600))
      .setAutoCancel(true)

    try {
      NotificationManagerCompat.from(context).notify(("admin_" + order.id).hashCode(), builder.build())
    } catch (_: SecurityException) {
      // Handled gracefully if permission denied
    }
  }

  fun cancelAdminOrderNotification(context: Context, orderId: String?) {
    if (orderId.isNullOrBlank()) return
    try {
      NotificationManagerCompat.from(context).cancel(("admin_" + orderId).hashCode())
    } catch (_: Exception) {}
  }
}

/**
 * Single-Source Global Order Alarm Player for Lock Screen & Background Alerts.
 * Plays ONLY the dedicated custom order bell chime (R.raw.nutrolix_order_alert)
 * on USAGE_ALARM with CPU + Screen WakeLocks — NEVER phone call ringtone (TYPE_RINGTONE)
 * and NEVER two overlapping sounds.
 */
object OrderAlarmPlayer {
  private const val TAG = "OrderAlarmPlayer"
  private var mediaPlayer: MediaPlayer? = null
  private var screenWakeLock: PowerManager.WakeLock? = null
  private var audioFocusRequest: AudioFocusRequest? = null
  private var ringJob: Job? = null
  private var vibrationJob: Job? = null

  @Volatile
  private var isAlarmActive: Boolean = false
  private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

  @Synchronized
  fun playOrderAlarm(context: Context) {
    // If already actively playing our order chime, keep playing smoothly without stuttering/restarting
    if (isAlarmActive && (try { mediaPlayer?.isPlaying == true } catch (_: Exception) { false })) {
      refreshScreenWakeLock(context)
      return
    }

    stopOrderAlarm()
    isAlarmActive = true

    // 1. Acquire WakeLock to light up / wake the device even if screen is locked
    refreshScreenWakeLock(context)

    // 2. Request transient alarm audio focus
    val appCtx = context.applicationContext
    val audioManager = appCtx.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    val alarmAttributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
          .setAudioAttributes(alarmAttributes)
          .setAcceptsDelayedFocusGain(false)
          .setOnAudioFocusChangeListener { }
          .build()
        audioFocusRequest = req
        audioManager?.requestAudioFocus(req)
      } else {
        @Suppress("DEPRECATION")
        audioManager?.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
      }
    } catch (e: Exception) {
      Log.w(TAG, "AudioFocus notice: ${e.message}")
    }

    // 3. Play ONLY our custom Order Notification Chime raw asset (zero phone ringtones!)
    var startedMedia = false
    var mp: MediaPlayer? = null
    try {
      val chimeUri = Uri.parse("android.resource://${appCtx.packageName}/${R.raw.nutrolix_order_alert}")
      mp = MediaPlayer().apply {
        setAudioAttributes(alarmAttributes)
        setWakeMode(appCtx, PowerManager.PARTIAL_WAKE_LOCK)
        setVolume(1.0f, 1.0f)
        setOnErrorListener { failedPlayer, _, _ ->
          try { failedPlayer.release() } catch (_: Exception) {}
          if (mediaPlayer === failedPlayer) {
            mediaPlayer = null
          }
          true
        }
        setDataSource(appCtx, chimeUri)
        prepare()
        isLooping = true
        start()
      }
      mediaPlayer = mp
      startedMedia = true
      Log.i(TAG, "Started single clean Nutrolix Order Notification Chime")
    } catch (e: Exception) {
      Log.e(TAG, "Failed playing custom order chime raw resource: ${e.message}")
      try { mp?.release() } catch (_: Exception) {}
    }

    if (!startedMedia) {
      startFallbackChimeTone()
    }

    // 4. Rhythmic vibration loop (no extra audio)
    startVibrationLoop(appCtx)
  }

  private fun refreshScreenWakeLock(context: Context) {
    try {
      val pm = context.applicationContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
      if (screenWakeLock?.isHeld == true) {
        try { screenWakeLock?.release() } catch (_: Exception) {}
      }
      @Suppress("DEPRECATION")
      screenWakeLock = pm?.newWakeLock(
        PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
        "Nutrolix:NewOrderWakeLock"
      )?.apply {
        setReferenceCounted(false)
        acquire(45000L)
      }
    } catch (_: Exception) {}
  }

  private fun startFallbackChimeTone() {
    ringJob?.cancel()
    ringJob = scope.launch {
      var toneGen: ToneGenerator? = null
      try {
        toneGen = ToneGenerator(AudioManager.STREAM_ALARM, 100)
        while (isActive && isAlarmActive) {
          toneGen.startTone(ToneGenerator.TONE_PROP_BEEP2, 300)
          delay(450)
          if (!isAlarmActive) break
          toneGen.startTone(ToneGenerator.TONE_PROP_ACK, 300)
          delay(1200)
        }
      } catch (_: Exception) {
      } finally {
        try { toneGen?.release() } catch (_: Exception) {}
      }
    }
  }

  private fun startVibrationLoop(context: Context) {
    vibrationJob?.cancel()
    vibrationJob = scope.launch {
      val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        vm?.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
      }

      var cycles = 0
      while (isActive && isRinging() && cycles < 45) {
        try {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val attrs = VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM)
            vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 450, 200, 450), -1), attrs)
          } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 450, 200, 450), -1))
          } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(longArrayOf(0, 450, 200, 450), -1)
          }
        } catch (_: Exception) {}
        delay(1600)
        cycles++
      }
    }
  }

  @Synchronized
  fun stopOrderAlarm(context: Context? = null) {
    isAlarmActive = false

    val mp = mediaPlayer
    mediaPlayer = null
    if (mp != null) {
      try {
        if (mp.isPlaying) {
          mp.stop()
        }
      } catch (_: Exception) {}
      try {
        mp.release()
      } catch (_: Exception) {}
    }

    try {
      ringJob?.cancel()
      ringJob = null
    } catch (_: Exception) {}

    try {
      vibrationJob?.cancel()
      vibrationJob = null
    } catch (_: Exception) {}

    if (context != null) {
      try {
        val am = context.applicationContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          audioFocusRequest?.let { am?.abandonAudioFocusRequest(it) }
        } else {
          @Suppress("DEPRECATION")
          am?.abandonAudioFocus(null)
        }
      } catch (_: Exception) {}
    }
    audioFocusRequest = null

    try {
      if (screenWakeLock?.isHeld == true) {
        screenWakeLock?.release()
      }
      screenWakeLock = null
    } catch (_: Exception) {}
  }

  @Synchronized
  fun isRinging(): Boolean = isAlarmActive
}

/**
 * Continuous ringing alert for store admins.
 * Delegates to OrderAlarmPlayer for synchronized lock screen & background audio.
 */
class AdminAlertSoundManager(private val context: Context) {
  fun startAlertRing(onBeep: () -> Unit = {}) {
    OrderAlarmPlayer.playOrderAlarm(context)
    onBeep()
  }

  fun stopAlertRing() {
    OrderAlarmPlayer.stopOrderAlarm(context)
  }

  fun isRinging(): Boolean = OrderAlarmPlayer.isRinging()
}
