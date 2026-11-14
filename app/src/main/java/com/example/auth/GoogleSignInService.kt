package com.example.auth

import android.content.Context
import android.util.Log
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.example.R
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.auth
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

private const val TAG = "GoogleSignInService"

sealed interface GoogleSignInResult {
  data class Success(
    val user: FirebaseUser,
    val linked: Boolean = false,
    val previousUid: String? = null,
    val collisionWarning: String? = null
  ) : GoogleSignInResult
  data class Failure(val message: String, val throwable: Throwable? = null) : GoogleSignInResult
  data object Cancelled : GoogleSignInResult
}

class GoogleSignInService(
  private val context: Context,
  private val auth: FirebaseAuth? = try {
    Firebase.auth
  } catch (e: Throwable) {
    Log.w(TAG, "FirebaseAuth not initialized (missing google-services.json): ${e.message}")
    null
  },
  private val credentialManager: CredentialManager = try {
    CredentialManager.create(context)
  } catch (e: Throwable) {
    Log.w(TAG, "CredentialManager error: ${e.message}")
    CredentialManager.create(context.applicationContext)
  }
) {

  val currentUser: FirebaseUser?
    get() = auth?.currentUser

  val authStateFlow: Flow<FirebaseUser?> = callbackFlow {
    val firebaseAuth = auth
    if (firebaseAuth != null) {
      val listener = FirebaseAuth.AuthStateListener { fa ->
        trySend(fa.currentUser)
      }
      firebaseAuth.addAuthStateListener(listener)
      awaitClose { firebaseAuth.removeAuthStateListener(listener) }
    } else {
      trySend(null)
      awaitClose { }
    }
  }

  suspend fun signIn(activityContext: Context = context): GoogleSignInResult {
    val webClientId = try {
      context.getString(R.string.default_web_client_id)
    } catch (e: Exception) {
      Log.w(TAG, "default_web_client_id not found in strings.xml", e)
      ""
    }

    if (webClientId.isBlank() || webClientId.startsWith("YOUR_WEB_CLIENT_ID")) {
      Log.w(TAG, "Google default_web_client_id is not yet provisioned.")
      return GoogleSignInResult.Failure("Google Sign-In Web Client ID not provisioned yet. Set up Firebase in AI Studio.")
    }

    return try {
      val googleIdOption = GetSignInWithGoogleOption.Builder(webClientId)
        .build()

      val request = GetCredentialRequest.Builder()
        .addCredentialOption(googleIdOption)
        .build()

      val result = credentialManager.getCredential(
        request = request,
        context = activityContext
      )

      val credential = result.credential
      val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
      val idToken = googleIdTokenCredential.idToken

      if (auth == null) {
        return GoogleSignInResult.Failure("Firebase Auth is not initialized. Please verify google-services.json.")
      }

      val firebaseCredential = GoogleAuthProvider.getCredential(idToken, null)
      val existingUser = auth.currentUser
      val prevUid = existingUser?.uid

      if (existingUser != null) {
        val alreadyHasGoogle = existingUser.providerData.any { it.providerId == GoogleAuthProvider.PROVIDER_ID }
        if (!alreadyHasGoogle) {
          try {
            val linkedResult = existingUser.linkWithCredential(firebaseCredential).await()
            val linkedUser = linkedResult.user ?: existingUser
            return GoogleSignInResult.Success(user = linkedUser, linked = true, previousUid = null)
          } catch (collision: com.google.firebase.auth.FirebaseAuthUserCollisionException) {
            Log.w(TAG, "Google account already bound to another UID; signing into Google account cleanly", collision)
            val fallbackResult = auth.signInWithCredential(firebaseCredential).await()
            val fallbackUser = fallbackResult.user
              ?: return GoogleSignInResult.Failure("Firebase Auth returned null user after collision recovery.")
            return GoogleSignInResult.Success(
              user = fallbackUser,
              linked = false,
              previousUid = prevUid,
              collisionWarning = "This Google account already existed separately; switched to your Google account."
            )
          }
        }
      }

      val authResult = auth.signInWithCredential(firebaseCredential).await()
      val user = authResult.user

      if (user != null) {
        GoogleSignInResult.Success(user = user, linked = false, previousUid = prevUid)
      } else {
        GoogleSignInResult.Failure("Firebase Auth returned null user after Google Sign-In.")
      }
    } catch (e: GetCredentialCancellationException) {
      Log.d(TAG, "User cancelled Google Sign-In")
      GoogleSignInResult.Cancelled
    } catch (e: NoCredentialException) {
      Log.e(TAG, "No Google credentials available on device", e)
      GoogleSignInResult.Failure("No Google accounts found on this device.", e)
    } catch (e: GetCredentialException) {
      Log.e(TAG, "Credential Manager failed: ${e.message}", e)
      GoogleSignInResult.Failure(e.localizedMessage ?: "Failed to retrieve Google credentials.", e)
    } catch (e: Exception) {
      Log.e(TAG, "Google Sign-In failed unexpectedly", e)
      GoogleSignInResult.Failure(e.localizedMessage ?: "Sign-in failed.", e)
    }
  }

  suspend fun signOut() {
    try {
      auth?.signOut()
      credentialManager.clearCredentialState(ClearCredentialStateRequest())
    } catch (e: Exception) {
      Log.e(TAG, "Error clearing credential state during sign out", e)
    }
  }
}
