/* CompressZone — client-side image compressor. Nothing is ever uploaded. */
(function () {
  'use strict';

  /* ============ Configuration ============ */
  var CONFIG = {
    defaultQuality: 80 // industry-standard balance of size vs. quality
  };

  var BASE = new URL('/js/', location.href).href;
  var EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
  var LABEL = { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/avif': 'AVIF' };

  /* ============ DOM ============ */
  var $ = function (s) { return document.querySelector(s); };
  var dropzone = $('#dropzone'), input = $('#file-input');
  var qualityEl = $('#quality'), qualityOut = $('#quality-out'), resizeEl = $('#resize');
  var resultsEl = $('#results'), listEl = $('#file-list'), statsEl = $('#summary-stats');
  var zipBtn = $('#zip-btn'), clearBtn = $('#clear-btn');

  /* ============ State ============ */
  var items = new Map();
  var nextId = 1;
  var support = { webp: true, avif: false, offscreen: typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined' };
  // Landing pages (e.g. /jpg-to-webp) preset the format and size via <body data-format data-maxdim>.
  // There, only the quality is remembered, so a preset never leaks into the home page.
  var preset = document.body.dataset.format ? { format: document.body.dataset.format, maxDim: Number(document.body.dataset.maxdim) || 0 } : null;
  var settings = loadSettings();

  function loadSettings() {
    var s = { format: 'original', quality: CONFIG.defaultQuality, maxDim: 0 };
    try {
      var saved = JSON.parse(localStorage.getItem('pp-settings') || 'null');
      if (saved) Object.assign(s, saved);
    } catch (e) { /* storage unavailable */ }
    if (preset) Object.assign(s, preset);
    return s;
  }
  function saveSettings() {
    try {
      var data = settings;
      if (preset) {
        data = JSON.parse(localStorage.getItem('pp-settings') || '{}') || {};
        data.quality = settings.quality;
      }
      localStorage.setItem('pp-settings', JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  /* ============ Helpers ============ */
  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }
  function origExt(file) { var m = /\.([^.]+)$/.exec(file.name); return m ? m[1] : 'img'; }
  function baseName(name) { return name.replace(/\.[^.]+$/, '') || 'image'; }
  function escapeHtml(s) { return s.replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  // Which encoder output to use for a given input file.
  function outputType(file) {
    if (settings.format !== 'original') return settings.format;
    var t = file.type;
    if (t === 'image/jpeg' || t === 'image/png' || t === 'image/webp') return t;
    if (t === 'image/avif' && support.avif) return t;
    return 'image/webp'; // GIF, BMP, TIFF, SVG, HEIC… → WebP
  }

  /* ============ Feature detection ============ */
  function detectEncoder(type) {
    return new Promise(function (resolve) {
      var c = document.createElement('canvas');
      c.width = c.height = 2;
      if (!c.toBlob) return resolve(false);
      c.toBlob(function (b) { resolve(!!b && b.type === type); }, type, 0.5);
    });
  }
  var detected = Promise.all([detectEncoder('image/webp'), detectEncoder('image/avif')]).then(function (r) {
    support.webp = r[0];
    support.avif = r[1];
    if (support.avif) $('#avif-option').hidden = false;
    else if (settings.format === 'image/avif') settings.format = 'original';
  });

  /* ============ Processing (worker pool + main-thread fallback) ============ */
  var pool = [], queue = [];
  var POOL_SIZE = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));

  function getWorker() {
    for (var i = 0; i < pool.length; i++) if (!pool[i].busy) return pool[i];
    if (pool.length < POOL_SIZE) {
      var w = { worker: new Worker('/js/worker.js'), busy: false, job: null };
      w.worker.onmessage = function (e) { w.busy = false; w.job = null; onResult(e.data); pump(); };
      w.worker.onerror = function (e) {
        // Worker unusable in this browser: fall back to the main thread.
        e.preventDefault();
        support.offscreen = false;
        var item = w.job && items.get(w.job);
        w.busy = false; w.job = null;
        if (item) enqueue(item); else pump();
      };
      pool.push(w);
      return w;
    }
    return null;
  }

  function enqueue(item) {
    item.version++;
    item.status = 'working';
    queue = queue.filter(function (j) { return j.id !== item.id; });
    queue.push({ id: item.id, version: item.version });
    render(item);
    pump();
  }

  function jobOptions(item) {
    var type = outputType(item.file);
    return { type: type, quality: settings.quality, maxDim: settings.maxDim, base: BASE, wasmWebp: type === 'image/webp' && !support.webp };
  }

  var mainBusy = false;
  function pump() {
    while (queue.length) {
      var job = queue[0], item = items.get(job.id);
      if (!item || item.version !== job.version) { queue.shift(); continue; }
      var opts = jobOptions(item);
      // WASM WebP (Safari) and missing OffscreenCanvas go through the main thread.
      var useMain = !support.offscreen || opts.wasmWebp || item.mainOnly;
      if (useMain) {
        if (mainBusy) return;
        queue.shift();
        runOnMain(item, job.version, opts);
        continue;
      }
      var w = getWorker();
      if (!w) return;
      queue.shift();
      w.busy = true;
      w.job = item.id;
      w.worker.postMessage({ id: item.id, version: job.version, file: item.file, opts: opts });
    }
  }

  var encoderReady = null;
  function runOnMain(item, version, opts) {
    mainBusy = true;
    encoderReady = encoderReady || loadScript(BASE + 'encoder.js');
    encoderReady
      .then(function () { return decodeWithImage(item.file); })
      .then(function (img) {
        return self.PPEncoder.encode(img, img.naturalWidth || 1024, img.naturalHeight || 1024, opts).then(function (out) {
          out.srcW = img.naturalWidth; out.srcH = img.naturalHeight;
          return out;
        });
      })
      .then(function (out) {
        onResult({ id: item.id, version: version, blob: out.blob, width: out.width, height: out.height, srcW: out.srcW, srcH: out.srcH });
      }, function (err) {
        onResult({ id: item.id, version: version, error: err && err.message === 'decode' ? 'decode' : 'fail', final: true });
      })
      .then(function () { mainBusy = false; pump(); });
  }

  function decodeWithImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('decode')); };
      img.src = item_url(file);
    });
  }
  var fileUrls = new WeakMap();
  function item_url(file) {
    if (!fileUrls.has(file)) fileUrls.set(file, URL.createObjectURL(file));
    return fileUrls.get(file);
  }

  function onResult(r) {
    var item = items.get(r.id);
    if (!item || item.version !== r.version) return; // stale result
    if (r.error) {
      if (r.error === 'decode' && !r.final && !item.mainOnly) {
        item.mainOnly = true; // retry with <img> decoding on the main thread
        enqueue(item);
        return;
      }
      item.status = 'error';
      item.error = r.error === 'decode' ? "This browser can't read this image format" : 'Could not compress this image';
      render(item); updateSummary();
      return;
    }
    if (item.outUrl) URL.revokeObjectURL(item.outUrl);

    var outType = r.blob.type || jobOptions(item).type;
    var resized = r.width !== r.srcW || r.height !== r.srcH;
    // Never make a file bigger: keep the original if re-encoding didn't help.
    var sameFormat = outType === item.file.type || settings.format === 'original';
    if (!resized && sameFormat && r.blob.size >= item.file.size) {
      item.blob = item.file;
      item.kept = true;
    } else {
      item.blob = r.blob;
      item.kept = false;
    }
    item.outType = item.kept ? item.file.type : outType;
    item.outUrl = URL.createObjectURL(item.blob);
    item.dims = r.width + '×' + r.height;
    item.status = 'done';
    render(item);
    updateSummary();
  }

  /* ============ Adding files ============ */
  function addFiles(fileList) {
    var files = Array.prototype.filter.call(fileList, function (f) {
      return /^image\//.test(f.type) || /\.(heic|heif|avif|jfif|bmp|ico|tiff?)$/i.test(f.name);
    });
    if (!files.length) { toast('Please choose image files'); return; }
    resultsEl.hidden = false;
    dropzone.classList.add('compact');
    detected.then(function () {
      files.forEach(function (file) {
        var item = { id: nextId++, file: file, version: 0, status: 'working' };
        items.set(item.id, item);
        item.el = createRow(item);
        listEl.appendChild(item.el);
        enqueue(item);
      });
      updateSummary();
    });
  }

  /* ============ Rendering ============ */
  var ICON_DL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 20h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_CMP = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3v18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  function createRow(item) {
    var li = document.createElement('li');
    li.className = 'file-item';
    li.innerHTML =
      '<img class="thumb" alt="" loading="lazy" decoding="async">' +
      '<div class="file-meta"><div class="file-name"></div><div class="file-sizes"></div></div>' +
      '<div class="file-actions">' +
        '<button type="button" class="icon-btn" data-act="compare" title="Compare before & after" aria-label="Compare before and after">' + ICON_CMP + '</button>' +
        '<a class="dl-btn" data-act="download">' + ICON_DL + '<span>Download</span></a>' +
        '<button type="button" class="icon-btn" data-act="remove" title="Remove" aria-label="Remove">' + ICON_X + '</button>' +
      '</div>';
    li.querySelector('.file-name').textContent = item.file.name;
    li.querySelector('.file-name').title = item.file.name;
    var thumb = li.querySelector('.thumb');
    thumb.onerror = function () { thumb.onerror = null; thumb.removeAttribute('src'); };
    thumb.src = item_url(item.file);
    li.dataset.id = item.id;
    return li;
  }

  function render(item) {
    var el = item.el;
    if (!el) return;
    var sizes = el.querySelector('.file-sizes');
    var dl = el.querySelector('[data-act="download"]');
    var cmp = el.querySelector('[data-act="compare"]');
    var orig = formatBytes(item.file.size);

    if (item.status === 'working') {
      sizes.innerHTML = '<span>' + orig + '</span><span class="arrow">→</span><span>Compressing…</span><div class="progress"></div>';
      dl.setAttribute('aria-disabled', 'true'); dl.removeAttribute('href');
      cmp.disabled = true;
      return;
    }
    if (item.status === 'error') {
      sizes.innerHTML = '<span>' + orig + '</span><span class="badge error">' + escapeHtml(item.error) + '</span>';
      dl.setAttribute('aria-disabled', 'true'); dl.removeAttribute('href');
      cmp.disabled = true;
      return;
    }

    var saved = 1 - item.blob.size / item.file.size;
    var badge = item.kept
      ? '<span class="badge neutral">Already optimized</span>'
      : saved > 0
        ? '<span class="badge">−' + Math.round(saved * 100) + '%</span>'
        : '<span class="badge neutral">+' + Math.round(-saved * 100) + '%</span>';
    sizes.innerHTML =
      '<span>' + orig + '</span><span class="arrow">→</span>' +
      '<span class="new">' + formatBytes(item.blob.size) + '</span>' + badge +
      '<span>· ' + (LABEL[item.outType] || origExt(item.file).toUpperCase()) + ' · ' + item.dims + '</span>';

    item.outName = item.kept ? item.file.name : baseName(item.file.name) + '.' + EXT[item.outType];
    dl.href = item.outUrl;
    dl.download = item.outName;
    dl.removeAttribute('aria-disabled');
    cmp.disabled = false;
    el.querySelector('.thumb').src = item.outUrl;
  }

  function updateSummary() {
    var total = 0, totalNew = 0, done = 0, count = items.size;
    items.forEach(function (it) {
      if (it.status === 'done') { done++; total += it.file.size; totalNew += it.blob.size; }
    });
    if (!count) { resultsEl.hidden = true; dropzone.classList.remove('compact'); return; }
    var pct = total ? Math.round((1 - totalNew / total) * 100) : 0;
    var html = '<strong>' + count + ' image' + (count > 1 ? 's' : '') + '</strong>';
    if (done) html += ' · ' + formatBytes(total) + ' → <strong>' + formatBytes(totalNew) + '</strong> · <span class="saved">Saved ' + Math.max(0, pct) + '%</span>';
    if (done < count) html += ' · ' + (count - done) + ' in progress';
    statsEl.innerHTML = html;
    zipBtn.disabled = done === 0;
    zipBtn.lastChild.textContent = done > 1 ? ' Download all (ZIP)' : ' Download';
  }

  function removeItem(id) {
    var item = items.get(id);
    if (!item) return;
    if (item.outUrl) URL.revokeObjectURL(item.outUrl);
    if (fileUrls.has(item.file)) URL.revokeObjectURL(fileUrls.get(item.file));
    item.el.remove();
    items.delete(id);
    updateSummary();
  }

  /* ============ Compare dialog ============ */
  var dialog = $('#compare'), stage = $('#compare-stage'), range = $('#cmp-range');
  function openCompare(item) {
    $('#compare-title').textContent = item.file.name;
    $('#cmp-orig').textContent = formatBytes(item.file.size);
    $('#cmp-new').textContent = formatBytes(item.blob.size);
    $('#cmp-img-before').src = item_url(item.file);
    $('#cmp-img-after').src = item.outUrl;
    range.value = 50;
    stage.style.setProperty('--pos', '50%');
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
  }
  range.addEventListener('input', function () { stage.style.setProperty('--pos', range.value + '%'); });
  $('#compare-close').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });

  /* ============ Events ============ */
  input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });
  dropzone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });

  // Drop anywhere on the page.
  var dragDepth = 0;
  document.addEventListener('dragenter', function (e) {
    if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') > -1) { dragDepth++; dropzone.classList.add('is-over'); }
  });
  document.addEventListener('dragleave', function () { if (--dragDepth <= 0) { dragDepth = 0; dropzone.classList.remove('is-over'); } });
  document.addEventListener('dragover', function (e) { e.preventDefault(); });
  document.addEventListener('drop', function (e) {
    e.preventDefault();
    dragDepth = 0; dropzone.classList.remove('is-over');
    if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });
  document.addEventListener('paste', function (e) {
    var files = e.clipboardData && e.clipboardData.files;
    if (files && files.length) { e.preventDefault(); addFiles(files); }
  });

  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var item = items.get(Number(btn.closest('.file-item').dataset.id));
    if (!item) return;
    if (btn.dataset.act === 'remove') removeItem(item.id);
    else if (btn.dataset.act === 'compare' && item.status === 'done') openCompare(item);
  });

  clearBtn.addEventListener('click', function () {
    Array.from(items.keys()).forEach(removeItem);
    queue = [];
  });

  var zipReady = null;
  zipBtn.addEventListener('click', function () {
    var done = Array.from(items.values()).filter(function (it) { return it.status === 'done'; });
    if (done.length === 1) { done[0].el.querySelector('[data-act="download"]').click(); return; }
    zipBtn.disabled = true;
    zipReady = zipReady || loadScript(BASE + 'zip.js');
    var used = {};
    var files = done.map(function (it) {
      var name = it.outName, n = 1;
      while (used[name.toLowerCase()]) name = baseName(it.outName) + '-' + (n++) + '.' + (EXT[it.outType] || origExt(it.file));
      used[name.toLowerCase()] = true;
      return { name: name, blob: it.blob };
    });
    zipReady
      .then(function () { return window.PPZip.createZip(files); })
      .then(function (blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'compresszone-images.zip';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
      })
      .catch(function () { toast('Could not create ZIP file'); })
      .then(function () { zipBtn.disabled = false; });
  });

  /* ============ Settings ============ */
  var recompressAll = debounce(function () {
    items.forEach(function (it) { enqueue(it); });
    updateSummary();
  }, 250);

  function syncPresets() {
    document.querySelectorAll('.presets button').forEach(function (b) {
      b.classList.toggle('active', Number(b.dataset.q) === settings.quality);
    });
    qualityOut.textContent = settings.quality + '%';
    qualityEl.value = settings.quality;
    qualityEl.style.setProperty('--val', settings.quality);
  }
  function applySettingsToUI() {
    var radio = document.querySelector('input[name="format"][value="' + settings.format + '"]');
    if (radio) radio.checked = true;
    resizeEl.value = String(settings.maxDim);
    if (resizeEl.selectedIndex < 0) resizeEl.value = '0';
    syncPresets();
  }
  applySettingsToUI();

  document.querySelectorAll('input[name="format"]').forEach(function (r) {
    r.addEventListener('change', function () { settings.format = r.value; saveSettings(); recompressAll(); });
  });
  qualityEl.addEventListener('input', function () {
    settings.quality = Number(qualityEl.value); syncPresets(); saveSettings(); recompressAll();
  });
  document.querySelectorAll('.presets button').forEach(function (b) {
    b.addEventListener('click', function () { settings.quality = Number(b.dataset.q); syncPresets(); saveSettings(); recompressAll(); });
  });
  resizeEl.addEventListener('change', function () { settings.maxDim = Number(resizeEl.value); saveSettings(); recompressAll(); });
})();
