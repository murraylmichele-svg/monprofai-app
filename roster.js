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

var CODE_COUNTER_KEY = 'monprofai_next_code_counter';

// Generate next available code — guaranteed unique even after deletions,
// by tracking the highest number ever issued rather than the current
// roster's length.
function nextCode(roster) {
  var maxExisting = 0;
  roster.forEach(function(s) {
    var match = /^EL_(\d+)$/.exec(s.code);
    if (match) {
      var num = parseInt(match[1], 10);
      if (num > maxExisting) maxExisting = num;
    }
  });

  var storedCounter = parseInt(localStorage.getItem(CODE_COUNTER_KEY) || '0', 10);
  var nextNum = Math.max(maxExisting, storedCounter) + 1;

  localStorage.setItem(CODE_COUNTER_KEY, String(nextNum));
  return 'EL_' + (nextNum < 10 ? '0' + nextNum : '' + nextNum);
}

// Add a new student
function addStudent(prenom, nomInitial, pronom, annee, peiHH, peiAcademique) {
  var roster = getRoster();
  var student = {
    code: nextCode(roster),
    prenom: prenom.trim(),
    nomInitial: nomInitial.trim().toUpperCase().replace('.', '') + '.',
    pronom: pronom,
    annee: annee,
    actif: true,
    peiHH: !!peiHH,
    peiAcademique: !!peiAcademique
  };
  roster.push(student);
  saveRoster(roster);
  return student;
}

// Update an existing student by code
function updateStudent(code, prenom, nomInitial, pronom, annee, peiHH, peiAcademique) {
  var roster = getRoster();
  roster = roster.map(function(s) {
    if (s.code === code) {
      return {
        code: s.code,
        prenom: prenom.trim(),
        nomInitial: nomInitial.trim().toUpperCase().replace('.', '') + '.',
        pronom: pronom,
        annee: annee,
        actif: s.actif,
        peiHH: !!peiHH,
        peiAcademique: !!peiAcademique
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
  html += '<div class="form-row">';
  html += '<label><input type="checkbox" id="input-pei-hh"> PEI - HH</label> ';
  html += '<label><input type="checkbox" id="input-pei-academique"> PEI - Académique</label>';
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
      html += '<button onclick="toggleStudentActif(\'' + s.code + '\'); renderRoster();">Désactiver</button> ';
      html += '<button class="btn-delete" onclick="removeStudentCompletely(\'' + s.code + '\')">Supprimer définitivement</button>';
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
      html += '<td>';
      html += '<button onclick="toggleStudentActif(\'' + s.code + '\'); renderRoster();">Réactiver</button> ';
      html += '<button class="btn-delete" onclick="removeStudentCompletely(\'' + s.code + '\')">Supprimer définitivement</button>';
      html += '</td>';
      html += '</tr>';
    });
    html += '</table>';
  }

  html += '<div class="data-management-section">';
  html += '<h3>Gestion des données</h3>';
  html += '<p>Téléchargez une sauvegarde et effacez toutes les observations et productions pour repartir à zéro (ex: nouvelle année scolaire). La liste de classe n\'est pas touchée par cette action.</p>';
  html += '<button class="btn-delete" onclick="resetAllYearData()">Effacer toutes les données (nouvelle année)</button>';
  html += '</div>';

  container.innerHTML = html;
}

function submitRosterForm() {
  var prenom = document.getElementById('input-prenom').value.trim();
  var nom = document.getElementById('input-nom').value.trim();
  var pronom = document.getElementById('input-pronom').value;
  var annee = document.getElementById('input-annee').value;
  var code = document.getElementById('edit-code').value;
  var peiHH = document.getElementById('input-pei-hh').checked;
  var peiAcademique = document.getElementById('input-pei-academique').checked;

  if (!prenom || !nom) {
    alert('Veuillez entrer le prénom et l\'initiale du nom.');
    return;
  }

  if (code) {
    updateStudent(code, prenom, nom, pronom, annee, peiHH, peiAcademique);
  } else {
    addStudent(prenom, nom, pronom, annee, peiHH, peiAcademique);
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
  document.getElementById('input-pei-hh').checked = !!s.peiHH;
  document.getElementById('input-pei-academique').checked = !!s.peiAcademique;
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
// ============================================================
// roster.js — MonProf.ai
// ADDITION: Data export, year-end reset, and student deletion
// ============================================================
// APPEND this to the END of your roster.js file.
// Also make Edits 1-3 described separately.
//
// These functions are used from Roster now, and will also be
// wired into Productions and Observations in a follow-up step.
//
// Depends on:
//   - getObservations(), saveObservations() — observations.js
//   - getAllProductions(), getProductionsByStudent(), deleteProduction() — productions.js
//   - getRoster(), saveRoster(), displayName() — this file
// ============================================================

async function exportAllDataAsFile() {
  var roster = getRoster();
  var observations = getObservations();
  var productions = await getAllProductions();

  // Photos are NOT included in this backup — text data only
  var productionsForExport = productions.map(function(p) {
    return {
      id: p.id,
      studentCode: p.studentCode,
      domain: p.domain,
      activityTag: p.activityTag,
      note: p.note,
      level: p.level,
      photoCount: (p.photoIds ? p.photoIds.length : 0),
      createdAt: p.createdAt,
      editedAt: p.editedAt
    };
  });

  var exportData = {
    exportedAt: new Date().toISOString(),
    note: 'Cette sauvegarde contient les notes textuelles seulement. Les photos ne sont PAS incluses.',
    roster: roster,
    observations: observations,
    productions: productionsForExport
  };

  var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  var dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = 'monprofai_sauvegarde_' + dateStr + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function resetAllYearData() {
  var confirmed = confirm(
    'Ceci supprimera TOUTES les observations et productions pour TOUS les élèves. ' +
    'La liste de classe ne sera pas touchée. ' +
    'Une sauvegarde sera téléchargée avant la suppression. Voulez-vous continuer?'
  );
  if (!confirmed) return;

  await exportAllDataAsFile();

  // Give the browser a moment to actually start the download before wiping data
  setTimeout(async function() {
    saveObservations([]);

    var allProductions = await getAllProductions();
    for (var i = 0; i < allProductions.length; i++) {
      await deleteProduction(allProductions[i].id);
    }

    alert('Toutes les données ont été effacées. La liste des élèves demeure intacte.');
    location.reload();
  }, 800);
}

async function clearStudentData(studentCode, studentName) {
  var confirmed = confirm(
    'Ceci supprimera toutes les observations et productions pour ' + studentName + '. ' +
    'Une sauvegarde complète sera téléchargée avant la suppression. Voulez-vous continuer?'
  );
  if (!confirmed) return;

  await exportAllDataAsFile();

  setTimeout(async function() {
    var obs = getObservations().filter(function(o) { return o.studentCode !== studentCode; });
    saveObservations(obs);

    var studentProductions = await getProductionsByStudent(studentCode);
    for (var i = 0; i < studentProductions.length; i++) {
      await deleteProduction(studentProductions[i].id);
    }

    alert('Les données de ' + studentName + ' ont été effacées.');
    location.reload();
  }, 800);
}

async function removeStudentCompletely(code) {
  var roster = getRoster();
  var student = roster.find(function(s) { return s.code === code; });
  if (!student) return;

  var name = displayName(student);
  var confirmed = confirm(
    'Ceci supprimera ' + name + ' de la liste de classe de façon PERMANENTE, ' +
    'ainsi que toutes ses observations et productions. ' +
    'Une sauvegarde complète sera téléchargée avant la suppression. Voulez-vous continuer?'
  );
  if (!confirmed) return;

  await exportAllDataAsFile();

  setTimeout(async function() {
    var updatedRoster = getRoster().filter(function(s) { return s.code !== code; });
    saveRoster(updatedRoster);

    var obs = getObservations().filter(function(o) { return o.studentCode !== code; });
    saveObservations(obs);

    var studentProductions = await getProductionsByStudent(code);
    for (var i = 0; i < studentProductions.length; i++) {
      await deleteProduction(studentProductions[i].id);
    }

    alert(name + ' a été supprimé(e) de façon permanente.');
    renderRoster();
  }, 800);
}
// ============================================================
// roster.js — MonProf.ai
// ADDITION: shared helper to clear a student's data from a dropdown
// ============================================================
// APPEND this to the END of your roster.js file, after the
// data-management functions added previously.
//
// Depends on:
//   - clearStudentData(), getRoster(), displayName() — already in this file
// ============================================================

function handleClearStudentFromDropdown(selectId) {
  var select = document.getElementById(selectId);
  var code = select ? select.value : '';
  if (!code) {
    alert('Veuillez sélectionner un élève.');
    return;
  }

  var roster = getRoster();
  var student = roster.find(function(s) { return s.code === code; });
  if (!student) return;

  clearStudentData(code, displayName(student));
}
// ============================================================
// GRADES 1-6 — PART G1: Reference constants
// ============================================================
// APPEND this to the END of roster.js.
// These are used by the UI in Parts G2/G3, and by isGrade1to6()
// which Observations/Productions/Bulletins will all rely on to
// decide which capture form to show.
// ============================================================

var HH_CATEGORIES = [
  'Utilisation du français oral',
  'Fiabilité',
  'Sens de l\'organisation',
  'Autonomie',
  'Esprit de collaboration',
  'Sens de l\'initiative',
  'Autorégulation'
];

var ACHIEVEMENT_CATEGORIES = [
  'Connaissance et compréhension',
  'Habiletés de la pensée',
  'Communication',
  'Mise en application'
];

var GRADES_1_6_SUBJECTS = [
  'Français',
  'Mathématiques'
];

var SUBJECT_STRANDS = {
  'Français': [
    'B - Notions fondamentales de la langue',
    'C - Compréhension : comprendre des textes et y réagir',
    'D - Rédaction : expression d\'idées et création de textes'
  ],
  'Mathématiques': [
    'B - Nombres',
    'C - Algèbre',
    'D - Données',
    'E - Sens de l\'espace',
    'F - Littératie financière'
  ]
};

// Only used when Français + "B - Notions fondamentales de la langue"
// is selected. Shown as a flat continuum, not filtered by grade level
// (a grade 6 student can still be tagged with an earlier-continuum skill).
var DOMAINE_B_FRANCAIS_CONTINUUM = [
  'Conscience phonémique',
  'Connaissance des lettres',
  'Correspondances graphèmes-phonèmes',
  'Lecture et orthographe au niveau des mots',
  'Vocabulaire (incluant la morphologie)',
  'Fluidité en lecture',
  'Syntaxe et structure de phrases',
  'Grammaire',
  'Ponctuation et majuscules'
];

var NIVEAU_OPTIONS = ['Niveau 1', 'Niveau 2', 'Niveau 3', 'Niveau 4'];

function isGrade1to6(studentCode) {
  var roster = getRoster();
  var student = roster.find(function(s) { return s.code === studentCode; });
  if (!student) return false;
  return ['1', '2', '3', '4', '5', '6'].indexOf(student.annee) !== -1;
}
