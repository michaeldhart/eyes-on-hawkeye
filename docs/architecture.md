# Architecture decisions (and why)

*Moved out of `CLAUDE.md` so the always-loaded file stays short. Read this before changing how the site is built, searched, rendered or stored. Text is unchanged.*


- Static Jekyll 4 site, built by GitHub Actions (not the `github-pages` gem). Content is added by hand; no admin UI, no uploads.
- **Documents vs entries.** A document is a hosted file. An entry is a timeline event, optionally pointing into a document with a page range. This exists because the city released a 313-page email compilation: we keep the PDF intact (provenance) and break it into per-conversation entries rather than splitting the file.
- **Timeline is horizontal and scrollable**, rendered client-side from `/timeline.json` by `assets/js/timeline.js`. Dots are clickable and open a preview panel on the same page. Overlapping dots stack into lanes.
- **Search is client-side** with Lunr over `/search.json`, which includes the full text of every document. Stemming is deliberately disabled in `assets/js/search.js` so prefix matching works ("annexation" would otherwise index as "annex" and miss). Index is ~400 KB, mostly the communications file; revisit (e.g. Pagefind) if it gets large.
- **Types vs tags.** Type = one colored category per document (`_data/types.yml`, the single source of truth, also read by the timeline JS and `scripts/add_document.py`). Tags = free-form topics, single lowercase words. Keep these two concepts separate.
- **PDF storage is in git**, unchanged in `assets/documents/` (decided: stay in git until ~500 MB total or ~50 MB for one file, then object storage such as Cloudflare R2; not Git LFS, because Actions deploys would pull LFS files each time and burn the free bandwidth quota). Every document has a `sha256` of its original PDF in front matter, shown on the document page under "Verify this file"; `scripts/add_document.py` computes it and warns above 25 MB. Never commit derived or altered PDFs (the hash must stay the hash of what the city published); OCR text goes into the document body only. Replacing an existing PDF is owner-only (see "Decisions to keep" in `CLAUDE.md`); when the owner does, recompute `sha256`.
