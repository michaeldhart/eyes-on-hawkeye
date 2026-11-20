#!/usr/bin/env node
// Accessibility check: runs axe-core in a real browser against a running copy of the site.
// CI and development only; nothing in this folder is published (scripts/ is excluded from Jekyll).
//
//   node check-a11y.mjs --self-test
//   node check-a11y.mjs --base-url http://127.0.0.1:4000
//
// --self-test proves the checker can fail: it audits a built-in page with known violations
// (they must be reported) and a clean page (it must report none).
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
// Known violations can be listed in exceptions.json: path, rule, a selector or html match (no
// blanket exceptions), a reason, the date added, and a review_by date; an expired exception, or one that no longer matches anything, fails the check, so
// the list can only shrink. Agents must not add exceptions without the owner's approval.
//
// Exit codes: 0 pass, 1 violations or exception problems, 2 usage or setup error.

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

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

// Rules the bad page must trigger. If axe stops reporting these, the self-test fails.
const EXPECTED_BAD_RULES = ['image-alt', 'button-name', 'color-contrast', 'html-has-lang'];

async function analyzeHtml(page, html) {
  await page.setContent(html);
  let builder = new AxeBuilder({ page });
  // Test-only switch used to prove the self-test fails when axe finds nothing: run one rule
  // that cannot trigger on these pages (both have a <title>).
  if (process.env.A11Y_SELFTEST_BREAK === '1') builder = builder.withRules(['document-title']);
  return (await builder.analyze()).violations;
}

async function selfTest() {
  const browser = await chromium.launch();
  const failures = [];
  try {
    const page = await (await browser.newContext()).newPage();

    const bad = await analyzeHtml(page, BAD_PAGE);
    const badRules = new Set(bad.map((v) => v.id));
    for (const rule of EXPECTED_BAD_RULES) {
      if (!badRules.has(rule)) failures.push(`bad page: expected axe to report "${rule}" but it did not`);
    }

    const good = await analyzeHtml(page, GOOD_PAGE);
    for (const v of good) failures.push(`good page: unexpected violation "${v.id}" (${v.help})`);

    console.log(`bad page reported: ${[...badRules].sort().join(', ') || '(nothing)'}`);
    console.log(`good page reported: ${good.length} violations`);
  } finally {
    await browser.close();
  }
  if (failures.length) {
    console.log('Self-test FAILED:');
    for (const f of failures) console.log(`  - ${f}`);
    return 1;
  }
  console.log('Self-test OK: the checker finds known violations and passes a clean page.');
  return 0;
}

// ---------------------------------------------------------------- exceptions

function loadExceptions(file) {
  if (!existsSync(file)) return { list: [], problems: [] };
  const problems = [];
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const list = (raw.exceptions ?? []).map((e, i) => ({ ...e, used: false, i }));
  const today = new Date().toISOString().slice(0, 10);
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

async function audit(base, exceptionsFile) {
  const { list: exceptions, problems } = loadExceptions(exceptionsFile);
  const pages = await discoverPages(base);
  const browser = await chromium.launch();
  const failures = [...problems];
  let audits = 0;

  async function check(label, path, scheme, viewport, enter) {
    const context = await browser.newContext({ colorScheme: scheme, viewport });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    try {
      await open(page, `${base}${path}`);
      if (enter && !(await enter(page))) {
        failures.push(`${label}: could not reach the state to audit`);
        console.log(`FAIL ${label} (state not reached)`);
        return;
      }
      const violations = (await new AxeBuilder({ page }).analyze()).violations
        .map((v) => applyExceptions(v, path, exceptions))
        .filter(Boolean);
      audits++;
      console.log(`${violations.length ? 'FAIL' : 'ok  '} ${label}${violations.length ? ` (${violations.length} violations)` : ''}`);
      for (const v of violations) {
        console.log(`    ${describeViolation(v)}`);
        failures.push(`${label}: ${v.id}`);
      }
    } catch (e) {
      failures.push(`${label}: ${e.message.split('\n')[0]}`);
      console.log(`FAIL ${label} (${e.message.split('\n')[0]})`);
    } finally {
      await context.close();
    }
  }

  try {
    for (const lang of LANGS) {
      for (const scheme of SCHEMES) {
        for (const p of pages) {
          const path = withPrefix(lang.prefix, p);
          await check(`${lang.code} ${scheme} page ${path}`, path, scheme, DESKTOP);
        }
        for (const s of STATES) {
          const path = withPrefix(lang.prefix, s.path);
          await check(`${lang.code} ${scheme} state ${s.name} ${path}`, path, scheme, s.viewport, s.enter);
        }
      }
    }
  } finally {
    await browser.close();
  }

  for (const e of exceptions) {
    if (!e.used) failures.push(`exceptions.json entry ${e.i + 1} (${e.rule} on ${e.path}) matched nothing; remove it`);
  }

  console.log('');
  if (failures.length) {
    console.log(`Accessibility check FAILED (${audits} audits run, ${failures.length} problems):`);
    for (const f of failures) console.log(`  - ${f}`);
    return 1;
  }
  console.log(`Accessibility check OK: ${audits} audits, zero violations (${exceptions.length} exceptions in use).`);
  return 0;
}

// ---------------------------------------------------------------- cli

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
  console.log('Usage: node check-a11y.mjs --self-test | --base-url URL [--exceptions FILE]');
  process.exit(2);
}
try {
  process.exit(await audit(base, arg('--exceptions') ?? join(HERE, 'exceptions.json')));
} catch (e) {
  console.log(`Accessibility check could not run: ${e.message}`);
  process.exit(2);
}
