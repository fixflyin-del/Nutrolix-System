package com.example

import androidx.test.core.app.ApplicationProvider
import com.example.base.FirestoreEmulatorTestBase
import com.example.data.FirestoreService
import com.google.firebase.firestore.FirebaseFirestoreException
import java.util.UUID
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class NutrolixFirestoreRuleTest : FirestoreEmulatorTestBase() {

  @Test
  fun customerProfileAndAddress_ownerWritesAndReads_succeed() = runBlocking {
    val uid = signInTestUser(ALICE_EMAIL)
    val service = FirestoreService(ApplicationProvider.getApplicationContext(), firestore)

    withTimeout(DEFAULT_TIMEOUT_MS) {
      service.syncMergedProfile(
        uid = uid,
        name = "Alice Test",
        email = ALICE_EMAIL,
        verifiedPhone = "+919876543210",
        whatsappNumber = "+919876543210",
        providers = listOf("phone", "google.com")
      )
    }

    val addrId = "addr_${UUID.randomUUID().toString().take(8)}"
    withTimeout(DEFAULT_TIMEOUT_MS) {
      service.syncAddress(
        uid = uid,
        addressId = addrId,
        addressData = mapOf(
          "address1" to "Sector 17 Vashi",
          "city" to "Navi Mumbai",
          "pincode" to "400703",
          "lat" to 19.076,
          "lon" to 72.998,
          "locationSource" to "gps_google_maps"
        )
      )
    }

    val profileSnap = withTimeout(DEFAULT_TIMEOUT_MS) {
      firestore.collection("users").document(uid).get().await()
    }
    assertTrue("Expected owner profile to exist", profileSnap.exists())
    assertEquals("+919876543210", profileSnap.getString("verifiedPhone"))

    val addrSnap = withTimeout(DEFAULT_TIMEOUT_MS) {
      firestore.collection("users").document(uid).collection("addresses").document(addrId).get().await()
    }
    assertTrue("Expected saved address to exist", addrSnap.exists())
    assertEquals("400703", addrSnap.getString("pincode"))
  }

  @Test
  fun fcmToken_ownerWriteAndList_succeeds() = runBlocking {
    val uid = signInTestUser(ALICE_EMAIL)
    val service = FirestoreService(ApplicationProvider.getApplicationContext(), firestore)
    val token = "fcm_kotlin_emulator_token_${UUID.randomUUID()}"

    withTimeout(DEFAULT_TIMEOUT_MS) {
      service.saveFcmToken(
        uid = uid,
        token = token,
        phone = "9876543210",
        email = ALICE_EMAIL,
        platform = "android-apk"
      )
    }

    val tokensSnap = withTimeout(DEFAULT_TIMEOUT_MS) {
      firestore.collection("users").document(uid).collection("fcmTokens").get().await()
    }
    assertTrue("Expected owner FCM token to be saved", !tokensSnap.isEmpty)
  }

  @Test
  fun orderCreateAndQuery_ownerOnly_crossUserAndUnauthDenied() = runBlocking {
    val aliceUid = signInTestUser(ALICE_EMAIL)
    val orderId = "ORD-${UUID.randomUUID().toString().take(8)}"

    withTimeout(DEFAULT_TIMEOUT_MS) {
      firestore.collection("orders").document(orderId).set(
        mapOf(
          "id" to orderId,
          "orderId" to orderId,
          "uid" to aliceUid,
          "customerName" to "Alice Test",
          "customerPhone" to "+919876543210",
          "whatsappNumber" to "+919876543210",
          "status" to "Order Placed",
          "items" to listOf(mapOf("title" to "Protein Atta", "quantity" to 1, "price" to 349.0)),
          "total" to 349.0,
          "grandTotal" to 349.0
        )
      ).await()
    }

    val ownerOrders = withTimeout(DEFAULT_TIMEOUT_MS) {
      firestore.collection("orders").whereEqualTo("uid", aliceUid).get().await()
    }
    assertTrue("Owner should read own order", ownerOrders.documents.any { it.id == orderId })

    // Cross-user read must fail with PERMISSION_DENIED
    signInTestUser(BOB_EMAIL)
    try {
      withTimeout(DEFAULT_TIMEOUT_MS) {
        firestore.collection("orders").document(orderId).get().await()
      }
      fail("Expected PERMISSION_DENIED when Bob reads Alice's order")
    } catch (e: Exception) {
      val fsEx = e.unwrapFirestoreException()
      assertEquals(FirebaseFirestoreException.Code.PERMISSION_DENIED, fsEx?.code)
    }

    // Unauthenticated read must fail with PERMISSION_DENIED
    auth.signOut()
    try {
      withTimeout(DEFAULT_TIMEOUT_MS) {
        firestore.collection("orders").whereEqualTo("uid", aliceUid).get().await()
      }
      fail("Expected PERMISSION_DENIED for unauthenticated order query")
    } catch (e: Exception) {
      val fsEx = e.unwrapFirestoreException()
      assertEquals(FirebaseFirestoreException.Code.PERMISSION_DENIED, fsEx?.code)
    }
  }

  @Test
  fun crossUserProfileAndPublicCatalogWrite_failsWithPermissionDenied() = runBlocking {
    val aliceUid = signInTestUser(ALICE_EMAIL)
    signInTestUser(BOB_EMAIL)

    try {
      withTimeout(DEFAULT_TIMEOUT_MS) {
        firestore.collection("users").document(aliceUid).get().await()
      }
      fail("Expected PERMISSION_DENIED when Bob reads Alice's profile")
    } catch (e: Exception) {
      val fsEx = e.unwrapFirestoreException()
      assertEquals(FirebaseFirestoreException.Code.PERMISSION_DENIED, fsEx?.code)
    }

    try {
      withTimeout(DEFAULT_TIMEOUT_MS) {
        firestore.collection("products").document("prod_unauth_write").set(
          mapOf("id" to "prod_unauth_write", "title" to "Tampered", "price" to 1.0)
        ).await()
      }
      fail("Expected PERMISSION_DENIED when non-admin writes catalog product")
    } catch (e: Exception) {
      val fsEx = e.unwrapFirestoreException()
      assertEquals(FirebaseFirestoreException.Code.PERMISSION_DENIED, fsEx?.code)
    }
  }

  private companion object {
    const val ALICE_EMAIL = "alice_nutrolix@test.com"
    const val BOB_EMAIL = "bob_nutrolix@test.com"
    const val DEFAULT_TIMEOUT_MS = 5000L
  }
}
