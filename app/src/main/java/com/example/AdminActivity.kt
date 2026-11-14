package com.example

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.*
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.example.service.AdminOrderBackgroundService
import com.example.ui.theme.MyApplicationTheme
import com.example.util.OrderAlarmPlayer
import com.example.util.OrderNotificationHelper
import kotlinx.coroutines.delay

class AdminActivity : ComponentActivity() {

  companion object {
    const val PRIMARY_ADMIN_URL = "file:///android_asset/web/admin.html"
    const val LIVE_SERVER_ADMIN_URL = "https://ais-dev-hdct4zqciie73skb7kah2l-760738801567.asia-northeast1.run.app/admin.html"
  }

  // File upload callback for WebChromeClient (Product Image uploads)
  var filePathCallback: ValueCallback<Array<Uri>>? = null

  private val fileChooserLauncher = registerForActivityResult(
    ActivityResultContracts.StartActivityForResult()
  ) { result ->
    if (result.resultCode == Activity.RESULT_OK) {
      val data = result.data
      val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, data)
      filePathCallback?.onReceiveValue(uris)
    } else {
      filePathCallback?.onReceiveValue(null)
    }
    filePathCallback = null
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    configureLockscreenVisibility()

    // Initialize notification channels and real-time 24/7 background order alert service
    OrderNotificationHelper.initChannel(this)
    AdminOrderBackgroundService.start(this)

    // Only stop alarm if user tapped the notification or manually opened while unlocked
    handleIntentAlarmStop(intent)
    requestBatteryOptimizationExemptionIfNeeded()

    setContent {
      MyApplicationTheme {
        NutrolixAdminWebViewApp(
          onOpenFileChooser = { callback, params ->
            filePathCallback = callback
            try {
              val intent = params.createIntent()
              fileChooserLauncher.launch(intent)
              true
            } catch (_: Exception) {
              filePathCallback?.onReceiveValue(null)
              filePathCallback = null
              false
            }
          }
        )
      }
    }
  }

  private fun configureLockscreenVisibility() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
      )
    }
  }

  private fun handleIntentAlarmStop(targetIntent: Intent?) {
    val explicitStop = targetIntent?.getBooleanExtra("stop_alarm_on_open", false) == true
    val isFromLockscreen = targetIntent?.getBooleanExtra("from_lockscreen_alert", false) == true
    val km = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
    val isLocked = km?.isKeyguardLocked == true

    if (explicitStop) {
      OrderAlarmPlayer.stopOrderAlarm(this)
      OrderNotificationHelper.cancelAdminOrderNotification(this, targetIntent?.getStringExtra("order_id"))
    } else if (!isFromLockscreen && !isLocked) {
      OrderAlarmPlayer.stopOrderAlarm(this)
    }
  }

  @SuppressLint("BatteryLife")
  private fun requestBatteryOptimizationExemptionIfNeeded() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      try {
        val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
        if (!pm.isIgnoringBatteryOptimizations(packageName)) {
          val prefs = getSharedPreferences("nutrolix_admin_ui_prefs", Context.MODE_PRIVATE)
          if (!prefs.getBoolean("battery_opt_prompted_v1", false)) {
            prefs.edit().putBoolean("battery_opt_prompted_v1", true).apply()
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
              data = Uri.parse("package:$packageName")
            }
            startActivity(intent)
          }
        }
      } catch (_: Exception) {}
    }
  }

  override fun onResume() {
    super.onResume()
    // Ensure service stays alive and running whenever admin checks terminal
    AdminOrderBackgroundService.start(this)
    handleIntentAlarmStop(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleIntentAlarmStop(intent)
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun NutrolixAdminWebViewApp(
  onOpenFileChooser: (ValueCallback<Array<Uri>>, WebChromeClient.FileChooserParams) -> Boolean
) {
  val context = LocalContext.current
  var webViewInstance by remember { mutableStateOf<WebView?>(null) }
  var loadingProgress by remember { mutableIntStateOf(0) }
  var isPageLoading by remember { mutableStateOf(true) }
  var lastBackPressTime by remember { mutableLongStateOf(0L) }
  var isAlarmRinging by remember { mutableStateOf(OrderAlarmPlayer.isRinging()) }

  // Poll native alarm state while AdminActivity is visible so user sees instant Silence button if triggered
  LaunchedEffect(Unit) {
    while (true) {
      isAlarmRinging = OrderAlarmPlayer.isRinging()
      delay(400L)
    }
  }

  // Runtime Notification Permission launcher for Android 13+
  val notificationPermissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestPermission()
  ) { /* notification access */ }

  LaunchedEffect(Unit) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
  }

  // Handle Android hardware/gesture back press
  BackHandler(enabled = true) {
    if (webViewInstance?.canGoBack() == true) {
      webViewInstance?.goBack()
    } else {
      val currentTime = System.currentTimeMillis()
      if (currentTime - lastBackPressTime < 2000) {
        (context as? Activity)?.finish()
      } else {
        lastBackPressTime = currentTime
        Toast.makeText(context, "Press back again to exit Nutrolix Admin", Toast.LENGTH_SHORT).show()
      }
    }
  }

  Scaffold(
    contentWindowInsets = WindowInsets.statusBars
  ) { innerPadding ->
    Box(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .background(Color(0xFF064E3B))
    ) {
      AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { ctx ->
          WebView(ctx).apply {
            layoutParams = ViewGroup.LayoutParams(
              ViewGroup.LayoutParams.MATCH_PARENT,
              ViewGroup.LayoutParams.MATCH_PARENT
            )

            setLayerType(View.LAYER_TYPE_NONE, null)

            settings.apply {
              javaScriptEnabled = true
              domStorageEnabled = true
              mediaPlaybackRequiresUserGesture = false
              allowFileAccess = true
              allowContentAccess = true
              allowFileAccessFromFileURLs = true
              allowUniversalAccessFromFileURLs = true
              mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
              useWideViewPort = false
              loadWithOverviewMode = false
              setSupportZoom(false)
              builtInZoomControls = false
              displayZoomControls = false
              cacheMode = WebSettings.LOAD_DEFAULT
              databaseEnabled = true
            }

            // Expose native Android bridge to admin JavaScript
            addJavascriptInterface(
              object {
                @JavascriptInterface
                fun stopAlarm() {
                  OrderAlarmPlayer.stopOrderAlarm(ctx)
                }

                @JavascriptInterface
                fun playAlarm() {
                  OrderAlarmPlayer.playOrderAlarm(ctx)
                }

                @JavascriptInterface
                fun vibrateDevice(ms: Long) {
                  try {
                    val vibrator = ctx.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                      vibrator?.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
                    } else {
                      @Suppress("DEPRECATION")
                      vibrator?.vibrate(ms)
                    }
                  } catch (_: Exception) {}
                }

                @JavascriptInterface
                fun showToast(message: String) {
                  (ctx as? Activity)?.runOnUiThread {
                    Toast.makeText(ctx, message, Toast.LENGTH_SHORT).show()
                  }
                }
              },
              "NutrolixAdminNativeBridge"
            )

            webChromeClient = object : WebChromeClient() {
              override fun onProgressChanged(view: WebView?, newProgress: Int) {
                loadingProgress = newProgress
                isPageLoading = newProgress < 100
              }

              override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
              ): Boolean {
                return if (filePathCallback != null && fileChooserParams != null) {
                  onOpenFileChooser(filePathCallback, fileChooserParams)
                } else false
              }
            }

            webViewClient = object : WebViewClient() {
              override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
              ): Boolean {
                val url = request?.url?.toString() ?: return false

                // Handle WhatsApp & External links
                if (url.startsWith("https://wa.me/") || url.startsWith("whatsapp://") || url.startsWith("tel:") || url.startsWith("mailto:")) {
                  try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                      flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    ctx.startActivity(intent)
                    return true
                  } catch (_: Exception) {
                    return true
                  }
                }

                return false
              }

              override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                isPageLoading = false

                // Automatically switch to All Orders & Shipping by default
                view?.evaluateJavascript(
                  """
                  (function() {
                    try {
                      if (typeof window.switchTab === 'function') {
                        window.switchTab('packaged-orders');
                      }
                    } catch(e) {}
                  })();
                  """.trimIndent(),
                  null
                )
              }

              override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
              ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                  // Fall back gracefully to local asset
                  view?.loadUrl(AdminActivity.PRIMARY_ADMIN_URL)
                }
              }
            }

            // Load primary local asset with all admin features pre-bundled
            loadUrl(AdminActivity.PRIMARY_ADMIN_URL)
            webViewInstance = this
          }
        },
        update = { webViewInstance = it }
      )

      // Native Lockscreen-Safe Order Bell Silence Pill whenever alarm is actively ringing
      if (isAlarmRinging) {
        Button(
          onClick = {
            OrderAlarmPlayer.stopOrderAlarm(context)
            isAlarmRinging = false
            webViewInstance?.evaluateJavascript(
              "try { if (typeof window.acknowledgeActiveAlarm === 'function') window.acknowledgeActiveAlarm(); } catch(e) {}",
              null
            )
          },
          colors = ButtonDefaults.buttonColors(
            containerColor = Color(0xFFDC2626),
            contentColor = Color.White
          ),
          shape = RoundedCornerShape(28.dp),
          modifier = Modifier
            .align(Alignment.TopCenter)
            .padding(top = 12.dp, start = 16.dp, end = 16.dp)
            .heightIn(min = 48.dp)
            .testTag("silence_order_alarm_button")
        ) {
          Icon(
            imageVector = Icons.Filled.NotificationsOff,
            contentDescription = "Silence Order Bell"
          )
          Spacer(modifier = Modifier.width(8.dp))
          Text(
            text = "NEW ORDER RINGING — TAP TO SILENCE BELL",
            fontWeight = FontWeight.Bold
          )
        }
      }

      // Linear Loading Indicator
      if (isPageLoading) {
        LinearProgressIndicator(
          progress = { loadingProgress / 100f },
          modifier = Modifier
            .fillMaxWidth()
            .height(3.dp)
            .align(Alignment.TopCenter),
          color = Color(0xFFF59E0B),
          trackColor = Color.Transparent
        )
      }
    }
  }
}
