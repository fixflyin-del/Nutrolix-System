package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.TextFieldColors
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Nutrolix Light Color Scheme (Default)
private val NutrolixLightColorScheme = lightColorScheme(
  primary = NutrolixPrimaryGreen,
  onPrimary = Color.White,
  primaryContainer = NutrolixLightGreen,
  onPrimaryContainer = NutrolixDarkGreen,
  secondary = NutrolixOrange,
  onSecondary = Color.White,
  secondaryContainer = NutrolixOrangeLight,
  onSecondaryContainer = NutrolixOrangeDark,
  tertiary = NutrolixAccentGreen,
  onTertiary = Color.White,
  background = NutrolixBackground,
  onBackground = NutrolixTextPrimary,
  surface = NutrolixSurface,
  onSurface = NutrolixTextPrimary, // Explicit dark charcoal text on surfaces
  surfaceVariant = NutrolixSurfaceVariant,
  onSurfaceVariant = NutrolixTextSecondary,
  outline = NutrolixBorder
)

// Nutrolix Dark Color Scheme with guaranteed dark readable text on light cards/dialogs
private val NutrolixDarkColorScheme = darkColorScheme(
  primary = NutrolixPrimaryGreen,
  onPrimary = Color.White,
  primaryContainer = NutrolixLightGreen,
  onPrimaryContainer = NutrolixDarkGreen,
  secondary = NutrolixOrange,
  onSecondary = Color.White,
  secondaryContainer = NutrolixOrangeLight,
  onSecondaryContainer = NutrolixOrangeDark,
  tertiary = NutrolixAccentGreen,
  onTertiary = Color.White,
  background = NutrolixBackground,
  onBackground = NutrolixTextPrimary,
  surface = NutrolixSurface,
  onSurface = NutrolixTextPrimary, // NEVER white on light surface
  surfaceVariant = NutrolixSurfaceVariant,
  onSurfaceVariant = NutrolixTextSecondary,
  outline = NutrolixBorder
)

/**
 * Global TextFieldColors helper ensuring entered text is ALWAYS dark charcoal / dark green
 * and placeholder is a clear, visible muted gray across all forms and dialogs.
 */
@Composable
fun nutrolixTextFieldColors(): TextFieldColors = OutlinedTextFieldDefaults.colors(
  focusedTextColor = NutrolixTextPrimary,
  unfocusedTextColor = NutrolixTextPrimary,
  focusedPlaceholderColor = NutrolixTextSecondary,
  unfocusedPlaceholderColor = NutrolixTextSecondary.copy(alpha = 0.8f),
  focusedLabelColor = NutrolixDarkGreen,
  unfocusedLabelColor = NutrolixTextSecondary,
  focusedBorderColor = NutrolixPrimaryGreen,
  unfocusedBorderColor = NutrolixBorder,
  cursorColor = NutrolixPrimaryGreen,
  focusedContainerColor = Color.White,
  unfocusedContainerColor = Color.White,
  focusedSupportingTextColor = NutrolixTextSecondary,
  unfocusedSupportingTextColor = NutrolixTextSecondary,
  errorTextColor = StatusDanger,
  errorContainerColor = Color.White,
  errorBorderColor = StatusDanger,
  errorLabelColor = StatusDanger
)

@Composable
fun MyApplicationTheme(
  darkTheme: Boolean = false, // Force consistent crisp Nutrolix light theme across all devices
  dynamicColor: Boolean = false,
  content: @Composable () -> Unit
) {
  val colorScheme = if (darkTheme) NutrolixDarkColorScheme else NutrolixLightColorScheme

  MaterialTheme(
    colorScheme = colorScheme,
    typography = Typography,
    content = content
  )
}
