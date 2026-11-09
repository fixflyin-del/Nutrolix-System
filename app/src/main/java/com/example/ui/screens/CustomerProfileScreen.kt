package com.example.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.Order
import com.example.model.UserProfile
import com.example.ui.theme.*

@Composable
fun CustomerProfileScreen(
  userProfile: UserProfile,
  pastOrders: List<Order>,
  onOpenAuth: () -> Unit,
  onLogout: () -> Unit,
  onSelectAddress: (String) -> Unit,
  onReorder: (Order) -> Unit,
  onOrderClick: (Order) -> Unit = {},
  onBack: () -> Unit,
  modifier: Modifier = Modifier
) {
  Box(modifier = modifier.fillMaxSize().background(NutrolixBackground)) {
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .testTag("customer_profile_screen"),
      contentPadding = PaddingValues(16.dp)
    ) {
      // 1. Top Header
      item {
        Row(
          modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 16.dp),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
          IconButton(
            onClick = onBack,
            modifier = Modifier.background(NutrolixSurface, CircleShape)
          ) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = NutrolixDarkGreen)
          }

          Text(
            text = "My Nutrolix Account",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = NutrolixTextPrimary
          )
        }
      }

      // 2. Profile Card or Guest Banner
      item {
        if (userProfile.isLoggedIn) {
          Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = NutrolixDarkGreen),
            modifier = Modifier
              .fillMaxWidth()
              .padding(bottom = 16.dp)
          ) {
            Column(modifier = Modifier.padding(18.dp)) {
              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
              ) {
                Row(
                  verticalAlignment = Alignment.CenterVertically,
                  horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                  Box(
                    modifier = Modifier
                      .size(50.dp)
                      .background(NutrolixPrimaryGreen, CircleShape),
                    contentAlignment = Alignment.Center
                  ) {
                    Text(
                      text = userProfile.name.take(1).uppercase().ifEmpty { "C" },
                      fontSize = 22.sp,
                      fontWeight = FontWeight.Bold,
                      color = Color.White
                    )
                  }

                  Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                      text = userProfile.name.ifEmpty { "Nutrolix Customer" },
                      fontSize = 17.sp,
                      fontWeight = FontWeight.Bold,
                      color = Color.White
                    )
                    if (userProfile.phone.isNotBlank()) {
                      Text(
                        text = "📱 WhatsApp: +91 ${userProfile.phone}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = NutrolixLightGreen
                      )
                    } else {
                      Text(
                        text = "📱 WhatsApp: Not Added Yet",
                        fontSize = 12.sp,
                        color = NutrolixLightGreen.copy(alpha = 0.8f)
                      )
                    }
                    if (userProfile.email.isNotBlank()) {
                      Text(
                        text = "✉️ ${userProfile.email}",
                        fontSize = 11.sp,
                        color = Color.White.copy(alpha = 0.85f)
                      )
                    }
                  }
                }

                Surface(
                  shape = RoundedCornerShape(12.dp),
                  color = NutrolixPrimaryGreen
                ) {
                  Text(
                    text = "Active Account",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                  )
                }
              }

              Spacer(modifier = Modifier.height(14.dp))
              HorizontalDivider(color = Color.White.copy(alpha = 0.2f))
              Spacer(modifier = Modifier.height(10.dp))

              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
              ) {
                Text(
                  text = "Verified Google Account",
                  fontSize = 11.sp,
                  color = NutrolixLightGreen
                )

                OutlinedButton(
                  onClick = onLogout,
                  colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                  shape = RoundedCornerShape(8.dp),
                  contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                  modifier = Modifier.height(34.dp).testTag("customer_logout_button")
                ) {
                  Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = null, modifier = Modifier.size(14.dp))
                  Spacer(modifier = Modifier.width(4.dp))
                  Text("Logout", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
              }
            }
          }
        } else {
          // Guest State: Direct Google 1-Click Signup/Login (Requirement 2)
          Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
            border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder),
            modifier = Modifier
              .fillMaxWidth()
              .padding(bottom = 16.dp)
          ) {
            Column(
              modifier = Modifier.padding(18.dp),
              horizontalAlignment = Alignment.CenterHorizontally
            ) {
              Box(
                modifier = Modifier
                  .size(54.dp)
                  .background(NutrolixLightGreen, CircleShape),
                contentAlignment = Alignment.Center
              ) {
                Icon(
                  Icons.Default.AccountCircle,
                  contentDescription = null,
                  tint = NutrolixDarkGreen,
                  modifier = Modifier.size(36.dp)
                )
              }

              Spacer(modifier = Modifier.height(10.dp))

              Text(
                text = "Welcome to Nutrolix",
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = NutrolixTextPrimary
              )

              Text(
                text = "Register/Login with direct Google with one click to manage saved addresses, track live deliveries, and view invoices.",
                fontSize = 12.sp,
                color = NutrolixTextSecondary,
                modifier = Modifier.padding(top = 4.dp, bottom = 14.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
              )

              Button(
                onClick = onOpenAuth,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
                modifier = Modifier
                  .fillMaxWidth()
                  .height(46.dp)
                  .testTag("profile_login_button")
              ) {
                Surface(shape = CircleShape, color = Color.White, modifier = Modifier.size(22.dp)) {
                  Box(contentAlignment = Alignment.Center) {
                    Text("G", color = Color(0xFF4285F4), fontSize = 13.sp, fontWeight = FontWeight.Black)
                  }
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text("Continue with Google (1-Click)", fontWeight = FontWeight.Bold, fontSize = 13.sp)
              }
            }
          }
        }
      }

      // 3. Saved Delivery Addresses
      item {
        Text("Saved Delivery Addresses", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
        Spacer(modifier = Modifier.height(8.dp))
      }

      if (userProfile.savedAddresses.isEmpty()) {
        item {
          Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
          ) {
            Text(
              text = "No saved addresses yet. Add your building/flat details during checkout or via the address detector.",
              fontSize = 12.sp,
              color = NutrolixTextSecondary,
              modifier = Modifier.padding(14.dp)
            )
          }
        }
      } else {
        items(userProfile.savedAddresses) { addr ->
          val isSelected = addr == userProfile.currentAddress
          Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
            border = if (isSelected) androidx.compose.foundation.BorderStroke(1.5.dp, NutrolixPrimaryGreen) else null,
            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
          ) {
            Row(
              modifier = Modifier.padding(12.dp),
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.SpaceBetween
            ) {
              Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
              ) {
                Icon(
                  Icons.Default.LocationOn,
                  contentDescription = null,
                  tint = if (isSelected) NutrolixPrimaryGreen else NutrolixTextSecondary,
                  modifier = Modifier.size(18.dp)
                )
                Text(
                  text = addr,
                  fontSize = 12.sp,
                  color = NutrolixTextPrimary,
                  fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                )
              }

              if (!isSelected) {
                TextButton(onClick = { onSelectAddress(addr) }) {
                  Text("Select", color = NutrolixPrimaryGreen, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
              } else {
                Surface(
                  shape = RoundedCornerShape(6.dp),
                  color = NutrolixLightGreen
                ) {
                  Text(
                    text = "Active",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = NutrolixDarkGreen,
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                  )
                }
              }
            }
          }
        }
      }

      // 4. Past Orders (Only show for logged-in user)
      item {
        Spacer(modifier = Modifier.height(14.dp))
        Text("Past Orders & Invoices", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
        Spacer(modifier = Modifier.height(8.dp))
      }

      if (!userProfile.isLoggedIn) {
        item {
          Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
            border = androidx.compose.foundation.BorderStroke(1.dp, NutrolixBorder),
            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
          ) {
            Column(
              modifier = Modifier.padding(16.dp),
              horizontalAlignment = Alignment.CenterHorizontally
            ) {
              Icon(
                Icons.Default.Lock,
                contentDescription = null,
                tint = NutrolixPrimaryGreen,
                modifier = Modifier.size(28.dp)
              )
              Spacer(modifier = Modifier.height(6.dp))
              Text(
                text = "Sign in to view your orders & invoices",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = NutrolixTextPrimary
              )
              Text(
                text = "Your past orders and digital invoices are securely linked to your Google account.",
                fontSize = 11.sp,
                color = NutrolixTextSecondary,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp, bottom = 10.dp)
              )
              Button(
                onClick = onOpenAuth,
                colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
                shape = RoundedCornerShape(8.dp),
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
              ) {
                Text("Sign in with Google", fontSize = 12.sp, fontWeight = FontWeight.Bold)
              }
            }
          }
        }
      } else {
        val userOrders = pastOrders.filter { ord ->
          (userProfile.email.isNotBlank() && ord.customerEmail.equals(userProfile.email, ignoreCase = true)) ||
          (userProfile.phone.isNotBlank() && ord.customerPhone == userProfile.phone)
        }
        if (userOrders.isEmpty()) {
          item {
            Card(
              shape = RoundedCornerShape(12.dp),
              colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
              modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
            ) {
              Text(
                text = "No orders placed yet with this account. Explore our high-protein clean meals!",
                fontSize = 12.sp,
                color = NutrolixTextSecondary,
                modifier = Modifier.padding(14.dp)
              )
            }
          }
        } else {
          items(userOrders) { ord ->
            Card(
              shape = RoundedCornerShape(12.dp),
              colors = CardDefaults.cardColors(containerColor = NutrolixSurface),
              modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp)
                .clickable { onOrderClick(ord) }
            ) {
              Column(modifier = Modifier.padding(12.dp)) {
                Row(
                  modifier = Modifier.fillMaxWidth(),
                  horizontalArrangement = Arrangement.SpaceBetween,
                  verticalAlignment = Alignment.CenterVertically
                ) {
                  Column {
                    Text(text = ord.orderNumber, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = NutrolixTextPrimary)
                    Text(text = "Total ₹${ord.total.toInt()} • ${ord.items.size} items", fontSize = 11.sp, color = NutrolixTextSecondary)
                  }

                  Button(
                    onClick = { onReorder(ord) },
                    colors = ButtonDefaults.buttonColors(containerColor = NutrolixPrimaryGreen),
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
