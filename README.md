# PixelPress — private, in-browser image compressor

A fast static web app that compresses JPG, PNG, WebP, GIF, BMP, AVIF and SVG images and converts them to WebP. All processing happens in the visitor's browser: images are never uploaded.

- **No build step, no framework.** Plain HTML, CSS and JS. The first load is about 15 KB gzipped, and the encoders load only when needed.
- **Default quality is 80%**, the standard balance. Presets are 60 / 80 / 92, plus a free slider.
- **Output formats:** Same as input, WebP, JPG, PNG, and AVIF where the browser supports it.
- **Optional resize** to a maximum dimension.
- **Never bigger:** if a re-encode would grow the file, the original is kept.
- **Batch processing** on a Web Worker pool, with "Download all" as a ZIP.
- **Before/after slider** to compare quality.
- **Works offline** through a service worker, and can be installed as a PWA.
- **Light and dark mode**, responsive and keyboard accessible.

## Run locally

```bash
cd pixelpress
npx http-server -p 8080 -c-1 .     # or: python3 -m http.server 8080
```
Open http://localhost:8080. A web server is required because Web Workers don't run from `file://`.

## Deploy to Railway (from GitHub)

The repo includes a `Dockerfile` and `Caddyfile`, so Railway serves the site with Caddy, which gives gzip/zstd compression, cache headers and security headers. `railway.json` tells Railway to build from that Dockerfile.

1. In Railway, click **New Project → Deploy from GitHub repo** and pick this repository. The first time, Railway asks you to install its GitHub app and give it access to the repo.
2. Railway builds and deploys automatically. Every push to `main` redeploys.
3. Open the service → **Settings → Networking → Generate Domain** for a free `*.up.railway.app` URL, or click **Custom Domain** to add your own.

You can also upload the folder to any other static host, such as Netlify, Vercel, Cloudflare Pages or GitHub Pages. HTTPS is required for the service worker.

Then replace `https://www.example.com/` with your domain in `index.html` (the canonical and og:url tags), `robots.txt` and `sitemap.xml`. Also update the contact email in `privacy.html`.

## Set up Google AdSense

1. Sign up at https://adsense.google.com and add your site.
2. Replace `ca-pub-XXXXXXXXXXXXXXXX` with your publisher ID in:
   - `index.html`: the `google-adsense-account` meta tag
   - `js/app.js`: `CONFIG.adsense.client`
   - `ads.txt`: use `pub-…`, without the `ca-` prefix
3. Create two **Display → Responsive** ad units and put their slot IDs in `CONFIG.adsense.slots` (`top`, `middle`).
4. **EU, EEA, UK and Switzerland visitors:** Google requires a certified consent banner (CMP). The easiest option is AdSense → Privacy & messaging → enable the Google CMP.

Until you add a real publisher ID, the ad slots show an "Advertisement" placeholder. The AdSense script loads only after the page becomes idle, so it never slows down the tool. Ad slots reserve their height to prevent layout shift.

## How compression works

| Output | Engine |
|---|---|
| JPG / WebP / AVIF | The browser's native encoder (`OffscreenCanvas.convertToBlob`) in a Web Worker |
| WebP on Safari | A WASM libwebp encoder (`js/vendor/webp-wasm`, lazy-loaded) |
| PNG | Colour quantisation with UPNG.js (`js/vendor/upng-bundle.js`). At 95% quality and above, it is lossless |

EXIF and GPS metadata are removed. Orientation is applied.

## Files

```
index.html            App page and SEO content
privacy.html, terms.html
css/styles.css
js/app.js             UI, queue, settings, ads, and CONFIG
js/worker.js          Worker: decode → resize → encode
js/encoder.js         Shared encoder (worker and main-thread fallback)
js/zip.js             Tiny ZIP writer (loads on demand)
js/vendor/            UPNG.js + pako (MIT), libwebp WASM (Apache-2.0)
sw.js, manifest.webmanifest, icon.svg, ads.txt, robots.txt, sitemap.xml
```

After changing any asset, bump `CACHE` in `sw.js` so returning visitors get the new version.
