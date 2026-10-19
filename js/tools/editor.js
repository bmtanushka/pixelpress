/* CompressZone — crop, rotate and flip one image. All drawing happens on a local canvas. */
(function () {
  'use strict';
  var CZ = window.CZ, $ = CZ.$;
  var zone = $('#dropzone'), editor = $('#editor'), stage = $('#stage'), wrap = $('#canvas-wrap');
  var canvas = $('#ed-canvas'), ctx = canvas.getContext('2d'), box = $('#crop-box'), sizeEl = $('#crop-size');
  var MIN = 16;

  var st = null; // { file, img, iw, ih, rot (quarter turns), fh, fv, crop {x,y,w,h} in output px, ratio, scale }

  function dims() { return st.rot % 2 ? { w: st.ih, h: st.iw } : { w: st.iw, h: st.ih }; }

  // Draw the rotated/flipped image into ctx at `scale`, with the full transformed image at (0,0).
  function drawTransformed(c, scale) {
    var d = dims();
    c.save();
    c.translate(d.w * scale / 2, d.h * scale / 2);
    c.scale(st.fh ? -1 : 1, st.fv ? -1 : 1);
    c.rotate(st.rot * Math.PI / 2);
    c.imageSmoothingQuality = 'high';
    c.drawImage(st.img, -st.iw * scale / 2, -st.ih * scale / 2, st.iw * scale, st.ih * scale);
    c.restore();
  }

  function layout() {
    if (!st) return;
    var d = dims();
    var maxW = stage.clientWidth - 2, maxH = Math.max(240, Math.min(window.innerHeight * 0.62, 640));
    st.scale = Math.min(maxW / d.w, maxH / d.h, 1);
    var cw = Math.max(1, Math.round(d.w * st.scale)), ch = Math.max(1, Math.round(d.h * st.scale));
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    wrap.style.width = cw + 'px'; wrap.style.height = ch + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTransformed(ctx, st.scale * dpr);
    positionBox();
  }

  function positionBox() {
    var c = st.crop, s = st.scale;
    box.style.left = c.x * s + 'px'; box.style.top = c.y * s + 'px';
    box.style.width = c.w * s + 'px'; box.style.height = c.h * s + 'px';
    sizeEl.textContent = Math.round(c.w) + ' × ' + Math.round(c.h) + ' px';
  }

  // Largest centred crop with the given ratio (w/h), or the full image.
  function fitRatio(r) {
    var d = dims();
    if (!r) return { x: 0, y: 0, w: d.w, h: d.h };
    var w = d.w, h = w / r;
    if (h > d.h) { h = d.h; w = h * r; }
    return { x: (d.w - w) / 2, y: (d.h - h) / 2, w: w, h: h };
  }

  function setRatio(key) {
    $$('#ratios button').forEach(function (b) { b.classList.toggle('active', b.dataset.r === key); });
    var d = dims();
    st.ratioKey = key;
    st.ratio = key === 'free' ? null : key === 'orig' ? d.w / d.h : Number(key);
    st.crop = fitRatio(st.ratio);
    positionBox();
  }
  function $$(s) { return CZ.$$(s); }

  function load(files) {
    var file = files[0];
    CZ.decodeImage(file).then(function (d) {
      st = { file: file, img: d.image, iw: d.width, ih: d.height, rot: 0, fh: false, fv: false, ratio: null, ratioKey: 'free' };
      zone.classList.add('compact');
      editor.hidden = false;
      st.crop = fitRatio(null);
      setRatio('free');
      layout();
    }).catch(function () { CZ.toast("This browser can't read that image"); });
  }

  function transform(t) {
    var odd = st.fh !== st.fv; // a single flip mirrors the rotation direction
    if (t === 'rotl') st.rot = (st.rot + (odd ? 1 : 3)) % 4;
    if (t === 'rotr') st.rot = (st.rot + (odd ? 3 : 1)) % 4;
    if (t === 'fliph') st.fh = !st.fh;
    if (t === 'flipv') st.fv = !st.fv;
    if (t === 'rotl' || t === 'rotr') {
      if (st.ratioKey === 'orig') st.ratio = dims().w / dims().h;
      st.crop = fitRatio(st.ratio);
    } else {
      var d = dims(), c = st.crop; // mirror the crop with the image
      if (t === 'fliph') c.x = d.w - c.x - c.w;
      if (t === 'flipv') c.y = d.h - c.y - c.h;
    }
    layout();
  }

  // Pointer interaction: move the box, or resize from a handle (keeping the ratio if one is set).
  var drag = null;
  box.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    box.setPointerCapture(e.pointerId);
    drag = { h: e.target.dataset.h || 'move', x: e.clientX, y: e.clientY, c: Object.assign({}, st.crop) };
  });
  box.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var d = dims(), dx = (e.clientX - drag.x) / st.scale, dy = (e.clientY - drag.y) / st.scale, o = drag.c;
    var c = { x: o.x, y: o.y, w: o.w, h: o.h };
    if (drag.h === 'move') {
      c.x = Math.min(Math.max(0, o.x + dx), d.w - o.w);
      c.y = Math.min(Math.max(0, o.y + dy), d.h - o.h);
    } else {
      var h = drag.h, left = o.x, top = o.y, right = o.x + o.w, bottom = o.y + o.h;
      if (h.indexOf('w') > -1) left = Math.min(Math.max(0, o.x + dx), right - MIN);
      if (h.indexOf('e') > -1) right = Math.max(Math.min(d.w, right + dx), left + MIN);
      if (h.indexOf('n') > -1) top = Math.min(Math.max(0, o.y + dy), bottom - MIN);
      if (h.indexOf('s') > -1) bottom = Math.max(Math.min(d.h, bottom + dy), top + MIN);
      c = { x: left, y: top, w: right - left, h: bottom - top };
      if (st.ratio) {
        var r = st.ratio;
        var byWidth = h === 'e' || h === 'w' || (h.length === 2 && Math.abs(dx) >= Math.abs(dy));
        if (byWidth) c.h = c.w / r; else c.w = c.h * r;
        // keep the anchored (opposite) edges fixed, then clamp to the image
        if (h.indexOf('n') > -1) c.y = bottom - c.h;
        if (h.indexOf('w') > -1) c.x = right - c.w;
        if (h === 'e' || h === 'w') c.y = o.y + (o.h - c.h) / 2;
        if (h === 'n' || h === 's') c.x = o.x + (o.w - c.w) / 2;
        var k = Math.min(1, (c.x < 0 ? (c.w + c.x) / c.w : 1), (c.y < 0 ? (c.h + c.y) / c.h : 1),
          (c.x + c.w > d.w ? (d.w - Math.max(0, c.x)) / c.w : 1), (c.y + c.h > d.h ? (d.h - Math.max(0, c.y)) / c.h : 1));
        if (k < 1) {
          var nw = c.w * k, nh = c.h * k;
          if (h.indexOf('w') > -1) c.x = right - nw;
          if (h.indexOf('n') > -1) c.y = bottom - nh;
          c.w = nw; c.h = nh;
        }
        c.x = Math.min(Math.max(0, c.x), d.w - c.w);
        c.y = Math.min(Math.max(0, c.y), d.h - c.h);
      }
    }
    st.crop = c;
    positionBox();
  });
  var end = function () { drag = null; };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
  box.addEventListener('keydown', function (e) {
    var step = (e.shiftKey ? 10 : 1) / st.scale, d = dims(), c = st.crop;
    var mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!mv) return;
    e.preventDefault();
    c.x = Math.min(Math.max(0, c.x + mv[0]), d.w - c.w);
    c.y = Math.min(Math.max(0, c.y + mv[1]), d.h - c.h);
    positionBox();
  });

  function save() {
    var c = st.crop;
    var x = Math.round(c.x), y = Math.round(c.y), w = Math.max(1, Math.round(c.w)), h = Math.max(1, Math.round(c.h));
    var fmt = $('#out-format').value;
    if (fmt === 'same') fmt = /^image\/(jpeg|png|webp)$/.test(st.file.type) ? st.file.type : 'image/png';
    var out = document.createElement('canvas');
    out.width = w; out.height = h;
    var o = out.getContext('2d');
    if (fmt === 'image/jpeg') { o.fillStyle = '#fff'; o.fillRect(0, 0, w, h); }
    o.translate(-x, -y);
    drawTransformed(o, 1);
    CZ.canvasToBlob(out, fmt, Number($('#out-quality').value)).then(function (blob) {
      var ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[blob.type] || 'png';
      if (blob.type !== fmt) CZ.toast('This browser can’t save ' + fmt.split('/')[1].toUpperCase() + ' — saved as ' + ext.toUpperCase());
      CZ.download(blob, CZ.baseName(st.file.name) + '-edited.' + ext);
    }).catch(function () { CZ.toast('Could not save the image'); });
  }

  $('#ratios').addEventListener('click', function (e) { var b = e.target.closest('[data-r]'); if (b && st) setRatio(b.dataset.r); });
  editor.addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (b && st) transform(b.dataset.t); });
  $('#reset-btn').addEventListener('click', function () { st.rot = 0; st.fh = st.fv = false; setRatio('free'); layout(); });
  $('#new-btn').addEventListener('click', function () { $('#file-input').click(); });
  $('#save-btn').addEventListener('click', save);
  window.addEventListener('resize', function () { if (st) layout(); });
  CZ.setupDrop({ zone: zone, input: $('#file-input'), accept: CZ.isImage, onFiles: load, single: true, rejectMessage: 'Please choose an image' });
})();
