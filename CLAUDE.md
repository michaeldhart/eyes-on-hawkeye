# Eyes on Hawkeye: notes for Claude

A community-run Jekyll site archiving public records about the proposed "Project Hawkeye" data center in Belvidere, Illinois (developer: Datawatt Energy / Datawatt Hyperscale LLC). Read `README.md` for the content model, front matter and commands. This file holds the context and conventions that aren't obvious from the code.

## Voice and editorial stance

- Tone: a grassroots community accountability organization. Declarative, plain, warm but not cold. Not a neutral archive and not shrill.
- The site's credibility rests on accuracy. State what the records show and what they leave out. Don't speculate about motives or fill gaps. Say "the documents don't show" instead of "there was no".
- Summaries are ours, written in plain language from the document text. Be careful with attribution (who wrote, who signed, what date) and quote dates exactly. When two dates exist, state both (e.g. the agreement is dated May 26, 2026 but the developer's signature is dated May 21).
- Never invent a date. If a document has none, mark it `undated: true`.
- OCR text is machine-made and can be wrong. The PDF is the record, and the site says so.
- The user has edited headline copy themselves (home page names "our mayor"). Don't revert user copy edits; check `git diff` before changing files the user may have touched.

## Architecture decisions (and why)

- Static Jekyll 4 site, built by GitHub Actions (not the `github-pages` gem). Content is added by hand; no admin UI, no uploads.
- **Documents vs entries.** A document is a hosted file. An entry is a timeline event, optionally pointing into a document with a page range. This exists because the city released a 313-page email compilation: we keep the PDF intact (provenance) and break it into per-conversation entries rather than splitting the file.
- **Timeline is horizontal and scrollable**, rendered client-side from `/timeline.json` by `assets/js/timeline.js`. Dots are clickable and open a preview panel on the same page. Overlapping dots stack into lanes.
- **Search is client-side** with Lunr over `/search.json`, which includes the full text of every document. Stemming is deliberately disabled in `assets/js/search.js` so prefix matching works ("annexation" would otherwise index as "annex" and miss). Index is ~400 KB, mostly the communications file; revisit (e.g. Pagefind) if it gets large.
- **Types vs tags.** Type = one colored category per document (`_data/types.yml`, the single source of truth, also read by the timeline JS and `scripts/add_document.py`). Tags = free-form topics, single lowercase words. Keep these two concepts separate.
- **PDF storage is in git for now**, unchanged in `assets/documents/`. The user wants to revisit this later (Git LFS, S3, etc.). Don't commit derived or altered PDFs; OCR text goes into the document body only.

## Conventions

- Document slugs are short, undated filenames in `_documents/` (e.g. `letter-of-support.md`). Entry files are date-prefixed (`_entries/2026-07-27-utility-discussion.md`). Don't date-prefix documents; entries refer to them by slug.
- Document bodies are OCR text inside `{% raw %}<pre class="doc-text">…</pre>{% endraw %}` with `---- page N ----` markers. The `{% raw %}` wrapper is required because OCR noise can contain Liquid syntax.
- When adding documents, use `scripts/add_document.py`, then read the text and write/verify the summary and date by hand.
- Headings, button labels and document/entry titles use Title Case. Buttons that leave the page (original PDF, external source) open in a new tab with `rel="noopener"`. The external source link is generic ("View Original Source"); it isn't always the city's site.
- Contact: the Contact page links to a Google Form (`contact_form_url` in `_config.yml`), opened in a new tab. All contact, document tips and corrections go through it.
- Credit: the site is created and maintained by Michael Hart. Wherever his name appears, link it with `{% include author.html %}` (reads `site.author` in `_config.yml`), which opens michaeldhart.com in a new tab. Never type the name as plain text.
- Dates display through `_includes/date.html` (handles `undated`). Type badges through `_includes/badge.html`.
- If you rename a type slug in `_data/types.yml`, update every document and entry that uses it.
- Use relative_url for all internal links (the site is served under `/eyes-on-hawkeye/` on GitHub Pages).

## Working in this repo

- Local server: `bundle exec jekyll serve --baseurl ""` (a `jekyll` config exists in `.claude/launch.json` for the preview pane). `bundle exec jekyll build` should produce no warnings.
- Tools needed for ingest: poppler (`pdftotext`, `pdfinfo`) and `ocrmypdf`; all four city PDFs so far are scans with no text layer.
- Git remote is SSH (`git@github.com:michaeldhart/eyes-on-hawkeye.git`). Commit messages end with the Co-Authored-By line from the session's attribution guidance.
- Pushing to `main` deploys the live site. Commit and push when asked, and say so.

## State of the content

Four documents from https://www.belvidereil.gov/recent-data-center-information/ (released September 2026):

| Slug | What it is |
|---|---|
| `letter-of-support` | Mayor's May 22, 2025 letter to Datawatt supporting Project Hawkeye and raising annexation and utilities |
| `expense-reimbursement-agreement` | Developer reimburses the city's review costs from April 1, 2026; dated May 26, 2026 |
| `initial-concept` | Undated developer slide deck (type: presentation, not an application); JLL named as Datawatt's representative |
| `communications-2024-2026` | 313-page email compilation (`compilation: true`); only one entry written so far |

Open work, in priority order:
1. Break the communications file into per-conversation entries in `_entries/` (about 337 email headers; draft in batches and have the user review). Page markers in the document body show where each page starts.
2. Decide where PDFs live long term.
3. Keep adding documents as the city releases them.
