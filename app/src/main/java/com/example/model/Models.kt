package com.example.model

enum class UserRole(val label: String, val badge: String) {
  CUSTOMER("Customer App", "Nutrolix Store"),
  ADMIN("Admin Console", "Store Control")
}

data class FoodCategory(
  val id: String,
  val title: String,
  val subtitle: String,
  val iconEmoji: String,
  val imageUrl: String
)

data class AddonOption(
  val id: String,
  val name: String,
  val price: Double,
  val extraProteinGrams: Int = 0,
  val extraCalories: Int = 0
)

data class PortionSize(
  val name: String,
  val priceDelta: Double,
  val multiplier: Double = 1.0,
  val description: String = ""
)

data class MealItem(
  val id: String,
  val name: String,
  val description: String,
  val categoryId: String,
  val price: Double,
  val discountedPrice: Double,
  val imageUrl: String,
  val isVeg: Boolean,
  val isVegan: Boolean = false,
  val proteinGrams: Int,
  val carbsGrams: Int = 30,
  val fatsGrams: Int = 10,
  val fiberGrams: Int = 8,
  val calories: Int,
  val verifiedHealthTag: String = "Clean Healthy Nutrition",
  val ingredients: List<String> = emptyList(),
  val allergens: List<String> = emptyList(),
  val portionSizes: List<PortionSize> = listOf(
    PortionSize("Regular", 0.0, 1.0, "Standard single serve"),
    PortionSize("Pro Protein (+50% bowl)", 89.0, 1.5, "Extra protein & seeds")
  ),
  val availableAddons: List<AddonOption> = emptyList(),
  val prepTimeMinutes: Int = 18,
  val rating: Double = 4.8,
  val reviewCount: Int = 142,
  val isBestseller: Boolean = false,
  val isNew: Boolean = false,
  val isAvailable: Boolean = true
) {
  val singleLineNutritionSummary: String
    get() = "⚡ ${proteinGrams}g Protein • ${calories} kcal • ${carbsGrams}g Carbs • ${fiberGrams}g Fiber"
}

data class CartItem(
  val cartItemId: String,
  val meal: MealItem,
  val selectedPortion: PortionSize,
  val selectedAddons: List<AddonOption> = emptyList(),
  val quantity: Int = 1,
  val cookingInstruction: String = ""
) {
  val unitPrice: Double
    get() = (meal.discountedPrice + selectedPortion.priceDelta + selectedAddons.sumOf { it.price })

  val totalPrice: Double
    get() = unitPrice * quantity

  val totalProtein: Int
    get() = ((meal.proteinGrams * selectedPortion.multiplier) + selectedAddons.sumOf { it.extraProteinGrams }).toInt() * quantity

  val totalCalories: Int
    get() = ((meal.calories * selectedPortion.multiplier) + selectedAddons.sumOf { it.extraCalories }).toInt() * quantity
}

enum class OrderStatus(val title: String, val subtitle: String, val stepIndex: Int) {
  PENDING("Pending Confirmation", "Awaiting confirmation from kitchen", 0),
  PLACED("Order Placed", "Your order has been received by Nutrolix", 1),
  CONFIRMED("Confirmed", "Nutrolix kitchen accepted your order", 1),
  PREPARING("Preparing Food", "Nutritious meal is being cooked fresh", 2),
  READY("Order Ready", "Meal packed and waiting for dispatch", 3),
  OUT_FOR_DELIVERY("Out for Delivery", "Our delivery partner is heading to your doorstep", 4),
  DELIVERED("Delivered", "Delivered safely! Enjoy your healthy nutrition", 5),
  CANCELLED("Cancelled", "Order was cancelled", 0)
}

data class OrderStatusHistoryItem(
  val status: OrderStatus,
  val timestampMillis: Long,
  val note: String = ""
)

data class ProductReview(
  val id: String = java.util.UUID.randomUUID().toString(),
  val mealId: String,
  val mealName: String,
  val orderId: String,
  val orderNumber: String,
  val customerPhone: String,
  val customerName: String,
  val rating: Int, // 1 to 5 stars
  val reviewText: String = "",
  val timestampMillis: Long = System.currentTimeMillis()
)

data class Order(
  val id: String,
  val orderNumber: String,
  val customerPhone: String,
  val customerName: String,
  val customerEmail: String = "",
  val items: List<CartItem>,
  val subtotal: Double,
  val discount: Double,
  val deliveryFee: Double,
  val tax: Double,
  val packagingFee: Double = 0.0,
  val tip: Double,
  val total: Double,
  val status: OrderStatus,
  val paymentMethod: String,
  val paymentStatus: String,
  val orderTimeMillis: Long,
  val estimatedDeliveryMinutes: Int = 25,
  val deliveryAddress: String,
  val deliveryOtp: String = "",
  val specialInstructions: String = "",
  val ratingSubmitted: Int? = null,
  val reviewText: String? = null,
  val statusHistory: List<OrderStatusHistoryItem> = emptyList(),
  val cancellationReason: String? = null,
  val refundStatus: String = "Not Applicable", // "Not Applicable", "Not Initiated", "Processing", "Refunded"
  val refundAmount: Double? = null,
  val refundTransactionId: String? = null,
  val customerOrderCount: Int = 1
)

data class PromoBanner(
  val id: String,
  val title: String,
  val subtitle: String,
  val badge: String = "SPECIAL",
  val imageUrl: String,
  val discountCode: String = "",
  val isActive: Boolean = true
)

data class StoreSettings(
  val storeName: String = "Nutrolix",
  val tagline: String = "Nutrition That Works",
  val isOpen: Boolean = true,
  val deliveryFee: Double = 29.0, // Standard delivery charge of ₹29 prominently displayed
  val freeDeliveryAbove: Double = 199.0, // Admin-configurable threshold (e.g. ₹199 or ₹299)
  val announcement: String = "⚡ 100% Fresh Healthy Meals • Delivered in 25 mins",
  val payuEnabled: Boolean = true,
  val payuIsLive: Boolean = true,
  val payuMerchantKey: String = "",
  val payuMerchantSalt: String = ""
)

enum class DiscountType(val label: String) {
  PERCENTAGE("% Percentage Discount"),
  FIXED_AMOUNT("₹ Fixed Amount")
}

data class Coupon(
  val code: String,
  val title: String,
  val discountAmount: Double, // Compatibility with existing code
  val minOrder: Double = 199.0,
  val description: String = "",
  val discountType: DiscountType = DiscountType.FIXED_AMOUNT,
  val discountValue: Double = discountAmount,
  val maxDiscount: Double = 150.0,
  val isAutoApplied: Boolean = false,
  val isActive: Boolean = true
) {
  fun calculateDiscount(subtotal: Double): Double {
    if (subtotal < minOrder || !isActive) return 0.0
    val disc = when (discountType) {
      DiscountType.PERCENTAGE -> (subtotal * (discountValue / 100.0)).coerceAtMost(maxDiscount)
      DiscountType.FIXED_AMOUNT -> discountValue
    }
    return disc.coerceAtMost(subtotal)
  }
}

data class UserProfile(
  val phone: String = "",
  val name: String = "",
  val email: String = "",
  val savedAddresses: List<String> = emptyList(),
  val currentAddress: String = "",
  val isVerified: Boolean = false,
  val isLoggedIn: Boolean = false
)

data class CustomerAccount(
  val phone: String,
  val name: String,
  val pinHash: String,
  val salt: String,
  val savedAddresses: List<String> = emptyList(),
  val createdAtMillis: Long = System.currentTimeMillis()
)

data class AdminSession(
  val isAuthenticated: Boolean = false,
  val adminEmail: String = "",
  val authenticatedAtMillis: Long = 0L
)

// -------------------------------------------------------------
// AI FOOD QUALITY SCANNER MODELS
// -------------------------------------------------------------
data class NutritionTableData(
  val servingSize: String = "100g",
  val calories: Double = 0.0,
  val protein: Double = 0.0,
  val carbs: Double = 0.0,
  val totalSugar: Double = 0.0,
  val addedSugar: Double = 0.0,
  val saturatedFat: Double = 0.0,
  val transFat: Double = 0.0,
  val sodium: Double = 0.0,
  val dietaryFiber: Double = 0.0
)

data class ScoreBreakdownData(
  val nutrition: Int = 70,
  val ingredientQuality: Int = 70,
  val sugarFatProfile: Int = 70,
  val additives: Int = 85,
  val completeness: Int = 80
)

data class GoodIngredientItem(
  val name: String = "",
  val benefit: String = ""
)

data class AttentionIngredientItem(
  val name: String = "",
  val reason: String = ""
)

data class AdditiveInfo(
  val code: String = "",
  val name: String = "",
  val function: String = "",
  val safetyNote: String = "",
  val risk: String = "Low"
)

data class DateAnalysisData(
  val mfgDate: String? = null,
  val expDate: String? = null,
  val bestBefore: String? = null,
  val isExpired: Boolean = false,
  val isNearExpiry: Boolean = false,
  val statusText: String = "Verified",
  val warning: String? = null
)

data class TopBenefitData(
  val title: String = "Clean Balanced Nutritional Profile",
  val description: String = "Balanced macronutrient distribution supporting steady energy without sharp insulin crashes."
)

data class FoodScanReport(
  val id: String = java.util.UUID.randomUUID().toString(),
  val productName: String = "Packaged Food",
  val brandName: String = "Brand",
  val overallScore: Int = 75,
  val topBenefit: TopBenefitData = TopBenefitData(),
  val scoreBreakdown: ScoreBreakdownData = ScoreBreakdownData(),
  val processingLevel: String = "Processed",
  val recommendation: String = "Good Choice",
  val recommendationRationale: String = "",
  val nutritionTable: NutritionTableData = NutritionTableData(),
  val goodIngredients: List<GoodIngredientItem> = emptyList(),
  val attentionIngredients: List<AttentionIngredientItem> = emptyList(),
  val additivesAndPreservatives: List<AdditiveInfo> = emptyList(),
  val dates: DateAnalysisData = DateAnalysisData(),
  val missingOrUncertainInfo: List<String> = emptyList(),
  val scoringExplanation: String = "",
  val audioScriptEn: String = "",
  val audioScriptHi: String = "",
  val timestampMillis: Long = System.currentTimeMillis()
)
