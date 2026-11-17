/**
 * Nutrolix Progressive & Sample Fallback Image Controller
 * 1. Displays the Nutrolix sample artwork (/assets/aistudio/image_6061bdc8.png)
 *    for all un-uploaded / default products, healthy meals, hero cards, and blogs.
 * 2. On every fresh website/app open (NOT on reload), guarantees the sample image
 *    remains visible for at least 1000ms (1 second) or until the real admin-uploaded
 *    image finishes downloading — whichever is longer — then swaps smoothly.
 * 3. On reload or subsequent pages in the same session, displays the sample image
 *    only while a real uploaded image is still loading or if it fails to load.
 */
(function (global) {
  'use strict';

  var SAMPLE_REL = 'assets/aistudio/image_6061bdc8.png';
  var SAMPLE_ABS = '/assets/aistudio/image_6061bdc8.png';
  var SESSION_DONE_KEY = 'nutrolix_first_open_img_done';

  function getSampleUrl() {
    try {
      if (global.location && global.location.protocol === 'file:') return SAMPLE_REL;
    } catch (_) {}
    return SAMPLE_ABS;
  }

  function isDefaultOrEmptyImage(url) {
    if (!url || typeof url !== 'string') return true;
    var s = url.trim().toLowerCase();
    if (!s || s === 'null' || s === 'undefined' || s === 'about:blank') return true;
    if (s.indexOf('image_6061bdc8.png') !== -1) return true;
    if (s.indexOf('images.unsplash.com/') !== -1) return true;
    if (s.indexOf('nutrolix_logo') !== -1 || s.indexOf('nutrolix-logo') !== -1) return true;
    if (s.indexOf('nutrolix_lab_facility.jpg') !== -1) return true;
    return false;
  }

  function resolveCatalogImage(url) {
    if (isDefaultOrEmptyImage(url)) return getSampleUrl();
    var clean = String(url).trim();
    try {
      if (global.location && global.location.protocol === 'file:') {
        var host = global.NUTROLIX_API_HOST || 'https://nutrolixweb.vercel.app';
        if (clean.indexOf('/api/media/') === 0 || clean.indexOf('/uploads/') === 0) {
          return host + clean;
        }
        if (clean.indexOf('/assets/') === 0) {
          return clean.slice(1);
        }
      }
    } catch (_) {}
    return clean;
  }

  function isPageReload() {
    try {
      if (global.performance && typeof global.performance.getEntriesByType === 'function') {
        var entries = global.performance.getEntriesByType('navigation');
        if (entries && entries.length && entries[0].type === 'reload') return true;
      }
      if (global.performance && global.performance.navigation && global.performance.navigation.type === 1) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  var isAdminPage = false;
  try {
    isAdminPage = /\/admin(\.html)?$/i.test((global.location && global.location.pathname) || '');
  } catch (_) {}

  var sessionAlreadyOpened = false;
  try {
    sessionAlreadyOpened = global.sessionStorage && global.sessionStorage.getItem(SESSION_DONE_KEY) === 'true';
  } catch (_) {}

  var requiresFirstOpenHold = !isAdminPage && !isPageReload() && !sessionAlreadyOpened;
  var gateOpen = !requiresFirstOpenHold;
  var holdTimerStarted = false;

  // Map of resolved URL -> 'loading' | 'loaded' | 'error'
  var imageStatus = {};
  var pendingCallbacks = {};
  var gateWaiters = [];

  function flushGateWaiters() {
    gateOpen = true;
    try {
      if (!isPageReload() && !isAdminPage && global.sessionStorage) {
        global.sessionStorage.setItem(SESSION_DONE_KEY, 'true');
      }
    } catch (_) {}
    var list = gateWaiters.splice(0, gateWaiters.length);
    for (var i = 0; i < list.length; i++) {
      try { list[i](); } catch (_) {}
    }
  }

  function startOneSecondHoldAfterSplash() {
    if (gateOpen || holdTimerStarted) return;
    holdTimerStarted = true;

    var startedWindow = false;
    function beginCountdown() {
      if (startedWindow) return;
      startedWindow = true;
      setTimeout(flushGateWaiters, 1000);
    }

    function checkSplash() {
      if (startedWindow) return;
      var splash = document.getElementById('nutrolixSplashScreen');
      if (!splash) {
        beginCountdown();
        return;
      }
      var style = splash.style || {};
      var opacityZero = style.opacity === '0' || style.visibility === 'hidden';
      if (opacityZero) {
        beginCountdown();
        return;
      }
      setTimeout(checkSplash, 80);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(checkSplash, 50);
      }, { once: true });
    } else {
      setTimeout(checkSplash, 50);
    }
    // Hard safety cap so slow networks/splash issues never trap real images forever
    setTimeout(beginCountdown, 3200);
  }

  if (requiresFirstOpenHold) {
    startOneSecondHoldAfterSplash();
  }

  function preloadRealImage(resolvedUrl, cb) {
    if (!resolvedUrl || isDefaultOrEmptyImage(resolvedUrl)) {
      if (cb) cb(false);
      return;
    }
    var status = imageStatus[resolvedUrl];
    if (status === 'loaded') {
      if (cb) cb(true);
      return;
    }
    if (status === 'error') {
      if (cb) cb(false);
      return;
    }
    if (!pendingCallbacks[resolvedUrl]) pendingCallbacks[resolvedUrl] = [];
    if (cb) pendingCallbacks[resolvedUrl].push(cb);

    if (status === 'loading') return;
    imageStatus[resolvedUrl] = 'loading';

    var probe = new Image();
    probe.onload = function () {
      var ok = probe.naturalWidth > 0;
      imageStatus[resolvedUrl] = ok ? 'loaded' : 'error';
      var cbs = pendingCallbacks[resolvedUrl] || [];
      delete pendingCallbacks[resolvedUrl];
      for (var i = 0; i < cbs.length; i++) {
        try { cbs[i](ok); } catch (_) {}
      }
    };
    probe.onerror = function () {
      imageStatus[resolvedUrl] = 'error';
      var cbs = pendingCallbacks[resolvedUrl] || [];
      delete pendingCallbacks[resolvedUrl];
      for (var i = 0; i < cbs.length; i++) {
        try { cbs[i](false); } catch (_) {}
      }
    };
    probe.src = resolvedUrl;
  }

  function setImgSrcSafe(img, url) {
    if (!img) return;
    img.setAttribute('data-nutrolix-lock', '1');
    try {
      if (img.getAttribute('src') !== url) {
        img.src = url;
      }
    } finally {
      img.removeAttribute('data-nutrolix-lock');
    }
  }

  function shouldIgnoreImage(img) {
    if (!img || img.tagName !== 'IMG') return true;
    if (img.getAttribute('data-nutrolix-ignore') === 'true') return true;
    if (img.classList && (img.classList.contains('nutrolix-no-sample') || img.classList.contains('nutro-facility-img'))) return true;
    if (img.closest && img.closest('header, footer, nav, #leftBurgerDrawer, #nutrolixSplashScreen, #mobileBottomNav')) return true;
    var attrSrc = (img.getAttribute('src') || '').toLowerCase();
    var targetSrc = (img.getAttribute('data-nutrolix-src') || '').toLowerCase();
    if (!targetSrc && (attrSrc.indexOf('nutrolix-logo') !== -1 || attrSrc.indexOf('nutrolix_logo') !== -1 || attrSrc.indexOf('ui-avatars.com') !== -1)) {
      return true;
    }
    return false;
  }

  var MANAGED_CONTAINER_SELECTOR = [
    '#featuredProductsContainer',
    '#bestSellersContainer',
    '#shopProductsGrid',
    '#foodMenuGrid',
    '#blogsContainer',
    '#blogsGrid',
    '#relatedArticlesGrid',
    '#mainImageContainer',
    '#imageThumbnails',
    '#cartItemsList',
    '#cartDrawerItems',
    '#wishlistDrawerItems',
    '#searchResults',
    '#foodSearchResults',
    '#ordersList',
    '#detailItemsContainer'
  ].join(',');

  var MANAGED_ID_MAP = {
    heroCard1Img: true,
    heroCard2Img: true,
    heroShowcaseImg: true,
    mainProductImage: true,
    modalDishImage: true,
    modalImage: true,
    articleFeaturedImg: true
  };

  function isManagedImage(img) {
    if (shouldIgnoreImage(img)) return false;
    if (img.hasAttribute('data-nutrolix-src')) return true;
    if (img.id && MANAGED_ID_MAP[img.id]) return true;
    if (img.closest && img.closest(MANAGED_CONTAINER_SELECTOR)) return true;
    return false;
  }

  function applySampleOnError(img) {
    if (!img || img.getAttribute('data-nutrolix-err-bound') === '1') return;
    img.setAttribute('data-nutrolix-err-bound', '1');
    img.addEventListener('error', function () {
      var sample = getSampleUrl();
      if (img.getAttribute('src') !== sample) {
        setImgSrcSafe(img, sample);
      }
    });
  }

  function processManagedImage(img) {
    if (!isManagedImage(img)) return;
    applySampleOnError(img);

    var sample = getSampleUrl();
    var explicitTarget = img.getAttribute('data-nutrolix-src');
    var currentAttr = img.getAttribute('src') || '';
    var candidate = explicitTarget || currentAttr;
    var resolved = resolveCatalogImage(candidate);

    if (resolved === sample || isDefaultOrEmptyImage(resolved)) {
      img.removeAttribute('data-nutrolix-src');
      setImgSrcSafe(img, sample);
      return;
    }

    img.setAttribute('data-nutrolix-src', resolved);

    if (gateOpen && imageStatus[resolved] === 'loaded') {
      setImgSrcSafe(img, resolved);
      return;
    }

    // Show sample artwork until both 1s fresh-open gate & real image download finish
    setImgSrcSafe(img, sample);

    var attemptReveal = function () {
      if (!img.isConnected && !document.contains(img)) return;
      if (img.getAttribute('data-nutrolix-src') !== resolved) return;
      if (!gateOpen) {
        gateWaiters.push(attemptReveal);
        return;
      }
      if (imageStatus[resolved] === 'loaded') {
        setImgSrcSafe(img, resolved);
      } else if (imageStatus[resolved] === 'error') {
        setImgSrcSafe(img, sample);
      }
    };

    preloadRealImage(resolved, function (ok) {
      if (ok) attemptReveal();
      else if (img.getAttribute('data-nutrolix-src') === resolved) {
        setImgSrcSafe(img, sample);
      }
    });
  }

  function scanTree(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.tagName === 'IMG') {
      processManagedImage(root);
      return;
    }
    var imgs = root.querySelectorAll ? root.querySelectorAll('img') : [];
    for (var i = 0; i < imgs.length; i++) {
      processManagedImage(imgs[i]);
    }
  }

  // Public helpers for templates and JS updaters
  global.NUTROLIX_SAMPLE_IMAGE = getSampleUrl();
  global.nutrolixIsDefaultImage = isDefaultOrEmptyImage;
  global.nutrolixResolveCatalogImage = resolveCatalogImage;

  global.nutrolixImmediateSrc = function (rawUrl) {
    var sample = getSampleUrl();
    var resolved = resolveCatalogImage(rawUrl);
    if (resolved === sample) return sample;
    if (gateOpen && imageStatus[resolved] === 'loaded') return resolved;
    preloadRealImage(resolved);
    return sample;
  };

  global.nutrolixDataSrcAttr = function (rawUrl) {
    var resolved = resolveCatalogImage(rawUrl);
    if (resolved === getSampleUrl()) return '';
    return resolved.replace(/"/g, '&quot;');
  };

  global.nutrolixBindImage = function (imgOrId, rawUrl) {
    var img = typeof imgOrId === 'string' ? document.getElementById(imgOrId) : imgOrId;
    if (!img) return;
    var resolved = resolveCatalogImage(rawUrl);
    if (resolved === getSampleUrl()) {
      img.removeAttribute('data-nutrolix-src');
      setImgSrcSafe(img, getSampleUrl());
    } else {
      img.setAttribute('data-nutrolix-src', resolved);
      processManagedImage(img);
    }
  };

  // Start observing as early as possible so even static <img> elements get progressive sample protection
  try {
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'childList' && m.addedNodes) {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            if (n && n.nodeType === 1) scanTree(n);
          }
        } else if (m.type === 'attributes' && m.target && m.target.tagName === 'IMG') {
          if (m.target.getAttribute('data-nutrolix-lock') === '1') continue;
          if (m.attributeName === 'src') {
            var newSrc = m.target.getAttribute('src') || '';
            var sample = getSampleUrl();
            if (newSrc && newSrc !== sample && isManagedImage(m.target)) {
              var resolvedNew = resolveCatalogImage(newSrc);
              if (resolvedNew !== m.target.getAttribute('data-nutrolix-src')) {
                if (resolvedNew === sample) {
                  m.target.removeAttribute('data-nutrolix-src');
                  setImgSrcSafe(m.target, sample);
                } else if (!gateOpen || imageStatus[resolvedNew] !== 'loaded') {
                  m.target.setAttribute('data-nutrolix-src', resolvedNew);
                  processManagedImage(m.target);
                }
              }
            }
          } else if (m.attributeName === 'data-nutrolix-src') {
            processManagedImage(m.target);
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'data-nutrolix-src']
    });
  } catch (_) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      scanTree(document.body);
    });
  } else if (document.body) {
    scanTree(document.body);
  }
})(window);
