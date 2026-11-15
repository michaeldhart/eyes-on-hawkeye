#!/usr/bin/env node
// Accessibility check: runs axe-core in a real browser against a running copy of the site.
// CI and development only; nothing in this folder is published (scripts/ is excluded from Jekyll).
//
//   node check-a11y.mjs --self-test
//
// --self-test proves the checker can fail: it audits a built-in page with known violations
// (must be reported, exit 1 would follow) and a clean page (must report none).

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

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

async function analyze(page, html) {
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

    const bad = await analyze(page, BAD_PAGE);
    const badRules = new Set(bad.map((v) => v.id));
    for (const rule of EXPECTED_BAD_RULES) {
      if (!badRules.has(rule)) failures.push(`bad page: expected axe to report "${rule}" but it did not`);
    }

    const good = await analyze(page, GOOD_PAGE);
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

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  process.exit(await selfTest());
}
console.log('Usage: node check-a11y.mjs --self-test');
process.exit(2);
