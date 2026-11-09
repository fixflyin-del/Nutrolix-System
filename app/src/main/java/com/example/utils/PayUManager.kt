package com.example.utils

import java.net.URLEncoder
import java.security.MessageDigest

/**
 * PayU India Payment Gateway Manager
 * Handles SHA-512 cryptographic hash generation, URL encoding,
 * live/test endpoint resolution, and response verification.
 */
object PayUManager {

  const val PAYU_LIVE_URL = "https://secure.payu.in/_payment"
  const val PAYU_TEST_URL = "https://test.payu.in/_payment"

  const val DEFAULT_SANDBOX_KEY = "gtKFFx"
  const val DEFAULT_SANDBOX_SALT = "eCwWELxi"

  const val DEFAULT_SUCCESS_URL = "https://nutrolix.in/payment/success"
  const val DEFAULT_FAILURE_URL = "https://nutrolix.in/payment/failure"

  /**
   * Generates official SHA-512 transaction hash required by PayU India:
   * sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
   */
  fun generatePaymentHash(
    key: String,
    txnId: String,
    amount: String,
    productInfo: String,
    firstName: String,
    email: String,
    salt: String
  ): String {
    val cleanAmount = try {
      String.format(java.util.Locale.US, "%.2f", amount.toDouble())
    } catch (_: Exception) {
      amount
    }
    val cleanFirstName = firstName.trim().ifEmpty { "Customer" }
    val cleanEmail = email.trim().ifEmpty { "orders@nutrolix.in" }
    val cleanProduct = productInfo.trim().ifEmpty { "Nutrolix Order" }

    val rawSequence = "$key|$txnId|$cleanAmount|$cleanProduct|$cleanFirstName|$cleanEmail|||||||||||$salt"
    return sha512(rawSequence)
  }

  /**
   * Verifies reverse hash received upon return from PayU:
   * sha512(salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
   */
  fun verifyResponseHash(
    salt: String,
    status: String,
    email: String,
    firstName: String,
    productInfo: String,
    amount: String,
    txnId: String,
    key: String,
    receivedHash: String
  ): Boolean {
    val cleanAmount = try {
      String.format(java.util.Locale.US, "%.2f", amount.toDouble())
    } catch (_: Exception) {
      amount
    }
    val rawSequence = "$salt|$status|||||||||||$email|$firstName|$productInfo|$cleanAmount|$txnId|$key"
    val computedHash = sha512(rawSequence)
    return computedHash.equals(receivedHash, ignoreCase = true)
  }

  /**
   * Encodes key-value map into application/x-www-form-urlencoded byte array for WebView.postUrl()
   */
  fun buildPostData(params: Map<String, String>): ByteArray {
    val postString = params.entries.joinToString("&") { (k, v) ->
      "${URLEncoder.encode(k, "UTF-8")}=${URLEncoder.encode(v, "UTF-8")}"
    }
    return postString.toByteArray(Charsets.UTF_8)
  }

  private fun sha512(input: String): String {
    val md = MessageDigest.getInstance("SHA-512")
    val digest = md.digest(input.toByteArray(Charsets.UTF_8))
    return digest.joinToString("") { "%02x".format(it) }
  }
}
