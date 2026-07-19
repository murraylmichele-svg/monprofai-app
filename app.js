function showModule(name) {
  var modules = ['roster', 'observations', 'productions', 'bulletins'];
  modules.forEach(function(m) {
    var el = document.getElementById('module-' + m);
    if (el) el.style.display = (m === name) ? 'block' : 'none';
  });

  // Call the render function for the selected module
  if (name === 'roster') renderRoster();
  if (name === 'observations') renderObservations();
  if (name === 'productions') renderProductions();
  if (name === 'bulletins') renderBulletins();
}

// Show roster by default on load
document.addEventListener('DOMContentLoaded', function() {
  showModule('roster');
});
