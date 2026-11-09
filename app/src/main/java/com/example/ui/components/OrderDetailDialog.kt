package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
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
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.example.model.Order
import com.example.model.OrderStatus
import com.example.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun OrderDetailDialog(
  order: Order,
  onDismiss: () -> Unit,
  onRateOrder: (Order) -> Unit,
  onTrackOrder: (Order) -> Unit,
  onReorder: (Order) -> Unit
) {
  val dateFormat = SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault())
  val orderDateStr = dateFormat.format(Date(order.orderTimeMillis))

  Dialog(
    onDismissRequest = onDismiss,
    properties = DialogProperties(usePlatformDefaultWidth = false)
  ) {
    Surface(
      modifier = Modifier
        .fillMaxWidth(0.95f)
        .fillMaxHeight(0.92f)
        .testTag("order_detail_dialog"),
      shape = RoundedCornerShape(20.dp),
      color = NutrolixBackground
    ) {
      Column(modifier = Modifier.fillMaxSize()) {
        // Top Header
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
              Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                  text = "Order ${order.orderNumber}",
                  fontSize = 17.sp,
                  fontWeight = FontWeight.Bold,
                  color = NutrolixTextPrimary
                )
                Surface(
                  shape = RoundedCornerShape(6.dp),
                  color = when (order.status) {
                    OrderStatus.DELIVERED -> NutrolixLightGreen
                    OrderStatus.CANCELLED -> Color(0xFFFFEBEE)
                    OrderStatus.OUT_FOR_DELIVERY -> NutrolixOrangeLight
                    else -> NutrolixSurfaceVariant
                  }
                ) {
                  Text(
                    text = order.status.title,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = when (order.status) {
                      OrderStatus.DELIVERED -> NutrolixDarkGreen
                      OrderStatus.CANCELLED -> StatusDanger
                      OrderStatus.OUT_FOR_DELIVERY -> NutrolixOrangeDark
                      else -> NutrolixDarkGreen
                    },
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp)
                  )
                }
              }
              Text(
                text = "Placed: $orderDateStr",
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

        // Scrollable Body
        LazyColumn(
          modifier = Modifier
            .weight(1f)
            .fillMaxWidth(),
          contentPadding = PaddingValues(16.dp),
          verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
          // 1. Cancellation & Refund Banner (if Cancelled)
          if (order.status == OrderStatus.CANCELLED) {
            item {
              Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF3F3)),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFFCDD2))
              ) {
                Column(modifier = Modifier.padding(14.dp)) {
                  Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                  ) {
                    Icon(Icons.Default.Cancel, contentDescription = null, tint = StatusDanger, modifier = Modifier.size(20.dp))
                    Text("Order Cancelled", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = StatusDanger)
                  }

                  val reason = order.cancellationReason ?: "Cancelled as per kitchen / customer request."
                  Text(
                    text = "Reason: $reason",
                    fontSize = 12.sp,
                    color = NutrolixTextPrimary,
                    modifier = Modifier.padding(top = 4.dp, bottom = 8.dp)
                  )

                  HorizontalDivider(color = Color(0xFFFFCDD2))
                  Spacer(modifier = Modifier.height(8.dp))

                  // Refund Information
                  Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                  ) {
                    Text("Refund Status:", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = NutrolixTextSecondary)
                    Surface(
                      shape = RoundedCornerShape(6.dp),
                      color = when (order.refundStatus) {
                        "Refunded" -> NutrolixLightGreen
                        "Processing" -> NutrolixOrangeLight
                        else -> NutrolixSurfaceVariant
                      }
                    ) {
                      Text(
                        text = order.refundStatus,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = when (order.refundStatus) {
                          "Refunded" -> NutrolixDarkGreen
                          "Processing" -> NutrolixOrangeDark
                          else -> NutrolixTextSecondary
                        },
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                      )
                    }
                  }

                  if (order.refundAmount != null && order.refundAmount > 0) {
                    Row(
                      modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                      horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                      Text("Refund Amount:", fontSize = 12.sp, color = NutrolixTextSecondary)
                      Text("₹${order.refundAmount.toInt()}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NutrolixDarkGreen)
                    }
                  }

                  if (!order.refundTransactionId.isNullOrBlank()) {
                    Row(
                      modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                      horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                      Text("Refund Ref / Txn ID:", fontSize = 11.sp, color = NutrolixTextSecondary)
                      Text(order.refundTransactionId, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                    }
                  }
                }
              }
            }
          }

          // 2. Order Status History Log
          item {
            Card(
              shape = RoundedCornerShape(14.dp),
              colors = CardDefaults.cardColors(containerColor = NutrolixSurface)
            ) {
              Column(modifier = Modifier.padding(14.dp)) {
                Text("Order Status Journey", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                Spacer(modifier = Modifier.height(10.dp))

                if (order.statusHistory.isNotEmpty()) {
                  order.statusHistory.forEachIndexed { idx, hist ->
                    val timeStr = dateFormat.format(Date(hist.timestampMillis))
                    Row(
                      modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                      verticalAlignment = Alignment.Top,
                      horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                      Icon(
                        imageVector = if (hist.status == OrderStatus.CANCELLED) Icons.Default.Cancel else Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = if (hist.status == OrderStatus.CANCELLED) StatusDanger else NutrolixPrimaryGreen,
                        modifier = Modifier.size(16.dp).padding(top = 2.dp)
                      )
                      Column(modifier = Modifier.weight(1f)) {
                        Row(
                          modifier = Modifier.fillMaxWidth(),
                          horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                          Text(hist.status.title, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                          Text(timeStr, fontSize = 10.sp, color = NutrolixTextSecondary)
                        }
                        if (hist.note.isNotBlank()) {
                          Text(hist.note, fontSize = 11.sp, color = NutrolixTextSecondary)
                        }
                      }
                    }
                    if (idx < order.statusHistory.size - 1) {
                      Box(
                        modifier = Modifier
                          .padding(start = 7.dp)
                          .width(2.dp)
                          .height(12.dp)
                          .background(NutrolixBorder)
                      )
                    }
                  }
                } else {
                  // Fallback single line
                  Text("Current Status: ${order.status.title}", fontSize = 12.sp, color = NutrolixTextSecondary)
                }
              }
            }
          }

          // 3. Purchased Items
          item {
            Card(
              shape = RoundedCornerShape(14.dp),
              colors = CardDefaults.cardColors(containerColor = NutrolixSurface)
            ) {
              Column(modifier = Modifier.padding(14.dp)) {
                Text(
                  text = "Items Ordered (${order.items.sumOf { it.quantity }})",
                  fontSize = 13.sp,
                  fontWeight = FontWeight.Bold,
                  color = NutrolixTextPrimary
                )
                Spacer(modifier = Modifier.height(10.dp))

                order.items.forEach { item ->
                  Row(
                    modifier = Modifier
                      .fillMaxWidth()
                      .padding(vertical = 6.dp),
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
                      Text(item.meal.name, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                      Text(
                        text = "Portion: ${item.selectedPortion.name} • Qty: ${item.quantity}",
                        fontSize = 11.sp,
                        color = NutrolixTextSecondary
                      )
                      if (item.selectedAddons.isNotEmpty()) {
                        Text(
                          text = "Addons: " + item.selectedAddons.joinToString { it.name },
                          fontSize = 10.sp,
                          color = NutrolixPrimaryGreen
                        )
                      }
                    }

                    Text(
                      text = "₹${item.totalPrice.toInt()}",
                      fontSize = 13.sp,
                      fontWeight = FontWeight.Bold,
                      color = NutrolixDarkGreen
                    )
                  }
                }
              }
            }
          }

          // 4. Payment & Billing Details
          item {
            Card(
              shape = RoundedCornerShape(14.dp),
              colors = CardDefaults.cardColors(containerColor = NutrolixSurface)
            ) {
              Column(modifier = Modifier.padding(14.dp)) {
                Text("Payment & Bill Breakdown", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                  modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                  horizontalArrangement = Arrangement.SpaceBetween
                ) {
                  Text("Payment Mode", fontSize = 12.sp, color = NutrolixTextSecondary)
                  Text(
                    text = if (order.paymentMethod.contains("Cash on Delivery", ignoreCase = true)) "Cash on Delivery (COD)" else "Online Payment (${order.paymentMethod})",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = NutrolixTextPrimary
                  )
                }

                Row(
                  modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                  horizontalArrangement = Arrangement.SpaceBetween
                ) {
                  Text("Payment Status", fontSize = 12.sp, color = NutrolixTextSecondary)
                  Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = if (order.paymentStatus.contains("PAID", ignoreCase = true) || order.paymentStatus.contains("SUCCESS", ignoreCase = true)) NutrolixLightGreen else Color(0xFFFFF3E0)
                  ) {
                    Text(
                      text = order.paymentStatus,
                      fontSize = 10.sp,
                      fontWeight = FontWeight.Bold,
                      color = if (order.paymentStatus.contains("PAID", ignoreCase = true) || order.paymentStatus.contains("SUCCESS", ignoreCase = true)) NutrolixDarkGreen else NutrolixOrangeDark,
                      modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                  }
                }

                Spacer(modifier = Modifier.height(6.dp))
                HorizontalDivider(color = NutrolixBorder)
                Spacer(modifier = Modifier.height(6.dp))

                Row(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                  Text("Subtotal", fontSize = 12.sp, color = NutrolixTextSecondary)
                  Text("₹${order.subtotal.toInt()}", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }
                if (order.discount > 0) {
                  Row(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Coupon Discount", fontSize = 12.sp, color = StatusSuccess)
                    Text("-₹${order.discount.toInt()}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = StatusSuccess)
                  }
                }
                Row(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                  Text("Delivery Fee", fontSize = 12.sp, color = NutrolixTextSecondary)
                  Text(if (order.deliveryFee == 0.0) "FREE" else "₹${order.deliveryFee.toInt()}", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }
                Row(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                  Text("Govt. Taxes (GST 5%)", fontSize = 12.sp, color = NutrolixTextSecondary)
                  Text("₹${order.tax.toInt()}", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }
                if (order.tip > 0) {
                  Row(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Delivery Tip", fontSize = 12.sp, color = NutrolixTextSecondary)
                    Text("₹${order.tip.toInt()}", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                  }
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 6.dp), color = NutrolixBorder)

                Row(
                  modifier = Modifier.fillMaxWidth(),
                  horizontalArrangement = Arrangement.SpaceBetween,
                  verticalAlignment = Alignment.CenterVertically
                ) {
                  Text("Total Amount Paid", fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = NutrolixTextPrimary)
                  Text("₹${order.total.toInt()}", fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = NutrolixDarkGreen)
                }
              }
            }
          }

          // 5. Delivery Address
          item {
            Card(
              shape = RoundedCornerShape(14.dp),
              colors = CardDefaults.cardColors(containerColor = NutrolixSurface)
            ) {
              Row(
                modifier = Modifier.padding(14.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
              ) {
                Icon(Icons.Default.LocationOn, contentDescription = null, tint = NutrolixPrimaryGreen, modifier = Modifier.size(20.dp))
                Column {
                  Text("Delivery Destination", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                  Text(order.deliveryAddress, fontSize = 12.sp, color = NutrolixTextSecondary, modifier = Modifier.padding(top = 2.dp))
                  if (order.specialInstructions.isNotBlank()) {
                    Text("Note: ${order.specialInstructions}", fontSize = 11.sp, color = NutrolixPrimaryGreen, modifier = Modifier.padding(top = 4.dp))
                  }
                }
              }
            }
          }

          // 6. Customer Review (if already reviewed)
          if (order.ratingSubmitted != null) {
            item {
              Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = NutrolixLightGreen.copy(alpha = 0.5f))
              ) {
                Column(modifier = Modifier.padding(14.dp)) {
                  Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Your Submitted Review", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NutrolixDarkGreen)
                    Row {
                      repeat(order.ratingSubmitted) {
                        Icon(Icons.Default.Star, contentDescription = null, tint = NutrolixGold, modifier = Modifier.size(14.dp))
                      }
                    }
                  }
                  if (!order.reviewText.isNullOrBlank()) {
                    Text(
                      text = "\"${order.reviewText}\"",
                      fontSize = 12.sp,
                      color = NutrolixDarkGreen,
                      fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                      modifier = Modifier.padding(top = 4.dp)
                    )
                  }
                }
              }
            }
          }
        }

        // Bottom Action Bar
        Surface(
          color = NutrolixSurface,
          shadowElevation = 8.dp,
          modifier = Modifier.fillMaxWidth()
        ) {
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
          ) {
            if (order.status == OrderStatus.DELIVERED && order.ratingSubmitted == null) {
              Button(
                onClick = {
                  onDismiss()
                  onRateOrder(order)
                },
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = NutrolixOrange),
                modifier = Modifier.weight(1f).height(44.dp)
              ) {
                Icon(Icons.Default.Star, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Rate & Review", fontWeight = FontWeight.Bold, fontSize = 13.sp)
              }
            } else if (order.status != OrderStatus.DELIVERED && order.status != OrderStatus.CANCELLED) {
              Button(
                onClick = {
                  onDismiss()
                  onTrackOrder(order)
                },
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
                modifier = Modifier.weight(1f).height(44.dp)
              ) {
                Icon(Icons.Default.DeliveryDining, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Track Live Order", fontWeight = FontWeight.Bold, fontSize = 13.sp)
              }
            }

            OutlinedButton(
              onClick = {
                onDismiss()
                onReorder(order)
              },
              shape = RoundedCornerShape(10.dp),
              modifier = Modifier.weight(1f).height(44.dp)
            ) {
              Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
              Spacer(modifier = Modifier.width(6.dp))
              Text("Reorder Meal", fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
          }
        }
      }
    }
  }
}
