package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
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
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.example.model.Order
import com.example.ui.theme.*

@Composable
fun OrderReviewDialog(
  order: Order,
  onDismiss: () -> Unit,
  onSubmitReview: (mealId: String, mealName: String, rating: Int, reviewText: String) -> Unit,
  onAllCompleted: () -> Unit
) {
  // Map of mealId -> Pair(rating, comment)
  val reviewStates = remember(order.id) {
    mutableStateMapOf<String, Pair<Int, String>>().apply {
      order.items.forEach { item ->
        put(item.meal.id, Pair(5, ""))
      }
    }
  }

  var isSubmitting by remember { mutableStateOf(false) }

  Dialog(
    onDismissRequest = onDismiss,
    properties = DialogProperties(usePlatformDefaultWidth = false)
  ) {
    Surface(
      modifier = Modifier
        .fillMaxWidth(0.92f)
        .fillMaxHeight(0.85f)
        .testTag("order_review_dialog"),
      shape = RoundedCornerShape(20.dp),
      color = NutrolixBackground
    ) {
      Column(modifier = Modifier.fillMaxSize()) {
        // Header
        Surface(
          color = NutrolixSurface,
          shadowElevation = 2.dp,
          modifier = Modifier.fillMaxWidth()
        ) {
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
          ) {
            Column {
              Text(
                text = "Rate Your Nutrolix Meal ⭐",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = NutrolixDarkGreen
              )
              Text(
                text = "Order #${order.orderNumber} • Delivered",
                fontSize = 11.sp,
                color = NutrolixTextSecondary
              )
            }

            IconButton(
              onClick = onDismiss,
              modifier = Modifier.background(NutrolixSurfaceVariant, CircleShape)
            ) {
              Icon(Icons.Default.Close, contentDescription = "Close", tint = NutrolixDarkGreen)
            }
          }
        }

        // Body: Review each item in the order
        LazyColumn(
          modifier = Modifier
            .weight(1f)
            .fillMaxWidth(),
          contentPadding = PaddingValues(16.dp),
          verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
          item {
            Text(
              text = "How was your clean eating experience? Your verified review helps other healthy eaters choose the best meals.",
              fontSize = 12.sp,
              color = NutrolixTextSecondary,
              lineHeight = 16.sp
            )
          }

          itemsIndexed(order.items) { index, item ->
            val currentState = reviewStates[item.meal.id] ?: Pair(5, "")
            val selectedStars = currentState.first
            val reviewComment = currentState.second

            Card(
              shape = RoundedCornerShape(14.dp),
              colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
              border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder),
              modifier = Modifier.fillMaxWidth()
            ) {
              Column(modifier = Modifier.padding(14.dp)) {
                // Product details row
                Row(
                  modifier = Modifier.fillMaxWidth(),
                  horizontalArrangement = Arrangement.spacedBy(10.dp),
                  verticalAlignment = Alignment.CenterVertically
                ) {
                  if (item.meal.imageUrl.isNotBlank()) {
                    AsyncImage(
                      model = ImageRequest.Builder(LocalContext.current)
                        .data(item.meal.imageUrl)
                        .crossfade(true)
                        .build(),
                      contentDescription = item.meal.name,
                      contentScale = ContentScale.Crop,
                      modifier = Modifier
                        .size(46.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(NutrolixSurfaceVariant)
                    )
                  } else {
                    Box(
                      modifier = Modifier
                        .size(46.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(NutrolixSurfaceVariant),
                      contentAlignment = Alignment.Center
                    ) {
                      Text("🥗", fontSize = 20.sp)
                    }
                  }

                  Column(modifier = Modifier.weight(1f)) {
                    Text(
                      text = item.meal.name,
                      fontSize = 13.sp,
                      fontWeight = FontWeight.Bold,
                      color = NutrolixTextPrimary
                    )
                    Text(
                      text = "${item.selectedPortion.name} • ${item.meal.proteinGrams}g Protein",
                      fontSize = 11.sp,
                      color = NutrolixPrimaryGreen
                    )
                  }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Star Rating Selector (1 to 5)
                Row(
                  modifier = Modifier.fillMaxWidth(),
                  horizontalArrangement = Arrangement.Center,
                  verticalAlignment = Alignment.CenterVertically
                ) {
                  (1..5).forEach { star ->
                    IconButton(
                      onClick = {
                        reviewStates[item.meal.id] = Pair(star, reviewComment)
                      },
                      modifier = Modifier.size(40.dp)
                    ) {
                      Icon(
                        imageVector = if (star <= selectedStars) Icons.Filled.Star else Icons.Outlined.Star,
                        contentDescription = "$star Stars",
                        tint = if (star <= selectedStars) NutrolixGold else NutrolixBorder,
                        modifier = Modifier.size(28.dp)
                      )
                    }
                  }
                }

                Text(
                  text = when (selectedStars) {
                    5 -> "⭐⭐⭐⭐⭐ Outstanding Taste & Nutrition"
                    4 -> "⭐⭐⭐⭐ Very Good"
                    3 -> "⭐⭐⭐ Average"
                    2 -> "⭐⭐ Needs Improvement"
                    else -> "⭐ Disappointed"
                  },
                  fontSize = 11.sp,
                  fontWeight = FontWeight.SemiBold,
                  color = NutrolixDarkGreen,
                  modifier = Modifier.align(Alignment.CenterHorizontally)
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Optional Review Text Field
                OutlinedTextField(
                  value = reviewComment,
                  onValueChange = { newTxt ->
                    reviewStates[item.meal.id] = Pair(selectedStars, newTxt)
                  },
                  placeholder = {
                    Text("Write an optional review (flavor, freshness, portion size...)", fontSize = 12.sp)
                  },
                  shape = RoundedCornerShape(10.dp),
                  colors = nutrolixTextFieldColors(),
                  modifier = Modifier.fillMaxWidth().height(80.dp),
                  maxLines = 3
                )
              }
            }
          }
        }

        // Bottom Actions
        Surface(
          color = NutrolixSurface,
          shadowElevation = 6.dp,
          modifier = Modifier.fillMaxWidth()
        ) {
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
          ) {
            OutlinedButton(
              onClick = onDismiss,
              shape = RoundedCornerShape(10.dp),
              modifier = Modifier.weight(1f).height(44.dp)
            ) {
              Text("Review Later", fontSize = 12.sp, color = NutrolixTextSecondary)
            }

            Button(
              onClick = {
                isSubmitting = true
                order.items.forEach { itm ->
                  val state = reviewStates[itm.meal.id] ?: Pair(5, "")
                  onSubmitReview(itm.meal.id, itm.meal.name, state.first, state.second)
                }
                onAllCompleted()
                onDismiss()
              },
              shape = RoundedCornerShape(10.dp),
              colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
              modifier = Modifier.weight(1.5f).height(44.dp).testTag("submit_review_button")
            ) {
              Text("Submit Reviews", fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
          }
        }
      }
    }
  }
}
