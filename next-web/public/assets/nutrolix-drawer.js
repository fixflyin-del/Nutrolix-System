/**
 * Nutrolix Universal Left Drawer Menu
 * Handles responsive opening and closing of the brand sidebar across all pages.
 */
(function() {
  window.toggleLeftBurgerMenu = function() {
    const drawer = document.getElementById('leftBurgerDrawer');
    const backdrop = document.getElementById('leftBurgerBackdrop');
    if (!drawer || !backdrop) return;

    const isHidden = drawer.classList.contains('-translate-x-full');
    if (isHidden) {
      drawer.classList.remove('-translate-x-full');
      backdrop.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    } else {
      drawer.classList.add('-translate-x-full');
      backdrop.classList.add('hidden');
      document.body.style.overflow = '';
    }
  };

  // Close on Escape key press
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const drawer = document.getElementById('leftBurgerDrawer');
      const backdrop = document.getElementById('leftBurgerBackdrop');
      if (drawer && !drawer.classList.contains('-translate-x-full')) {
        drawer.classList.add('-translate-x-full');
        if (backdrop) backdrop.classList.add('hidden');
        document.body.style.overflow = '';
      }
    }
  });
})();
