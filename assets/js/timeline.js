(function () {
  var wrap = document.getElementById('timeline');
  var inner = document.getElementById('tl-inner');
  var preview = document.getElementById('preview');
  var legend = document.getElementById('tl-legend');
  var DAY = 86400000, LABEL_W = 56, ROW = 30, PAD = 60;
  var pxPerDay = 3, items = [], types = {}, hidden = {}, selected = null;

  var colors = {}, labels = {};
  var typeData = JSON.parse(wrap.dataset.types || '{}');
  Object.keys(typeData).forEach(function (k) { colors[k] = typeData[k].color; labels[k] = typeData[k].label; });

  function t(d) { return Date.parse(d + 'T12:00:00Z'); }
  function fmt(d) { return new Date(t(d)).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function render() {
    inner.innerHTML = '';
    var vis = items.filter(function (i) { return !hidden[i.type]; });
    if (!items.length) { inner.textContent = 'No items yet.'; return; }
    var all = items.map(function (i) { return t(i.date); });
    var start = new Date(Math.min.apply(null, all)); start = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1);
    var endD = new Date(Math.max.apply(null, all) + 31 * DAY); var end = Date.UTC(endD.getUTCFullYear(), endD.getUTCMonth(), 1);
    var width = Math.max(wrap.clientWidth, (end - start) / DAY * pxPerDay + PAD * 2);
    inner.style.width = width + 'px';

    // axis: month ticks, year labels
    for (var m = new Date(start); m.getTime() <= end; m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))) {
      var x = PAD + (m.getTime() - start) / DAY * pxPerDay;
      var isYear = m.getUTCMonth() === 0;
      var tick = document.createElement('div');
      tick.className = 'tick' + (isYear ? ' year' : '');
      tick.style.left = x + 'px';
      if (isYear || pxPerDay >= 3 || m.getUTCMonth() % 3 === 0) {
        var lab = document.createElement('span');
        lab.textContent = isYear ? m.getUTCFullYear() : m.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
        tick.appendChild(lab);
      }
      inner.appendChild(tick);
    }

    // lane assignment so overlapping dots stack instead of covering each other
    var lanes = [];
    vis.sort(function (a, b) { return t(a.date) - t(b.date); }).forEach(function (it) {
      var x = PAD + (t(it.date) - start) / DAY * pxPerDay;
      var lane = 0;
      while (lanes[lane] !== undefined && x - lanes[lane] < 22) lane++;
      lanes[lane] = x;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dot' + (selected === it ? ' sel' : '');
      b.style.left = x + 'px';
      b.style.top = (40 + lane * ROW) + 'px';
      b.style.setProperty('--c', colors[it.type] || '#6b6b6b');
      b.setAttribute('aria-label', fmt(it.date) + ': ' + it.title);
      b.title = fmt(it.date) + ' — ' + it.title;
      b.addEventListener('click', function () { select(it); });
      inner.appendChild(b);
    });
    inner.style.height = (60 + Math.max(lanes.length, 1) * ROW + 40) + 'px';
    inner._start = start;
  }

  function select(it) {
    selected = it;
    var html = '<p class="meta"><span class="badge" style="--c:' + (colors[it.type] || '#6b6b6b') + '">' + esc(labels[it.type] || it.type) + '</span> ' +
      '<time>' + fmt(it.date) + '</time></p><h2>' + esc(it.title) + '</h2>';
    if (it.summary) html += '<p>' + esc(it.summary) + '</p>';
    if (it.pages && it.doc_title) html += '<p class="muted small">From <em>' + esc(it.doc_title) + '</em>, pages ' + esc(it.pages) + '</p>';
    html += '<p class="actions">';
    if (it.url) html += '<a class="btn" href="' + it.url + '">Open Document Page</a>';
    if (it.pdf) html += '<a class="btn ghost" href="' + it.pdf + '" target="_blank" rel="noopener">Open Original PDF' + (it.pages ? ' at Page ' + esc(String(it.pages).split('-')[0]) : '') + '</a>';
    html += '</p>';
    preview.innerHTML = html;
    render();
  }

  function buildLegend() {
    legend.innerHTML = '';
    Object.keys(types).sort().forEach(function (k) {
      var l = document.createElement('label');
      l.innerHTML = '<input type="checkbox" checked> <span class="swatch" style="--c:' + (colors[k] || '#6b6b6b') + '"></span>' + esc(labels[k] || k);
      l.querySelector('input').addEventListener('change', function (e) { hidden[k] = !e.target.checked; render(); });
      legend.appendChild(l);
    });
  }

  function zoom(f) {
    var center = (wrap.scrollLeft + wrap.clientWidth / 2) / pxPerDay;
    pxPerDay = Math.min(30, Math.max(0.5, pxPerDay * f));
    render();
    wrap.scrollLeft = center * pxPerDay - wrap.clientWidth / 2;
  }
  document.getElementById('z-in').addEventListener('click', function () { zoom(1.6); });
  document.getElementById('z-out').addEventListener('click', function () { zoom(1 / 1.6); });
  wrap.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') wrap.scrollLeft += 120;
    if (e.key === 'ArrowLeft') wrap.scrollLeft -= 120;
  });

  fetch(wrap.dataset.src).then(function (r) { return r.json(); }).then(function (data) {
    items = data;
    items.forEach(function (i) { types[i.type] = true; });
    buildLegend();
    render();
    wrap.scrollLeft = wrap.scrollWidth; // start at the most recent end
  }).catch(function () { inner.textContent = 'Could not load the timeline.'; });
})();
