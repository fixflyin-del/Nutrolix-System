/**
 * Nutrolix White Nutrition Splash
 * Full-screen branded intro; reuses the approved official logo asset.
 */
(function () {
  try {
    if (sessionStorage.getItem('nutrolix_splash_shown') === 'true') return;
    sessionStorage.setItem('nutrolix_splash_shown', 'true');

    const splash = document.createElement('div');
    splash.id = 'nutrolixSplashScreen';
    splash.setAttribute('role', 'status');
    splash.setAttribute('aria-label', 'Nutrolix — Nutrition that works');
    splash.innerHTML = '<style>' +
      '#nutrolixSplashScreen{position:fixed;inset:0;z-index:999999;display:grid;place-items:center;overflow:hidden;background:#fff;color:#102b22;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;opacity:1;transition:opacity .65s ease,visibility .65s ease;-webkit-font-smoothing:antialiased}' +
      '#nutrolixSplashScreen *{box-sizing:border-box}' +
      '#nutrolixSplashScreen .ns-glow{position:absolute;width:min(78vw,620px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(29,185,129,.11),transparent 68%);z-index:0}' +
      '#nutrolixSplashScreen .ns-stage{position:relative;z-index:1;width:min(100%,760px);height:min(100dvh,900px);min-height:540px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 18px 52px;text-align:center}' +
      '#nutrolixSplashScreen .ns-orbit{position:absolute;width:min(78vw,480px);aspect-ratio:1;border:1px dashed rgba(0,133,91,.18);border-radius:50%;animation:nsOrbit 26s linear infinite;pointer-events:none}' +
      '#nutrolixSplashScreen .ns-orbit:before,#nutrolixSplashScreen .ns-orbit:after{content:"";position:absolute;width:9px;height:9px;border-radius:50%;background:#f59e0b;box-shadow:0 0 0 6px rgba(245,158,11,.10)}' +
      '#nutrolixSplashScreen .ns-orbit:before{top:13%;left:17%}#nutrolixSplashScreen .ns-orbit:after{bottom:12%;right:16%;width:6px;height:6px;background:#07966a}' +
      '#nutrolixSplashScreen .ns-food{position:absolute;z-index:1;display:grid;place-items:center;width:clamp(58px,14vw,88px);aspect-ratio:1;border-radius:25px;background:rgba(255,255,255,.96);border:1px solid #e4f2eb;box-shadow:0 12px 34px rgba(13,86,58,.10);font-size:clamp(27px,6vw,42px);animation:nsFloat 4s ease-in-out infinite}' +
      '#nutrolixSplashScreen .ns-food small{position:absolute;bottom:-19px;font-size:8px;letter-spacing:.13em;font-weight:800;color:#82958b;text-transform:uppercase;white-space:nowrap}' +
      '#nutrolixSplashScreen .ns-f1{top:13%;left:9%;animation-delay:-.5s}#nutrolixSplashScreen .ns-f2{top:10%;right:10%;animation-delay:-1.6s}#nutrolixSplashScreen .ns-f3{top:43%;left:2%;animation-delay:-2.2s}#nutrolixSplashScreen .ns-f4{top:45%;right:2%;animation-delay:-1s}#nutrolixSplashScreen .ns-f5{bottom:15%;left:13%;animation-delay:-2.8s}#nutrolixSplashScreen .ns-f6{bottom:13%;right:13%;animation-delay:-1.3s}' +
      '#nutrolixSplashScreen .ns-center{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;animation:nsEnter .9s cubic-bezier(.2,.8,.2,1) both}' +
      '#nutrolixSplashScreen .ns-logo-wrap{width:clamp(190px,54vw,310px);min-height:100px;display:grid;place-items:center;position:relative;margin-bottom:18px}' +
      '#nutrolixSplashScreen .ns-logo-ring{position:absolute;inset:0;border-radius:34px;border:1px solid rgba(0,143,95,.18);transform:rotate(-5deg);animation:nsRing 5s ease-in-out infinite}' +
      '#nutrolixSplashScreen .ns-logo{position:relative;display:block;width:100%;max-height:112px;object-fit:contain;filter:drop-shadow(0 9px 14px rgba(0,70,46,.10));animation:nsLogo 2.8s ease-in-out infinite}' +
      '#nutrolixSplashScreen .ns-tagline{margin:0;color:#07865f;font-size:clamp(12px,3.2vw,16px);font-weight:850;letter-spacing:.28em;text-transform:uppercase;animation:nsTag .9s .35s both}' +
      '#nutrolixSplashScreen .ns-rule{width:90px;height:3px;margin-top:19px;border-radius:20px;background:linear-gradient(90deg,#07865f,#f39b22);transform-origin:left;animation:nsRule 1.5s .5s ease both}' +
      '#nutrolixSplashScreen .ns-dots{display:flex;gap:7px;margin-top:24px}#nutrolixSplashScreen .ns-dots i{width:6px;height:6px;border-radius:50%;background:#0b9369;opacity:.25;animation:nsDot 1s ease-in-out infinite}#nutrolixSplashScreen .ns-dots i:nth-child(2){animation-delay:.16s}#nutrolixSplashScreen .ns-dots i:nth-child(3){animation-delay:.32s}' +
      '#nutrolixSplashScreen .ns-bottom{position:absolute;bottom:24px;color:#91a59b;font-size:9px;font-weight:800;letter-spacing:.2em;text-transform:uppercase}' +
      '#nutrolixSplashScreen .ns-arrow{position:absolute;z-index:1;width:42px;height:42px;color:#f0a02a;opacity:.75;animation:nsArrow 2.8s ease-in-out infinite}#nutrolixSplashScreen .ns-a1{top:28%;left:25%}#nutrolixSplashScreen .ns-a2{bottom:27%;right:25%;animation-delay:-1.4s}' +
      '@keyframes nsOrbit{to{transform:rotate(360deg)}}@keyframes nsFloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-10px) rotate(3deg)}}@keyframes nsEnter{from{opacity:0;transform:translateY(18px) scale(.94)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes nsLogo{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}@keyframes nsRing{0%,100%{transform:rotate(-5deg) scale(1)}50%{transform:rotate(4deg) scale(1.04)}}@keyframes nsTag{from{opacity:0;letter-spacing:.55em;transform:translateY(9px)}to{opacity:1;letter-spacing:.28em;transform:translateY(0)}}@keyframes nsRule{from{transform:scaleX(0);opacity:0}to{transform:scaleX(1);opacity:1}}@keyframes nsDot{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-4px)}}@keyframes nsArrow{0%,100%{opacity:.35;translate:0 0}50%{opacity:.9;translate:7px -5px}}' +
      '@media(max-width:430px){#nutrolixSplashScreen .ns-stage{min-height:500px}#nutrolixSplashScreen .ns-f1{top:14%;left:5%}#nutrolixSplashScreen .ns-f2{top:13%;right:5%}#nutrolixSplashScreen .ns-f3{top:42%;left:-3%}#nutrolixSplashScreen .ns-f4{top:42%;right:-3%}#nutrolixSplashScreen .ns-f5{bottom:15%;left:6%}#nutrolixSplashScreen .ns-f6{bottom:14%;right:6%}#nutrolixSplashScreen .ns-a1{left:19%}#nutrolixSplashScreen .ns-a2{right:19%}}' +
      '@media(prefers-reduced-motion:reduce){#nutrolixSplashScreen *,#nutrolixSplashScreen *:before,#nutrolixSplashScreen *:after{animation-duration:.01ms!important;animation-iteration-count:1!important}}' +
      '</style>' +
      '<div class="ns-glow"></div><div class="ns-stage">' +
      '<div class="ns-orbit"></div>' +
      '<div class="ns-food ns-f1" aria-hidden="true">🥜<small>Protein</small></div>' +
      '<div class="ns-food ns-f2" aria-hidden="true">🫐<small>Antioxidants</small></div>' +
      '<div class="ns-food ns-f3" aria-hidden="true">🌾<small>Whole grains</small></div>' +
      '<div class="ns-food ns-f4" aria-hidden="true">🥦<small>Greens</small></div>' +
      '<div class="ns-food ns-f5" aria-hidden="true">🍓<small>Fresh foods</small></div>' +
      '<div class="ns-food ns-f6" aria-hidden="true">🌰<small>Healthy snacks</small></div>' +
      '<svg class="ns-arrow ns-a1" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M7 28C12 12 29 8 39 18M39 18L27 17M39 18L37 30" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="29" r="2.5" fill="#07865f"/></svg>' +
      '<svg class="ns-arrow ns-a2" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M7 28C12 12 29 8 39 18M39 18L27 17M39 18L37 30" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="29" r="2.5" fill="#07865f"/></svg>' +
      '<div class="ns-center"><div class="ns-logo-wrap"><div class="ns-logo-ring"></div><img class="ns-logo" src="assets/nutrolix-logo.png" alt="Nutrolix"></div>' +
      '<p class="ns-tagline">Nutrition that works</p><div class="ns-rule"></div><div class="ns-dots" aria-hidden="true"><i></i><i></i><i></i></div></div>' +
      '<div class="ns-bottom">Everyday goodness · Thoughtful nutrition</div></div>';

    const mount = () => {
      if (document.body && !document.getElementById('nutrolixSplashScreen')) document.body.appendChild(splash);
    };
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount, { once: true });

    const dismiss = () => {
      splash.style.opacity = '0';
      splash.style.visibility = 'hidden';
      splash.style.pointerEvents = 'none';
      setTimeout(() => splash.remove(), 700);
    };
    window.addEventListener('load', () => setTimeout(dismiss, 1900), { once: true });
    setTimeout(dismiss, 4200);
  } catch (err) {
    console.warn('Nutrolix Splash notice:', err);
  }
})();
