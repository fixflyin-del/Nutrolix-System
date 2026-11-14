package com.example.auth

import android.app.Activity
import android.util.Log
import com.google.firebase.FirebaseException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

private const val TAG = "PhoneAuthService"

sealed interface PhoneOtpStartResult {
  data class CodeSent(val verificationId: String, val phoneE164: String) : PhoneOtpStartResult
  data class InstantVerified(val user: FirebaseUser, val linked: Boolean, val previousUid: String?) : PhoneOtpStartResult
  data class Failure(val code: String, val message: String) : PhoneOtpStartResult
}

sealed interface PhoneOtpVerifyResult {
  data class Success(
    val user: FirebaseUser,
    val linked: Boolean,
    val previousUid: String?,
    val collisionWarning: String? = null
  ) : PhoneOtpVerifyResult
  data class Failure(val code: String, val message: String) : PhoneOtpVerifyResult
}

class PhoneAuthService(
  private val auth: FirebaseAuth? = try {
    FirebaseAuth.getInstance()
  } catch (e: Throwable) {
    Log.w(TAG, "FirebaseAuth unavailable: ${e.message}")
    null
  }
) {
  private var lastResendToken: PhoneAuthProvider.ForceResendingToken? = null
  private var lastVerificationId: String? = null

  companion object {
    fun formatIndianE164(rawPhone: String): String {
      val digits = rawPhone.replace(Regex("[^0-9]"), "")
      return when {
        digits.length == 10 -> "+91$digits"
        digits.length == 12 && digits.startsWith("91") -> "+$digits"
        rawPhone.trim().startsWith("+") && digits.length >= 10 -> "+$digits"
        else -> ""
      }
    }
  }

  fun startPhoneOtp(
    activity: Activity,
    rawPhone: String,
    isResend: Boolean = false,
    onResult: (PhoneOtpStartResult) -> Unit
  ) {
    val firebaseAuth = auth
    if (firebaseAuth == null) {
      onResult(PhoneOtpStartResult.Failure("AUTH_UNAVAILABLE", "Firebase Auth is not initialized."))
      return
    }

    val e164 = formatIndianE164(rawPhone)
    if (e164.isBlank()) {
      onResult(PhoneOtpStartResult.Failure("INVALID_PHONE", "Please enter a valid 10-digit Indian mobile number."))
      return
    }

    val callbacks = object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
      override fun onVerificationCompleted(credential: PhoneAuthCredential) {
        // Instant/Auto-retrieval by Play Services
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch {
          val signResult = signInOrLinkPhoneCredential(credential)
          when (signResult) {
            is PhoneOtpVerifyResult.Success -> onResult(
              PhoneOtpStartResult.InstantVerified(signResult.user, signResult.linked, signResult.previousUid)
            )
            is PhoneOtpVerifyResult.Failure -> onResult(
              PhoneOtpStartResult.Failure(signResult.code, signResult.message)
            )
          }
        }
      }

      override fun onVerificationFailed(e: FirebaseException) {
        Log.e(TAG, "Phone verification failed: ${e.message}", e)
        onResult(
          PhoneOtpStartResult.Failure(
            "OTP_SEND_FAILED",
            e.localizedMessage ?: "Unable to send OTP. Ensure Phone Auth is enabled in Firebase Console."
          )
        )
      }

      override fun onCodeSent(verificationId: String, token: PhoneAuthProvider.ForceResendingToken) {
        lastVerificationId = verificationId
        lastResendToken = token
        onResult(PhoneOtpStartResult.CodeSent(verificationId, e164))
      }
    }

    val optionsBuilder = PhoneAuthOptions.newBuilder(firebaseAuth)
      .setPhoneNumber(e164)
      .setTimeout(60L, TimeUnit.SECONDS)
      .setActivity(activity)
      .setCallbacks(callbacks)

    if (isResend && lastResendToken != null) {
      optionsBuilder.setForceResendingToken(lastResendToken!!)
    }

    PhoneAuthProvider.verifyPhoneNumber(optionsBuilder.build())
  }

  suspend fun verifyOtp(verificationId: String?, otpCode: String): PhoneOtpVerifyResult {
    val verId = verificationId?.takeIf { it.isNotBlank() } ?: lastVerificationId
    if (verId.isNullOrBlank()) {
      return PhoneOtpVerifyResult.Failure("NO_VERIFICATION_ID", "Please request an OTP first.")
    }
    val cleanOtp = otpCode.replace(Regex("[^0-9]"), "")
    if (cleanOtp.length != 6) {
      return PhoneOtpVerifyResult.Failure("INVALID_OTP", "Please enter the 6-digit OTP code.")
    }

    return try {
      val credential = PhoneAuthProvider.getCredential(verId, cleanOtp)
      signInOrLinkPhoneCredential(credential)
    } catch (e: Exception) {
      PhoneOtpVerifyResult.Failure("VERIFY_ERROR", e.localizedMessage ?: "Invalid or expired OTP.")
    }
  }

  private suspend fun signInOrLinkPhoneCredential(credential: PhoneAuthCredential): PhoneOtpVerifyResult {
    val firebaseAuth = auth
      ?: return PhoneOtpVerifyResult.Failure("AUTH_UNAVAILABLE", "Firebase Auth is not initialized.")

    val existingUser = firebaseAuth.currentUser
    val prevUid = existingUser?.uid

    if (existingUser != null) {
      val alreadyHasPhone = !existingUser.phoneNumber.isNullOrBlank()
      if (!alreadyHasPhone) {
        try {
          val linkedResult = existingUser.linkWithCredential(credential).await()
          val linkedUser = linkedResult.user ?: existingUser
          return PhoneOtpVerifyResult.Success(user = linkedUser, linked = true, previousUid = null)
        } catch (collision: FirebaseAuthUserCollisionException) {
          Log.w(TAG, "Phone already belongs to another Firebase account; signing into existing phone account", collision)
          val fallbackResult = firebaseAuth.signInWithCredential(credential).await()
          val signedInUser = fallbackResult.user
            ?: return PhoneOtpVerifyResult.Failure("NULL_USER", "Phone sign-in returned null user.")
          return PhoneOtpVerifyResult.Success(
            user = signedInUser,
            linked = false,
            previousUid = prevUid,
            collisionWarning = "This mobile number was already linked to another Nutrolix account; switched to your phone account."
          )
        } catch (e: Exception) {
          Log.e(TAG, "Link phone credential error", e)
          return PhoneOtpVerifyResult.Failure("LINK_FAILED", e.localizedMessage ?: "Failed to link mobile number.")
        }
      }
    }

    return try {
      val authResult = firebaseAuth.signInWithCredential(credential).await()
      val user = authResult.user
        ?: return PhoneOtpVerifyResult.Failure("NULL_USER", "Firebase Auth returned null user.")
      PhoneOtpVerifyResult.Success(user = user, linked = false, previousUid = prevUid)
    } catch (e: Exception) {
      Log.e(TAG, "Sign-in with phone credential failed", e)
      PhoneOtpVerifyResult.Failure("INVALID_OTP", e.localizedMessage ?: "Incorrect or expired OTP.")
    }
  }
}
