package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.example.model.*
import com.example.ui.theme.*
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminDashboardScreen(
  banners: List<PromoBanner>,
  meals: List<MealItem>,
  categories: List<FoodCategory>,
  orders: List<Order>,
  coupons: List<Coupon> = emptyList(),
  storeSettings: StoreSettings,
  isRefreshing: Boolean = false,
  onRefresh: () -> Unit = {},
  onExitToCustomerApp: () -> Unit,
  onLogoutAdmin: () -> Unit = onExitToCustomerApp,
  onAddBanner: (PromoBanner) -> Unit,
  onUpdateBanner: (PromoBanner) -> Unit,
  onDeleteBanner: (String) -> Unit,
  onToggleBanner: (String) -> Unit,
  onAddMeal: (MealItem) -> Unit,
  onUpdateMeal: (MealItem) -> Unit,
  onDeleteMeal: (String) -> Unit,
  onToggleMealStock: (String) -> Unit,
  onUpdateOrderStatus: (String, OrderStatus) -> Unit,
  onToggleStoreOpen: () -> Unit,
  onUpdateAnnouncement: (String) -> Unit,
  onUpdateStoreSettings: (StoreSettings) -> Unit,
  onAddCoupon: (Coupon) -> Unit = {},
  onUpdateCoupon: (Coupon) -> Unit = {},
  onDeleteCoupon: (String) -> Unit = {},
  onToggleCoupon: (String) -> Unit = {},
  onCleanupOrders: (Int, (Int) -> Unit) -> Unit = { _, _ -> },
  onDeleteOrder: (String) -> Unit = {},
  modifier: Modifier = Modifier
) {
  val context = LocalContext.current
  val acknowledgedOrderIds = remember { mutableStateListOf<String>() }

  // Immediately silence any incoming alarm sound as soon as the Admin Dashboard screen is open
  LaunchedEffect(Unit) {
    com.example.util.OrderAlarmPlayer.stopOrderAlarm()
  }

  DisposableEffect(Unit) {
    onDispose {
      com.example.util.OrderAlarmPlayer.stopOrderAlarm()
    }
  }

  var selectedTab by remember { mutableStateOf(0) } // 0: Live Orders (Main page), 1: Menu Items, 2: Banners, 3: Coupons, 4: Store Settings

  // Dialog States
  var showAddBannerDialog by remember { mutableStateOf(false) }
  var bannerToEdit by remember { mutableStateOf<PromoBanner?>(null) }

  var showAddMealDialog by remember { mutableStateOf(false) }
  var mealToEdit by remember { mutableStateOf<MealItem?>(null) }

  var showAddCouponDialog by remember { mutableStateOf(false) }
  var couponToEdit by remember { mutableStateOf<Coupon?>(null) }

  var showStorageCleanupDialog by remember { mutableStateOf(false) }
  var cleanupStatusMessage by remember { mutableStateOf<String?>(null) }
  var isCleaningUp by remember { mutableStateOf(false) }

  PullToRefreshBox(
    isRefreshing = isRefreshing,
    onRefresh = onRefresh,
    modifier = modifier.fillMaxSize().background(NutrolixBackground)
  ) {
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .testTag("admin_dashboard_screen"),
      contentPadding = PaddingValues(16.dp)
    ) {
      // 0. Live Cloud Connection & Pull-to-Refresh Indicator
      item {
        Card(
          shape = RoundedCornerShape(12.dp),
          colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
          border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixPrimaryGreen.copy(alpha = 0.4f)),
          modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp)
        ) {
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .padding(horizontal = 14.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Row(
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
              Box(
                modifier = Modifier
                  .size(10.dp)
                  .background(NutrolixPrimaryGreen, CircleShape)
              )
              Column {
                Text(
                  text = if (isRefreshing) "Syncing with Firebase Cloud..." else "Firebase Cloud Live Sync: ACTIVE",
                  fontSize = 11.sp,
                  fontWeight = FontWeight.Bold,
                  color = NutrolixDarkGreen
                )
                Text(
                  text = "⬇️ Swipe down / Pull to refresh from Cloud",
                  fontSize = 10.sp,
                  color = NutrolixTextSecondary
                )
              }
            }
            IconButton(
              onClick = onRefresh,
              modifier = Modifier.size(28.dp)
            ) {
              if (isRefreshing) {
                CircularProgressIndicator(
                  color = NutrolixOrange,
                  modifier = Modifier.size(16.dp),
                  strokeWidth = 2.dp
                )
              } else {
                Icon(
                  imageVector = Icons.Default.Refresh,
                  contentDescription = "Refresh",
                  tint = NutrolixDarkGreen,
                  modifier = Modifier.size(18.dp)
                )
              }
            }
          }
        }
      }

      // 1. Top Admin Hub Banner
      item {
        Card(
          shape = RoundedCornerShape(18.dp),
          colors = CardDefaults.cardColors(containerColor = NutrolixForestGreen),
          modifier = Modifier.fillMaxWidth().padding(bottom = 14.dp)
        ) {
          Column(modifier = Modifier.padding(16.dp)) {
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.CenterVertically
            ) {
              Column {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                  Icon(Icons.Default.AdminPanelSettings, contentDescription = null, tint = NutrolixGold, modifier = Modifier.size(22.dp))
                  Text(
                    text = "Nutrolix Store Admin",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White
                  )
                }
                Text(
                  text = "Control banners, menu catalog, coupons & orders",
                  fontSize = 11.sp,
                  color = NutrolixLightGreen
                )
              }

              // Return to Customer App Button
              Button(
                onClick = onExitToCustomerApp,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = NutrolixOrange),
                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                modifier = Modifier.height(36.dp).testTag("exit_admin_button")
              ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                  Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                  Text("Customer App", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
                }
              }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Quick Stats Row
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.SpaceBetween
            ) {
              AdminStatChip(label = "Live Orders", value = "${orders.count { it.status != OrderStatus.DELIVERED && it.status != OrderStatus.CANCELLED }}")
              AdminStatChip(label = "Menu Items", value = "${meals.size}")
              AdminStatChip(label = "Banners", value = "${banners.size}")
              AdminStatChip(label = "Store Status", value = if (storeSettings.isOpen) "Open" else "Closed")
            }
          }
        }
      }

      // 2. Navigation Tabs (Orders, Menu, Banners, Coupons, Store)
      item {
        val tabTitles = listOf("📦 Orders", "🥗 Menu", "📢 Banners", "🎟️ Coupons", "⚙️ Store")
        Row(
          modifier = Modifier.fillMaxWidth().padding(bottom = 14.dp),
          horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
          tabTitles.forEachIndexed { index, title ->
            val isSelected = selectedTab == index
            Surface(
              onClick = { selectedTab = index },
              shape = RoundedCornerShape(8.dp),
              color = if (isSelected) NutrolixDarkGreen else NutrolixSurface,
              border = if (isSelected) null else androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder),
              modifier = Modifier.weight(1f).height(38.dp)
            ) {
              Box(contentAlignment = Alignment.Center) {
                Text(
                  text = title,
                  fontSize = 10.sp,
                  fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                  color = if (isSelected) Color.White else NutrolixTextPrimary,
                  maxLines = 1
                )
              }
            }
          }
        }
      }

      // 3. Tab Contents
      when (selectedTab) {
        // -------------------------------------------------------------
        // TAB 2: BANNERS MANAGEMENT
        // -------------------------------------------------------------
        2 -> {
          item {
            Row(
              modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.CenterVertically
            ) {
              Column {
                Text("Customer App Banners", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                Text("Manage top promotional banners shown to customers", fontSize = 11.sp, color = NutrolixTextSecondary)
              }

              Button(
                onClick = { showAddBannerDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
                shape = RoundedCornerShape(8.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                modifier = Modifier.testTag("add_new_banner_button")
              ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add Banner", fontSize = 12.sp, fontWeight = FontWeight.Bold)
              }
            }
            Spacer(modifier = Modifier.height(8.dp))
          }

          items(banners, key = { it.id }) { banner ->
            Card(
              shape = RoundedCornerShape(14.dp),
              colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
              border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder),
              modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)
            ) {
              Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
              ) {
                AsyncImage(
                  model = ImageRequest.Builder(LocalContext.current)
                    .data(banner.imageUrl)
                    .crossfade(true)
                    .build(),
                  contentDescription = banner.title,
                  contentScale = ContentScale.Crop,
                  modifier = Modifier
                    .size(70.dp, 50.dp)
                    .clip(RoundedCornerShape(8.dp))
                )

                Column(modifier = Modifier.weight(1f)) {
                  Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(banner.title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                    Surface(shape = RoundedCornerShape(4.dp), color = NutrolixLightGreen) {
                      Text(banner.badge, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = NutrolixDarkGreen, modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp))
                    }
                  }
                  Text(banner.subtitle, fontSize = 11.sp, color = NutrolixTextSecondary, maxLines = 1)
                  if (banner.discountCode.isNotEmpty()) {
                    Text("Code: ${banner.discountCode}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = NutrolixOrangeDark)
                  }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                  Switch(
                    checked = banner.isActive,
                    onCheckedChange = { onToggleBanner(banner.id) }
                  )
                  IconButton(onClick = { bannerToEdit = banner }) {
                    Icon(Icons.Default.Edit, contentDescription = "Edit", tint = NutrolixPrimaryGreen, modifier = Modifier.size(18.dp))
                  }
                  IconButton(onClick = { onDeleteBanner(banner.id) }) {
                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = StatusDanger, modifier = Modifier.size(18.dp))
                  }
                }
              }
            }
          }
        }

        // -------------------------------------------------------------
        // TAB 1: MENU CATALOG MANAGEMENT
        // -------------------------------------------------------------
        1 -> {
          item {
            Row(
              modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.CenterVertically
            ) {
              Column {
                Text("Food Items & Nutrition", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                Text("${meals.size} items in catalog • Real-time stock toggle", fontSize = 11.sp, color = NutrolixTextSecondary)
              }

              Button(
                onClick = { showAddMealDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
                shape = RoundedCornerShape(8.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                modifier = Modifier.testTag("add_new_meal_button")
              ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add Food", fontSize = 12.sp, fontWeight = FontWeight.Bold)
              }
            }
            Spacer(modifier = Modifier.height(8.dp))
          }

          items(meals, key = { it.id }) { meal ->
            Card(
              shape = RoundedCornerShape(14.dp),
              colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
              border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder),
              modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)
            ) {
              Column(modifier = Modifier.padding(12.dp)) {
                Row(
                  modifier = Modifier.fillMaxWidth(),
                  verticalAlignment = Alignment.CenterVertically,
                  horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                  AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                      .data(meal.imageUrl)
                      .crossfade(true)
                      .build(),
                    contentDescription = meal.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                      .size(60.dp)
                      .clip(RoundedCornerShape(8.dp))
                  )

                  Column(modifier = Modifier.weight(1f)) {
                    val catObj = categories.find { it.id == meal.categoryId }
                    Row(
                      verticalAlignment = Alignment.CenterVertically,
                      horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                      Text(meal.name, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                      Surface(
                        color = NutrolixSurfaceVariant,
                        shape = RoundedCornerShape(4.dp)
                      ) {
                        Text(
                          text = catObj?.title ?: meal.categoryId,
                          fontSize = 9.sp,
                          color = NutrolixDarkGreen,
                          fontWeight = FontWeight.Bold,
                          modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                        )
                      }
                    }
                    Text("₹${meal.discountedPrice.toInt()} (MRP ₹${meal.price.toInt()})", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NutrolixDarkGreen)
                    Text(
                      text = meal.singleLineNutritionSummary,
                      fontSize = 10.sp,
                      color = NutrolixTextSecondary,
                      maxLines = 1,
                      overflow = TextOverflow.Ellipsis
                    )
                  }

                  Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                      Switch(
                        checked = meal.isAvailable,
                        onCheckedChange = { onToggleMealStock(meal.id) }
                      )
                      Text(if (meal.isAvailable) "In Stock" else "Sold Out", fontSize = 9.sp, color = if (meal.isAvailable) StatusSuccess else StatusDanger)
                    }

                    IconButton(onClick = { mealToEdit = meal }) {
                      Icon(Icons.Default.Edit, contentDescription = "Edit", tint = NutrolixPrimaryGreen, modifier = Modifier.size(18.dp))
                    }
                    IconButton(onClick = { onDeleteMeal(meal.id) }) {
                      Icon(Icons.Default.Delete, contentDescription = "Delete", tint = StatusDanger, modifier = Modifier.size(18.dp))
                    }
                  }
                }
              }
            }
          }
        }

        // -------------------------------------------------------------
        // TAB 0: LIVE ORDERS MANAGEMENT
        // -------------------------------------------------------------
        0 -> {
          item {
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.CenterVertically
            ) {
              Column {
                Text("Live Orders (${orders.size})", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                Text("Real-time orders queue with audio ringing alert for new orders", fontSize = 11.sp, color = NutrolixTextSecondary)
              }
              Surface(
                onClick = { showStorageCleanupDialog = true },
                shape = RoundedCornerShape(8.dp),
                color = NutrolixLightGreen,
                border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixPrimaryGreen.copy(alpha = 0.4f)),
                modifier = Modifier.testTag("manage_storage_button")
              ) {
                Row(
                  modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                  verticalAlignment = Alignment.CenterVertically,
                  horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                  Text("🧹", fontSize = 12.sp)
                  Text("Manage Storage", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = NutrolixDarkGreen)
                }
              }
            }
            Spacer(modifier = Modifier.height(10.dp))
          }

          if (com.example.util.OrderAlarmPlayer.isRinging()) {
            item {
              Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = NutrolixOrange),
                modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp)
              ) {
                Row(
                  modifier = Modifier.padding(12.dp).fillMaxWidth(),
                  horizontalArrangement = Arrangement.SpaceBetween,
                  verticalAlignment = Alignment.CenterVertically
                ) {
                  Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("🔔", fontSize = 20.sp)
                    Column {
                      Text("NEW ORDER ALERT RINGING!", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 13.sp)
                      Text("Tap to silence alarm sound", color = Color.White.copy(alpha = 0.9f), fontSize = 11.sp)
                    }
                  }
                  Button(
                    onClick = {
                      orders.forEach { acknowledgedOrderIds.add(it.id) }
                      com.example.util.OrderAlarmPlayer.stopOrderAlarm()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = NutrolixDarkGreen),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                  ) {
                    Text("Silence Ring", fontWeight = FontWeight.Bold, fontSize = 11.sp)
                  }
                }
              }
            }
          }

          if (orders.isEmpty()) {
            item {
              Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
                modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp)
              ) {
                Box(modifier = Modifier.padding(24.dp).fillMaxWidth(), contentAlignment = Alignment.Center) {
                  Text("No orders placed yet. Orders will appear here in real time.", color = NutrolixTextSecondary, fontSize = 13.sp)
                }
              }
            }
          } else {
            items(orders, key = { it.id }) { order ->
              val isUnackPlaced = order.status == OrderStatus.PLACED && !acknowledgedOrderIds.contains(order.id)

              // Compute customer repeat order sequence dynamically across all stored orders
              val customerPhoneClean = order.customerPhone.trim().filter { it.isDigit() }.takeLast(10)
              val customerEmailClean = order.customerEmail.trim().lowercase()
              val customerHistoryCount = orders.count { ord ->
                val p = ord.customerPhone.trim().filter { c -> c.isDigit() }.takeLast(10)
                val e = ord.customerEmail.trim().lowercase()
                (customerPhoneClean.isNotBlank() && p == customerPhoneClean) ||
                  (customerEmailClean.isNotBlank() && e.isNotBlank() && e == customerEmailClean)
              }
              val displayOrderSeq = maxOf(order.customerOrderCount, customerHistoryCount)

              Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = if (isUnackPlaced) Color(0xFFFFF3E0) else NutrolixSurface),
                border = androidx.compose.foundation.BorderStroke(
                  width = if (isUnackPlaced) 2.dp else 1.dp,
                  color = if (isUnackPlaced) NutrolixOrange else NutrolixBorder
                ),
                modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)
              ) {
                Column(modifier = Modifier.padding(14.dp)) {
                  Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                  ) {
                    Column(modifier = Modifier.weight(1f, fill = false)) {
                      Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(order.orderNumber, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = NutrolixTextPrimary)
                        Surface(
                          shape = RoundedCornerShape(6.dp),
                          color = when {
                            displayOrderSeq == 1 -> Color(0xFFE8F5E9)
                            displayOrderSeq in 2..3 -> Color(0xFFE0F7FA)
                            displayOrderSeq in 4..9 -> Color(0xFFEDE7F6)
                            else -> Color(0xFFFFF8E1)
                          }
                        ) {
                          Text(
                            text = when {
                              displayOrderSeq == 1 -> "🌱 1st Order (New)"
                              displayOrderSeq == 2 -> "🔁 2nd Order"
                              displayOrderSeq == 3 -> "🔁 3rd Order"
                              displayOrderSeq in 4..9 -> "⭐ ${displayOrderSeq}th Order"
                              else -> "👑 VIP (${displayOrderSeq}th)"
                            },
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = when {
                              displayOrderSeq == 1 -> Color(0xFF2E7D32)
                              displayOrderSeq in 2..3 -> Color(0xFF00695C)
                              displayOrderSeq in 4..9 -> Color(0xFF512DA8)
                              else -> Color(0xFFE65100)
                            },
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                          )
                        }
                      }
                      Spacer(modifier = Modifier.height(2.dp))
                      Text("Customer: ${order.customerName} • +91 ${order.customerPhone}", fontSize = 11.sp, color = NutrolixTextSecondary)
                    }

                    Surface(
                      shape = RoundedCornerShape(8.dp),
                      color = when (order.status) {
                        OrderStatus.PENDING -> Color(0xFFFFF3E0)
                        OrderStatus.CONFIRMED, OrderStatus.PLACED -> NutrolixOrangeLight
                        OrderStatus.PREPARING -> Color(0xFFE3F2FD)
                        OrderStatus.READY -> Color(0xFFE8F5E9)
                        OrderStatus.OUT_FOR_DELIVERY -> Color(0xFFFFF8E1)
                        OrderStatus.DELIVERED -> NutrolixLightGreen
                        OrderStatus.CANCELLED -> Color(0xFFFFEBEE)
                      }
                    ) {
                      Text(
                        text = order.status.title,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = when (order.status) {
                          OrderStatus.PENDING -> NutrolixOrangeDark
                          OrderStatus.CONFIRMED, OrderStatus.PLACED -> NutrolixOrangeDark
                          OrderStatus.PREPARING -> Color(0xFF1565C0)
                          OrderStatus.READY -> Color(0xFF2E7D32)
                          OrderStatus.OUT_FOR_DELIVERY -> Color(0xFFF57F17)
                          OrderStatus.DELIVERED -> NutrolixDarkGreen
                          OrderStatus.CANCELLED -> StatusDanger
                        },
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                      )
                    }
                  }

                  Spacer(modifier = Modifier.height(8.dp))

                  // Items summary
                  Text(
                    text = "Items: " + order.items.joinToString(", ") { "${it.quantity}x ${it.meal.name}" },
                    fontSize = 12.sp,
                    color = NutrolixTextPrimary,
                    fontWeight = FontWeight.Medium
                  )

                  Text(
                    text = "Deliver to: ${order.deliveryAddress}",
                    fontSize = 11.sp,
                    color = NutrolixTextSecondary,
                    maxLines = 1
                  )

                  if (order.specialInstructions.isNotBlank()) {
                    Text(
                      text = "Note: ${order.specialInstructions}",
                      fontSize = 11.sp,
                      color = NutrolixOrangeDark
                    )
                  }

                  Spacer(modifier = Modifier.height(10.dp))

                  // WhatsApp Order Actions (Requirement 4: Share order & notify customer on WhatsApp)
                  Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                  ) {
                    // 1. Share Full Order Details Button
                    Surface(
                      onClick = { shareOrderDetailsWhatsApp(context, order) },
                      shape = RoundedCornerShape(8.dp),
                      color = Color(0xFF25D366),
                      modifier = Modifier.weight(1f).height(36.dp).testTag("share_order_details_${order.orderNumber}")
                    ) {
                      Row(
                        modifier = Modifier.fillMaxSize().padding(horizontal = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                      ) {
                        Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = null, tint = Color.White, modifier = Modifier.size(15.dp))
                        Spacer(modifier = Modifier.width(5.dp))
                        Text("Share Details", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
                      }
                    }

                    // 2. Send Live Status WhatsApp Message to Customer
                    Surface(
                      onClick = { sendCustomerStatusWhatsApp(context, order, order.status) },
                      shape = RoundedCornerShape(8.dp),
                      color = NutrolixForestGreen,
                      modifier = Modifier.weight(1f).height(36.dp).testTag("notify_customer_whatsapp_${order.orderNumber}")
                    ) {
                      Row(
                        modifier = Modifier.fillMaxSize().padding(horizontal = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                      ) {
                        Icon(Icons.Default.Send, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(5.dp))
                        Text("Send WhatsApp", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
                      }
                    }
                  }

                  Spacer(modifier = Modifier.height(8.dp))

                  // Admin Action Buttons (Triggers status change + WhatsApp update)
                  Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                  ) {
                    when (order.status) {
                      OrderStatus.PENDING, OrderStatus.PLACED, OrderStatus.CONFIRMED -> {
                        Button(
                          onClick = {
                            acknowledgedOrderIds.add(order.id)
                            com.example.util.OrderAlarmPlayer.stopOrderAlarm()
                            onUpdateOrderStatus(order.id, OrderStatus.PREPARING)
                            sendCustomerStatusWhatsApp(context, order, OrderStatus.PREPARING)
                          },
                          colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
                          shape = RoundedCornerShape(8.dp),
                          modifier = Modifier.weight(1f).height(38.dp)
                        ) {
                          Text("Accept & Cook 👨‍🍳", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                      }
                      OrderStatus.PREPARING -> {
                        Button(
                          onClick = {
                            onUpdateOrderStatus(order.id, OrderStatus.READY)
                            sendCustomerStatusWhatsApp(context, order, OrderStatus.READY)
                          },
                          colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0288D1)),
                          shape = RoundedCornerShape(8.dp),
                          modifier = Modifier.weight(1f).height(38.dp)
                        ) {
                          Text("Mark Ready 📦", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                      }
                      OrderStatus.READY -> {
                        Button(
                          onClick = {
                            onUpdateOrderStatus(order.id, OrderStatus.OUT_FOR_DELIVERY)
                            sendCustomerStatusWhatsApp(context, order, OrderStatus.OUT_FOR_DELIVERY)
                          },
                          colors = ButtonDefaults.buttonColors(containerColor = NutrolixOrange),
                          shape = RoundedCornerShape(8.dp),
                          modifier = Modifier.weight(1f).height(38.dp)
                        ) {
                          Text("Dispatch 🛵", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                      }
                      OrderStatus.OUT_FOR_DELIVERY -> {
                        Button(
                          onClick = {
                            onUpdateOrderStatus(order.id, OrderStatus.DELIVERED)
                            sendCustomerStatusWhatsApp(context, order, OrderStatus.DELIVERED)
                          },
                          colors = ButtonDefaults.buttonColors(containerColor = StatusSuccess),
                          shape = RoundedCornerShape(8.dp),
                          modifier = Modifier.weight(1f).height(38.dp)
                        ) {
                          Text("Mark Delivered ✅", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                      }
                      OrderStatus.DELIVERED -> {
                        Surface(
                          shape = RoundedCornerShape(8.dp),
                          color = NutrolixLightGreen,
                          modifier = Modifier.weight(1f).height(36.dp)
                        ) {
                          Box(contentAlignment = Alignment.Center) {
                            Text("Order Completed ✅", fontSize = 11.sp, color = NutrolixDarkGreen, fontWeight = FontWeight.Bold)
                          }
                        }
                        IconButton(
                          onClick = { onDeleteOrder(order.id) },
                          modifier = Modifier.size(36.dp)
                        ) {
                          Icon(Icons.Default.Delete, contentDescription = "Delete from history", tint = Color.Gray, modifier = Modifier.size(18.dp))
                        }
                      }
                      OrderStatus.CANCELLED -> {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                          Text("Order Cancelled", fontSize = 11.sp, color = StatusDanger, modifier = Modifier.weight(1f))
                          IconButton(
                            onClick = { onDeleteOrder(order.id) },
                            modifier = Modifier.size(36.dp)
                          ) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete order", tint = Color.Gray, modifier = Modifier.size(18.dp))
                          }
                        }
                      }
                    }

                    if (order.status != OrderStatus.DELIVERED && order.status != OrderStatus.CANCELLED) {
                      OutlinedButton(
                        onClick = {
                          acknowledgedOrderIds.add(order.id)
                          com.example.util.OrderAlarmPlayer.stopOrderAlarm()
                          onUpdateOrderStatus(order.id, OrderStatus.CANCELLED)
                        },
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = StatusDanger),
                        modifier = Modifier.height(38.dp)
                      ) {
                        Text("Cancel", fontSize = 11.sp)
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // -------------------------------------------------------------
        // TAB 3: COUPONS & DISCOUNTS MANAGEMENT (Requirement 4)
        // -------------------------------------------------------------
        3 -> {
          item {
            Row(
              modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.CenterVertically
            ) {
              Column {
                Text("Coupons & Promo Codes", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                Text("Configure discounts, thresholds, percentages & manual/auto rules", fontSize = 11.sp, color = NutrolixTextSecondary)
              }

              Button(
                onClick = { showAddCouponDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
                shape = RoundedCornerShape(8.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                modifier = Modifier.testTag("add_new_coupon_button")
              ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add Coupon", fontSize = 12.sp, fontWeight = FontWeight.Bold)
              }
            }
            Spacer(modifier = Modifier.height(8.dp))
          }

          items(coupons, key = { it.code }) { cpn ->
            Card(
              shape = RoundedCornerShape(14.dp),
              colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
              border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder),
              modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)
            ) {
              Row(
                modifier = Modifier.padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
              ) {
                Column(modifier = Modifier.weight(1f)) {
                  Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(cpn.code, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = NutrolixOrangeDark)
                    Surface(shape = RoundedCornerShape(4.dp), color = NutrolixLightGreen) {
                      Text(
                        text = if (cpn.discountType == DiscountType.PERCENTAGE) "${cpn.discountValue.toInt()}% OFF" else "₹${cpn.discountValue.toInt()} OFF",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = NutrolixDarkGreen,
                        modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                      )
                    }
                  }
                  Text(cpn.title, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = NutrolixTextPrimary)
                  Text("Min Order: ₹${cpn.minOrder.toInt()} • Max: ₹${cpn.maxDiscount.toInt()}", fontSize = 11.sp, color = NutrolixTextSecondary)
                  if (cpn.description.isNotEmpty()) {
                    Text(cpn.description, fontSize = 10.sp, color = NutrolixTextSecondary)
                  }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                  Switch(
                    checked = cpn.isActive,
                    onCheckedChange = { onToggleCoupon(cpn.code) }
                  )
                  IconButton(onClick = { couponToEdit = cpn }) {
                    Icon(Icons.Default.Edit, contentDescription = "Edit", tint = NutrolixPrimaryGreen, modifier = Modifier.size(18.dp))
                  }
                  IconButton(onClick = { onDeleteCoupon(cpn.code) }) {
                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = StatusDanger, modifier = Modifier.size(18.dp))
                  }
                }
              }
            }
          }
        }

        // -------------------------------------------------------------
        // TAB 4: STORE SETTINGS & LOGOUT
        // -------------------------------------------------------------
        4 -> {
          item {
            Card(
              shape = RoundedCornerShape(16.dp),
              colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
              border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder),
              modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)
            ) {
              Column(modifier = Modifier.padding(16.dp)) {
                Text("Store Operations & Delivery Rules", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                Spacer(modifier = Modifier.height(14.dp))

                // Kitchen Open / Closed Toggle
                Row(
                  modifier = Modifier.fillMaxWidth(),
                  horizontalArrangement = Arrangement.SpaceBetween,
                  verticalAlignment = Alignment.CenterVertically
                ) {
                  Column {
                    Text(
                      text = if (storeSettings.isOpen) "Kitchen is ONLINE (Accepting Orders)" else "Kitchen is OFFLINE (Paused)",
                      fontSize = 13.sp,
                      fontWeight = FontWeight.Bold,
                      color = if (storeSettings.isOpen) StatusSuccess else StatusDanger
                    )
                    Text("Controls ordering availability in the customer app", fontSize = 11.sp, color = NutrolixTextSecondary)
                  }

                  Switch(
                    checked = storeSettings.isOpen,
                    onCheckedChange = { onToggleStoreOpen() }
                  )
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 14.dp), color = NutrolixBorder)

                // Requirement 5: Admin-configurable Free Delivery Threshold & Delivery Fee
                var freeDeliveryThresholdText by remember(storeSettings.freeDeliveryAbove) { mutableStateOf(storeSettings.freeDeliveryAbove.toInt().toString()) }
                var deliveryFeeText by remember(storeSettings.deliveryFee) { mutableStateOf(storeSettings.deliveryFee.toInt().toString()) }

                Text("Delivery Fee & Free Delivery Threshold", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                Text("Configure delivery charges and qualifying amount for 100% free delivery", fontSize = 11.sp, color = NutrolixTextSecondary)
                Spacer(modifier = Modifier.height(8.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                  OutlinedTextField(
                    value = freeDeliveryThresholdText,
                    onValueChange = { freeDeliveryThresholdText = it },
                    label = { Text("Free Delivery Above ₹") },
                    placeholder = { Text("199") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    colors = nutrolixTextFieldColors(),
                    modifier = Modifier.weight(1f)
                  )

                  OutlinedTextField(
                    value = deliveryFeeText,
                    onValueChange = { deliveryFeeText = it },
                    label = { Text("Standard Delivery Fee ₹") },
                    placeholder = { Text("29") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    colors = nutrolixTextFieldColors(),
                    modifier = Modifier.weight(1f)
                  )
                }

                Spacer(modifier = Modifier.height(8.dp))

                Button(
                  onClick = {
                    val thresholdVal = freeDeliveryThresholdText.toDoubleOrNull() ?: 199.0
                    val feeVal = deliveryFeeText.toDoubleOrNull() ?: 29.0
                    onUpdateStoreSettings(storeSettings.copy(freeDeliveryAbove = thresholdVal, deliveryFee = feeVal))
                  },
                  colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
                  shape = RoundedCornerShape(8.dp),
                  modifier = Modifier.align(Alignment.End)
                ) {
                  Text("Save Delivery Rules", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 14.dp), color = NutrolixBorder)

                // Announcement Editor
                var announcementInput by remember(storeSettings.announcement) { mutableStateOf(storeSettings.announcement) }
                Text("Top Announcement Bar", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                Text("Displayed prominently at the top of the Customer home screen", fontSize = 11.sp, color = NutrolixTextSecondary)
                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                  value = announcementInput,
                  onValueChange = { announcementInput = it },
                  modifier = Modifier.fillMaxWidth(),
                  colors = nutrolixTextFieldColors(),
                  shape = RoundedCornerShape(10.dp)
                )

                Spacer(modifier = Modifier.height(8.dp))

                Button(
                  onClick = { onUpdateAnnouncement(announcementInput) },
                  colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
                  shape = RoundedCornerShape(8.dp),
                  modifier = Modifier.align(Alignment.End)
                ) {
                  Text("Update Announcement", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 14.dp), color = NutrolixBorder)

                // PayU India Payment Gateway Settings (Permanently Active & Live)
                var payuIsLive by remember(storeSettings.payuIsLive) { mutableStateOf(storeSettings.payuIsLive) }
                var payuKeyInput by remember(storeSettings.payuMerchantKey) { mutableStateOf(storeSettings.payuMerchantKey) }
                var payuSaltInput by remember(storeSettings.payuMerchantSalt) { mutableStateOf(storeSettings.payuMerchantSalt) }
                var showSaltPassword by remember { mutableStateOf(false) }
                var payuSavedNotice by remember { mutableStateOf(false) }

                Surface(
                  shape = RoundedCornerShape(12.dp),
                  color = NutrolixLightGreen.copy(alpha = 0.5f),
                  border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder),
                  modifier = Modifier.fillMaxWidth()
                ) {
                  Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                      modifier = Modifier.fillMaxWidth(),
                      horizontalArrangement = Arrangement.SpaceBetween,
                      verticalAlignment = Alignment.CenterVertically
                    ) {
                      Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                      ) {
                        Icon(Icons.Default.Shield, contentDescription = "PayU", tint = NutrolixDarkGreen, modifier = Modifier.size(20.dp))
                        Column {
                          Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("PayU Payment Gateway", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NutrolixDarkGreen)
                            Surface(
                              shape = RoundedCornerShape(4.dp),
                              color = NutrolixPrimaryGreen
                            ) {
                              Text(
                                text = "LIVE & ACTIVE",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = Color.White,
                                modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                              )
                            }
                          }
                          Text("Accept UPI, GPay, PhonePe, Cards & NetBanking (Always Active)", fontSize = 11.sp, color = NutrolixTextSecondary)
                        }
                      }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                      modifier = Modifier.fillMaxWidth(),
                      horizontalArrangement = Arrangement.SpaceBetween,
                      verticalAlignment = Alignment.CenterVertically
                    ) {
                      Column {
                        Text(
                          text = if (payuIsLive) "Gateway: LIVE (Real Payments)" else "Gateway: TEST (Sandbox)",
                          fontSize = 12.sp,
                          fontWeight = FontWeight.Bold,
                          color = if (payuIsLive) NutrolixPrimaryGreen else NutrolixOrange
                        )
                        Text(
                          text = if (payuIsLive) "Endpoint: https://secure.payu.in" else "Endpoint: https://test.payu.in",
                          fontSize = 10.sp,
                          color = NutrolixTextSecondary
                        )
                      }
                      FilterChip(
                        selected = payuIsLive,
                        onClick = { payuIsLive = !payuIsLive },
                        label = { Text(if (payuIsLive) "Mode: LIVE" else "Mode: TEST", fontSize = 10.sp, fontWeight = FontWeight.Bold) }
                      )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    OutlinedTextField(
                      value = payuKeyInput,
                      onValueChange = {
                        payuKeyInput = it
                        payuSavedNotice = false
                      },
                      label = { Text("PayU Merchant Key") },
                      placeholder = { Text("Enter Live Key from PayU Dashboard") },
                      singleLine = true,
                      colors = nutrolixTextFieldColors(),
                      modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                      value = payuSaltInput,
                      onValueChange = {
                        payuSaltInput = it
                        payuSavedNotice = false
                      },
                      label = { Text("PayU Merchant Salt") },
                      placeholder = { Text("Enter Live Salt from PayU Dashboard") },
                      singleLine = true,
                      visualTransformation = if (showSaltPassword) androidx.compose.ui.text.input.VisualTransformation.None else androidx.compose.ui.text.input.PasswordVisualTransformation(),
                      trailingIcon = {
                        IconButton(onClick = { showSaltPassword = !showSaltPassword }) {
                          Icon(
                            imageVector = if (showSaltPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = "Toggle Salt Visibility",
                            tint = NutrolixTextSecondary
                          )
                        }
                      },
                      colors = nutrolixTextFieldColors(),
                      modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    Row(
                      modifier = Modifier.fillMaxWidth(),
                      horizontalArrangement = Arrangement.SpaceBetween,
                      verticalAlignment = Alignment.CenterVertically
                    ) {
                      if (payuSavedNotice || (storeSettings.payuMerchantKey.isNotBlank() && !payuSavedNotice)) {
                        Text(
                          text = if (payuSavedNotice) "✓ Permanent Live Keys Saved!" else "✓ Active Credentials Configured",
                          color = NutrolixPrimaryGreen,
                          fontSize = 11.sp,
                          fontWeight = FontWeight.Bold
                        )
                      } else {
                        Text(
                          text = "Auto-fallback to secure gateway ready",
                          color = NutrolixTextSecondary,
                          fontSize = 11.sp
                        )
                      }

                      Button(
                        onClick = {
                          onUpdateStoreSettings(
                            storeSettings.copy(
                              payuEnabled = true,
                              payuIsLive = payuIsLive,
                              payuMerchantKey = payuKeyInput.trim(),
                              payuMerchantSalt = payuSaltInput.trim()
                            )
                          )
                          payuSavedNotice = true
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
                        shape = RoundedCornerShape(8.dp)
                      ) {
                        Text("Save & Set Live Permanently", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                      }
                    }
                  }
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 14.dp), color = NutrolixBorder)

                // Requirement 6: Explicit Logout Option
                Row(
                  modifier = Modifier.fillMaxWidth(),
                  horizontalArrangement = Arrangement.SpaceBetween,
                  verticalAlignment = Alignment.CenterVertically
                ) {
                  Column {
                    Text("Admin Session Logout", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = StatusDanger)
                    Text("Terminate persistent admin session securely", fontSize = 11.sp, color = NutrolixTextSecondary)
                  }

                  Button(
                    onClick = onLogoutAdmin,
                    colors = ButtonDefaults.buttonColors(containerColor = StatusDanger),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.testTag("admin_logout_button")
                  ) {
                    Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Logout Admin", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // DIALOG: ADD / EDIT BANNER
  // -------------------------------------------------------------
  if (showAddBannerDialog || bannerToEdit != null) {
    val isEdit = bannerToEdit != null
    var title by remember { mutableStateOf(bannerToEdit?.title ?: "") }
    var subtitle by remember { mutableStateOf(bannerToEdit?.subtitle ?: "") }
    var badge by remember { mutableStateOf(bannerToEdit?.badge ?: "NEW LAUNCH") }
    var imageUrl by remember { mutableStateOf(bannerToEdit?.imageUrl ?: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=900&auto=format&fit=crop&q=80") }
    var discountCode by remember { mutableStateOf(bannerToEdit?.discountCode ?: "FIT50") }

    AlertDialog(
      onDismissRequest = {
        showAddBannerDialog = false
        bannerToEdit = null
      },
      containerColor = NutrolixSurface,
      title = { Text(if (isEdit) "Edit Promo Banner" else "Add New Promo Banner", fontWeight = FontWeight.Bold, color = NutrolixDarkGreen) },
      text = {
        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
          OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Banner Title") }, colors = nutrolixTextFieldColors(), singleLine = true, modifier = Modifier.fillMaxWidth())
          OutlinedTextField(value = subtitle, onValueChange = { subtitle = it }, label = { Text("Subtitle / Details") }, colors = nutrolixTextFieldColors(), singleLine = true, modifier = Modifier.fillMaxWidth())
          OutlinedTextField(value = badge, onValueChange = { badge = it }, label = { Text("Badge Tag") }, colors = nutrolixTextFieldColors(), singleLine = true, modifier = Modifier.fillMaxWidth())
          OutlinedTextField(value = imageUrl, onValueChange = { imageUrl = it }, label = { Text("Image URL") }, colors = nutrolixTextFieldColors(), singleLine = true, modifier = Modifier.fillMaxWidth())
          OutlinedTextField(value = discountCode, onValueChange = { discountCode = it }, label = { Text("Discount Code (Optional)") }, colors = nutrolixTextFieldColors(), singleLine = true, modifier = Modifier.fillMaxWidth())
        }
      },
      confirmButton = {
        Button(
          onClick = {
            if (title.isNotBlank()) {
              if (isEdit && bannerToEdit != null) {
                onUpdateBanner(bannerToEdit!!.copy(title = title, subtitle = subtitle, badge = badge, imageUrl = imageUrl, discountCode = discountCode))
              } else {
                onAddBanner(
                  PromoBanner(
                    id = "banner_${UUID.randomUUID().toString().take(6)}",
                    title = title,
                    subtitle = subtitle,
                    badge = badge,
                    imageUrl = imageUrl.ifBlank { "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=900&auto=format&fit=crop&q=80" },
                    discountCode = discountCode,
                    isActive = true
                  )
                )
              }
              showAddBannerDialog = false
              bannerToEdit = null
            }
          },
          colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen)
        ) {
          Text(if (isEdit) "Save Changes" else "Create Banner")
        }
      },
      dismissButton = {
        TextButton(onClick = {
          showAddBannerDialog = false
          bannerToEdit = null
        }) {
          Text("Cancel", color = NutrolixDarkGreen)
        }
      }
    )
  }

  // -------------------------------------------------------------
  // DIALOG: ORDER DATABASE & STORAGE MANAGER
  // -------------------------------------------------------------
  if (showStorageCleanupDialog) {
    val totalOrdersCount = orders.size
    val activeOrdersCount = orders.count { it.status != OrderStatus.DELIVERED && it.status != OrderStatus.CANCELLED }
    val deliveredCount = orders.count { it.status == OrderStatus.DELIVERED }
    val cancelledCount = orders.count { it.status == OrderStatus.CANCELLED }

    AlertDialog(
      onDismissRequest = {
        if (!isCleaningUp) {
          showStorageCleanupDialog = false
          cleanupStatusMessage = null
        }
      },
      title = {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          Text("🧹", fontSize = 20.sp)
          Text("Order Storage & Database", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
      },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text(
            text = "Jab 10,000+ orders ho jaate hain to puraani delivered orders ko clean karne se app ki loading speed rocket fast rehti hai aur cloud database storage 100% free rehti hai.",
            fontSize = 12.sp,
            color = NutrolixTextSecondary
          )

          Card(
            colors = CardDefaults.cardColors(containerColor = NutrolixBackground),
            shape = RoundedCornerShape(8.dp)
          ) {
            Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
              Text("📊 Total Loaded Orders: $totalOrdersCount", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = NutrolixTextPrimary)
              Text("⚡ Active Kitchen Orders: $activeOrdersCount (Never deleted)", fontSize = 11.sp, color = NutrolixOrangeDark, fontWeight = FontWeight.SemiBold)
              Text("✅ Delivered / Completed: $deliveredCount", fontSize = 11.sp, color = NutrolixDarkGreen)
              Text("❌ Cancelled Orders: $cancelledCount", fontSize = 11.sp, color = StatusDanger)
            }
          }

          if (cleanupStatusMessage != null) {
            Surface(
              color = NutrolixLightGreen,
              shape = RoundedCornerShape(6.dp),
              modifier = Modifier.fillMaxWidth()
            ) {
              Text(
                text = cleanupStatusMessage ?: "",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = NutrolixDarkGreen,
                modifier = Modifier.padding(8.dp)
              )
            }
          }

          if (isCleaningUp) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
              CircularProgressIndicator(modifier = Modifier.size(16.dp), color = NutrolixPrimaryGreen, strokeWidth = 2.dp)
              Text("Cleaning up orders from Firestore...", fontSize = 11.sp, color = NutrolixTextSecondary)
            }
          } else {
            Button(
              onClick = {
                isCleaningUp = true
                onCleanupOrders(30) { cleanedCount ->
                  isCleaningUp = false
                  cleanupStatusMessage = "✅ Success: $cleanedCount delivered orders older than 30 days deleted from Firestore!"
                }
              },
              colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
              shape = RoundedCornerShape(8.dp),
              modifier = Modifier.fillMaxWidth()
            ) {
              Text("🧹 Clean Delivered Orders > 30 Days", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }

            OutlinedButton(
              onClick = {
                isCleaningUp = true
                onCleanupOrders(0) { cleanedCount ->
                  isCleaningUp = false
                  cleanupStatusMessage = "✅ Success: All $cleanedCount completed & cancelled orders cleared from Firestore!"
                }
              },
              colors = ButtonDefaults.outlinedButtonColors(contentColor = StatusDanger),
              shape = RoundedCornerShape(8.dp),
              modifier = Modifier.fillMaxWidth()
            ) {
              Text("🗑️ Clear All Delivered & Cancelled Orders", fontSize = 11.sp)
            }
          }
        }
      },
      confirmButton = {
        TextButton(
          onClick = {
            showStorageCleanupDialog = false
            cleanupStatusMessage = null
          }
        ) {
          Text("Done / Close", fontWeight = FontWeight.Bold, color = NutrolixDarkGreen)
        }
      }
    )
  }

  // -------------------------------------------------------------
  // DIALOG: ADD / EDIT FOOD ITEM (With Dedicated Nutrition Facts Fields)
  // -------------------------------------------------------------
  if (showAddMealDialog || mealToEdit != null) {
    val isEdit = mealToEdit != null
    var name by remember { mutableStateOf(mealToEdit?.name ?: "") }
    var description by remember { mutableStateOf(mealToEdit?.description ?: "") }
    var priceText by remember { mutableStateOf(mealToEdit?.price?.toInt()?.toString() ?: "299") }
    var discountedPriceText by remember { mutableStateOf(mealToEdit?.discountedPrice?.toInt()?.toString() ?: "249") }

    // Dedicated Nutrition Facts Fields
    var proteinText by remember { mutableStateOf(mealToEdit?.proteinGrams?.toString() ?: "32") }
    var caloriesText by remember { mutableStateOf(mealToEdit?.calories?.toString() ?: "380") }
    var carbsText by remember { mutableStateOf(mealToEdit?.carbsGrams?.toString() ?: "28") }
    var fatsText by remember { mutableStateOf(mealToEdit?.fatsGrams?.toString() ?: "12") }
    var fiberText by remember { mutableStateOf(mealToEdit?.fiberGrams?.toString() ?: "6") }
    var healthTag by remember { mutableStateOf(mealToEdit?.verifiedHealthTag ?: "Clean Healthy Nutrition") }

    var isVeg by remember { mutableStateOf(mealToEdit?.isVeg ?: true) }
    var selectedCatId by remember { mutableStateOf(mealToEdit?.categoryId ?: categories.firstOrNull()?.id ?: "cat_protein") }
    var imageUrl by remember { mutableStateOf(mealToEdit?.imageUrl ?: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=700&auto=format&fit=crop&q=80") }

    AlertDialog(
      onDismissRequest = {
        showAddMealDialog = false
        mealToEdit = null
      },
      containerColor = NutrolixSurface,
      title = { Text(if (isEdit) "Edit Food Item & Nutrition" else "Add New Food Item", fontWeight = FontWeight.Bold, color = NutrolixDarkGreen) },
      text = {
        LazyColumn(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
          item {
            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Dish Name *") }, colors = nutrolixTextFieldColors(), singleLine = true, modifier = Modifier.fillMaxWidth())
          }
          item {
            OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description & Ingredients") }, colors = nutrolixTextFieldColors(), maxLines = 2, modifier = Modifier.fillMaxWidth())
          }
          item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
              OutlinedTextField(
                value = discountedPriceText,
                onValueChange = { discountedPriceText = it },
                label = { Text("Offer Price ₹") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                colors = nutrolixTextFieldColors(),
                modifier = Modifier.weight(1f)
              )
              OutlinedTextField(
                value = priceText,
                onValueChange = { priceText = it },
                label = { Text("MRP ₹") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                colors = nutrolixTextFieldColors(),
                modifier = Modifier.weight(1f)
              )
            }
          }

          item {
            Surface(
              shape = RoundedCornerShape(8.dp),
              color = NutrolixLightGreen,
              modifier = Modifier.fillMaxWidth().padding(top = 4.dp)
            ) {
              Text(
                text = "🥗 DEDICATED NUTRITION FACTS (Per Single Serving)",
                fontSize = 11.sp,
                fontWeight = FontWeight.ExtraBold,
                color = NutrolixDarkGreen,
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
              )
            }
          }

          item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
              OutlinedTextField(
                value = proteinText,
                onValueChange = { proteinText = it },
                label = { Text("Protein (g) *") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                colors = nutrolixTextFieldColors(),
                modifier = Modifier.weight(1f)
              )
              OutlinedTextField(
                value = caloriesText,
                onValueChange = { caloriesText = it },
                label = { Text("Calories (kcal) *") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                colors = nutrolixTextFieldColors(),
                modifier = Modifier.weight(1f)
              )
            }
          }

          item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
              OutlinedTextField(
                value = carbsText,
                onValueChange = { carbsText = it },
                label = { Text("Carbs (g)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                colors = nutrolixTextFieldColors(),
                modifier = Modifier.weight(1f)
              )
              OutlinedTextField(
                value = fatsText,
                onValueChange = { fatsText = it },
                label = { Text("Fats (g)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                colors = nutrolixTextFieldColors(),
                modifier = Modifier.weight(1f)
              )
              OutlinedTextField(
                value = fiberText,
                onValueChange = { fiberText = it },
                label = { Text("Fiber (g)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                colors = nutrolixTextFieldColors(),
                modifier = Modifier.weight(1f)
              )
            }
          }

          item {
            OutlinedTextField(
              value = healthTag,
              onValueChange = { healthTag = it },
              label = { Text("Nutrition Badge Tag") },
              singleLine = true,
              colors = nutrolixTextFieldColors(),
              modifier = Modifier.fillMaxWidth()
            )
          }

          item {
            OutlinedTextField(
              value = imageUrl,
              onValueChange = { imageUrl = it },
              label = { Text("Photo URL") },
              singleLine = true,
              colors = nutrolixTextFieldColors(),
              modifier = Modifier.fillMaxWidth()
            )
          }

          item {
            Row(
              modifier = Modifier.fillMaxWidth(),
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
              Text("Dietary Type:", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
              FilterChip(
                selected = isVeg,
                onClick = { isVeg = true },
                label = { Text("100% Veg 🌱") }
              )
              FilterChip(
                selected = !isVeg,
                onClick = { isVeg = false },
                label = { Text("Non-Veg 🍗") }
              )
            }
          }

          item {
            Column(modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) {
              Text(
                text = "Food Category (Change / Select): *",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = NutrolixDarkGreen
              )
              Spacer(modifier = Modifier.height(4.dp))
              androidx.compose.foundation.lazy.LazyRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
              ) {
                items(categories, key = { it.id }) { cat ->
                  val isSelected = selectedCatId == cat.id
                  FilterChip(
                    selected = isSelected,
                    onClick = { selectedCatId = cat.id },
                    label = {
                      Text(
                        text = "${cat.iconEmoji} ${cat.title}",
                        fontSize = 11.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                      )
                    },
                    colors = FilterChipDefaults.filterChipColors(
                      selectedContainerColor = NutrolixPrimaryGreen,
                      selectedLabelColor = Color.White
                    )
                  )
                }
              }
            }
          }
        }
      },
      confirmButton = {
        Button(
          onClick = {
            if (name.isNotBlank()) {
              val p = priceText.toDoubleOrNull() ?: 299.0
              val dp = discountedPriceText.toDoubleOrNull() ?: (p * 0.85)
              val prot = proteinText.toIntOrNull() ?: 30
              val cal = caloriesText.toIntOrNull() ?: 350
              val carb = carbsText.toIntOrNull() ?: 25
              val fat = fatsText.toIntOrNull() ?: 10
              val fib = fiberText.toIntOrNull() ?: 5

              if (isEdit && mealToEdit != null) {
                onUpdateMeal(
                  mealToEdit!!.copy(
                    name = name,
                    description = description,
                    price = p,
                    discountedPrice = dp,
                    proteinGrams = prot,
                    calories = cal,
                    carbsGrams = carb,
                    fatsGrams = fat,
                    fiberGrams = fib,
                    verifiedHealthTag = healthTag,
                    isVeg = isVeg,
                    categoryId = selectedCatId,
                    imageUrl = imageUrl
                  )
                )
              } else {
                onAddMeal(
                  MealItem(
                    id = "meal_${UUID.randomUUID().toString().take(6)}",
                    name = name,
                    description = description,
                    categoryId = selectedCatId,
                    price = p,
                    discountedPrice = dp,
                    imageUrl = imageUrl,
                    isVeg = isVeg,
                    proteinGrams = prot,
                    calories = cal,
                    carbsGrams = carb,
                    fatsGrams = fat,
                    fiberGrams = fib,
                    verifiedHealthTag = healthTag,
                    isAvailable = true
                  )
                )
              }
              showAddMealDialog = false
              mealToEdit = null
            }
          },
          colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen)
        ) {
          Text(if (isEdit) "Save Meal & Macros" else "Add Meal to Menu")
        }
      },
      dismissButton = {
        TextButton(onClick = {
          showAddMealDialog = false
          mealToEdit = null
        }) {
          Text("Cancel", color = NutrolixDarkGreen)
        }
      }
    )
  }

  // -------------------------------------------------------------
  // DIALOG: ADD / EDIT COUPON (Requirement 4)
  // -------------------------------------------------------------
  if (showAddCouponDialog || couponToEdit != null) {
    val isEdit = couponToEdit != null
    var code by remember { mutableStateOf(couponToEdit?.code ?: "") }
    var title by remember { mutableStateOf(couponToEdit?.title ?: "") }
    var discountType by remember { mutableStateOf(couponToEdit?.discountType ?: DiscountType.FIXED_AMOUNT) }
    var discountValueText by remember { mutableStateOf(couponToEdit?.discountValue?.toInt()?.toString() ?: "50") }
    var minOrderText by remember { mutableStateOf(couponToEdit?.minOrder?.toInt()?.toString() ?: "199") }
    var maxDiscountText by remember { mutableStateOf(couponToEdit?.maxDiscount?.toInt()?.toString() ?: "100") }
    var description by remember { mutableStateOf(couponToEdit?.description ?: "") }

    AlertDialog(
      onDismissRequest = {
        showAddCouponDialog = false
        couponToEdit = null
      },
      containerColor = NutrolixSurface,
      title = { Text(if (isEdit) "Edit Coupon" else "Add New Coupon", fontWeight = FontWeight.Bold, color = NutrolixDarkGreen) },
      text = {
        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
          OutlinedTextField(
            value = code,
            onValueChange = { code = it.uppercase() },
            label = { Text("Coupon Code (e.g. FIT50) *") },
            colors = nutrolixTextFieldColors(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
          )

          OutlinedTextField(
            value = title,
            onValueChange = { title = it },
            label = { Text("Offer Title (e.g. Flat ₹50 OFF) *") },
            colors = nutrolixTextFieldColors(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
          )

          // Discount Type Toggle
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
          ) {
            FilterChip(
              selected = discountType == DiscountType.FIXED_AMOUNT,
              onClick = { discountType = DiscountType.FIXED_AMOUNT },
              label = { Text("₹ Fixed Amount") }
            )
            FilterChip(
              selected = discountType == DiscountType.PERCENTAGE,
              onClick = { discountType = DiscountType.PERCENTAGE },
              label = { Text("% Percentage") }
            )
          }

          Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
              value = discountValueText,
              onValueChange = { discountValueText = it },
              label = { Text(if (discountType == DiscountType.PERCENTAGE) "Discount %" else "Discount ₹") },
              keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
              colors = nutrolixTextFieldColors(),
              modifier = Modifier.weight(1f)
            )

            OutlinedTextField(
              value = minOrderText,
              onValueChange = { minOrderText = it },
              label = { Text("Min Order ₹") },
              keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
              colors = nutrolixTextFieldColors(),
              modifier = Modifier.weight(1f)
            )
          }

          if (discountType == DiscountType.PERCENTAGE) {
            OutlinedTextField(
              value = maxDiscountText,
              onValueChange = { maxDiscountText = it },
              label = { Text("Max Discount Cap ₹") },
              keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
              colors = nutrolixTextFieldColors(),
              modifier = Modifier.fillMaxWidth()
            )
          }

          OutlinedTextField(
            value = description,
            onValueChange = { description = it },
            label = { Text("Description / Terms") },
            colors = nutrolixTextFieldColors(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
          )
        }
      },
      confirmButton = {
        Button(
          onClick = {
            if (code.isNotBlank()) {
              val dVal = discountValueText.toDoubleOrNull() ?: 50.0
              val minOrd = minOrderText.toDoubleOrNull() ?: 199.0
              val maxDisc = maxDiscountText.toDoubleOrNull() ?: 100.0

              val cpn = Coupon(
                code = code.trim().uppercase(),
                title = title.ifBlank { "Special Discount" },
                discountAmount = dVal,
                minOrder = minOrd,
                description = description,
                discountType = discountType,
                discountValue = dVal,
                maxDiscount = maxDisc,
                isAutoApplied = false,
                isActive = true
              )

              if (isEdit) {
                onUpdateCoupon(cpn)
              } else {
                onAddCoupon(cpn)
              }
              showAddCouponDialog = false
              couponToEdit = null
            }
          },
          colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen)
        ) {
          Text(if (isEdit) "Save Coupon" else "Create Coupon")
        }
      },
      dismissButton = {
        TextButton(onClick = {
          showAddCouponDialog = false
          couponToEdit = null
        }) {
          Text("Cancel", color = NutrolixDarkGreen)
        }
      }
    )
  }
}

@Composable
fun AdminStatChip(label: String, value: String) {
  Surface(
    shape = RoundedCornerShape(8.dp),
    color = Color.White.copy(alpha = 0.15f),
    modifier = Modifier.padding(horizontal = 2.dp)
  ) {
    Column(
      modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
      horizontalAlignment = Alignment.CenterHorizontally
    ) {
      Text(text = value, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
      Text(text = label, fontSize = 9.sp, color = NutrolixLightGreen)
    }
  }
}

/**
 * Requirement 4: WhatsApp Message Sharing & Status Updates (in proper English)
 */
fun shareOrderDetailsWhatsApp(context: android.content.Context, order: Order) {
  val cleanPhone = order.customerPhone.filter { it.isDigit() }
  val targetPhone = if (cleanPhone.length == 10) "91$cleanPhone" else cleanPhone
  val itemsSummary = order.items.joinToString("\n") { "• ${it.quantity}x ${it.meal.name} (₹${it.totalPrice.toInt()})" }

  val message = """
*NUTROLIX HEALTH KITCHEN — ORDER DETAILS* 🥗

*Order ID:* #${order.orderNumber}
*Customer:* ${order.customerName}
*Phone:* +91 ${order.customerPhone}
*Status:* ${order.status.title}
*Payment:* ${order.paymentMethod} (${order.paymentStatus})

*Items Ordered:*
$itemsSummary

*Subtotal:* ₹${order.subtotal.toInt()}
*Delivery Fee:* ₹${order.deliveryFee.toInt()}
*Tax (5%):* ₹${order.tax.toInt()}
*Grand Total:* ₹${order.total.toInt()}

*Delivery Address:*
📍 ${order.deliveryAddress}
${if (order.specialInstructions.isNotBlank()) "*Instructions:* ${order.specialInstructions}\n" else ""}
Track Live: https://nutrolix.in
  """.trimIndent()

  try {
    val encoded = java.net.URLEncoder.encode(message, "UTF-8")
    val uri = if (targetPhone.isNotBlank()) {
      android.net.Uri.parse("https://wa.me/$targetPhone?text=$encoded")
    } else {
      android.net.Uri.parse("https://api.whatsapp.com/send?text=$encoded")
    }
    val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, uri).apply {
      flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
    }
    context.startActivity(intent)
  } catch (_: Exception) {
    val shareIntent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
      type = "text/plain"
      putExtra(android.content.Intent.EXTRA_TEXT, message)
      flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
    }
    context.startActivity(android.content.Intent.createChooser(shareIntent, "Share Order Details"))
  }
}

fun sendCustomerStatusWhatsApp(context: android.content.Context, order: Order, newStatus: OrderStatus) {
  val cleanPhone = order.customerPhone.filter { it.isDigit() }
  val targetPhone = if (cleanPhone.length == 10) "91$cleanPhone" else cleanPhone

  val message = when (newStatus) {
    OrderStatus.PREPARING, OrderStatus.CONFIRMED -> {
      """
Hello *${order.customerName}*,

Your Nutrolix order *#${order.orderNumber}* has been accepted and is currently being freshly prepared in our kitchen! 👨‍🍳🥗

*Estimated Delivery:* ~25-35 minutes
*Items:* ${order.items.joinToString(", ") { "${it.quantity}x ${it.meal.name}" }}
*Delivery to:* ${order.deliveryAddress}

Track your live order in the app or visit: https://nutrolix.in
Thank you for choosing Nutrolix Clean Nutrition! ✨
      """.trimIndent()
    }
    OrderStatus.READY -> {
      """
Hello *${order.customerName}*,

Great news! Your Nutrolix order *#${order.orderNumber}* is freshly prepared, packed with fresh hygiene standards, and is ready for courier dispatch! 📦🚀

*Track live order:* https://nutrolix.in
Nutrolix Health Kitchen
      """.trimIndent()
    }
    OrderStatus.OUT_FOR_DELIVERY -> {
      """
Hello *${order.customerName}*,

Your Nutrolix order *#${order.orderNumber}* is out for delivery! 🛵💨

Our delivery partner is on the way to your doorstep at:
📍 ${order.deliveryAddress}

*Track live delivery partner:* https://nutrolix.in
      """.trimIndent()
    }
    OrderStatus.DELIVERED -> {
      """
Hello *${order.customerName}*,

Your Nutrolix order *#${order.orderNumber}* has been successfully delivered! 🎉🥗
We hope you enjoy your clean, nutritious meal.

⭐⭐⭐⭐⭐
*Please take a moment to rate and review your experience:*
Your feedback helps our kitchen team serve you the best nutrition.
👉 Rate now: https://nutrolix.in

Stay healthy & energized with Nutrolix! 💚
      """.trimIndent()
    }
    else -> {
      """
Hello *${order.customerName}*,

Update on your Nutrolix order *#${order.orderNumber}*: Current status is *${newStatus.title}*.

*Track live:* https://nutrolix.in
      """.trimIndent()
    }
  }

  try {
    val encoded = java.net.URLEncoder.encode(message, "UTF-8")
    val uri = if (targetPhone.isNotBlank()) {
      android.net.Uri.parse("https://wa.me/$targetPhone?text=$encoded")
    } else {
      android.net.Uri.parse("https://api.whatsapp.com/send?text=$encoded")
    }
    val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, uri).apply {
      flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
    }
    context.startActivity(intent)
  } catch (_: Exception) {
    val shareIntent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
      type = "text/plain"
      putExtra(android.content.Intent.EXTRA_TEXT, message)
      flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
    }
    context.startActivity(android.content.Intent.createChooser(shareIntent, "Send Status to Customer"))
  }
}

