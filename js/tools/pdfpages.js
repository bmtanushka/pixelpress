/* CompressZone — page-level PDF tools: organize, rotate, delete pages, split (pdf.js thumbnails + pdf-lib output).
   Mode comes from <body data-mode="organize|rotate|delete|split">. */
(function () {
  'use strict';
  var CZ = window.CZ, $ = CZ.$;
  var MODE = document.body.dataset.mode || 'organize';
  var zone = $('#dropzone'), results = $('#results'), grid = $('#page-grid'), stats = $('#summary-stats');
  var toolbar = $('#toolbar'), actions = $('#page-actions');
  var doc = null; // { file, bytes, pdf, pages: [{ src, rot, deleted, selected, url, baseRot }] }
  var run = 0;

  var I = {
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9a8 8 0 1 1 1.5 7.5M4 4v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 9a8 8 0 1 0-1.5 7.5M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    del: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function btn(act, label, cls) { return '<button type="button" class="btn ' + (cls || 'btn-ghost') + '" data-act="' + act + '">' + label + '</button>'; }

  function setupChrome() {
    var tb = '', ac = '';
    if (MODE === 'split') {
      tb = btn('select-all', 'Select all') + btn('select-none', 'Select none') +
        '<label class="range-field"><span>Pages / ranges</span><input type="text" id="ranges" placeholder="e.g. 1-3, 5, 8-10" autocomplete="off"></label>' +
        btn('apply-range', 'Select these');
      ac = btn('split-all', 'Split every page (ZIP)') + btn('split-ranges', 'Split by ranges (ZIP)') + btn('extract', 'Extract selected', 'btn-primary');
    } else {
      tb = btn('rotate-all-left', I.left + ' Rotate all left') + btn('rotate-all-right', I.right + ' Rotate all right') + btn('reset', 'Reset');
      ac = btn('save', 'Save PDF', 'btn-primary');
    }
    toolbar.innerHTML = tb;
    actions.innerHTML = btn('clear', 'Clear') + ac;
  }

  function clear() {
    run++;
    if (doc) { doc.pages.forEach(function (p) { if (p.url) URL.revokeObjectURL(p.url); }); if (doc.pdf) doc.pdf.destroy(); }
    doc = null; grid.innerHTML = ''; results.hidden = true; zone.classList.remove('compact');
  }

  function kept() { return doc.pages.filter(function (p) { return !p.deleted; }); }

  function updateStats() {
    var total = doc.pages.length, k = kept().length, sel = doc.pages.filter(function (p) { return p.selected; }).length;
    var extra = MODE === 'split' ? ' · <strong>' + sel + '</strong> selected' : (k !== total ? ' · ' + (total - k) + ' removed' : '');
    stats.innerHTML = '<strong>' + CZ.escapeHtml(doc.file.name) + '</strong> · ' + total + ' page' + (total === 1 ? '' : 's') + extra;
    var save = actions.querySelector('[data-act="save"]');
    if (save) save.disabled = !k;
    var ex = actions.querySelector('[data-act="extract"]');
    if (ex) { ex.disabled = !sel; ex.textContent = sel ? 'Extract ' + sel + ' page' + (sel === 1 ? '' : 's') : 'Extract selected'; }
  }

  function card(p, i) {
    var rot = (p.rot % 360 + 360) % 360;
    var cls = 'page-card' + (p.deleted ? ' is-deleted' : '') + (p.selected ? ' is-selected' : '') + (MODE === 'split' ? ' is-selectable' : '');
    var drag = MODE === 'organize' || MODE === 'delete' ? ' draggable="true"' : '';
    var tools = MODE === 'split' ? '' :
      '<button type="button" class="icon-btn sm" data-act="rot-left" aria-label="Rotate left" title="Rotate left">' + I.left + '</button>' +
      '<button type="button" class="icon-btn sm" data-act="rot-right" aria-label="Rotate right" title="Rotate right">' + I.right + '</button>' +
      (MODE === 'rotate' ? '' : '<button type="button" class="icon-btn sm" data-act="toggle-del" aria-label="' + (p.deleted ? 'Restore page' : 'Delete page') + '" title="' + (p.deleted ? 'Restore' : 'Delete') + '">' + (p.deleted ? I.undo : I.del) + '</button>');
    var move = MODE === 'organize' ?
      '<button type="button" class="icon-btn sm" data-act="left" aria-label="Move earlier" title="Move earlier"' + (i === 0 ? ' disabled' : '') + '>‹</button>' +
      '<button type="button" class="icon-btn sm" data-act="right" aria-label="Move later" title="Move later"' + (i === doc.pages.length - 1 ? ' disabled' : '') + '>›</button>' : '';
    var check = MODE === 'split' ? '<input type="checkbox" class="page-check" aria-label="Select page ' + (p.src + 1) + '"' + (p.selected ? ' checked' : '') + '>' : '';
    return '<li class="' + cls + '" data-index="' + i + '"' + drag + '>' + check +
      '<div class="page-thumb' + (p.url ? '' : ' is-loading') + '">' + (p.url ? '<img src="' + p.url + '" alt="Page ' + (p.src + 1) + '" draggable="false" style="transform:rotate(' + rot + 'deg)' + (rot % 180 ? ' scale(.74)' : '') + '">' : '') + '</div>' +
      '<div class="page-meta"><span class="page-num">' + (p.src + 1) + '</span><span class="page-name">' + (p.deleted ? 'Will be removed' : rot ? 'Rotated ' + rot + '°' : '') + '</span></div>' +
      '<div class="page-btns">' + move + tools + '</div></li>';
  }

  function render() {
    grid.innerHTML = doc.pages.map(card).join('');
    updateStats();
  }

  function thumbs() {
    var my = run, chain = Promise.resolve();
    doc.pages.forEach(function (p) {
      chain = chain.then(function () {
        if (my !== run) return;
        return doc.pdf.getPage(p.src + 1).then(function (page) {
          var w = page.getViewport({ scale: 1 }).width;
          return CZ.renderPage(page, Math.min(2, 220 / w)).then(function (c) {
            page.cleanup();
            return CZ.canvasToBlob(c, 'image/jpeg', 0.8);
          });
        }).then(function (b) {
          if (my !== run) return;
          p.url = URL.createObjectURL(b);
          var el = grid.querySelector('[data-index]') && Array.prototype.find.call(grid.children, function (li) { return doc.pages[Number(li.dataset.index)] === p; });
          if (el) el.outerHTML = card(p, Number(el.dataset.index));
        });
      });
    });
    return chain;
  }

  function open(files) {
    clear();
    var file = files[0], my = run;
    results.hidden = false; zone.classList.add('compact');
    setupChrome();
    stats.innerHTML = '<strong>' + CZ.escapeHtml(file.name) + '</strong> · opening…';
    file.arrayBuffer().then(function (buf) {
      var bytes = buf.slice(0); // pdf.js transfers its copy to the worker
      return Promise.all([CZ.openPdf(new Uint8Array(buf)), CZ.loadPdfLib().then(function (L) { return L.PDFDocument.load(bytes, { ignoreEncryption: true }); })])
        .then(function (r) {
          if (my !== run) return;
          var src = r[1];
          if (src.isEncrypted) CZ.toast('This PDF is protected — the saved copy may not open correctly');
          doc = { file: file, bytes: bytes, pdf: r[0], pages: src.getPages().map(function (pg, i) { return { src: i, rot: 0, baseRot: pg.getRotation().angle || 0, deleted: false, selected: false }; }) };
          render();
          return thumbs();
        });
    }).catch(function (e) {
      console.error(e);
      stats.innerHTML = '<span class="badge error">' + (e && e.name === 'PasswordException' ? 'Password required' : "This PDF couldn't be opened") + '</span>';
    });
  }

  // "1-3, 5, 8-" → [[0,1,2],[4],[7,…last]] (0-based, clamped, de-duplicated within a group)
  function parseRanges(text, count) {
    return text.split(/[,;]+/).map(function (part) {
      var m = /^\s*(\d*)\s*(?:[-–]\s*(\d*))?\s*$/.exec(part);
      if (!m || (m[1] === '' && m[2] === undefined)) return null;
      var a = m[1] === '' ? 1 : Number(m[1]);
      var b = m[2] === undefined ? a : (m[2] === '' ? count : Number(m[2]));
      if (a > b) { var t = a; a = b; b = t; }
      a = Math.max(1, a); b = Math.min(count, b);
      var out = [];
      for (var i = a; i <= b; i++) out.push(i - 1);
      return out.length ? out : null;
    }).filter(Boolean);
  }

  function build(pageList) {
    return CZ.loadPdfLib().then(function (L) {
      return Promise.all([L.PDFDocument.load(doc.bytes, { ignoreEncryption: true }), L.PDFDocument.create()]).then(function (r) {
        var src = r[0], out = r[1];
        out.setProducer('CompressZone (compresszone.com)');
        return out.copyPages(src, pageList.map(function (p) { return p.src; })).then(function (copied) {
          copied.forEach(function (pg, i) {
            var p = pageList[i];
            if (p.rot) pg.setRotation(L.degrees(((p.baseRot + p.rot) % 360 + 360) % 360));
            out.addPage(pg);
          });
          return out.save();
        });
      });
    }).then(function (bytes) { return new Blob([bytes], { type: 'application/pdf' }); });
  }

  function busy(el, on, text) {
    if (!el) return;
    if (on) { el.dataset.label = el.innerHTML; el.disabled = true; el.textContent = text || 'Working…'; }
    else { el.innerHTML = el.dataset.label; el.disabled = false; updateStats(); }
  }

  function act(name, el) {
    var base = CZ.baseName(doc.file.name);
    var all = doc.pages;
    switch (name) {
      case 'rotate-all-left': all.forEach(function (p) { p.rot -= 90; }); return render();
      case 'rotate-all-right': all.forEach(function (p) { p.rot += 90; }); return render();
      case 'reset':
        all.sort(function (a, b) { return a.src - b.src; });
        all.forEach(function (p) { p.rot = 0; p.deleted = false; });
        return render();
      case 'select-all': all.forEach(function (p) { p.selected = true; }); return render();
      case 'select-none': all.forEach(function (p) { p.selected = false; }); return render();
      case 'apply-range': {
        var groups = parseRanges($('#ranges').value, all.length);
        if (!groups.length) return CZ.toast('Enter pages like 1-3, 5');
        var set = {};
        groups.forEach(function (g) { g.forEach(function (i) { set[i] = true; }); });
        all.forEach(function (p) { p.selected = !!set[p.src]; });
        return render();
      }
      case 'clear': return clear();
      case 'save': {
        var list = kept();
        if (!list.length) return CZ.toast('All pages were removed');
        busy(el, true, 'Saving…');
        return build(list).then(function (b) { CZ.download(b, base + '-edited.pdf'); })
          .catch(function (e) { console.error(e); CZ.toast('Could not save the PDF'); }).then(function () { busy(el, false); });
      }
      case 'extract': {
        var sel = all.filter(function (p) { return p.selected; });
        busy(el, true, 'Extracting…');
        return build(sel).then(function (b) { CZ.download(b, base + '-pages.pdf'); })
          .catch(function (e) { console.error(e); CZ.toast('Could not create the PDF'); }).then(function () { busy(el, false); });
      }
      case 'split-all':
      case 'split-ranges': {
        var sets;
        if (name === 'split-all') sets = all.map(function (p) { return [p]; });
        else {
          var gs = parseRanges($('#ranges').value, all.length);
          if (!gs.length) { $('#ranges').focus(); return CZ.toast('Enter ranges like 1-3, 4-6 to split by'); }
          sets = gs.map(function (g) { return g.map(function (i) { return all.find(function (p) { return p.src === i; }); }); });
        }
        busy(el, true, 'Splitting…');
        var files = [], chain = Promise.resolve();
        sets.forEach(function (s) {
          chain = chain.then(function () {
            return build(s).then(function (b) {
              var first = s[0].src + 1, last = s[s.length - 1].src + 1;
              files.push({ name: base + '-' + (first === last ? 'page-' + first : 'pages-' + first + '-' + last) + '.pdf', blob: b });
            });
          });
        });
        return chain.then(function () {
          if (files.length === 1) return CZ.download(files[0].blob, files[0].name);
          return CZ.downloadZip(files, base + '-split.zip');
        }).catch(function (e) { console.error(e); CZ.toast('Could not split the PDF'); }).then(function () { busy(el, false); });
      }
    }
  }

  results.addEventListener('click', function (e) {
    if (!doc) return;
    var b = e.target.closest('[data-act]');
    var cardEl = e.target.closest('.page-card');
    if (b && !cardEl) return act(b.dataset.act, b);
    if (!cardEl) return;
    var i = Number(cardEl.dataset.index), p = doc.pages[i];
    if (!b) {
      if (MODE === 'split') { p.selected = !p.selected; render(); }
      return;
    }
    switch (b.dataset.act) {
      case 'rot-left': p.rot -= 90; break;
      case 'rot-right': p.rot += 90; break;
      case 'toggle-del': p.deleted = !p.deleted; break;
      case 'left': CZ.move(doc.pages, i, i - 1); break;
      case 'right': CZ.move(doc.pages, i, i + 1); break;
    }
    render();
  });
  if (MODE === 'organize' || MODE === 'delete') CZ.sortable(grid, function (from, to) { CZ.move(doc.pages, from, to); render(); });
  CZ.setupDrop({ zone: zone, input: $('#file-input'), accept: CZ.isPdf, onFiles: open, single: true, rejectMessage: 'Please choose a PDF file' });
})();
