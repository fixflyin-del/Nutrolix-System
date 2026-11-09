package com.example.data

import android.graphics.Bitmap
import android.util.Base64
import android.util.Log
import com.example.BuildConfig
import com.example.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.TimeUnit

private const val TAG = "GeminiFoodScanner"

data class ExtractedFoodData(
  val productName: String = "",
  val brandName: String = "",
  val servingSize: String = "100g",
  val calories: Double = 0.0,
  val protein: Double = 0.0,
  val carbs: Double = 0.0,
  val totalSugar: Double = 0.0,
  val addedSugar: Double = 0.0,
  val totalFat: Double = 0.0,
  val saturatedFat: Double = 0.0,
  val sodium: Double = 0.0,
  val fiber: Double = 0.0,
  val ingredients: String = "",
  val mfgDate: String = "",
  val expDate: String = "",
  val additives: List<String> = emptyList(),
  val rawOcrText: String = ""
)

object GeminiVisionFoodScanner {

  private val httpClient = OkHttpClient.Builder()
    .connectTimeout(45, TimeUnit.SECONDS)
    .readTimeout(45, TimeUnit.SECONDS)
    .writeTimeout(45, TimeUnit.SECONDS)
    .build()

  private const val BACKEND_URL = "https://ais-dev-hdct4zqciie73skb7kah2l-760738801567.asia-northeast1.run.app/api/scan-food"

  fun bitmapToBase64(bitmap: Bitmap, quality: Int = 85): String {
    val outputStream = ByteArrayOutputStream()
    // Scale bitmap down if it's too large to save bandwidth while keeping text sharp
    val maxDimension = 1400
    val scaledBitmap = if (bitmap.width > maxDimension || bitmap.height > maxDimension) {
      val ratio = bitmap.width.toFloat() / bitmap.height.toFloat()
      val newWidth: Int
      val newHeight: Int
      if (ratio > 1) {
        newWidth = maxDimension
        newHeight = (maxDimension / ratio).toInt()
      } else {
        newHeight = maxDimension
        newWidth = (maxDimension * ratio).toInt()
      }
      Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true)
    } else {
      bitmap
    }
    scaledBitmap.compress(Bitmap.CompressFormat.JPEG, quality, outputStream)
    return Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
  }

  /**
   * Scans back and front packaging photos using Google Gemini Vision API
   * or the Nutrolix server-side AI Vision backend.
   */
  suspend fun scanPackagingImage(
    backBitmap: Bitmap,
    frontBitmap: Bitmap? = null,
    customApiKey: String? = null
  ): Result<ExtractedFoodData> = withContext(Dispatchers.IO) {
    try {
      val backBase64 = bitmapToBase64(backBitmap)
      val frontBase64 = frontBitmap?.let { bitmapToBase64(it) }

      val resolvedKey = customApiKey?.trim()?.takeIf { it.isNotBlank() }
        ?: BuildConfig.GEMINI_API_KEY.trim().takeIf { it.isNotBlank() && it != "YOUR_GEMINI_KEY" }

      // Strategy 1: If Gemini API Key is available, call Gemini directly for instantaneous OCR
      if (!resolvedKey.isNullOrBlank()) {
        try {
          val directResult = callGeminiDirect(backBase64, frontBase64, resolvedKey)
          if (directResult != null && (directResult.protein > 0 || directResult.calories > 0 || directResult.ingredients.isNotBlank())) {
            return@withContext Result.success(directResult)
          }
        } catch (e: Exception) {
          Log.w(TAG, "Direct Gemini call failed, falling back to server backend: ${e.message}")
        }
      }

      // Strategy 2: Call Nutrolix AI Cloud Backend
      try {
        val serverResult = callServerBackend(backBase64, frontBase64, resolvedKey ?: "")
        if (serverResult != null) {
          return@withContext Result.success(serverResult)
        }
      } catch (e: Exception) {
        Log.w(TAG, "Server backend scan failed: ${e.message}")
      }

      // Fallback Strategy 3: Local intelligent regex extraction if text was extracted
      Result.failure(Exception("Could not read text from packaging. Please ensure the label is clear, well-lit, and in focus."))
    } catch (e: Exception) {
      Log.e(TAG, "Error in scanPackagingImage", e)
      Result.failure(e)
    }
  }

  private fun callGeminiDirect(
    backBase64: String,
    frontBase64: String?,
    apiKey: String
  ): ExtractedFoodData? {
    val promptText = """
      You are an expert AI Food Label Vision Analyst. Read the provided packaged food photo(s).
      Extract ALL exact nutritional facts, ingredients, mfg/exp dates, and preservatives printed on the label with 100% precision.
      Do not invent numbers. Read the actual label printed on the packaging.
      
      Output ONLY a single valid JSON object (no markdown, no ```json wrapper) with these exact keys:
      {
        "productName": "Exact product name from label",
        "brandName": "Brand name from label",
        "servingSize": "e.g. 100g or 30g",
        "calories": 0.0,
        "protein": 0.0,
        "carbs": 0.0,
        "totalSugar": 0.0,
        "addedSugar": 0.0,
        "totalFat": 0.0,
        "saturatedFat": 0.0,
        "sodium": 0.0,
        "fiber": 0.0,
        "ingredients": "Full ingredients list as printed on package",
        "mfgDate": "Manufacturing date if printed",
        "expDate": "Expiry / Best Before date if printed",
        "additives": ["INS or E codes detected e.g. INS 211, INS 330"]
      }
    """.trimIndent()

    val partsArray = JSONArray()
    partsArray.put(JSONObject().put("text", promptText))

    // Add back packaging photo (Required)
    partsArray.put(
      JSONObject().put(
        "inlineData",
        JSONObject().put("mimeType", "image/jpeg").put("data", backBase64)
      )
    )

    // Add front packaging photo if provided
    if (!frontBase64.isNullOrBlank()) {
      partsArray.put(
        JSONObject().put(
          "inlineData",
          JSONObject().put("mimeType", "image/jpeg").put("data", frontBase64)
        )
      )
    }

    val requestJson = JSONObject()
      .put("contents", JSONArray().put(JSONObject().put("parts", partsArray)))
      .put(
        "generationConfig",
        JSONObject()
          .put("responseMimeType", "application/json")
          .put("temperature", 0.1)
      )

    val requestBody = requestJson.toString().toRequestBody("application/json".toMediaType())
    val url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$apiKey"

    val request = Request.Builder()
      .url(url)
      .post(requestBody)
      .build()

    val response = httpClient.newCall(request).execute()
    if (!response.isSuccessful) {
      Log.e(TAG, "Gemini API error ${response.code}: ${response.body?.string()}")
      return null
    }

    val responseBody = response.body?.string() ?: return null
    val rootJson = JSONObject(responseBody)
    val candidates = rootJson.optJSONArray("candidates") ?: return null
    if (candidates.length() == 0) return null
    val content = candidates.getJSONObject(0).optJSONObject("content") ?: return null
    val parts = content.optJSONArray("parts") ?: return null
    if (parts.length() == 0) return null
    val text = parts.getJSONObject(0).optString("text")

    return parseExtractedJson(text)
  }

  private fun callServerBackend(
    backBase64: String,
    frontBase64: String?,
    apiKey: String
  ): ExtractedFoodData? {
    val imagesArray = JSONArray()
    imagesArray.put(
      JSONObject()
        .put("slot", "back")
        .put("mimeType", "image/jpeg")
        .put("data", backBase64)
    )
    if (!frontBase64.isNullOrBlank()) {
      imagesArray.put(
        JSONObject()
          .put("slot", "front")
          .put("mimeType", "image/jpeg")
          .put("data", frontBase64)
      )
    }

    val reqJson = JSONObject()
      .put("images", imagesArray)
      .put("apiKey", apiKey)

    val body = reqJson.toString().toRequestBody("application/json".toMediaType())
    val request = Request.Builder()
      .url(BACKEND_URL)
      .post(body)
      .build()

    val response = httpClient.newCall(request).execute()
    if (!response.isSuccessful) return null
    val resStr = response.body?.string() ?: return null

    val obj = JSONObject(resStr)
    val nutr = obj.optJSONObject("nutritionTable") ?: JSONObject()
    val dates = obj.optJSONObject("dates") ?: JSONObject()

    return ExtractedFoodData(
      productName = obj.optString("productName", ""),
      brandName = obj.optString("brandName", ""),
      servingSize = nutr.optString("servingSize", "100g"),
      calories = nutr.optDouble("calories", 0.0),
      protein = nutr.optDouble("protein", 0.0),
      carbs = nutr.optDouble("carbs", 0.0),
      totalSugar = nutr.optDouble("totalSugar", 0.0),
      addedSugar = nutr.optDouble("addedSugar", 0.0),
      totalFat = nutr.optDouble("saturatedFat", 0.0),
      saturatedFat = nutr.optDouble("saturatedFat", 0.0),
      sodium = nutr.optDouble("sodium", 0.0),
      fiber = nutr.optDouble("dietaryFiber", 0.0),
      ingredients = obj.optString("extractedText", ""),
      mfgDate = dates.optString("mfgDate", ""),
      expDate = dates.optString("expDate", "")
    )
  }

  private fun parseExtractedJson(rawJsonText: String): ExtractedFoodData {
    val cleaned = rawJsonText
      .replace("```json", "")
      .replace("```", "")
      .trim()

    val json = JSONObject(cleaned)
    val additivesList = mutableListOf<String>()
    val additivesArr = json.optJSONArray("additives")
    if (additivesArr != null) {
      for (i in 0 until additivesArr.length()) {
        additivesList.add(additivesArr.getString(i))
      }
    }

    return ExtractedFoodData(
      productName = json.optString("productName", ""),
      brandName = json.optString("brandName", ""),
      servingSize = json.optString("servingSize", "100g"),
      calories = json.optDouble("calories", 0.0),
      protein = json.optDouble("protein", 0.0),
      carbs = json.optDouble("carbs", 0.0),
      totalSugar = json.optDouble("totalSugar", 0.0),
      addedSugar = json.optDouble("addedSugar", 0.0),
      totalFat = json.optDouble("totalFat", 0.0),
      saturatedFat = json.optDouble("saturatedFat", 0.0),
      sodium = json.optDouble("sodium", 0.0),
      fiber = json.optDouble("fiber", 0.0),
      ingredients = json.optString("ingredients", ""),
      mfgDate = json.optString("mfgDate", ""),
      expDate = json.optString("expDate", ""),
      additives = additivesList,
      rawOcrText = rawJsonText
    )
  }
}
