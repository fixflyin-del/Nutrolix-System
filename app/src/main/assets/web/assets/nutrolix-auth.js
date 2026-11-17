/**
 * Nutrolix Customer Authentication (WhatsApp Mobile Number + Firebase Phone OTP)
 * Works seamlessly across Android APK WebView (via AndroidNative bridge), Mobile Web, and Desktop Web.
 */
(function() {
  if (typeof window.NUTROLIX_API_HOST === 'undefined') {
    window.NUTROLIX_API_HOST = (window.location && window.location.protocol === 'file:')
      ? 'https://nutrolixweb.vercel.app'
      : '';
  }

  const firebaseConfig = {
    apiKey: "AIzaSyBuhfsAcQYge5kp71vHA4qgQhpA7ryur-A",
    authDomain: "com-aistudio-nutrolix-fo-56ac8.firebaseapp.com",
    projectId: "com-aistudio-nutrolix-fo-56ac8",
    storageBucket: "com-aistudio-nutrolix-fo-56ac8.firebasestorage.app",
    messagingSenderId: "836516139018",
    appId: "1:836516139018:android:6ec9886f508ace4b1f4ff3"
  };

  try {
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
  } catch (e) {
    console.warn('Firebase initialization warning:', e);
  }

  function clean10Phone(p) {
    if (!p) return '';
    return String(p).replace(/\D/g, '').slice(-10);
  }

  function isMeaningfulName(n) {
    const clean = String(n || '').trim().toLowerCase();
    return Boolean(clean) && !['nutrolix customer', 'customer', 'guest', 'guest customer', 'user'].includes(clean);
  }

  function pickBestName() {
    for (let i = 0; i < arguments.length; i++) {
      const val = arguments[i];
      if (isMeaningfulName(val)) return String(val).trim();
    }
    return 'Nutrolix Customer';
  }

  function toCanonicalUid(uid, phone) {
    const cleanPhone = clean10Phone(phone);
    if (cleanPhone.length === 10 && /^[6-9]\d{9}$/.test(cleanPhone)) {
      return 'phone_' + cleanPhone;
    }
    return String(uid || '').trim();
  }

  function buildAvatar(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Customer')}&background=047857&color=fff&bold=true`;
  }

  function clearCustomerLocalCaches(keepProfile) {
    if (!keepProfile) {
      localStorage.removeItem('nutrolix_user_profile');
    }
    localStorage.removeItem('nutrolix_saved_addresses');
    localStorage.removeItem('nutrolix_customer_orders');
    localStorage.removeItem('nutrolix_orders');
    localStorage.removeItem('nutrolix_store_orders');
    localStorage.removeItem('nutrolix_food_orders');
    localStorage.removeItem('nutrolix_notification_registered');
    localStorage.removeItem('nutrolix_pending_otp_phone');
    sessionStorage.removeItem('nutrolix_shown_notif_ids');
  }

  let pendingNativePhoneCallbacks = null;
  let pendingNativeOtpCallbacks = null;
  let hydrationPromise = null;

  // Get current logged-in user profile (WhatsApp Mobile OTP / Phone Auth)
  window.getNutrolixUser = function() {
    try {
      const p = JSON.parse(localStorage.getItem('nutrolix_user_profile') || '{}');
      const phoneDigits = clean10Phone(
        p.verifiedPhone || p.phone || p.whatsappNumber || (String(p.uid || '').startsWith('phone_') ? String(p.uid).slice(6) : '')
      );
      const hasIdentity = Boolean(
        p &&
        p.authSession === true &&
        p.uid &&
        phoneDigits.length === 10 &&
        (p.verified === true || p.phoneVerified === true) &&
        p.authProvider === 'phone'
      );
      if (hasIdentity) {
        if (!p.phone && phoneDigits) p.phone = phoneDigits;
        if (!p.verifiedPhone && phoneDigits) p.verifiedPhone = phoneDigits;
        if (!p.whatsappNumber && phoneDigits) p.whatsappNumber = phoneDigits;
        return p;
      }
    } catch (_) {}
    return null;
  };

  // Save authenticated user profile & hydrate Firestore + backend
  window.saveNutrolixUser = function(userData, opts = {}) {
    let existing = {};
    try {
      existing = JSON.parse(localStorage.getItem('nutrolix_user_profile') || '{}');
    } catch (_) {}

    const verifiedPhone = clean10Phone(
      userData.verifiedPhone ||
      (userData.phoneVerified ? userData.phone : '') ||
      userData.phone ||
      (String(userData.uid || '').startsWith('phone_') ? String(userData.uid).slice(6) : '') ||
      existing.verifiedPhone ||
      ''
    );
    const targetUid = toCanonicalUid(userData.uid || existing.uid || '', verifiedPhone);

    // Clear cross-account local caches if account UID switched
    if (existing.uid && targetUid && existing.uid !== targetUid) {
      clearCustomerLocalCaches(true);
      existing = {};
    }

    const displayPhone = clean10Phone(userData.phone || verifiedPhone || existing.phone || '');
    const whatsappNumber = clean10Phone(userData.whatsappNumber || existing.whatsappNumber || displayPhone || '');
    const name = pickBestName(userData.name, existing.name);

    const updated = {
      ...existing,
      ...userData,
      uid: targetUid,
      id: targetUid,
      name,
      email: String(
        (userData.email !== undefined && userData.email !== '') ? userData.email : (existing.email || '')
      ).trim().toLowerCase(),
      phone: displayPhone,
      verifiedPhone,
      whatsappNumber,
      photo: userData.photo || existing.photo || buildAvatar(name),
      providers: ['phone'],
      phoneVerified: Boolean(verifiedPhone.length === 10),
      googleLinked: false,
      authProvider: 'phone',
      verified: true,
      authSession: true,
      lastLoginAt: new Date().toISOString()
    };

    localStorage.setItem('nutrolix_user_profile', JSON.stringify(updated));
    try { localStorage.setItem('nutrolix_auth_at', String(Date.now())); } catch (_) {}

    if (!opts.skipRemoteSync) {
      try {
        if (window.NutrolixFirebase && typeof window.NutrolixFirebase.saveUserProfile === 'function' && updated.uid) {
          window.NutrolixFirebase.saveUserProfile(updated.uid, updated).catch(() => {});
        } else if (window.NutrolixFirebase && typeof window.NutrolixFirebase.saveUser === 'function') {
          window.NutrolixFirebase.saveUser(updated).catch(() => {});
        }
      } catch (_) {}

      try {
        const host = window.NUTROLIX_API_HOST || '';
        fetch(host + '/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        }).catch(() => {});
      } catch (_) {}
    }

    window.dispatchEvent(new CustomEvent('nutrolix:auth-changed', { detail: updated }));
    return updated;
  };

  function firebaseUserToProfile(u, extra = {}, opts = {}) {
    if (!u) return null;
    const fromUid = String(u.uid || '').startsWith('phone_') ? String(u.uid).slice(6) : '';
    const verifiedPhone = clean10Phone(u.phoneNumber || extra.verifiedPhone || extra.phone || fromUid || '');
    return window.saveNutrolixUser({
      uid: toCanonicalUid(u.uid, verifiedPhone),
      name: pickBestName(extra.name, u.displayName),
      email: extra.email || u.email || '',
      phone: verifiedPhone,
      verifiedPhone,
      whatsappNumber: extra.whatsappNumber || verifiedPhone,
      photo: u.photoURL || extra.photo || '',
      city: extra.city || '',
      state: extra.state || '',
      pincode: extra.pincode || '',
      defaultAddress: extra.defaultAddress || '',
      providers: ['phone'],
      phoneVerified: Boolean(verifiedPhone.length === 10)
    }, opts);
  }

  // Authoritative server & Firestore hydration: remote Firestore/server profile & addresses ALWAYS win over stale localStorage
  async function hydrateFromFirestore(uid, firebaseUser = null) {
    if (!uid) return null;
    if (hydrationPromise) return hydrationPromise;
    hydrationPromise = (async () => {
      try {
        const local = window.getNutrolixUser() || {};
        const phone = clean10Phone(
          local.verifiedPhone || local.phone || (String(uid).startsWith('phone_') ? String(uid).slice(6) : '')
        );
        const canonicalUid = toCanonicalUid(uid, phone);
        let serverProfile = null;
        let serverAddresses = null;

        // 1. Server-side canonical sync (reads both DBs + migrates legacy UIDs)
        try {
          const authUser = firebaseUser || (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null);
          const idToken = authUser ? await authUser.getIdToken().catch(() => '') : '';
          if (idToken) {
            const host = window.NUTROLIX_API_HOST || '';
            const res = await fetch(host + '/api/auth/sync-canonical', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + idToken
              },
              body: JSON.stringify({
                uid: canonicalUid,
                phone,
                profile: local
              })
            });
            if (res.ok) {
              const syncData = await res.json().catch(() => null);
              if (syncData && syncData.success) {
                if (syncData.profile) serverProfile = syncData.profile;
                if (Array.isArray(syncData.addresses)) serverAddresses = syncData.addresses;
              }
            }
          }
        } catch (_) {}

        // 2. Direct Firestore read fallback / merge
        let remoteProfile = serverProfile;
        if (!remoteProfile && window.NutrolixFirebase && typeof window.NutrolixFirebase.fetchUserProfile === 'function') {
          remoteProfile = await window.NutrolixFirebase.fetchUserProfile(canonicalUid);
        }

        if (remoteProfile) {
          const bestName = pickBestName(remoteProfile.name, local.name);
          const merged = {
            ...local,
            ...remoteProfile,
            uid: canonicalUid,
            id: canonicalUid,
            name: bestName,
            email: remoteProfile.email || local.email || '',
            phone: clean10Phone(remoteProfile.verifiedPhone || remoteProfile.phone || phone) || phone,
            verifiedPhone: clean10Phone(remoteProfile.verifiedPhone || remoteProfile.phone || phone) || phone,
            whatsappNumber: clean10Phone(remoteProfile.whatsappNumber || remoteProfile.phone || local.whatsappNumber || phone) || phone,
            city: remoteProfile.city || local.city || '',
            state: remoteProfile.state || local.state || '',
            pincode: remoteProfile.pincode || local.pincode || '',
            defaultAddress: remoteProfile.defaultAddress || local.defaultAddress || '',
            authProvider: 'phone',
            providers: ['phone'],
            phoneVerified: true,
            googleLinked: false,
            verified: true,
            authSession: true
          };
          localStorage.setItem('nutrolix_user_profile', JSON.stringify(merged));
          window.dispatchEvent(new CustomEvent('nutrolix:auth-changed', { detail: merged }));
        }

        let addrs = serverAddresses;
        if (!Array.isArray(addrs) && window.NutrolixFirebase && typeof window.NutrolixFirebase.fetchUserAddresses === 'function') {
          addrs = await window.NutrolixFirebase.fetchUserAddresses(canonicalUid);
        }
        if (Array.isArray(addrs)) {
          localStorage.setItem('nutrolix_saved_addresses', JSON.stringify(addrs));
          window.dispatchEvent(new CustomEvent('nutrolix:addresses-updated', { detail: addrs }));
        }
        return window.getNutrolixUser();
      } catch (_) {
        return null;
      } finally {
        hydrationPromise = null;
      }
    })();
    return hydrationPromise;
  }

  window.hydrateNutrolixCustomerSession = hydrateFromFirestore;

  // Listen to Firebase Web Auth state automatically (Phone Auth & custom token phone_<mobile>)
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(async (u) => {
      const hasPhoneIdentity = Boolean(
        u && (u.phoneNumber || (u.uid && String(u.uid).startsWith('phone_')))
      );
      if (hasPhoneIdentity) {
        let preProfile = null;
        if (window.NutrolixFirebase && typeof window.NutrolixFirebase.fetchUserProfile === 'function') {
          preProfile = await window.NutrolixFirebase.fetchUserProfile(u.uid).catch(() => null);
        }
        const prof = firebaseUserToProfile(u, preProfile || {}, { skipRemoteSync: true });
        await hydrateFromFirestore(u.uid, u);
        window.dispatchEvent(new CustomEvent('nutrolix:auth-changed', { detail: window.getNutrolixUser() || prof }));
      }
    });
  }

  // If running inside Android APK, seed synchronously from native FirebaseAuth/SharedPrefs so pages see session immediately
  try {
    if (!window.getNutrolixUser() && window.AndroidNative && typeof window.AndroidNative.getAuthUserJson === 'function') {
      const raw = window.AndroidNative.getAuthUserJson();
      if (raw) {
        const parsed = JSON.parse(raw);
        const phoneDigits = clean10Phone(
          parsed.verifiedPhone || parsed.phone || (String(parsed.uid || '').startsWith('phone_') ? String(parsed.uid).slice(6) : '')
        );
        if (parsed && (parsed.uid || phoneDigits.length === 10) && phoneDigits.length === 10) {
          const canonicalUid = toCanonicalUid(parsed.uid, phoneDigits);
          window.saveNutrolixUser({
            uid: canonicalUid,
            name: pickBestName(parsed.name),
            phone: phoneDigits,
            verifiedPhone: phoneDigits,
            whatsappNumber: phoneDigits,
            photo: parsed.photo || '',
            providers: ['phone']
          }, { skipRemoteSync: true });
          hydrateFromFirestore(canonicalUid);
        }
      }
    }
  } catch (_) {}

  // -------------------------------------------------------------
  // WHATSAPP MOBILE NUMBER + OTP (FAST2SMS + FIREBASE CUSTOM AUTH)
  // -------------------------------------------------------------
  const FAST2SMS_AUTH_API_BASE = (window.location && window.location.protocol === 'file:')
    ? 'https://nutrolixweb.vercel.app'
    : (window.NUTROLIX_API_HOST || '');

  window.startNutrolixPhoneOtp = async function(rawPhone) {
    const digits = clean10Phone(rawPhone);
    if (digits.length !== 10 || !/^[6-9]\d{9}$/.test(digits)) {
      throw new Error('Please enter a valid 10-digit Indian WhatsApp number.');
    }
    localStorage.setItem('nutrolix_pending_otp_phone', JSON.stringify(digits));
    const response = await fetch(FAST2SMS_AUTH_API_BASE + '/api/auth/whatsapp/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: digits })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success !== true) {
      throw new Error(result.error || 'Unable to send WhatsApp OTP. Please try again.');
    }
    return { mode: 'fast2sms', phoneE164: '+91' + digits, requestId: result.requestId || '' };
  };

  window.verifyNutrolixPhoneOtp = async function(otpCode) {
    const cleanOtp = String(otpCode || '').replace(/\D/g, '');
    if (cleanOtp.length !== 6) throw new Error('Please enter the 6-digit OTP code.');
    const saved = JSON.parse(localStorage.getItem('nutrolix_pending_otp_phone') || 'null');
    const phone = clean10Phone(saved || '');
    if (phone.length !== 10) throw new Error('OTP session expired. Please request a new OTP.');
    const response = await fetch(FAST2SMS_AUTH_API_BASE + '/api/auth/whatsapp/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: phone, otp: cleanOtp })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success !== true || !result.customToken) {
      throw new Error(result.error || 'Incorrect or expired OTP. Please try again.');
    }
    if (typeof firebase === 'undefined' || !firebase.auth) {
      throw new Error('Firebase Auth SDK is not loaded. Please refresh and try again.');
    }

    const authResult = await firebase.auth().signInWithCustomToken(result.customToken);
    localStorage.removeItem('nutrolix_pending_otp_phone');

    const serverProfile = result.profile && typeof result.profile === 'object' ? result.profile : {};
    const profile = firebaseUserToProfile(authResult.user, {
      ...serverProfile,
      phone,
      verifiedPhone: phone,
      whatsappNumber: serverProfile.whatsappNumber || phone
    }, { skipRemoteSync: true });

    if (Array.isArray(result.addresses)) {
      localStorage.setItem('nutrolix_saved_addresses', JSON.stringify(result.addresses));
    }

    // Sync session into Android Native bridge so FCM registration attaches canonical UID immediately
    try {
      if (window.AndroidNative && typeof window.AndroidNative.syncAuthSession === 'function') {
        window.AndroidNative.syncAuthSession(authResult.user.uid, phone, result.customToken);
      }
    } catch (_) {}

    const hydrated = await hydrateFromFirestore(authResult.user.uid, authResult.user);
    const finalProfile = hydrated || profile;
    if (typeof window.onAuthSuccessCallback === 'function') window.onAuthSuccessCallback(finalProfile);
    return finalProfile;
  };

  async function handleNativePhoneSuccess(u) {
    const phoneDigits = clean10Phone(u.verifiedPhone || u.phone || '');
    const canonicalUid = toCanonicalUid(u.uid, phoneDigits);
    const profile = window.saveNutrolixUser({
      uid: canonicalUid,
      name: pickBestName(u.name),
      phone: phoneDigits,
      verifiedPhone: phoneDigits,
      whatsappNumber: phoneDigits,
      photo: u.photo || '',
      providers: ['phone']
    }, { skipRemoteSync: true });
    const hydrated = await hydrateFromFirestore(canonicalUid);
    const finalProfile = hydrated || profile;
    if (typeof window.onAuthSuccessCallback === 'function') window.onAuthSuccessCallback(finalProfile);
    return finalProfile;
  }

  window.onNativeUnifiedAuthSuccess = async function(payload) {
    return handleNativePhoneSuccess(payload || {});
  };

  window.onNativePhoneOtpSent = function(payload) {
    if (pendingNativePhoneCallbacks && pendingNativePhoneCallbacks.onSent) {
      const cb = pendingNativePhoneCallbacks.onSent;
      pendingNativePhoneCallbacks = null;
      cb(payload || {});
    }
  };

  window.onNativePhoneAuthSuccess = async function(payload) {
    const prof = await handleNativePhoneSuccess(payload || {});
    if (pendingNativePhoneCallbacks && pendingNativePhoneCallbacks.onInstant) {
      const cb = pendingNativePhoneCallbacks.onInstant;
      pendingNativePhoneCallbacks = null;
      cb(payload || {});
    }
    if (pendingNativeOtpCallbacks) {
      const { resolve } = pendingNativeOtpCallbacks;
      pendingNativeOtpCallbacks = null;
      resolve(prof);
    }
  };

  window.onNativePhoneAuthError = function(err) {
    if (pendingNativePhoneCallbacks && pendingNativePhoneCallbacks.onError) {
      const cb = pendingNativePhoneCallbacks.onError;
      pendingNativePhoneCallbacks = null;
      cb(err || {});
    }
    if (pendingNativeOtpCallbacks) {
      const { reject } = pendingNativeOtpCallbacks;
      pendingNativeOtpCallbacks = null;
      reject(new Error((err && err.message) || 'OTP verification failed.'));
    }
  };

  // Sign out cleanly — clears ALL account-scoped caches to prevent cross-account leakage
  window.handleNutrolixSignOut = function() {
    try {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().signOut().catch(() => {});
      }
      if (window.AndroidNative && typeof window.AndroidNative.signOut === 'function') {
        window.AndroidNative.signOut();
      }
    } catch (_) {}

    clearCustomerLocalCaches(false);
    window.dispatchEvent(new CustomEvent('nutrolix:auth-changed', { detail: null }));
    if (typeof window.onAuthSignOutCallback === 'function') {
      window.onAuthSignOutCallback();
    }
  };

  // -------------------------------------------------------------
  // UNIVERSAL WHATSAPP NUMBER + OTP AUTH MODAL (WORKS ON ANY PAGE)
  // -------------------------------------------------------------
  window.openNutrolixAuthModal = function(options = {}) {
    const existingModal = document.getElementById('nutrolixUnifiedAuthModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'nutrolixUnifiedAuthModal';
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 relative">
        <button id="closeUnifiedAuthModal" aria-label="Close login modal" class="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <div class="text-center mb-5">
          <span class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-black uppercase tracking-wider border border-emerald-200 mb-2">
            <i class="fa-brands fa-whatsapp mr-1.5 text-emerald-600"></i>WhatsApp Mobile Login
          </span>
          <h3 class="text-xl font-black text-slate-900">${options.title || 'Login or Sign Up with WhatsApp'}</h3>
          <p class="text-xs text-slate-500 mt-1">${options.subtitle || 'Enter your 10-digit WhatsApp mobile number and tap OK to receive an OTP.'}</p>
        </div>

        <div id="uamPhoneSection" class="space-y-3">
          <div>
            <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">WhatsApp Mobile Number</label>
            <div class="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-50 focus-within:bg-white focus-within:border-emerald-600 pr-1.5">
              <span class="px-3 py-2.5 text-sm font-black text-slate-700 bg-slate-100 border-r border-slate-300 shrink-0">+91</span>
              <input id="uamPhoneInput" type="tel" maxlength="10" inputmode="numeric" placeholder="10-digit WhatsApp number" class="w-full min-w-0 px-3 py-2.5 bg-transparent text-sm font-bold text-slate-900 outline-none" />
              <button id="uamSendOtpBtn" type="button" aria-label="Confirm WhatsApp number and send OTP" class="shrink-0 h-8 px-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] shadow-sm flex items-center justify-center space-x-1 transition active:scale-95 cursor-pointer">
                <span>OK</span>
                <i class="fa-solid fa-arrow-right text-[10px]"></i>
              </button>
            </div>
          </div>

          <div id="uamOtpGroup" class="hidden space-y-2.5 pt-1">
            <label class="block text-[11px] font-bold text-slate-600 uppercase">Enter 6-Digit OTP</label>
            <input id="uamOtpInput" type="tel" maxlength="6" inputmode="numeric" placeholder="••••••" class="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-center tracking-[0.4em] text-base font-black text-slate-900 outline-none focus:border-emerald-600" />
            <div class="flex items-center justify-between text-[11px]">
              <button id="uamResendOtpBtn" type="button" class="text-emerald-700 font-bold hover:underline">Resend OTP</button>
              <span id="uamOtpTargetText" class="text-slate-500"></span>
            </div>
            <button id="uamVerifyOtpBtn" type="button" class="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer">
              <i class="fa-solid fa-circle-check"></i>
              <span>Verify OTP & Continue</span>
            </button>
          </div>
          <p id="uamErrorMsg" class="hidden text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2"></p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = document.getElementById('closeUnifiedAuthModal');
    const phoneInput = document.getElementById('uamPhoneInput');
    const otpGroup = document.getElementById('uamOtpGroup');
    const otpInput = document.getElementById('uamOtpInput');
    const sendBtn = document.getElementById('uamSendOtpBtn');
    const verifyBtn = document.getElementById('uamVerifyOtpBtn');
    const resendBtn = document.getElementById('uamResendOtpBtn');
    const errEl = document.getElementById('uamErrorMsg');

    const showErr = (msg) => {
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
    };
    const clearErr = () => errEl.classList.add('hidden');

    const prevCallback = window.onAuthSuccessCallback;
    const finish = (prof) => {
      modal.remove();
      window.onAuthSuccessCallback = prevCallback;
      if (typeof options.onSuccess === 'function') options.onSuccess(prof);
      else if (typeof prevCallback === 'function') prevCallback(prof);
    };

    window.onAuthSuccessCallback = finish;

    closeBtn.onclick = () => {
      window.onAuthSuccessCallback = prevCallback;
      modal.remove();
    };

    const sendOtp = async (isResend) => {
      clearErr();
      const digits = clean10Phone(phoneInput.value);
      if (digits.length !== 10) {
        showErr('Please enter a valid 10-digit WhatsApp mobile number.');
        phoneInput.focus();
        return;
      }
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-[10px]"></i>';
      try {
        window.NutrolixNotifications?.ensurePermissionOnGesture?.().catch?.(() => {});
        const res = await window.startNutrolixPhoneOtp(digits, { isResend });
        if (res.mode === 'instant' && res.profile) {
          finish(res.profile);
          return;
        }
        otpGroup.classList.remove('hidden');
        document.getElementById('uamOtpTargetText').textContent = `Sent to +91 ${digits}`;
        otpInput.focus();
      } catch (e) {
        showErr(e.message || 'Unable to send OTP. Please try again.');
      } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<span>OK</span><i class="fa-solid fa-arrow-right text-[10px]"></i>';
      }
    };

    sendBtn.onclick = () => sendOtp(false);
    resendBtn.onclick = () => sendOtp(true);

    verifyBtn.onclick = async () => {
      clearErr();
      verifyBtn.disabled = true;
      verifyBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i><span>Verifying...</span>';
      try {
        window.NutrolixNotifications?.ensurePermissionOnGesture?.().catch?.(() => {});
        const prof = await window.verifyNutrolixPhoneOtp(otpInput.value);
        window.NutrolixNotifications?.ensureWebPushSynced?.(2000).catch?.(() => {});
        finish(prof);
      } catch (e) {
        showErr(e.message || 'Incorrect OTP. Please try again.');
      } finally {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i><span>Verify OTP & Continue</span>';
      }
    };
  };

  // Sync with authoritative system resetEpoch so purged customer/order caches clear cleanly across browsers & APKs
  (async function syncCustomerSystemResetEpoch() {
    try {
      const host = window.NUTROLIX_API_HOST || '';
      const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const tid = ac ? setTimeout(() => ac.abort(), 4500) : null;
      const res = await fetch(host + '/api/system/reset-state', ac ? { cache: 'no-store', signal: ac.signal } : { cache: 'no-store' })
        .finally(() => { if (tid) clearTimeout(tid); });
      if (!res || !res.ok) return;
      const data = await res.json().catch(() => null);
      const srvEpoch = Number(data && data.resetEpoch) || 0;
      const seenEpoch = Number(localStorage.getItem('nutrolix_last_reset_epoch') || 0);
      if (srvEpoch > seenEpoch) {
        const lastAuthAt = Number(localStorage.getItem('nutrolix_auth_at') || 0);
        const signedInAfterReset = lastAuthAt >= srvEpoch;
        clearCustomerLocalCaches(signedInAfterReset);
        if (!signedInAfterReset) {
          try { if (typeof firebase !== 'undefined' && firebase.auth) await firebase.auth().signOut(); } catch (_) {}
          try { if (window.AndroidNative && typeof window.AndroidNative.signOut === 'function') window.AndroidNative.signOut(); } catch (_) {}
          window.dispatchEvent(new CustomEvent('nutrolix:auth-changed', { detail: null }));
        }
        localStorage.setItem('nutrolix_last_reset_epoch', String(srvEpoch));
      }
    } catch (_) {}
  })();
})();
