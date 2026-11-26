import argparse
from html import escape, unescape
import json
from pathlib import Path
import re
import shutil
from urllib.parse import urlsplit
from xml.etree import ElementTree


SITE = Path(__file__).resolve().parents[1] / "site"
BRANCHES = {
    "murino": {
        "name": "Мал да велик — Мурино",
        "street": "улица Шувалова, 46",
        "locality": "Мурино",
        "region": "Ленинградская область",
        "phone": "+79697005007",
        "hours": "Mo-Fr 07:00-20:00",
    },
    "kudrovo": {
        "name": "Мал да велик — Кудрово",
        "street": "Европейский проспект, 13, корпус 4",
        "locality": "Кудрово",
        "region": "Ленинградская область",
        "phone": "+79627172724",
        "hours": "Mo-Fr 07:00-20:00",
    },
    "kondr": {
        "name": "Мал да велик — Кондратьевский",
        "street": "Кондратьевский проспект, 70, корпус 1",
        "locality": "Санкт-Петербург",
        "region": "Санкт-Петербург",
        "phone": "+79052102040",
        "hours": "Mo-Fr 07:30-19:30",
    },
}


def structured_data(base_url, page_url, page_path):
    organization = {"@id": f"{base_url}#organization"}
    if page_path == Path("index.html"):
        return {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "WebSite",
                    "@id": f"{base_url}#website",
                    "url": base_url,
                    "name": "Мал да велик",
                    "inLanguage": "ru",
                    "publisher": organization,
                },
                {
                    **organization,
                    "@type": "Organization",
                    "url": base_url,
                    "name": "Мал да велик",
                    "logo": f"{base_url}assets/logo.png",
                    "subOrganization": [
                        {"@id": f"{base_url}gardens/{branch}/#preschool"}
                        for branch in BRANCHES
                    ],
                },
            ],
        }
    if page_path.parts[0] == "gardens" and len(page_path.parts) == 3:
        branch = page_path.parent.name
        details = BRANCHES[branch]
        return {
            "@context": "https://schema.org",
            "@type": "Preschool",
            "@id": f"{page_url}#preschool",
            "name": details["name"],
            "url": page_url,
            "image": f"{base_url}assets/{branch}.webp",
            "parentOrganization": organization,
            "telephone": details["phone"],
            "openingHours": details["hours"],
            "address": {
                "@type": "PostalAddress",
                "streetAddress": details["street"],
                "addressLocality": details["locality"],
                "addressRegion": details["region"],
                "addressCountry": "RU",
            },
        }
    return None


def build(base_url, output, production):
    shutil.copytree(SITE, output, ignore=shutil.ignore_patterns(".DS_Store"))
    sitemap = ElementTree.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")

    for page in sorted(output.rglob("index.html")):
        page_path = page.relative_to(output)
        relative_url = page_path.as_posix().removesuffix("index.html")
        page_url = base_url + relative_url
        source = page.read_text(encoding="utf-8")
        title = unescape(re.search(r"<title>([^<]+)</title>", source)[1])
        description = unescape(re.search(r'<meta name="description" content="([^"]+)">', source)[1])
        social_tags = {
            "og:type": "website",
            "og:locale": "ru_RU",
            "og:site_name": "Мал да велик",
            "og:url": page_url,
            "og:title": title,
            "og:description": description,
            "og:image": f"{base_url}assets/social-preview.jpg",
            "og:image:width": "1200",
            "og:image:height": "630",
        }
        head = [f'<meta property="{name}" content="{escape(value)}">' for name, value in social_tags.items()]
        if production:
            head.append(f'<link rel="canonical" href="{escape(page_url)}">')
            data = structured_data(base_url, page_url, page_path)
            if data:
                head.append(f'<script type="application/ld+json">{json.dumps(data, ensure_ascii=False)}</script>')
            ElementTree.SubElement(ElementTree.SubElement(sitemap, "url"), "loc").text = page_url
        else:
            head.append('<meta name="robots" content="noindex, nofollow">')

        source = re.sub(r'^  <meta property="og:[^\n]+\n', "", source, flags=re.MULTILINE)
        source = source.replace("</head>", "  " + "\n  ".join(head) + "\n</head>", 1)
        source = re.sub(
            r'(?<=href=")((?:\.{1,2}/)*(?:[\w-]+/)*)index\.html(?=[?#"])',
            lambda match: match[1] or "./",
            source,
        )
        page.write_text(source, encoding="utf-8")

    if production:
        ElementTree.indent(sitemap)
        ElementTree.ElementTree(sitemap).write(output / "sitemap.xml", encoding="utf-8", xml_declaration=True)
        (output / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {base_url}sitemap.xml\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Собрать статический сайт для публикации.")
    parser.add_argument("base_url", help="Публичный HTTPS-адрес сайта")
    parser.add_argument("output", type=Path, help="Новый каталог для готового сайта")
    parser.add_argument("--production", action="store_true", help="Разрешить индексацию на постоянном домене")
    args = parser.parse_args()
    url = urlsplit(args.base_url)
    if url.scheme != "https" or not url.hostname or url.username or url.query or url.fragment:
        parser.error("Укажите публичный HTTPS-адрес без учётных данных и параметров.")
    if args.production and url.path not in ("", "/"):
        parser.error("Для постоянного сайта нужен адрес в корне домена.")
    build(args.base_url.rstrip("/") + "/", args.output, args.production)
