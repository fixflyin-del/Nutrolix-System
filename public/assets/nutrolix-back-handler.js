/**
 * Nutrolix Android Mobile Back Navigation Controller
 * 1. Closes open popups, modals, and slide-out drawers first when Back is pressed.
 * 2. If no modal is open, returns to the previous page instead of closing the website.
 */
(function() {
  const modalStack = [];
  let isNavigatingBack = false;

  window.NutrolixBackHandler = {
    /**
     * Register an open modal or drawer
     * @param {string} id - Modal identifier
     * @param {Function} closeCallback - Function to execute to close the modal
     */
    registerOpenModal(id, closeCallback) {
      // Check if already in stack
      const existingIdx = modalStack.findIndex(m => m.id === id);
      if (existingIdx >= 0) {
        modalStack.splice(existingIdx, 1);
      }
      modalStack.push({ id, closeCallback });

      // Push history state so browser Back intercepts it
      try {
        history.pushState({ nutrolixModalOpen: true, modalId: id }, '');
      } catch (_) {}
    },

    /**
     * Unregister a modal when closed via UI cross button or backdrop click
     * @param {string} id 
     */
    unregisterModal(id) {
      const idx = modalStack.findIndex(m => m.id === id);
      if (idx >= 0) {
        modalStack.splice(idx, 1);
        if (!isNavigatingBack && history.state && history.state.nutrolixModalOpen) {
          try {
            history.back();
          } catch (_) {}
        }
      }
    },

    /**
     * Check if any modal is currently active
     */
    hasActiveModal() {
      return modalStack.length > 0;
    },

    /**
     * Close the topmost modal
     */
    closeTopModal() {
      if (modalStack.length > 0) {
        const top = modalStack.pop();
        if (typeof top.closeCallback === 'function') {
          try {
            top.closeCallback();
          } catch (e) {
            console.warn('Error closing modal:', e);
          }
        }
        return true;
      }
      return false;
    }
  };

  // Listen to popstate (Hardware / Browser Back button)
  window.addEventListener('popstate', function(event) {
    if (window.NutrolixBackHandler.hasActiveModal()) {
      isNavigatingBack = true;
      window.NutrolixBackHandler.closeTopModal();
      setTimeout(() => { isNavigatingBack = false; }, 100);
      return;
    }

    // If no modal was open and user is on a sub-page with no Nutrolix history
    const path = window.location.pathname;
    const isHomePage = path === '/' || path.endsWith('/index.html') || path.endsWith('/');
    if (!isHomePage && window.history.length <= 2 && document.referrer.indexOf(window.location.host) === -1) {
      window.location.href = 'index.html';
    }
  });

  // Global automatic modal hook for common Nutrolix components
  document.addEventListener('DOMContentLoaded', () => {
    // Intercept Left Burger Drawer
    const origToggleLeft = window.toggleLeftBurgerMenu;
    if (typeof origToggleLeft === 'function') {
      window.toggleLeftBurgerMenu = function() {
        const drawer = document.getElementById('leftBurgerDrawer');
        const isCurrentlyClosed = !drawer || drawer.classList.contains('-translate-x-full');
        origToggleLeft.apply(this, arguments);
        if (isCurrentlyClosed) {
          window.NutrolixBackHandler.registerOpenModal('leftBurgerDrawer', () => {
            const d = document.getElementById('leftBurgerDrawer');
            const b = document.getElementById('leftBurgerBackdrop');
            if (d) d.classList.add('-translate-x-full');
            if (b) b.classList.add('hidden');
          });
        } else {
          window.NutrolixBackHandler.unregisterModal('leftBurgerDrawer');
        }
      };
    }

    // Intercept Cart Drawer
    const origOpenCart = window.openCartDrawer;
    if (typeof origOpenCart === 'function') {
      window.openCartDrawer = function() {
        origOpenCart.apply(this, arguments);
        window.NutrolixBackHandler.registerOpenModal('cartDrawer', () => {
          if (typeof window.closeCartDrawer === 'function') window.closeCartDrawer();
        });
      };
    }

    // Intercept Wishlist Drawer
    const origOpenWishlist = window.openWishlistDrawer;
    if (typeof origOpenWishlist === 'function') {
      window.openWishlistDrawer = function() {
        origOpenWishlist.apply(this, arguments);
        window.NutrolixBackHandler.registerOpenModal('wishlistDrawer', () => {
          if (typeof window.closeWishlistDrawer === 'function') window.closeWishlistDrawer();
        });
      };
    }

    // Intercept Search Modal
    const origOpenSearch = window.openSearchModal;
    if (typeof origOpenSearch === 'function') {
      window.openSearchModal = function() {
        origOpenSearch.apply(this, arguments);
        window.NutrolixBackHandler.registerOpenModal('searchModal', () => {
          if (typeof window.closeSearchModal === 'function') window.closeSearchModal();
        });
      };
    }

    // Intercept Food Detail Modal
    const origOpenFoodDetail = window.openFoodDetailModal;
    if (typeof origOpenFoodDetail === 'function') {
      window.openFoodDetailModal = function() {
        origOpenFoodDetail.apply(this, arguments);
        window.NutrolixBackHandler.registerOpenModal('foodDetailModal', () => {
          if (typeof window.closeFoodDetailModal === 'function') window.closeFoodDetailModal();
        });
      };
    }

    // Intercept Image Zoom Modal
    const origOpenImageZoom = window.openImageZoom;
    if (typeof origOpenImageZoom === 'function') {
      window.openImageZoom = function() {
        origOpenImageZoom.apply(this, arguments);
        window.NutrolixBackHandler.registerOpenModal('imageZoomModal', () => {
          if (typeof window.closeImageZoom === 'function') window.closeImageZoom();
        });
      };
    }
  });
})();
