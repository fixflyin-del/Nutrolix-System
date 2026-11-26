package com.example.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.util.Log
import com.example.service.AdminOrderBackgroundService

/**
 * Doze-proof exact-alarm BroadcastReceiver for Nutrolix Admin App.
 * Runs even if Android OS or OEM battery savers killed the foreground service:
 * polls the lightweight live-orders endpoint directly, rings the order alarm immediately
 * if any new customer order arrived, attempts to revive the foreground service safely,
 * and re-arms the next 20-second exact alarm.
 */
class AdminOrderWatchdogReceiver : BroadcastReceiver() {

  companion object {
    private const val TAG = "AdminOrderWatchdog"
  }

  override fun onReceive(context: Context, intent: Intent?) {
    val appCtx = context.applicationContext
    val pendingResult = goAsync()

    val pm = appCtx.getSystemService(Context.POWER_SERVICE) as? PowerManager
    val wakeLock = try {
      pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Nutrolix:WatchdogPollLock")?.apply {
        setReferenceCounted(false)
        acquire(18_000L)
      }
    } catch (_: Exception) {
      null
    }

    Thread {
      try {
        // 1. Immediately schedule the next watchdog alarm first so the chain never breaks
        AdminOrderBackgroundService.scheduleWatchdogAlarm(appCtx)

        // 2. Poll live orders directly from the server (works even in Doze without starting an FGS)
        AdminOrderBackgroundService.pollRemoteOrdersDirect(appCtx, sourceName = "watchdog_alarm")

        // 3. Best-effort revival of foreground service if allowed by OS
        try {
          AdminOrderBackgroundService.start(appCtx)
        } catch (e: Throwable) {
          Log.w(TAG, "Background FGS revive skipped by OS (watchdog direct poll still active): ${e.message}")
        }
      } catch (e: Exception) {
        Log.w(TAG, "Watchdog poll notice: ${e.message}")
      } finally {
        try {
          if (wakeLock?.isHeld == true) wakeLock.release()
        } catch (_: Exception) {}
        try {
          pendingResult.finish()
        } catch (_: Exception) {}
      }
    }.start()
  }
}
