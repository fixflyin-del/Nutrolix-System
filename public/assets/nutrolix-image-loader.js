/**
 * Nutrolix Sample Fallback & Catalog Image Resolver
 * Displays /assets/aistudio/image_6061bdc8.png whenever an item has no custom
 * admin-uploaded image (or if a real image fails to load). Loads uploaded
 * images directly with zero progressive delay, timers, or DOM observers.
 */
(function (global) {
  'use strict';

  var SAMPLE_REL = 'assets/aistudio/image_6061bdc8.png';
  var SAMPLE_ABS = '/assets/aistudio/image_6061bdc8.png';

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

  function fallbackOnError(img) {
    if (!img) return;
    img.onerror = null;
    var sample = getSampleUrl();
    if (img.getAttribute('src') !== sample) {
      img.src = sample;
    }
  }

  global.NUTROLIX_SAMPLE_IMAGE = getSampleUrl();
  global.nutrolixIsDefaultImage = isDefaultOrEmptyImage;
  global.nutrolixResolveCatalogImage = resolveCatalogImage;
  global.nutrolixFallbackOnError = fallbackOnError;
  global.nutrolixImmediateSrc = resolveCatalogImage;
  global.nutrolixDataSrcAttr = function () { return ''; };

  global.nutrolixBindImage = function (imgOrId, rawUrl) {
    var img = typeof imgOrId === 'string' ? document.getElementById(imgOrId) : imgOrId;
    if (!img) return;
    var resolved = resolveCatalogImage(rawUrl);
    var sample = getSampleUrl();
    img.removeAttribute('data-nutrolix-src');
    img.onerror = resolved === sample ? null : function () {
      fallbackOnError(img);
    };
    if (img.getAttribute('src') !== resolved) {
      img.src = resolved;
    }
  };
})(window);
