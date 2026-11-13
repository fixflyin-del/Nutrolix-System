package com.example.util

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.media.ToneGenerator
import android.os.Build
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.example.R
import kotlinx.coroutines.*

object OrderNotificationHelper {
  private const val CHANNEL_ID = "nutrolix_orders_channel"
  private const val CHANNEL_NAME = "Nutrolix Order Notifications"
  private const val ADMIN_CHANNEL_ID = "nutrolix_admin_orders_channel"
  private const val ADMIN_CHANNEL_NAME = "Nutrolix Admin Order Alerts"

  // Prevent duplicate notifications for the same order
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

      val ringtoneUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_RINGTONE)
        ?: android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_ALARM)
      val audioAttributes = android.media.AudioAttributes.Builder()
        .setUsage(android.media.AudioAttributes.USAGE_ALARM)
        .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()

      val adminChannel = NotificationChannel(
        ADMIN_CHANNEL_ID,
        ADMIN_CHANNEL_NAME,
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Instant loud ringing alerts for new customer orders placed in real time"
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 800, 300, 800, 300, 800, 300, 800)
        setSound(ringtoneUri, audioAttributes)
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
    val intent = android.content.Intent(context, com.example.MainActivity::class.java).apply {
      flags = android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP or android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra("navigate_to", "orders")
    }
    val pendingIntent = android.app.PendingIntent.getActivity(
      context,
      orderId.hashCode(),
      intent,
      android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
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

    val intent = android.content.Intent(context, com.example.MainActivity::class.java).apply {
      flags = android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP or android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra("navigate_to", if (newStatus == com.example.model.OrderStatus.DELIVERED) "review_dialog" else "orders")
      putExtra("order_id", order.id)
    }
    val pendingIntent = android.app.PendingIntent.getActivity(
      context,
      (order.id + newStatus.name).hashCode(),
      intent,
      android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
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

  fun sendAdminNewOrderNotification(context: Context, order: com.example.model.Order) {
    if (notifiedAdminOrderIds.contains(order.id)) return
    notifiedAdminOrderIds.add(order.id)
    initChannel(context)

    val itemsSummary = order.items.joinToString(", ") { "${it.quantity}x ${it.meal.name}" }
    val timeFormatted = java.text.SimpleDateFormat("hh:mm a", java.util.Locale.getDefault()).format(java.util.Date(order.orderTimeMillis))

    val clickIntent = android.content.Intent(context, com.example.AdminActivity::class.java).apply {
      flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra("order_id", order.id)
    }
    val clickPendingIntent = android.app.PendingIntent.getActivity(
      context,
      ("click_" + order.id).hashCode(),
      clickIntent,
      android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
    )

    val ringtoneUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_RINGTONE)
      ?: android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_ALARM)

    val builder = NotificationCompat.Builder(context, ADMIN_CHANNEL_ID)
      .setSmallIcon(R.drawable.nutrolix_app_icon)
      .setContentTitle("🔔 NEW ORDER: ${order.orderNumber} (₹${order.total.toInt()})")
      .setContentText("Customer: ${order.customerName} • $timeFormatted")
      .setStyle(
        NotificationCompat.BigTextStyle()
          .bigText("Order ${order.orderNumber} placed at $timeFormatted\nCustomer: ${order.customerName} (+91 ${order.customerPhone})\nItems: $itemsSummary\nDelivery to: ${order.deliveryAddress}\nTotal: ₹${order.total.toInt()} (${order.paymentMethod})")
      )
      .setContentIntent(clickPendingIntent)
      .setFullScreenIntent(clickPendingIntent, true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setSound(ringtoneUri)
      .setVibrate(longArrayOf(0, 800, 300, 800, 300, 800, 300, 800))
      .setAutoCancel(true)

    try {
      NotificationManagerCompat.from(context).notify(("admin_" + order.id).hashCode(), builder.build())
    } catch (_: SecurityException) {
      // Handled gracefully if permission denied
    }
  }
}

/**
 * Global Order Alarm Player for Lock Screen & Background Alerts
 * Uses MediaPlayer on STREAM_ALARM with isLooping=true, PowerManager WakeLock to wake screen,
 * and rhythmic vibration.
 */
object OrderAlarmPlayer {
  private var activeRingtone: android.media.Ringtone? = null
  private var mediaPlayer: MediaPlayer? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var ringJob: Job? = null
  private var vibrationJob: Job? = null
  @Volatile
  private var isAlarmActive: Boolean = false
  private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

  @Synchronized
  fun playOrderAlarm(context: Context) {
    stopOrderAlarm()
    isAlarmActive = true

    // 1. Acquire WakeLock to turn on device screen even if locked
    try {
      val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
      @Suppress("DEPRECATION")
      wakeLock = pm?.newWakeLock(
        PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
        "Nutrolix:NewOrderWakeLock"
      )
      wakeLock?.acquire(35000L) // 35 seconds max
    } catch (_: Exception) {}

    // 2. Play continuous loud looping ringtone on STREAM_ALARM
    var startedMedia = false
    val candidateUris = listOfNotNull(
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
    )

    for (uri in candidateUris) {
      var mp: MediaPlayer? = null
      try {
        mp = MediaPlayer().apply {
          setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_ALARM)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build()
          )
          setOnErrorListener { failedPlayer, _, _ ->
            try { failedPlayer.release() } catch (_: Exception) {}
            if (mediaPlayer === failedPlayer) {
              mediaPlayer = null
            }
            true
          }
          setDataSource(context.applicationContext, uri)
          prepare()
          isLooping = true
          start()
        }
        mediaPlayer = mp
        startedMedia = true
        break
      } catch (_: Exception) {
        try { mp?.release() } catch (_: Exception) {}
      }
    }

    if (!startedMedia) {
      var ringtoneStarted = false
      for (uri in candidateUris) {
        try {
          val rt = RingtoneManager.getRingtone(context.applicationContext, uri)
          if (rt != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
              rt.audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
              rt.isLooping = true
            }
            rt.play()
            activeRingtone = rt
            ringtoneStarted = true
            break
          }
        } catch (_: Exception) {}
      }
      if (!ringtoneStarted) {
        startFallbackTone()
      }
    }

    // 3. Rhythmic loud vibration loop
    startVibrationLoop(context)
  }

  private fun startFallbackTone() {
    ringJob?.cancel()
    ringJob = scope.launch {
      var toneGen: ToneGenerator? = null
      try {
        toneGen = ToneGenerator(AudioManager.STREAM_ALARM, 100)
        while (isActive && isAlarmActive) {
          toneGen.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 400)
          delay(650)
          if (!isAlarmActive) break
          toneGen.startTone(ToneGenerator.TONE_PROP_BEEP2, 300)
          delay(800)
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
      while (isActive && isRinging() && cycles < 40) {
        try {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 500, 200, 500), -1))
          } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(longArrayOf(0, 500, 200, 500), -1)
          }
        } catch (_: Exception) {}
        delay(1400)
        cycles++
      }
    }
  }

  @Synchronized
  fun stopOrderAlarm() {
    isAlarmActive = false

    val rt = activeRingtone
    activeRingtone = null
    if (rt != null) {
      try {
        if (rt.isPlaying) rt.stop()
      } catch (_: Exception) {}
    }

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

    try {
      if (wakeLock?.isHeld == true) {
        wakeLock?.release()
      }
      wakeLock = null
    } catch (_: Exception) {}
  }

  @Synchronized
  fun isRinging(): Boolean = isAlarmActive
}

/**
 * Continuous ringing alert for store admins
 * Delegates to OrderAlarmPlayer for synchronized lock screen & background audio
 */
class AdminAlertSoundManager(private val context: Context) {
  fun startAlertRing(onBeep: () -> Unit = {}) {
    OrderAlarmPlayer.playOrderAlarm(context)
    onBeep()
  }

  fun stopAlertRing() {
    OrderAlarmPlayer.stopOrderAlarm()
  }

  fun isRinging(): Boolean = OrderAlarmPlayer.isRinging()
}
