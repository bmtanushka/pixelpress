# CompressZone launch kit

Ready-to-post texts for launch sites, directories and Q&A sites. Edit freely, and post in your own voice: copy-pasted text across sites gets flagged as spam.

**Ground rules (keeps posts from being removed):**
- **Always disclose that you built it.** Reddit, Hacker News, Quora and Stack Exchange all require it, and the drafts below already include it.
- **Read each community's rules before posting.** Many subreddits ban self-promotion or allow it only on certain days.
- **Help first, link second.** Answers should solve the problem without the link; the tool is an extra.
- **Don't post everything on the same day.** Space launches out (see the schedule at the end), and reply to every comment.
- **Be upfront about ads and analytics if asked.** Files never leave the browser, but the site uses Google Analytics and will show ads. Honesty here builds trust, especially on Hacker News.

---

## 1. Product Hunt

**Name:** CompressZone

**Tagline (60 characters max):**
> Private image & PDF tools — your files never leave the browser

**Description (260 characters max):**
> 35 free tools to compress, resize and convert images and PDFs: compress to an exact KB size, HEIC to JPG, JPG to PDF, merge and split PDFs, remove photo location data and more. Everything runs in your browser — nothing is uploaded, no sign-up.

**Topics:** Productivity, Privacy, Design Tools, Photography, Developer Tools

**Gallery (5 images, 1270×760):**
1. Home page with the compressor, after compressing a photo (showing "−80%")
2. "Compress to KB": the target-size controls with the green "✓ Under 50 KB" tick
3. Organize PDF: the page thumbnail grid with a rotated and a deleted page
4. EXIF viewer showing "Contains GPS location", next to the clean copy
5. Simple graphic: "Your files never leave your device", with the browser's network tab showing no uploads

**Maker's first comment:**
> Hi Product Hunt 👋
>
> I built CompressZone because every "free" image or PDF tool I used uploaded my files to a server. That's fine for a meme, not for a passport scan, a bank statement or a contract.
>
> CompressZone does everything inside your browser:
> - **Compress to an exact size**: type "50 KB" and it finds the best quality that fits. Handy for job, exam and visa forms.
> - **HEIC to JPG in any browser**, not just Safari.
> - **PDF tools**: JPG to PDF, PDF to JPG, merge, split, rotate, reorder and delete pages.
> - **Remove photo location data** losslessly, without re-compressing the image.
> - Crop, resize to exact pixels (passport and Instagram sizes), favicon generator, Base64 and more.
>
> No sign-up and no limits, and it works offline once loaded. It's also available in Hindi and Spanish.
>
> You can check the privacy claim yourself: open DevTools → Network, then compress a file. Nothing is sent.
>
> I'd love your feedback, especially on which tool you'd want next.

---

## 2. Hacker News — Show HN

Post Tuesday–Thursday, around 8–10 am US Eastern time. Stay online for a few hours to reply.

**Title (80 characters max):**
> Show HN: CompressZone – Image and PDF tools that run entirely in the browser

**URL:** https://compresszone.com

**Text:**
> I built a set of image and PDF tools where the files never leave the browser. You can verify it in the network tab.
>
> Some implementation details that might interest HN:
>
> - JPG/WebP encoding uses the browser's own encoders (OffscreenCanvas.convertToBlob) in a pool of Web Workers. Safari can't encode WebP from a canvas, so it falls back to libwebp compiled to WebAssembly.
> - "Compress to 50 KB" is a binary search over the quality setting. If even the lowest quality is too big, it shrinks the dimensions by 20% and searches again.
> - PNG compression is colour quantisation with UPNG.js; at 95%+ quality it's lossless.
> - HEIC decodes natively in Safari, and through libheif (WASM) everywhere else.
> - The EXIF/GPS remover is lossless: it drops JPEG APP1/APP13 segments, PNG text/eXIf chunks and WebP EXIF/XMP chunks instead of re-encoding. It keeps a minimal orientation tag so photos don't turn sideways.
> - PDFs: pdf-lib for merge, split and rotate (pages are copied, not re-rendered) and Mozilla's PDF.js for thumbnails and PDF→JPG.
> - Static site on Cloudflare Workers assets with no backend; about 20 KB on first load, and the heavy libraries load only on the page that needs them.
>
> I also ran a small benchmark of Chrome's JPG vs WebP encoders with SSIM. WebP was 24% smaller at the same quality setting, but only 12–21% smaller when matched for SSIM, and for a few images JPG won: https://compresszone.com/image-compression-test (CSV included).
>
> To be upfront: the site uses Google Analytics and is meant to be ad-supported. Your files are never part of that.
>
> Feedback welcome, especially on edge cases (odd PDFs, huge images, Safari quirks).

---

## 3. Reddit

Check each subreddit's rules first; some remove any self-promotion. Use a different text for each.

### r/SideProject (self-promotion friendly)
**Title:** I built 35 image & PDF tools that never upload your files — everything runs in the browser

> Hey everyone! I got tired of "free online" converters uploading my passport scans and bank statements to who-knows-where, so I built CompressZone: https://compresszone.com
>
> It does image compression (including "compress to exactly 50 KB" for forms), HEIC to JPG, resizing to exact pixels, JPG to PDF, merge/split/rotate PDF, removing GPS location from photos, and more. Everything runs locally in your browser with Web Workers and WebAssembly. No sign-up and no limits, and it works offline.
>
> It's also in Hindi and Spanish. I'd love feedback on what's confusing or missing!

### r/webdev (self-promotion only on **Showoff Saturday**)
**Title:** [Showoff Saturday] Client-side image/PDF toolkit: Web Workers, WASM WebP fallback for Safari, lossless EXIF stripping

> Built a no-backend toolkit at https://compresszone.com. Some fun bits:
> - a worker pool with OffscreenCanvas, plus a main-thread fallback
> - a WASM libwebp fallback, because Safari can't encode WebP from a canvas
> - "compress to X KB" as a binary search on quality, then shrinking dimensions
> - lossless EXIF removal by dropping JPEG/PNG/WebP metadata segments
> - pdf-lib + PDF.js for page-level PDF editing
>
> It's a static site on Cloudflare Workers assets with a tiny Python build script (no framework) and Lighthouse 100 for performance, SEO and accessibility. Happy to answer questions about any of it.

### r/InternetIsBeautiful (check current rules on self-submissions first)
**Title:** A free set of image and PDF tools where your files never leave your browser

---

## 4. Directories

### AlternativeTo (alternativeto.net)
Add CompressZone as an alternative to **TinyPNG, iLovePDF, Squoosh, Smallpdf, Compressor.io and HEIC to JPG converters**.

**Description:**
> CompressZone is a free collection of 35 image and PDF tools that run entirely in your web browser, so files are never uploaded. Compress images to an exact KB size, convert HEIC to JPG, PNG/JPG to WebP, resize to exact pixels or passport sizes, crop, rotate, remove EXIF and GPS data, create favicons, and merge, split, rotate and convert PDFs. No sign-up, no limits, and it works offline.

**Tags:** image-compression, pdf-tools, privacy, heic-converter, webp, offline, no-registration

**License:** Free

**Platforms:** Online / Web

### SaaSHub (saashub.com)
Use the same description. Category: Image Optimization / PDF Tools. Alternatives: TinyPNG, iLovePDF, Smallpdf.

### Indie Hackers (indiehackers.com) — a "building in public" post
**Title:** Lessons from building 35 privacy-first browser tools in 3 weeks
> Share what you learned: why "nothing is uploaded" matters to users, the Hindi and Spanish translations, the AdSense "low value" rejection and what you're doing about it. Indie Hackers loves honest numbers, so include your real traffic.

---

## 5. Q&A answers (Quora, Reddit, Stack Exchange)

Search each site for these questions and answer the most-viewed recent ones. Adapt the wording each time. On Stack Exchange (Super User), the answer must be complete without the link, and the disclosure is required.

### 1. "How do I compress a photo to 20 KB for an exam/government form?"
> The trick is to remove what the form doesn't need before compressing:
> 1. **Crop tightly** to just your face or signature. Less area means more quality per KB.
> 2. **Set the exact pixel size** the form asks for (e.g. 200×230 px). Don't upload a 4000-px photo and hope.
> 3. **Compress to just under the limit** as a JPG. Signatures compress easily because they're mostly white.
>
> If you don't want to guess quality settings, I built a free tool where you type the limit and it finds the best quality that fits: https://compresszone.com/compress-image-to-20kb. It runs in your browser, so your photo isn't uploaded anywhere. (Disclosure: I made it.)

### 2. "How can I reduce image size to 50 KB / 100 KB without losing quality?"
> Some loss is unavoidable at small sizes, but you can make it invisible:
> - **Resize first.** A 12-megapixel photo has far more pixels than a form or website shows. Scaling to 1000–1500 px wide cuts the size massively.
> - **Use JPG at 75–85% quality.** The difference from 100% is very hard to see.
> - **Strip metadata.** Camera and GPS data can add tens of KB.
>
> I made a free tool that does the trial and error for you (type 50 or 100 KB): https://compresszone.com/compress-image-to-kb. It runs locally in your browser, with no upload. (I'm the developer.)

### 3. "How do I open HEIC files on Windows / convert HEIC to JPG?"
> Three options:
> 1. Install **HEIF Image Extensions** from the Microsoft Store. Some PCs also need **HEVC Video Extensions**, which costs a small fee.
> 2. On the iPhone, set **Settings → Photos → Transfer to Mac or PC → Automatic** to get JPGs when copying by cable, or **Settings → Camera → Formats → Most Compatible** for new photos.
> 3. Convert in the browser. I built a free converter that works in Chrome, Edge and Firefox without uploading your photos: https://compresszone.com/heic-to-jpg (disclosure: my tool).

### 4. "How do I remove location/EXIF data from photos before posting?"
> - **iPhone:** in the share sheet, tap **Options** at the top and turn off **Location** before sharing. To stop tagging new photos: Settings → Privacy & Security → Location Services → Camera → Never.
> - **Android:** turn off location tags in your camera app's settings.
> - **Any photo:** check it with an EXIF viewer first, then strip the data.
>
> I built a free tool that removes EXIF/GPS **without re-compressing the image**, so there's no quality loss, and it works on batches: https://compresszone.com/remove-exif. Everything happens in your browser. (Disclosure: I'm the developer.)

### 5. "How can I merge PDFs for free without Adobe Acrobat?"
> - **Mac:** open the first PDF in Preview, show thumbnails (View → Thumbnails), drag the other PDFs into the sidebar, then File → Export as PDF.
> - **Windows:** there's no built-in way. Most online tools upload your files, which isn't great for statements or contracts.
>
> I made a free merger that runs entirely in your browser, so nothing is uploaded, and keeps text selectable: https://compresszone.com/merge-pdf (disclosure: my tool).

### 6. "How do I convert multiple photos into one PDF on my phone?"
> On iPhone, the **Files** app (… → Scan Documents) or the **Notes** app can scan pages straight to PDF. For existing photos, you need a converter. I built a free one that works in your phone's browser: add the photos, drag them into order, pick A4 or Letter and tap Create PDF. https://compresszone.com/jpg-to-pdf. Nothing is uploaded. (Disclosure: I made it.)

### 7. "Is WebP better than JPG?"
> For websites, usually yes. Google reports lossy WebP is 25–34% smaller than JPG at similar quality. I ran my own small test of Chrome's encoders on nine public-domain photos, measuring quality with SSIM:
> - At the **same quality setting**, WebP was about **24% smaller**.
> - At **equal measured quality**, the median saving was **12–21%**, and for a few images JPG was actually smaller.
> - Raising quality from 80% to 95% roughly **doubled** the file size for both formats.
>
> Full method and CSV: https://compresszone.com/image-compression-test (disclosure: I run the site). Use JPG when you need maximum compatibility, e.g. email attachments or older software.

### 8. "How do I resize a photo to passport size (600×600 / 35×45 mm) online?"
> 2×2 in at 300 DPI is **600×600 px** (US passport/visa). 35×45 mm at 300 DPI is about **413×531 px** (many other countries). Crop so your face is centred, then resize to those exact pixels. Also check whether your application has a KB limit. Background colour, head size and lighting rules come from your government's guidelines, so check those too.
>
> I made a free resizer with both presets plus an optional KB limit: https://compresszone.com/passport-photo-size. It runs in your browser. (Disclosure: my tool.)

### 9. "How do I create a favicon.ico from a PNG?"
> Modern sites need more than one file: `favicon.ico` (16/32/48 px), PNG favicons, a 180 px `apple-touch-icon.png` (give it a solid background, because iOS shows transparency as black), and 192/512 px Android icons plus a `site.webmanifest`. Start from a simple square logo of at least 512 px.
>
> I built a generator that creates all of these plus the HTML snippet in one ZIP: https://compresszone.com/favicon-generator. It runs in your browser. (Disclosure: I made it.)

### 10. "How do I extract or split pages from a PDF for free?"
> - **Mac:** in Preview, show thumbnails, select pages and drag them to the desktop to create a new PDF.
> - **Windows/Chrome:** print → "Save as PDF" with a custom page range works for simple cases.
> - For splitting by ranges (e.g. 1–3, 4–6) or into single pages, I built a free tool that runs in your browser with page thumbnails: https://compresszone.com/split-pdf. Your PDF isn't uploaded. (Disclosure: my tool.)

### Bonus — Hindi (Quora Hindi)
**"फ़ोटो को 20 KB में कैसे करें?"**
> सबसे पहले फ़ोटो को सिर्फ़ चेहरे या सिग्नेचर तक क्रॉप करें, फिर फ़ॉर्म जो पिक्सेल साइज़ माँगे (जैसे 200×230) वही रखें, और JPG में 20 KB से कम कंप्रेस करें। मैंने एक मुफ़्त टूल बनाया है जिसमें आप KB सीमा लिखते हैं और वह सबसे अच्छी क्वालिटी अपने-आप चुन लेता है — फ़ोटो कहीं अपलोड नहीं होती: https://compresszone.com/hi/compress-image-to-20kb (यह टूल मेरा बनाया हुआ है।)

### Bonus — Spanish
**"¿Cómo comprimir una imagen a 100 KB?"**
> Primero redimensiona la foto (1000–1500 px de ancho bastan para formularios), después guárdala como JPG con calidad del 75–85%. Si no quieres probar a ojo, hice una herramienta gratuita donde escribes el límite y encuentra la mejor calidad que cabe; funciona en tu navegador, sin subir la foto: https://compresszone.com/es/comprimir-imagen-a-100kb (aviso: la herramienta es mía).

---

## 6. Suggested schedule

| Week | Do |
|---|---|
| 1 | AlternativeTo + SaaSHub listings. Post on r/SideProject. Answer 3–4 Q&A questions. |
| 2 | Show HN (Tue–Thu morning US Eastern). r/webdev on Showoff Saturday. 3–4 more answers. |
| 3 | Product Hunt launch (Tuesday–Thursday, 12:01 am Pacific). Indie Hackers post with your real numbers. |
| 4+ | 2–3 Q&A answers a week; answer new questions as they appear. Check Analytics → Acquisition to see which channel works and do more of it. |

**Track results:** Google Analytics → Reports → Acquisition → Traffic acquisition shows visits from news.ycombinator.com, reddit.com, producthunt.com, quora.com and so on.
