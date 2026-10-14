(function () {
  var f = document.getElementById('p-filter');
  var count = document.getElementById('p-count');
  var rows = Array.prototype.slice.call(document.querySelectorAll('table.people-index tbody tr'));
  f.addEventListener('input', function () {
    var q = f.value.trim().toLowerCase(), shown = 0;
    rows.forEach(function (r) {
      var ok = !q || r.dataset.search.indexOf(q) !== -1;
      r.hidden = !ok;
      if (ok) shown++;
    });
    count.textContent = q ? shown + ' of ' + rows.length + ' shown' : '';
  });
})();
