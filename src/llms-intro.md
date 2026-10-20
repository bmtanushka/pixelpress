# CompressZone

> CompressZone (https://compresszone.com) is a free collection of image and PDF tools that run entirely in the web browser. It compresses, resizes, converts and edits images (JPG, PNG, WebP, HEIC, AVIF, GIF, BMP, SVG) and merges, splits, rotates and converts PDFs. Files are never uploaded to a server.

Operated by Webulex Technologies. Contact: hmlakmi@gmail.com (https://compresszone.com/contact).

Key facts:

- Price: free. No account, sign-up, watermark or usage limits.
- Privacy: all processing happens locally on the user's device (Web Workers, WebAssembly, pdf-lib and Mozilla PDF.js). Files are never uploaded, stored or seen by the site.
- Image compression: the default quality is 80%, adjustable from 10% to 100%. Typical savings are 50–80%. If re-encoding would make a file bigger, the original is kept.
- Target file size: an image can be compressed to under an exact size in KB (e.g. 20 KB, 50 KB, 100 KB, 200 KB). The tool searches for the highest quality that fits and reduces the dimensions only if necessary.
- Resize: by maximum dimension, or to exact pixel dimensions with crop-to-fill or fit-with-padding. Presets include passport photos (600×600 px for 2×2 in, 413×531 px for 35×45 mm), Instagram (1080×1080, 1080×1350, 1080×1920), YouTube thumbnails (1280×720) and more.
- HEIC (iPhone) photos open in every modern browser, not only Safari, using a built-in libheif decoder.
- PNG compression uses color quantization and keeps transparency. A quality of 95% or higher gives lossless PNG.
- Metadata: the EXIF viewer shows camera, settings, date and GPS location. The EXIF remover strips EXIF, GPS, XMP and IPTC losslessly from JPG, PNG and WebP (the image data is not re-compressed) and keeps the orientation.
- PDF tools: JPG/PNG/HEIC to PDF (A4, Letter, Legal or image size), PDF to JPG/PNG/WebP at 72–300 DPI, merge, split (selected pages, ranges or every page), rotate, reorder and delete pages. Pages are copied without quality loss. Password-protected PDFs can be opened for conversion to images.
- Other tools: crop, rotate and flip images; image to Base64 and Base64 to image; favicon generator (favicon.ico, Apple and Android icons, web manifest).
- Works offline after the first visit and can be installed as an app (PWA). Works in Chrome, Edge, Firefox and Safari on desktop and mobile.
- Limits: no file size or count limits other than device memory. Animated GIFs are converted using the first frame only.
