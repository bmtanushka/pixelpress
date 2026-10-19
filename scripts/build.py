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

Content placeholders: {{tool}}, {{ad:top}}, {{ad:middle}}, {{related}}.
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
    graph = [
        {"@type": "Organization", "@id": SITE + "/#org", "name": "CompressZone", "url": SITE + "/",
         "logo": {"@type": "ImageObject", "url": LOGO, "width": 512, "height": 512}},
        {"@type": "WebSite", "@id": SITE + "/#website", "name": "CompressZone", "url": SITE + "/",
         "description": "Free, private, in-browser image compressor and WebP converter.",
         "publisher": {"@id": SITE + "/#org"}, "inLanguage": "en"},
    ]
    webpage = {"@type": "WebPage", "@id": url + "#webpage", "url": url, "name": page["title"],
               "description": page["description"], "isPartOf": {"@id": SITE + "/#website"},
               "inLanguage": "en", "primaryImageOfPage": {"@type": "ImageObject", "url": OG_IMAGE}}
    if page.get("updated"):
        webpage["dateModified"] = page["updated"]
    if page.get("breadcrumb"):
        webpage["breadcrumb"] = {"@id": url + "#breadcrumb"}
        graph.append({"@type": "BreadcrumbList", "@id": url + "#breadcrumb", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": page["breadcrumb"], "item": url}]})
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
            "featureList": [
                "Compress JPG, PNG, WebP, GIF, BMP, AVIF and SVG images",
                "Convert images to WebP, JPG, PNG or AVIF",
                "Adjustable quality (default 80%)",
                "Optional resize to a maximum dimension",
                "Batch processing and ZIP download",
                "Runs 100% in the browser; images are never uploaded",
                "Works offline after the first visit",
            ],
            "publisher": {"@id": SITE + "/#org"},
        })
    if page["type"] == "article":
        graph.append({
            "@type": "Article", "@id": url + "#article", "headline": page.get("headline", page["title"]),
            "description": page["description"], "image": OG_IMAGE, "url": url,
            "datePublished": page.get("published", page.get("updated")),
            "dateModified": page.get("updated"),
            "author": {"@id": SITE + "/#org"}, "publisher": {"@id": SITE + "/#org"},
            "mainEntityOfPage": {"@id": url + "#webpage"}, "inLanguage": "en"})

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
    links = [p for p in pages if p["type"] == "tool" and p["path"] != page["path"]]
    items = "\n".join(f'        <a href="{p["path"]}">{html.escape(p["nav"])}</a>' for p in links)
    return ('    <section class="container content" aria-labelledby="related-h">\n'
            '      <h2 id="related-h">More free image tools</h2>\n'
            f'      <nav class="tool-links" aria-label="Image tools">\n{items}\n      </nav>\n'
            '    </section>\n')


def ad(name):
    return ('    <aside class="container ad-wrap" aria-label="Advertisement">\n'
            f'      <div class="ad-slot" data-ad-slot-name="{name}"></div>\n    </aside>\n')


def render(page, pages, layout, partials):
    body = page["body"]
    body = body.replace("{{tool}}", partials["tool"])
    body = re.sub(r"\{\{ad:(\w+)\}\}", lambda m: ad(m.group(1)), body)
    body = body.replace("{{related}}", related(page, pages))

    crumbs = ""
    if page.get("breadcrumb"):
        crumbs = ('    <nav class="container breadcrumbs" aria-label="Breadcrumb"><ol>'
                  '<li><a href="/">Home</a></li>'
                  f'<li aria-current="page">{html.escape(page["breadcrumb"])}</li></ol></nav>\n')

    is_tool = page["type"] == "tool"
    scripts = '<script src="/js/site.js" defer></script>'
    attrs = ""
    if is_tool:
        scripts += '\n  <script src="/js/app.js" defer></script>'
        attrs = f' data-format="{page.get("format", "original")}" data-maxdim="{page.get("maxdim", "0")}"'
        if page["path"] == "/":
            attrs = ""  # home page: remember the visitor's own choices
    values = {
        "title": html.escape(page["title"]),
        "description": html.escape(page["description"]),
        "og_title": html.escape(page.get("og_title", page["title"])),
        "og_type": "article" if page["type"] == "article" else "website",
        "robots": "noindex, follow" if page.get("noindex") else "index, follow, max-image-preview:large, max-snippet:-1",
        "url": url_of(page),
        "jsonld": jsonld(page, pages),
        "scripts": scripts,
        "body_attrs": attrs,
        "breadcrumbs": crumbs,
        "content": body.rstrip("\n"),
        "after": ("\n" + partials["compare"]) if is_tool else "",
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


def llms(pages):
    intro = (SRC / "llms-intro.md").read_text().rstrip() + "\n"
    groups = [("Tools", "tool"), ("Guides", "article"), ("About and policies", "page")]
    out = [intro.rstrip()]
    for title, t in groups:
        out.append(f"\n## {title}\n")
        for p in pages:
            if p["type"] == t and not p.get("noindex"):
                out.append(f"- [{p.get('nav', p['title'])}]({url_of(p)}): {p['description']}")
    return "\n".join(out) + "\n"


def main():
    layout = (SRC / "layout.html").read_text()
    partials = {p.stem: p.read_text().rstrip("\n") for p in (SRC / "partials").glob("*.html")}
    pages = [parse(p) for p in sorted((SRC / "pages").glob("*.html"))]
    order = {"tool": 0, "article": 1, "page": 2}
    pages.sort(key=lambda p: (order[p["type"]], -float(p.get("priority", 0.5)), p["path"]))
    for p in pages:
        p.setdefault("nav", p.get("breadcrumb", p["title"]))
        out_file(p).write_text(render(p, pages, layout, partials))
        print("wrote", out_file(p).relative_to(ROOT))
    (ROOT / "sitemap.xml").write_text(sitemap(pages))
    (ROOT / "llms.txt").write_text(llms(pages))
    print("wrote sitemap.xml, llms.txt")


if __name__ == "__main__":
    main()
