(function () {
  var f = document.getElementById('p-filter');
  var count = document.getElementById('p-count');
  function T(k, a, b) { return String((window.I18N || {})[k] || k).replace(/%1/g, a).replace(/%2/g, b); }
  var rows = Array.prototype.slice.call(document.querySelectorAll('table.people-index tbody tr'));
  f.addEventListener('input', function () {
    var q = f.value.trim().toLowerCase(), shown = 0;
    rows.forEach(function (r) {
      var ok = !q || r.dataset.search.indexOf(q) !== -1;
      r.hidden = !ok;
      if (ok) shown++;
    });
    count.textContent = q ? T('n_of_shown', shown, rows.length) : '';
  });
})();
