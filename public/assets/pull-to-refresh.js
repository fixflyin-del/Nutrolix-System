/**
 * Nutrolix Universal Pull-To-Refresh
 * Displays an elegant circular Material progress indicator when pulled down from the top of the page,
 * then cleanly reloads the current page.
 */
(function () {
  if (typeof window === 'undefined') return;

  // Avoid multiple initializations
  if (window.__nutroPullToRefreshInitialized) return;
  window.__nutroPullToRefreshInitialized = true;

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    .ptr-indicator {
      position: fixed;
      top: -60px;
      left: 50%;
      transform: translateX(-50%);
      width: 46px;
      height: 46px;
      background: #ffffff;
      border-radius: 50%;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      pointer-events: none;
      transition: transform 0.15s ease-out, top 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease;
      opacity: 0;
    }
    .ptr-spinner {
      width: 26px;
      height: 26px;
      animation: ptr-spin 0.85s linear infinite;
    }
    .ptr-spinner circle {
      stroke: #059669;
      stroke-linecap: round;
      stroke-dasharray: 60;
      stroke-dashoffset: 20;
    }
    @keyframes ptr-spin {
      100% {
        transform: rotate(360deg);
      }
    }
  `;
  document.head.appendChild(style);

  // Create UI element
  const indicator = document.createElement('div');
  indicator.className = 'ptr-indicator';
  indicator.innerHTML = `
    <svg class="ptr-spinner" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="11" fill="none" stroke-width="3"></circle>
    </svg>
  `;
  document.body.appendChild(indicator);

  let startY = 0;
  let currentY = 0;
  let isPulling = false;
  let isRefreshing = false;
  const PULL_THRESHOLD = 70; // px required to trigger reload
  const MAX_PULL = 110;

  function getScrollTop() {
    return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  function hasScrolledAncestor(target) {
    let el = target && target.nodeType === 1 ? target : null;
    while (el && el !== document.body && el !== document.documentElement) {
      try {
        const style = window.getComputedStyle(el);
        const overflowY = style ? style.overflowY : '';
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight && el.scrollTop > 0) {
          return true;
        }
      } catch (_) {}
      el = el.parentElement;
    }
    return false;
  }

  function resetIndicator() {
    isPulling = false;
    indicator.style.top = '-60px';
    indicator.style.opacity = '0';
    startY = 0;
    currentY = 0;
  }

  window.addEventListener('touchstart', (e) => {
    const blocked = getScrollTop() > 0 || hasScrolledAncestor(e.target);
    if (window.NutrolixPtrBridge && typeof window.NutrolixPtrBridge.setCanPull === 'function') {
      try { window.NutrolixPtrBridge.setCanPull(!blocked); } catch (_) {}
    }
    if (window.__nutrolixNativePtr || isRefreshing) return;
    if (!e.touches || e.touches.length !== 1) return;
    if (!blocked) {
      startY = e.touches[0].clientY;
      currentY = startY;
      isPulling = true;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (window.__nutrolixNativePtr || !isPulling || isRefreshing) return;
    if (!e.touches || !e.touches.length) return;
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;

    if (diff > 0 && getScrollTop() <= 0) {
      const distance = Math.min(diff * 0.42, MAX_PULL);
      indicator.style.opacity = Math.min(distance / 30, 1);
      indicator.style.top = `${Math.max(distance - 20, 14)}px`;
      const rotation = distance * 3.5;
      const spinner = indicator.querySelector('.ptr-spinner');
      if (spinner) spinner.style.transform = `rotate(${rotation}deg)`;
    } else {
      indicator.style.opacity = '0';
      indicator.style.top = '-60px';
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    if (window.__nutrolixNativePtr || !isPulling || isRefreshing) return;
    isPulling = false;
    const diff = currentY - startY;
    const distance = diff * 0.42;

    if (distance >= PULL_THRESHOLD && getScrollTop() <= 0) {
      isRefreshing = true;
      indicator.style.top = '24px';
      indicator.style.opacity = '1';
      if (navigator.vibrate) {
        try { navigator.vibrate(30); } catch (_) {}
      }
      setTimeout(() => {
        window.location.reload();
      }, 350);
    } else {
      indicator.style.top = '-60px';
      indicator.style.opacity = '0';
    }
    startY = 0;
    currentY = 0;
  }, { passive: true });

  window.addEventListener('touchcancel', () => {
    if (!isRefreshing) resetIndicator();
  }, { passive: true });

})();
