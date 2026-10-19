# CompressZone — private, in-browser image & PDF tools

A fast static website with 35 free image and PDF tools at https://compresszone.com. Everything runs in the visitor's browser: files are never uploaded.

**Image tools.** Image compressor, plus:
- **Compress to an exact size:** a target in KB, with pages for 20, 50, 100 and 200 KB.
- **Resize:** by maximum dimension, to exact pixels, passport photo sizes or Instagram sizes.
- **Convert:** HEIC→JPG (in every browser), JPG/PNG/WebP in every direction, and image ⇄ Base64.
- **Edit:** crop, rotate and flip.
- **Other:** favicon generator, EXIF viewer and lossless EXIF/GPS remover.

**PDF tools.** JPG→PDF, PDF→JPG/PNG, merge, split, rotate, organize and delete pages.

**How it's built**
- **No framework and no build step on the host.** Plain HTML, CSS and JS. A page's first load is about 20 KB gzipped, and heavy libraries load only on the page that needs them.
- **Compressor:** default quality 80%; never makes a file bigger; batch processing on a Web Worker pool, with ZIP download and a before/after slider.
- **Everywhere:** works offline (service worker and PWA), light and dark mode, responsive and keyboard accessible.

## Run locally

```bash
cd compresszone   # this repo
npx http-server -p 8080 -c-1 .     # or: python3 -m http.server 8080
```
Open http://localhost:8080. A web server is required because Web Workers don't run from `file://`.

## Deploy

Live at **https://compresszone.com**. The repo deploys automatically on every push to `main`, to either of two hosts. Only one of them should serve the `compresszone.com` domain; the other can stay on its free subdomain.

### Cloudflare Workers (static assets)
- `wrangler.jsonc` publishes the folder as static assets. No server code runs.
- `.assetsignore` keeps config and docs files private.
- `_headers` sets the cache and security headers.
- Unknown URLs get the branded `404.html`.
- The `name` in `wrangler.jsonc` **must match the Worker's name** in the Cloudflare dashboard, or Workers Builds will fail.
- The build command can be left empty. The deploy command is `npx wrangler deploy`.

### Railway (Docker + Caddy)
- The `Dockerfile` and `Caddyfile` serve the same files with gzip/zstd compression, the same headers, clean URLs and the 404 page.
- `railway.json` tells Railway to build from that Dockerfile.

### Test locally
`npx wrangler dev` runs the Cloudflare version, and `docker build -t cz . && docker run -p 8080:8080 cz` runs the Railway version.

## Editing pages (SEO build)

The HTML pages are generated from `src/` by a small dependency-free script. **Edit the sources, not the root `.html` files.**

```bash
python3 scripts/build.py      # regenerates *.html, sitemap.xml and llms.txt
```

- `src/layout.html`: the shared `<head>`, header and footer.
- `src/partials/`: the compressor UI and the comparison dialog.
- `src/pages/*.html`: one file per page. Each starts with front matter for the URL, title, description, preset format and so on. See the top of `scripts/build.py` for the fields.
- `src/llms-intro.md`: the key facts at the top of `llms.txt`.

The build turns each page's FAQ (`<details>`) and steps (`<article class="step">`) into FAQPage and HowTo structured data, so the schema always matches the visible content. Commit the generated files: the hosts serve them as-is, with no build step.

To add a page, copy a file in `src/pages/`, change its front matter and content, add a link in the `src/layout.html` footer, and run the build.

## SEO and AI search (AIEO)

| What | Where |
|---|---|
| One page per search intent (35 tools) with the tool preset, plus `/image-tools` and `/pdf-tools` hub pages | `src/pages/` |
| Unique title, meta description, canonical URL, Open Graph and Twitter tags on every page | `src/layout.html` |
| JSON-LD `@graph`: Organization, WebSite, WebPage/CollectionPage, BreadcrumbList, WebApplication, FAQPage, HowTo, ItemList, Article | `scripts/build.py` |
| Visible breadcrumbs, related-tool links and a footer sitemap for internal linking | layout and build |
| A format comparison guide with a short "answer box" and tables (often quoted by AI answers) | `/image-formats-guide` |
| `llms.txt`: a plain-text site summary for AI assistants | generated |
| `robots.txt` explicitly allows AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended and others) | `robots.txt` |
| `sitemap.xml` with `lastmod` dates | generated |
| Lighthouse: SEO 100, Performance 100, Accessibility 100 | |

After deploying:

1. **Google Search Console:** add `compresszone.com` (a Domain property, verified by DNS in Cloudflare) and submit `https://compresszone.com/sitemap.xml`.
2. **Bing Webmaster Tools:** import the site from Search Console. Bing also powers ChatGPT search and DuckDuckGo.
3. Check structured data with Google's Rich Results Test: https://search.google.com/test/rich-results

## Set up Google AdSense

1. Sign up at https://adsense.google.com and add your site.
2. The publisher ID `ca-pub-3088214716790750` is already set in:
   - `src/layout.html`: the `google-adsense-account` meta tag (every page)
   - `js/site.js`: `ADSENSE.client`
   - `ads.txt` (as `pub-…`, without the `ca-` prefix)
3. The site works with **Auto ads** (AdSense → Ads → turn on Auto ads for compresszone.com). For fixed placements, create two **Display → Responsive** ad units and put their slot IDs in `ADSENSE.slots` in `js/site.js` (`top`, `middle`).
4. **EU, EEA, UK and Switzerland visitors:** Google requires a certified consent banner (CMP). The easiest option is AdSense → Privacy & messaging → enable the Google CMP.

Fixed ad slots stay collapsed until they have a unit ID. The AdSense script loads only after the page becomes idle, so it never slows down the tool. Ad slots reserve their height to prevent layout shift.

## How the tools work

Each tool page names an `engine` in its front matter. `ENGINES` in `scripts/build.py` maps that engine to a UI partial in `src/partials/` and its scripts.

| Engine | Pages | How |
|---|---|---|
| `compressor` (`js/app.js`, `worker.js`, `encoder.js`) | compress, compress to KB, resize, exact pixels, passport, Instagram, all image conversions, HEIC | The browser's native encoders in Web Workers. UPNG.js for PNG. WASM libwebp for WebP on Safari. heic2any/libheif for HEIC outside Safari. Target size uses a binary search over quality, then shrinks the dimensions only if needed. |
| `img2pdf` | JPG to PDF | Images are drawn to a canvas, saved as JPEG and placed on pages with pdf-lib |
| `pdf2img` | PDF to JPG/PNG | Mozilla PDF.js renders each page to a canvas |
| `pdfmerge` | Merge PDF | pdf-lib `copyPages` (lossless) |
| `pdfpages` (`data-mode` organize / rotate / delete / split) | Organize, rotate, delete pages, split | PDF.js thumbnails, pdf-lib output (lossless, rotation via `setRotation`) |
| `editor` | Crop, rotate, flip | Canvas with a draggable crop box |
| `base64` | Image ⇄ Base64 | FileReader / atob, with the image type detected from its first bytes |
| `favicon` | Favicon generator | Canvas renders, a hand-written multi-size ICO, manifest and ZIP |
| `exif` | EXIF viewer / remover | exifr to read. Lossless removal by dropping JPEG APP1/APP13/COM segments, PNG text/eXIf chunks and WebP EXIF/XMP chunks. The orientation is kept. |

`js/tools/common.js` holds the shared helpers: drop/paste, downloads, ZIP, image decoding, PDF loaders and drag-to-reorder.

## Files

```
src/, scripts/build.py  Page sources and the build script (see above)
*.html                Generated pages: 35 tools, 2 hubs, guide, about, privacy, terms, 404
llms.txt, sitemap.xml Generated
css/styles.css
js/site.js            Every page: AdSense, service worker, footer year
js/app.js             Tool pages: UI, queue, settings and landing-page presets
js/worker.js          Worker: decode → resize → encode
js/encoder.js         Shared encoder (worker and main-thread fallback)
js/zip.js             Tiny ZIP writer (loads on demand)
js/tools/             Image and PDF tool engines (see above)
js/vendor/            UPNG.js + pako (MIT), libwebp WASM (Apache-2.0), pdf-lib 1.17.1 (MIT),
                      PDF.js 5.7.284 legacy build (Apache-2.0), heic2any 0.0.4 (MIT, bundles libheif LGPL-3.0),
                      exifr 7.1.3 (MIT)
sw.js, manifest.webmanifest, icon.svg, ads.txt, robots.txt, sitemap.xml
```

After changing any asset, bump `CACHE` in `sw.js` so returning visitors get the new version.
