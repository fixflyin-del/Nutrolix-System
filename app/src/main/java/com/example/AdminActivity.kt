package com.example

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Vibrator
import android.os.VibrationEffect
import android.view.View
import android.view.ViewGroup
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
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.example.ui.theme.MyApplicationTheme
import com.example.util.OrderNotificationHelper
import com.example.util.OrderAlarmPlayer
import com.example.service.AdminOrderBackgroundService

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

    // Initialize notification channels and real-time background order alert service
    OrderNotificationHelper.initChannel(this)
    AdminOrderBackgroundService.start(this)

    // Stop active ringing tone once admin has opened the app
    OrderAlarmPlayer.stopOrderAlarm()

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

  override fun onResume() {
    super.onResume()
    OrderAlarmPlayer.stopOrderAlarm()
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    OrderAlarmPlayer.stopOrderAlarm()
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
                  OrderAlarmPlayer.stopOrderAlarm()
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

                // Automatically switch to All Orders by default
                view?.evaluateJavascript(
                  """
                  (function() {
                    try {
                      if (typeof window.switchAdminTab === 'function') {
                        window.switchAdminTab('orders');
                      } else if (typeof window.switchTab === 'function') {
                        window.switchTab('orders');
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
