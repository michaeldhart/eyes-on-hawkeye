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
summary: "Our plain-language summary."
tags: [hawkeye, datawatt]   # single words only
ocr: true                   # text was machine-read from a scan
```

Optional flags: `compilation: true` (the PDF bundles many items; describe the parts as entries instead of one dot), `undated: true` (the document carries no date; `date` is a placeholder), `timeline: false`.

### Types and tags

- **Type** is a single category per document, defined in `_data/types.yml` (slug, label, color). It drives the badge, the index filter and the timeline dot color. Edit that file to add or rename types; the timeline and `add_document.py` pick them up automatically. If you change a slug, update the documents that use it.
- **Tags** are free-form topics, several per document. Keep each tag to a single lowercase word.

## Adding a document

```sh
scripts/add_document.py ~/Downloads/file.pdf --title "..." --date 2026-05-26 \
  --type contract --source "City Clerk" --source-url https://... \
  --summary "..." --tags water,zoning
```

The script copies the PDF, extracts text (OCR via `ocrmypdf` if it is a scan), and writes the document file. Always read the result and correct the title (Title Case), date and summary by hand. OCR text is machine-made and the PDF is the record.

## Deploy

Pushes to `main` build and deploy through GitHub Actions (`.github/workflows/pages.yml`) to GitHub Pages.

## Status and next steps

- Skeleton is built and live with four documents from the city's [data center information page](https://www.belvidereil.gov/recent-data-center-information/).
- **Communications file:** the 313-page email compilation is stored as one document and summarized as 31 timeline entries (Nov 2024 to Jul 2026). New compilations can be handled the same way.
- **File storage:** PDFs live in git for now. We will decide later whether to move them to Git LFS, S3 or similar, starting with the 11 MB communications file.
- The Contact page links to a Google Form (`contact_form_url` in `_config.yml`).

## License

Apache 2.0 for the code. The documents are public records published by their original sources.
