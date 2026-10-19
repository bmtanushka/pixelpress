# CompressZone

> CompressZone (https://compresszone.com) is a free online image compressor and converter that runs entirely in the web browser. It reduces the file size of JPG, PNG, WebP, GIF, BMP, AVIF and SVG images and converts them to WebP, JPG, PNG or AVIF. Images are never uploaded to a server.

Key facts:

- Price: free. No account, sign-up or watermark.
- Privacy: all processing happens locally on the user's device (Web Workers, WebAssembly). Images are never uploaded, stored or seen by the site.
- Default quality: 80%, adjustable from 10% to 100%. Presets are Smallest (60%), Balanced (80%) and High quality (92%).
- Typical savings: 50–80% smaller files at the default setting.
- PNG compression uses color quantization and keeps transparency. A quality of 95% or higher gives lossless PNG.
- Optional resize to a maximum dimension (3840, 2560, 1920, 1280 or 800 px), keeping the aspect ratio and never upscaling.
- Batch processing with a "Download all" ZIP, plus a before/after comparison slider.
- Never makes files bigger: if re-encoding would increase the size, the original is kept.
- Removes EXIF and GPS metadata. Works offline after the first visit and can be installed as an app (PWA).
- Works in Chrome, Edge, Firefox and Safari on desktop and mobile.
- Limits: no file size or count limits other than device memory. Animated GIFs are converted using the first frame only. HEIC input works only in Safari.
