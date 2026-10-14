# Eyes on Hawkeye

A community-run archive of public records about our town's proposed data center ("Project Hawkeye"). A Jekyll static site: home page, document index, full-text search, and a horizontally scrolling timeline.

## Run locally

```sh
bundle install
bundle exec jekyll serve --baseurl ""   # http://localhost:4000
```

## Content model

- **Documents** (`_documents/<slug>.md`): one per hosted PDF. Front matter holds the metadata; the body is the extracted text. PDFs live unchanged in `assets/documents/`.
- **Entries** (`_entries/<date>-<slug>.md`): extra timeline items that point *into* a document (`document: <slug>`, `pages: 14-17`), such as one email thread inside a 300-page compilation. Each non-compilation document appears on the timeline automatically.
- Document types and their colors: `_data/types.yml`.

Front matter flags: `compilation: true` (PDF bundles many items; use entries instead of one dot), `undated: true` (no date on the document; `date` is a placeholder), `timeline: false`, `ocr: true`.

## Adding a document

```sh
scripts/add_document.py ~/Downloads/file.pdf --title "..." --date 2026-05-26 \
  --type contract --source "City Clerk" --source-url https://... --summary "..." --tags water,zoning
```

Copies the PDF, extracts text (OCR via `ocrmypdf` if it's a scan), and scaffolds the file. Needs `brew install poppler ocrmypdf`. Always read the result and fix the summary and date by hand. OCR text is machine-made and the PDF is the record.

## Deploy

Pushes to `main` build and deploy through GitHub Actions (`.github/workflows/pages.yml`).

## License

Apache 2.0 (code). Documents are public records published by their original sources.
