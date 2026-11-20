#!/usr/bin/env node
// Accessibility check: runs axe-core in a real browser against a running copy of the site.
// CI and development only; nothing in this folder is published (scripts/ is excluded from Jekyll).
//
//   node check-a11y.mjs --self-test
//   node check-a11y.mjs --base-url http://127.0.0.1:4000 [--expect-audits 52] [--exceptions FILE]
//
// --self-test proves the checker can fail. It serves a few fixture pages from a tiny local
// server and runs the real audit code on them, asserting the failures and the exit code for:
// a bad page, a clean page, a matching exception, a stale exception, an expired exception,
// malformed exceptions, a 404 page, blocked third-party requests and the audit-count guard.
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
// Exit codes: 0 pass, 1 violations or exception problems, 2 usage or setup error.

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- exceptions

// Check the raw contents of exceptions.json. Returns the entries (with a `used` flag the audit
// sets) and a list of problems; any problem fails the check.
function validateExceptions(raw, today) {
  const problems = [];
  const entries = raw?.exceptions ?? [];
  const list = entries.map((e, i) => ({ ...e, used: false, i }));
  for (const e of list) {
    const where = `exceptions.json entry ${e.i + 1} (${e.rule ?? '?'} on ${e.path ?? '?'})`;
    for (const k of ['path', 'rule', 'reason', 'added', 'review_by']) {
      if (!e[k] || typeof e[k] !== 'string') problems.push(`${where}: missing "${k}"`);
    }
    if (!e.selector && !e.html) problems.push(`${where}: needs "selector" (part of axe's target) or "html" (part of the element's HTML); blanket exceptions are not allowed`);
    if (e.review_by && e.review_by < today) problems.push(`${where}: review_by ${e.review_by} has passed; fix it or review the exception`);
  }
  return { list, problems };
}

// Remove the nodes covered by an exception; return the violation, or null if nothing is left.
function applyExceptions(violation, path, exceptions) {
  const nodes = violation.nodes.filter((node) => {
    const target = node.target.flat().join(' ');
    const hit = exceptions.find(
      (e) =>
        e.rule === violation.id &&
        (e.path === '*' || e.path === path) &&
        (!e.selector || target.includes(e.selector)) &&
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
  if (!docs.length) throw new Error('sitemap lists no document pages');
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

const withPrefix = (prefix, path) => (path === '/' ? `${prefix}/` : `${prefix}${path}`);

async function open(page, url) {
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      return;
    } catch (e) {
      if (attempt >= 1) throw e; // one retry on navigation errors only, never on violations
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
  const targets = v.nodes.slice(0, 3).map((n) => n.target.flat().join(' ')).join(' | ');
  const more = v.nodes.length > 3 ? ` (+${v.nodes.length - 3} more)` : '';
  return `${v.id} [${v.impact}]: ${v.help}; ${v.nodes.length} element(s): ${targets}${more}\n      ${v.helpUrl}`;
}

// Run the audit over pages x languages x schemes, plus the states. Returns the counts and the
// failures; the caller decides the exit code (see exitCodeFor).
async function runAudit({ browser, base, pages, states, langs = LANGS, schemes = SCHEMES, exceptions, axeRules, log = console.log }) {
  const failures = [];
  const blocked = new Map();
  let audits = 0;

  async function check(label, path, scheme, viewport, enter) {
    const context = await browser.newContext({ colorScheme: scheme, viewport });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    try {
      await open(page, `${base}${path}`);
      if (enter && !(await enter(page))) {
        failures.push(`${label}: could not reach the state to audit`);
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
      failures.push(`${label}: ${e.message.split('\n')[0]}`);
      log(`FAIL ${label} (${e.message.split('\n')[0]})`);
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
  return { audits, failures, blocked };
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

const externalPage = (url) => `<!doctype html><html lang="en"><head><title>External</title></head><body><main>
<h1>External</h1>
<img src="${url}" alt="An external image">
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

const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

async function selfTest() {
  const results = [];
  const test = (name, ok, detail = '') => results.push({ name, ok, detail });

  // Fixture servers: the "site", and a separate origin that must never be contacted.
  let externalHits = 0;
  const external = createServer((req, res) => {
    externalHits++;
    res.writeHead(200, { 'content-type': 'image/svg+xml' });
    res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
  });
  await listen(external);
  const pagesByPath = {
    '/bad/': BAD_PAGE,
    '/clean/': GOOD_PAGE,
    '/one/': ONE_PAGE,
    '/ext/': externalPage(`http://127.0.0.1:${external.address().port}/pic.svg`),
  };
  const site = createServer((req, res) => {
    const body = pagesByPath[req.url];
    res.writeHead(body ? 200 : 404, { 'content-type': 'text/html' });
    res.end(body ?? '<!doctype html><html lang="en"><head><title>Not found</title></head><body><main><h1>Not found</h1></main></body></html>');
  });
  await listen(site);
  const base = `http://127.0.0.1:${site.address().port}`;

  const browser = await chromium.launch();
  const run = (pages, extra = {}) =>
    runAudit({ browser, base, pages, states: [], langs: [LANGS[0]], schemes: ['light'], exceptions: [], log: () => {}, ...extra });
  const withException = (patch) => validateExceptions({ exceptions: [{ ...VALID_EXCEPTION, ...patch }] }, TODAY);

  try {
    const breakAxe = process.env.A11Y_SELFTEST_BREAK === '1' ? { axeRules: ['document-title'] } : {};

    // 1. A bad page fails the audit with the expected rules and exit code 1.
    const bad = await run(['/bad/'], breakAxe);
    const missing = EXPECTED_BAD_RULES.filter((r) => !bad.failures.some((f) => f.endsWith(`: ${r}`)));
    test('bad page fails with the expected rules', missing.length === 0 && exitCodeFor([], bad) === 1, `not reported: ${missing.join(', ') || '(none)'}`);

    // 2. A clean page passes with exit code 0.
    const clean = await run(['/clean/']);
    test('clean page passes (exit 0)', clean.failures.length === 0 && clean.audits === 1 && exitCodeFor([], clean) === 0, clean.failures.join('; '));

    // 3. A matching exception suppresses the violation.
    const matching = withException({});
    const suppressed = await run(['/one/'], { exceptions: matching.list });
    test('matching exception suppresses (exit 0)', matching.problems.length === 0 && suppressed.failures.length === 0 && exitCodeFor(matching.problems, suppressed) === 0, [...matching.problems, ...suppressed.failures].join('; '));

    // 4. An exception that matches nothing fails, and the violation is still reported.
    const stale = withException({ selector: 'no-such-element' });
    const staleRun = await run(['/one/'], { exceptions: stale.list });
    test('stale exception fails (exit 1)', staleRun.failures.some((f) => /matched nothing/.test(f)) && staleRun.failures.some((f) => f.endsWith(': image-alt')) && exitCodeFor(stale.problems, staleRun) === 1, staleRun.failures.join('; '));

    // 5. An expired exception fails.
    const expired = withException({ review_by: '2026-11-10', added: '2026-10-01' });
    test('expired exception fails (exit 1)', expired.problems.some((p) => /has passed/.test(p)) && exitCodeFor(expired.problems, { failures: [] }) === 1, expired.problems.join('; '));

    // 6. Malformed or too-loose exceptions are each rejected; a good one is accepted.
    const rejects = [
      ['review_by that is not a date', { review_by: 'never' }, /review_by/],
      ['review_by far in the future', { review_by: '9999-12-31' }, /review_by/],
      ['review_by before added', { added: '2026-12-01', review_by: '2026-11-25' }, /after added/],
      ['path "*"', { path: '*' }, /path/],
      ['too-short reason', { reason: 'ok' }, /reason/],
      ['no selector or html', { selector: undefined }, /selector/],
      ['too-short html match', { selector: undefined, html: '<img' }, /html/],
      ['unknown key', { reasn: 'typo' }, /reasn/],
      ['malformed rule id', { rule: 'Image Alt!' }, /rule/],
    ];
    for (const [name, patch, pattern] of rejects) {
      const { problems } = withException(patch);
      test(`rejects ${name}`, problems.some((p) => pattern.test(p)), problems.join('; ') || 'no problem reported');
    }
    test('accepts a valid exception', withException({}).problems.length === 0, withException({}).problems.join('; '));

    // 7. A page that returns 404 fails, with the status in the message.
    const missingPage = await run(['/missing/']);
    test('404 page fails with the status', missingPage.failures.some((f) => /HTTP 404/.test(f)), missingPage.failures.join('; ') || 'no failure reported');

    // 8. Requests to other origins are blocked and counted; the other origin is never contacted.
    const hermetic = await run(['/ext/']);
    test('external requests are blocked and counted', hermetic.blocked.size >= 1 && externalHits === 0 && hermetic.failures.length === 0, `blocked hosts: ${hermetic.blocked.size}, external hits: ${externalHits}`);

    // 9. The audit-count guard fails when fewer audits ran than expected.
    const count = await run(['/clean/'], { expectAudits: 2 });
    test('audit-count guard fails when fewer audits ran', count.failures.some((f) => /expected 2 audits/.test(f)), count.failures.join('; ') || 'no failure reported');
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

async function audit(base, exceptionsFile, expectAudits) {
  const raw = existsSync(exceptionsFile) ? JSON.parse(readFileSync(exceptionsFile, 'utf8')) : null;
  const { list, problems } = validateExceptions(raw, new Date().toISOString().slice(0, 10));
  const pages = await discoverPages(base);
  const browser = await chromium.launch();
  let result;
  try {
    result = await runAudit({ browser, base, pages, states: STATES, exceptions: list, expectAudits });
  } finally {
    await browser.close();
  }
  const all = [...problems, ...result.failures];
  console.log('');
  if (all.length) {
    console.log(`Accessibility check FAILED (${result.audits} audits run, ${all.length} problems):`);
    for (const f of all) console.log(`  - ${f}`);
  } else {
    console.log(`Accessibility check OK: ${result.audits} audits, zero violations (${list.length} exceptions in use).`);
  }
  return exitCodeFor(problems, result);
}

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (args.includes('--self-test')) {
  process.exit(await selfTest());
}
const base = arg('--base-url')?.replace(/\/$/, '');
if (!base) {
  console.log('Usage: node check-a11y.mjs --self-test | --base-url URL [--expect-audits N] [--exceptions FILE]');
  process.exit(2);
}
try {
  const expect = arg('--expect-audits');
  process.exit(await audit(base, arg('--exceptions') ?? join(HERE, 'exceptions.json'), expect === undefined ? undefined : Number(expect)));
} catch (e) {
  console.log(`Accessibility check could not run: ${e.message}`);
  process.exit(2);
}
