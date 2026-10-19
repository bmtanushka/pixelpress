/* CompressZone — image ⇄ Base64 / data URI, fully local. */
(function () {
  'use strict';
  var CZ = window.CZ, $ = CZ.$;
  var MODE = document.body.dataset.mode === 'decode' ? 'decode' : 'encode';
  var EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp', 'image/x-icon': 'ico', 'image/avif': 'avif' };

  function showTab(which) {
    ['encode', 'decode'].forEach(function (k) {
      $('#tab-' + k).setAttribute('aria-selected', String(k === which));
      $('#panel-' + k).hidden = k !== which;
    });
  }
  $('#tab-encode').addEventListener('click', function () { showTab('encode'); });
  $('#tab-decode').addEventListener('click', function () { showTab('decode'); });
  showTab(MODE);

  function readDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function output(label, value, rows) {
    var id = 'out-' + label.toLowerCase().replace(/[^a-z]+/g, '-');
    return '<div class="b64-out"><div class="b64-out-head"><label for="' + id + '">' + label + '</label>' +
      '<button type="button" class="btn btn-ghost sm" data-copy="' + id + '">Copy</button></div>' +
      '<textarea id="' + id + '" class="code-area" rows="' + rows + '" readonly spellcheck="false">' + CZ.escapeHtml(value) + '</textarea></div>';
  }

  function encode(files) {
    var file = files[0];
    readDataUrl(file).then(function (uri) {
      var type = file.type || 'image/png';
      if (!/^data:[^;,]+;/.test(uri)) uri = uri.replace(/^data:[^,]*,/, 'data:' + type + ';base64,');
      var raw = uri.slice(uri.indexOf(',') + 1);
      $('#enc-preview').src = uri;
      $('#enc-name').textContent = file.name;
      $('#enc-info').textContent = CZ.formatBytes(file.size) + ' → ' + CZ.formatBytes(raw.length) + ' as Base64 (+' + Math.round((raw.length / file.size - 1) * 100) + '%)' +
        (file.size > 100 * 1024 ? ' · Tip: Base64 works best for images under ~10 KB.' : '');
      var name = CZ.escapeHtml(CZ.baseName(file.name)).replace(/"/g, '');
      $('#enc-outputs').innerHTML =
        output('Data URI', uri, 4) +
        output('Base64 only', raw, 4) +
        output('HTML img tag', '<img src="' + uri + '" alt="' + name + '">', 3) +
        output('CSS background', 'background-image: url("' + uri + '");', 3);
      $('#encode-result').hidden = false;
      $('#dropzone').classList.add('compact');
    }).catch(function () { CZ.toast('Could not read this file'); });
  }

  $('#enc-outputs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (!b) return;
    var ta = document.getElementById(b.dataset.copy);
    var done = function () { b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, function () { ta.select(); document.execCommand('copy'); done(); });
    else { ta.select(); document.execCommand('copy'); done(); }
  });

  // Identify the image type from its first bytes.
  function sniff(bytes) {
    var h = Array.prototype.map.call(bytes.slice(0, 12), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    if (h.indexOf('89504e47') === 0) return 'image/png';
    if (h.indexOf('ffd8ff') === 0) return 'image/jpeg';
    if (h.indexOf('47494638') === 0) return 'image/gif';
    if (h.indexOf('52494646') === 0 && h.slice(16, 24) === '57454250') return 'image/webp';
    if (h.indexOf('424d') === 0) return 'image/bmp';
    if (h.indexOf('00000100') === 0) return 'image/x-icon';
    if (h.slice(8, 16) === '66747970') return 'image/avif';
    var text = String.fromCharCode.apply(null, bytes.slice(0, 200));
    if (/<svg|<\?xml/i.test(text)) return 'image/svg+xml';
    return null;
  }

  var decodedUrl = null;
  function decode() {
    var text = $('#b64-input').value.trim();
    if (!text) return CZ.toast('Paste a Base64 string first');
    var m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/i.exec(text);
    var declared = m && m[1];
    var b64 = (m ? m[3] : text).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    var bytes;
    try {
      if (m && !m[2]) bytes = new TextEncoder().encode(decodeURIComponent(b64)); // URL-encoded (e.g. SVG) data URI
      else {
        while (b64.length % 4) b64 += '=';
        var bin = atob(b64);
        bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      }
    } catch (e) { return CZ.toast('That doesn’t look like valid Base64'); }
    var type = sniff(bytes) || declared;
    if (!type || !/^image\//.test(type)) return CZ.toast('Decoded data isn’t a recognised image');
    if (decodedUrl) URL.revokeObjectURL(decodedUrl);
    var blob = new Blob([bytes], { type: type });
    decodedUrl = URL.createObjectURL(blob);
    var img = $('#dec-preview');
    img.onload = function () { $('#dec-info').textContent = img.naturalWidth + ' × ' + img.naturalHeight + ' px · ' + CZ.formatBytes(blob.size); };
    img.onerror = function () { $('#dec-info').textContent = CZ.formatBytes(blob.size) + ' · preview not supported in this browser'; };
    img.src = decodedUrl;
    $('#dec-type').textContent = (EXT[type] || 'image').toUpperCase() + ' image';
    var a = $('#dec-download');
    a.href = decodedUrl; a.download = 'image.' + (EXT[type] || 'img');
    $('#decode-result').hidden = false;
  }
  $('#b64-decode').addEventListener('click', decode);
  $('#b64-clear').addEventListener('click', function () { $('#b64-input').value = ''; $('#decode-result').hidden = true; });

  CZ.setupDrop({ zone: $('#dropzone'), input: $('#file-input'), accept: CZ.isImage, onFiles: function (f) { showTab('encode'); encode(f); }, single: true, rejectMessage: 'Please choose an image' });
})();
