#!/usr/bin/env python3
"""Build the static pages for compresszone.com.

    python3 scripts/build.py

Reads src/layout.html, src/partials/*.html and src/pages/*.html and writes the
final HTML files to the repo root, plus sitemap.xml and llms.txt. The generated
files are committed, so hosting needs no build step.

Each page starts with a front-matter block:

    ---
    path: /jpg-to-webp
    title: JPG to WebP Converter ...        (<title>, ~60 chars)
    description: ...                        (meta description, ~155 chars)
    type: tool | article | page             (tool pages load the compressor)
    format: image/webp                      (tool pages: preset output format)
    maxdim: 0                               (tool pages: preset max dimension)
    breadcrumb: JPG to WebP                 (omit on the home page)
    updated: 2026-10-19
    ---

    engine: compressor                      (tool pages: which tool UI/script — see ENGINES)
    mode: split                             (optional: passed to the tool as data-mode)
    category: compress | convert | edit | pdf
    card: Short text for the tool cards     (hub pages and the home page)
    features: Feature one | Feature two     (WebApplication featureList; defaults per engine)

Content placeholders: {{tool}}, {{ad:top}}, {{ad:middle}}, {{related}},
{{hub:image}}, {{hub:pdf}}, {{hub:all}} (tool card grids).
FAQ (<details>) and how-to (<article class="step">) blocks in the content are
turned into FAQPage / HowTo structured data automatically.
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
SITE = "https://compresszone.com"
LOGO = SITE + "/img/icon-512.png"
OG_IMAGE = SITE + "/img/og-image.png"


def parse(path):
    text = path.read_text()
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    meta = {}
    for line in m.group(1).splitlines():
        if line.strip():
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    meta["body"] = text[m.end():]
    meta["src"] = path.name
    return meta


# Tool engines: the UI partial in src/partials/ and the script(s) that drive it.
ENGINES = {
    "compressor": {"partial": "tool", "scripts": ["/js/app.js"], "dialog": True},
    "img2pdf": {"partial": "img2pdf", "scripts": ["/js/tools/common.js", "/js/tools/img2pdf.js"]},
    "pdf2img": {"partial": "pdf2img", "scripts": ["/js/tools/common.js", "/js/tools/pdf2img.js"]},
    "pdfmerge": {"partial": "pdfmerge", "scripts": ["/js/tools/common.js", "/js/tools/pdfmerge.js"]},
    "pdfpages": {"partial": "pdfpages", "scripts": ["/js/tools/common.js", "/js/tools/pdfpages.js"]},
    "editor": {"partial": "editor", "scripts": ["/js/tools/common.js", "/js/tools/editor.js"]},
    "base64": {"partial": "base64", "scripts": ["/js/tools/common.js", "/js/tools/base64.js"]},
    "favicon": {"partial": "favicon", "scripts": ["/js/tools/common.js", "/js/tools/favicon.js"]},
    "exif": {"partial": "exif", "scripts": ["/js/tools/common.js", "/js/tools/exif.js"]},
}

COMPRESSOR_FEATURES = [
    "Compress JPG, PNG, WebP, HEIC, GIF, BMP, AVIF and SVG images",
    "Convert images to WebP, JPG, PNG or AVIF",
    "Adjustable quality (default 80%) or an exact target file size in KB",
    "Resize to a maximum dimension or exact pixel size",
    "Batch processing and ZIP download",
    "Runs 100% in the browser; images are never uploaded",
    "Works offline after the first visit",
]

CATEGORIES = [
    ("compress", "Compress & resize"),
    ("convert", "Convert images"),
    ("edit", "Edit & inspect"),
    ("pdf", "PDF tools"),
]
HUBS = {"image": ["compress", "convert", "edit"], "pdf": ["pdf"]}

# Languages. Pages in src/pages/<lang>/ set `lang:` and `alt:` (the English page they translate);
# hreflang links are generated in both directions.
LANGS = {
    "en": {"home": "/", "home_name": "Home", "locale": "en_US", "name": "English",
           "skip": "Skip to content", "noscript": "CompressZone tools need JavaScript to process files in your browser."},
    "hi": {"home": "/hi", "home_name": "होम", "locale": "hi_IN", "name": "हिन्दी",
           "skip": "मुख्य सामग्री पर जाएँ", "noscript": "CompressZone टूल चलाने के लिए ब्राउज़र में JavaScript चालू होना ज़रूरी है।"},
}
HUB_PATH = {"image": "/image-tools", "pdf": "/pdf-tools"}


def engine_of(page):
    return page.get("engine", "compressor") if page["type"] == "tool" else None


def hub_of(page):
    return "pdf" if page.get("category") == "pdf" else "image"


def parents(page):
    """Front matter `parent: /guides|Guides` → [("/guides", "Guides")]."""
    if not page.get("parent"):
        return []
    u, n = page["parent"].split("|", 1)
    return [(u.strip(), n.strip())]


def og_slug(page):
    return "home" if page["path"] == "/" else page["path"].strip("/").replace("/", "-")


def og_image(page):
    f = ROOT / "img" / "og" / (og_slug(page) + ".jpg")
    return f"{SITE}/img/og/{og_slug(page)}.jpg" if f.exists() else OG_IMAGE


def strip_tags(s):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s))).strip()


def url_of(page):
    return SITE + page["path"] if page["path"] != "/" else SITE + "/"


def out_file(page):
    return ROOT / ("index.html" if page["path"] == "/" else page["path"].strip("/") + ".html")


def faqs(body):
    return [(strip_tags(q), strip_tags(a)) for q, a in
            re.findall(r"<details>\s*<summary>(.*?)</summary>(.*?)</details>", body, re.S)]


def steps(body):
    return [(strip_tags(n), strip_tags(t)) for n, t in
            re.findall(r'<article class="step">.*?<h3>(.*?)</h3>\s*<p>(.*?)</p>', body, re.S)]


def jsonld(page, pages):
    url = url_of(page)
    lang = page["lang"]
    L = LANGS[lang]
    graph = [
        {"@type": "Organization", "@id": SITE + "/#org", "name": "CompressZone", "url": SITE + "/",
         "logo": {"@type": "ImageObject", "url": LOGO, "width": 512, "height": 512}},
        {"@type": "WebSite", "@id": SITE + "/#website", "name": "CompressZone", "url": SITE + "/",
         "description": "Free, private image and PDF tools that run in the browser: compress, resize, convert and edit images; merge, split and convert PDFs.",
         "publisher": {"@id": SITE + "/#org"}, "inLanguage": "en"},
    ]
    webpage = {"@type": "WebPage", "@id": url + "#webpage", "url": url, "name": page["title"],
               "description": page["description"], "isPartOf": {"@id": SITE + "/#website"},
               "inLanguage": lang, "primaryImageOfPage": {"@type": "ImageObject", "url": og_image(page)}}
    if page.get("updated"):
        webpage["dateModified"] = page["updated"]
    if page.get("breadcrumb"):
        webpage["breadcrumb"] = {"@id": url + "#breadcrumb"}
        trail = [(L["home_name"], SITE + L["home"])] + [(n, SITE + u) for u, n in parents(page)] + [(page["breadcrumb"], url)]
        graph.append({"@type": "BreadcrumbList", "@id": url + "#breadcrumb", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(trail)]})
    graph.append(webpage)

    if page["type"] == "tool":
        webpage["mainEntity"] = {"@id": url + "#app"}
        graph.append({
            "@type": "WebApplication", "@id": url + "#app", "name": page.get("app_name", "CompressZone"),
            "url": url, "applicationCategory": "MultimediaApplication",
            "applicationSubCategory": "Image compression",
            "operatingSystem": "Any (runs in a web browser)",
            "browserRequirements": "Requires JavaScript and a modern browser (Chrome, Edge, Firefox, Safari)",
            "isAccessibleForFree": True,
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
            "featureList": ([f.strip() for f in page["features"].split("|")] if page.get("features")
                            else COMPRESSOR_FEATURES if engine_of(page) == "compressor"
                            else ["Runs 100% in the browser; files are never uploaded", "Free, no sign-up, no watermark"]),
            "publisher": {"@id": SITE + "/#org"}, "inLanguage": lang,
        })
    if page["type"] == "hub":
        if page["path"].endswith("/guides"):
            tools = [p for p in pages if p["type"] == "article"]
        else:
            hub = "pdf" if "pdf" in page["path"] else "image"
            tools = [p for p in pages if p["type"] == "tool" and p.get("category") in HUBS[hub]]
        webpage["@type"] = "CollectionPage"
        webpage["mainEntity"] = {"@id": url + "#tools"}
        graph.append({"@type": "ItemList", "@id": url + "#tools", "numberOfItems": len(tools),
                      "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": p.get("headline", p["nav"]), "url": url_of(p)}
                                          for i, p in enumerate(tools)]})
    if page["type"] == "article":
        graph.append({
            "@type": "Article", "@id": url + "#article", "headline": page.get("headline", page["title"]),
            "description": page["description"], "image": og_image(page), "url": url,
            "datePublished": page.get("published", page.get("updated")),
            "dateModified": page.get("updated"),
            "author": {"@id": SITE + "/#org"}, "publisher": {"@id": SITE + "/#org"},
            "mainEntityOfPage": {"@id": url + "#webpage"}, "inLanguage": lang})

    if page.get("dataset"):
        durl, dname, ddesc = [x.strip() for x in page["dataset"].split("|", 2)]
        graph.append({"@type": "Dataset", "@id": url + "#dataset", "name": dname, "description": ddesc,
                      "url": url, "license": "https://creativecommons.org/licenses/by/4.0/",
                      "creator": {"@id": SITE + "/#org"}, "datePublished": page.get("published"),
                      "distribution": [{"@type": "DataDownload", "encodingFormat": "text/csv", "contentUrl": SITE + durl}]})
    f = faqs(page["body"])
    if f:
        graph.append({"@type": "FAQPage", "@id": url + "#faq", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in f]})
    s = steps(page["body"])
    if s and page.get("howto"):
        graph.append({"@type": "HowTo", "@id": url + "#howto", "name": page["howto"],
                      "totalTime": "PT1M", "tool": {"@type": "HowToTool", "name": "A web browser"},
                      "step": [{"@type": "HowToStep", "position": i + 1, "name": n, "text": t}
                               for i, (n, t) in enumerate(s)]})
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=1)


def related(page, pages):
    hub = hub_of(page) if page.get("category") else "image"
    cats = HUBS[hub]
    links = [p for p in pages if p["type"] == "tool" and p.get("category") in cats and p["path"] != page["path"]]
    other = "pdf" if hub == "image" else "image"
    items = "\n".join(f'        <a href="{p["path"]}">{html.escape(p["nav"])}</a>' for p in links)
    items += (f'\n        <a class="more" href="{HUB_PATH[hub]}">All {"PDF" if hub == "pdf" else "image"} tools →</a>'
              f'\n        <a class="more" href="{HUB_PATH[other]}">{"PDF" if other == "pdf" else "Image"} tools →</a>')
    titles = {p["path"]: p.get("headline", p["title"]) for p in pages}
    for key in ("guide", "guide2"):
        if page.get(key) in titles:
            items = f'        <a class="more" href="{page[key]}">Guide: {html.escape(titles[page[key]])}</a>\n' + items
    if hub == "image" and page["path"] != "/image-formats-guide":
        items += '\n        <a class="more" href="/image-formats-guide">Guide: JPG vs PNG vs WebP vs AVIF</a>'
    if page["type"] == "tool" and page["path"] != "/about":
        items += '\n        <a class="more" href="/about">How CompressZone keeps files private</a>'
    label = "PDF" if hub == "pdf" else "image"
    return ('    <section class="container content" aria-labelledby="related-h">\n'
            f'      <h2 id="related-h">More free {label} tools</h2>\n'
            f'      <nav class="tool-links" aria-label="More {label} tools">\n{items}\n      </nav>\n'
            '    </section>\n')


def related_hi(page, pages):
    links = [p for p in pages if p["type"] == "tool" and p["path"] != page["path"]]
    items = "\n".join(f'        <a href="{p["path"]}">{html.escape(p["nav"])}</a>' for p in links)
    items += ('\n        <a class="more" href="/image-tools" lang="en">All image tools (English) →</a>'
              '\n        <a class="more" href="/pdf-tools" lang="en">PDF tools (English) →</a>'
              '\n        <a class="more" href="/reduce-photo-size-for-online-forms" lang="en">Guide: photo size for online forms</a>')
    return ('    <section class="container content" aria-labelledby="related-h">\n'
            '      <h2 id="related-h">और मुफ़्त टूल</h2>\n'
            f'      <nav class="tool-links" aria-label="और टूल">\n{items}\n      </nav>\n'
            '    </section>\n')


def guide_cards(pages):
    guides = [p for p in pages if p["type"] == "article"]
    return "\n".join(
        f'          <a class="tool-card" href="{p["path"]}"><strong>{html.escape(p.get("headline", p["title"]))}</strong>'
        f'<span>{html.escape(p.get("card", p["description"]))}</span></a>' for p in guides)


def tool_cards(pages, cats):
    out = []
    for key, title in CATEGORIES:
        if key not in cats:
            continue
        tools = [p for p in pages if p["type"] == "tool" and p.get("category") == key]
        if not tools:
            continue
        cards = "\n".join(
            f'          <a class="tool-card" href="{p["path"]}"><strong>{html.escape(p["nav"])}</strong>'
            f'<span>{html.escape(p.get("card", p["description"]))}</span></a>' for p in tools)
        out.append(f'      <h3 class="hub-title">{title}</h3>\n        <div class="tool-cards">\n{cards}\n        </div>')
    return "\n".join(out)


def ad(name):
    return ('    <aside class="container ad-wrap" aria-label="Advertisement">\n'
            f'      <div class="ad-slot" data-ad-slot-name="{name}"></div>\n    </aside>\n')


def render(page, all_pages, layout, partials, snippets):
    lang = page["lang"]
    L = LANGS[lang]
    pages = [p for p in all_pages if p["lang"] == lang]  # cards, hubs and related links stay in one language
    body = page["body"]
    eng = ENGINES[engine_of(page)] if engine_of(page) else None
    if eng:
        body = body.replace("{{tool}}", partials.get(eng["partial"] + "." + lang, partials[eng["partial"]]))
    body = body.replace("{{hub:image}}", tool_cards(pages, HUBS["image"]))
    body = body.replace("{{hub:pdf}}", tool_cards(pages, HUBS["pdf"]))
    body = body.replace("{{hub:all}}", tool_cards(pages, [c for c, _ in CATEGORIES]))
    body = body.replace("{{guides}}", '        <div class="tool-cards">\n' + guide_cards(pages) + '\n        </div>')
    body = re.sub(r"\{\{ad:(\w+)\}\}", lambda m: ad(m.group(1)), body)
    body = body.replace("{{related}}", related_hi(page, pages) if lang == "hi" else related(page, pages))

    crumbs = ""
    if page.get("breadcrumb"):
        crumbs = ('    <nav class="container breadcrumbs" aria-label="Breadcrumb"><ol>'
                  f'<li><a href="{L["home"]}">{html.escape(L["home_name"])}</a></li>'
                  + "".join(f'<li><a href="{u}">{html.escape(n)}</a></li>' for u, n in parents(page)) +
                  f'<li aria-current="page">{html.escape(page["breadcrumb"])}</li></ol></nav>\n')

    scripts = '<script src="/js/site.js" defer></script>'
    attrs = ""
    if eng:
        scripts += "".join(f'\n  <script src="{src}" defer></script>' for src in eng["scripts"])
        data = {}
        if engine_of(page) == "compressor":
            data = {"format": page.get("format", "original"), "maxdim": page.get("maxdim", "0")}
            for k in ("exact", "fit", "target-kb"):
                if page.get(k):
                    data[k] = page[k]
            if page.get("remember") or page["path"] == "/":
                data = {}  # home pages: remember the visitor's own choices
        else:
            for k in ("mode", "format"):
                if page.get(k):
                    data[k] = page[k]
        attrs = "".join(f' data-{k}="{html.escape(v)}"' for k, v in data.items())
    alts = page.get("alts", {})
    hreflang = ""
    if alts:
        links = {lang: url_of(page)}
        links.update({l: SITE + (u if u != "/" else "/") for l, u in alts.items()})
        hreflang = "".join(f'\n  <link rel="alternate" hreflang="{l}" href="{u}">' for l, u in sorted(links.items()))
        hreflang += f'\n  <link rel="alternate" hreflang="x-default" href="{links["en"]}">'
    switch = "".join(f' · <a href="{u}" hreflang="{l}" lang="{l}">{LANGS[l]["name"]}</a>' for l, u in alts.items())
    values = {
        "lang": lang,
        "og_locale": L["locale"],
        "og_image": og_image(page),
        "hreflang": hreflang,
        "t_skip": L["skip"],
        "t_noscript": L["noscript"],
        "home": L["home"],
        "nav": snippets["nav." + lang].rstrip("\n"),
        "footer": snippets["footer." + lang].rstrip("\n").replace("{{lang_switch}}", switch),
        "title": html.escape(page["title"]),
        "description": html.escape(page["description"]),
        "og_title": html.escape(page.get("og_title", page["title"])),
        "og_type": "article" if page["type"] == "article" else "website",
        "robots": "noindex, follow" if page.get("noindex") else "index, follow, max-image-preview:large, max-snippet:-1",
        "url": url_of(page),
        "jsonld": jsonld(page, pages),
        "scripts": scripts,
        "body_attrs": attrs,
        "breadcrumbs": (f'    <div class="container lang-bar"><a href="{alts["hi"]}" hreflang="hi" lang="hi">हिन्दी में देखें</a></div>\n'
                        if lang == "en" and "hi" in alts else
                        f'    <div class="container lang-bar"><a href="{alts["en"]}" hreflang="en" lang="en">View in English</a></div>\n'
                        if lang != "en" and "en" in alts else "") + crumbs,
        "content": body.rstrip("\n"),
        "after": ("\n" + partials.get("compare." + lang, partials["compare"])) if eng and eng.get("dialog") else "",
    }
    out = layout
    for k, v in values.items():
        out = out.replace("{{" + k + "}}", v)
    leftover = re.findall(r"\{\{[^}]+\}\}", out)
    assert not leftover, f"{page['src']}: unreplaced {leftover}"
    return out


def sitemap(pages):
    rows = []
    for p in pages:
        if p.get("noindex"):
            continue
        rows.append(f'  <url><loc>{url_of(p)}</loc><lastmod>{p.get("updated", "")}</lastmod>'
                    f'<priority>{p.get("priority", "0.5")}</priority></url>')
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(rows) + "\n</urlset>\n")


def llms(all_pages):
    pages = [p for p in all_pages if p["lang"] == "en"]
    intro = (SRC / "llms-intro.md").read_text().rstrip() + "\n"
    out = [intro.rstrip()]
    for key, title in CATEGORIES:
        out.append(f"\n## {title}\n")
        for p in pages:
            if p["type"] == "tool" and p.get("category") == key:
                out.append(f"- [{p.get('nav', p['title'])}]({url_of(p)}): {p['description']}")
    for title, types in (("Guides", ("article",)), ("About and policies", ("hub", "page"))):
        out.append(f"\n## {title}\n")
        for p in pages:
            if p["type"] in types and not p.get("noindex"):
                out.append(f"- [{p.get('nav', p['title'])}]({url_of(p)}): {p['description']}")
    hi = [p for p in all_pages if p["lang"] == "hi" and not p.get("noindex")]
    if hi:
        out.append("\n## हिन्दी (Hindi)\n")
        for p in hi:
            out.append(f"- [{p.get('nav', p['title'])}]({url_of(p)}): {p['description']}")
    return "\n".join(out) + "\n"


def main():
    layout = (SRC / "layout.html").read_text()
    partials = {p.stem: p.read_text().rstrip("\n") for p in (SRC / "partials").glob("*.html")}
    snippets = {p.stem: p.read_text() for p in SRC.glob("*.html") if p.name != "layout.html"}
    pages = [parse(p) for p in sorted((SRC / "pages").rglob("*.html"))]
    for p in pages:
        p.setdefault("lang", "en")
    by_path = {p["path"]: p for p in pages}
    for p in pages:
        if p.get("alt"):
            en = by_path[p["alt"]]
            en.setdefault("alts", {})[p["lang"]] = p["path"]
            p.setdefault("alts", {})["en"] = en["path"]
    order = {"tool": 0, "hub": 1, "article": 2, "page": 3}
    cat_order = {c: i for i, (c, _) in enumerate(CATEGORIES)}
    pages.sort(key=lambda p: (order[p["type"]], cat_order.get(p.get("category"), 9), -float(p.get("priority", 0.5)), p["path"]))
    for p in pages:
        p.setdefault("nav", p.get("breadcrumb", p["title"]))
        out_file(p).parent.mkdir(parents=True, exist_ok=True)
        out_file(p).write_text(render(p, pages, layout, partials, snippets))
        print("wrote", out_file(p).relative_to(ROOT))
    (ROOT / "sitemap.xml").write_text(sitemap(pages))
    (ROOT / "llms.txt").write_text(llms(pages))
    print("wrote sitemap.xml, llms.txt")


if __name__ == "__main__":
    main()
