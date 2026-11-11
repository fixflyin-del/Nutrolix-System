// Nutrolix Customer Notification Manager
// Provides genuine Web Push (VAPID RFC 8291) & Android Native notifications for orders

(function() {
  'use strict';

  const STORAGE_KEY = 'nutrolix_notification_registered';
  const DISMISSED_KEY = 'nutrolix_notification_prompt_dismissed';

  function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[Nutrolix Notifications] Service Worker active:', reg.scope);
      return reg;
    } catch (err) {
      console.warn('[Nutrolix Notifications] Service Worker registration failed:', err);
      return null;
    }
  }

  function getCustomerInfo() {
    let customer = {};
    try {
      if (typeof window.getNutrolixUser === 'function') {
        const u = window.getNutrolixUser();
        if (u) customer = u;
      }
      if (!customer.phone && !customer.email) {
        const raw = localStorage.getItem('nutrolix_user_profile') || localStorage.getItem('nutrolix_user');
        if (raw) customer = JSON.parse(raw);
      }
    } catch (_) {}
    return {
      phone: customer.phone || customer.phoneNumber || '',
      email: customer.email || ''
    };
  }

  async function getVapidPublicKey() {
    try {
      const res = await fetch('/api/notifications/vapid-key');
      if (res.ok) {
        const data = await res.json();
        return data.publicKey;
      }
    } catch (e) {
      console.warn('[Nutrolix Notifications] VAPID key fetch error:', e);
    }
    return 'BNKixC3ZCYx27sN2fDJcsDhc1NVZEBQJ_-NkX9Xa1CuHB0xz9tyvCk582_j0bPaCBzn8LUeswFAZigMzzlSj5gY';
  }

  async function sendSubscriptionToBackend(subscription) {
    try {
      const { phone, email } = getCustomerInfo();
      const subJson = subscription ? (typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription) : null;

      await fetch('/api/notifications/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subJson,
          customerPhone: phone,
          customerEmail: email,
          platform: 'web',
          userAgent: navigator.userAgent
        })
      });
      localStorage.setItem(STORAGE_KEY, 'true');
      console.log('[Nutrolix Notifications] Genuine Web Push subscription registered with backend');
    } catch (err) {
      console.warn('[Nutrolix Notifications] Failed to register subscription with backend:', err);
    }
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.log('[Nutrolix Notifications] Web Notifications not supported in this browser environment');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const reg = await registerServiceWorker();
        if (reg && 'pushManager' in reg) {
          const vapidKey = await getVapidPublicKey();
          const convertedVapidKey = urlB64ToUint8Array(vapidKey);

          let subscription = await reg.pushManager.getSubscription();
          if (!subscription) {
            subscription = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedVapidKey
            });
          }
          await sendSubscriptionToBackend(subscription);
        } else {
          // Standard browser notification registration fallback
          await sendSubscriptionToBackend({ endpoint: 'browser_notification_' + window.location.host });
        }

        hidePromptBanner();
        showToast('🔔 Live order notifications activated!');
        return true;
      }
      return false;
    } catch (err) {
      console.error('[Nutrolix Notifications] Permission request error:', err);
      return false;
    }
  }

  function showPromptBanner() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;
    if (document.getElementById('nutrolixNotificationBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'nutrolixNotificationBanner';
    banner.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white/95 backdrop-blur-md border border-emerald-200 shadow-2xl rounded-2xl p-4 z-50 transform transition-all duration-300';
    banner.innerHTML = `
      <div class="flex items-start space-x-3">
        <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg flex-shrink-0">
          <i class="fa-solid fa-bell"></i>
        </div>
        <div class="flex-1">
          <h4 class="text-xs font-black text-slate-900">Enable Live Order Updates</h4>
          <p class="text-[11px] text-slate-600 mt-0.5 leading-snug">Get instant push alerts on order confirmation, dispatch & doorstep delivery.</p>
          <div class="flex items-center space-x-2 mt-2.5">
            <button id="btnAllowNotifications" class="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] shadow">
              Allow Updates
            </button>
            <button id="btnDismissNotifications" class="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 text-[11px] font-semibold">
              Later
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    const allowBtn = document.getElementById('btnAllowNotifications');
    if (allowBtn) {
      allowBtn.addEventListener('click', () => {
        requestNotificationPermission();
      });
    }

    const dismissBtn = document.getElementById('btnDismissNotifications');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        sessionStorage.setItem(DISMISSED_KEY, 'true');
        hidePromptBanner();
      });
    }
  }

  function hidePromptBanner() {
    const banner = document.getElementById('nutrolixNotificationBanner');
    if (banner) banner.remove();
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold z-50 flex items-center space-x-2';
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // Active sync for open tabs & foreground status changes
  function initOrderNotificationSync() {
    setInterval(async () => {
      const activeOrderId = localStorage.getItem('nutrolix_last_active_order_id');
      if (!activeOrderId) return;
      try {
        const res = await fetch('/api/notifications/history');
        if (!res.ok) return;
        const logs = await res.json();
        const relevant = logs.filter(l => l.orderId === activeOrderId && !l.shownInForeground);
        relevant.forEach(log => {
          log.shownInForeground = true;
          if (Notification.permission === 'granted' && document.visibilityState === 'visible') {
            showToast(`🔔 ${log.title}: ${log.message}`);
          }
        });
      } catch (_) {}
    }, 10000);
  }

  // Check and update customer contact mapping on user login
  window.addEventListener('nutrolix:auth-changed', async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sendSubscriptionToBackend(sub);
      }
    }
  });

  // Auto-init on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      registerServiceWorker();
      setTimeout(showPromptBanner, 2000);
      initOrderNotificationSync();
    });
  } else {
    registerServiceWorker();
    setTimeout(showPromptBanner, 2000);
    initOrderNotificationSync();
  }

  window.NutrolixNotifications = {
    requestPermission: requestNotificationPermission,
    registerServiceWorker,
    sendSubscriptionToBackend
  };
})();
