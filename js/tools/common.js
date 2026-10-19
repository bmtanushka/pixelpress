/* CompressZone — helpers shared by the image and PDF tools. Everything stays on the device. */
(function (g) {
  'use strict';

  var BASE = new URL('/js/', location.href).href;
  var scripts = {};

  function $(s, root) { return (root || document).querySelector(s); }
  function $$(s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }
  function baseName(name) { return (name || 'file').replace(/\.[^.]+$/, '') || 'file'; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function loadScript(src) {
    if (!scripts[src]) {
      scripts[src] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src; s.onload = resolve; s.onerror = function () { delete scripts[src]; reject(new Error('Could not load ' + src)); };
        document.head.appendChild(s);
      });
    }
    return scripts[src];
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }

  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 15000);
  }

  // files: [{ name, blob }]. Duplicate names get -1, -2… suffixes.
  function downloadZip(files, zipName) {
    var used = {};
    var list = files.map(function (f) {
      var name = f.name, n = 1, m = /^(.*?)(\.[^.]*)?$/.exec(f.name);
      while (used[name.toLowerCase()]) name = m[1] + '-' + (n++) + (m[2] || '');
      used[name.toLowerCase()] = true;
      return { name: name, blob: f.blob };
    });
    return loadScript(BASE + 'zip.js')
      .then(function () { return g.PPZip.createZip(list); })
      .then(function (zip) { download(zip, zipName); });
  }

  // Wire a dropzone + hidden file input, page-wide drag & drop and paste.
  // accept(file) → bool filters files; onFiles(files) receives the accepted ones.
  function setupDrop(opts) {
    var zone = opts.zone, input = opts.input, depth = 0;
    var handle = function (list) {
      var files = Array.prototype.filter.call(list || [], opts.accept);
      if (!files.length) { toast(opts.rejectMessage || (window.czT ? window.czT('Please choose a supported file') : 'Please choose a supported file')); return; }
      opts.onFiles(opts.single ? files.slice(0, 1) : files);
    };
    input.addEventListener('change', function () { handle(input.files); input.value = ''; });
    zone.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    document.addEventListener('dragenter', function (e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') > -1) { depth++; zone.classList.add('is-over'); }
    });
    document.addEventListener('dragleave', function () { if (--depth <= 0) { depth = 0; zone.classList.remove('is-over'); } });
    document.addEventListener('dragover', function (e) { e.preventDefault(); });
    document.addEventListener('drop', function (e) {
      if (e.target.closest && e.target.closest('[data-sortable]')) return; // reordering, not a file drop
      e.preventDefault();
      depth = 0; zone.classList.remove('is-over');
      if (e.dataTransfer && e.dataTransfer.files.length) handle(e.dataTransfer.files);
    });
    if (opts.paste !== false) {
      document.addEventListener('paste', function (e) {
        if (e.target.closest && e.target.closest('textarea, input')) return;
        var files = e.clipboardData && e.clipboardData.files;
        if (files && files.length) { e.preventDefault(); handle(files); }
      });
    }
  }

  var isImage = function (f) { return /^image\//.test(f.type) || /\.(heic|heif|avif|jfif|bmp|ico|tiff?|svg)$/i.test(f.name); };
  var isPdf = function (f) { return f.type === 'application/pdf' || /\.pdf$/i.test(f.name); };
  var isHeic = function (f) { return /hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name); };

  // Decode any supported image to something drawable: ImageBitmap where possible,
  // <img> for SVG, and libheif (lazy) for HEIC outside Safari. Resolves { image, width, height }.
  function decodeImage(file) {
    var viaImg = function (blob) {
      return new Promise(function (resolve, reject) {
        var img = new Image(), url = URL.createObjectURL(blob);
        img.onload = function () { resolve({ image: img, width: img.naturalWidth || 1024, height: img.naturalHeight || 1024, url: url }); };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
        img.src = url;
      });
    };
    var native = (typeof createImageBitmap === 'function' && !/svg/i.test(file.type))
      ? createImageBitmap(file).then(function (b) { return { image: b, width: b.width, height: b.height }; }).catch(function () { return viaImg(file); })
      : viaImg(file);
    return native.catch(function (err) {
      if (!isHeic(file)) throw err;
      return loadScript(BASE + 'vendor/heic2any.min.js')
        .then(function () { return g.heic2any({ blob: file, toType: 'image/png' }); })
        .then(function (r) { return viaImg(Array.isArray(r) ? r[0] : r); });
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('Encoding failed')); }, type, quality);
    });
  }

  var pdfLib = null, pdfJs = null;
  function loadPdfLib() {
    pdfLib = pdfLib || loadScript(BASE + 'vendor/pdf-lib.min.js').then(function () { return g.PDFLib; });
    return pdfLib;
  }
  function loadPdfJs() {
    pdfJs = pdfJs || import(BASE + 'vendor/pdfjs/pdf.min.mjs').then(function (m) {
      m.GlobalWorkerOptions.workerSrc = BASE + 'vendor/pdfjs/pdf.worker.min.mjs';
      return m;
    });
    return pdfJs;
  }
  // Open a PDF for rendering. Asks for a password when the file is protected.
  function openPdf(data) {
    return loadPdfJs().then(function (pdfjs) {
      var task = pdfjs.getDocument({
        data: data,
        cMapUrl: BASE + 'vendor/pdfjs/cmaps/', cMapPacked: true,
        standardFontDataUrl: BASE + 'vendor/pdfjs/standard_fonts/',
        wasmUrl: BASE + 'vendor/pdfjs/wasm/'
      });
      task.onPassword = function (update, reason) {
        var pw = g.prompt(reason === 2 ? 'Incorrect password. Try again:' : 'This PDF is password-protected. Enter the password:');
        if (pw === null) task.destroy(); else update(pw);
      };
      return task.promise;
    });
  }
  // Render one pdf.js page to a canvas at `scale` (1 = 72 DPI).
  function renderPage(page, scale, background) {
    var vp = page.getViewport({ scale: scale });
    var canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(vp.width));
    canvas.height = Math.max(1, Math.floor(vp.height));
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = background || '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () { return canvas; });
  }

  // Move an element of `arr` from index i to j (in place) — used by sortable lists.
  function move(arr, i, j) {
    if (j < 0 || j >= arr.length || i === j) return false;
    arr.splice(j, 0, arr.splice(i, 1)[0]);
    return true;
  }

  // Minimal drag-to-reorder for a container whose children carry data-index.
  function sortable(container, onMove) {
    var from = null;
    container.setAttribute('data-sortable', '');
    container.addEventListener('dragstart', function (e) {
      var el = e.target.closest('[data-index]');
      if (!el) return;
      from = Number(el.dataset.index);
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(from)); } catch (err) { /* ignore */ }
    });
    container.addEventListener('dragend', function (e) {
      var el = e.target.closest('[data-index]');
      if (el) el.classList.remove('dragging');
      $$('.drop-target', container).forEach(function (n) { n.classList.remove('drop-target'); });
    });
    container.addEventListener('dragover', function (e) {
      if (from === null) return;
      e.preventDefault();
      var el = e.target.closest('[data-index]');
      $$('.drop-target', container).forEach(function (n) { if (n !== el) n.classList.remove('drop-target'); });
      if (el) el.classList.add('drop-target');
    });
    container.addEventListener('drop', function (e) {
      if (from === null) return;
      e.preventDefault();
      var el = e.target.closest('[data-index]');
      var to = el ? Number(el.dataset.index) : null;
      var f = from; from = null;
      if (to !== null && to !== f) onMove(f, to);
    });
  }

  g.CZ = {
    BASE: BASE, $: $, $$: $$, formatBytes: formatBytes, baseName: baseName, escapeHtml: escapeHtml,
    loadScript: loadScript, toast: toast, download: download, downloadZip: downloadZip, setupDrop: setupDrop,
    isImage: isImage, isPdf: isPdf, isHeic: isHeic, decodeImage: decodeImage, canvasToBlob: canvasToBlob,
    loadPdfLib: loadPdfLib, loadPdfJs: loadPdfJs, openPdf: openPdf, renderPage: renderPage,
    move: move, sortable: sortable
  };
})(window);
