/* CompressZone — images → PDF (pdf-lib). Images are drawn to a canvas, re-encoded as JPEG and placed one per page. */
(function () {
  'use strict';
  var CZ = window.CZ, $ = CZ.$;
  var zone = $('#dropzone'), results = $('#results'), grid = $('#page-grid'), stats = $('#summary-stats');
  var makeBtn = $('#make-btn');
  var items = []; // { file, url, width, height }

  var SIZES = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008] };
  var QUALITY = { high: { q: 0.92, max: 3508 }, balanced: { q: 0.82, max: 2480 }, small: { q: 0.7, max: 1600 } };

  function render() {
    results.hidden = !items.length;
    zone.classList.toggle('compact', items.length > 0);
    makeBtn.disabled = !items.length;
    var total = items.reduce(function (s, it) { return s + it.file.size; }, 0);
    stats.innerHTML = '<strong>' + items.length + ' image' + (items.length === 1 ? '' : 's') + '</strong> · ' + CZ.formatBytes(total) +
      ' · <span class="muted">Drag thumbnails to reorder</span>';
    grid.innerHTML = items.map(function (it, i) {
      return '<li class="page-card" draggable="true" data-index="' + i + '">' +
        '<div class="page-thumb"><img src="' + it.url + '" alt="" draggable="false"></div>' +
        '<div class="page-meta"><span class="page-num">' + (i + 1) + '</span><span class="page-name" title="' + CZ.escapeHtml(it.file.name) + '">' + CZ.escapeHtml(it.file.name) + '</span></div>' +
        '<div class="page-btns">' +
          '<button type="button" class="icon-btn sm" data-act="left" aria-label="Move earlier" title="Move earlier"' + (i === 0 ? ' disabled' : '') + '>‹</button>' +
          '<button type="button" class="icon-btn sm" data-act="right" aria-label="Move later" title="Move later"' + (i === items.length - 1 ? ' disabled' : '') + '>›</button>' +
          '<button type="button" class="icon-btn sm" data-act="remove" aria-label="Remove" title="Remove">✕</button>' +
        '</div></li>';
    }).join('');
  }

  function add(files) {
    var jobs = files.map(function (file) {
      return CZ.decodeImage(file).then(function (d) {
        // Thumbnail from the decoded image so HEIC/BMP previews work everywhere.
        var c = document.createElement('canvas'), k = Math.min(1, 320 / Math.max(d.width, d.height));
        c.width = Math.max(1, Math.round(d.width * k)); c.height = Math.max(1, Math.round(d.height * k));
        c.getContext('2d').drawImage(d.image, 0, 0, c.width, c.height);
        return CZ.canvasToBlob(c, 'image/jpeg', 0.8).then(function (b) {
          return { file: file, decoded: d, url: URL.createObjectURL(b), width: d.width, height: d.height };
        });
      }).catch(function () { CZ.toast("Couldn't read " + file.name); return null; });
    });
    Promise.all(jobs).then(function (list) {
      list.forEach(function (it) { if (it) items.push(it); });
      render();
    });
  }

  function makePdf() {
    makeBtn.disabled = true;
    var label = makeBtn.textContent;
    makeBtn.textContent = 'Creating…';
    var size = $('#page-size').value, orient = $('#orientation').value, margin = Number($('#margin').value);
    var qual = QUALITY[$('#img-quality').value];
    CZ.loadPdfLib().then(function (PDFLib) {
      return PDFLib.PDFDocument.create().then(function (doc) {
        doc.setProducer('CompressZone (compresszone.com)');
        doc.setCreator('CompressZone');
        var chain = Promise.resolve();
        items.forEach(function (it) {
          chain = chain.then(function () {
            var k = Math.min(1, qual.max / Math.max(it.width, it.height));
            var c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(it.width * k)); c.height = Math.max(1, Math.round(it.height * k));
            var ctx = c.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(it.decoded.image, 0, 0, c.width, c.height);
            return CZ.canvasToBlob(c, 'image/jpeg', qual.q).then(function (b) { return b.arrayBuffer(); }).then(function (buf) {
              return doc.embedJpg(buf);
            }).then(function (img) {
              var landscape = it.width > it.height;
              var pw, ph;
              if (size === 'fit') { pw = it.width * 0.75 + margin * 2; ph = it.height * 0.75 + margin * 2; } // 96 DPI → points
              else {
                pw = SIZES[size][0]; ph = SIZES[size][1];
                var wantLandscape = orient === 'landscape' || (orient === 'auto' && landscape);
                if (wantLandscape) { var t = pw; pw = ph; ph = t; }
              }
              var page = doc.addPage([pw, ph]);
              var aw = pw - margin * 2, ah = ph - margin * 2;
              var s = Math.min(aw / it.width, ah / it.height);
              var w = it.width * s, h = it.height * s;
              page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
            });
          });
        });
        return chain.then(function () { return doc.save(); });
      });
    }).then(function (bytes) {
      var name = items.length === 1 ? CZ.baseName(items[0].file.name) + '.pdf' : 'images.pdf';
      CZ.download(new Blob([bytes], { type: 'application/pdf' }), name);
      CZ.toast('PDF created · ' + CZ.formatBytes(bytes.length));
    }).catch(function (e) {
      console.error(e);
      CZ.toast('Could not create the PDF');
    }).then(function () { makeBtn.disabled = !items.length; makeBtn.textContent = label; });
  }

  grid.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var i = Number(btn.closest('[data-index]').dataset.index);
    if (btn.dataset.act === 'left') CZ.move(items, i, i - 1);
    else if (btn.dataset.act === 'right') CZ.move(items, i, i + 1);
    else if (btn.dataset.act === 'remove') { URL.revokeObjectURL(items[i].url); items.splice(i, 1); }
    render();
  });
  CZ.sortable(grid, function (from, to) { CZ.move(items, from, to); render(); });
  $('#clear-btn').addEventListener('click', function () { items.forEach(function (it) { URL.revokeObjectURL(it.url); }); items = []; render(); });
  makeBtn.addEventListener('click', makePdf);
  CZ.setupDrop({ zone: zone, input: $('#file-input'), accept: CZ.isImage, onFiles: add, rejectMessage: 'Please choose image files' });
})();
