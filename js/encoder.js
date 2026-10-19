/* CompressZone encoder — shared by the Web Worker and the main-thread fallback.
   Exposes self.PPEncoder = { encode(source, srcW, srcH, opts) -> Promise<{ blob, width, height }> } */
(function (g) {
  'use strict';

  var IS_WORKER = typeof document === 'undefined';
  var upngPromise = null;

  function loadUPNG(base) {
    if (g.UPNG) return Promise.resolve(g.UPNG);
    if (upngPromise) return upngPromise;
    upngPromise = new Promise(function (resolve, reject) {
      if (IS_WORKER) {
        g.window = g; // UPNG attaches itself to `window`
        importScripts(base + 'vendor/upng-bundle.js');
        resolve(g.UPNG);
      } else {
        var s = document.createElement('script');
        s.src = base + 'vendor/upng-bundle.js';
        s.onload = function () { resolve(g.UPNG); };
        s.onerror = reject;
        document.head.appendChild(s);
      }
    });
    return upngPromise;
  }

  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function canvasToBlob(canvas, type, quality) {
    if (canvas.convertToBlob) return canvas.convertToBlob({ type: type, quality: quality });
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('Encoding failed')); }, type, quality);
    });
  }

  // Work out the canvas size and where the (possibly cropped) source lands on it.
  //   exact.fit 'cover'   → fill w×h exactly, cropping the overflow (passport photos, thumbnails)
  //   exact.fit 'contain' → fit inside w×h and pad the rest (white for JPG, transparent otherwise)
  //   otherwise           → fit inside maxDim, never upscale
  function layout(srcW, srcH, opts) {
    var full = { sx: 0, sy: 0, sw: srcW, sh: srcH };
    var ex = opts.exact;
    if (ex && ex.w > 0 && ex.h > 0) {
      if (ex.fit === 'contain') {
        var r = Math.min(ex.w / srcW, ex.h / srcH);
        var dw = Math.max(1, Math.round(srcW * r)), dh = Math.max(1, Math.round(srcH * r));
        return { cw: ex.w, ch: ex.h, src: full, dx: Math.round((ex.w - dw) / 2), dy: Math.round((ex.h - dh) / 2), dw: dw, dh: dh };
      }
      var target = ex.w / ex.h, sw = srcW, sh = srcH;
      if (srcW / srcH > target) sw = Math.round(srcH * target); else sh = Math.round(srcW / target);
      return { cw: ex.w, ch: ex.h, src: { sx: Math.round((srcW - sw) / 2), sy: Math.round((srcH - sh) / 2), sw: sw, sh: sh }, dx: 0, dy: 0, dw: ex.w, dh: ex.h };
    }
    var w = srcW, h = srcH, m = opts.maxDim;
    if (m && (w > m || h > m)) {
      var k = Math.min(m / w, m / h);
      w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
    }
    return { cw: w, ch: h, src: full, dx: 0, dy: 0, dw: w, dh: h };
  }

  // Scale a layout down by factor k (used when a target size can't be reached by quality alone).
  function shrink(l, k) {
    var s = function (v) { return Math.max(1, Math.round(v * k)); };
    return { cw: s(l.cw), ch: s(l.ch), src: l.src, dx: Math.round(l.dx * k), dy: Math.round(l.dy * k), dw: s(l.dw), dh: s(l.dh) };
  }

  // Draw with progressive halving for sharper large downscales.
  function render(source, l, fillWhite) {
    var cur = source, r = l.src;
    var sx = r.sx, sy = r.sy, sw = r.sw, sh = r.sh;
    while (sw / 2 >= l.dw && sh / 2 >= l.dh) {
      var nw = Math.round(sw / 2), nh = Math.round(sh / 2);
      var step = makeCanvas(nw, nh);
      var sctx = step.getContext('2d');
      sctx.imageSmoothingQuality = 'high';
      sctx.drawImage(cur, sx, sy, sw, sh, 0, 0, nw, nh);
      cur = step; sx = 0; sy = 0; sw = nw; sh = nh;
    }
    var canvas = makeCanvas(l.cw, l.ch);
    var ctx = canvas.getContext('2d');
    if (fillWhite) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, l.cw, l.ch); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, sx, sy, sw, sh, l.dx, l.dy, l.dw, l.dh);
    return canvas;
  }

  // Quality (10–100) → PNG palette size. >=95 means lossless.
  function pngColors(q) {
    if (q >= 95) return 0;
    return Math.max(16, Math.min(256, Math.round(256 * Math.pow(q / 94, 1.6))));
  }

  // Encode one canvas. For PNG, `q` is a palette size (0 = lossless); otherwise 0–1 quality.
  function encodeCanvas(canvas, type, q, opts) {
    var w = canvas.width, h = canvas.height;
    if (type === 'image/png') {
      var data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
      return loadUPNG(opts.base).then(function (UPNG) {
        return new Blob([UPNG.encode([data.buffer], w, h, q)], { type: 'image/png' });
      });
    }
    if (type === 'image/webp' && opts.wasmWebp) {
      var img = canvas.getContext('2d').getImageData(0, 0, w, h);
      return import(opts.base + 'vendor/webp-wasm/encode.js').then(function (m) {
        return m.default(img, { quality: Math.round(q * 100) });
      }).then(function (buf) { return new Blob([buf], { type: 'image/webp' }); });
    }
    return canvasToBlob(canvas, type, q);
  }

  // Highest quality whose output fits in `target` bytes; null if even the lowest doesn't fit.
  function searchQuality(canvas, type, target, opts) {
    if (type === 'image/png') {
      var palettes = [0, 256, 128, 64, 32, 16, 8];
      var i = 0;
      var next = function () {
        if (i >= palettes.length) return Promise.resolve(null);
        var c = palettes[i++];
        return encodeCanvas(canvas, type, c, opts).then(function (b) { return b.size <= target ? b : next(); });
      };
      return next();
    }
    var lo = 0.04, hi = 0.95, best = null, n = 0;
    var step = function () {
      if (n++ >= 7) return best ? Promise.resolve(best) : encodeCanvas(canvas, type, 0.04, opts).then(function (b) { return b.size <= target ? b : null; });
      var mid = (lo + hi) / 2;
      return encodeCanvas(canvas, type, mid, opts).then(function (b) {
        if (b.size <= target) { best = b; lo = mid; } else hi = mid;
        return step();
      });
    };
    // Fast path: the requested quality may already fit.
    return encodeCanvas(canvas, type, hi, opts).then(function (b) { return b.size <= target ? b : step(); });
  }

  /**
   * opts: { type, quality (10-100), maxDim, exact: {w, h, fit}, targetBytes, base, wasmWebp }
   * → Promise<{ blob, width, height, reachedTarget? }>
   */
  function encode(source, srcW, srcH, opts) {
    var l = layout(srcW, srcH, opts);
    var white = opts.type === 'image/jpeg';
    var done = function (blob, lay, extra) {
      var r = { blob: blob, width: lay.cw, height: lay.ch };
      if (extra) for (var k in extra) r[k] = extra[k];
      return r;
    };

    if (opts.targetBytes > 0) {
      var round = 0;
      var attempt = function (lay) {
        var canvas = render(source, lay, white);
        return searchQuality(canvas, opts.type, opts.targetBytes, opts).then(function (blob) {
          if (blob) return done(blob, lay, { reachedTarget: true });
          if (++round > 6 || lay.cw * lay.ch < 64 * 64) {
            return encodeCanvas(canvas, opts.type, opts.type === 'image/png' ? 8 : 0.04, opts).then(function (b) { return done(b, lay, { reachedTarget: false }); });
          }
          return attempt(shrink(lay, 0.8)); // too big even at minimum quality: reduce dimensions
        });
      };
      return attempt(l);
    }

    var canvas = render(source, l, white);
    var q = opts.type === 'image/png' ? pngColors(opts.quality) : opts.quality / 100;
    return encodeCanvas(canvas, opts.type, q, opts).then(function (blob) { return done(blob, l); });
  }

  g.PPEncoder = { encode: encode };
})(self);
