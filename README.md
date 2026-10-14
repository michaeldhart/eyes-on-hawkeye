# Eyes on Hawkeye

A community-run archive of public records about the proposed data center ("Project Hawkeye") in Belvidere, Illinois. We collect the documents the city has released, keep our own copy of each, summarize them in plain language, and put them in order so residents can see what has been promised, by whom, and when.

Live site: https://eyesonhawkeye.com (custom domain on GitHub Pages; DNS at GoDaddy)

The site is a Jekyll static site with a home page, a document index, full-text search, and a horizontally scrolling timeline. Content is added by hand (by the maintainers, with Claude's help). There is no admin interface and no upload form.

## Run locally

```sh
bundle install
bundle exec jekyll serve --baseurl ""   # http://localhost:4000
```

Requires Ruby 3.x and Bundler. For adding documents you also need `brew install poppler ocrmypdf`.

## Content model

Two collections, kept separate on purpose:

- **Documents** (`_documents/<slug>.md`): one per hosted PDF. Front matter holds the metadata and the body is the extracted text. PDFs are stored unchanged in `assets/documents/`.
- **Entries** (`_entries/<date>-<slug>.md`): extra timeline items that point *into* a document (`document: <slug>`, `pages: 14-17`). Used to break a bundled PDF, such as a 300-page email dump, into individual conversations. Entries can carry their own summary and type.

Every document appears on the timeline automatically, except compilations, undated documents, and those marked `timeline: false`.

### Document front matter

```yaml
title: "..."
date: 2026-05-26            # the date shown on the timeline
type: contract              # a slug from _data/types.yml
source: "City of Belvidere"
source_url: https://...     # where the city published it
file: /assets/documents/Name.pdf
pages_count: 5
sha256: <hex>               # fingerprint of the original PDF (add_document.py fills it in)
summary: "Our plain-language summary."
tags: [hawkeye, datawatt]   # single words only
people: [mike-drella]       # slugs from _people/
orgs: [city-of-belvidere]
ocr: true                   # text was machine-read from a scan
```

Optional flags: `compilation: true` (the PDF bundles many items; describe the parts as entries instead of one dot), `undated: true` (the document carries no date; `date` is a placeholder), `timeline: false`.

### Types and tags

- **Type** is a single category per document, defined in `_data/types.yml` (slug, label, color). It drives the badge, the index filter and the timeline dot color. Edit that file to add or rename types; the timeline and `add_document.py` pick them up automatically. If you change a slug, update the documents that use it.
- **Tags** are free-form topics, several per document. Keep each tag to a single lowercase word.

## People and organizations

Every person and organization named in the records has a file in `_people/<slug>.md` (front matter: `title`, `kind: person|org`, `role`, `org`, `aliases`, `role_source`). Documents and entries tag them with `people: [slug, ...]` and `orgs: [slug, ...]`. Pages are generated: an index at `/people/`, a page per name with every document and entry that names them, and a "People and Organizations Named" list on each document page (its own tags plus those of its timeline entries). Entries are tagged too, so the big email compilation doesn't make everyone link to one PDF.

Scope: tag everyone who sends, receives or is substantively named in the conversation an entry summarizes. Don't tag incidental citations (for example companies mentioned as market examples on a slide). Roles must come from the records: put where in `role_source`, and write "title not stated in the records" when it isn't. No contact details. `python3 scripts/check_people.py` (also run in the deploy workflow) fails on unknown slugs, wrong kinds, unused or duplicate names.

## Adding a document

```sh
scripts/add_document.py ~/Downloads/file.pdf --title "..." --date 2026-05-26 \
  --type contract --source "City Clerk" --source-url https://... \
  --summary "..." --tags water,zoning
```

The script copies the PDF, extracts text (OCR via `ocrmypdf` if it is a scan), and writes the document file. Always read the result and correct the title (Title Case), date and summary by hand. OCR text is machine-made and the PDF is the record.

## Analytics

Page views are counted with [GoatCounter](https://www.goatcounter.com) (site code `eyesonhawkeye`, set as `goatcounter_code` in `_config.yml`). It is cookieless and collects no personal data. It only loads in production builds, so local previews don't record hits. The public dashboard is at https://eyesonhawkeye.goatcounter.com and the About page discloses what is collected.

## Deploy

Pushes to `main` build and deploy through GitHub Actions (`.github/workflows/pages.yml`) to GitHub Pages.

## Status and next steps

- Skeleton is built and live with four documents from the city's [data center information page](https://www.belvidereil.gov/recent-data-center-information/).
- **Communications file:** the 313-page email compilation is stored as one document and summarized as 31 timeline entries (Nov 2024 to Jul 2026). New compilations can be handled the same way.
- **File storage:** PDFs live in git, with a SHA-256 fingerprint for each on its document page. Decision: stay in git until the total passes about 500 MB or a single file passes about 50 MB, then move large files to object storage (Cloudflare R2 is the likely choice). Avoid Git LFS: Pages deploys through Actions, and every deploy would pull the LFS files against the free bandwidth quota. `add_document.py` warns above 25 MB. Keep a separate backup of the originals outside GitHub.
- The Contact page links to a Google Form (`contact_form_url` in `_config.yml`).

## License

Apache 2.0 for the code. The documents are public records published by their original sources.
