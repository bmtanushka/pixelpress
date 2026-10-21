/* CompressZone — shared by every page: ads, analytics, offline support, share prompt, footer year. */
(function () {
  'use strict';

  /* ============ Tiny i18n: <html lang="hi"> pages get Hindi UI strings ============ */
  var DICT = {
    hi: {
      'Compressing…': 'कंप्रेस हो रहा है…', 'Already optimized': 'पहले से ऑप्टिमाइज़्ड', 'Under': 'इससे कम:', "Couldn't reach": 'इतना कम नहीं हो सका:',
      'Download': 'डाउनलोड', 'Download all (ZIP)': 'सभी डाउनलोड करें (ZIP)', 'Remove': 'हटाएँ', 'Compare before & after': 'पहले और बाद में तुलना करें',
      'image': 'फ़ोटो', 'images': 'फ़ोटो', 'Saved': 'बचत', 'in progress': 'प्रोसेस हो रही हैं',
      "This browser can't read this image format": 'यह ब्राउज़र इस फ़ोटो फ़ॉर्मेट को नहीं पढ़ सकता', 'Could not compress this image': 'यह फ़ोटो कंप्रेस नहीं हो सकी',
      'Please choose image files': 'कृपया फ़ोटो फ़ाइलें चुनें', 'Please choose a supported file': 'कृपया सही फ़ाइल चुनें', 'Could not create ZIP file': 'ZIP फ़ाइल नहीं बन सकी',
      'Drag thumbnails to reorder': 'क्रम बदलने के लिए थंबनेल खींचें', 'Move earlier': 'पहले करें', 'Move later': 'बाद में करें',
      "Couldn't read": 'पढ़ा नहीं जा सका:', 'Creating…': 'बन रहा है…', 'PDF created': 'PDF बन गई', 'Could not create the PDF': 'PDF नहीं बन सकी',
      'Done! Was this helpful?': 'हो गया! क्या यह काम आया?', 'CompressZone is free and private. Sharing it helps keep it that way.': 'CompressZone मुफ़्त और प्राइवेट है। इसे शेयर करके दूसरों की भी मदद करें।',
      'Share': 'शेयर करें', 'Install app': 'ऐप इंस्टॉल करें', 'Link copied ✓': 'लिंक कॉपी हो गया ✓', 'Close': 'बंद करें',
      'Free, private image & PDF tools — files never leave your device.': 'मुफ़्त, प्राइवेट फ़ोटो और PDF टूल — फ़ाइलें आपके डिवाइस से बाहर नहीं जातीं।'
    }
  };
  DICT.es = {
    'Compressing…': 'Comprimiendo…', 'Already optimized': 'Ya optimizada', 'Under': 'Menos de', "Couldn't reach": 'No se pudo llegar a',
    'Download': 'Descargar', 'Download all (ZIP)': 'Descargar todo (ZIP)', 'Remove': 'Quitar', 'Compare before & after': 'Comparar antes y después',
    'image': 'imagen', 'images': 'imágenes', 'Saved': 'Ahorro', 'in progress': 'en proceso',
    "This browser can't read this image format": 'Este navegador no puede leer este formato de imagen', 'Could not compress this image': 'No se pudo comprimir esta imagen',
    'Please choose image files': 'Elige archivos de imagen', 'Please choose a supported file': 'Elige un archivo compatible', 'Could not create ZIP file': 'No se pudo crear el archivo ZIP',
    'Drag thumbnails to reorder': 'Arrastra las miniaturas para ordenarlas', 'Move earlier': 'Mover antes', 'Move later': 'Mover después',
    "Couldn't read": 'No se pudo leer', 'Creating…': 'Creando…', 'PDF created': 'PDF creado', 'Could not create the PDF': 'No se pudo crear el PDF',
    'PDF': 'PDF', 'PDFs': 'PDF', 'page': 'página', 'pages': 'páginas', 'Reading…': 'Leyendo…', 'Move up': 'Subir', 'Move down': 'Bajar',
    'Password-protected — unlock it first': 'Protegido con contraseña: desbloquéalo primero', "Couldn't read this PDF": 'No se pudo leer este PDF',
    'Merging…': 'Uniendo…', 'Merged PDF ready': 'PDF unido listo', 'Could not merge these PDFs': 'No se pudieron unir estos PDF', 'Please choose PDF files': 'Elige archivos PDF',
    'Done! Was this helpful?': '¡Listo! ¿Te ha servido?', 'CompressZone is free and private. Sharing it helps keep it that way.': 'CompressZone es gratis y privado. Compartirlo nos ayuda a que siga así.',
    'Share': 'Compartir', 'Install app': 'Instalar app', 'Link copied ✓': 'Enlace copiado ✓', 'Close': 'Cerrar',
    'Free, private image & PDF tools — files never leave your device.': 'Herramientas gratis y privadas para imágenes y PDF: tus archivos nunca salen de tu dispositivo.'
  };
  var LANG = (document.documentElement.lang || 'en').slice(0, 2);
  var t = window.czT = function (s) { return (DICT[LANG] && DICT[LANG][s]) || s; };

  var ADSENSE = {
    client: 'ca-pub-3088214716790750',
    // Ad unit slot IDs from AdSense → Ads → By ad unit. Leave empty to rely on Auto ads.
    slots: { top: '', middle: '' }
  };

  // Cloudflare Web Analytics (cookie-free, no consent banner needed). Paste the site token from
  // Cloudflare → Analytics & Logs → Web Analytics, or leave empty if Cloudflare injects it automatically.
  var CF_ANALYTICS_TOKEN = '';

  /* ============ Ads (loaded after the page is interactive) ============ */
  function initAds() {
    if (document.body.dataset.ads === 'off') return; // no ads on 404, hubs and legal pages (AdSense policy)
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

  function initAnalytics() {
    if (!CF_ANALYTICS_TOKEN) return;
    var s = document.createElement('script');
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_ANALYTICS_TOKEN }));
    document.head.appendChild(s);
  }

  /* ============ Share / install prompt (after a successful download) ============ */
  var installEvent = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvent = e; });

  function store(key, val) {
    try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; }
  }
  var prompted = false;
  function maybePrompt() {
    if (prompted) return;
    var snoozed = Number(store('cz-share-snooze') || 0);
    if (snoozed > Date.now()) return;
    prompted = true;
    setTimeout(showPrompt, 900);
  }
  function showPrompt() {
    var box = document.createElement('div');
    box.className = 'share-prompt';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Share CompressZone');
    box.innerHTML =
      '<button type="button" class="share-close" aria-label="' + t('Close') + '">✕</button>' +
      '<strong>' + t('Done! Was this helpful?') + '</strong>' +
      '<p>' + t('CompressZone is free and private. Sharing it helps keep it that way.') + '</p>' +
      '<div class="share-actions">' +
        '<button type="button" class="btn btn-primary sm" data-share>' + t('Share') + '</button>' +
        (installEvent ? '<button type="button" class="btn btn-ghost sm" data-install>' + t('Install app') + '</button>' : '') +
      '</div>';
    document.body.appendChild(box);
    var close = function (snooze) {
      if (snooze) store('cz-share-snooze', String(Date.now() + 30 * 864e5));
      box.remove();
    };
    box.querySelector('.share-close').addEventListener('click', function () { close(true); });
    box.querySelector('[data-share]').addEventListener('click', function () {
      var url = location.origin + location.pathname;
      var data = { title: document.title, text: t('Free, private image & PDF tools — files never leave your device.'), url: url };
      if (navigator.share) navigator.share(data).then(function () { close(true); }, function () { /* cancelled */ });
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () {
        box.querySelector('[data-share]').textContent = t('Link copied ✓');
        setTimeout(function () { close(true); }, 1500);
      });
    });
    var inst = box.querySelector('[data-install]');
    if (inst) inst.addEventListener('click', function () {
      installEvent.prompt();
      installEvent.userChoice.then(function () { installEvent = null; close(true); });
    });
  }
  // Every download on the site is an <a download> click (including generated ZIPs and PDFs).
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[download]');
    if (a && a.href && a.getAttribute('aria-disabled') !== 'true') maybePrompt();
  }, true);

  window.addEventListener('load', function () {
    var idle = window.requestIdleCallback || function (fn) { setTimeout(fn, 1200); };
    idle(initAds, { timeout: 3000 });
    idle(initAnalytics, { timeout: 3000 });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('/sw.js').catch(function () { /* offline support is optional */ });
    }
  });

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
