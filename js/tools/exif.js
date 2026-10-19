/* CompressZone — view and remove photo metadata (EXIF, GPS, XMP, IPTC).
   JPEG, PNG and WebP are cleaned losslessly by dropping metadata segments; other formats are re-encoded.
   Mode: <body data-mode="view|remove">. */
(function () {
  'use strict';
  var CZ = window.CZ, $ = CZ.$;
  var MODE = document.body.dataset.mode === 'remove' ? 'remove' : 'view';
  var list = $('#exif-list'), stats = $('#summary-stats'), zipBtn = $('#zip-btn');
  var items = [], nextId = 1;
  var exifr = null;
  function loadExifr() { exifr = exifr || CZ.loadScript(CZ.BASE + 'vendor/exifr.min.js').then(function () { return window.exifr; }); return exifr; }

  /* ---------- lossless strippers ---------- */
  function ascii(u8, at, s) { for (var i = 0; i < s.length; i++) if (u8[at + i] !== s.charCodeAt(i)) return false; return true; }

  // Minimal EXIF block that only keeps the orientation, so photos don't turn sideways.
  function orientationApp1(o) {
    var b = new Uint8Array(36), v = new DataView(b.buffer);
    b.set([0xFF, 0xE1]); v.setUint16(2, 34);
    b.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4);          // "Exif\0\0"
    b.set([0x4D, 0x4D, 0, 0x2A, 0, 0, 0, 8], 10);      // big-endian TIFF header, IFD0 at 8
    v.setUint16(18, 1);                                 // one entry
    v.setUint16(20, 0x0112); v.setUint16(22, 3); v.setUint32(24, 1); v.setUint16(28, o);
    v.setUint32(32, 0);                                 // no next IFD
    return b;
  }

  function stripJpeg(u8, orientation) {
    if (u8[0] !== 0xFF || u8[1] !== 0xD8) return null;
    var parts = [u8.subarray(0, 2)], removed = {}, i = 2;
    if (orientation > 1) parts.push(orientationApp1(orientation));
    while (i < u8.length) {
      if (u8[i] !== 0xFF) return null;
      var m = u8[i + 1];
      if (m === 0xFF) { i++; continue; }
      if (m === 0xDA || m === 0xD9) { parts.push(u8.subarray(i)); break; }
      if ((m >= 0xD0 && m <= 0xD7) || m === 0x01) { parts.push(u8.subarray(i, i + 2)); i += 2; continue; }
      var len = (u8[i + 2] << 8) | u8[i + 3], seg = u8.subarray(i, i + 2 + len), drop = false;
      if (m === 0xE1) { drop = true; removed[ascii(seg, 4, 'Exif') ? 'EXIF' : 'XMP'] = 1; }
      else if (m === 0xED) { drop = true; removed.IPTC = 1; }
      else if (m === 0xFE) { drop = true; removed.Comment = 1; }
      else if (m === 0xE2 && !ascii(seg, 4, 'ICC_PROFILE')) { drop = true; removed.Extra = 1; }
      else if (m >= 0xE3 && m <= 0xEF && m !== 0xEE) { drop = true; removed.Extra = 1; }
      if (!drop) parts.push(seg);
      i += 2 + len;
    }
    return { blob: new Blob(parts, { type: 'image/jpeg' }), removed: Object.keys(removed) };
  }

  function stripPng(u8) {
    if (!ascii(u8, 1, 'PNG')) return null;
    var parts = [u8.subarray(0, 8)], removed = {}, i = 8, v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var DROP = { tEXt: 'Text', zTXt: 'Text', iTXt: 'XMP/Text', eXIf: 'EXIF', tIME: 'Timestamp' };
    while (i + 8 <= u8.length) {
      var len = v.getUint32(i), type = String.fromCharCode(u8[i + 4], u8[i + 5], u8[i + 6], u8[i + 7]);
      var end = i + 12 + len;
      if (DROP[type]) removed[DROP[type]] = 1; else parts.push(u8.subarray(i, end));
      i = end;
      if (type === 'IEND') break;
    }
    return { blob: new Blob(parts, { type: 'image/png' }), removed: Object.keys(removed) };
  }

  function stripWebp(u8) {
    if (!ascii(u8, 0, 'RIFF') || !ascii(u8, 8, 'WEBP')) return null;
    var chunks = [], removed = {}, i = 12, v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    while (i + 8 <= u8.length) {
      var id = String.fromCharCode(u8[i], u8[i + 1], u8[i + 2], u8[i + 3]), size = v.getUint32(i + 4, true);
      var end = i + 8 + size + (size & 1);
      var chunk = u8.slice(i, Math.min(end, u8.length));
      if (id === 'EXIF') removed.EXIF = 1;
      else if (id === 'XMP ') removed.XMP = 1;
      else {
        if (id === 'VP8X') chunk[8] &= ~0x0C; // clear EXIF + XMP flags
        chunks.push(chunk);
      }
      i = end;
    }
    var total = 4 + chunks.reduce(function (t, c) { return t + c.length; }, 0);
    var head = new Uint8Array(12);
    head.set(u8.subarray(0, 4)); new DataView(head.buffer).setUint32(4, total, true); head.set(u8.subarray(8, 12), 8);
    return { blob: new Blob([head].concat(chunks), { type: 'image/webp' }), removed: Object.keys(removed) };
  }

  function reencode(file) {
    return CZ.decodeImage(file).then(function (d) {
      var c = document.createElement('canvas');
      c.width = d.width; c.height = d.height;
      var x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(d.image, 0, 0);
      return CZ.canvasToBlob(c, 'image/jpeg', 0.95);
    }).then(function (b) { return { blob: b, removed: ['All metadata'], reencoded: true }; });
  }

  function clean(item) {
    return item.file.arrayBuffer().then(function (buf) {
      var u8 = new Uint8Array(buf), r = null;
      if (u8[0] === 0xFF && u8[1] === 0xD8) r = stripJpeg(u8, item.orientation || 1);
      else if (ascii(u8, 1, 'PNG')) r = stripPng(u8);
      else if (ascii(u8, 0, 'RIFF')) r = stripWebp(u8);
      return r || reencode(item.file);
    });
  }

  /* ---------- reading ---------- */
  // Rationals may arrive as numbers or [numerator, denominator].
  function num(v) { return v && typeof v === "object" && v.length === 2 ? (v[1] ? v[0] / v[1] : v[0]) : Number(v); }
  function fmtExposure(t) { t = num(t); return t >= 1 ? t + ' s' : '1/' + Math.round(1 / t) + ' s'; }
  function fmtDate(d) { return d instanceof Date && !isNaN(d) ? d.toLocaleString() : d; }

  function summarize(tags) {
    if (!tags) return [];
    var rows = [];
    var add = function (k, v) { if (v !== undefined && v !== null && v !== '') rows.push([k, v]); };
    add('Camera', [tags.Make, tags.Model].filter(Boolean).join(' '));
    add('Lens', tags.LensModel);
    add('Date taken', fmtDate(tags.DateTimeOriginal || tags.CreateDate));
    add('Exposure', tags.ExposureTime ? fmtExposure(tags.ExposureTime) : undefined);
    add('Aperture', tags.FNumber ? 'f/' + Math.round(num(tags.FNumber) * 10) / 10 : undefined);
    add('ISO', tags.ISO);
    add('Focal length', tags.FocalLength ? Math.round(num(tags.FocalLength)) + ' mm' : undefined);
    add('Flash', tags.Flash);
    add('Dimensions', tags.ExifImageWidth && tags.ExifImageHeight ? tags.ExifImageWidth + ' × ' + tags.ExifImageHeight : undefined);
    add('Software', tags.Software);
    add('Author', tags.Artist || tags.creator);
    add('Copyright', tags.Copyright || tags.rights);
    if (typeof tags.latitude === 'number') add('GPS location', tags.latitude.toFixed(6) + ', ' + tags.longitude.toFixed(6));
    add('Altitude', tags.GPSAltitude ? Math.round(num(tags.GPSAltitude)) + ' m' : undefined);
    return rows;
  }

  function valueText(v) {
    if (v instanceof Date) return fmtDate(v);
    if (v instanceof Uint8Array || (v && v.buffer instanceof ArrayBuffer)) return '(' + v.length + ' bytes of binary data)';
    if (Array.isArray(v)) return v.length > 12 ? '[' + v.slice(0, 12).join(', ') + ', …]' : '[' + v.join(', ') + ']';
    if (v && typeof v === 'object') return JSON.stringify(v).slice(0, 200);
    return String(v);
  }

  function render(item) {
    var el = item.el, t = item.tags, rows = summarize(t);
    var count = t ? Object.keys(t).length : 0;
    var gps = t && typeof t.latitude === 'number';
    var badges = (count ? '<span class="badge neutral">' + count + ' metadata tags</span>' : '<span class="badge">No metadata found</span>') +
      (gps ? ' <span class="badge error">Contains GPS location</span>' : '');
    var cleanInfo = item.cleaned
      ? '<span class="badge">' + (item.cleaned.removed.length ? '✓ Removed: ' + item.cleaned.removed.join(', ') : '✓ Nothing to remove') + '</span> ' +
        CZ.formatBytes(item.file.size) + ' → ' + CZ.formatBytes(item.cleaned.blob.size) + (item.cleaned.reencoded ? ' · re-saved as JPG' : ' · image data untouched')
      : item.cleaning ? 'Removing metadata…' : '';
    var table = rows.length ? '<table class="table kv"><tbody>' + rows.map(function (r) {
      var val = CZ.escapeHtml(String(r[1]));
      if (r[0] === 'GPS location') val += ' · <a href="https://www.google.com/maps?q=' + encodeURIComponent(r[1].replace(/\s/g, '')) + '" target="_blank" rel="noopener noreferrer">Open map</a>';
      return '<tr><th scope="row">' + r[0] + '</th><td>' + val + '</td></tr>';
    }).join('') + '</tbody></table>' : '';
    var all = count ? '<details class="all-tags"><summary>All ' + count + ' tags</summary><table class="table kv"><tbody>' +
      Object.keys(t).sort().map(function (k) { return '<tr><th scope="row">' + CZ.escapeHtml(k) + '</th><td>' + CZ.escapeHtml(valueText(t[k])) + '</td></tr>'; }).join('') +
      '</tbody></table></details>' : '';
    el.innerHTML =
      '<div class="exif-head"><img class="thumb" alt="" src="' + (item.thumb || '') + '">' +
      '<div class="file-meta"><div class="file-name" title="' + CZ.escapeHtml(item.file.name) + '">' + CZ.escapeHtml(item.file.name) + '</div>' +
      '<div class="file-sizes">' + (item.loading ? 'Reading metadata…' : badges) + '</div>' +
      (cleanInfo ? '<div class="file-sizes">' + cleanInfo + '</div>' : '') + '</div>' +
      '<div class="file-actions">' + (item.cleaned
        ? '<a class="dl-btn" href="' + item.url + '" download="' + CZ.escapeHtml(item.outName) + '">Download clean copy</a>'
        : '<button type="button" class="btn btn-primary sm" data-act="clean"' + (item.cleaning ? ' disabled' : '') + '>Remove metadata</button>') +
      '<button type="button" class="icon-btn" data-act="remove" aria-label="Remove from list" title="Remove">✕</button></div></div>' +
      (MODE === 'view' && !item.loading ? '<div class="exif-body">' + table + all + '</div>' : '');
  }

  function updateStats() {
    var n = items.length, gps = items.filter(function (i) { return i.tags && typeof i.tags.latitude === 'number'; }).length;
    var cleaned = items.filter(function (i) { return i.cleaned; }).length;
    stats.innerHTML = '<strong>' + n + ' photo' + (n === 1 ? '' : 's') + '</strong>' + (gps ? ' · <span class="badge error">' + gps + ' with GPS location</span>' : '') +
      (cleaned ? ' · ' + cleaned + ' cleaned' : '');
    zipBtn.disabled = !n;
    zipBtn.textContent = cleaned === n && n ? (n > 1 ? 'Download all (ZIP)' : 'Download clean copy') : (n > 1 ? 'Remove metadata from all' : 'Remove metadata');
    $('#results').hidden = !n;
    $('#dropzone').classList.toggle('compact', n > 0);
  }

  function doClean(item) {
    if (item.cleaned) return Promise.resolve(item);
    item.cleaning = true; render(item);
    return clean(item).then(function (r) {
      item.cleaned = r;
      item.url = URL.createObjectURL(r.blob);
      var ext = r.reencoded ? 'jpg' : (/\.([^.]+)$/.exec(item.file.name) || [0, 'jpg'])[1];
      item.outName = CZ.baseName(item.file.name) + '-clean.' + ext;
    }).catch(function (e) { console.error(e); CZ.toast('Could not clean ' + item.file.name); })
      .then(function () { item.cleaning = false; render(item); updateStats(); return item; });
  }

  function add(files) {
    loadExifr().then(function (ex) {
      files.forEach(function (file) {
        var item = { id: nextId++, file: file, loading: true };
        item.el = document.createElement('li');
        item.el.className = 'exif-card';
        item.el.dataset.id = item.id;
        items.push(item);
        list.appendChild(item.el);
        render(item);
        var thumb = CZ.decodeImage(file).then(function (d) {
          var c = document.createElement('canvas'), k = Math.min(1, 160 / Math.max(d.width, d.height));
          c.width = Math.max(1, Math.round(d.width * k)); c.height = Math.max(1, Math.round(d.height * k));
          c.getContext('2d').drawImage(d.image, 0, 0, c.width, c.height);
          item.thumb = c.toDataURL('image/jpeg', 0.8);
        }).catch(function () { /* no preview */ });
        var tags = ex.parse(file, { tiff: true, ifd0: true, exif: true, gps: true, xmp: true, iptc: true, icc: false, jfif: false, ihdr: false, interop: false, ifd1: false, translateValues: true, reviveValues: true, mergeOutput: true })
          .catch(function () { return null; });
        var orient = ex.orientation(file).catch(function () { return 1; });
        Promise.all([tags, orient, thumb]).then(function (r) {
          item.tags = r[0] || null;
          item.orientation = r[1] || 1;
          item.loading = false;
          render(item); updateStats();
          if (MODE === 'remove') doClean(item);
        });
      });
      updateStats();
    }).catch(function () { CZ.toast('Could not load the metadata reader'); });
  }

  list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var id = Number(b.closest('.exif-card').dataset.id), item = items.find(function (i) { return i.id === id; });
    if (!item) return;
    if (b.dataset.act === 'clean') doClean(item);
    if (b.dataset.act === 'remove') {
      if (item.url) URL.revokeObjectURL(item.url);
      item.el.remove(); items = items.filter(function (i) { return i !== item; }); updateStats();
    }
  });
  zipBtn.addEventListener('click', function () {
    zipBtn.disabled = true;
    Promise.all(items.map(doClean)).then(function () {
      var done = items.filter(function (i) { return i.cleaned; });
      if (!done.length) return;
      if (done.length === 1) return CZ.download(done[0].cleaned.blob, done[0].outName);
      return CZ.downloadZip(done.map(function (i) { return { name: i.outName, blob: i.cleaned.blob }; }), 'photos-no-metadata.zip');
    }).catch(function () { CZ.toast('Could not create ZIP file'); }).then(function () { zipBtn.disabled = false; updateStats(); });
  });
  $('#clear-btn').addEventListener('click', function () {
    items.forEach(function (i) { if (i.url) URL.revokeObjectURL(i.url); });
    items = []; list.innerHTML = ''; updateStats();
  });
  CZ.setupDrop({ zone: $('#dropzone'), input: $('#file-input'), accept: CZ.isImage, onFiles: add, rejectMessage: 'Please choose photos' });
})();
