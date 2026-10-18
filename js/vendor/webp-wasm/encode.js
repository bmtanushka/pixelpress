/* Adapted from @jsquash/webp 1.4.0 (Apache-2.0). Loaded only on browsers that
   cannot encode WebP natively (e.g. Safari). Non-SIMD build for compatibility. */
import { defaultOptions } from './meta.js';
import { initEmscriptenModule } from './utils.js';
let modulePromise;
export default async function encode(data, options = {}) {
  if (!modulePromise) {
    modulePromise = import('./webp_enc.js').then((m) => initEmscriptenModule(m.default));
  }
  const module = await modulePromise;
  const result = module.encode(data.data, data.width, data.height, { ...defaultOptions, ...options });
  if (!result) throw new Error('Encoding error.');
  return result.buffer;
}
