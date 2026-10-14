(function () {
  var type = document.getElementById('f-type');
  var tag = document.getElementById('f-tag');
  var count = document.getElementById('f-count');
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
    count.textContent = (type.value || tag.value) ? shown + ' of ' + rows.length + ' shown' : '';
  }
  type.addEventListener('change', apply);
  tag.addEventListener('change', apply);
})();
