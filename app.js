function showModule(name) {
  var modules = ['roster', 'observations', 'productions', 'bulletins'];
  modules.forEach(function(m) {
    var el = document.getElementById('module-' + m);
    if (el) el.style.display = (m === name) ? 'block' : 'none';
  });
}

// Show roster by default on load
document.addEventListener('DOMContentLoaded', function() {
  showModule('roster');
  renderRoster();
});
