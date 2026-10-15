(function () {
  var wrap = document.getElementById('timeline');
  var inner = document.getElementById('tl-inner');
  var preview = document.getElementById('preview');
  var legend = document.getElementById('tl-legend');
  var statusEl = document.getElementById('tl-status');
  var listBox = document.getElementById('tl-listbox');
  var DAY = 86400000, ROW = 30, PAD = 60, SLOT = 26; // SLOT: min horizontal gap so 24px targets don't overlap
  var pxPerDay = 3, items = [], types = {}, hidden = {}, selected = null;
  var buttons = [];      // dot buttons, in time order, for the records currently shown
  var shown = [];        // the records currently shown, same order as buttons
  var rover = 0;         // index of the one dot that is a tab stop

  var colors = {}, labels = {}, shapes = {};
  var typeData = JSON.parse(wrap.dataset.types || '{}');
  Object.keys(typeData).forEach(function (k) { colors[k] = typeData[k].color; labels[k] = typeData[k].label; shapes[k] = typeData[k].shape; });

  // Shapes in a 20x20 box. Color is never the only cue: each type also has its own shape.
  var SHAPES = {
    circle: '<circle cx="10" cy="10" r="7.5"/>',
    square: '<rect x="3" y="3" width="14" height="14" rx="2"/>',
    diamond: '<polygon points="10,1.5 18.5,10 10,18.5 1.5,10"/>',
    triangle: '<polygon points="10,2 18.5,17 1.5,17"/>',
    pentagon: '<polygon points="10,2 18,8 15,17.5 5,17.5 2,8"/>',
    hexagon: '<polygon points="5.5,3 14.5,3 19,10 14.5,17 5.5,17 1,10"/>',
    octagon: '<polygon points="6.5,2 13.5,2 18,6.5 18,13.5 13.5,18 6.5,18 2,13.5 2,6.5"/>',
    cross: '<polygon points="7.5,2 12.5,2 12.5,7.5 18,7.5 18,12.5 12.5,12.5 12.5,18 7.5,18 7.5,12.5 2,12.5 2,7.5 7.5,7.5"/>',
    star: '<polygon points="10,1.5 12.3,7.4 18.5,7.7 13.6,11.6 15.3,17.6 10,14.2 4.7,17.6 6.4,11.6 1.5,7.7 7.7,7.4"/>'
  };
  function shapeSvg(type, size) {
    var s = SHAPES[shapes[type]] || SHAPES.circle;
    return '<svg viewBox="0 0 20 20" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">' + s + '</svg>';
  }

  function t(d) { return Date.parse(d + 'T12:00:00Z'); }
  function fmt(d) { return new Date(t(d)).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function say(msg) { statusEl.textContent = ''; setTimeout(function () { statusEl.textContent = msg; }, 30); }
  function typeColor(type) { return colors[type] || '#6b6b6b'; }

  function render() {
    inner.innerHTML = '';
    shown = items.filter(function (i) { return !hidden[i.type]; }).sort(function (a, b) { return t(a.date) - t(b.date); });
    buttons = [];
    if (!items.length) { inner.textContent = 'No records yet.'; return; }
    var all = items.map(function (i) { return t(i.date); });
    var start = new Date(Math.min.apply(null, all)); start = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1);
    var endD = new Date(Math.max.apply(null, all) + 31 * DAY); var end = Date.UTC(endD.getUTCFullYear(), endD.getUTCMonth(), 1);
    var width = Math.max(wrap.clientWidth, (end - start) / DAY * pxPerDay + PAD * 2);
    inner.style.width = width + 'px';

    // axis: month ticks and year labels. Decorative for assistive tech (the list view has the dates).
    var axis = document.createElement('div');
    axis.className = 'tl-axis';
    axis.setAttribute('aria-hidden', 'true');
    for (var m = new Date(start); m.getTime() <= end; m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))) {
      var x = PAD + (m.getTime() - start) / DAY * pxPerDay;
      var isYear = m.getUTCMonth() === 0;
      var tick = document.createElement('div');
      tick.className = 'tick' + (isYear ? ' year' : '');
      tick.style.left = x + 'px';
      var mo = m.getUTCMonth();
      if (isYear || pxPerDay >= 3 || (pxPerDay >= 1 && mo % 3 === 0) || (pxPerDay < 1 && mo % 6 === 0)) {
        var lab = document.createElement('span');
        lab.textContent = isYear ? m.getUTCFullYear() : m.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
        tick.appendChild(lab);
      }
      axis.appendChild(tick);
    }
    inner.appendChild(axis);

    // the dots are a real list, oldest first; overlapping dates stack into lanes
    var ol = document.createElement('ol');
    ol.className = 'tl-dots';
    ol.setAttribute('aria-label', 'Records, oldest first');
    var lanes = [];
    shown.forEach(function (it, idx) {
      var x = PAD + (t(it.date) - start) / DAY * pxPerDay;
      var lane = 0;
      while (lanes[lane] !== undefined && x - lanes[lane] < SLOT) lane++;
      lanes[lane] = x;
      var li = document.createElement('li');
      li.style.left = x + 'px';
      li.style.top = (50 + lane * ROW) + 'px';
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dot';
      b.style.setProperty('--c', typeColor(it.type));
      var name = (labels[it.type] || it.type) + ', ' + fmt(it.date) + ': ' + it.title;
      b.setAttribute('aria-label', name);
      b.title = fmt(it.date) + ' — ' + it.title;
      b.setAttribute('aria-pressed', selected === it ? 'true' : 'false');
      b.tabIndex = -1;
      b.innerHTML = shapeSvg(it.type, 22);
      b.addEventListener('click', function () { rover = idx; select(it); });
      li.appendChild(b);
      ol.appendChild(li);
      buttons.push(b);
    });
    inner.appendChild(ol);
    inner.style.height = (56 + Math.max(lanes.length, 1) * ROW + 36) + 'px';
    inner._start = start;
    // one tab stop: the selected dot if it is shown, otherwise the first
    var sel = shown.indexOf(selected);
    rover = sel >= 0 ? sel : Math.min(rover, Math.max(0, buttons.length - 1));
    if (buttons[rover]) buttons[rover].tabIndex = 0;
  }

  function focusDot(i) {
    if (!buttons.length) return;
    i = Math.max(0, Math.min(buttons.length - 1, i));
    if (buttons[rover]) buttons[rover].tabIndex = -1;
    rover = i;
    buttons[i].tabIndex = 0;
    buttons[i].focus();
  }

  // Arrow keys move between dots; Home/End jump to the ends.
  inner.addEventListener('keydown', function (e) {
    if (!e.target.classList || !e.target.classList.contains('dot')) return;
    var i = buttons.indexOf(e.target), k = e.key, to = null;
    if (k === 'ArrowRight' || k === 'ArrowDown') to = i + 1;
    else if (k === 'ArrowLeft' || k === 'ArrowUp') to = i - 1;
    else if (k === 'Home') to = 0;
    else if (k === 'End') to = buttons.length - 1;
    if (to === null) return;
    e.preventDefault();
    focusDot(to);
  });
  // With the timeline itself focused, the keys scroll it.
  wrap.addEventListener('keydown', function (e) {
    if (e.target !== wrap) return;
    var step = 120, page = wrap.clientWidth * 0.8;
    if (e.key === 'ArrowRight') wrap.scrollLeft += step;
    else if (e.key === 'ArrowLeft') wrap.scrollLeft -= step;
    else if (e.key === 'PageDown') wrap.scrollLeft += page;
    else if (e.key === 'PageUp') wrap.scrollLeft -= page;
    else if (e.key === 'Home') wrap.scrollLeft = 0;
    else if (e.key === 'End') wrap.scrollLeft = wrap.scrollWidth;
    else return;
    e.preventDefault();
  });

  function reveal(it) {
    var i = shown.indexOf(it);
    if (i < 0 || !buttons[i]) return;
    var li = buttons[i].parentNode;
    wrap.scrollLeft = Math.max(0, li.offsetLeft - wrap.clientWidth / 2);
  }

  // Selecting updates the preview and the dots in place. It does not rebuild the timeline,
  // so keyboard focus stays where it was.
  function select(it, opts) {
    opts = opts || {};
    if (hidden[it.type]) {           // selected from the list or a link while its type is filtered out
      hidden[it.type] = false;
      var box = legend.querySelector('input[data-type="' + it.type + '"]');
      if (box) box.checked = true;
      selected = it;
      render();
    }
    selected = it;
    buttons.forEach(function (b, i) { b.setAttribute('aria-pressed', shown[i] === it ? 'true' : 'false'); });
    var html = '<p class="meta"><span class="badge" style="--c:' + typeColor(it.type) + '">' + esc(labels[it.type] || it.type) + '</span> ' +
      '<time>' + fmt(it.date) + '</time></p><h2 id="preview-title" tabindex="-1">' + esc(it.title) + '</h2>';
    if (it.summary) html += '<p>' + esc(it.summary) + '</p><p class="ai-note">Summary written by AI. <a href="' + wrap.dataset.about + '">How we work</a></p>';
    if (it.pages && it.doc_title) html += '<p class="muted small">From <em>' + esc(it.doc_title) + '</em>, pages ' + esc(it.pages) + '</p>';
    if (it.who && it.who.length) {
      html += '<p class="who">Named: ' + it.who.map(function (w) { return '<a href="' + w.u + '">' + esc(w.n) + '</a>'; }).join(' ') + '</p>';
    }
    html += '<p class="actions">';
    if (it.url) html += '<a class="btn" href="' + it.url + '">Open Document Page</a>';
    if (it.pdf) html += '<a class="btn ghost" href="' + it.pdf + '" target="_blank" rel="noopener">Open Original PDF' + (it.pages ? ' at Page ' + esc(String(it.pages).split('-')[0]) : '') + '</a>';
    html += '</p>';
    preview.innerHTML = html;
    var idx = shown.indexOf(it);
    if (idx >= 0) { if (buttons[rover]) buttons[rover].tabIndex = -1; rover = idx; buttons[idx].tabIndex = 0; }
    if (opts.reveal) reveal(it);
    if (opts.focusPreview) {
      document.getElementById('preview-title').focus();
      preview.scrollIntoView({ block: 'nearest' });
    } else {
      say('Selected: ' + it.title + ', ' + fmt(it.date) + '. Details are in the Selected record section below the timeline.');
    }
  }

  function buildLegend() {
    Object.keys(types).sort().forEach(function (k) {
      var l = document.createElement('label');
      l.innerHTML = '<input type="checkbox" checked data-type="' + esc(k) + '"> <span class="swatch" style="--c:' + typeColor(k) + '">' + shapeSvg(k, 16) + '</span>' + esc(labels[k] || k);
      l.querySelector('input').addEventListener('change', function (e) {
        hidden[k] = !e.target.checked;
        render();
        say(shown.length + ' of ' + items.length + ' records shown.');
      });
      legend.appendChild(l);
    });
  }

  // A plain list of every record: an easier route for screen readers and anyone who prefers text.
  function buildList() {
    var sorted = items.slice().sort(function (a, b) { return t(a.date) - t(b.date); });
    var d = document.createElement('details');
    d.className = 'tl-list';
    var html = '<summary>View all ' + sorted.length + ' records as a list</summary><ol>';
    sorted.forEach(function (it, i) {
      html += '<li><time datetime="' + esc(it.date) + '">' + esc(fmt(it.date)) + '</time> <span class="tl-type">' + esc(labels[it.type] || it.type) + '</span> ' +
        '<button type="button" class="linklike" data-i="' + i + '">' + esc(it.title) + '</button></li>';
    });
    d.innerHTML = html + '</ol>';
    d.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-i]') : null;
      if (b) select(sorted[+b.dataset.i], { reveal: true, focusPreview: true });
    });
    listBox.appendChild(d);
  }

  function zoom(f) {
    var center = (wrap.scrollLeft + wrap.clientWidth / 2) / pxPerDay;
    pxPerDay = Math.min(30, Math.max(0.1, pxPerDay * f));
    render();
    wrap.scrollLeft = center * pxPerDay - wrap.clientWidth / 2;
    say(f > 1 ? 'Zoomed in.' : 'Zoomed out.');
  }
  // Open on the earliest dot, zoomed out just enough that at least two dots are in view.
  function openOnFirstDots() {
    var sorted = items.slice().sort(function (a, b) { return t(a.date) - t(b.date); });
    var lead = 80;
    if (sorted.length > 1) {
      var gap = (t(sorted[1].date) - t(sorted[0].date)) / DAY;
      if (gap > 0) pxPerDay = Math.max(0.1, Math.min(pxPerDay, (wrap.clientWidth - lead - 40) / gap));
    }
    render();
    if (sorted.length) {
      var x = PAD + (t(sorted[0].date) - inner._start) / DAY * pxPerDay;
      wrap.scrollLeft = Math.max(0, x - lead);
    }
  }

  // A link like /timeline/#2026-05-20-some-entry opens that entry and scrolls to its dot.
  function openFromHash() {
    var id = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (!id) return;
    var it = items.filter(function (i) { return i.id === id; })[0];
    if (!it) return;
    select(it, { reveal: true });
    preview.scrollIntoView({ block: 'nearest' });
  }

  document.getElementById('z-in').addEventListener('click', function () { zoom(1.6); });
  document.getElementById('z-out').addEventListener('click', function () { zoom(1 / 1.6); });
  window.addEventListener('hashchange', openFromHash);

  fetch(wrap.dataset.src).then(function (r) { return r.json(); }).then(function (data) {
    items = data;
    items.forEach(function (i) { types[i.type] = true; });
    buildLegend();
    buildList();
    openOnFirstDots();
    openFromHash();
  }).catch(function () { inner.textContent = 'Could not load the timeline.'; });
})();
