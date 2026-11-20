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
import com.example.auth.PhoneAuthService
import com.example.auth.PhoneOtpStartResult
import com.example.auth.PhoneOtpVerifyResult
import com.example.data.FirestoreService
import com.example.service.NutrolixFirebaseMessagingService
import com.example.ui.theme.MyApplicationTheme
import com.example.util.OrderNotificationHelper
import com.example.util.PullToRefreshWebViewWrapper
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.messaging.FirebaseMessaging
import java.net.HttpURLConnection
import java.net.URL
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
    const val LIVE_SERVER_URL = "https://nutrolix.in/"
    const val PREFS_AUTH = "nutrolix_auth_prefs"
    const val KEY_AUTH_UID = "uid"
    const val KEY_AUTH_PHONE = "verified_phone"
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
      orderId.isNotBlank() -> "${LIVE_SERVER_URL.trimEnd('/')}/orders.html?orderId=${Uri.encode(orderId)}"
      openUrl.contains("orders.html") -> {
        val q = openUrl.substringAfter("?", "")
        "${LIVE_SERVER_URL.trimEnd('/')}/orders.html" + if (q.isNotBlank()) "?$q" else ""
      }
      navigateTo == "orders" || navigateTo == "review_dialog" -> "${LIVE_SERVER_URL.trimEnd('/')}/orders.html"
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

  val phoneAuthService = remember { PhoneAuthService() }
  val firestoreService = remember { FirestoreService(context) }
  val coroutineScope = rememberCoroutineScope()

  // Pending permission continuations (explicit consent before OS permission prompt)
  var pendingLocationCallback by remember { mutableStateOf<((Boolean) -> Unit)?>(null) }
  var pendingWebGeolocationRequest by remember { mutableStateOf<Pair<String?, GeolocationPermissions.Callback?>?>(null) }

  var triggerFcmSyncAfterPermission by remember { mutableStateOf(0) }

  val notificationPermissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestPermission()
  ) { granted ->
    if (granted) {
      triggerFcmSyncAfterPermission++
    }
  }

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

  fun resolveCustomerIdentity(user: FirebaseUser?): Pair<String, String> {
    val authPrefs = context.getSharedPreferences(MainActivity.PREFS_AUTH, Context.MODE_PRIVATE)
    val prefUid = authPrefs.getString(MainActivity.KEY_AUTH_UID, "") ?: ""
    val prefPhone = authPrefs.getString(MainActivity.KEY_AUTH_PHONE, "") ?: ""
    val rawPhone = (user?.phoneNumber ?: "").ifBlank { prefPhone }
    val digits = rawPhone.filter { it.isDigit() }.takeLast(10)
    val rawUid = (user?.uid ?: "").ifBlank { prefUid }
    val resolvedUid = if (digits.length == 10 && digits.first() in '6'..'9') {
      "phone_$digits"
    } else {
      rawUid
    }
    return resolvedUid to digits
  }

  fun fetchAndSyncFcmToken(user: FirebaseUser?) {
    try {
      FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
        val token = if (task.isSuccessful) task.result else {
          context.getSharedPreferences(NutrolixFirebaseMessagingService.PREFS_NAME, Context.MODE_PRIVATE)
            .getString(NutrolixFirebaseMessagingService.KEY_FCM_TOKEN, null)
        }
        if (!token.isNullOrBlank()) {
          context.getSharedPreferences(NutrolixFirebaseMessagingService.PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(NutrolixFirebaseMessagingService.KEY_FCM_TOKEN, token).apply()

          val (resolvedUid, resolvedPhone) = resolveCustomerIdentity(user)
          val fcmPrefs = context.getSharedPreferences(NutrolixFirebaseMessagingService.PREFS_NAME, Context.MODE_PRIVATE)
          val deviceId = fcmPrefs.getString("device_id", null) ?: java.util.UUID.randomUUID().toString().also {
            fcmPrefs.edit().putString("device_id", it).apply()
          }
          coroutineScope.launch(Dispatchers.IO) {
            if (resolvedUid.isNotBlank()) {
              try {
                firestoreService.saveFcmToken(
                  uid = resolvedUid,
                  token = token,
                  phone = resolvedPhone,
                  email = user?.email ?: ""
                )
              } catch (_: Throwable) {}
            }
            try {
              val idToken = try {
                val cur = user ?: FirebaseAuth.getInstance().currentUser
                if (cur != null) com.google.android.gms.tasks.Tasks.await(cur.getIdToken(false)).token ?: "" else ""
              } catch (_: Throwable) { "" }

              val endpoint = MainActivity.LIVE_SERVER_URL.trimEnd('/') + "/api/notifications/register-token"
              val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 10000
                readTimeout = 10000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                if (idToken.isNotBlank()) {
                  setRequestProperty("Authorization", "Bearer $idToken")
                }
              }
              val payload = JSONObject().apply {
                put("uid", resolvedUid)
                put("deviceId", deviceId)
                put("fcmToken", token)
                put("token", token)
                put("customerPhone", resolvedPhone)
                put("customerEmail", user?.email ?: "")
                put("platform", "android-apk")
              }
              conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
              val responseCode = conn.responseCode
              android.util.Log.i("NutrolixFCM", "Token registration HTTP $responseCode (uid=$resolvedUid)")
              conn.disconnect()
            } catch (e: Exception) {
              android.util.Log.w("NutrolixFCM", "Server token registration failed: ${e.message}")
            }
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

  LaunchedEffect(triggerFcmSyncAfterPermission) {
    if (triggerFcmSyncAfterPermission > 0) {
      try {
        fetchAndSyncFcmToken(FirebaseAuth.getInstance().currentUser)
      } catch (_: Throwable) {}
    }
  }

  LaunchedEffect(Unit) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
    try {
      fetchAndSyncFcmToken(FirebaseAuth.getInstance().currentUser)
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
          var ptrWrapper: PullToRefreshWebViewWrapper? = null
          var isUsingOfflineFallback = false
          val webView = WebView(ctx).apply {
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
              // Always request current website assets; APK should not pin an old web build.
              cacheMode = WebSettings.LOAD_NO_CACHE
              mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
              userAgentString = settings.userAgentString + " NutrolixApp/2.0.0"
            }

            addJavascriptInterface(object {
              @JavascriptInterface
              fun getAppVersion(): String = "2.0.0"

              @JavascriptInterface
              fun getAuthUserJson(): String {
                val u = try { FirebaseAuth.getInstance().currentUser } catch (_: Throwable) { null }
                if (u != null) {
                  val obj = firebaseUserToJson(u)
                  val (_, resolvedPhone) = resolveCustomerIdentity(u)
                  if (obj.optString("phone").isBlank() && resolvedPhone.isNotBlank()) {
                    obj.put("phone", resolvedPhone)
                    obj.put("verifiedPhone", resolvedPhone)
                  }
                  return obj.toString()
                }
                val (prefUid, prefPhone) = resolveCustomerIdentity(null)
                if (prefUid.isNotBlank() && prefPhone.length == 10) {
                  return JSONObject().apply {
                    put("uid", prefUid)
                    put("phone", prefPhone)
                    put("verifiedPhone", prefPhone)
                    put("name", "Nutrolix Customer")
                  }.toString()
                }
                return ""
              }

              @JavascriptInterface
              fun syncAuthSession(uid: String, verifiedPhone: String, customToken: String) {
                val digits = verifiedPhone.filter { it.isDigit() }.takeLast(10)
                val canonicalUid = if (digits.length == 10 && digits.first() in '6'..'9') {
                  "phone_$digits"
                } else {
                  uid.trim()
                }
                context.getSharedPreferences(MainActivity.PREFS_AUTH, Context.MODE_PRIVATE)
                  .edit()
                  .putString(MainActivity.KEY_AUTH_UID, canonicalUid)
                  .putString(MainActivity.KEY_AUTH_PHONE, digits)
                  .apply()

                if (customToken.isNotBlank()) {
                  try {
                    FirebaseAuth.getInstance().signInWithCustomToken(customToken)
                      .addOnCompleteListener {
                        fetchAndSyncFcmToken(FirebaseAuth.getInstance().currentUser)
                      }
                    return
                  } catch (_: Throwable) {}
                }
                fetchAndSyncFcmToken(try { FirebaseAuth.getInstance().currentUser } catch (_: Throwable) { null })
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
              fun getFcmToken() {
                try {
                  FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                    val token = if (task.isSuccessful) task.result else {
                      context.getSharedPreferences(NutrolixFirebaseMessagingService.PREFS_NAME, Context.MODE_PRIVATE)
                        .getString(NutrolixFirebaseMessagingService.KEY_FCM_TOKEN, "") ?: ""
                    }
                    if (!token.isNullOrBlank()) {
                      val user = try { FirebaseAuth.getInstance().currentUser } catch (_: Throwable) { null }
                      val (resolvedUid, resolvedPhone) = resolveCustomerIdentity(user)
                      if (resolvedUid.isNotBlank()) {
                        coroutineScope.launch(Dispatchers.IO) {
                          firestoreService.saveFcmToken(resolvedUid, token, resolvedPhone, user?.email ?: "")
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
                try {
                  context.getSharedPreferences(MainActivity.PREFS_AUTH, Context.MODE_PRIVATE)
                    .edit()
                    .clear()
                    .apply()
                  FirebaseAuth.getInstance().signOut()
                } catch (_: Throwable) {}
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

              override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                ptrWrapper?.finishRefreshing()
                if (Uri.parse(url ?: "").host.equals(Uri.parse(MainActivity.LIVE_SERVER_URL).host, ignoreCase = true)) {
                  isUsingOfflineFallback = false
                }
                view?.evaluateJavascript("window.__nutrolixNativePtr = true;", null)
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

                // Offline local asset fallback navigation routing only when running from file://
                if (url.startsWith("file://")) {
                  val query = Uri.parse(url).query
                  val suffix = if (!query.isNullOrBlank()) "?$query" else ""
                  val mapped = when {
                    url == "file:///" || url == "file:///android_asset/web/" || url.endsWith("/index.html") || url.endsWith("/#") -> MainActivity.PRIMARY_APP_URL
                    url.startsWith("file:///food") -> "file:///android_asset/web/food.html$suffix"
                    url.startsWith("file:///shop") -> "file:///android_asset/web/shop.html$suffix"
                    url.startsWith("file:///cart") -> "file:///android_asset/web/cart.html$suffix"
                    url.startsWith("file:///orders") -> "file:///android_asset/web/orders.html$suffix"
                    url.startsWith("file:///account") -> "file:///android_asset/web/account.html$suffix"
                    url.startsWith("file:///blogs") -> "file:///android_asset/web/blogs.html$suffix"
                    url.startsWith("file:///about") -> "file:///android_asset/web/about.html$suffix"
                    url.startsWith("file:///contact") -> "file:///android_asset/web/contact.html$suffix"
                    url.startsWith("file:///faqs") -> "file:///android_asset/web/faqs.html$suffix"
                    url.startsWith("file:///shipping") -> "file:///android_asset/web/shipping.html$suffix"
                    url.startsWith("file:///refund") -> "file:///android_asset/web/refund.html$suffix"
                    url.startsWith("file:///cancellation") -> "file:///android_asset/web/cancellation.html$suffix"
                    url.startsWith("file:///terms") -> "file:///android_asset/web/terms.html$suffix"
                    url.startsWith("file:///privacy") -> "file:///android_asset/web/privacy.html$suffix"
                    url.startsWith("file:///product") -> "file:///android_asset/web/product.html$suffix"
                    else -> null
                  }
                  if (mapped != null && mapped != url) {
                    view?.loadUrl(mapped)
                    return true
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
                  ptrWrapper?.finishRefreshing()
                  val errorCode = error?.errorCode
                  val isConnectivityFailure =
                    errorCode == WebViewClient.ERROR_HOST_LOOKUP ||
                    errorCode == WebViewClient.ERROR_CONNECT ||
                    errorCode == WebViewClient.ERROR_TIMEOUT ||
                    errorCode == WebViewClient.ERROR_IO
                  val liveHost = Uri.parse(MainActivity.LIVE_SERVER_URL).host
                  val failedHost = request.url?.host
                  if (isConnectivityFailure &&
                    failedHost.equals(liveHost, ignoreCase = true) &&
                    !isUsingOfflineFallback
                  ) {
                    isUsingOfflineFallback = true
                    view?.loadUrl(MainActivity.PRIMARY_APP_URL)
                  }
                }
              }
            }
          }
          PullToRefreshWebViewWrapper(ctx, webView) { wv ->
            wv.clearCache(true)
            if (isUsingOfflineFallback) {
              isUsingOfflineFallback = false
              wv.loadUrl(MainActivity.LIVE_SERVER_URL)
            } else {
              wv.reload()
            }
          }.also {
            ptrWrapper = it
            webView.clearCache(true)
            webView.loadUrl(deepLinkUrl ?: MainActivity.LIVE_SERVER_URL)
            webViewInstance = webView
          }
        },
        update = { wrapper ->
          webViewInstance = wrapper.webView
        }
      )
    }
  }
}
