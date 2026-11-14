// Nutrolix Customer Notification Manager
// Supports FCM HTTP v1 (Android APK & Web Messaging), RFC 8291 Web Push (VAPID), and Foreground Interactive Toasts
(function() {
  'use strict';

  if (typeof window.NUTROLIX_API_HOST === 'undefined') {
    window.NUTROLIX_API_HOST = (window.location && window.location.protocol === 'file:')
      ? 'https://ais-dev-hdct4zqciie73skb7kah2l-760738801567.asia-northeast1.run.app'
      : '';
  }

  const STORAGE_KEY = 'nutrolix_notification_registered';
  const DISMISSED_KEY = 'nutrolix_notification_prompt_dismissed';
  const SHOWN_TOAST_KEYS_STORAGE = 'nutrolix_shown_notif_ids';

  function getApiHost() {
    return window.NUTROLIX_API_HOST || '';
  }

  function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  function getCustomerInfo() {
    let customer = {};
    try {
      if (typeof window.getNutrolixUser === 'function') {
        const u = window.getNutrolixUser();
        if (u) customer = u;
      }
      if (!customer.uid && !customer.phone && !customer.email) {
        const raw = localStorage.getItem('nutrolix_user_profile') || localStorage.getItem('nutrolix_user');
        if (raw) customer = JSON.parse(raw);
      }
    } catch (_) {}
    return {
      uid: customer.uid || '',
      phone: customer.verifiedPhone || customer.phone || customer.whatsappNumber || '',
      email: customer.email || ''
    };
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return null;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      return reg;
    } catch (_) {
      return null;
    }
  }

  async function getVapidPublicKey() {
    try {
      const res = await fetch(getApiHost() + '/api/notifications/vapid-key');
      if (res.ok) {
        const data = await res.json();
        if (data && data.publicKey) return data.publicKey;
      }
    } catch (_) {}
    return 'BNKixC3ZCYx27sN2fDJcsDhc1NVZEBQJ_-NkX9Xa1CuHB0xz9tyvCk582_j0bPaCBzn8LUeswFAZigMzzlSj5gY';
  }

  async function sendSubscriptionToBackend(subscription, extra = {}) {
    try {
      const { uid, phone, email } = getCustomerInfo();
      const subJson = subscription && typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription;
      const fcmToken = extra.fcmToken || '';
      const platform = extra.platform || (window.AndroidNative ? 'android-apk' : 'web');

      if (!uid && !phone && !email && !fcmToken && !(subJson && subJson.endpoint)) {
        return;
      }

      await fetch(getApiHost() + '/api/notifications/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid,
          fcmToken,
          token: fcmToken || (subJson && subJson.endpoint) || '',
          subscription: subJson,
          customerPhone: phone,
          customerEmail: email,
          platform,
          userAgent: navigator.userAgent
        })
      });

      if (uid && fcmToken && window.NutrolixFirebase && typeof window.NutrolixFirebase.saveFcmToken === 'function') {
        window.NutrolixFirebase.saveFcmToken(uid, {
          fcmToken,
          platform,
          customerPhone: phone,
          customerEmail: email
        }).catch(() => {});
      }

      localStorage.setItem(STORAGE_KEY, 'true');
    } catch (err) {
      console.warn('[Nutrolix Notifications] Token registration error:', err);
    }
  }

  async function syncNativeAndroidToken() {
    if (window.AndroidNative && typeof window.AndroidNative.getFcmToken === 'function') {
      try { window.AndroidNative.getFcmToken(); } catch (_) {}
    }
  }

  window.onNativeFcmToken = function(token) {
    if (!token) return;
    localStorage.setItem('nutrolix_native_fcm_token', token);
    sendSubscriptionToBackend(null, { fcmToken: token, platform: 'android-apk' });
  };

  async function requestNotificationPermission() {
    if (window.AndroidNative) {
      await syncNativeAndroidToken();
      return true;
    }
    if (!('Notification' in window)) return false;

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const reg = await registerServiceWorker();
        if (reg && 'pushManager' in reg) {
          try {
            const vapidKey = await getVapidPublicKey();
            const convertedVapidKey = urlB64ToUint8Array(vapidKey);
            let subscription = await reg.pushManager.getSubscription();
            if (!subscription) {
              subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
              });
            }
            await sendSubscriptionToBackend(subscription, { platform: 'web' });
          } catch (_) {}
        }

        // Attempt Firebase Cloud Messaging Web token if Firebase Messaging compat is loaded
        if (typeof firebase !== 'undefined' && typeof firebase.messaging === 'function' && reg) {
          try {
            const messaging = firebase.messaging();
            const vapid = await getVapidPublicKey();
            const fcmTok = await messaging.getToken({ vapidKey: vapid, serviceWorkerRegistration: reg });
            if (fcmTok) {
              await sendSubscriptionToBackend(null, { fcmToken: fcmTok, platform: 'web-fcm' });
            }
          } catch (_) {}
        }

        hidePromptBanner();
        showClickableToast({
          title: 'Live Order Alerts Activated',
          message: 'You will receive real-time alerts for every order step.',
          url: 'orders.html'
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('[Nutrolix Notifications] Permission request error:', err);
      return false;
    }
  }

  function showPromptBanner() {
    if (window.AndroidNative) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;
    if (document.getElementById('nutrolixNotificationBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'nutrolixNotificationBanner';
    banner.className = 'fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:w-96 bg-white/95 backdrop-blur-md border border-emerald-200 shadow-2xl rounded-2xl p-4 z-50';
    banner.innerHTML = `
      <div class="flex items-start space-x-3">
        <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg flex-shrink-0">
          <i class="fa-solid fa-bell"></i>
        </div>
        <div class="flex-1">
          <h4 class="text-xs font-black text-slate-900">Enable Live Order Updates</h4>
          <p class="text-[11px] text-slate-600 mt-0.5 leading-snug">Get instant push alerts when your order is confirmed, packed, out for delivery, or delivered.</p>
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

    document.getElementById('btnAllowNotifications')?.addEventListener('click', requestNotificationPermission);
    document.getElementById('btnDismissNotifications')?.addEventListener('click', () => {
      sessionStorage.setItem(DISMISSED_KEY, 'true');
      hidePromptBanner();
    });
  }

  function hidePromptBanner() {
    document.getElementById('nutrolixNotificationBanner')?.remove();
  }

  function markShownToastId(id) {
    if (!id) return false;
    try {
      const list = JSON.parse(sessionStorage.getItem(SHOWN_TOAST_KEYS_STORAGE) || '[]');
      if (list.includes(id)) return false;
      list.unshift(id);
      sessionStorage.setItem(SHOWN_TOAST_KEYS_STORAGE, JSON.stringify(list.slice(0, 60)));
      return true;
    } catch (_) {
      return true;
    }
  }

  function showClickableToast({ title, message, orderId, url }) {
    const existing = document.getElementById('nutrolixOrderLiveToast');
    if (existing) existing.remove();

    const targetHref = url
      ? url.replace(/^\/+/, '')
      : (orderId ? `orders.html?orderId=${encodeURIComponent(orderId)}` : 'orders.html');

    const toast = document.createElement('div');
    toast.id = 'nutrolixOrderLiveToast';
    toast.className = 'fixed top-4 right-4 left-4 sm:left-auto sm:w-96 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 z-[9998] cursor-pointer transition-all';
    toast.innerHTML = `
      <div class="flex items-start space-x-3">
        <div class="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
          <i class="fa-solid fa-bell"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-black text-emerald-300 truncate">${title || 'Nutrolix Order Update'}</p>
          <p class="text-xs text-slate-100 mt-0.5 leading-snug">${message || ''}</p>
          <span class="inline-block text-[10px] font-bold text-emerald-400 mt-1">Tap to view order →</span>
        </div>
      </div>
    `;
    toast.addEventListener('click', () => {
      window.location.href = targetHref;
    });
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 6500);
  }

  // Native Android foreground push receiver
  window.onNativeOrderPushReceived = function(payload) {
    if (!payload) return;
    showClickableToast({
      title: payload.title,
      message: payload.body || payload.message,
      orderId: payload.orderId,
      url: payload.url
    });
    window.dispatchEvent(new CustomEvent('nutrolix:order-push', { detail: payload }));
  };

  // Attach Firebase foreground messaging & Firestore notifications listener
  let activeNotifUnsub = null;
  function attachUserNotificationListeners() {
    const { uid } = getCustomerInfo();
    if (activeNotifUnsub) {
      try { activeNotifUnsub(); } catch (_) {}
      activeNotifUnsub = null;
    }

    if (uid && window.NutrolixFirebase && typeof window.NutrolixFirebase.subscribeUserNotifications === 'function') {
      let initialSnapshotLoaded = false;
      activeNotifUnsub = window.NutrolixFirebase.subscribeUserNotifications(uid, (items) => {
        window.dispatchEvent(new CustomEvent('nutrolix:notifications-updated', { detail: items }));
        if (!initialSnapshotLoaded) {
          initialSnapshotLoaded = true;
          return;
        }
        const newest = items && items[0];
        if (newest && !newest.read && markShownToastId(newest.id || newest.dedupKey)) {
          showClickableToast({
            title: newest.title,
            message: newest.message,
            orderId: newest.orderId,
            url: newest.url
          });
        }
      });
    }
  }

  // Background polling fallback for user-history when WebView/browser stays open
  function initOrderNotificationSync() {
    let firstPoll = true;
    setInterval(async () => {
      const { uid, phone, email } = getCustomerInfo();
      if (!uid && !phone && !email) return;
      try {
        const qs = new URLSearchParams();
        if (uid) qs.set('uid', uid);
        if (phone) qs.set('phone', phone);
        if (email) qs.set('email', email);
        const res = await fetch(getApiHost() + '/api/notifications/user-history?' + qs.toString());
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data.notifications) ? data.notifications : [];
        if (list.length > 0) {
          window.dispatchEvent(new CustomEvent('nutrolix:notifications-updated', { detail: list }));
          if (!firstPoll) {
            const newest = list[0];
            if (newest && !newest.read && document.visibilityState === 'visible' && markShownToastId(newest.id || newest.dedupKey)) {
              showClickableToast({
                title: newest.title,
                message: newest.message,
                orderId: newest.orderId,
                url: newest.url
              });
            }
          }
        }
        firstPoll = false;
      } catch (_) {}
    }, 15000);
  }

  window.addEventListener('nutrolix:auth-changed', async () => {
    syncNativeAndroidToken();
    attachUserNotificationListeners();
    if ('serviceWorker' in navigator && 'PushManager' in window && window.location.protocol !== 'file:') {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sendSubscriptionToBackend(sub, { platform: 'web' });
      } catch (_) {}
    }
    const cachedNative = localStorage.getItem('nutrolix_native_fcm_token');
    if (cachedNative) {
      sendSubscriptionToBackend(null, { fcmToken: cachedNative, platform: 'android-apk' });
    }
  });

  function boot() {
    registerServiceWorker();
    syncNativeAndroidToken();
    attachUserNotificationListeners();
    setTimeout(showPromptBanner, 2200);
    initOrderNotificationSync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.NutrolixNotifications = {
    requestPermission: requestNotificationPermission,
    registerServiceWorker,
    sendSubscriptionToBackend,
    showClickableToast
  };
})();
