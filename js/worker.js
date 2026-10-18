/* CompressZone worker: decode → resize → encode, off the main thread. */
importScripts('encoder.js');

self.onmessage = async function (e) {
  var job = e.data;
  var bitmap;
  try {
    bitmap = await createImageBitmap(job.file);
  } catch (err) {
    // e.g. SVG or HEIC in this browser — let the main thread try with <img>.
    self.postMessage({ id: job.id, version: job.version, error: 'decode' });
    return;
  }
  try {
    var out = await self.PPEncoder.encode(bitmap, bitmap.width, bitmap.height, job.opts);
    self.postMessage({ id: job.id, version: job.version, blob: out.blob, width: out.width, height: out.height, srcW: bitmap.width, srcH: bitmap.height });
  } catch (err) {
    self.postMessage({ id: job.id, version: job.version, error: String(err && err.message || err) });
  } finally {
    if (bitmap && bitmap.close) bitmap.close();
  }
};
