// Generate a 1200×630 social share image for every page in src/pages → img/og/<slug>.jpg.
// Requires Playwright with Chromium:   node scripts/og_images.mjs
// Then run `python3 scripts/build.py` so pages pick up their images.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.html') ? [path.join(dir, e.name)] : []);
}
function meta(file) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(file, 'utf8'));
  const out = {};
  for (const line of m[1].split('\n')) { const i = line.indexOf(':'); if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  return out;
}
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const KICKER = {
  en: { tool: 'Free · Private · Runs in your browser', article: 'Guide', hub: 'Free tools', page: 'CompressZone' },
  hi: { tool: 'मुफ़्त · प्राइवेट · ब्राउज़र में चलता है', article: 'गाइड', hub: 'मुफ़्त टूल', page: 'CompressZone' },
  es: { tool: 'Gratis · Privado · Funciona en tu navegador', article: 'Guía', hub: 'Herramientas gratis', page: 'CompressZone' },
};
const MARK = '<svg viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b5bf6"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#g)"/><path d="M8.5 8.5 14 14m0-5v5H9M23.5 23.5 18 18m0 5v-5h5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function card(p) {
  const lang = p.lang || 'en';
  const home = { '/': 'Free image &amp; PDF tools', '/es': 'Herramientas gratis de imagen y PDF', '/hi': 'मुफ़्त फ़ोटो और PDF टूल' };
  const title = home[p.path] || esc(p.headline || p.nav || p.title);
  const big = title.length > 46 ? 58 : title.length > 28 ? 72 : 88;
  const pill = { hi: '100% प्राइवेट · फ़ाइलें अपलोड नहीं होतीं', es: '100% privado · tus archivos no se suben' }[lang] || '100% private · files never leave your device';
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;font-family:Inter,ui-sans-serif,system-ui,"Segoe UI",Roboto,"Noto Sans Devanagari",Arial,sans-serif;background:#f6f6fa;color:#15151f;position:relative;overflow:hidden;padding:72px 88px;display:flex;flex-direction:column}
.blob{position:absolute;right:-180px;top:-160px;width:640px;height:640px;border-radius:50%;background:radial-gradient(circle at 30% 30%,#a855f7 0,#5b5bf6 55%,transparent 70%);opacity:.16}
.brand{display:flex;align-items:center;gap:16px;font-size:34px;font-weight:800;letter-spacing:-.02em}
.brand svg{width:64px;height:64px}.brand b{background:linear-gradient(90deg,#5b5bf6,#a855f7);-webkit-background-clip:text;color:transparent}
.kicker{margin-top:auto;font-size:28px;font-weight:600;color:#5b5bf6;letter-spacing:.01em}
h1{margin-top:14px;font-size:${big}px;line-height:1.08;font-weight:800;letter-spacing:-.03em;max-width:1000px}
.pill{margin-top:36px;align-self:flex-start;padding:10px 22px;border-radius:999px;background:#e3f6ec;color:#0a7d45;font-size:24px;font-weight:600}
.url{position:absolute;right:88px;bottom:72px;font-size:24px;font-weight:600;color:#676779}
</style></head><body><div class="blob"></div>
<div class="brand">${MARK}<span>Compress<b>Zone</b></span></div>
<div class="kicker">${esc(KICKER[lang][p.type] || KICKER[lang].page)}</div>
<h1>${title}</h1>
<span class="pill">${pill}</span>
<div class="url">compresszone.com</div>
</body></html>`;
}

const pages = walk(path.join(ROOT, 'src/pages')).map(meta).filter(p => p.path && !p.noindex);
const outDir = path.join(ROOT, 'img/og');
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const p of pages) {
  const slug = p.path === '/' ? 'home' : p.path.replace(/^\/|\/$/g, '').replace(/\//g, '-');
  await page.setContent(card(p), { waitUntil: 'load' });
  await page.screenshot({ path: path.join(outDir, slug + '.jpg'), type: 'jpeg', quality: 82 });
}
await browser.close();
console.log('wrote', pages.length, 'images to img/og/');
