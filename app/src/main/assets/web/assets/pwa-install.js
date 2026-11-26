(function () {
  'use strict';

  if (window.__nutrolixPwaControllerLoaded) return;
  window.__nutrolixPwaControllerLoaded = true;

  const INSTALLED_FLAG_KEY = 'nutrolix_pwa_installed_v1';

  let deferredPrompt = window.__nutrolixDeferredInstallPrompt || null;

  function isNativeAppWebView() {
    try {
      if (window.location.protocol === 'file:') return true;
      if (window.AndroidNative || window.NutrolixAndroidBridge || window.NutrolixAdminNativeBridge) return true;
      const ua = navigator.userAgent || '';
      if (/;\s*wv\)/i.test(ua)) return true;
      if (document.referrer && document.referrer.startsWith('android-app://')) return true;
    } catch (_) {}
    return false;
  }

  function isIOSDevice() {
    const ua = navigator.userAgent || '';
    const isStandardIOS = /iPad|iPhone|iPod/i.test(ua);
    const isIPadDesktopUA = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return isStandardIOS || isIPadDesktopUA;
  }

  function isIOSSafari() {
    if (!isIOSDevice()) return false;
    const ua = navigator.userAgent || '';
    return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  }

  function isStandaloneInstalled() {
    try {
      if (isNativeAppWebView()) return true;
      if (window.navigator.standalone === true) return true;
      if (window.matchMedia && (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches
      )) {
        return true;
      }
      if (localStorage.getItem(INSTALLED_FLAG_KEY) === '1' && !deferredPrompt) {
        // Only trust cached installed flag if browser hasn't offered a fresh prompt
        return true;
      }
    } catch (_) {}
    return false;
  }

  function registerServiceWorkerSafely() {
    try {
      if (!('serviceWorker' in navigator)) return;
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return;
      }
      navigator.serviceWorker.getRegistration('/').then(function (existing) {
        if (!existing) {
          navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(function () {});
        }
      }).catch(function () {
        navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(function () {});
      });
    } catch (_) {}
  }

  function showPwaToast(message) {
    try {
      const existing = document.getElementById('nutrolixPwaToast');
      if (existing) existing.remove();
      const toast = document.createElement('div');
      toast.id = 'nutrolixPwaToast';
      toast.setAttribute('role', 'status');
      toast.className = 'fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[120] bg-emerald-950 text-white border border-emerald-400/40 px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-bold flex items-center space-x-2 transition-opacity duration-300';
      const icon = document.createElement('i');
      icon.className = 'fa-solid fa-circle-check text-emerald-400';
      const span = document.createElement('span');
      span.textContent = message;
      toast.appendChild(icon);
      toast.appendChild(span);
      document.body.appendChild(toast);
      setTimeout(function () {
        toast.style.opacity = '0';
        setTimeout(function () { toast.remove(); }, 320);
      }, 3200);
    } catch (_) {}
  }

  function closeInstallGuideModal() {
    const modal = document.getElementById('nutrolixPwaInstallModal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  function openInstallGuideModal(mode) {
    let modal = document.getElementById('nutrolixPwaInstallModal');
    if (modal) modal.remove();

    const isIOS = mode === 'ios';
    const iosNotSafari = isIOS && !isIOSSafari();

    modal = document.createElement('div');
    modal.id = 'nutrolixPwaInstallModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'nutrolixPwaModalTitle');
    modal.className = 'fixed inset-0 z-[130] bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4';

    const stepsHtml = isIOS
      ? `
        ${iosNotSafari ? `
          <div class="mb-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-900 flex items-start gap-2">
            <i class="fa-solid fa-circle-info text-amber-600 mt-0.5 shrink-0"></i>
            <span>Open <strong>nutrolix.in</strong> in <strong>Safari</strong> on your iPhone or iPad to install the app.</span>
          </div>
        ` : ''}
        <ol class="space-y-3 text-xs text-slate-700">
          <li class="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span class="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center shrink-0 text-[11px]">1</span>
            <div class="leading-relaxed">
              Tap the <strong class="text-slate-900">Share</strong> button
              <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-50 text-blue-600 border border-blue-200 mx-0.5 align-middle">
                <i class="fa-solid fa-arrow-up-from-bracket text-[10px]"></i>
              </span>
              in the bottom toolbar of Safari.
            </div>
          </li>
          <li class="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span class="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center shrink-0 text-[11px]">2</span>
            <div class="leading-relaxed">
              Scroll down and tap <strong class="text-slate-900">“Add to Home Screen”</strong>
              <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-200/80 text-slate-800 mx-0.5 align-middle">
                <i class="fa-regular fa-square-plus text-[10px]"></i>
              </span>.
            </div>
          </li>
          <li class="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span class="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center shrink-0 text-[11px]">3</span>
            <div class="leading-relaxed">
              Tap <strong class="text-emerald-700">“Add”</strong> in the top-right corner. Nutrolix will appear on your home screen like a native app.
            </div>
          </li>
        </ol>
      `
      : `
        <ol class="space-y-3 text-xs text-slate-700">
          <li class="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span class="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center shrink-0 text-[11px]">1</span>
            <div class="leading-relaxed">
              Open your browser menu (<strong class="text-slate-900">⋮</strong> or address bar install icon).
            </div>
          </li>
          <li class="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span class="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center shrink-0 text-[11px]">2</span>
            <div class="leading-relaxed">
              Tap <strong class="text-slate-900">“Install App”</strong> or <strong class="text-slate-900">“Add to Home Screen”</strong>.
            </div>
          </li>
          <li class="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span class="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center shrink-0 text-[11px]">3</span>
            <div class="leading-relaxed">
              Confirm <strong class="text-emerald-700">“Install”</strong> for instant one-tap access to Nutrolix.
            </div>
          </li>
        </ol>
      `;

    modal.innerHTML = `
      <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-[fadeIn_0.18s_ease-out]">
        <div class="px-5 py-4 flex items-center justify-between border-b border-emerald-900/10" style="background: linear-gradient(135deg, #064E3B 0%, #0F3E2E 100%);">
          <div class="flex items-center gap-3">
            <img src="/assets/pwa-icon-192.png" alt="Nutrolix App Icon" class="w-10 h-10 rounded-xl bg-white p-0.5 shadow-md shrink-0">
            <div>
              <h3 id="nutrolixPwaModalTitle" class="text-sm font-black text-white leading-tight">Install Nutrolix App</h3>
              <p class="text-[11px] text-emerald-200 font-medium">${isIOS ? 'Add to your iPhone / iPad Home Screen' : 'Quick browser install steps'}</p>
            </div>
          </div>
          <button type="button" id="nutrolixPwaModalClose" aria-label="Close install instructions" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>
        <div class="p-5">
          ${stepsHtml}
          <button type="button" id="nutrolixPwaModalGotIt" class="mt-5 w-full py-3 rounded-xl font-black text-xs text-white shadow-md transition active:scale-[0.98]" style="background-color: #0F3E2E;">
            Got It
          </button>
        </div>
      </div>
    `;

    modal.addEventListener('click', function (ev) {
      if (ev.target === modal) closeInstallGuideModal();
    });

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const closeBtn = document.getElementById('nutrolixPwaModalClose');
    const gotItBtn = document.getElementById('nutrolixPwaModalGotIt');
    if (closeBtn) closeBtn.addEventListener('click', closeInstallGuideModal);
    if (gotItBtn) gotItBtn.addEventListener('click', closeInstallGuideModal);
  }

  function createFooterInstallWidget() {
    const wrapper = document.createElement('div');
    wrapper.className = 'nutrolix-pwa-install-wrap pt-3';
    wrapper.setAttribute('data-nutrolix-pwa-wrap', '1');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = [
      'nutrolix-pwa-install-btn',
      'group w-full sm:w-auto inline-flex items-center justify-between sm:justify-start gap-3',
      'px-4 py-2.5 min-h-[48px] rounded-2xl',
      'border border-emerald-400/40 bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-[0.98]',
      'text-left text-white shadow-lg shadow-black/15 transition-all duration-200 cursor-pointer'
    ].join(' ');
    btn.setAttribute('aria-label', 'Install Nutrolix App');
    btn.setAttribute('data-nutrolix-pwa-btn', '1');

    btn.innerHTML = `
      <span class="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-950 flex items-center justify-center shrink-0 shadow-md shadow-emerald-950/30 group-hover:scale-105 transition-transform">
        <i class="fa-solid fa-download text-sm"></i>
      </span>
      <span class="flex flex-col leading-tight min-w-0 pr-1">
        <span class="flex items-center gap-1.5">
          <span class="text-xs font-black tracking-wide text-white">Install App</span>
          <span class="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/30">PWA</span>
        </span>
        <span class="text-[11px] text-emerald-100/80 font-medium truncate">Quick home-screen access • Zero storage</span>
      </span>
      <i class="fa-solid fa-arrow-right text-xs text-emerald-300 group-hover:translate-x-0.5 transition-transform shrink-0 ml-auto sm:ml-1"></i>
    `;

    btn.addEventListener('click', handleInstallClick);
    wrapper.appendChild(btn);
    return wrapper;
  }

  async function handleInstallClick() {
    if (isStandaloneInstalled()) {
      updateAllButtonsVisibility();
      return;
    }

    if (deferredPrompt) {
      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      window.__nutrolixDeferredInstallPrompt = null;
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') {
          try { localStorage.setItem(INSTALLED_FLAG_KEY, '1'); } catch (_) {}
          updateAllButtonsVisibility();
          showPwaToast('Nutrolix App installed on your device!');
        }
      } catch (_) {
        openInstallGuideModal(isIOSDevice() ? 'ios' : 'generic');
      }
      return;
    }

    if (isIOSDevice()) {
      openInstallGuideModal('ios');
      return;
    }

    openInstallGuideModal('generic');
  }

  function mountFooterButton() {
    // Do not mount inside admin console or standalone app
    const path = (window.location.pathname || '').toLowerCase();
    if (path.includes('admin')) return;

    const footers = document.querySelectorAll('footer');
    if (!footers.length) return;

    footers.forEach(function (footer) {
      if (footer.querySelector('[data-nutrolix-pwa-wrap="1"]')) return;

      // Prefer explicit slot if present in HTML
      const explicitSlot = footer.querySelector('.nutrolix-pwa-footer-slot');
      if (explicitSlot) {
        explicitSlot.appendChild(createFooterInstallWidget());
        return;
      }

      // Otherwise mount cleanly in the brand column (Col 1) inside the footer grid
      const brandCol = footer.querySelector('.lg\\:col-span-2') || footer.querySelector('.grid > div:first-child');
      if (brandCol) {
        brandCol.appendChild(createFooterInstallWidget());
      } else {
        const inner = footer.querySelector('.max-w-7xl') || footer;
        const container = document.createElement('div');
        container.className = 'mt-4 flex justify-center sm:justify-start';
        container.appendChild(createFooterInstallWidget());
        inner.appendChild(container);
      }
    });

    updateAllButtonsVisibility();
  }

  function updateAllButtonsVisibility() {
    const shouldHide = isStandaloneInstalled();
    const wraps = document.querySelectorAll('[data-nutrolix-pwa-wrap="1"]');
    wraps.forEach(function (el) {
      if (shouldHide) {
        el.classList.add('hidden');
        el.style.display = 'none';
      } else {
        el.classList.remove('hidden');
        el.style.display = '';
      }
    });
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    window.__nutrolixDeferredInstallPrompt = event;
    try { localStorage.removeItem(INSTALLED_FLAG_KEY); } catch (_) {}
    updateAllButtonsVisibility();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    window.__nutrolixDeferredInstallPrompt = null;
    try { localStorage.setItem(INSTALLED_FLAG_KEY, '1'); } catch (_) {}
    closeInstallGuideModal();
    updateAllButtonsVisibility();
    showPwaToast('Nutrolix App installed successfully!');
  });

  try {
    if (window.matchMedia) {
      const mq = window.matchMedia('(display-mode: standalone)');
      if (mq && typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', updateAllButtonsVisibility);
      }
    }
  } catch (_) {}

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') closeInstallGuideModal();
  });

  // Expose public helper cleanly
  window.triggerNutrolixPwaInstall = handleInstallClick;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      registerServiceWorkerSafely();
      mountFooterButton();
    });
  } else {
    registerServiceWorkerSafely();
    mountFooterButton();
  }
})();
