// Nutrolix GA4 & Google Tag Manager (GTM) Privacy-Respecting Analytics Module
// Reads Measurement ID / GTM Container ID from SSR <meta> tags or /api/seo-settings.
// Never uses hardcoded fake IDs; no-ops gracefully when unconfigured.

(function () {
  if (window.NutrolixAnalytics && window.NutrolixAnalytics.__initialized) return;

  const state = {
    ga4Id: '',
    gtmId: '',
    ga4Loaded: false,
    gtmLoaded: false,
    ready: false,
    queue: []
  };

  function isValidGa4(id) {
    return /^G-[A-Z0-9]{4,20}$/.test(String(id || '').trim().toUpperCase());
  }

  function isValidGtm(id) {
    return /^GTM-[A-Z0-9]{4,20}$/.test(String(id || '').trim().toUpperCase());
  }

  function hasAnalyticsConsent() {
    try {
      if (localStorage.getItem('nutrolix_analytics_optout') === '1') return false;
      if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return false;
    } catch (_) {}
    return true;
  }

  function readMeta(name) {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el ? String(el.getAttribute('content') || '').trim() : '';
  }

  function ensureDataLayer() {
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
    }
  }

  function loadGtm(gtmId) {
    if (!isValidGtm(gtmId) || state.gtmLoaded) return;
    if (document.querySelector(`script[src*="googletagmanager.com/gtm.js?id=${gtmId}"]`)) {
      state.gtmLoaded = true;
      return;
    }
    state.gtmLoaded = true;
    ensureDataLayer();
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
    document.head.appendChild(s);
  }

  function loadGa4(ga4Id) {
    if (!isValidGa4(ga4Id) || state.ga4Loaded) return;
    if (document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${ga4Id}"]`)) {
      state.ga4Loaded = true;
      return;
    }
    state.ga4Loaded = true;
    ensureDataLayer();
    window.gtag('js', new Date());
    // send_page_view: true fires once automatically on config; avoid duplicate manual page_view
    window.gtag('config', ga4Id, {
      anonymize_ip: true,
      send_page_view: true
    });
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`;
    document.head.appendChild(s);
  }

  function dispatchEvent(eventName, params) {
    if (!hasAnalyticsConsent()) return;
    const payload = params && typeof params === 'object' ? params : {};
    if (!state.ready) {
      state.queue.push({ eventName, payload });
      return;
    }
    if (!state.ga4Id && !state.gtmId) return;
    ensureDataLayer();
    if (state.ga4Loaded && typeof window.gtag === 'function') {
      window.gtag('event', eventName, payload);
    } else if (state.gtmLoaded) {
      window.dataLayer.push({ event: eventName, ...payload });
    }
  }

  function flushQueue() {
    while (state.queue.length > 0) {
      const next = state.queue.shift();
      dispatchEvent(next.eventName, next.payload);
    }
  }

  function activateIds(ga4Id, gtmId) {
    const cleanGa4 = isValidGa4(ga4Id) ? String(ga4Id).trim().toUpperCase() : '';
    const cleanGtm = isValidGtm(gtmId) ? String(gtmId).trim().toUpperCase() : '';
    state.ga4Id = cleanGa4;
    state.gtmId = cleanGtm;
    state.ready = true;
    if (!hasAnalyticsConsent()) return;
    if (cleanGtm) loadGtm(cleanGtm);
    if (cleanGa4) loadGa4(cleanGa4);
    flushQueue();
  }

  function init() {
    // Do not fire web analytics inside local file:// Android WebView unless configured with live host
    const metaGa4 = readMeta('nutrolix-ga4-id');
    const metaGtm = readMeta('nutrolix-gtm-id');
    if (metaGa4 || metaGtm) {
      activateIds(metaGa4, metaGtm);
      return;
    }

    // Fallback: fetch once from /api/seo-settings when served over HTTP(S) without SSR meta
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      try {
        const cached = sessionStorage.getItem('nutrolix_seo_ids_v1');
        if (cached) {
          const parsed = JSON.parse(cached);
          activateIds(parsed.ga4 || '', parsed.gtm || '');
          return;
        }
      } catch (_) {}

      const host = window.NUTROLIX_API_HOST || '';
      fetch(host + '/api/seo-settings', { cache: 'default' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const s = (data && data.seoSettings) || data || {};
          const ga4 = s.ga4MeasurementId || '';
          const gtm = s.gtmContainerId || '';
          try {
            sessionStorage.setItem('nutrolix_seo_ids_v1', JSON.stringify({ ga4, gtm }));
          } catch (_) {}
          activateIds(ga4, gtm);
        })
        .catch(() => {
          state.ready = true;
        });
    } else {
      state.ready = true;
    }
  }

  function normalizeItem(item) {
    if (!item || typeof item !== 'object') return null;
    const price = Number(item.price || item.unitPrice || 0);
    const qty = Math.max(1, Number(item.quantity || item.qty || 1));
    return {
      item_id: String(item.id || item.itemKey || item.sku || item.name || item.title || 'item'),
      item_name: String(item.name || item.title || 'Nutrolix Product'),
      item_brand: 'Nutrolix',
      item_category: String(item.category || 'Functional Nutrition'),
      item_variant: String(item.variant || item.size || ''),
      price: Number(price.toFixed(2)),
      quantity: qty
    };
  }

  const api = {
    __initialized: true,
    getConfig: function () {
      return { ga4Id: state.ga4Id, gtmId: state.gtmId, consent: hasAnalyticsConsent() };
    },
    trackPageView: function (pagePath, pageTitle) {
      dispatchEvent('page_view', {
        page_path: pagePath || window.location.pathname,
        page_title: pageTitle || document.title,
        page_location: window.location.href
      });
    },
    trackProductView: function (product) {
      const item = normalizeItem(product);
      if (!item) return;
      dispatchEvent('view_item', {
        currency: 'INR',
        value: item.price,
        items: [item]
      });
    },
    trackAddToCart: function (itemInput) {
      const item = normalizeItem(itemInput);
      if (!item) return;
      dispatchEvent('add_to_cart', {
        currency: 'INR',
        value: Number((item.price * item.quantity).toFixed(2)),
        items: [item]
      });
    },
    trackBeginCheckout: function (cartItems, totalValue, couponCode) {
      const items = Array.isArray(cartItems) ? cartItems.map(normalizeItem).filter(Boolean) : [];
      if (!items.length) return;
      const computedValue = Number(
        totalValue !== undefined
          ? totalValue
          : items.reduce((sum, i) => sum + i.price * i.quantity, 0)
      );
      dispatchEvent('begin_checkout', {
        currency: 'INR',
        value: Number(computedValue.toFixed(2)),
        coupon: couponCode || '',
        items
      });
    },
    trackPurchase: function (order) {
      if (!order || typeof order !== 'object') return;
      const txId = String(order.orderId || order.id || order.orderNumber || '').trim();
      if (!txId) return;
      // Strict deduplication per orderId so page refreshes never double-report revenue
      const dedupeKey = `nutrolix_ga_purchase_${txId}`;
      try {
        if (sessionStorage.getItem(dedupeKey) === '1') return;
        sessionStorage.setItem(dedupeKey, '1');
      } catch (_) {}

      const items = Array.isArray(order.items) ? order.items.map(normalizeItem).filter(Boolean) : [];
      const value = Number(order.grandTotal || order.total || order.amount || 0);
      const shipping = Number(order.deliveryFee || order.shippingFee || 0);
      dispatchEvent('purchase', {
        transaction_id: txId,
        currency: 'INR',
        value: Number(value.toFixed(2)),
        shipping: Number(shipping.toFixed(2)),
        coupon: String(order.couponCode || order.coupon || ''),
        items
      });
    },
    trackWhatsAppClick: function (label, href) {
      dispatchEvent('whatsapp_click', {
        event_category: 'engagement',
        event_label: String(label || 'WhatsApp Support'),
        link_url: String(href || '')
      });
    },
    trackContactClick: function (channel, label) {
      dispatchEvent('generate_lead', {
        event_category: 'contact',
        method: String(channel || 'form'),
        event_label: String(label || '')
      });
    }
  };

  window.NutrolixAnalytics = api;

  // Auto-delegate WhatsApp, phone, and email link clicks
  document.addEventListener('click', function (ev) {
    const anchor = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!anchor) return;
    const href = String(anchor.getAttribute('href') || '');
    if (/wa\.me|api\.whatsapp\.com/i.test(href)) {
      api.trackWhatsAppClick(anchor.textContent.trim().slice(0, 60) || 'WhatsApp', href);
    } else if (/^tel:/i.test(href)) {
      api.trackContactClick('phone', href);
    } else if (/^mailto:/i.test(href)) {
      api.trackContactClick('email', href);
    }
  }, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
