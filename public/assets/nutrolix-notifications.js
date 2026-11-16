// Nutrolix Customer Notification Manager
// Supports FCM HTTP v1 (Android APK & Web Messaging), RFC 8291 Web Push (VAPID), and Foreground Interactive Toasts
(function() {
  'use strict';

  if (typeof window.NUTROLIX_API_HOST === 'undefined') {
    window.NUTROLIX_API_HOST = (window.location && window.location.protocol === 'file:')
      ? 'https://nutrolixweb.vercel.app'
      : '';
  }

  const STORAGE_KEY = 'nutrolix_notification_registered';
  const DEVICE_ID_KEY = 'nutrolix_device_id';
  const SHOWN_TOAST_KEYS_STORAGE = 'nutrolix_shown_notif_ids';
  let foregroundFcmAttached = false;
  let permissionRequestInFlight = null;

  function getApiHost() {
    return window.NUTROLIX_API_HOST || '';
  }

  function getDeviceId() {
    try {
      let id = localStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        const rand = (window.crypto && typeof window.crypto.randomUUID === 'function')
          ? window.crypto.randomUUID()
          : (Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10));
        id = (window.AndroidNative ? 'apk_' : 'web_') + rand;
        localStorage.setItem(DEVICE_ID_KEY, id);
      }
      return id;
    } catch (_) {
      return (window.AndroidNative ? 'apk_' : 'web_') + 'session';
    }
  }

  function getChromeSettingsHelp() {
    const ua = String(navigator.userAgent || '').toLowerCase();
    if (window.AndroidNative) {
      return 'Open Phone Settings -> Apps -> Nutrolix -> Notifications and turn Allow notifications ON.';
    }
    if (ua.includes('android') || ua.includes('mobile')) {
      return 'In Mobile Chrome: tap the tune/lock icon left of the address bar -> Permissions -> Notifications -> Allow, then reload.';
    }
    return 'In Chrome: click the site-settings/tune icon next to the URL bar -> Notifications -> Allow, then reload this page.';
  }

  function getNotificationStatus() {
    const isNative = Boolean(window.AndroidNative);
    const supported = isNative || ('Notification' in window);
    const permission = isNative ? 'granted' : (supported ? Notification.permission : 'unsupported');
    const active = isNative || permission === 'granted';
    const registered = localStorage.getItem(STORAGE_KEY) === 'true';
    return {
      supported,
      permission,
      active,
      enabled: active,
      registered,
      platform: isNative ? 'android-apk' : 'web',
      settingsHelp: permission === 'denied' ? getChromeSettingsHelp() : ''
    };
  }

  function emitStatusChanged() {
    try {
      window.dispatchEvent(new CustomEvent('nutrolix:notification-status-changed', {
        detail: getNotificationStatus()
      }));
    } catch (_) {}
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

  // Strictly read ONLY verified Nutrolix customer session (never unverified localStorage)
  function getCustomerInfo() {
    let customer = null;
    try {
      if (typeof window.getNutrolixUser === 'function') {
        customer = window.getNutrolixUser();
      }
    } catch (_) {}
    if (!customer || !customer.authSession || !customer.verified || !customer.phoneVerified) {
      return { uid: '', phone: '', email: '' };
    }
    return {
      uid: customer.uid || '',
      phone: customer.verifiedPhone || customer.phone || customer.whatsappNumber || '',
      email: customer.email || ''
    };
  }

  async function getFirebaseIdToken() {
    try {
      if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        return await firebase.auth().currentUser.getIdToken();
      }
    } catch (_) {}
    return '';
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return null;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      try {
        return await navigator.serviceWorker.ready || reg;
      } catch (_) {
        return reg;
      }
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
      const role = extra.role || (String(extra.platform || '').includes('admin') ? 'admin' : 'customer');
      if (role !== 'admin' && (!uid || !phone)) {
        return false;
      }

      const subJson = subscription && typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription;
      const fcmToken = extra.fcmToken || '';
      const platform = extra.platform || (window.AndroidNative ? 'android-apk' : 'web');
      const deviceId = getDeviceId();

      if (!fcmToken && !(subJson && subJson.endpoint)) {
        return false;
      }

      const headers = { 'Content-Type': 'application/json' };
      const idToken = await getFirebaseIdToken();
      if (idToken) headers.Authorization = 'Bearer ' + idToken;

      const res = await fetch(getApiHost() + '/api/notifications/register-token', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          uid,
          role,
          deviceId,
          fcmToken,
          token: fcmToken || (subJson && subJson.endpoint) || '',
          subscription: subJson,
          customerPhone: phone,
          customerEmail: email,
          platform,
          userAgent: navigator.userAgent
        })
      });

      if (!res.ok) return false;

      if (uid && fcmToken && window.NutrolixFirebase && typeof window.NutrolixFirebase.saveFcmToken === 'function') {
        window.NutrolixFirebase.saveFcmToken(uid, {
          fcmToken,
          platform,
          deviceId,
          customerPhone: phone,
          customerEmail: email
        }).catch(() => {});
      }

      localStorage.setItem(STORAGE_KEY, 'true');
      emitStatusChanged();
      return true;
    } catch (err) {
      console.warn('[Nutrolix Notifications] Token registration error:', err);
      return false;
    }
  }

  function attachForegroundFcmListener() {
    if (foregroundFcmAttached || window.AndroidNative) return;
    if (typeof firebase === 'undefined' || typeof firebase.messaging !== 'function') return;
    try {
      const messaging = firebase.messaging();
      if (typeof messaging.onMessage === 'function') {
        foregroundFcmAttached = true;
        messaging.onMessage((payload) => {
          const notif = (payload && payload.notification) || {};
          const data = (payload && payload.data) || {};
          const dedupId = data.dedupKey || data.orderId || `${notif.title || ''}:${notif.body || ''}`;
          if (markShownToastId(dedupId)) {
            showClickableToast({
              title: notif.title || data.title || 'Nutrolix Order Update',
              message: notif.body || data.body || data.message || '',
              orderId: data.orderId,
              url: data.url
            });
          }
          window.dispatchEvent(new CustomEvent('nutrolix:order-push', { detail: payload }));
        });
      }
    } catch (_) {}
  }

  async function syncWebPushSubscription() {
    if (window.AndroidNative || !('Notification' in window) || Notification.permission !== 'granted') {
      return false;
    }
    const { uid, phone } = getCustomerInfo();
    if (!uid || !phone) {
      return false;
    }
    const reg = await registerServiceWorker();
    let synced = false;
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
        if (subscription) {
          synced = await sendSubscriptionToBackend(subscription, { platform: 'web' });
        }
      } catch (_) {}
    }

    attachForegroundFcmListener();

    // Fall back to Web FCM token only if RFC 8291 Web Push subscription was unavailable
    if (!synced && typeof firebase !== 'undefined' && typeof firebase.messaging === 'function' && reg) {
      try {
        const messaging = firebase.messaging();
        const vapid = await getVapidPublicKey();
        const fcmTok = await messaging.getToken({ vapidKey: vapid, serviceWorkerRegistration: reg });
        if (fcmTok) {
          localStorage.setItem('nutrolix_web_fcm_token', fcmTok);
          const okFcm = await sendSubscriptionToBackend(null, { fcmToken: fcmTok, platform: 'web-fcm' });
          synced = synced || okFcm;
        }
      } catch (_) {}
    }
    return synced;
  }

  async function syncNativeAndroidToken() {
    if (window.AndroidNative && typeof window.AndroidNative.getFcmToken === 'function') {
      try { window.AndroidNative.getFcmToken(); } catch (_) {}
    }
    const cachedNative = localStorage.getItem('nutrolix_native_fcm_token');
    if (cachedNative) {
      await sendSubscriptionToBackend(null, { fcmToken: cachedNative, platform: 'android-apk' });
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
      emitStatusChanged();
      return true;
    }
    if (!('Notification' in window)) {
      emitStatusChanged();
      return false;
    }
    if (Notification.permission === 'granted') {
      const ok = await syncWebPushSubscription();
      emitStatusChanged();
      return ok;
    }
    if (Notification.permission === 'denied') {
      emitStatusChanged();
      return false;
    }
    if (permissionRequestInFlight) return permissionRequestInFlight;

    permissionRequestInFlight = (async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          await syncWebPushSubscription();
          emitStatusChanged();
          return true;
        }
        emitStatusChanged();
        return false;
      } catch (err) {
        console.warn('[Nutrolix Notifications] Permission request notice:', err);
        emitStatusChanged();
        return false;
      } finally {
        permissionRequestInFlight = null;
      }
    })();

    return permissionRequestInFlight;
  }

  // Trigger safely inside user interactions (OTP submit, checkout Confirm Order, profile save)
  async function ensurePermissionOnGesture() {
    if (window.AndroidNative) {
      return syncNativeAndroidToken();
    }
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'default') {
      return requestNotificationPermission();
    }
    if (Notification.permission === 'granted') {
      return syncWebPushSubscription();
    }
    return false;
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

  function escHtml(str) {
    return String(str || '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
  }

  let customerAudioCtx = null;
  let customerAudioUnlocked = false;

  function unlockCustomerAudio() {
    if (window.AndroidNative) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!customerAudioCtx) customerAudioCtx = new AudioContextClass();
      if (customerAudioCtx.state === 'suspended') {
        customerAudioCtx.resume().then(() => { customerAudioUnlocked = true; }).catch(() => {});
      } else {
        customerAudioUnlocked = true;
      }
      if (!customerAudioUnlocked && customerAudioCtx.state === 'running') {
        const buf = customerAudioCtx.createBuffer(1, 1, 22050);
        const src = customerAudioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(customerAudioCtx.destination);
        src.start(0);
        customerAudioUnlocked = true;
      }
    } catch (_) {}
  }

  ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, unlockCustomerAudio, { passive: true, capture: true });
  });

  function playCustomerNotificationTone() {
    if (window.AndroidNative) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!customerAudioCtx) customerAudioCtx = new AudioContextClass();
      if (customerAudioCtx.state === 'suspended') {
        customerAudioCtx.resume().catch(() => {});
      }
      if (customerAudioCtx.state !== 'running') return;

      const now = customerAudioCtx.currentTime;
      const playNote = (freq, startOffset, duration) => {
        const osc = customerAudioCtx.createOscillator();
        const gain = customerAudioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + startOffset);
        gain.gain.setValueAtTime(0.001, now + startOffset);
        gain.gain.exponentialRampToValueAtTime(0.25, now + startOffset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
        osc.connect(gain);
        gain.connect(customerAudioCtx.destination);
        osc.start(now + startOffset);
        osc.stop(now + startOffset + duration + 0.02);
      };
      playNote(880, 0, 0.18);
      playNote(1174.66, 0.16, 0.28);
    } catch (_) {}
  }

  function showClickableToast({ title, message, orderId, url }) {
    const existing = document.getElementById('nutrolixOrderLiveToast');
    if (existing) existing.remove();

    playCustomerNotificationTone();

    let targetHref = orderId ? `orders.html?orderId=${encodeURIComponent(orderId)}` : 'orders.html';
    if (url) {
      targetHref = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '') || targetHref;
    }

    const toast = document.createElement('div');
    toast.id = 'nutrolixOrderLiveToast';
    toast.className = 'fixed top-4 right-4 left-4 sm:left-auto sm:w-96 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 z-[9998] cursor-pointer transition-all';
    toast.innerHTML = `
      <div class="flex items-start space-x-3">
        <div class="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
          <i class="fa-solid fa-bell"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-black text-emerald-300 truncate">${escHtml(title || 'Nutrolix Order Update')}</p>
          <p class="text-xs text-slate-100 mt-0.5 leading-snug">${escHtml(message || '')}</p>
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
      if (!uid && !phone) return;
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
    await syncNativeAndroidToken();
    attachUserNotificationListeners();
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      await syncWebPushSubscription();
    }
    emitStatusChanged();
  });

  function boot() {
    registerServiceWorker();
    syncNativeAndroidToken();
    attachUserNotificationListeners();
    attachForegroundFcmListener();
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      syncWebPushSubscription();
    }
    initOrderNotificationSync();
    emitStatusChanged();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.NutrolixNotifications = {
    requestPermission: requestNotificationPermission,
    ensurePermissionOnGesture,
    getNotificationStatus,
    getChromeSettingsHelp,
    registerServiceWorker,
    sendSubscriptionToBackend,
    showClickableToast
  };
})();
