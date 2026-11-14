package com.example

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.location.Geocoder
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Looper
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
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.example.auth.GoogleSignInResult
import com.example.auth.GoogleSignInService
import com.example.auth.PhoneAuthService
import com.example.auth.PhoneOtpStartResult
import com.example.auth.PhoneOtpVerifyResult
import com.example.data.FirestoreService
import com.example.service.NutrolixFirebaseMessagingService
import com.example.ui.theme.MyApplicationTheme
import com.example.util.OrderNotificationHelper
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.messaging.FirebaseMessaging
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import kotlin.coroutines.resume

class MainActivity : ComponentActivity() {

  companion object {
    const val PRIMARY_APP_URL = "file:///android_asset/web/index.html"
    const val LIVE_SERVER_URL = "https://ais-dev-hdct4zqciie73skb7kah2l-760738801567.asia-northeast1.run.app/"
  }

  var filePathCallback: ValueCallback<Array<Uri>>? = null
  private val pendingDeepLinkState = mutableStateOf<String?>(null)

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
    OrderNotificationHelper.initChannel(this)
    extractDeepLinkTarget(intent)?.let { pendingDeepLinkState.value = it }

    setContent {
      MyApplicationTheme {
        val deepLinkUrl by pendingDeepLinkState
        NutrolixSupplementBrandApp(
          deepLinkUrl = deepLinkUrl,
          onDeepLinkConsumed = { pendingDeepLinkState.value = null },
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

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    extractDeepLinkTarget(intent)?.let { pendingDeepLinkState.value = it }
  }

  private fun extractDeepLinkTarget(intent: Intent?): String? {
    if (intent == null) return null
    val orderId = intent.getStringExtra("order_id") ?: ""
    val navigateTo = intent.getStringExtra("navigate_to") ?: ""
    val openUrl = intent.getStringExtra("open_url") ?: ""

    return when {
      orderId.isNotBlank() -> "file:///android_asset/web/orders.html?orderId=${Uri.encode(orderId)}"
      openUrl.contains("orders.html") -> {
        val q = openUrl.substringAfter("?", "")
        "file:///android_asset/web/orders.html" + if (q.isNotBlank()) "?$q" else ""
      }
      navigateTo == "orders" || navigateTo == "review_dialog" -> "file:///android_asset/web/orders.html"
      else -> null
    }
  }
}

private fun firebaseUserToJson(
  user: FirebaseUser,
  linked: Boolean = false,
  previousUid: String? = null,
  collisionWarning: String? = null
): JSONObject {
  val providers = JSONArray()
  user.providerData.forEach { info ->
    if (info.providerId != "firebase") {
      providers.put(info.providerId)
    }
  }
  return JSONObject().apply {
    put("uid", user.uid)
    put("email", user.email ?: "")
    put("name", user.displayName ?: user.email?.substringBefore("@") ?: "Nutrolix Customer")
    put("phone", user.phoneNumber ?: "")
    put("verifiedPhone", user.phoneNumber ?: "")
    put("photo", user.photoUrl?.toString() ?: "")
    put("providers", providers)
    put("linked", linked)
    put("previousUid", previousUid ?: "")
    put("collisionWarning", collisionWarning ?: "")
  }
}

@SuppressLint("SetJavaScriptEnabled", "MissingPermission")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NutrolixSupplementBrandApp(
  deepLinkUrl: String? = null,
  onDeepLinkConsumed: () -> Unit = {},
  onOpenFileChooser: (ValueCallback<Array<Uri>>, WebChromeClient.FileChooserParams) -> Boolean
) {
  val context = LocalContext.current
  val activity = context as? Activity
  var webViewInstance by remember { mutableStateOf<WebView?>(null) }
  var lastBackPressTime by remember { mutableLongStateOf(0L) }

  val googleSignInService = remember { GoogleSignInService(context) }
  val phoneAuthService = remember { PhoneAuthService() }
  val firestoreService = remember { FirestoreService(context) }
  val coroutineScope = rememberCoroutineScope()

  // Pending permission continuations (explicit consent before OS permission prompt)
  var pendingLocationCallback by remember { mutableStateOf<((Boolean) -> Unit)?>(null) }
  var pendingWebGeolocationRequest by remember { mutableStateOf<Pair<String?, GeolocationPermissions.Callback?>?>(null) }

  val notificationPermissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestPermission()
  ) { /* handled */ }

  val locationPermissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestMultiplePermissions()
  ) { permissions ->
    val granted = (permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true) ||
      (permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true)

    pendingLocationCallback?.invoke(granted)
    pendingLocationCallback = null

    pendingWebGeolocationRequest?.let { (origin, callback) ->
      callback?.invoke(origin, granted, false)
      pendingWebGeolocationRequest = null
    }
  }

  fun hasLocationPermission(): Boolean {
    val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    return fine || coarse
  }

  fun fetchAndSyncFcmToken(user: FirebaseUser?) {
    if (user == null) return
    try {
      FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
        val token = if (task.isSuccessful) task.result else {
          context.getSharedPreferences(NutrolixFirebaseMessagingService.PREFS_NAME, Context.MODE_PRIVATE)
            .getString(NutrolixFirebaseMessagingService.KEY_FCM_TOKEN, null)
        }
        if (!token.isNullOrBlank()) {
          context.getSharedPreferences(NutrolixFirebaseMessagingService.PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(NutrolixFirebaseMessagingService.KEY_FCM_TOKEN, token).apply()

          coroutineScope.launch(Dispatchers.IO) {
            firestoreService.saveFcmToken(
              uid = user.uid,
              token = token,
              phone = user.phoneNumber ?: "",
              email = user.email ?: ""
            )
          }
          activity?.runOnUiThread {
            val escaped = JSONObject.quote(token)
            webViewInstance?.evaluateJavascript(
              "if (typeof window.onNativeFcmToken === 'function') { window.onNativeFcmToken($escaped); }",
              null
            )
          }
        }
      }
    } catch (_: Throwable) {}
  }

  LaunchedEffect(Unit) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
    try {
      FirebaseAuth.getInstance().currentUser?.let { fetchAndSyncFcmToken(it) }
    } catch (_: Throwable) {}
  }

  // Deep-link handling when Customer taps an FCM notification
  LaunchedEffect(deepLinkUrl, webViewInstance) {
    if (!deepLinkUrl.isNullOrBlank() && webViewInstance != null) {
      webViewInstance?.loadUrl(deepLinkUrl)
      onDeepLinkConsumed()
    }
  }

  // Foreground FCM push receiver -> sends in-app clickable notification toast to JS
  DisposableEffect(context) {
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(ctx: Context?, intent: Intent?) {
        if (intent?.action != NutrolixFirebaseMessagingService.ACTION_ORDER_PUSH_RECEIVED) return
        val payload = JSONObject().apply {
          put("title", intent.getStringExtra("title") ?: "Nutrolix Order Update")
          put("body", intent.getStringExtra("body") ?: "")
          put("orderId", intent.getStringExtra("order_id") ?: "")
          put("status", intent.getStringExtra("status") ?: "")
          put("url", intent.getStringExtra("open_url") ?: "/orders.html")
        }.toString()
        val quoted = JSONObject.quote(payload)
        activity?.runOnUiThread {
          webViewInstance?.evaluateJavascript(
            "if (typeof window.onNativeOrderPushReceived === 'function') { window.onNativeOrderPushReceived(JSON.parse($quoted)); }",
            null
          )
        }
      }
    }
    val filter = IntentFilter(NutrolixFirebaseMessagingService.ACTION_ORDER_PUSH_RECEIVED)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      context.registerReceiver(receiver, filter)
    }
    onDispose {
      try { context.unregisterReceiver(receiver) } catch (_: Exception) {}
    }
  }

  BackHandler(enabled = true) {
    if (webViewInstance?.canGoBack() == true) {
      webViewInstance?.goBack()
    } else {
      val currentTime = System.currentTimeMillis()
      if (currentTime - lastBackPressTime < 2000) {
        activity?.finish()
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
              userAgentString = settings.userAgentString + " NutrolixApp/2.0.0"
            }

            addJavascriptInterface(object {
              @JavascriptInterface
              fun getAppVersion(): String = "2.0.0"

              @JavascriptInterface
              fun getAuthUserJson(): String {
                val u = try { FirebaseAuth.getInstance().currentUser } catch (_: Throwable) { null }
                return u?.let { firebaseUserToJson(it).toString() } ?: ""
              }

              @JavascriptInterface
              fun startPhoneOtp(rawPhone: String, isResend: Boolean) {
                val act = activity ?: return
                act.runOnUiThread {
                  phoneAuthService.startPhoneOtp(act, rawPhone, isResend) { res ->
                    when (res) {
                      is PhoneOtpStartResult.CodeSent -> {
                        val payload = JSONObject().apply {
                          put("verificationId", res.verificationId)
                          put("phoneE164", res.phoneE164)
                        }.toString()
                        val quoted = JSONObject.quote(payload)
                        act.runOnUiThread {
                          webViewInstance?.evaluateJavascript(
                            "if (typeof window.onNativePhoneOtpSent === 'function') { window.onNativePhoneOtpSent(JSON.parse($quoted)); }",
                            null
                          )
                        }
                      }
                      is PhoneOtpStartResult.InstantVerified -> {
                        fetchAndSyncFcmToken(res.user)
                        val payload = firebaseUserToJson(res.user, res.linked, res.previousUid).toString()
                        val quoted = JSONObject.quote(payload)
                        act.runOnUiThread {
                          webViewInstance?.evaluateJavascript(
                            "if (typeof window.onNativePhoneAuthSuccess === 'function') { window.onNativePhoneAuthSuccess(JSON.parse($quoted)); }",
                            null
                          )
                        }
                      }
                      is PhoneOtpStartResult.Failure -> {
                        val payload = JSONObject().apply {
                          put("code", res.code)
                          put("message", res.message)
                        }.toString()
                        val quoted = JSONObject.quote(payload)
                        act.runOnUiThread {
                          webViewInstance?.evaluateJavascript(
                            "if (typeof window.onNativePhoneAuthError === 'function') { window.onNativePhoneAuthError(JSON.parse($quoted)); }",
                            null
                          )
                        }
                      }
                    }
                  }
                }
              }

              @JavascriptInterface
              fun verifyPhoneOtp(verificationId: String, otpCode: String) {
                coroutineScope.launch {
                  when (val res = phoneAuthService.verifyOtp(verificationId, otpCode)) {
                    is PhoneOtpVerifyResult.Success -> {
                      fetchAndSyncFcmToken(res.user)
                      val payload = firebaseUserToJson(res.user, res.linked, res.previousUid, res.collisionWarning).toString()
                      val quoted = JSONObject.quote(payload)
                      activity?.runOnUiThread {
                        webViewInstance?.evaluateJavascript(
                          "if (typeof window.onNativePhoneAuthSuccess === 'function') { window.onNativePhoneAuthSuccess(JSON.parse($quoted)); }",
                          null
                        )
                      }
                    }
                    is PhoneOtpVerifyResult.Failure -> {
                      val payload = JSONObject().apply {
                        put("code", res.code)
                        put("message", res.message)
                      }.toString()
                      val quoted = JSONObject.quote(payload)
                      activity?.runOnUiThread {
                        webViewInstance?.evaluateJavascript(
                          "if (typeof window.onNativePhoneAuthError === 'function') { window.onNativePhoneAuthError(JSON.parse($quoted)); }",
                          null
                        )
                      }
                    }
                  }
                }
              }

              @JavascriptInterface
              fun startGoogleSignIn() {
                coroutineScope.launch {
                  when (val result = googleSignInService.signIn(context)) {
                    is GoogleSignInResult.Success -> {
                      val user = result.user
                      fetchAndSyncFcmToken(user)
                      val email = user.email ?: ""
                      val name = user.displayName ?: email.substringBefore("@")
                      val photo = user.photoUrl?.toString() ?: ""
                      val uid = user.uid
                      val richPayload = firebaseUserToJson(user, result.linked, result.previousUid, result.collisionWarning).toString()
                      val quotedRich = JSONObject.quote(richPayload)
                      val quotedEmail = JSONObject.quote(email)
                      val quotedName = JSONObject.quote(name)
                      val quotedPhoto = JSONObject.quote(photo)
                      val quotedUid = JSONObject.quote(uid)
                      activity?.runOnUiThread {
                        webViewInstance?.evaluateJavascript(
                          "if (typeof window.onNativeUnifiedAuthSuccess === 'function') { window.onNativeUnifiedAuthSuccess(JSON.parse($quotedRich)); } " +
                            "else if (typeof window.onNativeGoogleSignInSuccess === 'function') { window.onNativeGoogleSignInSuccess($quotedEmail, $quotedName, $quotedPhoto, $quotedUid); }",
                          null
                        )
                      }
                    }
                    is GoogleSignInResult.Failure -> {
                      val quotedMsg = JSONObject.quote(result.message)
                      activity?.runOnUiThread {
                        webViewInstance?.evaluateJavascript(
                          "if (typeof window.onNativeGoogleSignInFailure === 'function') { window.onNativeGoogleSignInFailure($quotedMsg); }",
                          null
                        )
                      }
                    }
                    GoogleSignInResult.Cancelled -> {
                      activity?.runOnUiThread {
                        webViewInstance?.evaluateJavascript(
                          "if (typeof window.onNativeGoogleSignInCancelled === 'function') { window.onNativeGoogleSignInCancelled(); }",
                          null
                        )
                      }
                    }
                  }
                }
              }

              @JavascriptInterface
              fun getFcmToken() {
                try {
                  FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                    val token = if (task.isSuccessful) task.result else {
                      context.getSharedPreferences(NutrolixFirebaseMessagingService.PREFS_NAME, Context.MODE_PRIVATE)
                        .getString(NutrolixFirebaseMessagingService.KEY_FCM_TOKEN, "") ?: ""
                    }
                    if (!token.isNullOrBlank()) {
                      val user = try { FirebaseAuth.getInstance().currentUser } catch (_: Throwable) { null }
                      if (user != null) {
                        coroutineScope.launch(Dispatchers.IO) {
                          firestoreService.saveFcmToken(user.uid, token, user.phoneNumber ?: "", user.email ?: "")
                        }
                      }
                      val quoted = JSONObject.quote(token)
                      activity?.runOnUiThread {
                        webViewInstance?.evaluateJavascript(
                          "if (typeof window.onNativeFcmToken === 'function') { window.onNativeFcmToken($quoted); }",
                          null
                        )
                      }
                    }
                  }
                } catch (_: Throwable) {}
              }

              @JavascriptInterface
              fun requestCurrentLocation() {
                val dispatchLocationError: (String, String) -> Unit = { code, message ->
                  val payload = JSONObject().apply {
                    put("code", code)
                    put("message", message)
                  }.toString()
                  val quoted = JSONObject.quote(payload)
                  activity?.runOnUiThread {
                    webViewInstance?.evaluateJavascript(
                      "if (typeof window.onNativeLocationError === 'function') { window.onNativeLocationError(JSON.parse($quoted)); }",
                      null
                    )
                  }
                }

                val performLocationFetch: () -> Unit = {
                  coroutineScope.launch {
                    try {
                      val fusedClient = LocationServices.getFusedLocationProviderClient(context)
                      val coords = suspendCancellableCoroutine<Pair<Double, Double>?> { cont ->
                        try {
                          fusedClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                            .addOnSuccessListener { loc ->
                              if (loc != null) {
                                if (cont.isActive) cont.resume(loc.latitude to loc.longitude)
                              } else {
                                fusedClient.lastLocation
                                  .addOnSuccessListener { lastLoc ->
                                    if (lastLoc != null) {
                                      if (cont.isActive) cont.resume(lastLoc.latitude to lastLoc.longitude)
                                    } else {
                                      val req = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1500L)
                                        .setMaxUpdates(1)
                                        .build()
                                      val cb = object : LocationCallback() {
                                        override fun onLocationResult(res: LocationResult) {
                                          fusedClient.removeLocationUpdates(this)
                                          val l = res.lastLocation
                                          if (cont.isActive) cont.resume(l?.let { it.latitude to it.longitude })
                                        }
                                      }
                                      fusedClient.requestLocationUpdates(req, cb, Looper.getMainLooper())
                                    }
                                  }
                                  .addOnFailureListener {
                                    if (cont.isActive) cont.resume(null)
                                  }
                              }
                            }
                            .addOnFailureListener {
                              if (cont.isActive) cont.resume(null)
                            }
                        } catch (_: Exception) {
                          if (cont.isActive) cont.resume(null)
                        }
                      }

                      if (coords == null) {
                        dispatchLocationError("GPS_UNAVAILABLE", "GPS is off or signal unavailable. Please enable location or enter address manually.")
                        return@launch
                      }

                      val (lat, lon) = coords
                      val fallbackGeo = withContext(Dispatchers.IO) {
                        val out = JSONObject()
                        try {
                          @Suppress("DEPRECATION")
                          val addresses = Geocoder(context, Locale.getDefault()).getFromLocation(lat, lon, 1)
                          val addr = addresses?.firstOrNull()
                          if (addr != null) {
                            out.put("pincode", addr.postalCode ?: "")
                            val locality = listOfNotNull(addr.subLocality, addr.locality ?: addr.subAdminArea)
                              .filter { it.isNotBlank() }
                              .distinct()
                              .joinToString(", ")
                            out.put("city", locality)
                            out.put("state", addr.adminArea ?: "")
                            out.put("formattedAddress", addr.getAddressLine(0) ?: "")
                          }
                        } catch (_: Exception) {}
                        out
                      }

                      val payload = JSONObject().apply {
                        put("lat", lat)
                        put("lon", lon)
                        put("nativeGeocoder", fallbackGeo)
                      }.toString()
                      val quoted = JSONObject.quote(payload)
                      activity?.runOnUiThread {
                        webViewInstance?.evaluateJavascript(
                          "if (typeof window.onNativeLocationSuccess === 'function') { window.onNativeLocationSuccess(JSON.parse($quoted)); }",
                          null
                        )
                      }
                    } catch (e: Exception) {
                      dispatchLocationError("LOCATION_ERROR", e.localizedMessage ?: "Failed to read device location.")
                    }
                  }
                }

                activity?.runOnUiThread {
                  if (hasLocationPermission()) {
                    performLocationFetch()
                  } else {
                    pendingLocationCallback = { granted ->
                      if (granted) {
                        performLocationFetch()
                      } else {
                        dispatchLocationError("PERMISSION_DENIED", "Location permission was denied. Please enter PIN code and address manually.")
                      }
                    }
                    locationPermissionLauncher.launch(
                      arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                      )
                    )
                  }
                }
              }

              @JavascriptInterface
              fun signOut() {
                coroutineScope.launch {
                  googleSignInService.signOut()
                }
              }
            }, "AndroidNative")

            webChromeClient = object : WebChromeClient() {
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
                if (hasLocationPermission()) {
                  callback?.invoke(origin, true, false)
                } else {
                  pendingWebGeolocationRequest = origin to callback
                  locationPermissionLauncher.launch(
                    arrayOf(
                      Manifest.permission.ACCESS_FINE_LOCATION,
                      Manifest.permission.ACCESS_COARSE_LOCATION
                    )
                  )
                }
              }
            }

            webViewClient = object : WebViewClient() {
              override fun onRenderProcessGone(
                view: WebView?,
                detail: RenderProcessGoneDetail?
              ): Boolean {
                try {
                  view?.let {
                    (it.parent as? ViewGroup)?.removeView(it)
                    it.destroy()
                  }
                } catch (_: Exception) {}
                return true
              }

              override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
              ): Boolean {
                val url = request?.url?.toString() ?: return false

                if (url.startsWith("tel:") || url.startsWith("mailto:") ||
                  url.startsWith("whatsapp:") || url.contains("wa.me") ||
                  url.contains("share.google") || url.contains("instagram.com") ||
                  url.contains("facebook.com") || url.contains("youtube.com")
                ) {
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

                return false
              }

              override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
              ) {
                if (request?.isForMainFrame == true) {
                  view?.loadUrl(MainActivity.PRIMARY_APP_URL)
                }
              }
            }

            loadUrl(deepLinkUrl ?: MainActivity.PRIMARY_APP_URL)
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
