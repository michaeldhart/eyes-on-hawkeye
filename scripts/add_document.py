#!/usr/bin/env python3
"""Add a PDF to the site as a document.

    scripts/add_document.py path/to/file.pdf --title "..." --date 2026-05-26 \
        --type agreement --source "City Clerk" --source-url https://... \
        --summary "..." --tags water,zoning

Copies the PDF into assets/documents/ (unchanged), extracts its text (using the
PDF's own text layer, or OCR via ocrmypdf if it is a scan), and writes
_documents/<slug>.md with front matter. Review and edit the result by hand.
Requires poppler (pdftotext, pdfinfo); scans also need ocrmypdf.
"""
import argparse, html, re, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TYPES = ["agenda", "minutes", "application", "staff-report", "ordinance",
         "correspondence", "agreement", "other"]


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def yq(s):
    """Quote a string for YAML front matter."""
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def pdf_pages(pdf):
    out = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True, check=True).stdout
    return int(re.search(r"^Pages:\s+(\d+)", out, re.M).group(1))


def extract_text(pdf, ocr_ok=True):
    """Return (text with \\f between pages, was_ocr)."""
    text = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, text=True).stdout
    if len(text.replace("\f", "").strip()) >= 100 * max(1, pdf_pages(pdf)) * 0.2:
        return text, False
    if not ocr_ok:
        return text, False
    print("No usable text layer; running OCR (this can take a while)...", file=sys.stderr)
    with tempfile.TemporaryDirectory() as td:
        side = Path(td) / "t.txt"
        subprocess.run(["ocrmypdf", "--force-ocr", "--sidecar", str(side), str(pdf), str(Path(td) / "o.pdf")], check=True)
        return side.read_text(), True


def body_from_text(text):
    pages = text.split("\f")
    if pages and not pages[-1].strip():
        pages.pop()
    parts = []
    for n, p in enumerate(pages, 1):
        p = re.sub(r"\n{3,}", "\n\n", p.strip())
        parts.append(f"---- page {n} ----\n\n{html.escape(p, quote=False)}")
    # {% raw %} keeps Liquid from interpreting OCR noise like "{{" or "{%"
    return '{% raw %}<pre class="doc-text">' + "\n\n".join(parts) + "</pre>{% endraw %}\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf")
    ap.add_argument("--title", required=True)
    ap.add_argument("--date", required=True, help="YYYY-MM-DD (the date shown on the timeline)")
    ap.add_argument("--type", required=True, choices=TYPES)
    ap.add_argument("--slug")
    ap.add_argument("--source", default="")
    ap.add_argument("--source-url", default="")
    ap.add_argument("--summary", default="")
    ap.add_argument("--tags", default="")
    ap.add_argument("--compilation", action="store_true",
                    help="PDF bundles many items (e.g. an email dump); describe its parts as _entries instead of one dot")
    ap.add_argument("--undated", action="store_true", help="the document itself carries no date; --date is a placeholder")
    ap.add_argument("--text", help="use this text file (pages separated by form feeds) instead of extracting")
    ap.add_argument("--no-ocr", action="store_true")
    ap.add_argument("--force", action="store_true", help="overwrite an existing document")
    a = ap.parse_args()

    src = Path(a.pdf).resolve()
    dest = ROOT / "assets" / "documents" / src.name
    dest.parent.mkdir(parents=True, exist_ok=True)
    if src != dest:
        shutil.copy2(src, dest)

    slug = a.slug or slugify(a.title)
    out = ROOT / "_documents" / f"{slug}.md"
    if out.exists() and not a.force:
        sys.exit(f"{out} exists; use --force to overwrite")

    if a.text:
        text, ocr = Path(a.text).read_text(), True
    else:
        text, ocr = extract_text(dest, ocr_ok=not a.no_ocr)

    fm = ["---", f"title: {yq(a.title)}", f"date: {a.date}", f"type: {a.type}"]
    if a.source: fm.append(f"source: {yq(a.source)}")
    if a.source_url: fm.append(f"source_url: {a.source_url}")
    fm.append(f"file: /assets/documents/{src.name}")
    fm.append(f"pages_count: {pdf_pages(dest)}")
    fm.append(f"summary: {yq(a.summary)}")
    tags = [t.strip() for t in a.tags.split(",") if t.strip()]
    fm.append("tags: [" + ", ".join(tags) + "]")
    if ocr: fm.append("ocr: true")
    if a.compilation: fm.append("compilation: true")
    if a.undated: fm.append("undated: true")
    fm.append("---\n")

    out.parent.mkdir(exist_ok=True)
    out.write_text("\n".join(fm) + "\n" + body_from_text(text))
    print(f"Wrote {out.relative_to(ROOT)}  (PDF: {dest.relative_to(ROOT)})")


if __name__ == "__main__":
    main()
