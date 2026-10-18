/* CompressZone encoder — shared by the Web Worker and the main-thread fallback.
   Exposes self.PPEncoder = { encode(source, srcW, srcH, opts) -> Promise<Blob> } */
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

  // Fit inside maxDim (longest side), never upscale.
  function targetSize(w, h, maxDim) {
    if (!maxDim || (w <= maxDim && h <= maxDim)) return { w: w, h: h };
    var r = Math.min(maxDim / w, maxDim / h);
    return { w: Math.max(1, Math.round(w * r)), h: Math.max(1, Math.round(h * r)) };
  }

  // Draw with progressive halving for sharper large downscales.
  function drawScaled(source, sw, sh, tw, th, fillWhite) {
    var cur = source, cw = sw, ch = sh;
    while (cw / 2 >= tw && ch / 2 >= th) {
      var nw = Math.round(cw / 2), nh = Math.round(ch / 2);
      var step = makeCanvas(nw, nh);
      var sctx = step.getContext('2d');
      sctx.imageSmoothingQuality = 'high';
      sctx.drawImage(cur, 0, 0, nw, nh);
      cur = step; cw = nw; ch = nh;
    }
    var canvas = makeCanvas(tw, th);
    var ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (fillWhite) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, tw, th); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, tw, th);
    return canvas;
  }

  // Quality (10–100) → PNG palette size. >=95 means lossless.
  function pngColors(q) {
    if (q >= 95) return 0;
    return Math.max(16, Math.min(256, Math.round(256 * Math.pow(q / 94, 1.6))));
  }

  /**
   * opts: { type, quality (10-100), maxDim, base, wasmWebp (bool) }
   */
  function encode(source, srcW, srcH, opts) {
    var size = targetSize(srcW, srcH, opts.maxDim);
    var canvas = drawScaled(source, srcW, srcH, size.w, size.h, opts.type === 'image/jpeg');
    var q = opts.quality / 100;

    if (opts.type === 'image/png') {
      var data = canvas.getContext('2d').getImageData(0, 0, size.w, size.h).data;
      return loadUPNG(opts.base).then(function (UPNG) {
        var png = UPNG.encode([data.buffer], size.w, size.h, pngColors(opts.quality));
        return { blob: new Blob([png], { type: 'image/png' }), width: size.w, height: size.h };
      });
    }

    if (opts.type === 'image/webp' && opts.wasmWebp) {
      var img = canvas.getContext('2d').getImageData(0, 0, size.w, size.h);
      return import(opts.base + 'vendor/webp-wasm/encode.js').then(function (m) {
        return m.default(img, { quality: opts.quality });
      }).then(function (buf) {
        return { blob: new Blob([buf], { type: 'image/webp' }), width: size.w, height: size.h };
      });
    }

    return canvasToBlob(canvas, opts.type, q).then(function (blob) {
      return { blob: blob, width: size.w, height: size.h };
    });
  }

  g.PPEncoder = { encode: encode };
})(self);
