(function () {
  var base = (document.querySelector('link[rel=stylesheet]').getAttribute('href') || '').replace(/assets\/css\/site\.css.*$/, '');
  var q = document.getElementById('q');
  var out = document.getElementById('results');
  var status = document.getElementById('status');
  var docs = [], idx = null;
  var lang = window.LANG || 'en';
  function T(k, a, b) { return String((window.I18N || {})[k] || k).replace(/%1/g, a == null ? '' : a).replace(/%2/g, b == null ? '' : b); }

  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // Lowercase and strip accents, so "ubicacion" finds "ubicación". Same length as the input for
  // precomposed text, so positions found in the folded copy are valid in the original.
  function fold(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  // Index terms are folded too (query terms are folded by hand below: wildcard terms skip the pipeline).
  lunr.Pipeline.registerFunction(function (token) { return token.update(fold); }, 'fold');

  function snippet(text, terms) {
    var lower = fold(text), pos = -1;
    for (var i = 0; i < terms.length && pos < 0; i++) pos = lower.indexOf(terms[i]);
    if (pos < 0) return '';
    var s = Math.max(0, pos - 80), e = Math.min(text.length, pos + 160);
    var piece = text.slice(s, e), folded = lower.slice(s, e);
    var mark = new Array(piece.length);
    terms.forEach(function (t) {
      if (!t) return;
      for (var at = folded.indexOf(t); at !== -1; at = folded.indexOf(t, at + t.length)) {
        for (var k = at; k < at + t.length; k++) mark[k] = true;
      }
    });
    var html = '', open = false;
    for (var j = 0; j < piece.length; j++) {
      if (mark[j] && !open) { html += '<mark>'; open = true; }
      if (!mark[j] && open) { html += '</mark>'; open = false; }
      html += esc(piece[j]);
    }
    if (open) html += '</mark>';
    return (s > 0 ? '… ' : '') + html + (e < text.length ? ' …' : '');
  }

  function run() {
    var query = q.value.trim();
    out.innerHTML = '';
    if (!idx || !query) { status.textContent = ''; return; }
    var terms = fold(query).split(/\s+/).filter(Boolean);
    var hits;
    try {
      hits = idx.search(terms.map(function (t) { return '+' + t.replace(/[:~^+\-*]/g, '') + '*'; }).join(' '));
    } catch (e) { hits = []; }
    status.textContent = T(hits.length === 1 ? 'search_one' : 'search_many', hits.length, query);
    hits.forEach(function (h) {
      var d = docs[+h.ref];
      var li = document.createElement('li');
      li.innerHTML = '<a href="' + d.url + '">' + esc(d.title) + '</a> ' + (d.kind === 'person' ? '<span class="ai-tag">' + esc(T('person')) + '</span>' : d.kind === 'org' ? '<span class="ai-tag">' + esc(T('organization')) + '</span>' : '<time>' + d.date + '</time>') +
        '<p>' + (snippet(d.text, terms) || (d.kind === 'document' ? '<span class="ai-tag">' + esc(T('ai_summary')) + '</span> ' : '') + esc(d.summary)) + '</p>';
      out.appendChild(li);
    });
  }

  status.textContent = T('search_loading');
  fetch(base + (lang === 'es' ? 'es/' : '') + 'search.json').then(function (r) { return r.json(); }).then(function (data) {
    docs = data;
    idx = lunr(function () {
      // no stemming: prefix matching ("annex*") must work on the words as written
      this.pipeline.remove(lunr.stemmer);
      this.searchPipeline.remove(lunr.stemmer);
      // fold accents before the trimmer, which would otherwise cut a trailing accented letter ("está" -> "est")
      this.pipeline.before(lunr.trimmer, lunr.Pipeline.registeredFunctions.fold);
      this.ref('id');
      this.field('title', { boost: 10 });
      this.field('summary', { boost: 4 });
      this.field('tags', { boost: 4 });
      this.field('text');
      var b = this;
      data.forEach(function (d) { b.add(d); });
    });
    status.textContent = '';
    var initial = new URLSearchParams(location.search).get('q');
    if (initial) { q.value = initial; }
    run();
  }).catch(function () { status.textContent = T('search_error'); });

  document.getElementById('search-form').addEventListener('submit', function (e) { e.preventDefault(); run(); });
  q.addEventListener('input', run);
})();
