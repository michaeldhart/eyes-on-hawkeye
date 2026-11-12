#!/usr/bin/env python3
"""Check that every hosted PDF is exactly the file the city published.

Fails (exit 1) if:
  - a document has no `file:`, or the file it names is not in the repo
  - a document's `sha256:` is missing or does not match its PDF
  - a PDF in assets/documents/ is not used by any document (orphan)

Prints (does not fail on) a warning for PDFs over 25 MB, the same threshold
scripts/add_document.py warns at.

The PDF is the record: it must never be edited, and its sha256 is computed
only by scripts/add_document.py when the document is added.

Run before building:  python3 scripts/check_pdfs.py
No dependencies; reuses the front-matter helpers from check_people.py.
"""
import hashlib
import sys
from pathlib import Path

from check_people import front, scalar

ROOT = Path(__file__).resolve().parent.parent
WARN_BYTES = 25 * 1024 * 1024


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    problems, warnings, used = [], [], set()
    docs = sorted((ROOT / "_documents").glob("*.md"))
    for doc in docs:
        fm = front(doc)
        file_ = scalar(fm, "file")
        want = scalar(fm, "sha256")
        if not file_:
            problems.append(f"{doc.name}: no `file:` in front matter")
            continue
        pdf = ROOT / file_.lstrip("/")
        used.add(pdf.resolve())
        if not pdf.is_file():
            problems.append(f"{doc.name}: file {file_} does not exist")
            continue
        if not want:
            problems.append(f"{doc.name}: no `sha256:` in front matter")
        elif sha256_of(pdf) != want.lower():
            problems.append(
                f"{doc.name}: sha256 does not match {file_} "
                "(was the PDF changed? it must stay the file the city published)"
            )
        if pdf.stat().st_size > WARN_BYTES:
            warnings.append(f"{file_} is over 25 MB; see CLAUDE.md on where PDFs live")

    for pdf in sorted((ROOT / "assets" / "documents").glob("*.pdf")):
        if pdf.resolve() not in used:
            problems.append(f"{pdf.relative_to(ROOT)} is not used by any document")

    for w in warnings:
        print(f"warning: {w}")
    if problems:
        print("PDF check FAILED:")
        for p in problems:
            print(f"  - {p}")
        sys.exit(1)
    print(f"PDFs OK: {len(docs)} documents, every sha256 matches its file.")


if __name__ == "__main__":
    main()
