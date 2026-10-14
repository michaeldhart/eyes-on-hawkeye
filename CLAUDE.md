# Eyes on Hawkeye: notes for Claude

A community-run Jekyll site archiving public records about the proposed "Project Hawkeye" data center in Belvidere, Illinois (developer: Datawatt Energy / Datawatt Hyperscale LLC). Read `README.md` for the content model, front matter and commands. This file holds the context and conventions that aren't obvious from the code.

## Voice and editorial stance

- Tone: a grassroots community accountability organization. Declarative, plain, warm but not cold. Not a neutral archive and not shrill.
- The site's credibility rests on accuracy. State what the records show and what they leave out. Don't speculate about motives or fill gaps. Say "the documents don't show" instead of "there was no".
- Summaries and timeline entries are written by Claude (AI), and the About page says so plainly; never describe them as written by Michael or by "us" in a way that hides that. Names that appear in the original public records stay visible on the site (the user decided this); don't anonymize them. Summaries are written in plain language from the document text. Be careful with attribution (who wrote, who signed, what date) and quote dates exactly. When two dates exist, state both (e.g. the agreement is dated May 26, 2026 but the developer's signature is dated May 21).
- Never invent a date. If a document has none, mark it `undated: true`.
- OCR text is machine-made and can be wrong. The PDF is the record, and the site says so.
- The user has edited headline copy themselves (home page names "our mayor"). Don't revert user copy edits; check `git diff` before changing files the user may have touched.

## Architecture decisions (and why)

- Static Jekyll 4 site, built by GitHub Actions (not the `github-pages` gem). Content is added by hand; no admin UI, no uploads.
- **Documents vs entries.** A document is a hosted file. An entry is a timeline event, optionally pointing into a document with a page range. This exists because the city released a 313-page email compilation: we keep the PDF intact (provenance) and break it into per-conversation entries rather than splitting the file.
- **Timeline is horizontal and scrollable**, rendered client-side from `/timeline.json` by `assets/js/timeline.js`. Dots are clickable and open a preview panel on the same page. Overlapping dots stack into lanes.
- **Search is client-side** with Lunr over `/search.json`, which includes the full text of every document. Stemming is deliberately disabled in `assets/js/search.js` so prefix matching works ("annexation" would otherwise index as "annex" and miss). Index is ~400 KB, mostly the communications file; revisit (e.g. Pagefind) if it gets large.
- **Types vs tags.** Type = one colored category per document (`_data/types.yml`, the single source of truth, also read by the timeline JS and `scripts/add_document.py`). Tags = free-form topics, single lowercase words. Keep these two concepts separate.
- **PDF storage is in git**, unchanged in `assets/documents/` (decided: stay in git until ~500 MB total or ~50 MB for one file, then object storage such as Cloudflare R2; not Git LFS, because Actions deploys would pull LFS files each time and burn the free bandwidth quota). Every document has a `sha256` of its original PDF in front matter, shown on the document page under "Verify this file"; `scripts/add_document.py` computes it and warns above 25 MB. Never commit derived or altered PDFs (the hash must stay the hash of what the city published); OCR text goes into the document body only. If you replace a PDF, recompute `sha256`.

## Conventions

- Document slugs are short, undated filenames in `_documents/` (e.g. `letter-of-support.md`). Entry files are date-prefixed (`_entries/2026-07-27-utility-discussion.md`). Don't date-prefix documents; entries refer to them by slug.
- Document bodies are OCR text inside `{% raw %}<pre class="doc-text">…</pre>{% endraw %}` with `---- page N ----` markers. The `{% raw %}` wrapper is required because OCR noise can contain Liquid syntax.
- When adding documents, use `scripts/add_document.py`, then read the text and write/verify the summary and date by hand.
- Headings, button labels and document/entry titles use Title Case. Buttons that leave the page (original PDF, external source) open in a new tab with `rel="noopener"`. The external source link is generic ("View Original Source"); it isn't always the city's site.
- Contact: the Contact page links to a Google Form (`contact_form_url` in `_config.yml`), opened in a new tab. All contact, document tips and corrections go through it.
- Credit: the site is created and maintained by Michael Hart. Wherever his name appears, link it with `{% include author.html %}` (reads `site.author` in `_config.yml`), which opens michaeldhart.com in a new tab. Never type the name as plain text.
- Every place a summary is shown carries an AI disclosure (document page note, "AI summary" tag in the index and search fallback, note in the timeline preview). Keep this when adding new views that show summaries.
- Analytics: GoatCounter (cookieless, no personal data), site code `eyesonhawkeye` via `goatcounter_code` in `_config.yml`, same pattern as the city-county-summarizer project. The script in `_layouts/default.html` loads only in the production build (the Pages workflow), never in local previews. The About page's "What This Site Records About You" section discloses it and links to the public dashboard (https://eyesonhawkeye.goatcounter.com); the public-view setting is changed in the GoatCounter account, not in this repo. If the code is removed, the script and the claim both disappear.
- People and organizations: `_people/<slug>.md` is the registry (one file per person/org); docs and entries tag them via `people:` / `orgs:` front matter. Tag everyone who sends, receives or is substantively named in a conversation an entry summarizes, not incidental slide citations. Roles must be traceable to the records (`role_source`; say "title not stated in the records" when it isn't); no emails or phone numbers; names from the original records stay visible. New entities need a file before they can be tagged. Run `python3 scripts/check_people.py` after any tagging change (CI runs it too). Entry links from people pages go to `/timeline/#<entry-filename-without-.md>`, which the timeline opens.
- Home page overview, "What the Records Show So Far" (`index.md`, below the three columns and above Latest Documents; the user moved it down from just under the hero): short prose, every claim linked to the entry or document it comes from, same AI label as other summaries. The user approved the wording line by line (including the "What the records don't show" paragraph and the May 20, 2026 sentence), so don't reword it without asking. It is a hand-maintained summary, so when documents or entries are added, reread it and update it if the story changed, then set `overview_through` (newest record covered) and `overview_reviewed` (today) in `_config.yml`. `scripts/check_people.py` prints a warning (a GitHub Actions annotation in CI, not a failure) when a record is newer than `overview_through`. Every absence claim ("the records don't show...") must be re-verified against all documents when new ones arrive. The user worried it adds a lot of text to the home page; revisit placement or length if asked.
- Main nav collapses to a hamburger dropdown at 40rem and narrower, using the same pure-CSS checkbox pattern as the city-county-summarizer site (works without JS; the checkbox stays keyboard-focusable and Escape closes it). The link list lives in `_layouts/default.html`; add new top-level pages there.
- Dates display through `_includes/date.html` (handles `undated`). Type badges through `_includes/badge.html`.
- If you rename a type slug in `_data/types.yml`, update every document and entry that uses it.
- Use relative_url for all internal links. The site now lives at the root of https://eyesonhawkeye.com. The old github.io/eyes-on-hawkeye address redirects to it. Deploys pass the base path via the workflow, so `baseurl` stays empty. Custom domain is set in the repo's Pages settings (no CNAME file needed with Actions deploys). DNS is at GoDaddy: four A records on `@` to GitHub Pages and a `www` CNAME to michaeldhart.github.io.

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
| `initial-concept` | Undated as posted, but it is two developer decks joined: pages 1–11 = the Nov 25, 2024 deck (communications pp. 232–242), pages 12–18 = the Nov 7, 2024 deck (pp. 249–255). Type presentation, not an application; kept `undated: true` with a `date_note` explaining this; JLL named as Datawatt's representative |
| `communications-2024-2026` | 313-page email compilation (`compilation: true`); broken into 31 timeline entries in `_entries/` covering Nov 2024 to Jul 2026 |

How the communications file was processed (reuse for future compilations): the PDF is a stack of repeated printouts of the same email chains, newest first, so the ~337 headers collapse to ~110 unique messages. Dedupe by the "Sent:" timestamp, keep the best OCR copy, then read chronologically and write one entry per conversation (not per message), with the page where the clearest copy of it appears. Verify key figures against the scanned page image (the Read tool renders PDF pages) before quoting them. Upside-down attachment pages need `ocrmypdf --rotate-pages`; the sidecar text is what lives in the document body. Pages that are still gibberish after that (sideways slides) can be re-OCR'd by rendering with `pdftoppm -r 300`, rotating with `sips`, and running `tesseract`; check the result against the page image, and for pages that are mostly a drawing write a short bracketed description instead of keeping junk text. Score page quality by the share of common English words. Quote numbers and wording exactly as written in the emails and flag unclear units or names (e.g. "Bush"/"Busch", "250-500 MGD"). Report what the file shows and what it doesn't (calendar invites often carry no agenda).

Open work, in priority order:
1. Decide where PDFs live long term.
2. Keep adding documents as the city releases them.
3. Possible features: an RSS feed, social preview images, a corrections log. When adding documents or entries, also tag people and orgs.
