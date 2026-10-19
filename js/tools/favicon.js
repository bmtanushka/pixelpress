/* CompressZone — favicon generator: PNG sizes, multi-size favicon.ico, Apple/Android icons and a manifest. */
(function () {
  'use strict';
  var CZ = window.CZ, $ = CZ.$;
  var SIZES = [16, 32, 48, 180, 192, 512];
  var src = null; // { file, image, width, height, svgText }

  function opts() {
    var bg = document.querySelector('input[name="bg"]:checked').value;
    $('#bg-color').hidden = bg !== 'custom';
    return { bg: bg === 'custom' ? $('#bg-color').value : bg, pad: Number($('#padding').value), shape: $('#shape').value };
  }

  // Draw the source cover-cropped into a square of `size`, with padding, background and shape.
  function draw(size, o, forceBg) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    var r = o.shape === 'circle' ? size / 2 : o.shape === 'rounded' ? size * 0.22 : 0;
    if (r) {
      x.beginPath();
      if (x.roundRect) x.roundRect(0, 0, size, size, r);
      else x.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      x.clip();
    }
    var bg = o.bg === 'transparent' ? forceBg : o.bg;
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, size, size); }
    var inner = size * (1 - o.pad * 2), off = (size - inner) / 2;
    var s = Math.min(src.width, src.height); // centre square crop
    x.drawImage(src.image, (src.width - s) / 2, (src.height - s) / 2, s, s, off, off, inner, inner);
    return c;
  }

  function ico(pngs) { // pngs: [{ size, bytes: Uint8Array }]
    var head = 6 + 16 * pngs.length, total = head + pngs.reduce(function (t, p) { return t + p.bytes.length; }, 0);
    var buf = new Uint8Array(total), v = new DataView(buf.buffer), off = head;
    v.setUint16(2, 1, true); v.setUint16(4, pngs.length, true);
    pngs.forEach(function (p, i) {
      var e = 6 + i * 16;
      v.setUint8(e, p.size >= 256 ? 0 : p.size); v.setUint8(e + 1, p.size >= 256 ? 0 : p.size);
      v.setUint16(e + 4, 1, true); v.setUint16(e + 6, 32, true);
      v.setUint32(e + 8, p.bytes.length, true); v.setUint32(e + 12, off, true);
      buf.set(p.bytes, off); off += p.bytes.length;
    });
    return new Blob([buf], { type: 'image/x-icon' });
  }

  var SNIPPET = function (svg) {
    return (svg ? '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n' : '') +
      '<link rel="icon" href="/favicon.ico" sizes="any">\n' +
      '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">\n' +
      '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">\n' +
      '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n' +
      '<link rel="manifest" href="/site.webmanifest">';
  };

  function preview() {
    if (!src) return;
    var o = opts();
    $('#previews').innerHTML = '';
    SIZES.forEach(function (size) {
      var c = draw(size, o, size === 180 ? '#ffffff' : null);
      var shown = Math.max(size, 32) > 128 ? 96 : Math.max(size, 32);
      c.style.width = c.style.height = shown + 'px';
      var cell = document.createElement('figure');
      cell.className = 'fav-cell';
      cell.appendChild(c);
      cell.insertAdjacentHTML('beforeend', '<figcaption>' + size + '×' + size + (size === 180 ? ' · Apple' : size >= 192 ? ' · Android' : '') + '</figcaption>');
      $('#previews').appendChild(cell);
    });
    $('#summary-stats').innerHTML = '<strong>' + CZ.escapeHtml(src.file.name) + '</strong> · ' + src.width + ' × ' + src.height + ' px' +
      (Math.min(src.width, src.height) < 512 ? ' · <span class="badge neutral">Tip: use 512 px or larger for sharp icons</span>' : '');
    $('#snippet').value = SNIPPET(!!src.svgText);
  }

  function build() {
    var o = opts(), files = [], pngs = {};
    var jobs = SIZES.map(function (size) {
      return CZ.canvasToBlob(draw(size, o, size === 180 ? (o.bg === 'transparent' ? '#ffffff' : null) : null), 'image/png').then(function (b) { pngs[size] = b; });
    });
    return Promise.all(jobs).then(function () {
      return Promise.all([16, 32, 48].map(function (s) { return pngs[s].arrayBuffer().then(function (a) { return { size: s, bytes: new Uint8Array(a) }; }); }));
    }).then(function (icoParts) {
      files.push({ name: 'favicon.ico', blob: ico(icoParts) });
      files.push({ name: 'favicon-16x16.png', blob: pngs[16] });
      files.push({ name: 'favicon-32x32.png', blob: pngs[32] });
      files.push({ name: 'apple-touch-icon.png', blob: pngs[180] });
      files.push({ name: 'android-chrome-192x192.png', blob: pngs[192] });
      files.push({ name: 'android-chrome-512x512.png', blob: pngs[512] });
      if (src.svgText) files.push({ name: 'favicon.svg', blob: new Blob([src.svgText], { type: 'image/svg+xml' }) });
      var manifest = {
        name: '', short_name: '',
        icons: [
          { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
        ],
        theme_color: o.bg === 'transparent' ? '#ffffff' : o.bg,
        background_color: o.bg === 'transparent' ? '#ffffff' : o.bg,
        display: 'standalone'
      };
      files.push({ name: 'site.webmanifest', blob: new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/manifest+json' }) });
      files.push({ name: 'README.txt', blob: new Blob(['Upload these files to the root of your website, then add to your <head>:\n\n' + SNIPPET(!!src.svgText) + '\n\nMade with CompressZone — https://compresszone.com/favicon-generator\n'], { type: 'text/plain' }) });
      return CZ.downloadZip(files, 'favicon-package.zip');
    });
  }

  function load(files) {
    var file = files[0];
    var svg = /svg/i.test(file.type) || /\.svg$/i.test(file.name);
    (svg ? file.text() : Promise.resolve(null)).then(function (text) {
      return CZ.decodeImage(file).then(function (d) {
        src = { file: file, image: d.image, width: d.width, height: d.height, svgText: text };
        $('#results').hidden = false;
        $('#dropzone').classList.add('compact');
        preview();
      });
    }).catch(function () { CZ.toast("This browser can't read that image"); });
  }

  document.querySelectorAll('input[name="bg"]').forEach(function (r) { r.addEventListener('change', preview); });
  ['bg-color', 'padding', 'shape'].forEach(function (id) { $('#' + id).addEventListener('input', preview); });
  $('#zip-btn').addEventListener('click', function () {
    var b = $('#zip-btn');
    b.disabled = true;
    build().catch(function (e) { console.error(e); CZ.toast('Could not create the favicon package'); }).then(function () { b.disabled = false; });
  });
  $('#copy-snippet').addEventListener('click', function () {
    var b = this;
    (navigator.clipboard ? navigator.clipboard.writeText($('#snippet').value) : Promise.reject()).catch(function () { $('#snippet').select(); document.execCommand('copy'); })
      .then(function () { b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); });
  });
  CZ.setupDrop({ zone: $('#dropzone'), input: $('#file-input'), accept: CZ.isImage, onFiles: load, single: true, rejectMessage: 'Please choose an image' });
})();
