package com.example.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.model.UserRole
import com.example.ui.theme.*

@Composable
fun NutrolixTopBar(
  currentRole: UserRole,
  deliveryAddress: String,
  cartItemCount: Int,
  cartTotal: Double,
  onAddressClick: () -> Unit,
  onMenuClick: () -> Unit,
  onCartClick: () -> Unit,
  onWhatsAppClick: () -> Unit = {},
  onLogoutAdmin: () -> Unit = {},
  adminEmail: String = "",
  showAddress: Boolean = true,
  modifier: Modifier = Modifier
) {
  Surface(
    modifier = modifier.fillMaxWidth(),
    color = NutrolixSurface,
    shadowElevation = 2.dp
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .statusBarsPadding()
        .padding(horizontal = 16.dp, vertical = 10.dp)
    ) {
      if (currentRole == UserRole.CUSTOMER) {
        // --- 100% Focused Customer Header (No direct admin access) ---
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          // Left: Brand Logo & Title
          Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.testTag("brand_header")
          ) {
            Image(
              painter = painterResource(id = R.drawable.nutrolix_app_icon),
              contentDescription = "Nutrolix Logo",
              modifier = Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(8.dp))
            )

            Column {
              Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                  text = "Nutrolix",
                  fontSize = 20.sp,
                  fontWeight = FontWeight.ExtraBold,
                  color = NutrolixDarkGreen
                )
                Text(
                  text = "™",
                  fontSize = 11.sp,
                  fontWeight = FontWeight.Bold,
                  color = NutrolixOrange
                )
              }
              Text(
                text = "Nutrition that works",
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium,
                color = NutrolixPrimaryGreen,
                letterSpacing = 0.5.sp
              )
            }
          }

          // Top Right Action: WhatsApp Support + Cart Pill
          Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
          ) {
            // WhatsApp Support Button (+919076254354)
            Surface(
              onClick = onWhatsAppClick,
              shape = CircleShape,
              color = Color(0xFF25D366),
              shadowElevation = 2.dp,
              modifier = Modifier
                .size(36.dp)
                .testTag("top_whatsapp_support_button")
            ) {
              Box(contentAlignment = Alignment.Center) {
                Icon(
                  imageVector = Icons.Default.Chat,
                  contentDescription = "WhatsApp Support",
                  tint = Color.White,
                  modifier = Modifier.size(20.dp)
                )
              }
            }

            // Cart Pill
            Surface(
              onClick = onCartClick,
              shape = RoundedCornerShape(20.dp),
              color = NutrolixPrimaryGreen,
              modifier = Modifier.testTag("top_cart_button")
            ) {
              Row(
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
              ) {
                Icon(
                  imageVector = Icons.Default.ShoppingCart,
                  contentDescription = "Shopping Cart",
                  tint = Color.White,
                  modifier = Modifier.size(16.dp)
                )
                if (cartItemCount > 0) {
                  Text(
                    text = "$cartItemCount | ₹${cartTotal.toInt()}",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                  )
                } else {
                  Text(
                    text = "Cart",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                  )
                }
              }
            }
          }
        }

        if (showAddress && deliveryAddress.isNotBlank()) {
          Spacer(modifier = Modifier.height(8.dp))

          // Deliver to Location Chip
          Surface(
            onClick = onAddressClick,
            shape = RoundedCornerShape(8.dp),
            color = NutrolixSurfaceVariant,
            modifier = Modifier
              .fillMaxWidth()
              .testTag("location_selector")
          ) {
            Row(
              modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
              Icon(
                imageVector = Icons.Default.LocationOn,
                contentDescription = "Location",
                tint = NutrolixOrange,
                modifier = Modifier.size(16.dp)
              )
              Text(
                text = "Deliver to: $deliveryAddress",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = NutrolixTextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
              )
              Icon(
                imageVector = Icons.Default.KeyboardArrowDown,
                contentDescription = "Select Location",
                tint = NutrolixTextSecondary,
                modifier = Modifier.size(16.dp)
              )
            }
          }
        }
      } else {
        // --- Dedicated Admin Control Mode Header ---
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
          ) {
            Icon(
              imageVector = Icons.Default.AdminPanelSettings,
              contentDescription = null,
              tint = NutrolixOrange,
              modifier = Modifier.size(24.dp)
            )
            Column {
              Text(
                text = "Nutrolix Store Admin",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = NutrolixDarkGreen
              )
              if (adminEmail.isNotBlank()) {
                Text(
                  text = "Logged in: $adminEmail",
                  fontSize = 11.sp,
                  color = NutrolixPrimaryGreen,
                  fontWeight = FontWeight.Medium
                )
              } else {
                Text(
                  text = "Store Operations & Control",
                  fontSize = 11.sp,
                  color = NutrolixTextSecondary
                )
              }
            }
          }

          // Secure Admin Logout Button
          Button(
            onClick = onLogoutAdmin,
            shape = RoundedCornerShape(10.dp),
            colors = ButtonDefaults.buttonColors(containerColor = StatusDanger),
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
            modifier = Modifier.height(34.dp).testTag("admin_logout_button")
          ) {
            Row(
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
              Icon(
                Icons.Default.Lock,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(14.dp)
              )
              Text(
                text = "Logout Admin",
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
