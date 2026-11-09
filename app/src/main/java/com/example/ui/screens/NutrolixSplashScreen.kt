package com.example.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ElectricBolt
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.ui.theme.*
import kotlinx.coroutines.delay

@Composable
fun NutrolixSplashScreen(
  onSplashFinished: () -> Unit,
  modifier: Modifier = Modifier
) {
  val scale = remember { Animatable(0.6f) }
  val alpha = remember { Animatable(0f) }
  val badgeOffset = remember { Animatable(30f) }

  LaunchedEffect(Unit) {
    // Smooth entrance animation
    scale.animateTo(
      targetValue = 1.0f,
      animationSpec = spring(
        dampingRatio = Spring.DampingRatioMediumBouncy,
        stiffness = Spring.StiffnessLow
      )
    )
    alpha.animateTo(
      targetValue = 1.0f,
      animationSpec = tween(durationMillis = 600, easing = LinearOutSlowInEasing)
    )
    badgeOffset.animateTo(
      targetValue = 0f,
      animationSpec = tween(durationMillis = 500, easing = FastOutSlowInEasing)
    )

    // Stay visible briefly then transition smoothly to main app
    delay(1500)
    onSplashFinished()
  }

  Box(
    modifier = modifier
      .fillMaxSize()
      .background(
        brush = Brush.verticalGradient(
          colors = listOf(
            NutrolixForestGreen,
            NutrolixDarkGreen,
            Color(0xFF0A2215)
          )
        )
      ),
    contentAlignment = Alignment.Center
  ) {
    Column(
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center,
      modifier = Modifier
        .scale(scale.value)
        .alpha(alpha.value)
        .padding(24.dp)
    ) {
      // Official Nutrolix Logo with subtle glowing ring
      Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier.size(120.dp)
      ) {
        Surface(
          shape = CircleShape,
          color = NutrolixOrange.copy(alpha = 0.2f),
          modifier = Modifier.size(120.dp)
        ) {}

        Surface(
          shape = CircleShape,
          color = Color.White.copy(alpha = 0.12f),
          modifier = Modifier.size(105.dp)
        ) {}

        Image(
          painter = painterResource(id = R.drawable.nutrolix_app_icon),
          contentDescription = "Nutrolix Logo",
          modifier = Modifier
            .size(86.dp)
            .clip(RoundedCornerShape(20.dp))
        )
      }

      Spacer(modifier = Modifier.height(20.dp))

      // Brand Title
      Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
      ) {
        Text(
          text = "Nutrolix",
          fontSize = 32.sp,
          fontWeight = FontWeight.ExtraBold,
          color = Color.White,
          letterSpacing = 1.sp
        )
        Text(
          text = "™",
          fontSize = 16.sp,
          fontWeight = FontWeight.Bold,
          color = NutrolixOrange
        )
      }

      Spacer(modifier = Modifier.height(4.dp))

      // Brand Slogan
      Text(
        text = "Nutrition That Works",
        fontSize = 14.sp,
        fontWeight = FontWeight.SemiBold,
        color = NutrolixLightGreen,
        letterSpacing = 1.2.sp
      )

      Spacer(modifier = Modifier.height(28.dp))

      // Healthy Food & Fast Delivery Theme Badges
      Row(
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.offset(y = badgeOffset.value.dp)
      ) {
        Surface(
          shape = RoundedCornerShape(20.dp),
          color = Color.White.copy(alpha = 0.15f)
        ) {
          Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
          ) {
            Icon(Icons.Default.ElectricBolt, contentDescription = null, tint = NutrolixGold, modifier = Modifier.size(14.dp))
            Text("100% Clean Nutrition", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
          }
        }

        Surface(
          shape = RoundedCornerShape(20.dp),
          color = NutrolixOrange.copy(alpha = 0.25f)
        ) {
          Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
          ) {
            Icon(Icons.Default.LocalShipping, contentDescription = null, tint = NutrolixOrangeLight, modifier = Modifier.size(14.dp))
            Text("25 Mins Delivery", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
          }
        }
      }
    }

    // Bottom subtle indicator
    Text(
      text = "Fresh Healthy Cloud Kitchen",
      fontSize = 11.sp,
      color = NutrolixLightGreen.copy(alpha = 0.6f),
      modifier = Modifier
        .align(Alignment.BottomCenter)
        .padding(bottom = 36.dp)
    )
  }
}
