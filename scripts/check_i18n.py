#!/usr/bin/env python3
"""Check that everything the site shows has a Spanish version.

Fails (exit 1) if:
  - _data/i18n/es.yml is missing a key that en.yml has, or a template uses a key en.yml lacks
  - a type in _data/types.yml has no label_es, or a document tag has no entry in _data/i18n/tags_es.yml
  - a document lacks title_es or summary_es (and date_note_es when it has a date_note)
  - a timeline entry lacks title_es or summary_es
  - a person or organization lacks role_es (and role_source_es when it has role_source),
    or has a body but no note_es
  - the hand-written Spanish pages es/index.md, es/about.md, es/contact.md are missing

Prints (does not fail on) how many records a person hasn't reviewed yet: es_reviewed: true in a
record's front matter marks a translation a Spanish speaker has checked.

Run before building:  python3 scripts/check_i18n.py
"""
import re, sys
from pathlib import Path

from check_people import front, scalar, listing

ROOT = Path(__file__).resolve().parent.parent
I18N = ROOT / "_data" / "i18n"
# Keys that only make sense in Spanish and are left empty in en.yml.
ES_ONLY = {"es_reviewed_note", "es_unreviewed_note", "es_unreviewed_page", "doc_english_note"}


def keys_of(path):
    return dict(re.findall(r"^([a-z0-9_]+):\s*(.*)$", path.read_text(), re.M))


def main():
    errors = []
    en, es = keys_of(I18N / "en.yml"), keys_of(I18N / "es.yml")
    for k in en:
        if k not in es:
            errors.append(f"_data/i18n/es.yml: missing '{k}'")
    for k in es:
        if k not in en:
            errors.append(f"_data/i18n/en.yml: missing '{k}' (present in es.yml)")
    used = set()
    for p in list(ROOT.glob("*.html")) + list(ROOT.glob("*.md")) + list(ROOT.glob("*.json")) + \
            list((ROOT / "_layouts").glob("*")) + list((ROOT / "_includes").glob("*")) + \
            list((ROOT / "documents").glob("*")) + list((ROOT / "people").glob("*")) + list((ROOT / "es").glob("*")):
        used.update(re.findall(r"'([a-z0-9_]+)'\s*\|\s*t\b", p.read_text()))
    for p in (ROOT / "assets" / "js").glob("*.js"):
        used.update(re.findall(r"\bT\('([a-z0-9_]+)'", p.read_text()))
    for k in sorted(used - set(en)):
        errors.append(f"a template or script uses '{k}', which is not in _data/i18n/en.yml")

    types = (ROOT / "_data" / "types.yml").read_text()
    for slug, body in re.findall(r"^([a-z][a-z0-9-]*):\s*\{(.*)\}", types, re.M):
        if "label_es" not in body:
            errors.append(f"_data/types.yml: '{slug}' has no label_es")

    tags_es = keys_of(I18N / "tags_es.yml")
    reviewed = total = 0

    def need(path, fm, *fields):
        nonlocal reviewed, total
        for f in fields:
            if not scalar(fm, f + "_es"):
                errors.append(f"{path.relative_to(ROOT)}: missing {f}_es")
        total += 1
        reviewed += bool(re.search(r"^es_reviewed:\s*true", fm, re.M))

    for p in sorted((ROOT / "_documents").glob("*.md")):
        fm = front(p)
        need(p, fm, "title", *(["summary"] if scalar(fm, "summary") else []), *(["date_note"] if scalar(fm, "date_note") else []))
        for t in listing(fm, "tags"):
            if t not in tags_es:
                errors.append(f"{p.relative_to(ROOT)}: tag '{t}' is not in _data/i18n/tags_es.yml")
    for p in sorted((ROOT / "_entries").glob("*.md")):
        fm = front(p)
        need(p, fm, "title", *(["summary"] if scalar(fm, "summary") else []))
    for p in sorted((ROOT / "_people").glob("*.md")):
        fm = front(p)
        need(p, fm, "role", *(["role_source"] if scalar(fm, "role_source") else []))
        body = p.read_text().split("\n---\n", 1)[1].strip()
        if body and not scalar(fm, "note_es"):
            errors.append(f"{p.relative_to(ROOT)}: has a body, so it needs note_es")
    for name in ("index.md", "about.md", "contact.md"):
        if not (ROOT / "es" / name).exists():
            errors.append(f"es/{name}: missing (hand-written Spanish page)")

    if errors:
        print("Spanish translation problems:")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    print(f"Spanish OK: every record has its translation. {reviewed} of {total} records reviewed by a person.")


if __name__ == "__main__":
    main()
