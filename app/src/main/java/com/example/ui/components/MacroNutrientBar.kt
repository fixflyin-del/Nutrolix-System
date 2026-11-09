package com.example.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*

@Composable
fun VegNonVegBadge(
  isVeg: Boolean,
  modifier: Modifier = Modifier
) {
  val borderColor = if (isVeg) VegGreen else NonVegBrown
  val fillColor = if (isVeg) VegGreen else NonVegBrown

  Box(
    modifier = modifier
      .size(16.dp)
      .border(1.5.dp, borderColor, RoundedCornerShape(3.dp))
      .padding(2.5.dp),
    contentAlignment = Alignment.Center
  ) {
    Canvas(modifier = Modifier.fillMaxSize()) {
      if (isVeg) {
        drawCircle(
          color = fillColor,
          radius = size.minDimension / 2f
        )
      } else {
        // Equilateral triangle for non-veg (FSSAI standard)
        val path = Path().apply {
          moveTo(size.width / 2f, 0f)
          lineTo(size.width, size.height)
          lineTo(0f, size.height)
          close()
        }
        drawPath(path, color = fillColor)
      }
    }
  }
}

@Composable
fun MacroNutrientRow(
  protein: Int,
  carbs: Int,
  fats: Int,
  fiber: Int,
  calories: Int,
  modifier: Modifier = Modifier,
  showFiber: Boolean = true
) {
  // Guaranteed Single-Line Nutrition Facts
  Surface(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(8.dp),
    color = NutrolixSurfaceVariant
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 8.dp, vertical = 5.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.SpaceBetween
    ) {
      Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.weight(1f, fill = false)
      ) {
        Box(
          modifier = Modifier
            .size(6.dp)
            .background(NutrolixPrimaryGreen, RoundedCornerShape(3.dp))
        )
        Text(
          text = buildString {
            append("${protein}g Protein")
            append(" • ")
            append("$calories kcal")
            append(" • ")
            append("${carbs}g Carbs")
            if (showFiber && fiber > 0) {
              append(" • ")
              append("${fiber}g Fiber")
            }
            if (fats > 0) {
              append(" • ")
              append("${fats}g Fats")
            }
          },
          fontSize = 11.sp,
          fontWeight = FontWeight.SemiBold,
          color = NutrolixDarkGreen,
          maxLines = 1,
          softWrap = false,
          overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
        )
      }

      Surface(
        shape = RoundedCornerShape(4.dp),
        color = NutrolixLightGreen
      ) {
        Text(
          text = "MACROS",
          fontSize = 9.sp,
          fontWeight = FontWeight.ExtraBold,
          color = NutrolixPrimaryGreen,
          modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
        )
      }
    }
  }
}

