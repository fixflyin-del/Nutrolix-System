/**
 * Nutrolix Seamless Firebase & Native Google Sign-In Service
 * Zero manual email typing. 100% Direct Google Authentication.
 */
(function() {
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

  // Get current logged-in user profile
  window.getNutrolixUser = function() {
    try {
      const p = JSON.parse(localStorage.getItem('nutrolix_user_profile') || '{}');
      if (p && p.email && p.authProvider === 'google') {
        return p;
      }
    } catch (_) {}
    return null;
  };

  // Save authenticated user profile
  window.saveNutrolixUser = function(userData) {
    const existing = JSON.parse(localStorage.getItem('nutrolix_user_profile') || '{}');
    const updated = {
      ...existing,
      ...userData,
      authProvider: 'google',
      verified: true,
      lastLoginAt: new Date().toISOString()
    };
    localStorage.setItem('nutrolix_user_profile', JSON.stringify(updated));

    // Also sync to server
    try {
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      }).catch(() => {});
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('nutrolix:auth-changed', { detail: updated }));
    return updated;
  };

  // Main trigger: Direct Google Sign-In (ZERO manual typing)
  window.startDirectGoogleAuth = async function(btnEl) {
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.dataset.origHtml = btnEl.innerHTML;
      btnEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i><span>Connecting Google...</span>';
    }

    // 1. If running inside Android Native App with AndroidNative bridge
    if (window.AndroidNative && typeof window.AndroidNative.startGoogleSignIn === 'function') {
      try {
        window.AndroidNative.startGoogleSignIn();
        return;
      } catch (err) {
        console.warn('AndroidNative.startGoogleSignIn error, trying web fallback:', err);
      }
    }

    // 2. Browser Firebase Auth Google Sign-In
    try {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await firebase.auth().signInWithPopup(provider);
        if (result && result.user) {
          const u = result.user;
          const profile = window.saveNutrolixUser({
            name: u.displayName || u.email.split('@')[0],
            email: u.email,
            photo: u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || 'User')}&background=047857&color=fff&bold=true`,
            uid: u.uid
          });
          if (typeof window.onAuthSuccessCallback === 'function') {
            window.onAuthSuccessCallback(profile);
          }
          return;
        }
      }
    } catch (popupErr) {
      console.warn('Popup blocked or failed, trying redirect:', popupErr);
      try {
        if (typeof firebase !== 'undefined' && firebase.auth) {
          const provider = new firebase.auth.GoogleAuthProvider();
          await firebase.auth().signInWithRedirect(provider);
          return;
        }
      } catch (redirectErr) {
        console.warn('Redirect failed:', redirectErr);
      }
    } finally {
      if (btnEl && btnEl.dataset.origHtml) {
        btnEl.disabled = false;
        btnEl.innerHTML = btnEl.dataset.origHtml;
      }
    }
  };

  // Native Android callbacks
  window.onNativeGoogleSignInSuccess = function(email, name, photo, uid) {
    const profile = window.saveNutrolixUser({
      email: email,
      name: name || email.split('@')[0],
      photo: photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=047857&color=fff&bold=true`,
      uid: uid || 'android_' + Date.now()
    });

    if (typeof window.onAuthSuccessCallback === 'function') {
      window.onAuthSuccessCallback(profile);
    }
  };

  window.onNativeGoogleSignInFailure = function(errMsg) {
    alert('Google Sign-In failed: ' + errMsg);
  };

  window.onNativeGoogleSignInCancelled = function() {
    // User closed Google bottom sheet
  };

  // Sign out
  window.handleNutrolixSignOut = function() {
    try {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().signOut().catch(() => {});
      }
    } catch (_) {}

    let profile = JSON.parse(localStorage.getItem('nutrolix_user_profile') || '{}');
    profile.authProvider = null;
    localStorage.setItem('nutrolix_user_profile', JSON.stringify(profile));

    window.dispatchEvent(new CustomEvent('nutrolix:auth-changed', { detail: null }));
    if (typeof window.onAuthSignOutCallback === 'function') {
      window.onAuthSignOutCallback();
    }
  };

  // Handle redirect result if page reloaded after redirect
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().getRedirectResult().then(result => {
      if (result && result.user) {
        const u = result.user;
        const profile = window.saveNutrolixUser({
          name: u.displayName || u.email.split('@')[0],
          email: u.email,
          photo: u.photoURL,
          uid: u.uid
        });
        if (typeof window.onAuthSuccessCallback === 'function') {
          window.onAuthSuccessCallback(profile);
        }
      }
    }).catch(() => {});
  }
})();
