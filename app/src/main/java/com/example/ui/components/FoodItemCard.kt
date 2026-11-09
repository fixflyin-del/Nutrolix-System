package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
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
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.example.model.MealItem
import com.example.ui.theme.*

@Composable
fun FoodItemCard(
  meal: MealItem,
  quantityInCart: Int,
  onCardClick: () -> Unit,
  onAddClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  Card(
    modifier = modifier
      .fillMaxWidth()
      .clickable(onClick = onCardClick)
      .testTag("meal_card_${meal.id}"),
    shape = RoundedCornerShape(16.dp),
    colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
  ) {
    Column(modifier = Modifier.fillMaxWidth().padding(14.dp)) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(14.dp)
      ) {
        // Left Column: Details & Macros
        Column(modifier = Modifier.weight(1f)) {
          // Dietary Badge & Bestseller / New Tag
          Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
          ) {
            VegNonVegBadge(isVeg = meal.isVeg)

            if (meal.isBestseller) {
              Surface(
                shape = RoundedCornerShape(4.dp),
                color = NutrolixOrangeLight
              ) {
                Text(
                  text = "★ BESTSELLER",
                  fontSize = 9.sp,
                  fontWeight = FontWeight.Bold,
                  color = NutrolixOrangeDark,
                  modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
              }
            } else if (meal.isNew) {
              Surface(
                shape = RoundedCornerShape(4.dp),
                color = NutrolixLightGreen
              ) {
                Text(
                  text = "NEW LAUNCH",
                  fontSize = 9.sp,
                  fontWeight = FontWeight.Bold,
                  color = NutrolixDarkGreen,
                  modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
              }
            }
          }

          Spacer(modifier = Modifier.height(6.dp))

          // Meal Title
          Text(
            text = meal.name,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = NutrolixTextPrimary,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
          )

          Spacer(modifier = Modifier.height(4.dp))

          // Verified Health Tag
          Surface(
            shape = RoundedCornerShape(4.dp),
            color = NutrolixLightGreen.copy(alpha = 0.7f)
          ) {
            Text(
              text = meal.verifiedHealthTag,
              fontSize = 11.sp,
              fontWeight = FontWeight.SemiBold,
              color = NutrolixDarkGreen,
              modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
            )
          }

          Spacer(modifier = Modifier.height(6.dp))

          // Description
          Text(
            text = meal.description,
            fontSize = 12.sp,
            color = NutrolixTextSecondary,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            lineHeight = 16.sp
          )

          Spacer(modifier = Modifier.height(8.dp))

          // Price & Rating
          Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
          ) {
            Text(
              text = "₹${meal.discountedPrice.toInt()}",
              fontSize = 16.sp,
              fontWeight = FontWeight.ExtraBold,
              color = NutrolixTextPrimary
            )
            if (meal.discountedPrice < meal.price) {
              Text(
                text = "₹${meal.price.toInt()}",
                fontSize = 13.sp,
                textDecoration = TextDecoration.LineThrough,
                color = NutrolixTextSecondary
              )
            }

            // Rating
            Row(
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(2.dp)
            ) {
              Icon(
                imageVector = Icons.Default.Star,
                contentDescription = null,
                tint = NutrolixGold,
                modifier = Modifier.size(14.dp)
              )
              Text(
                text = "${meal.rating}",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = NutrolixTextPrimary
              )
              Text(
                text = "(${meal.reviewCount})",
                fontSize = 10.sp,
                color = NutrolixTextSecondary
              )
            }
          }
        }

        // Right Column: Food Image & Add Button
        Box(
          modifier = Modifier
            .width(115.dp)
            .height(130.dp),
          contentAlignment = Alignment.TopCenter
        ) {
          // Food Image
          AsyncImage(
            model = ImageRequest.Builder(LocalContext.current)
              .data(meal.imageUrl)
              .crossfade(true)
              .build(),
            contentDescription = meal.name,
            contentScale = ContentScale.Crop,
            modifier = Modifier
              .size(115.dp, 105.dp)
              .clip(RoundedCornerShape(12.dp))
              .background(NutrolixSurfaceVariant)
          )

          // Add / Customize Button positioned overlapping at bottom
          Surface(
            onClick = onAddClick,
            shape = RoundedCornerShape(8.dp),
            color = Color.White,
            shadowElevation = 3.dp,
            modifier = Modifier
              .align(Alignment.BottomCenter)
              .height(34.dp)
              .width(96.dp)
              .testTag("add_meal_${meal.id}")
          ) {
            Box(
              contentAlignment = Alignment.Center,
              modifier = Modifier.fillMaxSize()
            ) {
              if (quantityInCart > 0) {
                Text(
                  text = "ADDED ($quantityInCart)",
                  fontSize = 12.sp,
                  fontWeight = FontWeight.ExtraBold,
                  color = NutrolixPrimaryGreen
                )
              } else {
                Row(
                  verticalAlignment = Alignment.CenterVertically,
                  horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                  Text(
                    text = "ADD",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = NutrolixPrimaryGreen
                  )
                  Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "Add to Cart",
                    tint = NutrolixPrimaryGreen,
                    modifier = Modifier.size(16.dp)
                  )
                }
              }
            }
          }
        }
      }

      Spacer(modifier = Modifier.height(10.dp))

      // Macro Nutrient Gauge Pill Row
      MacroNutrientRow(
        protein = meal.proteinGrams,
        carbs = meal.carbsGrams,
        fats = meal.fatsGrams,
        fiber = meal.fiberGrams,
        calories = meal.calories
      )
    }
  }
}
