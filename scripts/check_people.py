#!/usr/bin/env python3
"""Check the people/organizations registry against the documents and entries.

Fails (exit 1) if:
  - a document or entry tags a slug that has no file in _people/
  - a slug in `people:` is not kind person, or a slug in `orgs:` is not kind org
  - a person's `org:` is missing from _people/ or is not an organization
  - a registry entry has no `role` (write "Role not stated in the records." if so)
  - a registry entry is never used (not tagged anywhere and not an employer of a used person)
  - two entries share a name or alias (case-insensitive)

Run before building:  python3 scripts/check_people.py
No dependencies; front matter here is simple enough to parse with regexes.
"""
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def front(path):
    m = re.match(r"---\n(.*?)\n---\n", path.read_text(), re.S)
    return m.group(1) if m else ""


def scalar(fm, key):
    m = re.search(rf"^{key}:\s*(.*)$", fm, re.M)
    if not m:
        return None
    v = m.group(1).strip()
    return v[1:-1] if len(v) > 1 and v[0] == v[-1] and v[0] in "\"'" else v


def listing(fm, key):
    m = re.search(rf"^{key}:\s*\[(.*?)\]\s*(?:#.*)?$", fm, re.M)
    if not m:
        return []
    return [x.strip().strip("\"'") for x in m.group(1).split(",") if x.strip()]


def warn_overview():
    """Warn (don't fail) if a record is newer than the date the home page overview covers."""
    import os
    cfg = (ROOT / "_config.yml").read_text()
    m = re.search(r"^overview_through:\s*(\d{4}-\d{2}-\d{2})", cfg, re.M)
    if not m:
        return
    through = m.group(1)
    newest = ("", "")
    for folder in ("_documents", "_entries"):
        for p in sorted((ROOT / folder).glob("*.md")):
            fm = front(p)
            # compilations are covered by their entries; undated documents carry a placeholder date
            if re.search(r"^(compilation|undated):\s*true", fm, re.M):
                continue
            d = scalar(fm, "date") or ""
            if d > newest[0]:
                newest = (d, f"{folder}/{p.name}")
    if newest[0] > through:
        msg = (f"The home page overview covers records through {through}, but {newest[1]} is dated "
               f"{newest[0]}. Update the overview (index.md and its Spanish twin es/index.md) and overview_through/overview_reviewed in _config.yml.")
        print(("::warning::" if os.environ.get("GITHUB_ACTIONS") else "WARNING: ") + msg)


def main():
    errors = []
    registry = {}
    for p in sorted((ROOT / "_people").glob("*.md")):
        fm = front(p)
        registry[p.stem] = {
            "title": scalar(fm, "title"), "kind": scalar(fm, "kind"), "role": scalar(fm, "role"),
            "org": scalar(fm, "org"), "aliases": listing(fm, "aliases"),
        }
    used = set()
    for folder in ("_documents", "_entries"):
        for p in sorted((ROOT / folder).glob("*.md")):
            fm = front(p)
            for field, kind in (("people", "person"), ("orgs", "org")):
                for slug in listing(fm, field):
                    used.add(slug)
                    if slug not in registry:
                        errors.append(f"{folder}/{p.name}: unknown {field} slug '{slug}'")
                    elif registry[slug]["kind"] != kind:
                        errors.append(f"{folder}/{p.name}: '{slug}' is kind {registry[slug]['kind']}, listed under {field}")
    for slug, r in registry.items():
        if r["kind"] not in ("person", "org"):
            errors.append(f"_people/{slug}.md: kind must be person or org")
        if not r["title"]:
            errors.append(f"_people/{slug}.md: missing title")
        if not r["role"]:
            errors.append(f"_people/{slug}.md: missing role (use \"Role not stated in the records.\")")
        if r["org"]:
            if r["org"] not in registry:
                errors.append(f"_people/{slug}.md: org '{r['org']}' not found")
            elif registry[r["org"]]["kind"] != "org":
                errors.append(f"_people/{slug}.md: org '{r['org']}' is not an organization")
    employers = {r["org"] for s, r in registry.items() if r["org"] and s in used}
    for slug in registry:
        if slug not in used and slug not in employers:
            errors.append(f"_people/{slug}.md: never used by any document or entry")
    seen = {}
    for slug, r in registry.items():
        for name in [r["title"] or ""] + r["aliases"]:
            key = name.lower()
            if key and seen.setdefault(key, slug) != slug:
                errors.append(f"name/alias '{name}' used by both {seen[key]} and {slug}")
    warn_overview()
    if errors:
        print("People registry problems:")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    kinds = [r["kind"] for r in registry.values()]
    print(f"People registry OK: {kinds.count('person')} people, {kinds.count('org')} organizations.")


if __name__ == "__main__":
    main()
