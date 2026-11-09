package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.Order
import com.example.model.OrderStatus
import com.example.ui.theme.*

import androidx.compose.material3.pulltorefresh.PullToRefreshBox

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveOrderTrackingScreen(
  order: Order?,
  isRefreshing: Boolean = false,
  onRefresh: () -> Unit = {},
  onBackToHome: () -> Unit,
  onSubmitRating: (Int, String) -> Unit,
  modifier: Modifier = Modifier
) {
  var selectedStar by remember { mutableStateOf(5) }
  var reviewText by remember { mutableStateOf("") }
  var ratingSubmittedLocally by remember { mutableStateOf(false) }

  if (order == null) {
    Box(
      modifier = modifier
        .fillMaxSize()
        .background(NutrolixBackground),
      contentAlignment = Alignment.Center
    ) {
      Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = "📦", fontSize = 48.sp)
        Spacer(modifier = Modifier.height(12.dp))
        Text(
          text = "No active order in progress",
          fontSize = 16.sp,
          fontWeight = FontWeight.Bold,
          color = NutrolixTextPrimary
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(
          onClick = onBackToHome,
          colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen)
        ) {
          Text("Go to Nutrolix Menu")
        }
      }
    }
  } else {
    PullToRefreshBox(
      isRefreshing = isRefreshing,
      onRefresh = onRefresh,
      modifier = modifier.fillMaxSize().background(NutrolixBackground)
    ) {
      LazyColumn(
        modifier = Modifier
          .fillMaxSize()
          .testTag("live_order_tracking_screen"),
        contentPadding = PaddingValues(bottom = 120.dp)
      ) {
        // 1. Top Header
        item {
          Surface(
            color = NutrolixSurface,
            shadowElevation = 2.dp,
            modifier = Modifier.fillMaxWidth()
          ) {
            Row(
              modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.SpaceBetween
            ) {
              Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
              ) {
                IconButton(
                  onClick = onBackToHome,
                  modifier = Modifier.background(NutrolixSurfaceVariant, CircleShape)
                ) {
                  Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = NutrolixDarkGreen)
                }
                Column {
                  Text(
                    text = "Order ${order.orderNumber}",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = NutrolixTextPrimary
                  )
                  Text(
                    text = "Nutrolix Kitchen • Fresh Delivery",
                    fontSize = 11.sp,
                    color = NutrolixTextSecondary
                  )
                }
              }

              Surface(
                shape = RoundedCornerShape(10.dp),
                color = NutrolixLightGreen
              ) {
                Text(
                  text = order.status.title,
                  fontSize = 11.sp,
                  fontWeight = FontWeight.Bold,
                  color = NutrolixDarkGreen,
                  modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                )
              }
            }
          }
        }

        // 2. Status Banner & Estimated Time
        item {
          Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Card(
              shape = RoundedCornerShape(16.dp),
              colors = CardDefaults.cardColors(containerColor = NutrolixForestGreen),
              modifier = Modifier.fillMaxWidth()
            ) {
              Column(modifier = Modifier.padding(18.dp)) {
                Row(
                  modifier = Modifier.fillMaxWidth(),
                  horizontalArrangement = Arrangement.SpaceBetween,
                  verticalAlignment = Alignment.CenterVertically
                ) {
                  Column {
                    Text(
                      text = if (order.status == OrderStatus.DELIVERED) "Order Delivered! 🎉" else "Estimated Delivery: ~${order.estimatedDeliveryMinutes} Mins",
                      fontSize = 16.sp,
                      fontWeight = FontWeight.ExtraBold,
                      color = Color.White
                    )
                    Text(
                      text = order.status.subtitle,
                      fontSize = 12.sp,
                      color = NutrolixLightGreen
                    )
                  }

                  // Live Order Status Indicator (Requirement 8: No unnecessary OTP after order confirmation)
                  Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = NutrolixPrimaryGreen
                  ) {
                    Row(
                      modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                      verticalAlignment = Alignment.CenterVertically,
                      horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                      Box(
                        modifier = Modifier
                          .size(8.dp)
                          .background(Color.White, CircleShape)
                      )
                      Text(
                        text = "CONFIRMED",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                      )
                    }
                  }
                }
              }
            }
          }
        }

        // 3. Simple 4-Stage Stepper Timeline
        item {
          Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
          ) {
            Column(modifier = Modifier.padding(16.dp)) {
              Text(
                text = "Order Progress",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = NutrolixTextPrimary
              )

              Spacer(modifier = Modifier.height(14.dp))

              val stages = listOf(
                OrderStatus.PLACED,
                OrderStatus.PREPARING,
                OrderStatus.READY,
                OrderStatus.OUT_FOR_DELIVERY,
                OrderStatus.DELIVERED
              )
              val currentStepIndex = order.status.stepIndex

              stages.forEachIndexed { index, status ->
                val isCompleted = status.stepIndex <= currentStepIndex
                val isCurrent = status.stepIndex == currentStepIndex

                Row(
                  modifier = Modifier.fillMaxWidth(),
                  horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                  // Timeline Node & Line
                  Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.width(24.dp)
                  ) {
                    Box(
                      modifier = Modifier
                        .size(22.dp)
                        .background(
                          color = when {
                            isCurrent -> NutrolixOrange
                            isCompleted -> NutrolixPrimaryGreen
                            else -> NutrolixBorder
                          },
                          shape = CircleShape
                        ),
                      contentAlignment = Alignment.Center
                    ) {
                      if (isCompleted && !isCurrent) {
                        Icon(
                          imageVector = Icons.Default.Check,
                          contentDescription = null,
                          tint = Color.White,
                          modifier = Modifier.size(14.dp)
                        )
                      } else if (isCurrent) {
                        Box(
                          modifier = Modifier
                            .size(8.dp)
                            .background(Color.White, CircleShape)
                        )
                      }
                    }

                    if (index < stages.size - 1) {
                      Box(
                        modifier = Modifier
                          .width(2.dp)
                          .height(30.dp)
                          .background(if (status.stepIndex < currentStepIndex) NutrolixPrimaryGreen else NutrolixBorder)
                      )
                    }
                  }

                  // Label
                  Column(modifier = Modifier.padding(bottom = 14.dp)) {
                    Text(
                      text = status.title,
                      fontSize = 13.sp,
                      fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Medium,
                      color = if (isCurrent) NutrolixOrangeDark else if (isCompleted) NutrolixTextPrimary else NutrolixTextSecondary
                    )
                    Text(
                      text = status.subtitle,
                      fontSize = 11.sp,
                      color = NutrolixTextSecondary
                    )
                  }
                }
              }
            }
          }
        }

        // 4. Order Summary & Items
        item {
          Spacer(modifier = Modifier.height(14.dp))
          Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
          ) {
            Column(modifier = Modifier.padding(16.dp)) {
              Text(
                text = "Order Details",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = NutrolixTextPrimary
              )
              Spacer(modifier = Modifier.height(10.dp))

              order.items.forEach { item ->
                Row(
                  modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                  horizontalArrangement = Arrangement.SpaceBetween,
                  verticalAlignment = Alignment.CenterVertically
                ) {
                  Column(modifier = Modifier.weight(1f)) {
                    Text(
                      text = "${item.quantity}x ${item.meal.name}",
                      fontSize = 13.sp,
                      fontWeight = FontWeight.Bold,
                      color = NutrolixTextPrimary
                    )
                    if (item.selectedAddons.isNotEmpty()) {
                      Text(
                        text = "+ " + item.selectedAddons.joinToString { it.name },
                        fontSize = 11.sp,
                        color = NutrolixPrimaryGreen
                      )
                    }
                  }
                  Text(
                    text = "₹${item.totalPrice.toInt()}",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = NutrolixTextPrimary
                  )
                }
              }

              HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp), color = NutrolixBorder)

              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
              ) {
                Text(text = "Total Paid (${order.paymentMethod})", fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                Text(text = "₹${order.total.toInt()}", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = NutrolixOrangeDark)
              }

              Spacer(modifier = Modifier.height(8.dp))
              Text(
                text = "Delivery to: ${order.deliveryAddress}",
                fontSize = 11.sp,
                color = NutrolixTextSecondary
              )
            }
          }
        }

        // 5. Post-Delivery Feedback Card
        if (order.status == OrderStatus.DELIVERED) {
          item {
            Spacer(modifier = Modifier.height(14.dp))
            Card(
              shape = RoundedCornerShape(16.dp),
              colors = CardDefaults.cardColors(containerColor = NutrolixLightGreen),
              modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
            ) {
              Column(modifier = Modifier.padding(16.dp)) {
                Text(
                  text = "How was your healthy meal?",
                  fontSize = 15.sp,
                  fontWeight = FontWeight.Bold,
                  color = NutrolixDarkGreen
                )
                Text(
                  text = "Your rating helps our kitchen chefs maintain peak nutrition",
                  fontSize = 11.sp,
                  color = NutrolixTextSecondary
                )

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                  modifier = Modifier.fillMaxWidth(),
                  horizontalArrangement = Arrangement.Center
                ) {
                  (1..5).forEach { star ->
                    IconButton(onClick = { selectedStar = star }) {
                      Icon(
                        imageVector = Icons.Default.Star,
                        contentDescription = "$star stars",
                        tint = if (star <= selectedStar) NutrolixGold else Color.Gray.copy(alpha = 0.4f),
                        modifier = Modifier.size(30.dp)
                      )
                    }
                  }
                }

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                  value = reviewText,
                  onValueChange = { reviewText = it },
                  placeholder = { Text("Share feedback on taste, fresh ingredients & macros...", fontSize = 12.sp) },
                  modifier = Modifier.fillMaxWidth(),
                  shape = RoundedCornerShape(10.dp)
                )

                Spacer(modifier = Modifier.height(10.dp))

                Button(
                  onClick = {
                    onSubmitRating(selectedStar, reviewText)
                    ratingSubmittedLocally = true
                  },
                  colors = ButtonDefaults.buttonColors(containerColor = NutrolixDarkGreen),
                  modifier = Modifier.fillMaxWidth(),
                  shape = RoundedCornerShape(10.dp)
                ) {
                  Text(if (ratingSubmittedLocally) "Thank You! Review Submitted" else "Submit Rating & Review")
                }
              }
            }
          }
        }
      }
    }
  }
}
