package com.example.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import kotlinx.coroutines.delay

@Composable
fun NutrolixSplashScreen(
  onSplashFinished: () -> Unit,
  modifier: Modifier = Modifier
) {
  val infinite = rememberInfiniteTransition(label = "nutrolix-splash")
  val logoScale by infinite.animateFloat(
    initialValue = 0.98f,
    targetValue = 1.035f,
    animationSpec = infiniteRepeatable(tween(1350, easing = FastOutSlowInEasing), RepeatMode.Reverse),
    label = "logo-pulse"
  )
  val orbitRotation by infinite.animateFloat(
    initialValue = 0f,
    targetValue = 360f,
    animationSpec = infiniteRepeatable(tween(26000, easing = LinearEasing), RepeatMode.Restart),
    label = "orbit-rotation"
  )
  val floatOffset by infinite.animateFloat(
    initialValue = 0f,
    targetValue = 9f,
    animationSpec = infiniteRepeatable(tween(1900, easing = FastOutSlowInEasing), RepeatMode.Reverse),
    label = "food-float"
  )
  val entrance by animateFloatAsState(
    targetValue = 1f,
    animationSpec = tween(750, easing = FastOutSlowInEasing),
    label = "splash-entrance"
  )

  LaunchedEffect(Unit) {
    delay(2700)
    onSplashFinished()
  }

  Box(
    modifier = modifier.fillMaxSize().background(Color.White),
    contentAlignment = Alignment.Center
  ) {
    // Fine dotted orbit with warm orange and Nutrolix-green markers.
    Box(
      modifier = Modifier
        .size(310.dp)
        .alpha(0.9f)
        .rotate(orbitRotation)
        .border(1.dp, Color(0x33218B68), CircleShape)
    )
    Box(
      modifier = Modifier
        .size(270.dp)
        .border(1.dp, Color(0x1A07865F), CircleShape)
    )

    SplashFoodChip("🥜", "PROTEIN", Modifier.align(Alignment.TopStart).padding(start = 22.dp, top = 112.dp).offset(y = floatOffset.dp))
    SplashFoodChip("🫐", "ANTIOXIDANTS", Modifier.align(Alignment.TopEnd).padding(end = 22.dp, top = 112.dp).offset(y = (-floatOffset).dp))
    SplashFoodChip("🌾", "WHOLE GRAINS", Modifier.align(Alignment.CenterStart).padding(start = 7.dp).offset(y = floatOffset.dp))
    SplashFoodChip("🥦", "GREENS", Modifier.align(Alignment.CenterEnd).padding(end = 7.dp).offset(y = (-floatOffset).dp))
    SplashFoodChip("🍓", "FRESH FOODS", Modifier.align(Alignment.BottomStart).padding(start = 28.dp, bottom = 105.dp).offset(y = (-floatOffset).dp))
    SplashFoodChip("🌰", "HEALTHY SNACKS", Modifier.align(Alignment.BottomEnd).padding(end = 28.dp, bottom = 105.dp).offset(y = floatOffset.dp))

    Text(
      text = "↗",
      color = Color(0xFFE9A12B),
      fontSize = 34.sp,
      modifier = Modifier.align(Alignment.TopCenter).padding(top = 205.dp).rotate(12f).alpha(0.75f)
    )
    Text(
      text = "↗",
      color = Color(0xFFE9A12B),
      fontSize = 34.sp,
      modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 190.dp).rotate(192f).alpha(0.75f)
    )

    Column(
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center,
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 38.dp)
        .scale(0.94f + 0.06f * entrance)
        .alpha(entrance)
    ) {
      Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
          .fillMaxWidth()
          .height(116.dp)
      ) {
        Box(
          modifier = Modifier
            .width(270.dp)
            .height(102.dp)
            .rotate(-4f)
            .border(1.dp, Color(0x33218B68), RoundedCornerShape(28.dp))
        )
        Image(
          painter = painterResource(id = R.drawable.nutrolix_logo),
          contentDescription = "Official Nutrolix logo",
          contentScale = ContentScale.Fit,
          modifier = Modifier
            .width(250.dp)
            .height(100.dp)
            .scale(logoScale)
        )
      }

      Spacer(modifier = Modifier.height(15.dp))
      Text(
        text = "NUTRITION THAT WORKS",
        fontSize = 13.sp,
        fontWeight = FontWeight.ExtraBold,
        color = Color(0xFF07865F),
        letterSpacing = 2.1.sp
      )
      Box(
        modifier = Modifier
          .padding(top = 18.dp)
          .width(82.dp)
          .height(3.dp)
          .background(
            brush = androidx.compose.ui.graphics.Brush.horizontalGradient(
              listOf(Color(0xFF07865F), Color(0xFFF0A02A))
            ),
            shape = RoundedCornerShape(10.dp)
          )
      )
      Row(
        horizontalArrangement = Arrangement.spacedBy(7.dp),
        modifier = Modifier.padding(top = 23.dp)
      ) {
        repeat(3) { index ->
          val dotAlpha by infinite.animateFloat(
            initialValue = 0.25f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
              animation = tween(700, delayMillis = index * 160),
              repeatMode = RepeatMode.Reverse
            ),
            label = "loading-dot-$index"
          )
          Box(
            modifier = Modifier
              .size(6.dp)
              .alpha(dotAlpha)
              .background(Color(0xFF0B9369), CircleShape)
          )
        }
      }
    }

    Text(
      text = "EVERYDAY GOODNESS  ·  THOUGHTFUL NUTRITION",
      fontSize = 8.sp,
      fontWeight = FontWeight.Bold,
      letterSpacing = 1.25.sp,
      color = Color(0xFF91A59B),
      modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 28.dp)
    )
  }
}

@Composable
private fun SplashFoodChip(
  emoji: String,
  label: String,
  modifier: Modifier = Modifier
) {
  Surface(
    modifier = modifier.size(68.dp),
    shape = RoundedCornerShape(21.dp),
    color = Color.White,
    shadowElevation = 7.dp,
    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE4F2EB))
  ) {
    Column(
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center
    ) {
      Text(text = emoji, fontSize = 27.sp)
      Text(
        text = label,
        fontSize = 6.sp,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = 0.45.sp,
        color = Color(0xFF82958B),
        maxLines = 1
      )
    }
  }
}
