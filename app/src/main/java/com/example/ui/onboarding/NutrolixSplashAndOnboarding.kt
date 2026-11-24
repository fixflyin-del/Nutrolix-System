package com.example.ui.onboarding

import android.content.Context
import androidx.activity.compose.BackHandler
import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.LocalOffer
import androidx.compose.material.icons.rounded.Restaurant
import androidx.compose.material.icons.rounded.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.ui.theme.AmberWarm
import com.example.ui.theme.NutrolixDarkGreen
import com.example.ui.theme.NutrolixGoldBg
import com.example.ui.theme.NutrolixLightGreen
import com.example.ui.theme.NutrolixOrange
import com.example.ui.theme.NutrolixPrimaryGreen
import com.example.ui.theme.NutrolixTextPrimary
import com.example.ui.theme.NutrolixTextSecondary
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

enum class NutrolixLaunchStage {
  SPLASH,
  ONBOARDING,
  MAIN
}

object NutrolixOnboardingPrefs {
  private const val PREFS_NAME = "nutrolix_onboarding_prefs"
  private const val KEY_COMPLETED = "onboarding_completed"

  fun isCompleted(context: Context): Boolean {
    return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getBoolean(KEY_COMPLETED, false)
  }

  fun markCompleted(context: Context) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_COMPLETED, true)
      .apply()
  }
}

private data class OnboardingSlideData(
  @DrawableRes val imageRes: Int,
  @StringRes val imageCdRes: Int,
  @StringRes val badgeRes: Int,
  val badgeIcon: ImageVector,
  val badgeBg: Color,
  val badgeTint: Color,
  val accentColor: Color,
  val cardHaloStart: Color,
  val cardHaloEnd: Color,
  @StringRes val titleEnRes: Int,
  @StringRes val titleHiRes: Int,
  @StringRes val descEnRes: Int,
  @StringRes val descHiRes: Int,
  val chipResIds: List<Int>
)

private val NutrolixOnboardingSlides = listOf(
  OnboardingSlideData(
    imageRes = R.drawable.img_onboard_healthy_meals_1795550337332,
    imageCdRes = R.string.onboarding_s1_image_cd,
    badgeRes = R.string.onboarding_s1_badge,
    badgeIcon = Icons.Rounded.Restaurant,
    badgeBg = NutrolixLightGreen,
    badgeTint = NutrolixPrimaryGreen,
    accentColor = NutrolixPrimaryGreen,
    cardHaloStart = Color(0xFFE7F7EE),
    cardHaloEnd = Color(0xFFFFF8EB),
    titleEnRes = R.string.onboarding_s1_title_en,
    titleHiRes = R.string.onboarding_s1_title_hi,
    descEnRes = R.string.onboarding_s1_desc_en,
    descHiRes = R.string.onboarding_s1_desc_hi,
    chipResIds = listOf(
      R.string.onboarding_s1_chip_1,
      R.string.onboarding_s1_chip_2,
      R.string.onboarding_s1_chip_3
    )
  ),
  OnboardingSlideData(
    imageRes = R.drawable.img_onboard_protein_store_1795550336700,
    imageCdRes = R.string.onboarding_s2_image_cd,
    badgeRes = R.string.onboarding_s2_badge,
    badgeIcon = Icons.Rounded.Verified,
    badgeBg = Color(0xFFE4F6EE),
    badgeTint = NutrolixDarkGreen,
    accentColor = NutrolixPrimaryGreen,
    cardHaloStart = Color(0xFFE6F6F0),
    cardHaloEnd = Color(0xFFFEF7E5),
    titleEnRes = R.string.onboarding_s2_title_en,
    titleHiRes = R.string.onboarding_s2_title_hi,
    descEnRes = R.string.onboarding_s2_desc_en,
    descHiRes = R.string.onboarding_s2_desc_hi,
    chipResIds = listOf(
      R.string.onboarding_s2_chip_1,
      R.string.onboarding_s2_chip_2,
      R.string.onboarding_s2_chip_3
    )
  ),
  OnboardingSlideData(
    imageRes = R.drawable.img_onboard_fast_delivery_1795550351201,
    imageCdRes = R.string.onboarding_s3_image_cd,
    badgeRes = R.string.onboarding_s3_badge,
    badgeIcon = Icons.Rounded.LocalOffer,
    badgeBg = NutrolixGoldBg,
    badgeTint = NutrolixOrange,
    accentColor = NutrolixPrimaryGreen,
    cardHaloStart = Color(0xFFFFF6E4),
    cardHaloEnd = Color(0xFFE9F8F0),
    titleEnRes = R.string.onboarding_s3_title_en,
    titleHiRes = R.string.onboarding_s3_title_hi,
    descEnRes = R.string.onboarding_s3_desc_en,
    descHiRes = R.string.onboarding_s3_desc_hi,
    chipResIds = listOf(
      R.string.onboarding_s3_chip_1,
      R.string.onboarding_s3_chip_2,
      R.string.onboarding_s3_chip_3
    )
  )
)

@Composable
fun NutrolixNativeSplashScreen(
  onSplashFinished: () -> Unit,
  modifier: Modifier = Modifier
) {
  val logoScale = remember { Animatable(0.76f) }
  val contentAlpha = remember { Animatable(0f) }

  LaunchedEffect(Unit) {
    launch {
      logoScale.animateTo(
        targetValue = 1f,
        animationSpec = spring(
          dampingRatio = Spring.DampingRatioMediumBouncy,
          stiffness = Spring.StiffnessLow
        )
      )
    }
    launch {
      contentAlpha.animateTo(
        targetValue = 1f,
        animationSpec = tween(durationMillis = 520, easing = FastOutSlowInEasing)
      )
    }
    delay(1650L)
    onSplashFinished()
  }

  val infiniteTransition = rememberInfiniteTransition(label = "splash_dots")
  val pulsePhase by infiniteTransition.animateFloat(
    initialValue = 0f,
    targetValue = 3f,
    animationSpec = infiniteRepeatable(
      animation = tween(durationMillis = 900, easing = LinearEasing),
      repeatMode = RepeatMode.Restart
    ),
    label = "splash_dot_phase"
  )

  Box(
    modifier = modifier
      .fillMaxSize()
      .background(
        Brush.verticalGradient(
          colors = listOf(
            Color(0xFFF0FAF4),
            Color(0xFFFFFFFF),
            Color(0xFFE9F6EE)
          )
        )
      )
      .statusBarsPadding()
      .navigationBarsPadding()
      .testTag("nutrolix_native_splash"),
    contentAlignment = Alignment.Center
  ) {
    // Soft decorative botanical glow shapes
    Box(
      modifier = Modifier
        .align(Alignment.TopEnd)
        .offset(x = 70.dp, y = (-50).dp)
        .size(220.dp)
        .clip(CircleShape)
        .background(NutrolixPrimaryGreen.copy(alpha = 0.08f))
    )
    Box(
      modifier = Modifier
        .align(Alignment.BottomStart)
        .offset(x = (-75).dp, y = 60.dp)
        .size(240.dp)
        .clip(CircleShape)
        .background(AmberWarm.copy(alpha = 0.09f))
    )

    Column(
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center,
      modifier = Modifier
        .padding(horizontal = 32.dp)
        .alpha(contentAlpha.value)
    ) {
      Surface(
        modifier = Modifier
          .size(118.dp)
          .scale(logoScale.value)
          .shadow(
            elevation = 18.dp,
            shape = RoundedCornerShape(32.dp),
            ambientColor = NutrolixPrimaryGreen.copy(alpha = 0.24f),
            spotColor = NutrolixPrimaryGreen.copy(alpha = 0.24f)
          ),
        shape = RoundedCornerShape(32.dp),
        color = Color.White,
        border = BorderStroke(1.5.dp, NutrolixPrimaryGreen.copy(alpha = 0.14f))
      ) {
        Box(
          contentAlignment = Alignment.Center,
          modifier = Modifier.padding(16.dp)
        ) {
          Image(
            painter = painterResource(id = R.drawable.nutrolix_logo),
            contentDescription = stringResource(id = R.string.splash_logo_cd),
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize()
          )
        }
      }

      Spacer(modifier = Modifier.height(24.dp))

      Text(
        text = stringResource(id = R.string.splash_brand_title),
        style = MaterialTheme.typography.headlineMedium.copy(
          fontWeight = FontWeight.ExtraBold,
          letterSpacing = 3.5.sp,
          color = NutrolixDarkGreen
        )
      )

      Spacer(modifier = Modifier.height(8.dp))

      Surface(
        shape = RoundedCornerShape(50),
        color = NutrolixLightGreen,
        border = BorderStroke(1.dp, NutrolixPrimaryGreen.copy(alpha = 0.15f))
      ) {
        Text(
          text = "${stringResource(id = R.string.splash_tagline_en)}  •  ${stringResource(id = R.string.splash_tagline_hi)}",
          style = MaterialTheme.typography.labelLarge.copy(
            fontWeight = FontWeight.SemiBold,
            color = NutrolixPrimaryGreen
          ),
          textAlign = TextAlign.Center,
          modifier = Modifier.padding(horizontal = 16.dp, vertical = 7.dp)
        )
      }

      Spacer(modifier = Modifier.height(34.dp))

      Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
      ) {
        repeat(3) { index ->
          val distance = kotlin.math.abs(pulsePhase - index)
          val active = (1f - distance.coerceIn(0f, 1f))
          Box(
            modifier = Modifier
              .size(8.dp + (active * 3f).dp)
              .clip(CircleShape)
              .background(
                NutrolixPrimaryGreen.copy(alpha = 0.25f + (active * 0.75f))
              )
          )
        }
      }
    }

    Text(
      text = stringResource(id = R.string.splash_footer_trust),
      style = MaterialTheme.typography.labelMedium.copy(
        color = NutrolixTextSecondary,
        fontWeight = FontWeight.Medium,
        letterSpacing = 0.4.sp
      ),
      modifier = Modifier
        .align(Alignment.BottomCenter)
        .padding(bottom = 26.dp)
        .alpha(contentAlpha.value)
    )
  }
}

@Composable
fun NutrolixOnboardingFlow(
  onComplete: () -> Unit,
  modifier: Modifier = Modifier
) {
  val slides = NutrolixOnboardingSlides
  val pagerState = rememberPagerState(pageCount = { slides.size })
  val coroutineScope = rememberCoroutineScope()
  val isLastPage = pagerState.currentPage == slides.lastIndex

  // Handle system back cleanly across onboarding slides
  BackHandler(enabled = pagerState.currentPage > 0) {
    coroutineScope.launch {
      pagerState.animateScrollToPage(pagerState.currentPage - 1)
    }
  }

  Box(
    modifier = modifier
      .fillMaxSize()
      .background(
        Brush.verticalGradient(
          colors = listOf(
            Color(0xFFF4FBF7),
            Color(0xFFFFFFFF),
            Color(0xFFF6FBF8)
          )
        )
      )
      .statusBarsPadding()
      .navigationBarsPadding()
      .testTag("nutrolix_onboarding_screen"),
    contentAlignment = Alignment.TopCenter
  ) {
    Column(
      modifier = Modifier
        .fillMaxSize()
        .widthIn(max = 540.dp)
        .padding(horizontal = 20.dp),
      horizontalAlignment = Alignment.CenterHorizontally
    ) {
      // Top Navigation Bar: Brand Pill + Skip Button
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(top = 12.dp, bottom = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Surface(
          shape = RoundedCornerShape(50),
          color = Color.White,
          border = BorderStroke(1.dp, NutrolixPrimaryGreen.copy(alpha = 0.14f)),
          shadowElevation = 2.dp
        ) {
          Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)
          ) {
            Image(
              painter = painterResource(id = R.drawable.nutrolix_logo),
              contentDescription = stringResource(id = R.string.splash_logo_cd),
              contentScale = ContentScale.Fit,
              modifier = Modifier.size(22.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
              text = stringResource(id = R.string.app_name),
              style = MaterialTheme.typography.titleSmall.copy(
                fontWeight = FontWeight.Bold,
                color = NutrolixDarkGreen
              )
            )
            Spacer(modifier = Modifier.width(8.dp))
            Box(
              modifier = Modifier
                .clip(RoundedCornerShape(50))
                .background(NutrolixLightGreen)
                .padding(horizontal = 8.dp, vertical = 2.dp)
            ) {
              Text(
                text = stringResource(
                  id = R.string.onboarding_step_format,
                  pagerState.currentPage + 1,
                  slides.size
                ),
                style = MaterialTheme.typography.labelSmall.copy(
                  fontWeight = FontWeight.Bold,
                  color = NutrolixPrimaryGreen
                )
              )
            }
          }
        }

        AnimatedVisibility(
          visible = !isLastPage,
          enter = fadeIn(),
          exit = fadeOut()
        ) {
          TextButton(
            onClick = onComplete,
            modifier = Modifier
              .heightIn(min = 48.dp)
              .testTag("onboarding_skip_button"),
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
          ) {
            Text(
              text = stringResource(id = R.string.onboarding_skip),
              style = MaterialTheme.typography.labelLarge.copy(
                fontWeight = FontWeight.SemiBold,
                color = NutrolixTextSecondary
              )
            )
          }
        }
      }

      // Main 3-Slide Pager
      HorizontalPager(
        state = pagerState,
        modifier = Modifier
          .fillMaxWidth()
          .weight(1f)
          .testTag("onboarding_pager")
      ) { pageIndex ->
        OnboardingSlideContent(
          slide = slides[pageIndex],
          slideIndex = pageIndex
        )
      }

      // Bottom Controls: Animated Dots + Back + Next / Get Started
      Surface(
        modifier = Modifier
          .fillMaxWidth()
          .padding(top = 8.dp, bottom = 18.dp),
        shape = RoundedCornerShape(26.dp),
        color = Color.White,
        border = BorderStroke(1.dp, NutrolixPrimaryGreen.copy(alpha = 0.10f)),
        shadowElevation = 6.dp
      ) {
        Row(
          modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          // Page indicator dots
          Row(
            horizontalArrangement = Arrangement.spacedBy(7.dp),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(start = 4.dp)
          ) {
            repeat(slides.size) { idx ->
              val isSelected = pagerState.currentPage == idx
              val dotWidth by animateDpAsState(
                targetValue = if (isSelected) 28.dp else 8.dp,
                animationSpec = spring(
                  dampingRatio = Spring.DampingRatioMediumBouncy,
                  stiffness = Spring.StiffnessMediumLow
                ),
                label = "onboarding_dot_$idx"
              )
              Box(
                modifier = Modifier
                  .height(8.dp)
                  .width(dotWidth)
                  .clip(CircleShape)
                  .background(
                    if (isSelected) NutrolixPrimaryGreen else NutrolixPrimaryGreen.copy(alpha = 0.22f)
                  )
              )
            }
          }

          Row(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
          ) {
            AnimatedVisibility(
              visible = pagerState.currentPage > 0,
              enter = fadeIn() + scaleIn(initialScale = 0.85f),
              exit = fadeOut() + scaleOut(targetScale = 0.85f)
            ) {
              FilledTonalIconButton(
                onClick = {
                  coroutineScope.launch {
                    pagerState.animateScrollToPage((pagerState.currentPage - 1).coerceAtLeast(0))
                  }
                },
                colors = IconButtonDefaults.filledTonalIconButtonColors(
                  containerColor = NutrolixLightGreen,
                  contentColor = NutrolixDarkGreen
                ),
                modifier = Modifier
                  .size(48.dp)
                  .testTag("onboarding_back_button")
              ) {
                Icon(
                  imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                  contentDescription = stringResource(id = R.string.onboarding_back_cd)
                )
              }
            }

            Button(
              onClick = {
                if (isLastPage) {
                  onComplete()
                } else {
                  coroutineScope.launch {
                    pagerState.animateScrollToPage(pagerState.currentPage + 1)
                  }
                }
              },
              shape = RoundedCornerShape(16.dp),
              colors = ButtonDefaults.buttonColors(
                containerColor = NutrolixPrimaryGreen,
                contentColor = Color.White
              ),
              elevation = ButtonDefaults.buttonElevation(
                defaultElevation = 3.dp,
                pressedElevation = 1.dp
              ),
              contentPadding = PaddingValues(horizontal = 20.dp, vertical = 14.dp),
              modifier = Modifier
                .heightIn(min = 50.dp)
                .testTag(if (isLastPage) "onboarding_get_started_button" else "onboarding_next_button")
            ) {
              Text(
                text = stringResource(
                  id = if (isLastPage) R.string.onboarding_get_started else R.string.onboarding_next
                ),
                style = MaterialTheme.typography.labelLarge.copy(
                  fontWeight = FontWeight.Bold,
                  fontSize = 14.sp
                ),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
              )
              Spacer(modifier = Modifier.width(8.dp))
              Icon(
                imageVector = if (isLastPage) Icons.Rounded.CheckCircle else Icons.AutoMirrored.Rounded.ArrowForward,
                contentDescription = null,
                modifier = Modifier.size(19.dp)
              )
            }
          }
        }
      }
    }
  }
}

@Composable
private fun OnboardingSlideContent(
  slide: OnboardingSlideData,
  slideIndex: Int
) {
  val scrollState = rememberScrollState()

  Column(
    modifier = Modifier
      .fillMaxSize()
      .verticalScroll(scrollState)
      .padding(vertical = 8.dp)
      .testTag("onboarding_slide_${slideIndex + 1}"),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center
  ) {
    // Stylized Cartoon Illustration Card
    Box(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 6.dp),
      contentAlignment = Alignment.Center
    ) {
      Surface(
        modifier = Modifier
          .fillMaxWidth()
          .widthIn(max = 340.dp)
          .aspectRatio(1.06f)
          .shadow(
            elevation = 16.dp,
            shape = RoundedCornerShape(32.dp),
            ambientColor = NutrolixPrimaryGreen.copy(alpha = 0.16f),
            spotColor = NutrolixPrimaryGreen.copy(alpha = 0.16f)
          ),
        shape = RoundedCornerShape(32.dp),
        color = Color.White,
        border = BorderStroke(1.5.dp, Color.White)
      ) {
        Box(
          modifier = Modifier
            .fillMaxSize()
            .background(
              Brush.linearGradient(
                colors = listOf(slide.cardHaloStart, slide.cardHaloEnd)
              )
            )
        ) {
          Image(
            painter = painterResource(id = slide.imageRes),
            contentDescription = stringResource(id = slide.imageCdRes),
            contentScale = ContentScale.Crop,
            modifier = Modifier
              .fillMaxSize()
              .clip(RoundedCornerShape(32.dp))
          )

          // Floating Category / Feature Badge
          Surface(
            modifier = Modifier
              .align(Alignment.TopStart)
              .padding(14.dp),
            shape = RoundedCornerShape(50),
            color = Color.White.copy(alpha = 0.94f),
            border = BorderStroke(1.dp, slide.badgeTint.copy(alpha = 0.18f)),
            shadowElevation = 4.dp
          ) {
            Row(
              verticalAlignment = Alignment.CenterVertically,
              modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
              Icon(
                imageVector = slide.badgeIcon,
                contentDescription = null,
                tint = slide.badgeTint,
                modifier = Modifier.size(16.dp)
              )
              Spacer(modifier = Modifier.width(6.dp))
              Text(
                text = stringResource(id = slide.badgeRes),
                style = MaterialTheme.typography.labelMedium.copy(
                  fontWeight = FontWeight.Bold,
                  color = NutrolixTextPrimary
                )
              )
            }
          }
        }
      }
    }

    Spacer(modifier = Modifier.height(22.dp))

    // English Primary Headline
    Text(
      text = stringResource(id = slide.titleEnRes),
      style = MaterialTheme.typography.headlineSmall.copy(
        fontWeight = FontWeight.ExtraBold,
        color = NutrolixTextPrimary,
        lineHeight = 30.sp
      ),
      textAlign = TextAlign.Center,
      modifier = Modifier.padding(horizontal = 8.dp)
    )

    Spacer(modifier = Modifier.height(6.dp))

    // Hindi Highlight Headline
    Text(
      text = stringResource(id = slide.titleHiRes),
      style = MaterialTheme.typography.titleMedium.copy(
        fontWeight = FontWeight.Bold,
        color = slide.accentColor,
        lineHeight = 24.sp
      ),
      textAlign = TextAlign.Center,
      modifier = Modifier.padding(horizontal = 8.dp)
    )

    Spacer(modifier = Modifier.height(12.dp))

    // Clean Bilingual Description Card
    Surface(
      shape = RoundedCornerShape(20.dp),
      color = Color.White.copy(alpha = 0.92f),
      border = BorderStroke(1.dp, NutrolixPrimaryGreen.copy(alpha = 0.10f)),
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 4.dp)
    ) {
      Column(
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally
      ) {
        Text(
          text = stringResource(id = slide.descEnRes),
          style = MaterialTheme.typography.bodyMedium.copy(
            color = NutrolixTextPrimary.copy(alpha = 0.88f),
            lineHeight = 20.sp
          ),
          textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
          text = stringResource(id = slide.descHiRes),
          style = MaterialTheme.typography.bodyMedium.copy(
            color = NutrolixTextSecondary,
            fontWeight = FontWeight.Medium,
            lineHeight = 21.sp
          ),
          textAlign = TextAlign.Center
        )
      }
    }

    Spacer(modifier = Modifier.height(14.dp))

    // Feature Highlight Chips Row
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 4.dp),
      horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
      verticalAlignment = Alignment.CenterVertically
    ) {
      slide.chipResIds.forEach { chipRes ->
        Surface(
          shape = RoundedCornerShape(50),
          color = slide.badgeBg,
          border = BorderStroke(1.dp, slide.badgeTint.copy(alpha = 0.18f))
        ) {
          Text(
            text = stringResource(id = chipRes),
            style = MaterialTheme.typography.labelSmall.copy(
              fontWeight = FontWeight.Bold,
              color = slide.badgeTint
            ),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 11.dp, vertical = 6.dp)
          )
        }
      }
    }
  }
}
