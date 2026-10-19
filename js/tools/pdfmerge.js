/* CompressZone — merge PDFs (pdf-lib). Files are combined in the order shown. */
(function () {
  'use strict';
  var CZ = window.CZ, $ = CZ.$;
  var zone = $('#dropzone'), results = $('#results'), list = $('#file-list'), stats = $('#summary-stats');
  var mergeBtn = $('#merge-btn');
  var items = []; // { file, bytes, pages, error }

  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l5 5v13H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3v5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';

  function render() {
    results.hidden = !items.length;
    zone.classList.toggle('compact', items.length > 0);
    var ok = items.filter(function (it) { return it.pages > 0; });
    var pages = ok.reduce(function (s, it) { return s + it.pages; }, 0);
    var size = items.reduce(function (s, it) { return s + it.file.size; }, 0);
    stats.innerHTML = '<strong>' + items.length + ' PDF' + (items.length === 1 ? '' : 's') + '</strong> · ' + pages + ' pages · ' + CZ.formatBytes(size);
    mergeBtn.disabled = ok.length < 2;
    list.innerHTML = items.map(function (it, i) {
      var meta = it.error ? '<span class="badge error">' + CZ.escapeHtml(it.error) + '</span>'
        : it.pages ? it.pages + ' page' + (it.pages === 1 ? '' : 's') + ' · ' + CZ.formatBytes(it.file.size) : 'Reading…';
      return '<li class="file-item" draggable="true" data-index="' + i + '">' +
        '<span class="thumb file-icon">' + ICON + '</span>' +
        '<div class="file-meta"><div class="file-name" title="' + CZ.escapeHtml(it.file.name) + '">' + (i + 1) + '. ' + CZ.escapeHtml(it.file.name) + '</div><div class="file-sizes">' + meta + '</div></div>' +
        '<div class="file-actions">' +
          '<button type="button" class="icon-btn" data-act="up" aria-label="Move up" title="Move up"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" class="icon-btn" data-act="down" aria-label="Move down" title="Move down"' + (i === items.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button type="button" class="icon-btn" data-act="remove" aria-label="Remove" title="Remove">✕</button>' +
        '</div></li>';
    }).join('');
  }

  function add(files) {
    CZ.loadPdfLib().then(function (PDFLib) {
      files.forEach(function (file) {
        var it = { file: file, pages: 0 };
        items.push(it);
        file.arrayBuffer().then(function (buf) {
          it.bytes = buf;
          return PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
        }).then(function (doc) {
          if (doc.isEncrypted) it.error = 'Password-protected — unlock it first';
          else it.pages = doc.getPageCount();
        }).catch(function () { it.error = "Couldn't read this PDF"; }).then(render);
      });
      render();
    });
  }

  function merge() {
    var label = mergeBtn.textContent;
    mergeBtn.disabled = true; mergeBtn.textContent = 'Merging…';
    CZ.loadPdfLib().then(function (PDFLib) {
      return PDFLib.PDFDocument.create().then(function (out) {
        out.setProducer('CompressZone (compresszone.com)');
        var chain = Promise.resolve();
        items.filter(function (it) { return it.pages > 0; }).forEach(function (it) {
          chain = chain.then(function () {
            return PDFLib.PDFDocument.load(it.bytes, { ignoreEncryption: true }).then(function (src) {
              return out.copyPages(src, src.getPageIndices());
            }).then(function (pages) { pages.forEach(function (p) { out.addPage(p); }); });
          });
        });
        return chain.then(function () { return out.save(); });
      });
    }).then(function (bytes) {
      CZ.download(new Blob([bytes], { type: 'application/pdf' }), 'merged.pdf');
      CZ.toast('Merged PDF ready · ' + CZ.formatBytes(bytes.length));
    }).catch(function (e) { console.error(e); CZ.toast('Could not merge these PDFs'); })
      .then(function () { mergeBtn.textContent = label; render(); });
  }

  list.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var i = Number(btn.closest('[data-index]').dataset.index);
    if (btn.dataset.act === 'up') CZ.move(items, i, i - 1);
    else if (btn.dataset.act === 'down') CZ.move(items, i, i + 1);
    else items.splice(i, 1);
    render();
  });
  CZ.sortable(list, function (from, to) { CZ.move(items, from, to); render(); });
  $('#clear-btn').addEventListener('click', function () { items = []; render(); });
  mergeBtn.addEventListener('click', merge);
  CZ.setupDrop({ zone: zone, input: $('#file-input'), accept: CZ.isPdf, onFiles: add, rejectMessage: 'Please choose PDF files' });
})();
