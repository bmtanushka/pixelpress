/* CompressZone — PDF → JPG/PNG/WebP (pdf.js). Pages are rendered one at a time to keep memory low. */
(function () {
  'use strict';
  var CZ = window.CZ, $ = CZ.$;
  var zone = $('#dropzone'), results = $('#results'), grid = $('#page-grid'), stats = $('#summary-stats');
  var zipBtn = $('#zip-btn');
  var EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  var state = null; // { file, pdf, pages: [{ blob, url }] }
  var run = 0;

  // Preset from landing pages (e.g. /pdf-to-png).
  var preset = document.body.dataset.format;
  if (preset) { var r = document.querySelector('input[name="format"][value="' + preset + '"]'); if (r) r.checked = true; }

  function settings() {
    return {
      type: document.querySelector('input[name="format"]:checked').value,
      scale: Number($('#dpi').value) / 72,
      quality: Number($('#img-quality').value)
    };
  }

  function clear() {
    run++;
    if (state) {
      state.pages.forEach(function (p) { if (p && p.url) URL.revokeObjectURL(p.url); });
      if (state.pdf) state.pdf.destroy();
    }
    state = null;
    grid.innerHTML = '';
    results.hidden = true;
    zone.classList.remove('compact');
  }

  function updateStats(done, total) {
    var size = state.pages.reduce(function (s, p) { return s + (p ? p.blob.size : 0); }, 0);
    stats.innerHTML = '<strong>' + CZ.escapeHtml(state.file.name) + '</strong> · ' + total + ' page' + (total === 1 ? '' : 's') +
      (done < total ? ' · converting ' + (done + 1) + ' of ' + total + '…' : ' · ' + CZ.formatBytes(size));
    zipBtn.disabled = done < total || !total;
    zipBtn.textContent = total > 1 ? 'Download all (ZIP)' : 'Download';
  }

  function convertAll() {
    if (!state) return;
    var my = ++run, opts = settings(), pdf = state.pdf, total = pdf.numPages, base = CZ.baseName(state.file.name);
    state.pages.forEach(function (p) { if (p && p.url) URL.revokeObjectURL(p.url); });
    state.pages = new Array(total);
    grid.innerHTML = '';
    for (var i = 1; i <= total; i++) {
      grid.insertAdjacentHTML('beforeend',
        '<li class="page-card" data-page="' + i + '"><div class="page-thumb is-loading"></div>' +
        '<div class="page-meta"><span class="page-num">' + i + '</span><span class="page-name">Page ' + i + '</span></div>' +
        '<div class="page-btns"><a class="dl-btn sm" aria-disabled="true">Download</a></div></li>');
    }
    updateStats(0, total);
    var chain = Promise.resolve();
    for (var n = 1; n <= total; n++) {
      (function (n) {
        chain = chain.then(function () {
          if (my !== run) return;
          return pdf.getPage(n).then(function (page) {
            return CZ.renderPage(page, opts.scale).then(function (canvas) {
              page.cleanup();
              return CZ.canvasToBlob(canvas, opts.type, opts.quality).then(function (blob) {
                canvas.width = canvas.height = 0;
                if (my !== run) return;
                var ext = EXT[blob.type] || 'png';
                var url = URL.createObjectURL(blob);
                state.pages[n - 1] = { blob: blob, url: url, name: base + '-page-' + n + '.' + ext };
                var card = grid.querySelector('[data-page="' + n + '"]');
                card.querySelector('.page-thumb').classList.remove('is-loading');
                card.querySelector('.page-thumb').innerHTML = '<img src="' + url + '" alt="Page ' + n + '" loading="lazy">';
                card.querySelector('.page-name').textContent = CZ.formatBytes(blob.size);
                var a = card.querySelector('.dl-btn');
                a.href = url; a.download = state.pages[n - 1].name; a.removeAttribute('aria-disabled');
                updateStats(n, total);
              });
            });
          });
        });
      })(n);
    }
    chain.catch(function (e) { console.error(e); CZ.toast('Could not render some pages'); });
  }

  function open(files) {
    clear();
    var file = files[0];
    results.hidden = false;
    zone.classList.add('compact');
    stats.innerHTML = '<strong>' + CZ.escapeHtml(file.name) + '</strong> · opening…';
    file.arrayBuffer().then(function (buf) { return CZ.openPdf(new Uint8Array(buf)); }).then(function (pdf) {
      state = { file: file, pdf: pdf, pages: [] };
      convertAll();
    }).catch(function (e) {
      console.error(e);
      stats.innerHTML = '<span class="badge error">' + (e && e.name === 'PasswordException' ? 'Password required' : "This PDF couldn't be opened") + '</span>';
    });
  }

  ['dpi', 'img-quality'].forEach(function (id) { $('#' + id).addEventListener('change', convertAll); });
  document.querySelectorAll('input[name="format"]').forEach(function (r) { r.addEventListener('change', convertAll); });
  $('#clear-btn').addEventListener('click', clear);
  zipBtn.addEventListener('click', function () {
    if (!state) return;
    var pages = state.pages.filter(Boolean);
    if (pages.length === 1) { CZ.download(pages[0].blob, pages[0].name); return; }
    zipBtn.disabled = true;
    CZ.downloadZip(pages, CZ.baseName(state.file.name) + '-images.zip')
      .catch(function () { CZ.toast('Could not create ZIP file'); })
      .then(function () { zipBtn.disabled = false; });
  });
  CZ.setupDrop({ zone: zone, input: $('#file-input'), accept: CZ.isPdf, onFiles: open, single: true, rejectMessage: 'Please choose a PDF file' });
})();
