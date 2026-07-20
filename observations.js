// ============================================================
// OBSERVATIONS.JS — Capture observations and conversations
// ============================================================

var OBS_KEY = 'monprofai_observations';

// Load all observations from localStorage
function getObservations() {
  try {
    var data = localStorage.getItem(OBS_KEY);
    return data ? JSON.parse(data) : [];
  } catch(e) {
    return [];
  }
}

// Save all observations to localStorage
function saveObservations(obs) {
  try {
    localStorage.setItem(OBS_KEY, JSON.stringify(obs));
  } catch(e) {
    alert('Erreur: impossible de sauvegarder les observations.');
  }
}

// Add a new observation entry
function addObservation(studentCode, type, domaine, note) {
  var obs = getObservations();
  var entry = {
    id: Date.now(),
    studentCode: studentCode,
    type: type,           // 'observation' or 'conversation'
    domaine: domaine,     // 'A', 'B', 'C', 'D' (or subject for grades 1-6 later)
    note: note,
    date: new Date().toISOString().slice(0, 10),  // YYYY-MM-DD
    timestamp: Date.now()
  };
  obs.push(entry);
  saveObservations(obs);
  return entry;
}

// Delete an observation by id
function deleteObservation(id) {
  var obs = getObservations();
  obs = obs.filter(function(o) { return o.id !== id; });
  saveObservations(obs);
}

// Get observations for one student
function getObservationsForStudent(studentCode) {
  return getObservations().filter(function(o) {
    return o.studentCode === studentCode;
  });
}

// ============================================================
// RENDER OBSERVATIONS MODULE
// ============================================================

function renderObservations() {
  var container = document.getElementById('module-observations');
  if (!container) return;

  var roster = getRoster().filter(function(s) { return s.actif; });

  if (roster.length === 0) {
    container.innerHTML = '<h2>Observations</h2>'
      + '<p>Aucun élève dans votre classe. '
      + 'Commencez par ajouter vos élèves dans l\'onglet <strong>Classe</strong>.</p>';
    return;
  }

  var html = '<h2>Observations et conversations</h2>';

  // ---- CAPTURE FORM ----
  html += '<div id="obs-form">';
  html += '<h3>Nouvelle entrée</h3>';

  // Type toggle
  html += '<div class="obs-type-toggle">';
  html += '<button id="btn-type-obs" class="type-btn active" onclick="setObsType(\'observation\')">👁 Observation</button>';
  html += '<button id="btn-type-conv" class="type-btn" onclick="setObsType(\'conversation\')">💬 Conversation</button>';
  html += '</div>';
  html += '<input type="hidden" id="obs-type" value="observation">';

  // Student selector
  html += '<div class="form-row">';
  html += '<label>Élève</label>';
  html += '<select id="obs-student">';
  html += '<option value="">-- Sélectionner un élève --</option>';
  roster.forEach(function(s) {
    html += '<option value="' + s.code + '">' + displayName(s) + '</option>';
  });
  html += '</select>';
  html += '</div>';

  // Domain selector
  html += '<div class="form-row">';
  html += '<label>Domaine</label>';
  html += '<div class="domaine-btns">';
  html += '<button class="domaine-btn active" id="domaine-A" onclick="setDomaine(\'A\')"><strong>A</strong> Langue & maths</button>';
  html += '<button class="domaine-btn" id="domaine-B" onclick="setDomaine(\'B\')"><strong>B</strong> Résolution & innovation</button>';
  html += '<button class="domaine-btn" id="domaine-C" onclick="setDomaine(\'C\')"><strong>C</strong> Autorégulation & bien-être</button>';
  html += '<button class="domaine-btn" id="domaine-D" onclick="setDomaine(\'D\')"><strong>D</strong> Appartenance & contribution</button>';
  html += '</div>';
  html += '</div>';
  html += '<input type="hidden" id="obs-domaine" value="A">';

  // Note
  html += '<div class="form-row">';
  html += '<label>Note</label>';
  html += '<textarea id="obs-note" rows="3" placeholder="Décrivez ce que vous avez observé ou entendu..."></textarea>';
  html += '</div>';

  html += '<button onclick="submitObsForm()">Enregistrer</button>';
  html += '</div>'; // end obs-form

  // ---- HISTORY ----
  html += '<div id="obs-history">';
  html += renderObsHistory();
  html += '</div>';

  container.innerHTML = html;
}

// Set observation type (toggle buttons)
function setObsType(type) {
  document.getElementById('obs-type').value = type;
  document.getElementById('btn-type-obs').className = 'type-btn' + (type === 'observation' ? ' active' : '');
  document.getElementById('btn-type-conv').className = 'type-btn' + (type === 'conversation' ? ' active' : '');
}

// Set domain (toggle buttons)
function setDomaine(d) {
  document.getElementById('obs-domaine').value = d;
  ['A','B','C','D'].forEach(function(x) {
    document.getElementById('domaine-' + x).className = 'domaine-btn' + (x === d ? ' active' : '');
  });
}

// Submit the observation form
function submitObsForm() {
  var studentCode = document.getElementById('obs-student').value;
  var type = document.getElementById('obs-type').value;
  var domaine = document.getElementById('obs-domaine').value;
  var note = document.getElementById('obs-note').value.trim();

  if (!studentCode) {
    alert('Veuillez sélectionner un élève.');
    return;
  }
  if (!note) {
    alert('Veuillez entrer une note.');
    return;
  }

  addObservation(studentCode, type, domaine, note);
  document.getElementById('obs-note').value = '';
  document.getElementById('obs-student').value = '';
  document.getElementById('obs-history').innerHTML = renderObsHistory();
}

// Render the observation history list
function renderObsHistory() {
  var obs = getObservations();
  var roster = getRoster();

  if (obs.length === 0) {
    return '<p><em>Aucune entrée pour le moment.</em></p>';
  }

  // Sort newest first
  obs = obs.slice().sort(function(a, b) { return b.timestamp - a.timestamp; });

  var html = '<h3>Entrées récentes (' + obs.length + ')</h3>';
  html += '<table class="obs-table">';
  html += '<tr><th>Date</th><th>Élève</th><th>Type</th><th>Domaine</th><th>Note</th><th></th></tr>';

  obs.forEach(function(o) {
    var student = roster.find(function(s) { return s.code === o.studentCode; });
    var name = student ? displayName(student) : o.studentCode;
    var typeLabel = o.type === 'conversation' ? '💬' : '👁';
    html += '<tr>';
    html += '<td>' + o.date + '</td>';
    html += '<td>' + name + '</td>';
    html += '<td>' + typeLabel + '</td>';
    html += '<td><strong>' + o.domaine + '</strong></td>';
    html += '<td>' + o.note + '</td>';
    html += '<td><button class="btn-delete" onclick="deleteObservation(' + o.id + '); document.getElementById(\'obs-history\').innerHTML = renderObsHistory();">✕</button></td>';
    html += '</tr>';
  });

  html += '</table>';
  return html;
}
