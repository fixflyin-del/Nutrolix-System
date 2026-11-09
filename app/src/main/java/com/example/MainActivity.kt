package com.example

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
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
import kotlinx.coroutines.launch
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {

  // Primary offline-first URL to prevent any Google AI Studio auth redirect or login demands
  companion object {
    const val PRIMARY_APP_URL = "file:///android_asset/web/index.html"
    const val LIVE_SERVER_URL = "https://ais-dev-hdct4zqciie73skb7kah2l-760738801567.asia-northeast1.run.app/"
  }

  // File upload callback handler for WebChromeClient
  var filePathCallback: ValueCallback<Array<Uri>>? = null

  private val fileChooserLauncher = registerForActivityResult(
    ActivityResultContracts.StartActivityForResult()
  ) { result ->
    if (result.resultCode == Activity.RESULT_OK) {
      val intentData = result.data
      val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, intentData)
      filePathCallback?.onReceiveValue(uris)
    } else {
      filePathCallback?.onReceiveValue(null)
    }
    filePathCallback = null
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()

    setContent {
      MyApplicationTheme {
        NutrolixSupplementBrandApp(
          onOpenFileChooser = { callback, params ->
            filePathCallback = callback
            try {
              val intent = params.createIntent()
              fileChooserLauncher.launch(intent)
              true
            } catch (e: Exception) {
              filePathCallback?.onReceiveValue(null)
              filePathCallback = null
              false
            }
          }
        )
      }
    }
  }
}

@SuppressLint("SetJavaScriptEnabled")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NutrolixSupplementBrandApp(
  onOpenFileChooser: (ValueCallback<Array<Uri>>, WebChromeClient.FileChooserParams) -> Boolean
) {
  val context = LocalContext.current
  var webViewInstance by remember { mutableStateOf<WebView?>(null) }
  var loadingProgress by remember { mutableIntStateOf(0) }
  var isPageLoading by remember { mutableStateOf(true) }
  var canGoBack by remember { mutableStateOf(false) }
  var currentUrl by remember { mutableStateOf(MainActivity.LIVE_SERVER_URL) }
  var isOfflineMode by remember { mutableStateOf(false) }
  var lastBackPressTime by remember { mutableLongStateOf(0L) }

  val googleSignInService = remember { com.example.auth.GoogleSignInService(context) }
  val coroutineScope = rememberCoroutineScope()

  // Runtime Notification Permission launcher for Android 13+
  val notificationPermissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestPermission()
  ) { /* notification access */ }

  LaunchedEffect(Unit) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
  }

  // Back button handling
  BackHandler(enabled = true) {
    if (webViewInstance?.canGoBack() == true) {
      webViewInstance?.goBack()
    } else {
      val currentTime = System.currentTimeMillis()
      if (currentTime - lastBackPressTime < 2000) {
        (context as? Activity)?.finish()
      } else {
        lastBackPressTime = currentTime
        Toast.makeText(context, "Press back again to exit Nutrolix", Toast.LENGTH_SHORT).show()
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
        .background(Color.White)
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

            // High-Performance Web Settings Configuration
            settings.apply {
              javaScriptEnabled = true
              domStorageEnabled = true
              mediaPlaybackRequiresUserGesture = false
              allowFileAccess = true
              allowContentAccess = true
              allowFileAccessFromFileURLs = true
              allowUniversalAccessFromFileURLs = true
              useWideViewPort = true
              loadWithOverviewMode = true
              setSupportZoom(false)
              builtInZoomControls = false
              displayZoomControls = false
              cacheMode = WebSettings.LOAD_DEFAULT
              mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
              userAgentString = settings.userAgentString + " NutrolixApp/1.0.0"
            }

            addJavascriptInterface(object {
              @JavascriptInterface
              fun getAppVersion(): String = "1.0.0"

              @JavascriptInterface
              fun startGoogleSignIn() {
                coroutineScope.launch {
                  val result = googleSignInService.signIn(context)
                  when (result) {
                    is com.example.auth.GoogleSignInResult.Success -> {
                      val user = result.user
                      val email = user.email ?: ""
                      val name = user.displayName ?: email.substringBefore("@")
                      val photo = user.photoUrl?.toString() ?: ""
                      val uid = user.uid
                      (context as? Activity)?.runOnUiThread {
                        webViewInstance?.evaluateJavascript(
                          "if (typeof window.onNativeGoogleSignInSuccess === 'function') { window.onNativeGoogleSignInSuccess('$email', '$name', '$photo', '$uid'); }",
                          null
                        )
                      }
                    }
                    is com.example.auth.GoogleSignInResult.Failure -> {
                      (context as? Activity)?.runOnUiThread {
                        webViewInstance?.evaluateJavascript(
                          "if (typeof window.onNativeGoogleSignInFailure === 'function') { window.onNativeGoogleSignInFailure('${result.message.replace("'", "\\'")}'); }",
                          null
                        )
                      }
                    }
                    com.example.auth.GoogleSignInResult.Cancelled -> {
                      (context as? Activity)?.runOnUiThread {
                        webViewInstance?.evaluateJavascript(
                          "if (typeof window.onNativeGoogleSignInCancelled === 'function') { window.onNativeGoogleSignInCancelled(); }",
                          null
                        )
                      }
                    }
                  }
                }
              }
            }, "AndroidNative")

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

              override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
              ) {
                callback?.invoke(origin, true, false)
              }
            }

            webViewClient = object : WebViewClient() {
              override fun onRenderProcessGone(
                view: WebView?,
                detail: RenderProcessGoneDetail?
              ): Boolean {
                // Prevents app crash if the underlying GPU/Chromium process fails or restarts
                try {
                  view?.let {
                    (it.parent as? ViewGroup)?.removeView(it)
                    it.destroy()
                  }
                } catch (_: Exception) {}
                return true
              }

              override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                isPageLoading = true
                canGoBack = canGoBack()
                currentUrl = url ?: ""
              }

              override fun onPageFinished(view: WebView?, url: String?) {
                isPageLoading = false
                canGoBack = canGoBack()
                currentUrl = url ?: ""
              }

              override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
              ): Boolean {
                val url = request?.url?.toString() ?: return false

                // Handle external communication apps (WhatsApp, phone, mailto, Google Maps, Instagram, Facebook, YouTube)
                if (url.startsWith("tel:") || url.startsWith("mailto:") || 
                    url.startsWith("whatsapp:") || url.contains("wa.me") || 
                    url.contains("share.google") || url.contains("instagram.com") ||
                    url.contains("facebook.com") || url.contains("youtube.com")) {
                  try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                      flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    ctx.startActivity(intent)
                    return true
                  } catch (_: Exception) {
                    return false
                  }
                }

                // Internal asset navigation routing for seamless offline operation
                if (url == "file:///" || url == "file:///android_asset/web/" || url.endsWith("/index.html") || url.endsWith("/") || url.endsWith("/#")) {
                  view?.loadUrl(MainActivity.PRIMARY_APP_URL)
                  return true
                }
                if (url.contains("food.html") || url.endsWith("/food") || url.startsWith("file:///food")) {
                  val query = Uri.parse(url).query
                  val target = "file:///android_asset/web/food.html" + (if (query != null) "?$query" else "")
                  view?.loadUrl(target)
                  return true
                }
                if (url.contains("shop.html") || url.endsWith("/shop") || url.startsWith("file:///shop")) {
                  val query = Uri.parse(url).query
                  val target = "file:///android_asset/web/shop.html" + (if (query != null) "?$query" else "")
                  view?.loadUrl(target)
                  return true
                }
                if (url.contains("cart.html") || url.endsWith("/cart") || url.startsWith("file:///cart")) {
                  view?.loadUrl("file:///android_asset/web/cart.html")
                  return true
                }
                if (url.contains("orders.html") || url.endsWith("/orders") || url.startsWith("file:///orders") || url.contains("track")) {
                  val query = Uri.parse(url).query
                  val target = "file:///android_asset/web/orders.html" + (if (query != null) "?$query" else "")
                  view?.loadUrl(target)
                  return true
                }
                if (url.contains("account.html") || url.endsWith("/account") || url.startsWith("file:///account")) {
                  view?.loadUrl("file:///android_asset/web/account.html")
                  return true
                }
                if (url.contains("blogs.html") || url.endsWith("/blogs") || url.startsWith("file:///blogs")) {
                  view?.loadUrl("file:///android_asset/web/blogs.html")
                  return true
                }
                if (url.contains("about.html") || url.endsWith("/about") || url.startsWith("file:///about")) {
                  view?.loadUrl("file:///android_asset/web/about.html")
                  return true
                }
                if (url.contains("contact.html") || url.endsWith("/contact") || url.startsWith("file:///contact")) {
                  view?.loadUrl("file:///android_asset/web/contact.html")
                  return true
                }
                if (url.contains("faqs.html") || url.endsWith("/faqs") || url.startsWith("file:///faqs")) {
                  view?.loadUrl("file:///android_asset/web/faqs.html")
                  return true
                }
                if (url.contains("shipping.html") || url.endsWith("/shipping") || url.startsWith("file:///shipping")) {
                  view?.loadUrl("file:///android_asset/web/shipping.html")
                  return true
                }
                if (url.contains("refund.html") || url.endsWith("/refund") || url.startsWith("file:///refund")) {
                  view?.loadUrl("file:///android_asset/web/refund.html")
                  return true
                }
                if (url.contains("cancellation.html") || url.endsWith("/cancellation") || url.startsWith("file:///cancellation")) {
                  view?.loadUrl("file:///android_asset/web/cancellation.html")
                  return true
                }
                if (url.contains("terms.html") || url.endsWith("/terms") || url.startsWith("file:///terms")) {
                  view?.loadUrl("file:///android_asset/web/terms.html")
                  return true
                }
                if (url.contains("privacy.html") || url.endsWith("/privacy") || url.startsWith("file:///privacy")) {
                  view?.loadUrl("file:///android_asset/web/privacy.html")
                  return true
                }
                if (url.contains("product") || url.contains("/product?id=") || url.contains("/product.html?id=")) {
                  val query = Uri.parse(url).query
                  val target = "file:///android_asset/web/product.html" + (if (query != null) "?$query" else "")
                  view?.loadUrl(target)
                  return true
                }

                // Handle external PDF or APK downloads
                if (url.endsWith(".apk") || url.endsWith(".pdf")) {
                  try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                      flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    ctx.startActivity(intent)
                    return true
                  } catch (_: Exception) {
                    return false
                  }
                }

                return false // Stay inside WebView for Nutrolix pages
              }

              override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
              ) {
                // If any error occurs, stay on primary asset
                if (request?.isForMainFrame == true) {
                  view?.loadUrl(MainActivity.PRIMARY_APP_URL)
                }
              }
            }

            // Initial URL load: Immediately load local offline-first asset bundle so ZERO email ID, ZERO registration, and ZERO auth redirects ever happen!
            loadUrl(MainActivity.PRIMARY_APP_URL)
            webViewInstance = this
          }
        },
        update = { webView ->
          webViewInstance = webView
        }
      )
    }
  }
}
