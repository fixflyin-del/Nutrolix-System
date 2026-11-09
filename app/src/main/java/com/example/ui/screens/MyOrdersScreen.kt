package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
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
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.example.model.Order
import com.example.model.OrderStatus
import com.example.model.UserProfile
import com.example.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

import androidx.compose.material3.pulltorefresh.PullToRefreshBox

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyOrdersScreen(
  orders: List<Order>,
  userProfile: UserProfile,
  isRefreshing: Boolean = false,
  onRefresh: () -> Unit = {},
  onOrderClick: (Order) -> Unit,
  onRateOrder: (Order) -> Unit,
  onTrackOrder: (Order) -> Unit,
  onReorder: (Order) -> Unit,
  onLoginClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  val dateFormat = remember { SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault()) }

  // Filter orders strictly for logged-in customer account (never show other users' orders)
  val customerOrders = remember(orders, userProfile.phone, userProfile.email, userProfile.name, userProfile.isLoggedIn) {
    if (!userProfile.isLoggedIn) {
      emptyList()
    } else {
      orders.filter { ord ->
        (userProfile.email.isNotBlank() && ord.customerEmail.isNotBlank() && ord.customerEmail.equals(userProfile.email, ignoreCase = true)) ||
        (userProfile.phone.isNotBlank() && ord.customerPhone.isNotBlank() && ord.customerPhone == userProfile.phone) ||
        (userProfile.name.isNotBlank() && ord.customerName.isNotBlank() && ord.customerName.equals(userProfile.name, ignoreCase = true) && ord.customerEmail.isBlank() && ord.customerPhone.isBlank())
      }
    }
  }

  var selectedFilter by remember { mutableStateOf("ALL") }
  val filteredOrders = remember(customerOrders, selectedFilter) {
    when (selectedFilter) {
      "ACTIVE" -> customerOrders.filter { it.status != OrderStatus.DELIVERED && it.status != OrderStatus.CANCELLED }
      "DELIVERED" -> customerOrders.filter { it.status == OrderStatus.DELIVERED }
      "CANCELLED" -> customerOrders.filter { it.status == OrderStatus.CANCELLED }
      else -> customerOrders
    }
  }

  PullToRefreshBox(
    isRefreshing = isRefreshing,
    onRefresh = onRefresh,
    modifier = modifier.fillMaxSize().background(NutrolixBackground).testTag("my_orders_screen")
  ) {
    LazyColumn(
      modifier = Modifier.fillMaxSize(),
      contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 120.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
      // Header & Title
      item {
        Column {
          Text(
            text = "My Orders",
            fontSize = 22.sp,
            fontWeight = FontWeight.ExtraBold,
            color = NutrolixDarkGreen
          )
          Text(
            text = if (userProfile.isLoggedIn) {
              "Account: ${userProfile.name.ifBlank { userProfile.email.ifBlank { "+91 " + userProfile.phone } }}"
            } else {
              "Sign in with Google to view your personal order history"
            },
            fontSize = 12.sp,
            color = NutrolixTextSecondary
          )
        }
      }

      // Guest banner prompt if not logged in
      if (!userProfile.isLoggedIn) {
        item {
          Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = NutrolixSurfaceVariant),
            border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder)
          ) {
            Column(
              modifier = Modifier.padding(16.dp).fillMaxWidth(),
              horizontalAlignment = Alignment.CenterHorizontally,
              verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
              Box(
                modifier = Modifier.size(44.dp).background(NutrolixLightGreen, CircleShape),
                contentAlignment = Alignment.Center
              ) {
                Icon(Icons.Default.AccountCircle, contentDescription = null, tint = NutrolixDarkGreen, modifier = Modifier.size(28.dp))
              }
              Text("Sign in with Google to view your orders", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NutrolixDarkGreen)
              Text("Your past meals, active deliveries and invoices will appear here.", fontSize = 11.sp, color = NutrolixTextSecondary, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
              Button(
                onClick = onLoginClick,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
                modifier = Modifier.fillMaxWidth().height(42.dp)
              ) {
                Text("Continue with Google", fontSize = 13.sp, fontWeight = FontWeight.Bold)
              }
            }
          }
        }
      }

      // Status Filter Pills
      item {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          listOf("ALL" to "All", "ACTIVE" to "In Progress", "DELIVERED" to "Delivered", "CANCELLED" to "Cancelled").forEach { (key, label) ->
            val isSelected = selectedFilter == key
            Surface(
              onClick = { selectedFilter = key },
              shape = RoundedCornerShape(10.dp),
              color = if (isSelected) NutrolixDarkGreen else NutrolixSurface,
              border = if (isSelected) null else androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder),
              modifier = Modifier.height(34.dp)
            ) {
              Box(
                modifier = Modifier.padding(horizontal = 12.dp),
                contentAlignment = Alignment.Center
              ) {
                Text(
                  text = label,
                  fontSize = 11.sp,
                  fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                  color = if (isSelected) Color.White else NutrolixTextPrimary
                )
              }
            }
          }
        }
      }

      // Empty State
      if (filteredOrders.isEmpty()) {
        item {
          Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
            modifier = Modifier.fillMaxWidth().padding(top = 24.dp)
          ) {
            Column(
              modifier = Modifier.fillMaxWidth().padding(32.dp),
              horizontalAlignment = Alignment.CenterHorizontally
            ) {
              Text("📦", fontSize = 42.sp)
              Spacer(modifier = Modifier.height(8.dp))
              Text("No orders found", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
              Text(
                text = "When you order healthy nutrition from Nutrolix, it will appear here.",
                fontSize = 11.sp,
                color = NutrolixTextSecondary,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp)
              )
            }
          }
        }
      } else {
        items(filteredOrders, key = { it.id }) { ord ->
          val dateStr = dateFormat.format(Date(ord.orderTimeMillis))
          val isDelivered = ord.status == OrderStatus.DELIVERED
          val isCancelled = ord.status == OrderStatus.CANCELLED
          val isActive = !isDelivered && !isCancelled

          Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            modifier = Modifier
              .fillMaxWidth()
              .clickable { onOrderClick(ord) }
              .testTag("order_card_${ord.orderNumber}")
          ) {
            Column(modifier = Modifier.padding(14.dp)) {
              // Top Row: Order ID, Placed Date & Status Badge
              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
              ) {
                Column {
                  Text(
                    text = "Order #${ord.orderNumber}",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = NutrolixDarkGreen
                  )
                  Text(
                    text = dateStr,
                    fontSize = 10.sp,
                    color = NutrolixTextSecondary
                  )
                }

                Surface(
                  shape = RoundedCornerShape(8.dp),
                  color = when (ord.status) {
                    OrderStatus.DELIVERED -> NutrolixLightGreen
                    OrderStatus.CANCELLED -> Color(0xFFFFEBEE)
                    OrderStatus.OUT_FOR_DELIVERY -> NutrolixOrangeLight
                    else -> NutrolixSurfaceVariant
                  }
                ) {
                  Text(
                    text = ord.status.title,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = when (ord.status) {
                      OrderStatus.DELIVERED -> NutrolixDarkGreen
                      OrderStatus.CANCELLED -> StatusDanger
                      OrderStatus.OUT_FOR_DELIVERY -> NutrolixOrangeDark
                      else -> NutrolixDarkGreen
                    },
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                  )
                }
              }

              Spacer(modifier = Modifier.height(10.dp))
              HorizontalDivider(color = NutrolixBorder)
              Spacer(modifier = Modifier.height(10.dp))

              // Middle: Items preview
              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
              ) {
                val firstItem = ord.items.firstOrNull()
                if (firstItem != null && firstItem.meal.imageUrl.isNotBlank()) {
                  AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                      .data(firstItem.meal.imageUrl)
                      .crossfade(true)
                      .build(),
                    contentDescription = firstItem.meal.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                      .size(48.dp)
                      .clip(RoundedCornerShape(8.dp))
                      .background(NutrolixSurfaceVariant)
                  )
                } else {
                  Box(
                    modifier = Modifier
                      .size(48.dp)
                      .clip(RoundedCornerShape(8.dp))
                      .background(NutrolixSurfaceVariant),
                    contentAlignment = Alignment.Center
                  ) {
                    Text("🥗", fontSize = 22.sp)
                  }
                }

                Column(modifier = Modifier.weight(1f)) {
                  val itemSummary = ord.items.joinToString(", ") { "${it.quantity}x ${it.meal.name}" }
                  Text(
                    text = itemSummary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = NutrolixTextPrimary,
                    maxLines = 2,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                  )
                  Text(
                    text = "${ord.items.size} ${if (ord.items.size == 1) "item" else "items"} • Total ₹${ord.total.toInt()}",
                    fontSize = 11.sp,
                    color = NutrolixPrimaryGreen,
                    fontWeight = FontWeight.Bold
                  )
                }
              }

              Spacer(modifier = Modifier.height(10.dp))

              // Payment Mode & Refund info
              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
              ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                  Icon(
                    imageVector = if (ord.paymentMethod.contains("Cash on Delivery", ignoreCase = true)) Icons.Default.Money else Icons.Default.CreditCard,
                    contentDescription = null,
                    tint = NutrolixTextSecondary,
                    modifier = Modifier.size(14.dp)
                  )
                  Text(
                    text = if (ord.paymentMethod.contains("Cash on Delivery", ignoreCase = true)) "Cash on Delivery" else "Online (${ord.paymentMethod})",
                    fontSize = 11.sp,
                    color = NutrolixTextSecondary
                  )
                }

                if (isCancelled && ord.refundStatus != "Not Applicable") {
                  Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = if (ord.refundStatus == "Refunded") NutrolixLightGreen else NutrolixOrangeLight
                  ) {
                    Text(
                      text = "Refund: ${ord.refundStatus}",
                      fontSize = 10.sp,
                      fontWeight = FontWeight.Bold,
                      color = if (ord.refundStatus == "Refunded") NutrolixDarkGreen else NutrolixOrangeDark,
                      modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                  }
                }
              }

              Spacer(modifier = Modifier.height(10.dp))

              // Bottom Actions
              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
              ) {
                TextButton(
                  onClick = { onOrderClick(ord) },
                  contentPadding = PaddingValues(0.dp)
                ) {
                  Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("View Details", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NutrolixPrimaryGreen)
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = NutrolixPrimaryGreen, modifier = Modifier.size(14.dp))
                  }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                  if (isDelivered) {
                    if (ord.ratingSubmitted == null) {
                      Button(
                        onClick = { onRateOrder(ord) },
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = NutrolixOrange),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.height(32.dp).testTag("rate_order_${ord.orderNumber}")
                      ) {
                        Icon(Icons.Default.Star, contentDescription = null, modifier = Modifier.size(12.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Rate & Review", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                      }
                    } else {
                      Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = NutrolixLightGreen
                      ) {
                        Row(
                          modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                          verticalAlignment = Alignment.CenterVertically,
                          horizontalArrangement = Arrangement.spacedBy(3.dp)
                        ) {
                          Icon(Icons.Default.Star, contentDescription = null, tint = NutrolixGold, modifier = Modifier.size(12.dp))
                          Text("${ord.ratingSubmitted}★ Rated", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = NutrolixDarkGreen)
                        }
                      }
                    }
                  } else if (isActive) {
                    Button(
                      onClick = { onTrackOrder(ord) },
                      shape = RoundedCornerShape(8.dp),
                      colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
                      contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                      modifier = Modifier.height(32.dp).testTag("track_order_${ord.orderNumber}")
                    ) {
                      Icon(Icons.Default.DeliveryDining, contentDescription = null, modifier = Modifier.size(14.dp))
                      Spacer(modifier = Modifier.width(4.dp))
                      Text("Track Live", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                  }

                  OutlinedButton(
                    onClick = { onReorder(ord) },
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    modifier = Modifier.height(32.dp)
                  ) {
                    Text("Reorder", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
