package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.example.model.CartItem
import com.example.model.Coupon
import com.example.model.StoreSettings
import com.example.ui.components.VegNonVegBadge
import com.example.ui.theme.*

@Composable
fun CartScreen(
  cartItems: List<CartItem>,
  appliedCoupon: Coupon?,
  availableCoupons: List<Coupon>,
  deliveryAddress: String,
  deliveryTip: Double,
  contactless: Boolean,
  cookingInstruction: String,
  storeSettings: StoreSettings,
  onQuantityChange: (String, Int) -> Unit,
  onApplyCoupon: (Coupon) -> Unit,
  onRemoveCoupon: () -> Unit,
  onTipChange: (Double) -> Unit,
  onContactlessToggle: (Boolean) -> Unit,
  onInstructionChange: (String) -> Unit,
  onChangeAddress: () -> Unit,
  onProceedToPay: () -> Unit,
  onBackToMenu: () -> Unit,
  modifier: Modifier = Modifier
) {
  val subtotal = cartItems.sumOf { it.totalPrice }
  val discount = appliedCoupon?.calculateDiscount(subtotal) ?: 0.0

  // Requirement 5: Free delivery threshold calculation using configured store settings
  val threshold = storeSettings.freeDeliveryAbove
  val standardDeliveryFee = storeSettings.deliveryFee // standard ₹29
  val isFreeDelivery = subtotal >= threshold
  val deliveryFee = if (isFreeDelivery) 0.0 else standardDeliveryFee
  val remainingForFree = (threshold - subtotal).coerceAtLeast(0.0)

  val tax = (subtotal - discount).coerceAtLeast(0.0) * 0.05
  val grandTotal = (subtotal - discount + deliveryFee + tax + deliveryTip).coerceAtLeast(0.0)

  val totalProtein = cartItems.sumOf { it.totalProtein }
  val totalCalories = cartItems.sumOf { it.totalCalories }

  var customCouponInput by remember { mutableStateOf("") }
  var couponError by remember { mutableStateOf<String?>(null) }

  if (cartItems.isEmpty()) {
    Box(
      modifier = modifier
        .fillMaxSize()
        .background(NutrolixBackground)
        .padding(24.dp),
      contentAlignment = Alignment.Center
    ) {
      Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = "🥗", fontSize = 56.sp)
        Spacer(modifier = Modifier.height(16.dp))
        Text(
          text = "Your Healthy Cart is Empty",
          fontSize = 20.sp,
          fontWeight = FontWeight.Bold,
          color = NutrolixTextPrimary
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
          text = "Fill it with high-protein meals, nutrition bowls & superfoods",
          fontSize = 13.sp,
          color = NutrolixTextSecondary
        )
        Spacer(modifier = Modifier.height(20.dp))
        Button(
          onClick = onBackToMenu,
          shape = RoundedCornerShape(12.dp),
          colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
          modifier = Modifier.testTag("explore_menu_button")
        ) {
          Text("Explore Nutrolix Menu", fontWeight = FontWeight.Bold)
        }
      }
    }
  } else {
    Box(modifier = modifier.fillMaxSize().background(NutrolixBackground)) {
      LazyColumn(
        modifier = Modifier
          .fillMaxSize()
          .testTag("cart_items_list"),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 120.dp)
      ) {
        // Back to Menu Header
        item {
          Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically
          ) {
            IconButton(
              onClick = onBackToMenu,
              modifier = Modifier.background(NutrolixSurface, CircleShape)
            ) {
              Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = NutrolixDarkGreen)
            }
            Spacer(modifier = Modifier.width(10.dp))
            Text(
              text = "Nutrolix Healthy Cart (${cartItems.sumOf { it.quantity }} items)",
              fontSize = 18.sp,
              fontWeight = FontWeight.Bold,
              color = NutrolixTextPrimary
            )
          }
        }

        // -------------------------------------------------------------
        // REQUIREMENT 5: HIGHLIGHT DELIVERY CHARGES AND DYNAMIC FREE DELIVERY BANNER
        // -------------------------------------------------------------
        item {
          Surface(
            shape = RoundedCornerShape(12.dp),
            color = if (isFreeDelivery) NutrolixLightGreen else NutrolixOrangeLight,
            border = androidx.compose.foundation.BorderStroke(
              width = 1.dp,
              color = if (isFreeDelivery) NutrolixPrimaryGreen else NutrolixOrange.copy(alpha = 0.5f)
            ),
            modifier = Modifier
              .fillMaxWidth()
              .padding(bottom = 12.dp)
          ) {
            Column(modifier = Modifier.padding(12.dp)) {
              Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
              ) {
                Icon(
                  imageVector = if (isFreeDelivery) Icons.Default.CheckCircle else Icons.Default.LocalShipping,
                  contentDescription = null,
                  tint = if (isFreeDelivery) NutrolixPrimaryGreen else NutrolixOrangeDark,
                  modifier = Modifier.size(20.dp)
                )

                Text(
                  text = if (isFreeDelivery) {
                    "Congratulations! You qualify for FREE delivery."
                  } else {
                    "Add ₹${remainingForFree.toInt()} more to get FREE delivery!"
                  },
                  fontSize = 13.sp,
                  fontWeight = FontWeight.Bold,
                  color = if (isFreeDelivery) NutrolixDarkGreen else NutrolixOrangeDark
                )
              }

              if (!isFreeDelivery) {
                Spacer(modifier = Modifier.height(8.dp))
                LinearProgressIndicator(
                  progress = { (subtotal / threshold).toFloat().coerceIn(0f, 1f) },
                  modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                  color = NutrolixOrange,
                  trackColor = Color.White
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                  modifier = Modifier.fillMaxWidth(),
                  horizontalArrangement = Arrangement.SpaceBetween
                ) {
                  Text(text = "Current: ₹${subtotal.toInt()}", fontSize = 10.sp, color = NutrolixTextSecondary)
                  Text(text = "Free delivery on ₹${threshold.toInt()}+", fontSize = 10.sp, color = NutrolixTextSecondary, fontWeight = FontWeight.Bold)
                }
              }
            }
          }
        }

        // Cart Items
        items(cartItems, key = { it.cartItemId }) { item ->
          Card(
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
            border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder),
            modifier = Modifier
              .fillMaxWidth()
              .padding(vertical = 5.dp)
          ) {
            Row(
              modifier = Modifier.padding(12.dp),
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
              AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                  .data(item.meal.imageUrl)
                  .crossfade(true)
                  .build(),
                contentDescription = item.meal.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                  .size(64.dp)
                  .clip(RoundedCornerShape(10.dp))
                  .background(NutrolixSurfaceVariant)
              )

              Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                  VegNonVegBadge(isVeg = item.meal.isVeg)
                  Text(
                    text = item.meal.name,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = NutrolixTextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                  )
                }

                Text(
                  text = "Portion: ${item.selectedPortion.name}",
                  fontSize = 11.sp,
                  color = NutrolixTextSecondary
                )

                if (item.selectedAddons.isNotEmpty()) {
                  Text(
                    text = "+ " + item.selectedAddons.joinToString { it.name },
                    fontSize = 10.sp,
                    color = NutrolixPrimaryGreen,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                  )
                }

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                  text = "₹${item.totalPrice.toInt()}",
                  fontSize = 14.sp,
                  fontWeight = FontWeight.ExtraBold,
                  color = NutrolixDarkGreen
                )
              }

              // Quantity Stepper
              Surface(
                shape = RoundedCornerShape(8.dp),
                color = NutrolixSurfaceVariant,
                border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder)
              ) {
                Row(
                  verticalAlignment = Alignment.CenterVertically,
                  horizontalArrangement = Arrangement.spacedBy(4.dp),
                  modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                ) {
                  IconButton(
                    onClick = { onQuantityChange(item.cartItemId, item.quantity - 1) },
                    modifier = Modifier.size(26.dp)
                  ) {
                    Icon(
                      imageVector = if (item.quantity == 1) Icons.Default.Delete else Icons.Default.Remove,
                      contentDescription = "Decrease",
                      tint = NutrolixDarkGreen,
                      modifier = Modifier.size(14.dp)
                    )
                  }

                  Text(
                    text = "${item.quantity}",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = NutrolixTextPrimary,
                    modifier = Modifier.padding(horizontal = 4.dp)
                  )

                  IconButton(
                    onClick = { onQuantityChange(item.cartItemId, item.quantity + 1) },
                    modifier = Modifier.size(26.dp)
                  ) {
                    Icon(Icons.Default.Add, contentDescription = "Increase", tint = NutrolixDarkGreen, modifier = Modifier.size(14.dp))
                  }
                }
              }
            }
          }
        }

        // Cart Nutrition Summary Banner
        item {
          Spacer(modifier = Modifier.height(8.dp))
          Surface(
            shape = RoundedCornerShape(12.dp),
            color = NutrolixLightGreen,
            modifier = Modifier.fillMaxWidth()
          ) {
            Row(
              modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.CenterVertically
            ) {
              Text("Total Macro Fuel in Cart", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NutrolixDarkGreen)
              Text("⚡ ${totalProtein}g Protein • ${totalCalories} kcal", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = NutrolixPrimaryGreen)
            }
          }
        }

        // Cooking Instructions Field (Using global readable text colors)
        item {
          Spacer(modifier = Modifier.height(12.dp))
          OutlinedTextField(
            value = cookingInstruction,
            onValueChange = onInstructionChange,
            label = { Text("Special Kitchen Instruction") },
            placeholder = { Text("e.g. Less spicy, dressing on the side, no onions...") },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = nutrolixTextFieldColors(),
            singleLine = true
          )
        }

        // -------------------------------------------------------------
        // REQUIREMENT 4: COUPON & OFFERS (No auto application)
        // -------------------------------------------------------------
        item {
          Spacer(modifier = Modifier.height(14.dp))
          Card(
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
            border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder),
            modifier = Modifier.fillMaxWidth()
          ) {
            Column(modifier = Modifier.padding(14.dp)) {
              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
              ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                  Icon(Icons.Default.ConfirmationNumber, contentDescription = null, tint = NutrolixOrange, modifier = Modifier.size(18.dp))
                  Text("Apply Promo Coupon", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                }

                if (appliedCoupon != null) {
                  TextButton(onClick = onRemoveCoupon) {
                    Text("REMOVE", color = StatusDanger, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                  }
                }
              }

              if (appliedCoupon != null) {
                Surface(
                  shape = RoundedCornerShape(8.dp),
                  color = NutrolixLightGreen,
                  modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                ) {
                  Row(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                  ) {
                    Column {
                      Text("Code '${appliedCoupon.code}' applied", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NutrolixDarkGreen)
                      Text(appliedCoupon.title, fontSize = 11.sp, color = NutrolixTextSecondary)
                    }
                    Text("Savings: ₹${discount.toInt()}", fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = NutrolixPrimaryGreen)
                  }
                }
              } else {
                Spacer(modifier = Modifier.height(8.dp))
                // Custom coupon code entry
                Row(
                  modifier = Modifier.fillMaxWidth(),
                  horizontalArrangement = Arrangement.spacedBy(8.dp),
                  verticalAlignment = Alignment.CenterVertically
                ) {
                  OutlinedTextField(
                    value = customCouponInput,
                    onValueChange = {
                      customCouponInput = it.uppercase()
                      couponError = null
                    },
                    placeholder = { Text("Enter coupon code", fontSize = 12.sp) },
                    singleLine = true,
                    colors = nutrolixTextFieldColors(),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1f)
                  )

                  Button(
                    onClick = {
                      val match = availableCoupons.find { it.code.equals(customCouponInput.trim(), ignoreCase = true) }
                      if (match == null) {
                        couponError = "Invalid coupon code"
                      } else if (subtotal < match.minOrder) {
                        couponError = "Minimum order of ₹${match.minOrder.toInt()} required"
                      } else {
                        onApplyCoupon(match)
                        customCouponInput = ""
                        couponError = null
                      }
                    },
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
                    modifier = Modifier.height(50.dp)
                  ) {
                    Text("Apply", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                  }
                }

                couponError?.let { err ->
                  Text(text = "⚠️ $err", color = StatusDanger, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
                }

                // Available coupon pills
                if (availableCoupons.isNotEmpty()) {
                  Spacer(modifier = Modifier.height(10.dp))
                  Text("Available Offers:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = NutrolixTextSecondary)
                  Spacer(modifier = Modifier.height(6.dp))

                  availableCoupons.forEach { cpn ->
                    Surface(
                      shape = RoundedCornerShape(8.dp),
                      color = NutrolixSurfaceVariant,
                      border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder),
                      modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)
                    ) {
                      Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                      ) {
                        Column {
                          Text(cpn.code, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = NutrolixOrangeDark)
                          Text(cpn.title + " (Min ₹${cpn.minOrder.toInt()})", fontSize = 10.sp, color = NutrolixTextSecondary)
                        }

                        Button(
                          onClick = { onApplyCoupon(cpn) },
                          shape = RoundedCornerShape(6.dp),
                          colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
                          contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                          modifier = Modifier.height(28.dp)
                        ) {
                          Text("APPLY", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Delivery Partner Tip
        item {
          Spacer(modifier = Modifier.height(12.dp))
          Card(
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
            border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder),
            modifier = Modifier.fillMaxWidth()
          ) {
            Column(modifier = Modifier.padding(14.dp)) {
              Text("Say Thanks with a Tip for Rider", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
              Text("100% of this tip goes to your delivery partner", fontSize = 11.sp, color = NutrolixTextSecondary)
              Spacer(modifier = Modifier.height(8.dp))
              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
              ) {
                listOf(0.0, 20.0, 30.0, 50.0).forEach { tip ->
                  val isSelected = deliveryTip == tip
                  Surface(
                    onClick = { onTipChange(tip) },
                    shape = RoundedCornerShape(8.dp),
                    color = if (isSelected) NutrolixDarkGreen else NutrolixSurfaceVariant,
                    modifier = Modifier.weight(1f).height(34.dp)
                  ) {
                    Box(contentAlignment = Alignment.Center) {
                      Text(
                        text = if (tip == 0.0) "None" else "₹${tip.toInt()}",
                        fontSize = 12.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                        color = if (isSelected) Color.White else NutrolixTextPrimary
                      )
                    }
                  }
                }
              }
            }
          }
        }

        // Bill Summary Card
        item {
          Spacer(modifier = Modifier.height(12.dp))
          Card(
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
            border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder),
            modifier = Modifier.fillMaxWidth()
          ) {
            Column(modifier = Modifier.padding(14.dp)) {
              Text("Bill Details", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
              Spacer(modifier = Modifier.height(8.dp))

              BillRow(label = "Item Total", value = "₹${subtotal.toInt()}")
              if (discount > 0) {
                BillRow(label = "Coupon Savings", value = "-₹${discount.toInt()}", valueColor = StatusSuccess)
              }
              // Requirement 5: Prominently display delivery fee (standard ₹29 or FREE)
              BillRow(
                label = "Delivery Fee (Standard ₹${standardDeliveryFee.toInt()})",
                value = if (isFreeDelivery) "FREE" else "₹${deliveryFee.toInt()}",
                valueColor = if (isFreeDelivery) StatusSuccess else NutrolixTextPrimary
              )
              BillRow(label = "Govt. Taxes (GST 5%)", value = "₹${tax.toInt()}")
              if (deliveryTip > 0) {
                BillRow(label = "Delivery Partner Tip", value = "₹${deliveryTip.toInt()}")
              }

              HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = NutrolixBorder)

              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
              ) {
                Text(
                  text = "Grand Total",
                  fontSize = 16.sp,
                  fontWeight = FontWeight.ExtraBold,
                  color = NutrolixTextPrimary
                )
                Text(
                  text = "₹${grandTotal.toInt()}",
                  fontSize = 18.sp,
                  fontWeight = FontWeight.ExtraBold,
                  color = NutrolixDarkGreen
                )
              }
            }
          }
        }

        // -------------------------------------------------------------
        // REQUIREMENT 1: MANDATORY DELIVERY ADDRESS CHECK
        // -------------------------------------------------------------
        item {
          Spacer(modifier = Modifier.height(12.dp))
          val hasValidAddress = deliveryAddress.trim().isNotBlank()

          Surface(
            onClick = onChangeAddress,
            shape = RoundedCornerShape(14.dp),
            color = if (hasValidAddress) NutrolixSurfaceVariant else Color(0xFFFFEBEE),
            border = androidx.compose.foundation.BorderStroke(
              width = 1.dp,
              color = if (hasValidAddress) NutrolixBorder else StatusDanger
            ),
            modifier = Modifier.fillMaxWidth()
          ) {
            Row(
              modifier = Modifier.padding(12.dp),
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.SpaceBetween
            ) {
              Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.weight(1f)
              ) {
                Icon(
                  imageVector = if (hasValidAddress) Icons.Default.LocationOn else Icons.Default.Warning,
                  contentDescription = null,
                  tint = if (hasValidAddress) NutrolixOrange else StatusDanger
                )
                Column {
                  Text(
                    text = if (hasValidAddress) "Delivering to *" else "⚠️ Delivery Address Required *",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (hasValidAddress) NutrolixTextSecondary else StatusDanger
                  )
                  Text(
                    text = if (hasValidAddress) deliveryAddress else "Tap to add / detect your delivery address (Maps)",
                    fontSize = 12.sp,
                    fontWeight = if (hasValidAddress) FontWeight.SemiBold else FontWeight.Bold,
                    color = if (hasValidAddress) NutrolixTextPrimary else StatusDanger,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                  )
                }
              }
              Text(
                text = if (hasValidAddress) "CHANGE" else "ADD ADDRESS",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = if (hasValidAddress) NutrolixPrimaryGreen else StatusDanger
              )
            }
          }
        }
      }

      // Sticky Bottom Proceed to Pay Button
      Surface(
        color = NutrolixSurface,
        shadowElevation = 8.dp,
        modifier = Modifier
          .align(Alignment.BottomCenter)
          .fillMaxWidth()
      ) {
        Column(
          modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
          Button(
            onClick = onProceedToPay,
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
            modifier = Modifier
              .fillMaxWidth()
              .height(52.dp)
              .testTag("proceed_to_pay_button")
          ) {
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.CenterVertically
            ) {
              Column {
                Text(
                  text = "₹${grandTotal.toInt()}",
                  fontSize = 16.sp,
                  fontWeight = FontWeight.ExtraBold,
                  color = Color.White
                )
                Text(
                  text = "TOTAL TO PAY",
                  fontSize = 9.sp,
                  color = NutrolixLightGreen
                )
              }

              Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                  text = "Select Payment & Order",
                  fontSize = 15.sp,
                  fontWeight = FontWeight.Bold,
                  color = Color.White
                )
                Spacer(modifier = Modifier.width(6.dp))
                Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = Color.White)
              }
            }
          }
        }
      }
    }
  }
}

@Composable
fun BillRow(
  label: String,
  value: String,
  valueColor: Color = NutrolixTextPrimary
) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .padding(vertical = 3.dp),
    horizontalArrangement = Arrangement.SpaceBetween
  ) {
    Text(text = label, fontSize = 12.sp, color = NutrolixTextSecondary)
    Text(text = value, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = valueColor)
  }
}
