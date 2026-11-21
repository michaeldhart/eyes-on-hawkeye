#!/usr/bin/env node
// Accessibility check: runs axe-core in a real browser against a running copy of the site.
// CI and development only; nothing in this folder is published (scripts/ is excluded from Jekyll).
//
//   node check-a11y.mjs --self-test
//   node check-a11y.mjs --base-url http://127.0.0.1:4000 [--expect-audits 52] [--exceptions FILE]
//
// --self-test proves the checker can fail. It serves fixture pages from a tiny local server and
// runs the real audit code and the real command line on them, asserting failures and exit codes
// for bad and clean pages, exceptions (matching, non-matching, stale, expired, malformed and
// boundary cases), a 404 page, blocked third-party requests, the audit-count guard, page
// discovery, and argument handling.
//
// The audit covers (see docs/conventions.md):
//   pages    home, about, contact, documents index, a short and a long document page,
//            people index, one person page, search, timeline
//   x lang   English and Spanish (/es/)
//   x scheme light and dark (prefers-color-scheme)
//   states   timeline with a record selected, search with results, and the home page at
//            375 px wide with the mobile menu open (each in both languages and schemes)
// axe runs with its default rules, the same as the manual audit this replaces.
//
// Known violations can be listed in exceptions.json (rules are enforced by validateExceptions).
// An expired exception, or one that no longer matches anything, fails the check, so the list
// can only shrink. Agents must not add exceptions without the owner's approval.
//
// Debugging aids (CI does not use them): --pages /a/,/b/ audits only those English paths and
// --no-states skips the states.
//
// Exit codes: 0 pass, 1 violations or exception problems, 2 usage or setup error.

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const HERE = dirname(SELF);

// ---------------------------------------------------------------- exceptions

const RULE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KNOWN_KEYS = new Set(['path', 'rule', 'selector', 'html', 'reason', 'added', 'review_by']);
const LIMITS = { reasonMin: 20, htmlMin: 12, maxDays: 90 };
const DAY_MS = 86400000;

// A real calendar date written YYYY-MM-DD, or null.
function realDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

// Check the raw contents of exceptions.json. Returns the entries (with a `used` flag the audit
// sets) and a list of problems; any problem fails the check. An exception names one page, one
// axe rule and the elements matching one selector and/or HTML snippet (when both are given,
// both must match), says why, was added today or earlier, and must be reviewed again within
// 90 days of being added.
function validateExceptions(raw, today) {
  const problems = [];
  const entries = raw?.exceptions ?? [];
  if (!Array.isArray(entries)) return { list: [], problems: ['exceptions.json: "exceptions" must be a list'] };
  const list = [];
  entries.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      problems.push(`exceptions.json entry ${i + 1}: must be an object`);
      return;
    }
    const e = { ...entry, used: false, i };
    list.push(e);
    const where = `exceptions.json entry ${i + 1} (${entry.rule ?? '?'} on ${entry.path ?? '?'})`;
    const bad = (msg) => problems.push(`${where}: ${msg}`);

    for (const k of Object.keys(entry)) if (!KNOWN_KEYS.has(k)) bad(`unknown key "${k}"`);

    if (typeof e.path !== 'string' || !e.path.startsWith('/')) bad('path must be one page such as /about/ (site-wide "*" is not allowed)');
    if (typeof e.rule !== 'string' || !RULE_ID.test(e.rule)) bad(`rule ${JSON.stringify(e.rule)} is not an axe rule id`);
    if (e.selector == null && e.html == null) bad('needs "selector" (an exact axe target) or "html" (part of the element\'s HTML); blanket exceptions are not allowed');
    if (e.selector != null && (typeof e.selector !== 'string' || !e.selector.trim())) bad('"selector" must be a non-empty string');
    if (e.html != null && (typeof e.html !== 'string' || e.html.trim().length < LIMITS.htmlMin)) bad(`"html" must be at least ${LIMITS.htmlMin} characters (not counting surrounding spaces)`);
    if (typeof e.reason !== 'string' || e.reason.trim().length < LIMITS.reasonMin) bad(`reason must be at least ${LIMITS.reasonMin} characters`);

    const added = realDate(e.added);
    const review = realDate(e.review_by);
    if (!added) bad(`added ${JSON.stringify(e.added)} is not a real YYYY-MM-DD date`);
    if (!review) bad(`review_by ${JSON.stringify(e.review_by)} is not a real YYYY-MM-DD date`);
    if (added && e.added > today) bad(`added ${e.added} is in the future`);
    if (added && review) {
      if (review <= added) bad('review_by must be after added');
      else if ((review - added) / DAY_MS > LIMITS.maxDays) bad(`review_by must be at most ${LIMITS.maxDays} days after added`);
    }
    if (review && e.review_by < today) bad(`review_by ${e.review_by} has passed; fix it or review the exception`);
  });
  return { list, problems };
}

// Remove the nodes covered by an exception; return the violation, or null if nothing is left.
function applyExceptions(violation, path, exceptions) {
  const nodes = violation.nodes.filter((node) => {
    const targets = node.target.flat();
    const hit = exceptions.find(
      (e) =>
        e.rule === violation.id &&
        e.path === path &&
        (!e.selector || targets.includes(e.selector)) &&
        (!e.html || (node.html ?? '').includes(e.html)),
    );
    if (hit) hit.used = true;
    return !hit;
  });
  return nodes.length ? { ...violation, nodes } : null;
}

// ---------------------------------------------------------------- discovery

async function getText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

async function discoverPages(base) {
  const sitemap = await getText(`${base}/sitemap.xml`);
  const paths = new Set([...sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => new URL(m[1]).pathname));
  const english = [...paths].filter((p) => !p.startsWith('/es/')).sort();

  const fixed = ['/', '/about/', '/contact/', '/documents/', '/people/', '/search/', '/timeline/'];
  for (const p of fixed) {
    if (!paths.has(p) || !paths.has(p === '/' ? '/es/' : `/es${p}`)) throw new Error(`sitemap is missing ${p} or its Spanish twin`);
  }

  // Document pages by rule, not by name: the shortest and the longest page.
  const docs = english.filter((p) => /^\/documents\/[^/]+\/$/.test(p));
  if (docs.length < 2) throw new Error('sitemap lists fewer than two document pages (a short and a long one are audited)');
  const sizes = [];
  for (const p of docs) sizes.push([p, (await getText(`${base}${p}`)).length]);
  sizes.sort((a, b) => a[1] - b[1]);

  const people = english.filter((p) => /^\/people\/[^/]+\/$/.test(p));
  if (!people.length) throw new Error('sitemap lists no person pages');

  return [...new Set([...fixed, sizes[0][0], sizes.at(-1)[0], people[0]])];
}

// ---------------------------------------------------------------- audit

const SCHEMES = ['light', 'dark'];
const LANGS = [
  { code: 'en', prefix: '' },
  { code: 'es', prefix: '/es' },
];
const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 375, height: 812 };

// The audit is hermetic: only the site itself is reachable, plus the exact URLs below. The site
// loads its search library (Lunr) from this CDN, so the search page cannot work without it.
// Everything else (for example the analytics script in a production build) is blocked and
// counted. If the site changes this URL, the search-results state fails and the message names
// what was blocked; update the URL here (a gate change, reviewed by the owner).
const ALLOWED_URLS = new Set(['https://cdnjs.cloudflare.com/ajax/libs/lunr.js/2.3.9/lunr.min.js']);

const withPrefix = (prefix, path) => (path === '/' ? `${prefix}/` : `${prefix}${path}`);

async function open(page, url) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await page.goto(url, { waitUntil: 'networkidle' });
      if (!res) throw new Error(`no response for ${url}`);
      if (!res.ok()) {
        const err = new Error(`HTTP ${res.status()} for ${url}`);
        err.noRetry = true; // a bad status is a finding, not a flaky load
        throw err;
      }
      return;
    } catch (e) {
      if (e.noRetry || attempt >= 1) throw e; // one retry on navigation errors only, never on violations or bad statuses
    }
  }
}

// Each state returns true if it really reached the state it is meant to audit.
const STATES = [
  {
    name: 'timeline-selected',
    path: '/timeline/',
    viewport: DESKTOP,
    async enter(page) {
      const dot = page.locator('ol button[aria-pressed]').first();
      await dot.waitFor();
      await dot.click();
      await page.locator('#preview-title').waitFor();
      return true;
    },
  },
  {
    name: 'search-results',
    path: '/search/',
    viewport: DESKTOP,
    async enter(page) {
      await page.fill('#q', 'annexation');
      await page.press('#q', 'Enter');
      await page.waitForFunction(() => document.getElementById('results')?.children.length > 0);
      return true;
    },
  },
  {
    name: 'mobile-menu-open',
    path: '/',
    viewport: MOBILE,
    async enter(page) {
      await page.locator('#nav-trigger').check({ force: true });
      return page.locator('.site-nav .trigger').isVisible();
    },
  },
];

function describeViolation(v) {
  const targets = v.nodes.slice(0, 3).map((n) => n.target.flat().join(' | ')).join(' | ');
  const more = v.nodes.length > 3 ? ` (+${v.nodes.length - 3} more)` : '';
  return `${v.id} [${v.impact}]: ${v.help}; ${v.nodes.length} element(s): ${targets}${more}\n      ${v.helpUrl}`;
}

// Run the audit over pages x languages x schemes, plus the states. Returns the counts and the
// failures; the caller decides the exit code (see exitCodeFor).
async function runAudit({ browser, base, pages, states, langs = LANGS, schemes = SCHEMES, exceptions, expectAudits, axeRules, allowUrls = ALLOWED_URLS, timeoutMs = 30000, log = console.log }) {
  const failures = [];
  const blocked = new Map();
  const allowed = new Map();
  let audits = 0;
  const baseOrigin = new URL(base).origin;

  async function check(label, path, scheme, viewport, enter) {
    const context = await browser.newContext({ colorScheme: scheme, viewport, serviceWorkers: 'block' });
    const pageBlocked = new Set();
    const failedAllowed = new Set();
    await context.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
      const { origin, host } = new URL(url);
      if (origin === baseOrigin) return route.continue();
      if (allowUrls.has(url)) {
        allowed.set(host, (allowed.get(host) ?? 0) + 1);
        return route.continue();
      }
      blocked.set(host, (blocked.get(host) ?? 0) + 1);
      pageBlocked.add(host);
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.on('requestfailed', (req) => allowUrls.has(req.url()) && failedAllowed.add(req.url()));
    page.on('response', (res) => allowUrls.has(res.url()) && res.status() >= 400 && failedAllowed.add(res.url()));
    // Say what probably went wrong when a page or state fails to load.
    const hint = () =>
      failedAllowed.size
        ? ` (a required third-party request failed: ${[...failedAllowed].join(', ')}; a network problem, not an accessibility finding)`
        : pageBlocked.size
          ? ` (requests blocked on this page: ${[...pageBlocked].join(', ')})`
          : '';
    try {
      await open(page, `${base}${path}`);
      if (enter && !(await enter(page))) {
        failures.push(`${label}: could not reach the state to audit${hint()}`);
        log(`FAIL ${label} (state not reached)`);
        return;
      }
      let builder = new AxeBuilder({ page });
      if (axeRules) builder = builder.withRules(axeRules); // self-test hook only
      const violations = (await builder.analyze()).violations
        .map((v) => applyExceptions(v, path, exceptions))
        .filter(Boolean);
      audits++;
      log(`${violations.length ? 'FAIL' : 'ok  '} ${label}${violations.length ? ` (${violations.length} violations)` : ''}`);
      for (const v of violations) {
        log(`    ${describeViolation(v)}`);
        failures.push(`${label}: ${v.id}`);
      }
    } catch (e) {
      const message = `${e.message.split('\n')[0]}${hint()}`;
      failures.push(`${label}: ${message}`);
      log(`FAIL ${label} (${message})`);
    } finally {
      await context.close();
    }
  }

  for (const lang of langs) {
    for (const scheme of schemes) {
      for (const p of pages) {
        const path = withPrefix(lang.prefix, p);
        await check(`${lang.code} ${scheme} page ${path}`, path, scheme, DESKTOP);
      }
      for (const s of states) {
        const path = withPrefix(lang.prefix, s.path);
        await check(`${lang.code} ${scheme} state ${s.name} ${path}`, path, scheme, s.viewport, s.enter);
      }
    }
  }

  for (const e of exceptions) {
    if (!e.used) failures.push(`exceptions.json entry ${e.i + 1} (${e.rule} on ${e.path}) matched nothing; remove it`);
  }
  if (expectAudits !== undefined && audits !== expectAudits) failures.push(`expected ${expectAudits} audits but ran ${audits}`);
  return { audits, failures, blocked, allowed };
}

const exitCodeFor = (problems, result) => (problems.length || result.failures.length ? 1 : 0);

// ---------------------------------------------------------------- self-test

const BAD_PAGE = `<!doctype html><html><head><title>Bad page</title></head><body>
<img src="x.png">
<button></button>
<p style="color:#bbb;background:#fff">Low contrast text</p>
</body></html>`;

const GOOD_PAGE = `<!doctype html><html lang="en"><head><title>Good page</title></head><body><main>
<h1>Hello</h1>
<img src="x.png" alt="A grey square">
<button type="button">Go</button>
<p style="color:#111;background:#fff">Readable text</p>
</main></body></html>`;

// Exactly one violation: an image without alt text.
const ONE_PAGE = `<!doctype html><html lang="en"><head><title>One</title></head><body><main>
<h1>One</h1>
<img src="x.png">
</main></body></html>`;

// Two violations of the same rule, on two different elements.
const TWO_PAGE = `<!doctype html><html lang="en"><head><title>Two</title></head><body><main>
<h1>Two</h1>
<img src="a.png">
<img src="b.png">
</main></body></html>`;

const externalPage = (url) => `<!doctype html><html lang="en"><head><title>External</title></head><body><main>
<h1>External</h1>
<img src="${url}" alt="An external image">
</main></body></html>`;

const scriptPage = (url) => `<!doctype html><html lang="en"><head><title>Script</title></head><body><main>
<h1>Script</h1>
<script src="${url}"></script>
</main></body></html>`;

// Rules the bad page must trigger. If axe stops reporting these, the self-test fails.
const EXPECTED_BAD_RULES = ['image-alt', 'button-name', 'color-contrast', 'html-has-lang'];

const VALID_EXCEPTION = {
  path: '/one/',
  rule: 'image-alt',
  selector: 'img',
  reason: 'Self-test: covers the only image on this page',
  added: '2026-11-01',
  review_by: '2026-12-15',
};
const TODAY = '2026-11-20';

const FIXED_PAGES = ['/', '/about/', '/contact/', '/documents/', '/people/', '/search/', '/timeline/'];
const sitemapXml = (variant) => {
  const docs = variant === 'ok1' ? ['/documents/a/'] : ['/documents/a/', '/documents/a-much-longer-document-slug/'];
  let paths = [...FIXED_PAGES, ...FIXED_PAGES.map((p) => (p === '/' ? '/es/' : `/es${p}`)), ...docs, '/people/p/'];
  if (variant === 'ok2') paths = paths.filter((p) => p !== '/es/about/');
  return `<urlset>${paths.map((p) => `<url><loc>http://example.test${p}</loc></url>`).join('')}</urlset>`;
};

const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

async function selfTest() {
  const results = [];
  const test = (name, ok, detail = '') => results.push({ name, ok, detail });

  // Fixture servers: the "site", and a separate origin that must not be contacted unless allowed.
  let externalHits = 0;
  const external = createServer((req, res) => {
    externalHits++;
    if (req.url === '/boom.js') {
      res.writeHead(500);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': 'image/svg+xml' });
    res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
  });
  await listen(external);
  const externalBase = `http://127.0.0.1:${external.address().port}`;
  const pagesByPath = {
    '/bad/': BAD_PAGE,
    '/clean/': GOOD_PAGE,
    '/es/clean/': GOOD_PAGE,
    '/one/': ONE_PAGE,
    '/two/': TWO_PAGE,
    '/ext/': externalPage(`${externalBase}/pic.svg`),
    '/boomy/': scriptPage(`${externalBase}/boom.js`),
  };
  const site = createServer((req, res) => {
    const fixture = req.url.match(/^\/(ok[0-9]*)(\/.*)$/);
    let body = pagesByPath[req.url];
    if (fixture && fixture[2] === '/sitemap.xml') body = sitemapXml(fixture[1]);
    else if (fixture) {
      const doc = fixture[2].match(/^\/documents\/([^/]+)\/$/);
      if (doc) body = GOOD_PAGE + 'x'.repeat(doc[1].length * 50); // longer slug, longer page
    }
    res.writeHead(body ? 200 : 404, { 'content-type': fixture && fixture[2] === '/sitemap.xml' ? 'application/xml' : 'text/html' });
    res.end(body ?? '<!doctype html><html lang="en"><head><title>Not found</title></head><body><main><h1>Not found</h1></main></body></html>');
  });
  await listen(site);
  const base = `http://127.0.0.1:${site.address().port}`;

  const browser = await chromium.launch();
  const run = (pages, extra = {}) =>
    runAudit({ browser, base, pages, states: [], langs: [LANGS[0]], schemes: ['light'], exceptions: [], log: () => {}, ...extra });
  const withException = (patch) => validateExceptions({ exceptions: [{ ...VALID_EXCEPTION, ...patch }] }, TODAY);
  const imageAltFailures = (r) => r.failures.filter((f) => f.endsWith(': image-alt')).length;
  const dir = mkdtempSync(join(tmpdir(), 'a11y-selftest-'));
  // Not spawnSync: this process also serves the fixture site, so it must stay responsive.
  const cli = (...args) =>
    new Promise((resolve) => {
      execFile(process.execPath, [SELF, ...args], { timeout: 180000 }, (err, stdout, stderr) => {
        const code = !err ? 0 : err.killed ? -1 : typeof err.code === 'number' ? err.code : 1;
        resolve({ code, out: `${stdout}${stderr}` });
      });
    });

  try {
    const breakAxe = process.env.A11Y_SELFTEST_BREAK === '1' ? { axeRules: ['document-title'] } : {};

    // --- the audit itself
    const bad = await run(['/bad/'], breakAxe);
    const missing = EXPECTED_BAD_RULES.filter((r) => !bad.failures.some((f) => f.endsWith(`: ${r}`)));
    test('bad page fails with the expected rules', missing.length === 0 && exitCodeFor([], bad) === 1, `not reported: ${missing.join(', ') || '(none)'}`);

    const clean = await run(['/clean/']);
    test('clean page passes (exit 0)', clean.failures.length === 0 && clean.audits === 1 && exitCodeFor([], clean) === 0, clean.failures.join('; '));

    // --- exceptions that must suppress
    const matching = withException({});
    const suppressed = await run(['/one/'], { exceptions: matching.list });
    test('exact selector exception suppresses (exit 0)', matching.problems.length === 0 && suppressed.failures.length === 0 && exitCodeFor(matching.problems, suppressed) === 0, [...matching.problems, ...suppressed.failures].join('; '));

    const htmlOnly = withException({ selector: undefined, html: '<img src="x.png">' });
    const htmlOnlyRun = await run(['/one/'], { exceptions: htmlOnly.list });
    test('html-only exception suppresses', htmlOnly.problems.length === 0 && htmlOnlyRun.failures.length === 0, [...htmlOnly.problems, ...htmlOnlyRun.failures].join('; '));

    // --- exceptions that must NOT suppress (each leaves the violation in place and is reported stale)
    const mustNotSuppress = [
      ['a partial-text selector', { selector: 'm' }],
      ['a different page', { path: '/other/' }],
      ['a different rule', { rule: 'button-name' }],
      ['html that does not match', { selector: undefined, html: '<img src="zzzz.png">' }],
      ['a selector plus html that does not match', { html: '<img src="zzzz.png">' }],
    ];
    for (const [name, patch] of mustNotSuppress) {
      const ex = withException(patch);
      const r = await run(['/one/'], { exceptions: ex.list });
      test(`exception with ${name} does not suppress`, ex.problems.length === 0 && imageAltFailures(r) === 1 && r.failures.some((f) => /matched nothing/.test(f)) && exitCodeFor(ex.problems, r) === 1, `${ex.problems.join('; ')} | ${r.failures.join('; ')}`);
    }

    // --- an exception covering one of two elements leaves the other reported
    const partial = withException({ path: '/two/', selector: undefined, html: '<img src="a.png">' });
    const partialRun = await run(['/two/'], { exceptions: partial.list });
    test('an exception for one of two elements leaves the other', partial.problems.length === 0 && imageAltFailures(partialRun) === 1 && !partialRun.failures.some((f) => /matched nothing/.test(f)), `${partial.problems.join('; ')} | ${partialRun.failures.join('; ')}`);

    // --- exception validation: each of these must be rejected
    const rejects = [
      ['review_by that is not a date', { review_by: 'never' }, /review_by/],
      ['review_by far in the future', { review_by: '9999-12-31' }, /review_by/],
      ['review_by 91 days after added', { added: '2026-11-01', review_by: '2027-01-31' }, /at most 90 days/],
      ['review_by equal to added', { added: '2026-11-10', review_by: '2026-11-10' }, /after added/],
      ['review_by before added', { added: '2026-12-01', review_by: '2026-11-25' }, /after added/],
      ['added in the future', { added: '2099-01-01', review_by: '2099-03-01' }, /in the future/],
      ['added that is not a real date', { added: '2026-02-30' }, /added/],
      ['review_by that has passed', { added: '2026-10-01', review_by: '2026-11-10' }, /has passed/],
      ['path "*"', { path: '*' }, /path/],
      ['too-short reason', { reason: 'ok' }, /reason/],
      ['no selector or html', { selector: undefined }, /selector/],
      ['empty selector', { selector: ' ' }, /selector/],
      ['selector that is not a string', { selector: 5 }, /selector/],
      ['too-short html match', { selector: undefined, html: '<img' }, /html/],
      ['html made only of spaces', { selector: undefined, html: ' '.repeat(14) }, /html/],
      ['unknown key', { reasn: 'typo' }, /reasn/],
      ['malformed rule id', { rule: 'Image Alt!' }, /rule/],
    ];
    for (const [name, patch, pattern] of rejects) {
      const { problems } = withException(patch);
      test(`rejects ${name}`, problems.some((p) => pattern.test(p)), problems.join('; ') || 'no problem reported');
    }
    // --- exception validation: boundaries that must be accepted
    for (const [name, patch] of [
      ['an entry exactly 90 days after added', { added: '2026-11-01', review_by: '2027-01-30' }],
      ['an entry reviewed today', { added: '2026-10-01', review_by: TODAY }],
      ['an entry added today', { added: TODAY, review_by: '2026-12-15' }],
      ['a plain valid entry', {}],
    ]) {
      const { problems } = withException(patch);
      test(`accepts ${name}`, problems.length === 0, problems.join('; '));
    }
    test('rejects an entry that is not an object', validateExceptions({ exceptions: ['nope'] }, TODAY).problems.some((p) => /must be an object/.test(p)));
    test('rejects "exceptions" that is not a list', validateExceptions({ exceptions: {} }, TODAY).problems.some((p) => /must be a list/.test(p)));

    // --- page loading and the third-party guard
    const expired = withException({ added: '2026-10-01', review_by: '2026-11-10' });
    test('expired exception fails (exit 1)', exitCodeFor(expired.problems, { failures: [] }) === 1);

    const missingPage = await run(['/missing/']);
    test('404 page fails with the status', missingPage.failures.some((f) => /HTTP 404/.test(f)), missingPage.failures.join('; ') || 'no failure reported');

    const hermetic = await run(['/ext/']);
    test('external requests are blocked and counted', hermetic.blocked.size >= 1 && externalHits === 0 && hermetic.failures.length === 0, `blocked hosts: ${hermetic.blocked.size}, external hits: ${externalHits}`);

    const allowedRun = await run(['/ext/'], { allowUrls: new Set([`${externalBase}/pic.svg`]) });
    test('an allowlisted URL is allowed and counted', allowedRun.allowed.size === 1 && allowedRun.blocked.size === 0 && allowedRun.failures.length === 0, `allowed: ${allowedRun.allowed.size}, blocked: ${allowedRun.blocked.size}`);

    const sameHost = await run(['/ext/'], { allowUrls: new Set([`${externalBase}/other.svg`]) });
    test('an allowlisted URL does not allow other URLs on the same host', sameHost.blocked.size === 1 && sameHost.allowed.size === 0, `allowed: ${sameHost.allowed.size}, blocked: ${sameHost.blocked.size}`);

    test('the real allowlist is exactly the search library URL', ALLOWED_URLS.size === 1 && ALLOWED_URLS.has('https://cdnjs.cloudflare.com/ajax/libs/lunr.js/2.3.9/lunr.min.js'), [...ALLOWED_URLS].join(', '));

    const failing = await run(['/boomy/'], {
      allowUrls: new Set([`${externalBase}/boom.js`]),
      states: [{ name: 'never', path: '/boomy/', viewport: { width: 800, height: 600 }, enter: async (page) => (await page.locator('#never').waitFor(), true) }],
      timeoutMs: 1500,
    });
    test('a failing allowed request is named as a network problem', failing.failures.some((f) => /network problem, not an accessibility finding/.test(f) && /boom\.js/.test(f)), failing.failures.join('; ') || 'no failure reported');

    const countGuard = await run(['/clean/'], { expectAudits: 2 });
    test('audit-count guard fails when fewer audits ran', countGuard.failures.some((f) => /expected 2 audits/.test(f)), countGuard.failures.join('; ') || 'no failure reported');

    // --- page discovery
    const found = await discoverPages(`${base}/ok`);
    test('discovery finds the 10-page matrix', found.length === 10 && found.includes('/documents/a/') && found.includes('/documents/a-much-longer-document-slug/') && found.includes('/people/p/'), found.join(', '));
    for (const [name, variant, pattern] of [['a single document page', 'ok1', /fewer than two document pages/], ['a missing Spanish twin', 'ok2', /Spanish twin/]]) {
      const message = await discoverPages(`${base}/${variant}`).then(() => 'no error', (e) => e.message);
      test(`discovery rejects ${name}`, pattern.test(message), message);
    }

    // --- the real command line (exit codes and argument handling)
    const noArgs = await cli();
    test('cli: no arguments is a usage error (exit 2)', noArgs.code === 2 && /Usage/.test(noArgs.out), `${noArgs.code}`);
    const noValue = await cli('--base-url', base, '--expect-audits');
    test('cli: --expect-audits without a value is a usage error (exit 2)', noValue.code === 2, `${noValue.code}: ${noValue.out.slice(0, 120)}`);
    const notNumber = await cli('--base-url', base, '--expect-audits', 'abc');
    test('cli: a non-numeric --expect-audits is a usage error (exit 2)', notNumber.code === 2 && /whole number/.test(notNumber.out), `${notNumber.code}: ${notNumber.out.slice(0, 120)}`);
    const cleanCli = await cli('--base-url', base, '--pages', '/clean/', '--no-states', '--expect-audits', '4');
    test('cli: a clean page passes with the right audit count (exit 0)', cleanCli.code === 0 && /Accessibility check OK: 4 audits/.test(cleanCli.out), `${cleanCli.code}: ${cleanCli.out.slice(-200)}`);
    const wrongCount = await cli('--base-url', base, '--pages', '/clean/', '--no-states', '--expect-audits', '5');
    test('cli: a wrong expected audit count fails (exit 1)', wrongCount.code === 1 && /expected 5 audits but ran 4/.test(wrongCount.out), `${wrongCount.code}`);
    const badFile = join(dir, 'bad.json');
    writeFileSync(badFile, JSON.stringify({ exceptions: [{ ...VALID_EXCEPTION, path: '*' }] }));
    const badExceptions = await cli('--base-url', base, '--pages', '/clean/', '--no-states', '--exceptions', badFile);
    test('cli: an invalid exceptions file fails the run (exit 1)', badExceptions.code === 1 && /site-wide/.test(badExceptions.out), `${badExceptions.code}: ${badExceptions.out.slice(-200)}`);
    const brokenFile = join(dir, 'broken.json');
    writeFileSync(brokenFile, '{ not json');
    const broken = await cli('--base-url', base, '--pages', '/clean/', '--no-states', '--exceptions', brokenFile);
    test('cli: malformed JSON in the exceptions file is a setup error (exit 2)', broken.code === 2, `${broken.code}`);
    const absent = await cli('--base-url', base, '--pages', '/clean/', '--no-states', '--exceptions', join(dir, 'nope.json'));
    test('cli: a missing exceptions file is a setup error (exit 2)', absent.code === 2 && /not found/.test(absent.out), `${absent.code}: ${absent.out.slice(0, 120)}`);
    const dangling = await cli('--base-url', base, '--exceptions', '--no-states');
    test('cli: --exceptions followed by a flag is a usage error (exit 2)', dangling.code === 2, `${dangling.code}`);
    const oneDoc = await cli('--base-url', `${base}/ok1`, '--no-states');
    test('cli: a sitemap with one document page is a setup error (exit 2)', oneDoc.code === 2 && /fewer than two document pages/.test(oneDoc.out), `${oneDoc.code}: ${oneDoc.out.slice(0, 160)}`);
  } finally {
    await browser.close();
    site.close();
    external.close();
  }

  for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : `: ${r.detail}`}`);
  const failed = results.filter((r) => !r.ok).length;
  if (failed) {
    console.log(`Self-test FAILED (${failed} of ${results.length} cases).`);
    return 1;
  }
  console.log(`Self-test OK (${results.length} cases): the checker fails when it should and passes when it should.`);
  return 0;
}

// ---------------------------------------------------------------- cli

const USAGE = 'Usage: node check-a11y.mjs --self-test | --base-url URL [--expect-audits N] [--exceptions FILE] [--pages /a/,/b/] [--no-states]';

function usageError(message) {
  console.log(message ? `${message}\n${USAGE}` : USAGE);
  process.exit(2);
}

async function audit(base, exceptionsFile, { expectAudits, pages: onlyPages, noStates }) {
  if (!existsSync(exceptionsFile)) throw new Error(`exceptions file not found: ${exceptionsFile}`);
  const raw = JSON.parse(readFileSync(exceptionsFile, 'utf8'));
  const { list, problems } = validateExceptions(raw, new Date().toISOString().slice(0, 10));
  const pages = onlyPages ?? (await discoverPages(base));
  const browser = await chromium.launch();
  let result;
  try {
    result = await runAudit({ browser, base, pages, states: noStates ? [] : STATES, exceptions: list, expectAudits });
  } finally {
    await browser.close();
  }
  const all = [...problems, ...result.failures];
  console.log('');
  const summary = (map) => `${[...map.values()].reduce((a, b) => a + b, 0)} request(s)${map.size ? ` (${[...map].map(([h, n]) => `${h} x${n}`).join(', ')})` : ''}`;
  console.log(`Blocked ${summary(result.blocked)} to other origins; allowed ${summary(result.allowed)} to the site's own CDN.`);
  if (all.length) {
    console.log(`Accessibility check FAILED (${result.audits} audits run, ${all.length} problems):`);
    for (const f of all) console.log(`  - ${f}`);
  } else {
    console.log(`Accessibility check OK: ${result.audits} audits, zero violations (${list.length} exceptions in use).`);
  }
  return exitCodeFor(problems, result);
}

const args = process.argv.slice(2);
function value(name) {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  if (v === undefined || v.startsWith('--')) usageError(`${name} needs a value`);
  return v;
}

if (args.includes('--self-test')) {
  process.exit(await selfTest());
}
const baseArg = value('--base-url');
if (!baseArg) usageError();
const expectRaw = value('--expect-audits');
if (expectRaw !== undefined && !/^\d+$/.test(expectRaw)) usageError('--expect-audits needs a whole number');
const pagesRaw = value('--pages');
try {
  process.exit(
    await audit(baseArg.replace(/\/$/, ''), value('--exceptions') ?? join(HERE, 'exceptions.json'), {
      expectAudits: expectRaw === undefined ? undefined : Number(expectRaw),
      pages: pagesRaw === undefined ? undefined : pagesRaw.split(',').filter(Boolean),
      noStates: args.includes('--no-states'),
    }),
  );
} catch (e) {
  console.log(`Accessibility check could not run: ${e.message}`);
  process.exit(2);
}
