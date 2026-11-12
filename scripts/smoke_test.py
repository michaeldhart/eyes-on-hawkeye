#!/usr/bin/env python3
"""Smoke-test a running copy of the site: a local preview, the CI build, or the live site.

It asks "is the site up and not obviously broken?", not "is every claim right?".
Checks, against --base-url:
  - sitemap.xml: every URL it lists returns 200 and has a <title>, and both
    the English and Spanish home pages are listed
  - robots.txt returns 200
  - timeline.json and search.json are valid, non-empty JSON lists
  - every timeline page link and PDF link returns 200 (PDF links must be PDFs)
  - every document in _documents/ has an English and a Spanish page that show
    the PDF link, its sha256 and the AI-summary note
  - the English home page declares hreflang en, es and x-default
With --hash-pdfs it also downloads each PDF and compares it with the sha256 in
the document's front matter (what the site really serves, not just the repo).

Exit code 1 and a list of failures if anything is wrong.

  python3 scripts/smoke_test.py --base-url http://127.0.0.1:4000
  python3 scripts/smoke_test.py --base-url https://eyesonhawkeye.com --retries 8 --retry-wait 15 --hash-pdfs

--retries/--retry-wait cover the wait for a fresh deploy to appear (CDN lag); once
the home page answers, later requests use at most 2 retries.
No dependencies; reuses the front-matter helpers from check_people.py.
"""
import argparse
import hashlib
import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

from check_people import front, scalar

ROOT = Path(__file__).resolve().parent.parent
UA = "eyes-on-hawkeye-smoke-test"


class Site:
    def __init__(self, base, retries, wait):
        self.base = base.rstrip("/")
        self.retries = retries
        self.wait = wait

    def get(self, path, method="GET", retries=None):
        """Return (status, headers, body). Status 0 means a network error."""
        url = self.base + path
        retries = self.retries if retries is None else retries
        last = (0, {}, b"")
        for attempt in range(retries + 1):
            try:
                req = urllib.request.Request(url, method=method, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=60) as r:
                    return r.status, r.headers, (r.read() if method == "GET" else b"")
            except urllib.error.HTTPError as e:
                last = (e.code, e.headers, b"")
            except Exception as e:  # connection refused, timeout, DNS...
                last = (0, {}, str(e).encode())
            if attempt < retries:
                time.sleep(self.wait)
        return last


def yaml_string(path, key):
    m = re.search(rf'^{key}:\s*"(.*)"\s*$', path.read_text(), re.M)
    return m.group(1) if m else None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base-url", required=True)
    ap.add_argument("--retries", type=int, default=0, help="retries while waiting for the site to answer")
    ap.add_argument("--retry-wait", type=float, default=5, help="seconds between retries")
    ap.add_argument("--hash-pdfs", action="store_true", help="download each PDF and compare its sha256")
    args = ap.parse_args()

    site = Site(args.base_url, args.retries, args.retry_wait)
    failures = []
    fail = failures.append

    # Wait for the site (a fresh deploy can take a moment to appear).
    status, _, home = site.get("/")
    if status != 200:
        print(f"Smoke test FAILED: {site.base}/ returned {status or 'no response'}")
        sys.exit(1)
    after = min(2, args.retries)
    get = lambda path, **kw: site.get(path, retries=kw.pop("retries", after), **kw)  # noqa: E731

    # 1. Sitemap pages
    status, _, body = get("/sitemap.xml")
    paths = []
    if status != 200:
        fail(f"/sitemap.xml returned {status}")
    else:
        paths = [urlparse(u).path or "/" for u in re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", body.decode("utf-8", "replace"))]
        if "/" not in paths or "/es/" not in paths:
            fail("sitemap.xml does not list both / and /es/")
    for p in paths:
        s, _, b = get(p)
        if s != 200:
            fail(f"{p} returned {s}")
        elif b"<title" not in b:
            fail(f"{p} has no <title>")

    # 2. robots.txt
    s, _, _ = get("/robots.txt")
    if s != 200:
        fail(f"/robots.txt returned {s}")

    # 3. JSON feeds
    timeline = []
    for name in ("timeline.json", "search.json"):
        s, _, b = get("/" + name)
        if s != 200:
            fail(f"/{name} returned {s}")
            continue
        try:
            data = json.loads(b)
        except ValueError as e:
            fail(f"/{name} is not valid JSON ({e})")
            continue
        if not isinstance(data, list) or not data:
            fail(f"/{name} is empty or not a list")
        elif name == "timeline.json":
            timeline = data

    # 4. Timeline links (this is the check that catches broken PDF links)
    seen = set()
    for item in timeline:
        for key in ("url", "pdf"):
            target = (item.get(key) or "").split("#")[0]
            if not target.startswith("/") or (key, target) in seen:
                continue
            seen.add((key, target))
            method = "HEAD" if key == "pdf" else "GET"
            s, h, _ = get(target, method=method)
            if s != 200:
                fail(f"timeline {key} link {target} returned {s} (item {item.get('id')})")
            elif key == "pdf" and "pdf" not in (h.get("Content-Type") or "").lower():
                fail(f"timeline pdf link {target} is not a PDF (Content-Type {h.get('Content-Type')})")

    # 5. Document pages, both languages
    notes = {
        "": yaml_string(ROOT / "_data/i18n/en.yml", "ai_note"),
        "/es": yaml_string(ROOT / "_data/i18n/es.yml", "ai_note"),
    }
    docs = sorted((ROOT / "_documents").glob("*.md"))
    for doc in docs:
        fm = front(doc)
        file_, sha = scalar(fm, "file"), scalar(fm, "sha256")
        for prefix, note in notes.items():
            path = f"{prefix}/documents/{doc.stem}/"
            s, _, b = get(path)
            if s != 200:
                fail(f"{path} returned {s}")
                continue
            text = html.unescape(b.decode("utf-8", "replace"))
            if file_ and file_ not in text:
                fail(f"{path} does not link the PDF {file_}")
            if sha and sha not in text:
                fail(f"{path} does not show the sha256")
            if note and note not in text:
                fail(f"{path} is missing the AI-summary note")

    # 6. hreflang on the English home page
    home_text = home.decode("utf-8", "replace")
    for lang in ("en", "es", "x-default"):
        if f'hreflang="{lang}"' not in home_text:
            fail(f'home page has no hreflang="{lang}"')

    # 7. What the site really serves (optional, slower)
    if args.hash_pdfs:
        for doc in docs:
            fm = front(doc)
            file_, sha = scalar(fm, "file"), scalar(fm, "sha256")
            if not (file_ and sha):
                continue
            s, _, b = get(file_)
            if s != 200:
                fail(f"{file_} returned {s}")
            elif hashlib.sha256(b).hexdigest() != sha.lower():
                fail(f"{file_} as served does not match its sha256")

    if failures:
        print(f"Smoke test FAILED against {site.base} ({len(failures)} problems):")
        for f in failures:
            print(f"  - {f}")
        sys.exit(1)
    extra = ", PDF hashes verified" if args.hash_pdfs else ""
    print(f"Smoke test OK against {site.base}: {len(paths)} sitemap pages, {len(seen)} timeline links, "
          f"{len(docs)} documents in both languages{extra}.")


if __name__ == "__main__":
    main()
