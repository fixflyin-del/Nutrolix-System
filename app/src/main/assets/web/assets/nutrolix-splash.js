/**
 * Nutrolix Premium Animated Splash Screen
 * Shows for ~2 seconds when website is freshly opened in the browser session.
 * Uses sessionStorage so it never interrupts internal page navigation.
 */
(function() {
  try {
    if (sessionStorage.getItem('nutrolix_splash_shown') === 'true') {
      return; // Already shown in this session
    }

    // Mark as shown immediately
    sessionStorage.setItem('nutrolix_splash_shown', 'true');

    // Create Splash Screen Element
    const splash = document.createElement('div');
    splash.id = 'nutrolixSplashScreen';
    splash.setAttribute('role', 'dialog');
    splash.setAttribute('aria-label', 'Nutrolix Launching');
    splash.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: radial-gradient(circle at center, #064e3b 0%, #022c22 65%, #011913 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      opacity: 1;
      transform: scale(1);
      pointer-events: auto;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
    `;

    splash.innerHTML = `
      <style>
        @keyframes nutroLogoPulse {
          0% { transform: scale(0.92); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
          50% { transform: scale(1.04); box-shadow: 0 0 35px 12px rgba(16, 185, 129, 0.35); }
          100% { transform: scale(0.92); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes nutroTaglineSlide {
          0% { opacity: 0; transform: translateY(12px); letter-spacing: 0.15em; }
          100% { opacity: 1; transform: translateY(0); letter-spacing: 0.28em; }
        }
        @keyframes nutroProgressBar {
          0% { width: 0%; }
          50% { width: 68%; }
          100% { width: 100%; }
        }
        @keyframes nutroGlowOrbit {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
      
      <!-- Background Ambient Glow -->
      <div style="position: absolute; width: 340px; height: 340px; border-radius: 50%; background: radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, transparent 70%); pointer-events: none;"></div>

      <div style="position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 24px; max-width: 380px; width: 100%;">
        
        <!-- Logo Emblem -->
        <div style="
          width: 96px; 
          height: 96px; 
          border-radius: 28px; 
          background: #ffffff; 
          padding: 12px; 
          box-shadow: 0 20px 45px rgba(0,0,0,0.45); 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          margin-bottom: 22px; 
          border: 2px solid rgba(110, 231, 183, 0.4);
          animation: nutroLogoPulse 2s ease-in-out infinite;
        ">
          <img src="assets/nutrolix-logo.png" alt="Nutrolix" style="width: 100%; height: 100%; object-fit: contain;">
        </div>

        <!-- Brand Name -->
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;">
          <span style="font-size: 26px; font-weight: 900; letter-spacing: 0.08em; color: #ffffff; text-transform: uppercase;">
            NUTROLIX
          </span>
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #34d399; display: inline-block; box-shadow: 0 0 12px #34d399;"></span>
        </div>

        <!-- Animated Tagline -->
        <div style="overflow: hidden; margin-bottom: 28px;">
          <p style="
            margin: 0;
            font-size: 11px; 
            font-weight: 800; 
            color: #6ee7b7; 
            text-transform: uppercase; 
            animation: nutroTaglineSlide 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          ">
            Nutrition that Works
          </p>
        </div>

        <!-- Modern Sleek Progress Bar -->
        <div style="width: 160px; height: 3px; background: rgba(255,255,255,0.12); border-radius: 999px; overflow: hidden; position: relative;">
          <div style="
            height: 100%; 
            background: linear-gradient(90deg, #10b981 0%, #34d399 50%, #f59e0b 100%); 
            border-radius: 999px; 
            animation: nutroProgressBar 1.85s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          "></div>
        </div>

        <!-- Clinical Trust Badge -->
        <div style="margin-top: 18px; font-size: 9px; font-weight: 700; color: rgba(255,255,255,0.5); letter-spacing: 0.12em; text-transform: uppercase;">
          Functional Nutrition • FSSAI Verified
        </div>

      </div>
    `;

    // Append to body as early as possible
    if (document.body) {
      document.body.appendChild(splash);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(splash);
      });
    }

    // Dismiss after approximately 2 seconds (1.95s animation + 0.6s smooth fadeout)
    setTimeout(() => {
      splash.style.opacity = '0';
      splash.style.transform = 'scale(1.03)';
      splash.style.pointerEvents = 'none';
      setTimeout(() => {
        if (splash.parentNode) {
          splash.parentNode.removeChild(splash);
        }
      }, 650);
    }, 1950);

  } catch (err) {
    console.warn('Nutrolix Splash notice:', err);
  }
})();
