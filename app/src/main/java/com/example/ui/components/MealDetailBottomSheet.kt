package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddShoppingCart
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.example.model.AddonOption
import com.example.model.MealItem
import com.example.model.PortionSize
import com.example.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MealDetailBottomSheet(
  meal: MealItem,
  selectedPortion: PortionSize?,
  selectedAddons: Set<AddonOption>,
  reviews: List<com.example.model.ProductReview> = emptyList(),
  onPortionSelect: (PortionSize) -> Unit,
  onAddonToggle: (AddonOption) -> Unit,
  onAddToCart: () -> Unit,
  onDismiss: () -> Unit,
  modifier: Modifier = Modifier
) {
  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    containerColor = NutrolixSurface,
    shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
    modifier = modifier.testTag("meal_detail_sheet")
  ) {
    val portion = selectedPortion ?: meal.portionSizes.first()
    val currentPrice = meal.discountedPrice + portion.priceDelta + selectedAddons.sumOf { it.price }
    val totalProtein = ((meal.proteinGrams * portion.multiplier) + selectedAddons.sumOf { it.extraProteinGrams }).toInt()
    val totalCalories = ((meal.calories * portion.multiplier) + selectedAddons.sumOf { it.extraCalories }).toInt()

    Column(
      modifier = Modifier
        .fillMaxWidth()
        .fillMaxHeight(0.92f)
    ) {
      // Top Header & Close button
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 20.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          VegNonVegBadge(isVeg = meal.isVeg)
          Surface(
            shape = RoundedCornerShape(6.dp),
            color = NutrolixLightGreen
          ) {
            Text(
              text = meal.verifiedHealthTag,
              fontSize = 12.sp,
              fontWeight = FontWeight.Bold,
              color = NutrolixDarkGreen,
              modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
            )
          }
        }

        IconButton(
          onClick = onDismiss,
          modifier = Modifier.background(NutrolixSurfaceVariant, CircleShape)
        ) {
          Icon(Icons.Default.Close, contentDescription = "Close", tint = NutrolixDarkGreen)
        }
      }

      // Scrollable content area
      Column(
        modifier = Modifier
          .weight(1f)
          .verticalScroll(rememberScrollState())
          .padding(horizontal = 20.dp)
      ) {
        // Meal Image
        AsyncImage(
          model = ImageRequest.Builder(LocalContext.current)
            .data(meal.imageUrl)
            .crossfade(true)
            .build(),
          contentDescription = meal.name,
          contentScale = ContentScale.Crop,
          modifier = Modifier
            .fillMaxWidth()
            .height(180.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(NutrolixSurfaceVariant)
        )

        Spacer(modifier = Modifier.height(14.dp))

        // Name & Rating
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Text(
            text = meal.name,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = NutrolixTextPrimary,
            modifier = Modifier.weight(1f)
          )

          Surface(
            shape = RoundedCornerShape(8.dp),
            color = NutrolixGoldBg,
            border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixGold.copy(alpha = 0.5f))
          ) {
            Row(
              modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp),
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(3.dp)
            ) {
              Icon(Icons.Default.Star, contentDescription = null, tint = NutrolixGold, modifier = Modifier.size(13.dp))
              Text("${meal.rating}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
            }
          }
        }

        Spacer(modifier = Modifier.height(6.dp))

        Text(
          text = meal.description,
          fontSize = 12.sp,
          color = NutrolixTextSecondary,
          lineHeight = 17.sp
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Requirement 3: Prominent High-Visibility Quick Add Bar Right Near Price & Macros
        Surface(
          shape = RoundedCornerShape(12.dp),
          color = NutrolixLightGreen,
          border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixPrimaryGreen.copy(alpha = 0.3f)),
          modifier = Modifier.fillMaxWidth()
        ) {
          Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Column {
              Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                  text = "₹${currentPrice.toInt()}",
                  fontSize = 20.sp,
                  fontWeight = FontWeight.ExtraBold,
                  color = NutrolixDarkGreen
                )
                if (meal.price > meal.discountedPrice) {
                  Text(
                    text = "₹${(meal.price + portion.priceDelta).toInt()}",
                    fontSize = 13.sp,
                    color = NutrolixTextSecondary,
                    style = androidx.compose.ui.text.TextStyle(textDecoration = androidx.compose.ui.text.style.TextDecoration.LineThrough)
                  )
                }
              }
              Text(
                text = "⚡ ${totalProtein}g Protein • ${totalCalories} kcal",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = NutrolixPrimaryGreen
              )
            }

            Button(
              onClick = onAddToCart,
              colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
              shape = RoundedCornerShape(10.dp),
              contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
              modifier = Modifier.testTag("quick_add_to_cart_button")
            ) {
              Icon(Icons.Default.AddShoppingCart, contentDescription = null, modifier = Modifier.size(16.dp))
              Spacer(modifier = Modifier.width(6.dp))
              Text("Add to Cart", fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
          }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Verified Macro Nutrition Dashboard Card
        Card(
          shape = RoundedCornerShape(14.dp),
          colors = CardDefaults.cardColors(containerColor = NutrolixSurfaceVariant),
          modifier = Modifier.fillMaxWidth()
        ) {
          Column(modifier = Modifier.padding(12.dp)) {
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.CenterVertically
            ) {
              Text(
                text = "VERIFIED NUTRITION FACTS",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = NutrolixDarkGreen,
                letterSpacing = 0.5.sp
              )
              Text(
                text = "FSSAI Compliant",
                fontSize = 10.sp,
                color = NutrolixTextSecondary
              )
            }

            Spacer(modifier = Modifier.height(10.dp))

            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.SpaceAround
            ) {
              NutritionMetric(label = "Protein", value = "${totalProtein}g", color = ProteinColor)
              NutritionMetric(label = "Carbs", value = "${meal.carbsGrams}g", color = CarbsColor)
              NutritionMetric(label = "Fats", value = "${meal.fatsGrams}g", color = FatsColor)
              NutritionMetric(label = "Fiber", value = "${meal.fiberGrams}g", color = FiberColor)
              NutritionMetric(label = "Calories", value = "$totalCalories", color = CalorieBadgeColor)
            }
          }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Portion Size Selection
        Text(
          text = "Select Portion Size",
          fontSize = 14.sp,
          fontWeight = FontWeight.Bold,
          color = NutrolixTextPrimary
        )

        Spacer(modifier = Modifier.height(8.dp))

        meal.portionSizes.forEach { p ->
          val isSelected = portion.name == p.name
          Surface(
            onClick = { onPortionSelect(p) },
            shape = RoundedCornerShape(10.dp),
            color = if (isSelected) NutrolixLightGreen else NutrolixSurface,
            border = androidx.compose.foundation.BorderStroke(
              width = if (isSelected) 1.5.dp else 1.dp,
              color = if (isSelected) NutrolixPrimaryGreen else NutrolixBorder
            ),
            modifier = Modifier
              .fillMaxWidth()
              .padding(vertical = 4.dp)
          ) {
            Row(
              modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.CenterVertically
            ) {
              Column {
                Text(
                  text = p.name,
                  fontSize = 13.sp,
                  fontWeight = FontWeight.Bold,
                  color = if (isSelected) NutrolixDarkGreen else NutrolixTextPrimary
                )
                if (p.description.isNotEmpty()) {
                  Text(text = p.description, fontSize = 11.sp, color = NutrolixTextSecondary)
                }
              }

              Text(
                text = if (p.priceDelta == 0.0) "Included" else "+₹${p.priceDelta.toInt()}",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = if (isSelected) NutrolixPrimaryGreen else NutrolixTextSecondary
              )
            }
          }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Healthy Addons Selection
        if (meal.availableAddons.isNotEmpty()) {
          Text(
            text = "Healthy Add-ons (Optional)",
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = NutrolixTextPrimary
          )

          Spacer(modifier = Modifier.height(8.dp))

          meal.availableAddons.forEach { addon ->
            val isChecked = selectedAddons.contains(addon)
            Surface(
              onClick = { onAddonToggle(addon) },
              shape = RoundedCornerShape(10.dp),
              color = if (isChecked) NutrolixLightGreen else NutrolixSurface,
              border = androidx.compose.foundation.BorderStroke(
                width = if (isChecked) 1.5.dp else 1.dp,
                color = if (isChecked) NutrolixPrimaryGreen else NutrolixBorder
              ),
              modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp)
            ) {
              Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
              ) {
                Row(
                  verticalAlignment = Alignment.CenterVertically,
                  horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                  Checkbox(
                    checked = isChecked,
                    onCheckedChange = { onAddonToggle(addon) },
                    colors = CheckboxDefaults.colors(checkedColor = NutrolixPrimaryGreen)
                  )
                  Column {
                    Text(
                      text = addon.name,
                      fontSize = 12.sp,
                      fontWeight = FontWeight.Bold,
                      color = NutrolixTextPrimary
                    )
                    Text(
                      text = "+${addon.extraProteinGrams}g Protein • ${addon.extraCalories} kcal",
                      fontSize = 10.sp,
                      color = NutrolixPrimaryGreen
                    )
                  }
                }

                Text(
                  text = "+₹${addon.price.toInt()}",
                  fontSize = 12.sp,
                  fontWeight = FontWeight.Bold,
                  color = NutrolixDarkGreen
                )
              }
            }
          }
        }

        Spacer(modifier = Modifier.height(18.dp))

        // -------------------------------------------------------------
        // CUSTOMER RATINGS & REVIEWS SECTION
        // -------------------------------------------------------------
        Card(
          shape = RoundedCornerShape(14.dp),
          colors = CardDefaults.cardColors(containerColor = NutrolixSurfaceVariant.copy(alpha = 0.6f)),
          border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder),
          modifier = Modifier.fillMaxWidth()
        ) {
          Column(modifier = Modifier.padding(14.dp)) {
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.CenterVertically
            ) {
              Column {
                Text(
                  text = "Customer Ratings & Reviews",
                  fontSize = 14.sp,
                  fontWeight = FontWeight.Bold,
                  color = NutrolixDarkGreen
                )
                Text(
                  text = "Based on verified delivered orders",
                  fontSize = 11.sp,
                  color = NutrolixTextSecondary
                )
              }

              Surface(
                shape = RoundedCornerShape(8.dp),
                color = NutrolixGoldBg,
                border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixGold.copy(alpha = 0.5f))
              ) {
                Row(
                  modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                  verticalAlignment = Alignment.CenterVertically,
                  horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                  Icon(Icons.Default.Star, contentDescription = null, tint = NutrolixGold, modifier = Modifier.size(14.dp))
                  Text(
                    text = "${meal.rating}",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = NutrolixDarkGreen
                  )
                  Text(
                    text = "(${meal.reviewCount})",
                    fontSize = 10.sp,
                    color = NutrolixTextSecondary
                  )
                }
              }
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (reviews.isEmpty()) {
              Box(
                modifier = Modifier
                  .fillMaxWidth()
                  .padding(vertical = 8.dp),
                contentAlignment = Alignment.Center
              ) {
                Text(
                  text = "Be the first to review this healthy meal after placing your order!",
                  fontSize = 11.sp,
                  color = NutrolixTextSecondary,
                  textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
              }
            } else {
              val reviewDateFormat = java.text.SimpleDateFormat("dd MMM yyyy", java.util.Locale.getDefault())
              Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                reviews.forEach { rev ->
                  Card(
                    shape = RoundedCornerShape(10.dp),
                    colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
                    border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder)
                  ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                      Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                      ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                          Box(
                            modifier = Modifier
                              .size(24.dp)
                              .background(NutrolixPrimaryGreen, CircleShape),
                            contentAlignment = Alignment.Center
                          ) {
                            Text(
                              text = rev.customerName.take(1).uppercase(),
                              fontSize = 11.sp,
                              fontWeight = FontWeight.Bold,
                              color = Color.White
                            )
                          }
                          Column {
                            Text(rev.customerName, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                            Text("Verified Eater", fontSize = 9.sp, color = NutrolixPrimaryGreen)
                          }
                        }

                        Column(horizontalAlignment = Alignment.End) {
                          Row(horizontalArrangement = Arrangement.spacedBy(1.dp)) {
                            repeat(rev.rating) {
                              Icon(Icons.Default.Star, contentDescription = null, tint = NutrolixGold, modifier = Modifier.size(12.dp))
                            }
                          }
                          Text(
                            text = reviewDateFormat.format(java.util.Date(rev.timestampMillis)),
                            fontSize = 9.sp,
                            color = NutrolixTextSecondary
                          )
                        }
                      }

                      if (rev.reviewText.isNotBlank()) {
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                          text = "\"${rev.reviewText}\"",
                          fontSize = 11.sp,
                          color = NutrolixTextPrimary,
                          lineHeight = 15.sp
                        )
                      }
                    }
                  }
                }
              }
            }
          }
        }

        Spacer(modifier = Modifier.height(16.dp))
      }

      // Compact Sticky Bottom Action Bar (ALWAYS visible without scrolling!)
      Surface(
        color = NutrolixSurface,
        shadowElevation = 8.dp,
        border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder),
        modifier = Modifier.fillMaxWidth()
      ) {
        Row(
          modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 12.dp),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Column {
            Text(
              text = "₹${currentPrice.toInt()}",
              fontSize = 20.sp,
              fontWeight = FontWeight.ExtraBold,
              color = NutrolixDarkGreen
            )
            Text(
              text = "Serving: ${portion.name}",
              fontSize = 11.sp,
              color = NutrolixTextSecondary
            )
          }

          Button(
            onClick = onAddToCart,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
            modifier = Modifier
              .height(48.dp)
              .testTag("confirm_add_to_cart")
          ) {
            Row(
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
              Icon(Icons.Default.AddShoppingCart, contentDescription = null, modifier = Modifier.size(18.dp))
              Text("Add to Cart", fontSize = 14.sp, fontWeight = FontWeight.Bold)
            }
          }
        }
      }
    }
  }
}

@Composable
fun NutritionMetric(
  label: String,
  value: String,
  color: Color,
  modifier: Modifier = Modifier
) {
  Column(
    horizontalAlignment = Alignment.CenterHorizontally,
    modifier = modifier
  ) {
    Text(
      text = value,
      fontSize = 15.sp,
      fontWeight = FontWeight.ExtraBold,
      color = color
    )
    Text(
      text = label,
      fontSize = 10.sp,
      fontWeight = FontWeight.Medium,
      color = NutrolixTextSecondary
    )
  }
}
