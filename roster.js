// ============================================================
// ROSTER.JS — Student list, codes, localStorage
// ============================================================

var ROSTER_KEY = 'monprofai_roster';

// Load roster from localStorage
function getRoster() {
  try {
    var data = localStorage.getItem(ROSTER_KEY);
    return data ? JSON.parse(data) : [];
  } catch(e) {
    return [];
  }
}

// Save roster to localStorage
function saveRoster(roster) {
  try {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
  } catch(e) {
    alert('Erreur: impossible de sauvegarder la liste.');
  }
}

// Generate next available code
function nextCode(roster) {
  var n = roster.length + 1;
  return 'EL_' + (n < 10 ? '0' + n : '' + n);
}

// Add a new student
function addStudent(prenom, nomInitial, pronom, annee) {
  var roster = getRoster();
  var student = {
    code: nextCode(roster),
    prenom: prenom.trim(),
    nomInitial: nomInitial.trim().toUpperCase().replace('.', '') + '.',
    pronom: pronom,
    annee: annee,
    actif: true
  };
  roster.push(student);
  saveRoster(roster);
  return student;
}

// Update an existing student by code
function updateStudent(code, prenom, nomInitial, pronom, annee) {
  var roster = getRoster();
  roster = roster.map(function(s) {
    if (s.code === code) {
      return {
        code: s.code,
        prenom: prenom.trim(),
        nomInitial: nomInitial.trim().toUpperCase().replace('.', '') + '.',
        pronom: pronom,
        annee: annee,
        actif: s.actif
      };
    }
    return s;
  });
  saveRoster(roster);
}

// Toggle active/inactive
function toggleStudentActif(code) {
  var roster = getRoster();
  roster = roster.map(function(s) {
    if (s.code === code) s.actif = !s.actif;
    return s;
  });
  saveRoster(roster);
}

// Get display name: "Sophie M."
function displayName(student) {
  return student.prenom + ' ' + student.nomInitial;
}

// PRIVACY: swap real names for codes in text before sending to API
function anonymizeText(text) {
  var roster = getRoster();
  roster.forEach(function(s) {
    var full = s.prenom + ' ' + s.nomInitial;
    var first = s.prenom;
    // Replace full display name first, then first name alone
    text = text.split(full).join(s.code);
    text = text.split(first).join(s.code);
  });
  return text;
}

// PRIVACY: swap codes back to display names in API response
function deanonymizeText(text) {
  var roster = getRoster();
  roster.forEach(function(s) {
    text = text.split(s.code).join(displayName(s));
  });
  return text;
}

// ============================================================
// RENDER ROSTER MODULE
// ============================================================

function renderRoster() {
  var container = document.getElementById('module-roster');
  if (!container) return;
  var roster = getRoster();
  var actifs = roster.filter(function(s) { return s.actif; });
  var inactifs = roster.filter(function(s) { return !s.actif; });

  var html = '<h2>Ma classe</h2>';

  // Add student form
  html += '<div id="roster-form">';
  html += '<h3 id="form-title">Ajouter un élève</h3>';
  html += '<input type="hidden" id="edit-code" value="">';
  html += '<div class="form-row">';
  html += '<input type="text" id="input-prenom" placeholder="Prénom" maxlength="30">';
  html += '<input type="text" id="input-nom" placeholder="Initiale du nom (ex: M)" maxlength="2">';
  html += '</div>';
  html += '<div class="form-row">';
  html += '<select id="input-pronom">';
  html += '<option value="elle">elle</option>';
  html += '<option value="il">il</option>';
  html += '<option value="iel">iel</option>';
  html += '</select>';
  html += '<select id="input-annee">';
  html += '<option value="Maternelle">Maternelle</option>';
  html += '<option value="Jardin">Jardin</option>';
  html += '<option value="1">1re année</option>';
  html += '<option value="2">2e année</option>';
  html += '<option value="3">3e année</option>';
  html += '<option value="4">4e année</option>';
  html += '<option value="5">5e année</option>';
  html += '<option value="6">6e année</option>';
  html += '</select>';
  html += '</div>';
  html += '<button onclick="submitRosterForm()">Enregistrer</button>';
  html += '<button onclick="cancelRosterForm()" id="btn-cancel" style="display:none">Annuler</button>';
  html += '</div>';

  // Active students
  html += '<h3>Élèves actifs (' + actifs.length + ')</h3>';
  if (actifs.length === 0) {
    html += '<p>Aucun élève pour le moment. Ajoutez vos élèves ci-dessus.</p>';
  } else {
    html += '<table class="roster-table">';
    html += '<tr><th>Code</th><th>Nom</th><th>Pronom</th><th>Année</th><th>Actions</th></tr>';
    actifs.forEach(function(s) {
      html += '<tr>';
      html += '<td>' + s.code + '</td>';
      html += '<td>' + displayName(s) + '</td>';
      html += '<td>' + s.pronom + '</td>';
      html += '<td>' + s.annee + '</td>';
      html += '<td>';
      html += '<button onclick="editStudent(\'' + s.code + '\')">Modifier</button> ';
      html += '<button onclick="toggleStudentActif(\'' + s.code + '\'); renderRoster();">Désactiver</button>';
      html += '</td>';
      html += '</tr>';
    });
    html += '</table>';
  }

  // Inactive students
  if (inactifs.length > 0) {
    html += '<h3>Élèves inactifs (' + inactifs.length + ')</h3>';
    html += '<table class="roster-table">';
    inactifs.forEach(function(s) {
      html += '<tr>';
      html += '<td>' + s.code + '</td>';
      html += '<td>' + displayName(s) + '</td>';
      html += '<td colspan="2"><em>inactif</em></td>';
      html += '<td><button onclick="toggleStudentActif(\'' + s.code + '\'); renderRoster();">Réactiver</button></td>';
      html += '</tr>';
    });
    html += '</table>';
  }

  container.innerHTML = html;
}

function submitRosterForm() {
  var prenom = document.getElementById('input-prenom').value.trim();
  var nom = document.getElementById('input-nom').value.trim();
  var pronom = document.getElementById('input-pronom').value;
  var annee = document.getElementById('input-annee').value;
  var code = document.getElementById('edit-code').value;

  if (!prenom || !nom) {
    alert('Veuillez entrer le prénom et l\'initiale du nom.');
    return;
  }

  if (code) {
    updateStudent(code, prenom, nom, pronom, annee);
  } else {
    addStudent(prenom, nom, pronom, annee);
  }
  cancelRosterForm();
  renderRoster();
}

function editStudent(code) {
  var roster = getRoster();
  var s = roster.find(function(s) { return s.code === code; });
  if (!s) return;
  document.getElementById('edit-code').value = s.code;
  document.getElementById('input-prenom').value = s.prenom;
  document.getElementById('input-nom').value = s.nomInitial.replace('.', '');
  document.getElementById('input-pronom').value = s.pronom;
  document.getElementById('input-annee').value = s.annee;
  document.getElementById('form-title').textContent = 'Modifier un élève';
  document.getElementById('btn-cancel').style.display = 'inline';
  document.getElementById('roster-form').scrollIntoView({ behavior: 'smooth' });
}

function cancelRosterForm() {
  document.getElementById('edit-code').value = '';
  document.getElementById('input-prenom').value = '';
  document.getElementById('input-nom').value = '';
  document.getElementById('input-pronom').value = 'elle';
  document.getElementById('input-annee').value = 'Maternelle';
  document.getElementById('form-title').textContent = 'Ajouter un élève';
  document.getElementById('btn-cancel').style.display = 'none';
}
