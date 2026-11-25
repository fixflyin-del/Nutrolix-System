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
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.CardGiftcard
import androidx.compose.material.icons.rounded.LocalOffer
import androidx.compose.material.icons.rounded.LocalShipping
import androidx.compose.material.icons.rounded.Restaurant
import androidx.compose.material.icons.rounded.Science
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material.icons.rounded.Verified
import androidx.compose.material.icons.rounded.WorkspacePremium
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

enum class NutrolixLaunchStage {
  SPLASH,
  ONBOARDING,
  MAIN
}

object NutrolixOnboardingPrefs {
  private const val PREFS_NAME = "nutrolix_onboarding_prefs"
  private const val KEY_COMPLETED = "onboarding_v5_completed"

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

private val DeepForest = Color(0xFF041A10)
private val RichEmerald = Color(0xFF0A3320)
private val BrightMint = Color(0xFF34D399)
private val VibrantEmerald = Color(0xFF10B981)
private val WarmGold = Color(0xFFFBBF24)

private data class CertBadge(
  @StringRes val labelRes: Int,
  val icon: ImageVector
)

private val QualityCertifications = listOf(
  CertBadge(R.string.cert_lab_tested, Icons.Rounded.Science),
  CertBadge(R.string.cert_fssai, Icons.Rounded.Verified),
  CertBadge(R.string.cert_gmp, Icons.Rounded.WorkspacePremium),
  CertBadge(R.string.cert_iso, Icons.Rounded.Shield)
)

private data class EditorialSlideData(
  @DrawableRes val imageRes: Int,
  @StringRes val imageCdRes: Int,
  val photoAlignment: Alignment,
  val photoHeightFraction: Float,
  @StringRes val eyebrowRes: Int,
  val eyebrowIcon: ImageVector,
  val eyebrowAccent: Color,
  @StringRes val titleRes: Int,
  @StringRes val subtitleRes: Int,
  val showCertificationsGrid: Boolean = false,
  val showAppRewardsShowcase: Boolean = false
)

private val NutrolixEditorialSlides = listOf(
  EditorialSlideData(
    imageRes = R.drawable.img_onboard_lab_nutrolix_1795587108485,
    imageCdRes = R.string.onboarding_s1_image_cd,
    photoAlignment = Alignment.Center,
    photoHeightFraction = 0.62f,
    eyebrowRes = R.string.onboarding_s1_eyebrow,
    eyebrowIcon = Icons.Rounded.Verified,
    eyebrowAccent = BrightMint,
    titleRes = R.string.onboarding_s1_title,
    subtitleRes = R.string.onboarding_s1_subtitle,
    showCertificationsGrid = true
  ),
  EditorialSlideData(
    imageRes = R.drawable.img_onboard_meals_nutrolix_1795587102500,
    imageCdRes = R.string.onboarding_s2_image_cd,
    photoAlignment = Alignment.Center,
    photoHeightFraction = 0.68f,
    eyebrowRes = R.string.onboarding_s2_eyebrow,
    eyebrowIcon = Icons.Rounded.Restaurant,
    eyebrowAccent = BrightMint,
    titleRes = R.string.onboarding_s2_title,
    subtitleRes = R.string.onboarding_s2_subtitle
  ),
  EditorialSlideData(
    imageRes = R.drawable.img_onboard_delivery_nutrolix_1795587104630,
    imageCdRes = R.string.onboarding_s3_image_cd,
    photoAlignment = Alignment.TopCenter,
    photoHeightFraction = 0.60f,
    eyebrowRes = R.string.onboarding_s3_eyebrow,
    eyebrowIcon = Icons.Rounded.LocalOffer,
    eyebrowAccent = WarmGold,
    titleRes = R.string.onboarding_s3_title,
    subtitleRes = R.string.onboarding_s3_subtitle,
    showAppRewardsShowcase = true
  )
)

@Composable
fun NutrolixNativeSplashScreen(
  onSplashFinished: () -> Unit,
  modifier: Modifier = Modifier
) {
  val iconScale = remember { Animatable(0.74f) }
  val contentAlpha = remember { Animatable(0f) }

  LaunchedEffect(Unit) {
    launch {
      iconScale.animateTo(
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
    delay(2000L)
    onSplashFinished()
  }

  val infiniteTransition = rememberInfiniteTransition(label = "splash_motion")
  val pulsePhase by infiniteTransition.animateFloat(
    initialValue = 0f,
    targetValue = 3f,
    animationSpec = infiniteRepeatable(
      animation = tween(durationMillis = 900, easing = LinearEasing),
      repeatMode = RepeatMode.Restart
    ),
    label = "splash_pulse_phase"
  )
  val haloBreath by infiniteTransition.animateFloat(
    initialValue = 0.94f,
    targetValue = 1.07f,
    animationSpec = infiniteRepeatable(
      animation = tween(durationMillis = 1200, easing = FastOutSlowInEasing),
      repeatMode = RepeatMode.Reverse
    ),
    label = "splash_halo_breath"
  )

  Box(
    modifier = modifier
      .fillMaxSize()
      .background(
        Brush.verticalGradient(
          colors = listOf(DeepForest, RichEmerald, DeepForest)
        )
      )
      .statusBarsPadding()
      .navigationBarsPadding()
      .testTag("nutrolix_native_splash"),
    contentAlignment = Alignment.Center
  ) {
    // Subtle ambient emerald & warm gold light accents
    Box(
      modifier = Modifier
        .align(Alignment.TopEnd)
        .offset(x = 80.dp, y = (-60).dp)
        .size(260.dp)
        .clip(CircleShape)
        .background(VibrantEmerald.copy(alpha = 0.14f))
    )
    Box(
      modifier = Modifier
        .align(Alignment.BottomStart)
        .offset(x = (-80).dp, y = 70.dp)
        .size(240.dp)
        .clip(CircleShape)
        .background(WarmGold.copy(alpha = 0.09f))
    )

    Column(
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center,
      modifier = Modifier
        .padding(horizontal = 32.dp)
        .alpha(contentAlpha.value)
    ) {
      // Animated Glowing Frame with New Nutrolix Healthy Food Store Icon
      Box(contentAlignment = Alignment.Center) {
        Box(
          modifier = Modifier
            .size(146.dp)
            .scale(haloBreath)
            .clip(RoundedCornerShape(40.dp))
            .background(
              Brush.radialGradient(
                colors = listOf(
                  BrightMint.copy(alpha = 0.28f),
                  WarmGold.copy(alpha = 0.12f),
                  Color.Transparent
                )
              )
            )
        )
        Surface(
          modifier = Modifier
            .size(120.dp)
            .scale(iconScale.value),
          shape = RoundedCornerShape(32.dp),
          color = Color.White,
          shadowElevation = 20.dp,
          border = BorderStroke(2.dp, BrightMint.copy(alpha = 0.45f))
        ) {
          Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.padding(10.dp)
          ) {
            Image(
              painter = painterResource(id = R.drawable.img_nutrolix_store_icon),
              contentDescription = stringResource(id = R.string.splash_logo_cd),
              contentScale = ContentScale.Fit,
              modifier = Modifier
                .fillMaxSize()
                .clip(RoundedCornerShape(22.dp))
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(22.dp))

      Text(
        text = stringResource(id = R.string.splash_brand_title),
        style = MaterialTheme.typography.headlineMedium.copy(
          fontWeight = FontWeight.ExtraBold,
          letterSpacing = 5.sp,
          color = Color.White
        )
      )

      Spacer(modifier = Modifier.height(6.dp))

      Text(
        text = stringResource(id = R.string.splash_tagline),
        style = MaterialTheme.typography.bodyMedium.copy(
          fontWeight = FontWeight.Medium,
          letterSpacing = 1.2.sp,
          color = BrightMint.copy(alpha = 0.92f)
        )
      )

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
              .size(6.dp + (active * 3f).dp)
              .clip(CircleShape)
              .background(BrightMint.copy(alpha = 0.25f + (active * 0.75f)))
          )
        }
      }
    }

    Text(
      text = stringResource(id = R.string.splash_footer_trust),
      style = MaterialTheme.typography.labelSmall.copy(
        color = Color.White.copy(alpha = 0.62f),
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 1.1.sp
      ),
      textAlign = TextAlign.Center,
      modifier = Modifier
        .align(Alignment.BottomCenter)
        .padding(bottom = 26.dp, start = 24.dp, end = 24.dp)
        .alpha(contentAlpha.value)
    )
  }
}

@Composable
fun NutrolixOnboardingFlow(
  onComplete: () -> Unit,
  modifier: Modifier = Modifier
) {
  val slides = NutrolixEditorialSlides
  val pagerState = rememberPagerState(pageCount = { slides.size })
  val coroutineScope = rememberCoroutineScope()
  val isLastPage = pagerState.currentPage == slides.lastIndex

  BackHandler(enabled = pagerState.currentPage > 0) {
    coroutineScope.launch {
      pagerState.animateScrollToPage(pagerState.currentPage - 1)
    }
  }

  Box(
    modifier = modifier
      .fillMaxSize()
      .background(DeepForest)
      .testTag("nutrolix_onboarding_screen")
  ) {
    // Full-Bleed Editorial Photo Pager
    HorizontalPager(
      state = pagerState,
      modifier = Modifier
        .fillMaxSize()
        .testTag("onboarding_pager")
    ) { pageIndex ->
      EditorialSlidePage(
        slide = slides[pageIndex],
        slideIndex = pageIndex
      )
    }

    // Floating Frosted Top Header (Brand Icon + Skip)
    Row(
      modifier = Modifier
        .align(Alignment.TopCenter)
        .fillMaxWidth()
        .widthIn(max = 560.dp)
        .statusBarsPadding()
        .padding(horizontal = 20.dp, vertical = 14.dp),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Surface(
        shape = RoundedCornerShape(50),
        color = Color.Black.copy(alpha = 0.42f),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.22f))
      ) {
        Row(
          verticalAlignment = Alignment.CenterVertically,
          modifier = Modifier.padding(start = 6.dp, end = 14.dp, top = 5.dp, bottom = 5.dp)
        ) {
          Surface(
            shape = CircleShape,
            color = Color.White,
            modifier = Modifier.size(28.dp)
          ) {
            Image(
              painter = painterResource(id = R.drawable.img_nutrolix_store_icon),
              contentDescription = stringResource(id = R.string.splash_logo_cd),
              contentScale = ContentScale.Fit,
              modifier = Modifier
                .fillMaxSize()
                .padding(2.dp)
                .clip(CircleShape)
            )
          }
          Spacer(modifier = Modifier.width(8.dp))
          Text(
            text = stringResource(id = R.string.splash_brand_title),
            style = MaterialTheme.typography.labelLarge.copy(
              fontWeight = FontWeight.ExtraBold,
              letterSpacing = 1.6.sp,
              color = Color.White
            )
          )
        }
      }

      AnimatedVisibility(
        visible = !isLastPage,
        enter = fadeIn(),
        exit = fadeOut()
      ) {
        Surface(
          onClick = onComplete,
          shape = RoundedCornerShape(50),
          color = Color.Black.copy(alpha = 0.40f),
          border = BorderStroke(1.dp, Color.White.copy(alpha = 0.24f)),
          modifier = Modifier
            .heightIn(min = 48.dp)
            .testTag("onboarding_skip_button")
        ) {
          Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 10.dp)
          ) {
            Text(
              text = stringResource(id = R.string.onboarding_skip),
              style = MaterialTheme.typography.labelLarge.copy(
                fontWeight = FontWeight.SemiBold,
                color = Color.White
              )
            )
          }
        }
      }
    }

    // Bottom Navigation Action Bar
    Row(
      modifier = Modifier
        .align(Alignment.BottomCenter)
        .fillMaxWidth()
        .widthIn(max = 560.dp)
        .navigationBarsPadding()
        .padding(start = 24.dp, end = 24.dp, bottom = 22.dp, top = 8.dp),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      // Sleek Expanding Progress Pills
      Row(
        horizontalArrangement = Arrangement.spacedBy(7.dp),
        verticalAlignment = Alignment.CenterVertically
      ) {
        repeat(slides.size) { idx ->
          val isSelected = pagerState.currentPage == idx
          val dotWidth by animateDpAsState(
            targetValue = if (isSelected) 30.dp else 8.dp,
            animationSpec = spring(
              dampingRatio = Spring.DampingRatioMediumBouncy,
              stiffness = Spring.StiffnessMediumLow
            ),
            label = "editorial_dot_$idx"
          )
          Box(
            modifier = Modifier
              .height(6.dp)
              .width(dotWidth)
              .clip(CircleShape)
              .background(
                if (isSelected) BrightMint else Color.White.copy(alpha = 0.30f)
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
          Surface(
            shape = CircleShape,
            color = Color.White.copy(alpha = 0.14f),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.22f)),
            modifier = Modifier.size(52.dp)
          ) {
            IconButton(
              onClick = {
                coroutineScope.launch {
                  pagerState.animateScrollToPage((pagerState.currentPage - 1).coerceAtLeast(0))
                }
              },
              modifier = Modifier
                .fillMaxSize()
                .testTag("onboarding_back_button")
            ) {
              Icon(
                imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                contentDescription = stringResource(id = R.string.onboarding_back_cd),
                tint = Color.White
              )
            }
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
          shape = RoundedCornerShape(50),
          colors = ButtonDefaults.buttonColors(
            containerColor = if (isLastPage) VibrantEmerald else Color.White,
            contentColor = if (isLastPage) Color.White else DeepForest
          ),
          elevation = ButtonDefaults.buttonElevation(
            defaultElevation = 6.dp,
            pressedElevation = 2.dp
          ),
          contentPadding = PaddingValues(horizontal = 24.dp, vertical = 14.dp),
          modifier = Modifier
            .heightIn(min = 52.dp)
            .testTag(if (isLastPage) "onboarding_get_started_button" else "onboarding_next_button")
        ) {
          Text(
            text = stringResource(
              id = if (isLastPage) R.string.onboarding_get_started else R.string.onboarding_next
            ),
            style = MaterialTheme.typography.labelLarge.copy(
              fontWeight = FontWeight.Bold,
              fontSize = 15.sp,
              letterSpacing = 0.2.sp
            ),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
          )
          Spacer(modifier = Modifier.width(8.dp))
          Icon(
            imageVector = Icons.AutoMirrored.Rounded.ArrowForward,
            contentDescription = null,
            modifier = Modifier.size(19.dp)
          )
        }
      }
    }
  }
}

@Composable
private fun EditorialSlidePage(
  slide: EditorialSlideData,
  slideIndex: Int
) {
  Box(
    modifier = Modifier
      .fillMaxSize()
      .background(DeepForest)
      .testTag("onboarding_slide_${slideIndex + 1}")
  ) {
    // Upper Full-Bleed Hero Photograph (keeps Nutrolix products, meal bowls & brown packet crystal clear)
    Box(
      modifier = Modifier
        .align(Alignment.TopCenter)
        .fillMaxWidth()
        .fillMaxHeight(slide.photoHeightFraction)
    ) {
      Image(
        painter = painterResource(id = slide.imageRes),
        contentDescription = stringResource(id = slide.imageCdRes),
        contentScale = ContentScale.Crop,
        alignment = slide.photoAlignment,
        modifier = Modifier.fillMaxSize()
      )

      // Subtle top contrast veil for status bar & brand pill + smooth bottom blend into DeepForest
      Box(
        modifier = Modifier
          .fillMaxSize()
          .background(
            Brush.verticalGradient(
              colorStops = arrayOf(
                0.00f to Color.Black.copy(alpha = 0.34f),
                0.20f to Color.Transparent,
                0.72f to Color.Transparent,
                0.90f to DeepForest.copy(alpha = 0.78f),
                1.00f to DeepForest
              )
            )
          )
      )
    }

    // Editorial Single-Feature Content Block pinned cleanly in the lower forest-emerald zone
    Column(
      modifier = Modifier
        .align(Alignment.BottomCenter)
        .fillMaxWidth()
        .widthIn(max = 560.dp)
        .navigationBarsPadding()
        .padding(start = 24.dp, end = 24.dp, bottom = 92.dp),
      horizontalAlignment = Alignment.Start
    ) {
      // Minimal Eyebrow Pill
      Surface(
        shape = RoundedCornerShape(50),
        color = slide.eyebrowAccent.copy(alpha = 0.16f),
        border = BorderStroke(1.dp, slide.eyebrowAccent.copy(alpha = 0.42f))
      ) {
        Row(
          verticalAlignment = Alignment.CenterVertically,
          modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
        ) {
          Icon(
            imageVector = slide.eyebrowIcon,
            contentDescription = null,
            tint = slide.eyebrowAccent,
            modifier = Modifier.size(15.dp)
          )
          Spacer(modifier = Modifier.width(6.dp))
          Text(
            text = stringResource(id = slide.eyebrowRes),
            style = MaterialTheme.typography.labelSmall.copy(
              fontWeight = FontWeight.ExtraBold,
              letterSpacing = 1.2.sp,
              color = slide.eyebrowAccent
            )
          )
        }
      }

      Spacer(modifier = Modifier.height(12.dp))

      // Bold Clean Single-Feature Headline
      Text(
        text = stringResource(id = slide.titleRes),
        style = MaterialTheme.typography.headlineLarge.copy(
          fontWeight = FontWeight.ExtraBold,
          fontSize = 30.sp,
          lineHeight = 35.sp,
          letterSpacing = (-0.5).sp,
          color = Color.White
        )
      )

      Spacer(modifier = Modifier.height(6.dp))

      // Minimal 1-line Subtitle
      Text(
        text = stringResource(id = slide.subtitleRes),
        style = MaterialTheme.typography.bodyLarge.copy(
          fontSize = 14.5.sp,
          lineHeight = 21.sp,
          color = Color.White.copy(alpha = 0.80f)
        ),
        maxLines = 2,
        overflow = TextOverflow.Ellipsis
      )

      // Clean 2x2 Certification Grid on Slide 1 (Lab Tested, FSSAI Approved, GMP Certified, ISO Certified)
      if (slide.showCertificationsGrid) {
        Spacer(modifier = Modifier.height(16.dp))
        Column(
          verticalArrangement = Arrangement.spacedBy(10.dp),
          modifier = Modifier.fillMaxWidth()
        ) {
          QualityCertifications.chunked(2).forEach { rowItems ->
            Row(
              horizontalArrangement = Arrangement.spacedBy(10.dp),
              modifier = Modifier.fillMaxWidth()
            ) {
              rowItems.forEach { cert ->
                CertificationGlassPill(
                  cert = cert,
                  modifier = Modifier.weight(1f)
                )
              }
            }
          }
        }
      }

      // Stylish App-Only Welcome Rewards Showcase on Slide 3
      if (slide.showAppRewardsShowcase) {
        Spacer(modifier = Modifier.height(16.dp))
        AppRewardsShowcaseCard()
      }
    }
  }
}

@Composable
private fun AppRewardsShowcaseCard() {
  Column(
    verticalArrangement = Arrangement.spacedBy(10.dp),
    modifier = Modifier
      .fillMaxWidth()
      .testTag("onboarding_s3_rewards_card")
  ) {
    Row(
      horizontalArrangement = Arrangement.spacedBy(10.dp),
      modifier = Modifier.fillMaxWidth()
    ) {
      RewardHighlightTile(
        icon = Icons.Rounded.LocalShipping,
        accent = BrightMint,
        title = stringResource(id = R.string.onboarding_s3_offer_free_delivery_title),
        subtitle = stringResource(id = R.string.onboarding_s3_offer_free_delivery_sub),
        modifier = Modifier.weight(1f)
      )
      RewardHighlightTile(
        icon = Icons.Rounded.CardGiftcard,
        accent = WarmGold,
        title = stringResource(id = R.string.onboarding_s3_offer_100_title),
        subtitle = stringResource(id = R.string.onboarding_s3_offer_100_sub),
        modifier = Modifier.weight(1f)
      )
    }

    // Highlighted 10% Extra App-Only Banner
    Surface(
      shape = RoundedCornerShape(16.dp),
      color = Color.Transparent,
      border = BorderStroke(1.2.dp, WarmGold.copy(alpha = 0.55f)),
      modifier = Modifier.fillMaxWidth()
    ) {
      Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier = Modifier
          .fillMaxWidth()
          .background(
            Brush.horizontalGradient(
              colors = listOf(
                WarmGold.copy(alpha = 0.22f),
                VibrantEmerald.copy(alpha = 0.20f)
              )
            )
          )
          .padding(horizontal = 14.dp, vertical = 12.dp)
      ) {
        Row(
          verticalAlignment = Alignment.CenterVertically,
          modifier = Modifier.weight(1f)
        ) {
          Surface(
            shape = CircleShape,
            color = WarmGold.copy(alpha = 0.22f),
            modifier = Modifier.size(34.dp)
          ) {
            Box(contentAlignment = Alignment.Center) {
              Icon(
                imageVector = Icons.Rounded.AutoAwesome,
                contentDescription = null,
                tint = WarmGold,
                modifier = Modifier.size(18.dp)
              )
            }
          }
          Spacer(modifier = Modifier.width(10.dp))
          Text(
            text = stringResource(id = R.string.onboarding_s3_offer_extra_title),
            style = MaterialTheme.typography.titleSmall.copy(
              fontWeight = FontWeight.ExtraBold,
              color = Color.White,
              letterSpacing = 0.1.sp
            ),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
          )
        }

        Spacer(modifier = Modifier.width(8.dp))

        Surface(
          shape = RoundedCornerShape(50),
          color = WarmGold
        ) {
          Text(
            text = stringResource(id = R.string.onboarding_s3_offer_extra_badge),
            style = MaterialTheme.typography.labelSmall.copy(
              fontWeight = FontWeight.ExtraBold,
              letterSpacing = 0.8.sp,
              color = DeepForest
            ),
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
          )
        }
      }
    }
  }
}

@Composable
private fun RewardHighlightTile(
  icon: ImageVector,
  accent: Color,
  title: String,
  subtitle: String,
  modifier: Modifier = Modifier
) {
  Surface(
    modifier = modifier,
    shape = RoundedCornerShape(16.dp),
    color = Color.White.copy(alpha = 0.11f),
    border = BorderStroke(1.dp, accent.copy(alpha = 0.34f))
  ) {
    Column(
      modifier = Modifier.padding(horizontal = 13.dp, vertical = 12.dp)
    ) {
      Surface(
        shape = RoundedCornerShape(10.dp),
        color = accent.copy(alpha = 0.18f),
        modifier = Modifier.size(32.dp)
      ) {
        Box(contentAlignment = Alignment.Center) {
          Icon(
            imageVector = icon,
            contentDescription = null,
            tint = accent,
            modifier = Modifier.size(18.dp)
          )
        }
      }
      Spacer(modifier = Modifier.height(8.dp))
      Text(
        text = title,
        style = MaterialTheme.typography.titleMedium.copy(
          fontWeight = FontWeight.ExtraBold,
          color = Color.White
        ),
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )
      Spacer(modifier = Modifier.height(2.dp))
      Text(
        text = subtitle,
        style = MaterialTheme.typography.labelSmall.copy(
          color = Color.White.copy(alpha = 0.74f),
          fontWeight = FontWeight.Medium
        ),
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )
    }
  }
}

@Composable
private fun CertificationGlassPill(
  cert: CertBadge,
  modifier: Modifier = Modifier
) {
  Surface(
    modifier = modifier,
    shape = RoundedCornerShape(14.dp),
    color = Color.White.copy(alpha = 0.10f),
    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f))
  ) {
    Row(
      verticalAlignment = Alignment.CenterVertically,
      modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)
    ) {
      Icon(
        imageVector = cert.icon,
        contentDescription = null,
        tint = BrightMint,
        modifier = Modifier.size(18.dp)
      )
      Spacer(modifier = Modifier.width(8.dp))
      Text(
        text = stringResource(id = cert.labelRes),
        style = MaterialTheme.typography.labelMedium.copy(
          fontWeight = FontWeight.Bold,
          color = Color.White
        ),
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )
    }
  }
}
