// Nutrolix Centralized Review Service
// Handles automatic single-time popup for delivered orders & permanent verified review submissions

(function() {
  if (typeof window.NUTROLIX_API_HOST === 'undefined') {
    window.NUTROLIX_API_HOST = (window.location && (window.location.protocol === 'file:' || window.location.hostname === 'nutrolixweb.vercel.app'))
      ? 'https://nutrolix.in'
      : '';
  }

  const PRESET_SUGGESTIONS = {
    5: "The quality and taste exceeded expectations! Clean ingredients, great packaging, and timely delivery.",
    4: "Very good healthy food, fresh packaging and timely delivery. Good macros and clean ingredients.",
    3: "Decent product and clean nutrition profile. Taste is earthy and mild.",
    2: "Delivery took longer than expected, though the nutrition formulation is authentic.",
    1: "Had issues with packaging condition upon delivery."
  };

  let activeReviewOrder = null;
  let activeExistingReview = null;
  let activeStarRating = 5;
  let checkInFlight = false;
  let modalOpenNow = false;
  const cachedReviewsByOrderId = new Map();

  function getApiHost() {
    return window.NUTROLIX_API_HOST || '';
  }

  function clean10Phone(p) {
    return p ? String(p).replace(/\D/g, '').slice(-10) : '';
  }

  function isDeliveredOrderStatus(rawStatus) {
    const st = String(rawStatus || '').toLowerCase().trim();
    if (!st) return false;
    if (st.includes('out for delivery') || st.includes('out_for_delivery') || st.includes('cancel') || st.includes('reject')) {
      return false;
    }
    return st.includes('deliver') || st.includes('complet');
  }

  function getReviewedOrderIds() {
    try {
      const list = JSON.parse(localStorage.getItem('nutrolix_reviewed_orders') || '[]');
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function ingestServerReviews(list) {
    if (!Array.isArray(list)) return;
    const reviewed = getReviewedOrderIds();
    let reviewedChanged = false;
    list.forEach((rev) => {
      if (!rev || typeof rev !== 'object') return;
      const oid = String(rev.orderId || '').trim();
      if (oid) {
        cachedReviewsByOrderId.set(oid, rev);
        if (!reviewed.includes(oid)) {
          reviewed.push(oid);
          reviewedChanged = true;
        }
      }
    });
    if (reviewedChanged) {
      try {
        localStorage.setItem('nutrolix_reviewed_orders', JSON.stringify(reviewed));
      } catch (_) {}
    }
  }

  function getStoredReviewForOrder(orderId) {
    const oid = String(orderId || '').trim();
    if (!oid) return null;
    if (cachedReviewsByOrderId.has(oid)) return cachedReviewsByOrderId.get(oid);
    try {
      const saved = JSON.parse(localStorage.getItem('nutrolix_product_reviews') || '[]');
      if (Array.isArray(saved)) {
        const found = saved.find((r) => r && String(r.orderId || '').trim() === oid);
        if (found) {
          cachedReviewsByOrderId.set(oid, found);
          return found;
        }
      }
    } catch (_) {}
    return null;
  }

  async function syncOrderReviewsFromServer() {
    try {
      const res = await fetch(getApiHost() + '/api/product-reviews', { cache: 'no-store' });
      if (res.ok) {
        const revs = await res.json();
        if (Array.isArray(revs)) {
          ingestServerReviews(revs);
          return revs;
        }
      }
    } catch (_) {}
    return [];
  }

  async function fetchReviewForOrder(orderId) {
    const oid = String(orderId || '').trim();
    if (!oid) return null;
    const cached = getStoredReviewForOrder(oid);
    try {
      const res = await fetch(getApiHost() + '/api/product-reviews?orderId=' + encodeURIComponent(oid), { cache: 'no-store' });
      if (res.ok) {
        const revs = await res.json();
        if (Array.isArray(revs) && revs.length > 0) {
          ingestServerReviews(revs);
          return revs[0];
        }
      }
    } catch (_) {}
    return cached;
  }

  function hasReviewForOrder(orderId) {
    const oid = String(orderId || '').trim();
    if (!oid) return false;
    if (getStoredReviewForOrder(oid)) return true;
    return getReviewedOrderIds().includes(oid);
  }

  function markOrderAsReviewed(orderId) {
    if (!orderId) return;
    try {
      const reviewed = getReviewedOrderIds();
      if (!reviewed.includes(orderId)) {
        reviewed.push(orderId);
        localStorage.setItem('nutrolix_reviewed_orders', JSON.stringify(reviewed));
      }
      localStorage.setItem('nutrolix_review_shown_' + orderId, 'true');
    } catch (_) {}

    try {
      fetch(getApiHost() + '/api/reviews/mark-reviewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderId })
      }).catch(() => {});
    } catch (_) {}
  }

  function isOrderDismissedOrShown(orderId, remoteState) {
    if (!orderId) return true;
    try {
      if (localStorage.getItem('nutrolix_review_dismissed_' + orderId) === 'true') return true;
      if (sessionStorage.getItem('nutrolix_review_dismissed_' + orderId) === 'true') return true;
      if (localStorage.getItem('nutrolix_review_shown_' + orderId) === 'true') return true;
    } catch (_) {}
    if (remoteState) {
      if (Array.isArray(remoteState.dismissed) && remoteState.dismissed.includes(orderId)) return true;
      if (Array.isArray(remoteState.reviewed) && remoteState.reviewed.includes(orderId)) return true;
    }
    return false;
  }

  function markOrderAsDismissed(orderId) {
    if (!orderId) return;
    try {
      localStorage.setItem('nutrolix_review_dismissed_' + orderId, 'true');
      sessionStorage.setItem('nutrolix_review_dismissed_' + orderId, 'true');
      localStorage.setItem('nutrolix_review_shown_' + orderId, 'true');
    } catch (_) {}

    try {
      fetch(getApiHost() + '/api/reviews/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderId })
      }).catch(() => {});
    } catch (_) {}
  }

  function orderBelongsToUser(ord, user) {
    if (!ord || !user) return false;
    if (user.uid && ord.uid && ord.uid === user.uid) return true;
    const uPhone = clean10Phone(user.verifiedPhone || user.phone || user.whatsappNumber || '');
    const oPhone = clean10Phone(
      (ord.customer && ord.customer.phone) || ord.customerPhone || ord.verifiedPhone || ord.phone || ''
    );
    if (uPhone && oPhone && uPhone === oPhone) return true;

    const uEmail = String(user.email || '').toLowerCase().trim();
    const oEmail = String(
      (ord.customer && ord.customer.email) || ord.customerEmail || ord.email || ''
    ).toLowerCase().trim();
    if (uEmail && oEmail && uEmail === oEmail) return true;

    return !oPhone && !oEmail && !ord.uid;
  }

  async function fetchRemoteReviewState() {
    try {
      const res = await fetch(getApiHost() + '/api/reviews/state', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') return data;
      }
    } catch (_) {}
    return { dismissed: [], reviewed: [] };
  }

  async function collectUserOrders(user) {
    const orderMap = new Map();
    const upsert = (ord) => {
      if (!ord || typeof ord !== 'object') return;
      const oid = String(ord.id || ord.orderId || '').trim();
      if (!oid) return;
      const prev = orderMap.get(oid) || {};
      orderMap.set(oid, { ...prev, ...ord, id: oid, orderId: oid });
    };

    ['nutrolix_customer_orders', 'nutrolix_orders', 'nutrolix_store_orders', 'nutrolix_food_orders'].forEach((key) => {
      try {
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(arr)) arr.forEach(upsert);
      } catch (_) {}
    });

    try {
      const qs = new URLSearchParams();
      if (user.uid) qs.set('uid', user.uid);
      const uPhone = clean10Phone(user.verifiedPhone || user.phone || user.whatsappNumber || '');
      if (uPhone) qs.set('phone', uPhone);
      if (user.email) qs.set('email', user.email);
      const res = await fetch(getApiHost() + '/api/nutrition-orders?' + qs.toString(), { cache: 'no-store' });
      if (res.ok) {
        const serverOrders = await res.json();
        if (Array.isArray(serverOrders)) serverOrders.forEach(upsert);
      }
    } catch (_) {}

    return Array.from(orderMap.values()).filter((ord) => orderBelongsToUser(ord, user));
  }

  async function findPendingDeliveredOrder() {
    const user = (typeof window.getNutrolixUser === 'function') ? window.getNutrolixUser() : null;
    if (!user || (!user.uid && !user.email && !user.phone && !user.verifiedPhone)) {
      return null;
    }

    const [userOrders, remoteState] = await Promise.all([
      collectUserOrders(user),
      fetchRemoteReviewState(),
      syncOrderReviewsFromServer()
    ]);

    if (!userOrders || userOrders.length === 0) {
      return null;
    }

    const reviewed = getReviewedOrderIds();

    userOrders.sort((a, b) => {
      const timeA = Number(a.timestamp || a.orderTimeMillis || Date.parse(a.createdAt || a.date || 0) || 0);
      const timeB = Number(b.timestamp || b.orderTimeMillis || Date.parse(b.createdAt || b.date || 0) || 0);
      return timeB - timeA;
    });

    for (const ord of userOrders) {
      const oid = ord.id || ord.orderId;
      if (!oid) continue;
      if (!isDeliveredOrderStatus(ord.status)) continue;
      if (reviewed.includes(oid) || hasReviewForOrder(oid)) continue;
      if (isOrderDismissedOrShown(oid, remoteState)) continue;
      return ord;
    }

    return null;
  }

  function ensureModalInDOM() {
    if (document.getElementById('nutrolixReviewModalBackdrop')) return;

    const modalHtml = `
      <div id="nutrolixReviewModalBackdrop" class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm hidden flex items-center justify-center p-4 transition-opacity duration-300">
        <div id="nutrolixReviewModalCard" class="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 transform scale-95 transition-transform duration-300">
          
          <div class="flex items-start justify-between">
            <div class="space-y-1">
              <span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                <i class="fa-solid fa-circle-check text-emerald-600"></i>
                <span>Order Delivered • Verified Purchase</span>
              </span>
              <h3 class="text-lg font-black text-slate-900 tracking-tight" id="reviewModalTitle">How was your Nutrolix order?</h3>
            </div>
            <button onclick="window.NutrolixReviews.dismissReviewModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center text-sm transition" title="Dismiss">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="flex items-center space-x-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <img id="reviewProductImg" src="assets/nutrolix-logo.png" alt="Product" class="w-14 h-14 rounded-xl object-contain bg-white border border-slate-200 p-1 shrink-0">
            <div class="min-w-0">
              <div class="font-black text-xs text-slate-900 truncate" id="reviewProductName">Nutrolix Nutrition Item</div>
              <div class="text-[11px] text-slate-500 font-bold" id="reviewProductVariant">Verified Functional Nutrition</div>
              <div class="text-[10px] text-emerald-700 font-extrabold mt-0.5" id="reviewOrderIdTag">Order #NTX-000000</div>
            </div>
          </div>

          <div class="text-center space-y-1.5">
            <div class="text-xs font-bold text-slate-700">Tap to rate your experience:</div>
            <div class="flex items-center justify-center space-x-2 text-2xl text-slate-200 cursor-pointer" id="reviewStarsContainer">
              <i class="fa-solid fa-star transition hover:scale-110 active:scale-95 text-amber-400" data-star="1" onclick="window.NutrolixReviews.setRating(1)"></i>
              <i class="fa-solid fa-star transition hover:scale-110 active:scale-95 text-amber-400" data-star="2" onclick="window.NutrolixReviews.setRating(2)"></i>
              <i class="fa-solid fa-star transition hover:scale-110 active:scale-95 text-amber-400" data-star="3" onclick="window.NutrolixReviews.setRating(3)"></i>
              <i class="fa-solid fa-star transition hover:scale-110 active:scale-95 text-amber-400" data-star="4" onclick="window.NutrolixReviews.setRating(4)"></i>
              <i class="fa-solid fa-star transition hover:scale-110 active:scale-95 text-amber-400" data-star="5" onclick="window.NutrolixReviews.setRating(5)"></i>
            </div>
            <div class="text-[11px] font-black text-amber-600" id="reviewStarLabel">5.0 / 5.0 • Exceptional Quality</div>
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <label class="font-bold text-slate-700">Your Review</label>
              <button type="button" onclick="window.NutrolixReviews.applySuggestion()" class="text-[10px] font-bold text-emerald-700 hover:underline">
                Use suggestion ✨
              </button>
            </div>
            <textarea id="reviewFeedbackText" rows="3" placeholder="Share your honest thoughts about taste, packaging & freshness..." class="w-full p-3 rounded-2xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium leading-relaxed"></textarea>
            <p class="text-[10px] text-slate-400">Your review will be permanently saved and published on product pages.</p>
          </div>

          <div class="space-y-2 pt-1">
            <button type="button" id="nutrolixReviewSubmitBtn" onclick="window.NutrolixReviews.submitReview()" class="w-full py-3.5 px-4 rounded-xl bg-nutro-forest hover:bg-nutro-dark text-white font-black text-xs shadow-md active:scale-95 transition flex items-center justify-center space-x-2">
              <i class="fa-solid fa-check"></i>
              <span>Submit Verified Review</span>
            </button>
            <button type="button" onclick="window.NutrolixReviews.dismissReviewModal()" class="w-full py-2 text-center text-xs font-bold text-slate-400 hover:text-slate-600 transition">
              Close
            </button>
          </div>

        </div>
      </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div.firstElementChild);
  }

  function renderStars(rating, preserveText = false) {
    activeStarRating = rating;
    const container = document.getElementById('reviewStarsContainer');
    if (!container) return;
    const stars = container.querySelectorAll('[data-star]');
    stars.forEach(s => {
      const val = parseInt(s.getAttribute('data-star'), 10);
      s.className = val <= rating
        ? 'fa-solid fa-star transition hover:scale-110 active:scale-95 text-amber-400'
        : 'fa-solid fa-star transition hover:scale-110 active:scale-95 text-slate-200';
    });

    const labels = {
      5: "5.0 / 5.0 • Exceptional Quality",
      4: "4.0 / 5.0 • Highly Recommended",
      3: "3.0 / 5.0 • Average / Good",
      2: "2.0 / 5.0 • Needs Improvement",
      1: "1.0 / 5.0 • Unsatisfactory"
    };
    const labelEl = document.getElementById('reviewStarLabel');
    if (labelEl) labelEl.textContent = labels[rating] || (rating + ".0 / 5.0");

    if (!preserveText && !activeExistingReview) {
      const feedbackEl = document.getElementById('reviewFeedbackText');
      if (feedbackEl && (!feedbackEl.value.trim() || Object.values(PRESET_SUGGESTIONS).includes(feedbackEl.value.trim()))) {
        feedbackEl.value = PRESET_SUGGESTIONS[rating] || "";
      }
    }
  }

  function saveReviewLocally(savedReview) {
    try {
      if (savedReview && savedReview.orderId) {
        cachedReviewsByOrderId.set(String(savedReview.orderId).trim(), savedReview);
      }
      const savedReviews = JSON.parse(localStorage.getItem('nutrolix_product_reviews') || '[]');
      const deduped = [
        savedReview,
        ...savedReviews.filter(r => {
          if (!r) return false;
          if (r.id === savedReview.id) return false;
          if (savedReview.orderId && r.orderId && String(r.orderId).trim() === String(savedReview.orderId).trim()) return false;
          return true;
        })
      ];
      localStorage.setItem('nutrolix_product_reviews', JSON.stringify(deduped.slice(0, 200)));

      const allIds = Array.from(new Set([
        savedReview.productId,
        ...(Array.isArray(savedReview.productIds) ? savedReview.productIds : [])
      ].filter(Boolean)));
      allIds.forEach((pid) => {
        const key = 'nutrolix_product_reviews_' + pid;
        const perProd = JSON.parse(localStorage.getItem(key) || '[]');
        const nextList = [
          {
            id: savedReview.id,
            orderId: savedReview.orderId || '',
            name: savedReview.customerName,
            customerName: savedReview.customerName,
            rating: savedReview.rating,
            date: savedReview.edited ? 'Edited just now' : 'Just now',
            createdAt: savedReview.createdAt,
            updatedAt: savedReview.updatedAt || savedReview.createdAt,
            text: savedReview.comment,
            comment: savedReview.comment,
            verified: true
          },
          ...perProd.filter(r => {
            if (!r) return false;
            if (r.id === savedReview.id) return false;
            if (savedReview.orderId && r.orderId && String(r.orderId).trim() === String(savedReview.orderId).trim()) return false;
            return true;
          })
        ];
        localStorage.setItem(key, JSON.stringify(nextList.slice(0, 100)));
      });
    } catch (_) {}
  }

  function applyModalEditOrCreateState(existingRev) {
    activeExistingReview = existingRev || null;
    const titleEl = document.getElementById('reviewModalTitle');
    const badgeEl = document.querySelector('#nutrolixReviewModalCard span');
    const btnEl = document.getElementById('nutrolixReviewSubmitBtn');
    const feedbackEl = document.getElementById('reviewFeedbackText');

    if (existingRev) {
      if (titleEl) titleEl.textContent = 'Edit Your Review';
      if (badgeEl) badgeEl.innerHTML = '<i class="fa-solid fa-pen-to-square text-emerald-600"></i><span>Review Submitted • Edit Anytime</span>';
      if (btnEl) btnEl.innerHTML = '<i class="fa-solid fa-check"></i><span>Update Verified Review</span>';
      const existingRating = Math.min(5, Math.max(1, Number(existingRev.rating || 5) || 5));
      if (feedbackEl) feedbackEl.value = String(existingRev.comment || existingRev.text || '');
      renderStars(existingRating, true);
    } else {
      if (titleEl) titleEl.textContent = 'How was your Nutrolix order?';
      if (badgeEl) badgeEl.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-600"></i><span>Order Delivered • Verified Purchase</span>';
      if (btnEl) btnEl.innerHTML = '<i class="fa-solid fa-check"></i><span>Submit Verified Review</span>';
      if (feedbackEl) feedbackEl.value = PRESET_SUGGESTIONS[5];
      renderStars(5, false);
    }
  }

  window.NutrolixReviews = {
    setRating: function(r) {
      renderStars(r, Boolean(activeExistingReview));
    },

    applySuggestion: function() {
      const feedbackEl = document.getElementById('reviewFeedbackText');
      if (feedbackEl) feedbackEl.value = PRESET_SUGGESTIONS[activeStarRating] || "";
    },

    hasReviewForOrder: hasReviewForOrder,
    getReviewForOrder: getStoredReviewForOrder,
    ingestServerReviews: ingestServerReviews,
    syncOrderReviewsFromServer: syncOrderReviewsFromServer,

    openReviewModalForOrder: function(order, isAutoPopup = false) {
      if (!order) return;
      ensureModalInDOM();
      activeReviewOrder = order;
      modalOpenNow = true;

      const items = Array.isArray(order.items) ? order.items : [];
      const firstItem = items[0] || {};
      const itemTitle = firstItem.title || firstItem.name || firstItem.mealName || 'Nutrolix Nutrition Product';
      const pName = items.length > 1 ? `${itemTitle} + ${items.length - 1} more` : itemTitle;
      const pVariant = firstItem.variant || firstItem.pack || 'Verified Functional Nutrition';
      const pImg = firstItem.image || 'assets/nutrolix-logo.png';
      const oid = order.id || order.orderId || 'NTX-ORD';

      if (isAutoPopup) {
        // Strictly guarantee single-time display even if user closes browser or navigates away
        try {
          localStorage.setItem('nutrolix_review_shown_' + oid, 'true');
        } catch (_) {}
        markOrderAsDismissed(oid);
      }

      const nameEl = document.getElementById('reviewProductName');
      const varEl = document.getElementById('reviewProductVariant');
      const imgEl = document.getElementById('reviewProductImg');
      const tagEl = document.getElementById('reviewOrderIdTag');

      if (nameEl) nameEl.textContent = pName;
      if (varEl) varEl.textContent = pVariant;
      if (imgEl) imgEl.src = pImg;
      if (tagEl) tagEl.textContent = 'Order #' + oid;

      const cachedExisting = getStoredReviewForOrder(oid);
      applyModalEditOrCreateState(cachedExisting);

      const backdrop = document.getElementById('nutrolixReviewModalBackdrop');
      if (backdrop) {
        backdrop.classList.remove('hidden');
        setTimeout(() => {
          const card = document.getElementById('nutrolixReviewModalCard');
          if (card) card.classList.remove('scale-95');
        }, 20);
      }

      if (!isAutoPopup) {
        fetchReviewForOrder(oid).then((remoteExisting) => {
          if (remoteExisting && activeReviewOrder && (activeReviewOrder.id === oid || activeReviewOrder.orderId === oid)) {
            applyModalEditOrCreateState(remoteExisting);
          }
        }).catch(() => {});
      }
    },

    dismissReviewModal: function() {
      if (activeReviewOrder) {
        const oid = activeReviewOrder.id || activeReviewOrder.orderId;
        if (oid) {
          markOrderAsDismissed(oid);
        }
      }
      const backdrop = document.getElementById('nutrolixReviewModalBackdrop');
      if (backdrop) backdrop.classList.add('hidden');
      activeReviewOrder = null;
      activeExistingReview = null;
      modalOpenNow = false;
    },

    submitReview: async function() {
      if (!activeReviewOrder) return;
      const oid = activeReviewOrder.id || activeReviewOrder.orderId;
      const feedbackEl = document.getElementById('reviewFeedbackText');
      const feedback = feedbackEl ? feedbackEl.value.trim() : '';

      const user = (typeof window.getNutrolixUser === 'function') ? window.getNutrolixUser() : null;
      const reviewerName = user ? (user.name || user.displayName || 'Verified Customer') : 'Verified Customer';

      const items = Array.isArray(activeReviewOrder.items) ? activeReviewOrder.items : [];
      const firstItem = items[0] || {};
      const productIds = Array.from(new Set(items.map(it => it && (it.id || it.productId || it.mealId)).filter(Boolean).map(String)));
      const productNames = Array.from(new Set(items.map(it => it && (it.title || it.name || it.mealName)).filter(Boolean).map(String)));

      const isEdit = Boolean(activeExistingReview);
      const deterministicId = oid
        ? ('rev_ord_' + String(oid).replace(/[^a-zA-Z0-9_-]/g, '_'))
        : ('rev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
      const newReview = {
        id: (activeExistingReview && activeExistingReview.id) || deterministicId,
        orderId: oid,
        isEdit,
        productName: productNames[0] || firstItem.title || firstItem.name || 'Nutrolix Product',
        productNames: productNames,
        productId: productIds[0] || firstItem.id || 'nutrolix_prod',
        productIds: productIds.length ? productIds : ['nutrolix_prod'],
        rating: activeStarRating,
        comment: feedback || PRESET_SUGGESTIONS[activeStarRating],
        text: feedback || PRESET_SUGGESTIONS[activeStarRating],
        customerName: reviewerName,
        name: reviewerName,
        customerEmail: user ? (user.email || '') : '',
        customerPhone: user ? (user.verifiedPhone || user.phone || '') : '',
        uid: user ? (user.uid || '') : '',
        createdAt: (activeExistingReview && activeExistingReview.createdAt) || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        edited: isEdit,
        verified: true
      };

      const btn = document.getElementById('nutrolixReviewSubmitBtn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Saving...</span>';
      }

      let persistedRev = newReview;
      try {
        const res = await fetch(getApiHost() + '/api/product-reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newReview)
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.review) persistedRev = data.review;
        }
      } catch (_) {}

      saveReviewLocally(persistedRev);
      markOrderAsReviewed(oid);

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check"></i><span>Submit Verified Review</span>';
      }

      const backdrop = document.getElementById('nutrolixReviewModalBackdrop');
      if (backdrop) backdrop.classList.add('hidden');
      activeReviewOrder = null;
      activeExistingReview = null;
      modalOpenNow = false;

      window.dispatchEvent(new CustomEvent('nutrolix:reviews-updated', { detail: persistedRev }));

      const toast = document.createElement('div');
      toast.className = 'fixed top-5 right-5 z-50 bg-emerald-800 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2 text-xs font-bold transition-transform';
      toast.innerHTML = `<i class="fa-solid fa-circle-check text-amber-400 text-base"></i><span>${isEdit ? 'Your verified review has been updated!' : 'Thank you! Your verified review has been saved permanently.'}</span>`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    },

    checkPendingDeliveredReview: async function(delayMs = 1200) {
      if (checkInFlight || modalOpenNow) return;
      checkInFlight = true;
      try {
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        if (modalOpenNow) return;
        const pendingOrder = await findPendingDeliveredOrder();
        if (pendingOrder && !modalOpenNow) {
          window.NutrolixReviews.openReviewModalForOrder(pendingOrder, true);
        }
      } catch (_) {
      } finally {
        checkInFlight = false;
      }
    }
  };

  window.addEventListener('nutrolix:auth-changed', () => {
    window.NutrolixReviews.checkPendingDeliveredReview(900);
  });
  window.addEventListener('nutrolix:order-push', () => {
    window.NutrolixReviews.checkPendingDeliveredReview(1000);
  });
  window.addEventListener('nutrolix:orders-loaded', () => {
    window.NutrolixReviews.checkPendingDeliveredReview(500);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.NutrolixReviews.checkPendingDeliveredReview(1400);
    });
  } else {
    window.NutrolixReviews.checkPendingDeliveredReview(1400);
  }
})();
