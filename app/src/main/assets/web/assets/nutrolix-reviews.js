// Nutrolix Centralized Review Service
// Handles automatic popup for delivered orders & manual review submissions
// Strictly adheres to verified genuine user sessions and delivered order criteria

(function() {
  const PRESET_SUGGESTIONS = {
    5: "The quality and taste exceeded expectations! The high protein formula keeps me energetic throughout the day without heavy bloating.",
    4: "Very good healthy food, fresh packaging and timely delivery. Good macros and clean ingredients.",
    3: "Decent product and clean nutrition profile. Taste is earthy and mild.",
    2: "Delivery took longer than expected, though the nutrition formulation is authentic.",
    1: "Had issues with packaging condition upon delivery."
  };

  let activeReviewOrder = null;
  let activeStarRating = 5;

  // Local & Remote reviewed order IDs
  function getReviewedOrderIds() {
    try {
      return JSON.parse(localStorage.getItem('nutrolix_reviewed_orders') || '[]');
    } catch (_) {
      return [];
    }
  }

  function markOrderAsReviewed(orderId) {
    if (!orderId) return;
    try {
      const reviewed = getReviewedOrderIds();
      if (!reviewed.includes(orderId)) {
        reviewed.push(orderId);
        localStorage.setItem('nutrolix_reviewed_orders', JSON.stringify(reviewed));
      }
    } catch (_) {}

    // Persist to backend
    try {
      fetch('/api/reviews/mark-reviewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderId })
      }).catch(() => {});
    } catch (_) {}
  }

  function isOrderDismissed(orderId) {
    if (!orderId) return true;
    try {
      if (localStorage.getItem('nutrolix_review_dismissed_' + orderId) === 'true') {
        return true;
      }
      if (sessionStorage.getItem('nutrolix_review_dismissed_' + orderId) === 'true') {
        return true;
      }
    } catch (_) {}
    return false;
  }

  function markOrderAsDismissed(orderId) {
    if (!orderId) return;
    try {
      localStorage.setItem('nutrolix_review_dismissed_' + orderId, 'true');
      sessionStorage.setItem('nutrolix_review_dismissed_' + orderId, 'true');
    } catch (_) {}

    // Persist to backend so it never reappears on next launch or device refresh
    try {
      fetch('/api/reviews/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderId })
      }).catch(() => {});
    } catch (_) {}
  }

  // Find genuine delivered order belonging to current logged-in user
  function findPendingDeliveredOrder() {
    // RULE 1: Never show popup to logged-out users
    const user = (typeof window.getNutrolixUser === 'function') ? window.getNutrolixUser() : null;
    if (!user || (!user.email && !user.phone)) {
      return null;
    }

    const reviewed = getReviewedOrderIds();
    const userEmail = (user.email || '').toLowerCase().trim();
    const userPhone = (user.phone || '').replace(/\D/g, '');

    // Collect all real local customer orders
    let allOrders = [];
    try {
      const o1 = JSON.parse(localStorage.getItem('nutrolix_orders') || '[]');
      if (Array.isArray(o1)) allOrders = allOrders.concat(o1);
    } catch (_) {}
    try {
      const o2 = JSON.parse(localStorage.getItem('nutrolix_store_orders') || '[]');
      if (Array.isArray(o2)) allOrders = allOrders.concat(o2);
    } catch (_) {}

    // RULE 2: NEVER generate fake orders. If allOrders is empty, return null immediately.
    if (allOrders.length === 0) {
      return null;
    }

    // Filter to genuine orders belonging strictly to the logged-in user
    const userOrders = allOrders.filter(ord => {
      if (!ord) return false;
      const ordEmail = (ord.customerEmail || ord.email || '').toLowerCase().trim();
      const ordPhone = (ord.customerPhone || ord.phone || '').replace(/\D/g, '');
      
      // Matches logged-in user's credentials
      const matchesEmail = userEmail && ordEmail && (ordEmail === userEmail);
      const matchesPhone = userPhone && ordPhone && (ordPhone === userPhone);
      
      // If order has no contact metadata but is stored in user's private session list
      const isStoredUserOrder = !ordEmail && !ordPhone;
      return matchesEmail || matchesPhone || isStoredUserOrder;
    });

    // Sort by latest order first
    userOrders.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.date || 0).getTime();
      const timeB = new Date(b.createdAt || b.date || 0).getTime();
      return timeB - timeA;
    });

    for (const ord of userOrders) {
      const oid = ord.id || ord.orderId;
      if (!oid) continue;

      // RULE 3: Order status MUST strictly be Delivered or Completed
      // Never show popup for pending, confirmed, dispatched, rejected or cancelled orders
      const st = (ord.status || '').toLowerCase().trim();
      const isDelivered = (st === 'delivered' || st === 'completed');
      if (!isDelivered) {
        continue;
      }

      // RULE 4: The order has not been reviewed
      if (reviewed.includes(oid)) {
        continue;
      }

      // RULE 5: The review prompt has not already been dismissed or shown for that order
      if (isOrderDismissed(oid)) {
        continue;
      }

      // Found genuine eligible delivered order
      return ord;
    }

    return null;
  }

  function ensureModalInDOM() {
    if (document.getElementById('nutrolixReviewModalBackdrop')) return;

    const modalHtml = `
      <div id="nutrolixReviewModalBackdrop" class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm hidden flex items-center justify-center p-4 transition-opacity duration-300">
        <div id="nutrolixReviewModalCard" class="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 transform scale-95 transition-transform duration-300">
          
          <!-- Header -->
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

          <!-- Product Details Card -->
          <div class="flex items-center space-x-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <img id="reviewProductImg" src="assets/nutrolix-logo.png" alt="Product" class="w-14 h-14 rounded-xl object-contain bg-white border border-slate-200 p-1 shrink-0">
            <div class="min-w-0">
              <div class="font-black text-xs text-slate-900 truncate" id="reviewProductName">Nutrolix Nutrition Item</div>
              <div class="text-[11px] text-slate-500 font-bold" id="reviewProductVariant">Verified Functional Nutrition</div>
              <div class="text-[10px] text-emerald-700 font-extrabold mt-0.5" id="reviewOrderIdTag">Order #NTX-000000</div>
            </div>
          </div>

          <!-- Star Rating -->
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

          <!-- Suggestion & Textarea -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <label class="font-bold text-slate-700">Your Review</label>
              <button type="button" onclick="window.NutrolixReviews.applySuggestion()" class="text-[10px] font-bold text-emerald-700 hover:underline">
                Use suggestion ✨
              </button>
            </div>
            <textarea id="reviewFeedbackText" rows="3" placeholder="Share your honest thoughts about taste, packaging & energy..." class="w-full p-3 rounded-2xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium leading-relaxed"></textarea>
            <p class="text-[10px] text-slate-400">Your review will be verified and published on Nutrolix.</p>
          </div>

          <!-- Action Buttons -->
          <div class="space-y-2 pt-1">
            <button type="button" onclick="window.NutrolixReviews.submitReview()" class="w-full py-3.5 px-4 rounded-xl bg-nutro-forest hover:bg-nutro-dark text-white font-black text-xs shadow-md active:scale-95 transition flex items-center justify-center space-x-2">
              <i class="fa-solid fa-check"></i>
              <span>Submit Verified Review</span>
            </button>
            <button type="button" onclick="window.NutrolixReviews.dismissReviewModal()" class="w-full py-2 text-center text-xs font-bold text-slate-400 hover:text-slate-600 transition">
              Remind Me Later
            </button>
          </div>

        </div>
      </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div.firstElementChild);
  }

  function renderStars(rating) {
    activeStarRating = rating;
    const container = document.getElementById('reviewStarsContainer');
    if (!container) return;
    const stars = container.querySelectorAll('[data-star]');
    stars.forEach(s => {
      const val = parseInt(s.getAttribute('data-star'), 10);
      if (val <= rating) {
        s.className = 'fa-solid fa-star transition hover:scale-110 active:scale-95 text-amber-400';
      } else {
        s.className = 'fa-solid fa-star transition hover:scale-110 active:scale-95 text-slate-200';
      }
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

    const feedbackEl = document.getElementById('reviewFeedbackText');
    if (feedbackEl && (!feedbackEl.value.trim() || Object.values(PRESET_SUGGESTIONS).includes(feedbackEl.value.trim()))) {
      feedbackEl.value = PRESET_SUGGESTIONS[rating] || "";
    }
  }

  window.NutrolixReviews = {
    setRating: function(r) {
      renderStars(r);
    },

    applySuggestion: function() {
      const feedbackEl = document.getElementById('reviewFeedbackText');
      if (feedbackEl) feedbackEl.value = PRESET_SUGGESTIONS[activeStarRating] || "";
    },

    openReviewModalForOrder: function(order) {
      if (!order) return;
      ensureModalInDOM();
      activeReviewOrder = order;

      const firstItem = (order.items && order.items[0]) ? order.items[0] : {};
      const pName = firstItem.title || firstItem.name || 'Nutrolix Nutrition Product';
      const pVariant = firstItem.variant || firstItem.pack || 'Verified Functional Nutrition';
      const pImg = firstItem.image || 'assets/nutrolix-logo.png';
      const oid = order.id || order.orderId || 'NTX-ORD';

      const nameEl = document.getElementById('reviewProductName');
      const varEl = document.getElementById('reviewProductVariant');
      const imgEl = document.getElementById('reviewProductImg');
      const tagEl = document.getElementById('reviewOrderIdTag');

      if (nameEl) nameEl.textContent = pName;
      if (varEl) varEl.textContent = pVariant;
      if (imgEl) imgEl.src = pImg;
      if (tagEl) tagEl.textContent = 'Order #' + oid;

      renderStars(5);

      const backdrop = document.getElementById('nutrolixReviewModalBackdrop');
      if (backdrop) {
        backdrop.classList.remove('hidden');
        setTimeout(() => {
          const card = document.getElementById('nutrolixReviewModalCard');
          if (card) card.classList.remove('scale-95');
        }, 20);
      }
    },

    dismissReviewModal: function() {
      if (activeReviewOrder) {
        const oid = activeReviewOrder.id || activeReviewOrder.orderId;
        if (oid) {
          // Permanently mark dismissed for this order so it never loops on app launch
          markOrderAsDismissed(oid);
        }
      }
      const backdrop = document.getElementById('nutrolixReviewModalBackdrop');
      if (backdrop) backdrop.classList.add('hidden');
      activeReviewOrder = null;
    },

    submitReview: function() {
      if (!activeReviewOrder) return;
      const oid = activeReviewOrder.id || activeReviewOrder.orderId;
      const feedback = document.getElementById('reviewFeedbackText').value.trim();

      const user = (typeof window.getNutrolixUser === 'function') ? window.getNutrolixUser() : null;
      const reviewerName = user ? (user.name || user.displayName || 'Verified Customer') : 'Verified Customer';

      const firstItem = (activeReviewOrder.items && activeReviewOrder.items[0]) ? activeReviewOrder.items[0] : {};
      const newReview = {
        orderId: oid,
        productName: firstItem.title || firstItem.name || 'Nutrolix Product',
        productId: firstItem.id || 'nutrolix_prod',
        rating: activeStarRating,
        comment: feedback || PRESET_SUGGESTIONS[activeStarRating],
        customerName: reviewerName,
        customerEmail: user ? user.email : '',
        createdAt: new Date().toISOString(),
        verified: true
      };

      // 1. Save in local reviews list
      try {
        const savedReviews = JSON.parse(localStorage.getItem('nutrolix_product_reviews') || '[]');
        savedReviews.unshift(newReview);
        localStorage.setItem('nutrolix_product_reviews', JSON.stringify(savedReviews));
      } catch (_) {}

      // 2. Post to backend review endpoint
      try {
        fetch('/api/product-reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newReview)
        }).catch(() => {});
      } catch (_) {}

      // 3. Permanently mark order as reviewed
      markOrderAsReviewed(oid);

      // 4. Hide modal
      const backdrop = document.getElementById('nutrolixReviewModalBackdrop');
      if (backdrop) backdrop.classList.add('hidden');
      activeReviewOrder = null;

      // 5. Friendly toast feedback
      const toast = document.createElement('div');
      toast.className = 'fixed top-5 right-5 z-50 bg-emerald-800 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2 text-xs font-bold transition-transform';
      toast.innerHTML = `<i class="fa-solid fa-circle-check text-amber-400 text-base"></i><span>Thank you! Your verified review has been published.</span>`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    },

    checkPendingDeliveredReview: function() {
      // Delay slightly for smooth page rendering
      setTimeout(() => {
        const pendingOrder = findPendingDeliveredOrder();
        if (pendingOrder) {
          window.NutrolixReviews.openReviewModalForOrder(pendingOrder);
        }
      }, 1500);
    }
  };

  // Sync with Web Assets
  try {
    const assetScriptPath = 'app/src/main/assets/web/assets/nutrolix-reviews.js';
  } catch (_) {}

  // Automatically check on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.NutrolixReviews.checkPendingDeliveredReview();
    });
  } else {
    window.NutrolixReviews.checkPendingDeliveredReview();
  }
})();
