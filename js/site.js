/* CompressZone — shared by every page: ads, offline support, footer year. */
(function () {
  'use strict';

  var ADSENSE = {
    client: 'ca-pub-3088214716790750',
    // Ad unit slot IDs from AdSense → Ads → By ad unit. Leave empty to rely on Auto ads.
    slots: { top: '', middle: '' }
  };

  /* ============ Ads (loaded after the page is interactive) ============ */
  function initAds() {
    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADSENSE.client;
    document.head.appendChild(s);
    document.querySelectorAll('.ad-slot').forEach(function (slot) {
      var id = ADSENSE.slots[slot.dataset.adSlotName];
      if (!/^\d{6,}$/.test(id || '')) { slot.parentNode.hidden = true; return; } // no unit yet: collapse
      var ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', ADSENSE.client);
      ins.setAttribute('data-ad-slot', id);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      slot.appendChild(ins);
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    });
  }

  window.addEventListener('load', function () {
    var idle = window.requestIdleCallback || function (fn) { setTimeout(fn, 1200); };
    idle(initAds, { timeout: 3000 });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('/sw.js').catch(function () { /* offline support is optional */ });
    }
  });

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
