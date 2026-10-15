---
description: "Search the full text of every public record we have about Belvidere's proposed data center."
layout: default
title: Search
scripts: [https://cdnjs.cloudflare.com/ajax/libs/lunr.js/2.3.9/lunr.min.js, /assets/js/search.js]
---
<h1>Search the Documents</h1>
<p class="lede">Searches titles, summaries, tags and the full text of every document, plus the names and roles of people and organizations. Scanned pages are machine-read, so a word may be misspelled in the text even when it's clear on the page.</p>
<form id="search-form" role="search">
  <input id="q" type="search" placeholder="e.g. water, tax abatement, Hawkeye" autocomplete="off" aria-label="Search">
</form>
<p id="status" class="muted" aria-live="polite"></p>
<ol id="results" class="results"></ol>
