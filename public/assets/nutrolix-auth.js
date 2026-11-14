/**
 * Nutrolix Customer Authentication (WhatsApp Mobile Number + Firebase Phone OTP)
 * Works seamlessly across Android APK WebView (via AndroidNative bridge), Mobile Web, and Desktop Web.
 */
(function() {
  if (typeof window.NUTROLIX_API_HOST === 'undefined') {
    window.NUTROLIX_API_HOST = (window.location && window.location.protocol === 'file:')
      ? 'https://ais-dev-hdct4zqciie73skb7kah2l-760738801567.asia-northeast1.run.app'
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

  function toE164India(p) {
    const digits = clean10Phone(p);
    return digits.length === 10 ? `+91${digits}` : '';
  }

  function buildAvatar(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Customer')}&background=047857&color=fff&bold=true`;
  }

  let webConfirmationResult = null;
  let webRecaptchaVerifier = null;
  let nativeVerificationId = '';
  let pendingNativePhoneCallbacks = null;
  let pendingNativeOtpCallbacks = null;

  // Get current logged-in user profile (WhatsApp Mobile OTP / Phone Auth)
  window.getNutrolixUser = function() {
    try {
      const p = JSON.parse(localStorage.getItem('nutrolix_user_profile') || '{}');
      const phoneDigits = clean10Phone(p.verifiedPhone || p.phone || p.whatsappNumber || '');
      const hasIdentity = Boolean(
        p &&
        (p.uid || phoneDigits.length === 10) &&
        (p.verified || p.phoneVerified || p.authProvider === 'phone')
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
  window.saveNutrolixUser = function(userData) {
    let existing = {};
    try {
      existing = JSON.parse(localStorage.getItem('nutrolix_user_profile') || '{}');
    } catch (_) {}

    const verifiedPhone = clean10Phone(
      userData.verifiedPhone ||
      (userData.phoneVerified ? userData.phone : '') ||
      userData.phone ||
      existing.verifiedPhone ||
      ''
    );
    const displayPhone = clean10Phone(userData.phone || verifiedPhone || existing.phone || '');
    const whatsappNumber = clean10Phone(userData.whatsappNumber || existing.whatsappNumber || displayPhone || '');
    const rawName = (userData.name !== undefined ? userData.name : existing.name) || '';
    const name = String(rawName).trim() || 'Nutrolix Customer';

    const updated = {
      ...existing,
      ...userData,
      uid: userData.uid || existing.uid || '',
      name,
      email: String(userData.email !== undefined ? userData.email : (existing.email || '')).trim().toLowerCase(),
      phone: displayPhone,
      verifiedPhone,
      whatsappNumber,
      photo: userData.photo || existing.photo || buildAvatar(name),
      providers: ['phone'],
      phoneVerified: Boolean(verifiedPhone.length === 10),
      googleLinked: false,
      authProvider: 'phone',
      verified: true,
      lastLoginAt: new Date().toISOString()
    };

    localStorage.setItem('nutrolix_user_profile', JSON.stringify(updated));

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

    window.dispatchEvent(new CustomEvent('nutrolix:auth-changed', { detail: updated }));
    return updated;
  };

  function firebaseUserToProfile(u, extra = {}) {
    if (!u) return null;
    const verifiedPhone = clean10Phone(u.phoneNumber || extra.verifiedPhone || extra.phone || '');
    return window.saveNutrolixUser({
      uid: u.uid,
      name: extra.name || u.displayName || 'Nutrolix Customer',
      phone: verifiedPhone,
      verifiedPhone,
      whatsappNumber: extra.whatsappNumber || verifiedPhone,
      photo: u.photoURL || extra.photo || '',
      providers: ['phone'],
      phoneVerified: Boolean(verifiedPhone.length === 10),
      linkedFromUid: extra.previousUid || ''
    });
  }

  // Hydrate Firestore addresses + saved profile right after auth
  async function hydrateFromFirestore(uid) {
    if (!uid || !window.NutrolixFirebase) return;
    try {
      const remoteProfile = await window.NutrolixFirebase.fetchUserProfile(uid);
      if (remoteProfile) {
        const local = window.getNutrolixUser() || {};
        const merged = {
          ...remoteProfile,
          ...local,
          name: (local.name && local.name !== 'Nutrolix Customer') ? local.name : (remoteProfile.name || local.name),
          whatsappNumber: local.whatsappNumber || remoteProfile.whatsappNumber || local.phone || '',
          city: local.city || remoteProfile.city || '',
          state: local.state || remoteProfile.state || '',
          pincode: local.pincode || remoteProfile.pincode || '',
          defaultAddress: local.defaultAddress || remoteProfile.defaultAddress || ''
        };
        localStorage.setItem('nutrolix_user_profile', JSON.stringify(merged));
      }
      const addrs = await window.NutrolixFirebase.fetchUserAddresses(uid);
      if (Array.isArray(addrs) && addrs.length > 0) {
        localStorage.setItem('nutrolix_saved_addresses', JSON.stringify(addrs));
      }
    } catch (_) {}
  }

  // Listen to Firebase Web Auth state automatically (Phone Auth only)
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(async (u) => {
      if (u && u.phoneNumber) {
        const prof = firebaseUserToProfile(u);
        await hydrateFromFirestore(u.uid);
        window.dispatchEvent(new CustomEvent('nutrolix:auth-changed', { detail: prof }));
      }
    });
  }

  // If running inside Android APK, seed from native FirebaseAuth currentUser if WebView localStorage was empty
  setTimeout(() => {
    try {
      if (!window.getNutrolixUser() && window.AndroidNative && typeof window.AndroidNative.getAuthUserJson === 'function') {
        const raw = window.AndroidNative.getAuthUserJson();
        if (raw) {
          const parsed = JSON.parse(raw);
          const phoneDigits = clean10Phone(parsed.verifiedPhone || parsed.phone || '');
          if (parsed && parsed.uid && phoneDigits.length === 10) {
            window.saveNutrolixUser({
              uid: parsed.uid,
              name: parsed.name || 'Nutrolix Customer',
              phone: phoneDigits,
              verifiedPhone: phoneDigits,
              photo: parsed.photo || '',
              providers: ['phone']
            });
            hydrateFromFirestore(parsed.uid);
          }
        }
      }
    } catch (_) {}
  }, 50);

  // -------------------------------------------------------------
  // WHATSAPP MOBILE NUMBER + OTP (FIREBASE PHONE AUTH)
  // -------------------------------------------------------------
  function ensureRecaptchaContainer() {
    let el = document.getElementById('nutrolix-global-recaptcha');
    if (!el) {
      el = document.createElement('div');
      el.id = 'nutrolix-global-recaptcha';
      el.style.position = 'fixed';
      el.style.bottom = '0';
      el.style.left = '0';
      el.style.zIndex = '99999';
      document.body.appendChild(el);
    }
    return 'nutrolix-global-recaptcha';
  }

  window.startNutrolixPhoneOtp = async function(rawPhone, opts = {}) {
    const e164 = toE164India(rawPhone);
    if (!e164) {
      throw new Error('Please enter a valid 10-digit WhatsApp mobile number.');
    }

    // Native Android Bridge path (avoids WebView file:// Recaptcha failures)
    if (window.AndroidNative && typeof window.AndroidNative.startPhoneOtp === 'function') {
      return new Promise((resolve, reject) => {
        pendingNativePhoneCallbacks = {
          onSent: (res) => {
            nativeVerificationId = res.verificationId || '';
            resolve({ mode: 'native', verificationId: nativeVerificationId, phoneE164: e164 });
          },
          onInstant: async (userPayload) => {
            const prof = await handleNativePhoneSuccess(userPayload);
            resolve({ mode: 'instant', profile: prof });
          },
          onError: (err) => {
            reject(new Error((err && err.message) || 'Failed to send OTP.'));
          }
        };
        window.AndroidNative.startPhoneOtp(e164, Boolean(opts.isResend));
      });
    }

    // Web Browser path (Firebase Phone Auth + invisible reCAPTCHA)
    if (typeof firebase === 'undefined' || !firebase.auth) {
      throw new Error('Firebase Auth SDK not loaded.');
    }
    if (window.location && window.location.protocol === 'file:') {
      throw new Error('Phone OTP on Android must use native Play Services.');
    }

    const auth = firebase.auth();
    const containerId = opts.recaptchaContainerId || ensureRecaptchaContainer();
    if (!webRecaptchaVerifier) {
      webRecaptchaVerifier = new firebase.auth.RecaptchaVerifier(containerId, {
        size: 'invisible',
        callback: () => {}
      });
    }

    try {
      webConfirmationResult = await auth.signInWithPhoneNumber(e164, webRecaptchaVerifier);
      return { mode: 'web', phoneE164: e164, confirmationResult: webConfirmationResult };
    } catch (err) {
      try { webRecaptchaVerifier.clear(); } catch (_) {}
      webRecaptchaVerifier = null;
      if (err.code === 'auth/credential-already-in-use') {
        webConfirmationResult = await auth.signInWithPhoneNumber(
          e164,
          new firebase.auth.RecaptchaVerifier(containerId, { size: 'invisible' })
        );
        return { mode: 'web', phoneE164: e164, confirmationResult: webConfirmationResult };
      }
      throw err;
    }
  };

  window.verifyNutrolixPhoneOtp = async function(otpCode) {
    const cleanOtp = String(otpCode || '').replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      throw new Error('Please enter the 6-digit OTP code.');
    }

    if (window.AndroidNative && typeof window.AndroidNative.verifyPhoneOtp === 'function' && nativeVerificationId) {
      return new Promise((resolve, reject) => {
        pendingNativeOtpCallbacks = { resolve, reject };
        window.AndroidNative.verifyPhoneOtp(nativeVerificationId, cleanOtp);
      });
    }

    if (!webConfirmationResult) {
      throw new Error('OTP session expired. Please tap Resend OTP.');
    }

    const auth = firebase.auth();
    const prevUid = auth.currentUser ? auth.currentUser.uid : '';
    let result = null;
    try {
      result = await webConfirmationResult.confirm(cleanOtp);
    } catch (err) {
      if ((err.code === 'auth/credential-already-in-use' || err.code === 'auth/account-exists-with-different-credential') && err.credential) {
        result = await auth.signInWithCredential(err.credential);
      } else {
        throw err;
      }
    }

    const u = result && result.user;
    if (!u) throw new Error('Verification returned empty user.');
    const prevUidToMerge = (prevUid && prevUid !== u.uid) ? prevUid : '';
    const profile = firebaseUserToProfile(u, { previousUid: prevUidToMerge });
    if (prevUidToMerge && window.NutrolixFirebase) {
      await window.NutrolixFirebase.mergeAccountDataToUid(prevUidToMerge, u.uid, profile);
    }
    await hydrateFromFirestore(u.uid);
    if (typeof window.onAuthSuccessCallback === 'function') window.onAuthSuccessCallback(profile);
    return profile;
  };

  async function handleNativePhoneSuccess(u) {
    const phoneDigits = clean10Phone(u.verifiedPhone || u.phone || '');
    const profile = window.saveNutrolixUser({
      uid: u.uid,
      name: u.name || 'Nutrolix Customer',
      phone: phoneDigits,
      verifiedPhone: phoneDigits,
      whatsappNumber: phoneDigits,
      photo: u.photo || '',
      providers: ['phone'],
      linkedFromUid: u.previousUid || ''
    });
    if (u.previousUid && u.uid && u.previousUid !== u.uid && window.NutrolixFirebase) {
      await window.NutrolixFirebase.mergeAccountDataToUid(u.previousUid, u.uid, profile);
    }
    await hydrateFromFirestore(u.uid);
    if (typeof window.onAuthSuccessCallback === 'function') window.onAuthSuccessCallback(profile);
    return profile;
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

  // Sign out
  window.handleNutrolixSignOut = function() {
    try {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().signOut().catch(() => {});
      }
      if (window.AndroidNative && typeof window.AndroidNative.signOut === 'function') {
        window.AndroidNative.signOut();
      }
    } catch (_) {}

    localStorage.removeItem('nutrolix_user_profile');
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
        const prof = await window.verifyNutrolixPhoneOtp(otpInput.value);
        finish(prof);
      } catch (e) {
        showErr(e.message || 'Incorrect OTP. Please try again.');
      } finally {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i><span>Verify OTP & Continue</span>';
      }
    };
  };
})();
