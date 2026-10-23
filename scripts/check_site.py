#!/usr/bin/env python3
"""Check the page catalog, local asset references, sequences and JS syntax."""
import json
import re
import shutil
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
errors = set()
references = set()


def reference(source, value):
    value = value.strip()
    if not value or value.startswith("#") or any(c in value for c in "${}<> "):
        return
    url = urlsplit(value)
    if url.scheme or url.netloc:
        return
    path = unquote(url.path)
    if not path:
        return
    target = ((SITE / path.lstrip("/")) if path.startswith("/") else source.parent / path).resolve()
    if SITE.resolve() not in target.parents and target != SITE.resolve():
        errors.add("%s: reference escapes site/: %s" % (source.relative_to(ROOT), value))
    elif not target.exists():
        errors.add("%s: missing %s" % (source.relative_to(ROOT), value))
    else:
        references.add(target)


class PageParser(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.source = source

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if value is None:
                continue
            if key in ("src", "href", "poster"):
                reference(self.source, value)
            elif key == "srcset" and not value.startswith("data:"):
                for candidate in value.split(","):
                    fields = candidate.strip().split()
                    if fields:
                        reference(self.source, fields[0])


def main():
    catalog = json.loads((ROOT / "docs/projects.json").read_text())
    slugs = [p["slug"] for p in catalog["projects"]]
    actual = sorted(p.name for p in (SITE / "work").iterdir() if p.is_dir())
    if sorted(slugs) != actual or len(slugs) != len(set(slugs)):
        errors.add("Project catalog does not match site/work/ directories")
    for slug in slugs:
        for name in ("index.html", "style.css", "main.js", "favicon.svg"):
            if not (SITE / "work" / slug / name).is_file():
                errors.add("Missing required page file: %s/%s" % (slug, name))
    for route in ['index.html','work/index.html','_studio/style.css','_studio/main.js','_studio/fog.js','_studio/social.jpg']:
        if not (SITE / route).is_file():
            errors.add('Missing portfolio file: '+route)
    actual_stories=sorted(p.name for p in (SITE / 'projects').iterdir() if p.is_dir()) if (SITE / 'projects').exists() else []
    if sorted(slugs)!=actual_stories:
        errors.add('Project stories do not match the catalog')
    for project in catalog['projects']:
        slug=project['slug']
        for field in ['premise','signature','brief','interactions','decisions','tags','palette','credits','media']:
            if not project.get(field):
                errors.add('%s: missing story field %s' % (slug,field))
        if len(project.get('interactions',[])) not in range(2,5) or len(project.get('decisions',[])) not in range(2,4):
            errors.add(slug+': incomplete interaction or decision content')
        for field in ['desktop','phone','blur','desktopClip','phoneClip']:
            value=project.get('media',{}).get(field)
            if value:
                reference(ROOT / 'docs/projects.json',value)
            else:
                errors.add('%s: missing %s media' % (slug,field))
        if not (SITE / 'projects' / slug / 'index.html').is_file():
            errors.add('Missing story: '+slug)
    generated=subprocess.run([sys.executable,str(ROOT/'scripts/build_portfolio.py'),'--check'],text=True,capture_output=True)
    if generated.returncode:
        errors.add(generated.stdout+generated.stderr)
    for sequence in catalog.get("sequences", []):
        folder = SITE / sequence["directory"]
        expected = {"%04d.webp" % n for n in range(sequence["count"])}
        actual_frames = {p.name for p in folder.glob("*.webp")}
        if actual_frames != expected:
            errors.add("%s: frame set differs from catalog" % sequence["directory"])
    node = shutil.which("node")
    if not node:
        errors.add("Node.js is required for JavaScript syntax checks")
    js_count = 0
    for source in sorted(SITE.rglob("*")):
        if not source.is_file():
            continue
        if source.suffix in (".js", ".mjs") and node:
            result = subprocess.run([node, "--input-type=module", "--check"],
                                    input=source.read_text(), text=True, capture_output=True)
            js_count += 1
            if result.returncode:
                errors.add("%s: %s" % (source.relative_to(ROOT), result.stderr.strip()))
        if "_src" in source.parts:
            continue
        if source.suffix not in (".html", ".css", ".js", ".svg"):
            continue
        text = source.read_text()
        if source.suffix == ".html":
            PageParser(source).feed(text)
        if source.suffix in (".css", ".html", ".svg"):
            # Consume quoted data URLs whole, including nested SVG url(#filter) text.
            for groups in re.findall(r'''url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)''', text):
                reference(source, next((value for value in groups if value), ""))
        if source.suffix == ".js":
            # Static local imports and literal asset paths; generated frame paths are checked above.
            for value in re.findall(r"['\"]((?:\./|\.\./|img/|model/|plots/|seq/)[^'\"\n]+)['\"]", text):
                if re.search(r"\.(?:js|json|jpg|jpeg|png|webp|svg|glb|mp3|woff2?)(?:\?|$)", value):
                    reference(source, value)
    if errors:
        print("\n".join(sorted(errors)), file=sys.stderr)
        return 1
    print("OK: %d concepts + 27 portfolio pages, %d local asset targets, %d JavaScript files, %d frame sequences." %
          (len(slugs), len(references), js_count, len(catalog.get("sequences", []))))
    return 0


if __name__ == "__main__":
    sys.exit(main())
