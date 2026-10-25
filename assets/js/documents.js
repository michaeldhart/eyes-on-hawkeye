(function () {
  var type = document.getElementById('f-type');
  var tag = document.getElementById('f-tag');
  var count = document.getElementById('f-count');
  function T(k, a, b) { return String((window.I18N || {})[k] || k).replace(/%1/g, a).replace(/%2/g, b); }
  var rows = Array.prototype.slice.call(document.querySelectorAll('table.index tbody tr'));

  function apply() {
    var shown = 0;
    rows.forEach(function (r) {
      var okType = !type.value || r.dataset.type === type.value;
      var okTag = !tag.value || r.dataset.tags.split(',').indexOf(tag.value) !== -1;
      var show = okType && okTag;
      r.hidden = !show;
      if (show) shown++;
    });
    count.textContent = (type.value || tag.value) ? T('n_of_shown', shown, rows.length) : '';
  }
  type.addEventListener('change', apply);
  tag.addEventListener('change', apply);
})();
