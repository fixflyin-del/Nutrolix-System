package com.example.util

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.animation.DecelerateInterpolator
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.ProgressBar
import kotlin.math.abs
import kotlin.math.min

/**
 * Lightweight zero-dependency Pull-To-Refresh FrameLayout wrapper around a WebView.
 * Triggers refresh only when the WebView and any nested HTML scroll containers are at top (scrollY == 0),
 * and shows a floating circular emerald progress pill.
 */
class PullToRefreshWebViewWrapper(
  context: Context,
  val webView: WebView,
  private val onRefresh: (WebView) -> Unit
) : FrameLayout(context) {

  private val density = context.resources.displayMetrics.density
  private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
  private val badgeSizePx = (44f * density).toInt()
  private val hiddenY = -(64f * density)
  private val restY = 18f * density
  private val triggerDistancePx = 82f * density
  private val maxPullPx = 128f * density
  private val dragDamping = 0.44f

  private val indicatorContainer: FrameLayout
  private val progressBar: ProgressBar

  private var startX = 0f
  private var startY = 0f
  private var dragStartY = 0f
  private var currentPullPx = 0f
  private var isDragging = false
  private var isRefreshing = false
  private var gestureDisqualified = false

  @Volatile
  private var canPullFromWeb = true

  private val autoFinishRunnable = Runnable {
    finishRefreshing()
  }

  init {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    webView.layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    addView(webView)

    webView.addJavascriptInterface(
      object {
        @JavascriptInterface
        fun setCanPull(allowed: Boolean) {
          canPullFromWeb = allowed
        }
      },
      "NutrolixPtrBridge"
    )

    val circleBg = GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(Color.WHITE)
      setStroke((1f * density).toInt().coerceAtLeast(1), Color.argb(55, 16, 185, 129))
    }

    indicatorContainer = FrameLayout(context).apply {
      layoutParams = LayoutParams(badgeSizePx, badgeSizePx, Gravity.TOP or Gravity.CENTER_HORIZONTAL)
      background = circleBg
      elevation = 6f * density
      translationY = hiddenY
      alpha = 0f
      visibility = View.INVISIBLE
    }

    val spinnerSizePx = (24f * density).toInt()
    progressBar = ProgressBar(context).apply {
      layoutParams = LayoutParams(spinnerSizePx, spinnerSizePx, Gravity.CENTER)
      isIndeterminate = true
      indeterminateTintList = ColorStateList.valueOf(Color.parseColor("#059669"))
    }
    indicatorContainer.addView(progressBar)
    addView(indicatorContainer)
  }

  override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
    if (isRefreshing) return false

    when (ev.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        canPullFromWeb = true
        isDragging = false
        gestureDisqualified = false
        startX = ev.x
        startY = ev.y
        currentPullPx = 0f
      }
      MotionEvent.ACTION_POINTER_DOWN -> {
        gestureDisqualified = true
      }
      MotionEvent.ACTION_MOVE -> {
        if (gestureDisqualified || ev.pointerCount > 1) return false
        val dx = ev.x - startX
        val dy = ev.y - startY

        if (dy < -touchSlop || abs(dx) > touchSlop * 2f && abs(dx) > abs(dy)) {
          gestureDisqualified = true
          return false
        }

        val atTop = canPullFromWeb && webView.scrollY <= 0 && !webView.canScrollVertically(-1)
        if (!atTop) {
          return false
        }

        if (dy > touchSlop * 1.5f && abs(dy) > abs(dx) * 1.35f) {
          isDragging = true
          dragStartY = ev.y
          indicatorContainer.animate().cancel()
          indicatorContainer.visibility = View.VISIBLE
          return true
        }
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        isDragging = false
        gestureDisqualified = false
      }
    }
    return false
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    if (isRefreshing) return super.onTouchEvent(event)

    when (event.actionMasked) {
      MotionEvent.ACTION_MOVE -> {
        if (!isDragging) return super.onTouchEvent(event)
        val rawDy = (event.y - dragStartY).coerceAtLeast(0f)
        currentPullPx = min(rawDy * dragDamping, maxPullPx)
        val progress = (currentPullPx / triggerDistancePx).coerceIn(0f, 1.25f)

        indicatorContainer.visibility = View.VISIBLE
        indicatorContainer.translationY = hiddenY + currentPullPx + (52f * density * progress.coerceAtMost(1f))
        indicatorContainer.alpha = (progress * 1.4f).coerceIn(0f, 1f)
        val scale = (0.72f + 0.28f * progress.coerceAtMost(1f))
        indicatorContainer.scaleX = scale
        indicatorContainer.scaleY = scale
        progressBar.rotation = currentPullPx * 2.8f
        return true
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        if (isDragging) {
          isDragging = false
          if (event.actionMasked == MotionEvent.ACTION_UP && currentPullPx >= triggerDistancePx) {
            startRefreshing()
          } else {
            hideIndicator()
          }
          currentPullPx = 0f
          return true
        }
      }
    }
    return super.onTouchEvent(event)
  }

  private fun startRefreshing() {
    isRefreshing = true
    removeCallbacks(autoFinishRunnable)
    postDelayed(autoFinishRunnable, 8500L)

    indicatorContainer.visibility = View.VISIBLE
    indicatorContainer.animate()
      .translationY(restY)
      .alpha(1f)
      .scaleX(1f)
      .scaleY(1f)
      .setDuration(180L)
      .setInterpolator(DecelerateInterpolator())
      .setListener(null)
      .start()

    onRefresh(webView)
  }

  fun finishRefreshing() {
    if (!isRefreshing && indicatorContainer.visibility != View.VISIBLE) return
    isRefreshing = false
    removeCallbacks(autoFinishRunnable)
    hideIndicator()
  }

  private fun hideIndicator() {
    indicatorContainer.animate()
      .translationY(hiddenY)
      .alpha(0f)
      .scaleX(0.75f)
      .scaleY(0.75f)
      .setDuration(200L)
      .setInterpolator(DecelerateInterpolator())
      .setListener(object : AnimatorListenerAdapter() {
        override fun onAnimationEnd(animation: Animator) {
          if (!isRefreshing && !isDragging) {
            indicatorContainer.visibility = View.INVISIBLE
          }
        }
      })
      .start()
  }

  override fun onDetachedFromWindow() {
    removeCallbacks(autoFinishRunnable)
    super.onDetachedFromWindow()
  }
}
