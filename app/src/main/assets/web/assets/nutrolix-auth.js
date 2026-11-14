/**
 * Nutrolix Unified Customer Authentication (Firebase Auth: Mobile OTP + Google + Account Linking)
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
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=047857&color=fff&bold=true`;
  }

  let webConfirmationResult = null;
  let webRecaptchaVerifier = null;
  let nativeVerificationId = '';
  let pendingNativePhoneCallbacks = null;
  let pendingNativeOtpCallbacks = null;

  // Get current logged-in user profile (supports Phone, Google, and Linked Phone+Google)
  window.getNutrolixUser = function() {
    try {
      const p = JSON.parse(localStorage.getItem('nutrolix_user_profile') || '{}');
      const hasIdentity = Boolean(p && (p.uid || p.verifiedPhone || p.phone || p.email) && (p.verified || p.authProvider === 'google' || p.authProvider === 'phone' || p.authProvider === 'phone+google'));
      if (hasIdentity) {
        if (!p.phone && p.verifiedPhone) p.phone = p.verifiedPhone;
        if (!p.whatsappNumber && p.phone) p.whatsappNumber = p.phone;
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

    const verifiedPhone = clean10Phone(userData.verifiedPhone || (userData.phoneVerified ? userData.phone : '') || existing.verifiedPhone || '');
    const email = String(userData.email !== undefined ? userData.email : (existing.email || '')).trim().toLowerCase();
    const providers = Array.isArray(userData.providers)
      ? userData.providers
      : Array.from(new Set([...(existing.providers || []), ...(userData.authProvider === 'phone' ? ['phone'] : []), ...(userData.authProvider === 'google' ? ['google.com'] : [])]));

    const hasPhone = Boolean(verifiedPhone || providers.includes('phone'));
    const hasGoogle = Boolean(email || providers.includes('google.com'));
    const authProvider = userData.authProvider || (hasPhone && hasGoogle ? 'phone+google' : (hasPhone ? 'phone' : 'google'));

    const displayPhone = clean10Phone(userData.phone || verifiedPhone || existing.phone || '');
    const whatsappNumber = clean10Phone(userData.whatsappNumber || existing.whatsappNumber || displayPhone || '');
    const name = (userData.name || existing.name || (email ? email.split('@')[0] : '') || 'Nutrolix Customer').trim();

    const updated = {
      ...existing,
      ...userData,
      uid: userData.uid || existing.uid || '',
      name,
      email,
      phone: displayPhone,
      verifiedPhone,
      whatsappNumber,
      photo: userData.photo || existing.photo || buildAvatar(name),
      providers,
      phoneVerified: hasPhone,
      googleLinked: hasGoogle,
      authProvider,
      verified: true,
      lastLoginAt: new Date().toISOString()
    };

    localStorage.setItem('nutrolix_user_profile', JSON.stringify(updated));

    // Persist profile to Firestore under UID
    try {
      if (window.NutrolixFirebase && typeof window.NutrolixFirebase.saveUserProfile === 'function' && updated.uid) {
        window.NutrolixFirebase.saveUserProfile(updated.uid, updated).catch(() => {});
      } else if (window.NutrolixFirebase && typeof window.NutrolixFirebase.saveUser === 'function') {
        window.NutrolixFirebase.saveUser(updated).catch(() => {});
      }
    } catch (_) {}

    // Sync to server /api/users (supports UID linking migration when linkedFromUid provided)
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
    const providers = Array.isArray(u.providerData)
      ? u.providerData.map(p => p && p.providerId).filter(Boolean)
      : (Array.isArray(extra.providers) ? extra.providers : []);
    const verifiedPhone = clean10Phone(u.phoneNumber || extra.verifiedPhone || '');
    const email = String(u.email || extra.email || '').trim().toLowerCase();
    return window.saveNutrolixUser({
      uid: u.uid,
      name: extra.name || u.displayName || (email ? email.split('@')[0] : 'Nutrolix Customer'),
      email,
      phone: verifiedPhone || extra.phone || '',
      verifiedPhone,
      whatsappNumber: extra.whatsappNumber || verifiedPhone || '',
      photo: u.photoURL || extra.photo || '',
      providers,
      phoneVerified: Boolean(verifiedPhone || providers.includes('phone')),
      googleLinked: Boolean(email || providers.includes('google.com')),
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
          name: local.name && local.name !== 'Nutrolix Customer' ? local.name : (remoteProfile.name || local.name),
          whatsappNumber: local.whatsappNumber || remoteProfile.whatsappNumber || local.phone || '',
          city: local.city || remoteProfile.city || '',
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

  // Listen to Firebase Web Auth state automatically
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(async (u) => {
      if (u) {
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
          if (parsed && parsed.uid) {
            const prof = window.saveNutrolixUser({
              uid: parsed.uid,
              email: parsed.email || '',
              name: parsed.name || 'Nutrolix Customer',
              phone: parsed.phone || parsed.verifiedPhone || '',
              verifiedPhone: parsed.verifiedPhone || '',
              photo: parsed.photo || '',
              providers: parsed.providers || []
            });
            hydrateFromFirestore(parsed.uid);
          }
        }
      }
    } catch (_) {}
  }, 50);

  // -------------------------------------------------------------
  // 1. GOOGLE ACCOUNT SIGN-IN / LINKING
  // -------------------------------------------------------------
  window.startDirectGoogleAuth = async function(btnEl, options = {}) {
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.dataset.origHtml = btnEl.innerHTML;
      btnEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i><span>Connecting Google...</span>';
    }

    const restoreBtn = () => {
      if (btnEl && btnEl.dataset.origHtml) {
        btnEl.disabled = false;
        btnEl.innerHTML = btnEl.dataset.origHtml;
      }
    };

    // Native Android Credential Manager path (handles both sign-in & linkWithCredential)
    if (window.AndroidNative && typeof window.AndroidNative.startGoogleSignIn === 'function') {
      window._pendingGoogleBtnRestore = restoreBtn;
      try {
        window.AndroidNative.startGoogleSignIn();
        return;
      } catch (err) {
        console.warn('AndroidNative.startGoogleSignIn error, falling back:', err);
      }
    }

    try {
      if (typeof firebase === 'undefined' || !firebase.auth) {
        alert('Firebase Auth is loading. Please try again.');
        return;
      }
      const auth = firebase.auth();
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const currentUser = auth.currentUser;
      const shouldLink = Boolean(currentUser && !currentUser.providerData.some(p => p.providerId === 'google.com'));

      let result = null;
      let previousUid = currentUser ? currentUser.uid : '';
      let linkedSameUid = false;

      if (shouldLink) {
        try {
          result = await currentUser.linkWithPopup(provider);
          linkedSameUid = true;
        } catch (linkErr) {
          if (linkErr.code === 'auth/credential-already-in-use' || linkErr.code === 'auth/email-already-in-use') {
            if (linkErr.credential) {
              result = await auth.signInWithCredential(linkErr.credential);
            } else {
              result = await auth.signInWithPopup(provider);
            }
          } else if (linkErr.code === 'auth/popup-blocked') {
            await currentUser.linkWithRedirect(provider);
            return;
          } else {
            throw linkErr;
          }
        }
      } else {
        try {
          result = await auth.signInWithPopup(provider);
        } catch (popupErr) {
          if (popupErr.code === 'auth/popup-blocked') {
            await auth.signInWithRedirect(provider);
            return;
          }
          throw popupErr;
        }
      }

      if (result && result.user) {
        const prevUidToMerge = (!linkedSameUid && previousUid && previousUid !== result.user.uid) ? previousUid : '';
        const profile = firebaseUserToProfile(result.user, { previousUid: prevUidToMerge });
        if (prevUidToMerge && window.NutrolixFirebase) {
          await window.NutrolixFirebase.mergeAccountDataToUid(prevUidToMerge, result.user.uid, profile);
        }
        await hydrateFromFirestore(result.user.uid);
        if (typeof options.onSuccess === 'function') options.onSuccess(profile);
        if (typeof window.onAuthSuccessCallback === 'function') window.onAuthSuccessCallback(profile);
      }
    } catch (err) {
      if (err.code === 'auth/unauthorized-domain') {
        alert('Authorize this domain in Firebase Console -> Authentication -> Settings -> Authorized Domains: ' + window.location.hostname);
      } else if (err.code !== 'auth/popup-closed-by-user') {
        alert('Google Sign-In: ' + (err.message || 'Please try again.'));
      }
    } finally {
      restoreBtn();
    }
  };

  window.linkGoogleAccount = function(btnEl) {
    return window.startDirectGoogleAuth(btnEl, { linkOnly: true });
  };

  // Native callbacks from MainActivity.kt
  window.onNativeUnifiedAuthSuccess = async function(payload) {
    if (window._pendingGoogleBtnRestore) {
      try { window._pendingGoogleBtnRestore(); } catch (_) {}
      window._pendingGoogleBtnRestore = null;
    }
    const u = payload || {};
    const profile = window.saveNutrolixUser({
      uid: u.uid,
      email: u.email || '',
      name: u.name || 'Nutrolix Customer',
      phone: u.phone || u.verifiedPhone || '',
      verifiedPhone: u.verifiedPhone || '',
      photo: u.photo || '',
      providers: u.providers || [],
      linkedFromUid: u.previousUid || ''
    });
    if (u.previousUid && u.uid && u.previousUid !== u.uid && window.NutrolixFirebase) {
      await window.NutrolixFirebase.mergeAccountDataToUid(u.previousUid, u.uid, profile);
    }
    await hydrateFromFirestore(u.uid);
    if (typeof window.onAuthSuccessCallback === 'function') window.onAuthSuccessCallback(profile);
  };

  window.onNativeGoogleSignInSuccess = function(email, name, photo, uid) {
    window.onNativeUnifiedAuthSuccess({ email, name, photo, uid, providers: ['google.com'] });
  };

  window.onNativeGoogleSignInFailure = function(errMsg) {
    if (window._pendingGoogleBtnRestore) {
      try { window._pendingGoogleBtnRestore(); } catch (_) {}
      window._pendingGoogleBtnRestore = null;
    }
    alert('Google Sign-In failed: ' + errMsg);
  };

  window.onNativeGoogleSignInCancelled = function() {
    if (window._pendingGoogleBtnRestore) {
      try { window._pendingGoogleBtnRestore(); } catch (_) {}
      window._pendingGoogleBtnRestore = null;
    }
  };

  // -------------------------------------------------------------
  // 2. MOBILE NUMBER + OTP (FIREBASE PHONE AUTH) + LINKING
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
      throw new Error('Please enter a valid 10-digit Indian mobile number.');
    }

    // Native Android Bridge path (avoids WebView file:// Recaptcha failures!)
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

    const currentUser = auth.currentUser;
    const shouldLink = Boolean(currentUser && !currentUser.phoneNumber);

    try {
      if (shouldLink) {
        webConfirmationResult = await currentUser.linkWithPhoneNumber(e164, webRecaptchaVerifier);
      } else {
        webConfirmationResult = await auth.signInWithPhoneNumber(e164, webRecaptchaVerifier);
      }
      return { mode: 'web', phoneE164: e164, confirmationResult: webConfirmationResult };
    } catch (err) {
      try { webRecaptchaVerifier.clear(); } catch (_) {}
      webRecaptchaVerifier = null;
      if (err.code === 'auth/credential-already-in-use') {
        webConfirmationResult = await auth.signInWithPhoneNumber(e164, new firebase.auth.RecaptchaVerifier(containerId, { size: 'invisible' }));
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
      if (err.code === 'auth/credential-already-in-use' && err.credential) {
        result = await auth.signInWithCredential(err.credential);
      } else if (err.code === 'auth/account-exists-with-different-credential' && err.credential) {
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
    const profile = window.saveNutrolixUser({
      uid: u.uid,
      email: u.email || '',
      name: u.name || 'Nutrolix Customer',
      phone: u.phone || u.verifiedPhone || '',
      verifiedPhone: u.verifiedPhone || u.phone || '',
      whatsappNumber: u.verifiedPhone || u.phone || '',
      photo: u.photo || '',
      providers: u.providers || ['phone'],
      linkedFromUid: u.previousUid || ''
    });
    if (u.previousUid && u.uid && u.previousUid !== u.uid && window.NutrolixFirebase) {
      await window.NutrolixFirebase.mergeAccountDataToUid(u.previousUid, u.uid, profile);
    }
    await hydrateFromFirestore(u.uid);
    if (typeof window.onAuthSuccessCallback === 'function') window.onAuthSuccessCallback(profile);
    return profile;
  }

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
  // 3. UNIVERSAL UNIFIED AUTH MODAL (WORKS ON ANY PAGE)
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
            <i class="fa-solid fa-shield-check mr-1.5"></i>Nutrolix Customer Login
          </span>
          <h3 class="text-xl font-black text-slate-900">${options.title || 'Sign in or Create Account'}</h3>
          <p class="text-xs text-slate-500 mt-1">${options.subtitle || 'Continue with Mobile OTP or Google Account. Orders & addresses sync across Web & APK.'}</p>
        </div>

        <div id="uamPhoneSection" class="space-y-3">
          <div>
            <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">Mobile Number</label>
            <div class="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-50 focus-within:border-emerald-600">
              <span class="px-3 py-2.5 text-sm font-black text-slate-700 bg-slate-100 border-r border-slate-300">+91</span>
              <input id="uamPhoneInput" type="tel" maxlength="10" inputmode="numeric" placeholder="10-digit mobile number" class="w-full px-3 py-2.5 bg-transparent text-sm font-semibold text-slate-900 outline-none" />
            </div>
          </div>
          <div id="uamOtpGroup" class="hidden space-y-2">
            <label class="block text-[11px] font-bold text-slate-600 uppercase">Enter 6-Digit OTP</label>
            <input id="uamOtpInput" type="tel" maxlength="6" inputmode="numeric" placeholder="••••••" class="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-center tracking-[0.4em] text-base font-black text-slate-900 outline-none focus:border-emerald-600" />
            <div class="flex items-center justify-between text-[11px]">
              <button id="uamResendOtpBtn" type="button" class="text-emerald-700 font-bold hover:underline">Resend OTP</button>
              <span id="uamOtpTargetText" class="text-slate-500"></span>
            </div>
          </div>
          <p id="uamErrorMsg" class="hidden text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2"></p>
          <button id="uamSendOtpBtn" type="button" class="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm shadow-lg transition flex items-center justify-center space-x-2">
            <i class="fa-solid fa-mobile-screen-button"></i>
            <span>Continue with Mobile Number + OTP</span>
          </button>
          <button id="uamVerifyOtpBtn" type="button" class="hidden w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm shadow-lg transition flex items-center justify-center space-x-2">
            <i class="fa-solid fa-circle-check"></i>
            <span>Verify OTP & Continue</span>
          </button>
        </div>

        <div class="flex items-center my-4">
          <div class="flex-1 h-px bg-slate-200"></div>
          <span class="px-3 text-[11px] font-bold text-slate-400 uppercase">or</span>
          <div class="flex-1 h-px bg-slate-200"></div>
        </div>

        <button id="uamGoogleBtn" type="button" class="w-full py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-200 font-bold text-sm transition flex items-center justify-center space-x-2.5 shadow-sm">
          <i class="fa-brands fa-google text-emerald-700"></i>
          <span>Continue with Google Account</span>
        </button>
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
    const googleBtn = document.getElementById('uamGoogleBtn');
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
        showErr('Please enter a valid 10-digit mobile number.');
        return;
      }
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i><span>Sending OTP...</span>';
      try {
        const res = await window.startNutrolixPhoneOtp(digits, { isResend });
        if (res.mode === 'instant' && res.profile) {
          finish(res.profile);
          return;
        }
        otpGroup.classList.remove('hidden');
        document.getElementById('uamOtpTargetText').textContent = `Sent to +91 ${digits}`;
        sendBtn.classList.add('hidden');
        verifyBtn.classList.remove('hidden');
        otpInput.focus();
      } catch (e) {
        showErr(e.message || 'Unable to send OTP. Check Firebase Phone Auth setup.');
      } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fa-solid fa-mobile-screen-button"></i><span>Continue with Mobile Number + OTP</span>';
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

    googleBtn.onclick = () => {
      clearErr();
      window.startDirectGoogleAuth(googleBtn, { onSuccess: finish });
    };
  };

  // Handle redirect result on Web reload
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().getRedirectResult().then(async (result) => {
      if (result && result.user) {
        const profile = firebaseUserToProfile(result.user);
        await hydrateFromFirestore(result.user.uid);
        if (typeof window.onAuthSuccessCallback === 'function') {
          window.onAuthSuccessCallback(profile);
        }
      }
    }).catch(() => {});
  }
})();
