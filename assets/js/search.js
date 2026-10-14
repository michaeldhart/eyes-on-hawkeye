(function () {
  var base = (document.querySelector('link[rel=stylesheet]').getAttribute('href') || '').replace(/assets\/css\/site\.css.*$/, '');
  var q = document.getElementById('q');
  var out = document.getElementById('results');
  var status = document.getElementById('status');
  var docs = [], idx = null;

  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function snippet(text, terms) {
    var lower = text.toLowerCase(), pos = -1;
    for (var i = 0; i < terms.length && pos < 0; i++) pos = lower.indexOf(terms[i]);
    if (pos < 0) return '';
    var s = Math.max(0, pos - 80), e = Math.min(text.length, pos + 160);
    var piece = esc(text.slice(s, e));
    terms.forEach(function (t) {
      if (!t) return;
      piece = piece.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
    });
    return (s > 0 ? '… ' : '') + piece + (e < text.length ? ' …' : '');
  }

  function run() {
    var query = q.value.trim();
    out.innerHTML = '';
    if (!idx || !query) { status.textContent = ''; return; }
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    var hits;
    try {
      hits = idx.search(terms.map(function (t) { return '+' + t.replace(/[:~^+\-*]/g, '') + '*'; }).join(' '));
    } catch (e) { hits = []; }
    status.textContent = hits.length + (hits.length === 1 ? ' document matches' : ' documents match') + ' “' + query + '”';
    hits.forEach(function (h) {
      var d = docs[+h.ref];
      var li = document.createElement('li');
      li.innerHTML = '<a href="' + d.url + '">' + esc(d.title) + '</a> <time>' + d.date + '</time>' +
        '<p>' + (snippet(d.text, terms) || esc(d.summary)) + '</p>';
      out.appendChild(li);
    });
  }

  status.textContent = 'Loading the index…';
  fetch(base + 'search.json').then(function (r) { return r.json(); }).then(function (data) {
    docs = data;
    idx = lunr(function () {
      // no stemming: prefix matching ("annex*") must work on the words as written
      this.pipeline.remove(lunr.stemmer);
      this.searchPipeline.remove(lunr.stemmer);
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
  }).catch(function () { status.textContent = 'Could not load the search index.'; });

  document.getElementById('search-form').addEventListener('submit', function (e) { e.preventDefault(); run(); });
  q.addEventListener('input', run);
})();
