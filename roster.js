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
  html += '<div style="color:var(--mp-taupe); font-size:14px; margin-top:-8px; margin-bottom:16px;">' + actifs.length + ' élève' + (actifs.length !== 1 ? 's' : '') + ' actif' + (actifs.length !== 1 ? 's' : '') + '</div>';

  // Add student form
  html += '<div id="roster-form" class="mp-card-block">';
  html += '<h3 id="form-title" style="margin-top:0;">Ajouter un élève</h3>';
  html += '<input type="hidden" id="edit-code" value="">';
  html += '<div class="form-row" style="display:flex; gap:8px;">';
  html += '<input type="text" id="input-prenom" placeholder="Prénom" maxlength="30" style="flex:2;">';
  html += '<input type="text" id="input-nom" placeholder="Initiale" maxlength="2" style="flex:1;">';
  html += '</div>';
  html += '<div class="form-row" style="display:flex; gap:8px;">';
  html += '<select id="input-pronom" style="flex:1;">';
  html += '<option value="elle">elle</option>';
  html += '<option value="il">il</option>';
  html += '<option value="iel">iel</option>';
  html += '</select>';
  html += '<select id="input-annee" style="flex:1;">';
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
  html += '<div class="form-row" style="display:flex; gap:8px;">';
  html += '<label class="mp-pei-check"><input type="checkbox" id="input-pei-hh"> PEI - HH</label>';
  html += '<label class="mp-pei-check"><input type="checkbox" id="input-pei-academique"> PEI - Académique</label>';
  html += '</div>';
  html += '<button class="mp-save-btn" onclick="submitRosterForm()"><i class="ti ti-user-plus" aria-hidden="true"></i>Enregistrer</button>';
  html += '<button onclick="cancelRosterForm()" id="btn-cancel" style="display:none">Annuler</button>';
  html += '</div>';

  // Active students
  html += '<h3>Élèves actifs (' + actifs.length + ')</h3>';
  if (actifs.length === 0) {
    html += '<p>Aucun élève pour le moment. Ajoutez vos élèves ci-dessus.</p>';
  } else {
    html += '<div class="mp-student-list">';
    actifs.forEach(function(s) {
      html += renderStudentCardHtml(s, true);
    });
    html += '</div>';
  }

  // Inactive students
  if (inactifs.length > 0) {
    html += '<h3>Élèves inactifs (' + inactifs.length + ')</h3>';
    html += '<div class="mp-student-list mp-student-list-inactive">';
    inactifs.forEach(function(s) {
      html += renderStudentCardHtml(s, false);
    });
    html += '</div>';
  }

  html += '<div class="mp-card-block">';
  html += '<h3 style="margin-top:0;">Gestion des données</h3>';

  html += '<div class="mp-data-row">';
  html += '<button class="mp-data-btn" onclick="exportGradebookXLSX()"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i>Carnet de notes (Excel)</button>';
  html += '<button type="button" class="mp-info-btn" onclick="toggleRosterTip(\'tip-gradebook\')" aria-label="Aide">?</button>';
  html += '</div>';
  html += '<div id="tip-gradebook" class="mp-info-tip">Télécharge un fichier Excel des notes par matière/domaine, utile pour partager avec la direction. Un export CSV simple est aussi disponible: <a href="#" onclick="exportMarksSpreadsheet(); return false;">télécharger en CSV</a>.</div>';

  html += '<div class="mp-data-row">';
  html += '<button class="mp-data-btn" id="btn-export-photos" onclick="handleExportWithPhotosClick()"><i class="ti ti-device-mobile-share" aria-hidden="true"></i>Transférer vers un autre appareil</button>';
  html += '<button type="button" class="mp-info-btn" onclick="toggleRosterTip(\'tip-transfer\')" aria-label="Aide">?</button>';
  html += '</div>';
  html += '<div id="tip-transfer" class="mp-info-tip">Sauvegarde complète avec photos, pour passer d\'un téléphone à un ordinateur, ou pour partager avec une collègue. <strong>Supprimez ce fichier après l\'avoir importé</strong> — il contient des renseignements personnels non chiffrés.</div>';
  html += '<span id="export-photos-status"></span>';

  html += '<div class="mp-data-row">';
  html += '<button type="button" class="mp-data-btn" onclick="document.getElementById(\'import-file-input\').click()"><i class="ti ti-upload" aria-hidden="true"></i>Importer une sauvegarde</button>';
  html += '<button type="button" class="mp-info-btn" onclick="toggleRosterTip(\'tip-import\')" aria-label="Aide">?</button>';
  html += '</div>';
  html += '<div id="tip-import" class="mp-info-tip">Importe une sauvegarde depuis un autre appareil (ex: transférer les données de votre téléphone vers cet ordinateur).</div>';
  html += '<input type="file" accept="application/json" id="import-file-input" onchange="handleImportFileSelect(event)" style="display:none;">';
  html += '<div id="import-preview-area"></div>';

  html += '<div class="mp-data-row" style="margin-top:16px;">';
  html += '<button class="mp-data-btn mp-data-btn-danger" onclick="resetAllYearData()"><i class="ti ti-refresh" aria-hidden="true"></i>Nouvelle année</button>';
  html += '<button type="button" class="mp-info-btn" onclick="toggleRosterTip(\'tip-reset\')" aria-label="Aide">?</button>';
  html += '</div>';
  html += '<div id="tip-reset" class="mp-info-tip">Sauvegarde puis efface toutes les observations et productions pour repartir à zéro. La liste de classe n\'est pas touchée par cette action.</div>';

  html += '</div>';

  container.innerHTML = html;
}

function toggleRosterTip(id) {
  var tip = document.getElementById(id);
  if (tip) tip.classList.toggle('visible');
}

function renderStudentCardHtml(s, isActive) {
  var html = '<div class="mp-student-card">';
  html += '<div class="mp-student-info">';
  html += '<div class="mp-student-name">' + displayName(s) + '</div>';
  html += '<div class="mp-student-meta">' + s.code + ' · ' + (isActive ? s.annee + ' · ' + s.pronom : '<em>inactif</em>') + '</div>';
  html += '</div>';
  html += '<div class="mp-student-actions">';
  if (isActive) {
    html += '<button class="mp-icon-action" aria-label="Modifier" onclick="editStudent(\'' + s.code + '\')"><i class="ti ti-pencil" aria-hidden="true"></i></button>';
    html += '<button class="mp-icon-action" aria-label="Désactiver" onclick="toggleStudentActif(\'' + s.code + '\'); renderRoster();"><i class="ti ti-eye-off" aria-hidden="true"></i></button>';
  } else {
    html += '<button class="mp-icon-action" aria-label="Réactiver" onclick="toggleStudentActif(\'' + s.code + '\'); renderRoster();"><i class="ti ti-eye" aria-hidden="true"></i></button>';
  }
  html += '<button class="mp-icon-action mp-icon-action-danger" aria-label="Supprimer définitivement" onclick="removeStudentCompletely(\'' + s.code + '\')"><i class="ti ti-trash" aria-hidden="true"></i></button>';
  html += '</div>';
  html += '</div>';
  return html;
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
  document.getElementById('input-pei-hh').checked = false;
  document.getElementById('input-pei-academique').checked = false;
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
// ============================================================
// roster.js — MonProf.ai
// ADDITION: Export including photos, for transferring data
// between devices (or between teachers)
// ============================================================
// Separate from exportAllDataAsFile() above, which stays fast and
// text-only for the pre-deletion safety backups. This one embeds
// photo blobs as base64 directly in the JSON, so the resulting
// file can be several MB — that's expected, since it's meant to
// be moved to another device, not used as a quick safety net.
//
// Depends on:
//   - getObservationPhoto() — observations.js
//   - getProductionPhoto() — productions.js
// ============================================================

function blobToBase64(blob) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onloadend = function() { resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function exportAllDataWithPhotosAsFile() {
  var roster = getRoster();
  var observations = getObservations();
  var productions = await getAllProductions();

  var observationsForExport = [];
  for (var i = 0; i < observations.length; i++) {
    var o = observations[i];
    var oPhotos = [];
    if (o.photoIds && o.photoIds.length > 0) {
      for (var j = 0; j < o.photoIds.length; j++) {
        var oMedia = await getObservationPhoto(o.photoIds[j]);
        if (oMedia && oMedia.blob) {
          var oBase64 = await blobToBase64(oMedia.blob);
          oPhotos.push({ id: oMedia.id, mimeType: oMedia.mimeType, data: oBase64 });
        }
      }
    }
    var oCopy = Object.assign({}, o);
    oCopy.photos = oPhotos;
    delete oCopy.photoIds;
    observationsForExport.push(oCopy);
  }

  var productionsForExport = [];
  for (var k = 0; k < productions.length; k++) {
    var p = productions[k];
    var pPhotos = [];
    if (p.photoIds && p.photoIds.length > 0) {
      for (var m = 0; m < p.photoIds.length; m++) {
        var pMedia = await getProductionPhoto(p.photoIds[m]);
        if (pMedia && pMedia.blob) {
          var pBase64 = await blobToBase64(pMedia.blob);
          pPhotos.push({ id: pMedia.id, mimeType: pMedia.mimeType, data: pBase64 });
        }
      }
    }
    productionsForExport.push({
      id: p.id,
      studentCode: p.studentCode,
      domain: p.domain,
      activityTag: p.activityTag,
      note: p.note,
      level: p.level,
      linkType: p.linkType,
      hhCategory: p.hhCategory,
      subject: p.subject,
      strand: p.strand,
      achievementCategory: p.achievementCategory,
      grade: p.grade,
      photos: pPhotos,
      createdAt: p.createdAt,
      editedAt: p.editedAt
    });
  }

  var exportData = {
    exportedAt: new Date().toISOString(),
    includesPhotos: true,
    note: 'Cette sauvegarde inclut les photos (encodées en base64) — destinée au transfert vers un autre appareil.',
    roster: roster,
    observations: observationsForExport,
    productions: productionsForExport
  };

  var blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  var dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = 'monprofai_transfert_' + dateStr + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function handleExportWithPhotosClick() {
  var statusEl = document.getElementById('export-photos-status');
  if (statusEl) statusEl.textContent = ' Préparation du fichier (ceci peut prendre un moment si vous avez beaucoup de photos)...';
  try {
    await exportAllDataWithPhotosAsFile();
    if (statusEl) statusEl.textContent = ' ✓ Téléchargement lancé.';
    setTimeout(function() { if (statusEl) statusEl.textContent = ''; }, 3000);
  } catch (err) {
    if (statusEl) statusEl.textContent = '';
    alert('Erreur lors de la préparation du fichier. Veuillez réessayer.');
    console.error(err);
  }
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
  'Mathématiques',
  'Sciences et technologie',
  'Études sociales',
  'Enseignement religieux',
  'Anglais',
  'Éducation physique et santé',
  'Éducation artistique'
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
  ],
  'Anglais': [
    'A - Oral and Oral-Visual Communication',
    'B - Reading and Interpretation',
    'C - Writing and Representation'
  ],
  'Éducation physique et santé': [
    'A - Apprentissage socioémotionnel',
    'B - Vie active',
    'C - Compétence motrice',
    'D - Vie saine'
  ],
  'Éducation artistique': [
    'A - Art dramatique',
    'B - Arts visuels',
    'C - Danse',
    'D - Musique'
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

var NIVEAU_OPTIONS = [
  '4+', '4', '4-',
  '3+', '3', '3-',
  '2+', '2', '2-',
  '1+', '1', '1-'
];

function isGrade1to6(studentCode) {
  var roster = getRoster();
  var student = roster.find(function(s) { return s.code === studentCode; });
  if (!student) return false;
  return ['1', '2', '3', '4', '5', '6'].indexOf(student.annee) !== -1;
}
// ============================================================
// PEI reminder — helper used by Observations and Productions
// ============================================================
// APPEND this to the END of roster.js.
// Purely a visual reminder — the actual IEP goals are never
// stored or entered here, just a flag that one exists.
// ============================================================

function getPeiReminderHtml(studentCode) {
  var roster = getRoster();
  var student = roster.find(function(s) { return s.code === studentCode; });
  if (!student || (!student.peiHH && !student.peiAcademique)) return '';

  var parts = [];
  if (student.peiHH) parts.push('HH');
  if (student.peiAcademique) parts.push('Académique');

  return '<div class="pei-reminder">⚠️ ' + displayName(student) + ' a un PEI (' +
    parts.join(' et ') + ') — pensez à consulter le PEI pour les objectifs spécifiques.</div>';
}
// ============================================================
// roster.js — MonProf.ai
// ADDITION: Gradebook-style Excel export (.xlsx, one tab per
// subject/domaine, students as rows, entries as columns)
// ============================================================
// APPEND this to the END of roster.js.
// Also make Steps 1-4 described separately.
//
// Depends on:
//   - XLSX global (loaded via xlsx.full.min.js) — SheetJS library
//   - getObservations() — observations.js
//   - getAllProductions(), formatProductionDate(), getLevelLabel() — productions.js
//   - getRoster(), displayName() — this file
// ============================================================

async function exportGradebookXLSX() {
  if (typeof XLSX === 'undefined') {
    alert('La bibliothèque Excel (xlsx.full.min.js) n\'est pas chargée. Vérifiez que le fichier est bien ajouté et référencé dans index.html.');
    return;
  }

  var roster = getRoster().filter(function(s) { return s.actif; });
  var obs = getObservations();
  var prods = await getAllProductions();

  var sheets = {};

  function ensureSheet(name) {
    if (!sheets[name]) sheets[name] = { columnSet: {}, data: {} };
    return sheets[name];
  }

  function colKey(dateStr, activityTag) {
    return activityTag ? (dateStr + ' — ' + activityTag) : dateStr;
  }

  function addEntry(sheetName, studentCode, dateStr, activityTag, cellText) {
    var sheet = ensureSheet(sheetName);
    var key = colKey(dateStr, activityTag);
    sheet.columnSet[key] = true;
    if (!sheet.data[studentCode]) sheet.data[studentCode] = {};
    if (sheet.data[studentCode][key]) {
      sheet.data[studentCode][key] += ' | ' + cellText;
    } else {
      sheet.data[studentCode][key] = cellText;
    }
  }

  obs.forEach(function(o) {
    var sheetName;
    if (o.linkType === 'hh') {
      sheetName = 'HH';
    } else if (o.linkType === 'expectation' && o.subject) {
      sheetName = o.subject;
    } else {
      sheetName = 'Domaine ' + (o.domaine || '?');
    }
    addEntry(sheetName, o.studentCode, o.date, o.activityTag, o.note || '');
  });

  prods.forEach(function(p) {
    var sheetName;
    var cellText;

    if (p.subject) {
      sheetName = p.subject;
      cellText = (p.grade ? p.grade + ' — ' : '') + (p.note || '');
    } else {
      sheetName = 'Domaine ' + (p.domain || '?');
      cellText = (p.level ? getLevelLabel(p.level) + ' — ' : '') + (p.note || '');
    }

    addEntry(sheetName, p.studentCode, formatProductionDate(p.createdAt), p.activityTag, cellText);
  });

  if (Object.keys(sheets).length === 0) {
    alert('Aucune donnée à exporter pour le moment.');
    return;
  }

  var wb = XLSX.utils.book_new();

  Object.keys(sheets).sort().forEach(function(sheetName) {
    var sheet = sheets[sheetName];
    var columns = Object.keys(sheet.columnSet).sort();

    var rows = [['Élève'].concat(columns)];

    roster.forEach(function(s) {
      var name = displayName(s);
      var rowData = sheet.data[s.code] || {};
      var row = [name];
      columns.forEach(function(col) {
        row.push(rowData[col] || '');
      });
      rows.push(row);
    });

    var ws = XLSX.utils.aoa_to_sheet(rows);
    var safeName = sheetName.substring(0, 31); // Excel sheet-name length limit
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  });

  var dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, 'monprofai_carnet_' + dateStr + '.xlsx');
}
// ============================================================
// roster.js — MonProf.ai
// ADDITION: CSV export of all Observations/Conversations/Productions
// ============================================================
// APPEND this to the END of roster.js.
// Also make the 1 edit described separately.
//
// Real student names (not codes) — this is an internal document
// for the principal, not something sent to the AI.
//
// Depends on:
//   - getObservations() — observations.js
//   - getAllProductions(), formatProductionDate() — productions.js
//   - getLevelLabel() — productions.js Part 3
//   - getRoster(), displayName() — this file
// ============================================================

function csvEscape(value) {
  var str = (value === null || value === undefined) ? '' : String(value);
  if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
    str = '"' + str.split('"').join('""') + '"';
  }
  return str;
}

async function exportMarksSpreadsheet() {
  var roster = getRoster();
  var obs = getObservations();
  var prods = await getAllProductions();

  var allRows = [];

  obs.forEach(function(o) {
    var student = roster.find(function(s) { return s.code === o.studentCode; });
    var name = student ? displayName(student) : o.studentCode;
    var annee = student ? student.annee : '';
    var type = o.type === 'conversation' ? 'Conversation' : 'Observation';

    var domaineMatiere = '';
    var voletCompetence = '';
    var hhCat = '';

    if (o.linkType === 'hh') {
      hhCat = o.hhCategory || '';
    } else if (o.linkType === 'expectation') {
      domaineMatiere = o.subject || '';
      voletCompetence = (o.strand || '') + (o.achievementCategory ? ' | ' + o.achievementCategory : '');
    } else {
      domaineMatiere = o.domaine || '';
    }

    allRows.push({
      date: o.date,
      eleve: name,
      annee: annee,
      type: type,
      domaineMatiere: domaineMatiere,
      voletCompetence: voletCompetence,
      activite: o.activityTag || '',
      note: o.note || '',
      niveauCote: '',
      hhCat: hhCat
    });
  });

  prods.forEach(function(p) {
    var student = roster.find(function(s) { return s.code === p.studentCode; });
    var name = student ? displayName(student) : p.studentCode;
    var annee = student ? student.annee : '';

    var domaineMatiere = '';
    var voletCompetence = '';
    var niveauCote = '';

    if (p.subject) {
      domaineMatiere = p.subject;
      voletCompetence = (p.strand || '') + (p.achievementCategory ? ' | ' + p.achievementCategory : '');
      niveauCote = p.grade || '';
    } else {
      domaineMatiere = p.domain || '';
      niveauCote = p.level ? getLevelLabel(p.level) : '';
    }

    allRows.push({
      date: formatProductionDate(p.createdAt),
      eleve: name,
      annee: annee,
      type: 'Production',
      domaineMatiere: domaineMatiere,
      voletCompetence: voletCompetence,
      activite: p.activityTag || '',
      note: p.note || '',
      niveauCote: niveauCote,
      hhCat: ''
    });
  });

  if (allRows.length === 0) {
    alert('Aucune donnée à exporter pour le moment.');
    return;
  }

  allRows.sort(function(a, b) { return a.date.localeCompare(b.date); });

  var lines = [];
  lines.push(['Date', 'Élève', 'Année', 'Type', 'Domaine/Matière', 'Volet/Compétence', 'Activité', 'Note', 'Niveau/Cote', 'Catégorie HH'].map(csvEscape).join(','));

  allRows.forEach(function(r) {
    lines.push([r.date, r.eleve, r.annee, r.type, r.domaineMatiere, r.voletCompetence, r.activite, r.note, r.niveauCote, r.hhCat].map(csvEscape).join(','));
  });

  var csvContent = lines.join('\r\n');

  // BOM prefix so Excel reads accented French characters correctly
  var blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  var dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = 'monprofai_donnees_' + dateStr + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
// ============================================================
// GRADES 1-6 — PART G4: Sciences et technologie / Études sociales strands
// ============================================================
// Adds two new subjects to SUBJECT_STRANDS. Unlike Français/Mathématiques
// (flat arrays — the strand list is the same regardless of grade), these
// two are objects keyed by année, because the actual curriculum topic
// under each domain changes every year.
// ============================================================

SUBJECT_STRANDS['Sciences et technologie'] = {
  '1': [
    'B - Systèmes vivants : Les êtres vivants : caractéristiques et besoins',
    'C - Matière et énergie : L\'énergie dans nos vies',
    'D - Structures et mécanismes : Les matériaux, les objets et les structures au quotidien',
    'E - Systèmes de la Terre et de l\'espace : Le cycle des jours et des saisons'
  ],
  '2': [
    'B - Systèmes vivants : Les animaux : croissance et changements',
    'C - Matière et énergie : Les propriétés des liquides et des solides',
    'D - Structures et mécanismes : Les machines simples et le mouvement',
    'E - Systèmes de la Terre et de l\'espace : L\'air et l\'eau dans l\'environnement'
  ],
  '3': [
    'B - Systèmes vivants : Les plantes : croissance et changements',
    'C - Matière et énergie : Les forces et le mouvement',
    'D - Structures et mécanismes : Les structures solides et stables',
    'E - Systèmes de la Terre et de l\'espace : Le sol dans l\'environnement'
  ],
  '4': [
    'B - Systèmes vivants : Les habitats et les communautés',
    'C - Matière et énergie : La lumière et le son',
    'D - Structures et mécanismes : Les machines et leurs mécanismes',
    'E - Systèmes de la Terre et de l\'espace : Les roches, les minéraux et les processus géologiques'
  ],
  '5': [
    'B - Systèmes vivants : La santé et les systèmes du corps humain',
    'C - Matière et énergie : Les propriétés et les changements de la matière',
    'D - Structures et mécanismes : Les forces agissant sur les structures',
    'E - Systèmes de la Terre et de l\'espace : Conservation de l\'énergie et des ressources'
  ],
  '6': [
    'B - Systèmes vivants : La biodiversité',
    'C - Matière et énergie : Les phénomènes, l\'énergie et les dispositifs électriques',
    'D - Structures et mécanismes : Le vol',
    'E - Systèmes de la Terre et de l\'espace : L\'espace'
  ]
};

SUBJECT_STRANDS['Études sociales'] = {
  '1': [
    'A - Patrimoine et identité : Les rôles et les responsabilités',
    'B - Communauté et environnement : La communauté'
  ],
  '2': [
    'A - Patrimoine et identité : Les traditions familiales et communautaires',
    'B - Communauté et environnement : Les communautés du monde'
  ],
  '3': [
    'A - Patrimoine et identité : Les communautés du Canada, 1780–1850',
    'B - Communauté et environnement : Vivre et travailler en Ontario'
  ],
  '4': [
    'A - Patrimoine et identité : Les sociétés anciennes',
    'B - Communauté et environnement : Les régions politiques et physiques du Canada'
  ],
  '5': [
    'A - Patrimoine et identité : Les interactions entre les communautés autochtones, et entre celles-ci et les Européens (avant 1713)',
    'B - Communauté et environnement : L\'action gouvernementale et citoyenne'
  ],
  '6': [
    'A - Patrimoine et identité : L\'expérience canadienne hier et aujourd\'hui',
    'B - Communauté et environnement : Le Canada dans la communauté mondiale'
  ]
};

SUBJECT_STRANDS['Enseignement religieux'] = {
  '1': [
    '1 - Bible',
    '2 - Convictions au sujet de la présence de Dieu',
    '3 - Vie spirituelle et sacramentelle',
    '4 - Agir et engagement'
  ],
  '2': [
    '1 - Bible',
    '2 - Convictions au sujet de la relation de Dieu avec les humains et des humains entre eux',
    '3 - Vie spirituelle et sacramentelle',
    '4 - Agir et engagement'
  ],
  '3': [
    '1 - Bible',
    '2 - Convictions au sujet de l\'avènement du Royaume de Dieu',
    '3 - Vie spirituelle et sacramentelle',
    '4 - Agir et engagement'
  ],
  '4': [
    '1 - Bible',
    '2 - Convictions au sujet de Jésus, Bonne Nouvelle',
    '3 - Vie spirituelle et sacramentelle',
    '4 - Agir et engagement'
  ],
  '5': [
    '1 - Bible',
    '2 - Convictions au sujet de l\'Esprit Saint, Dieu à l\'œuvre dans le monde',
    '3 - Vie spirituelle et sacramentelle',
    '4 - Agir et engagement'
  ],
  '6': [
    '1 - Bible',
    '2 - Convictions au sujet de Jésus, chemin de Vie',
    '3 - Vie spirituelle et sacramentelle',
    '4 - Agir et engagement'
  ]
};
// Reads the strand list for a subject, handling both shapes that now
// exist in SUBJECT_STRANDS:
//  - flat array (Français, Mathématiques): same list regardless of grade
//  - object keyed by année (Sciences et technologie, Études sociales):
//    grade-specific list
function getStrandsForSubject(subject, annee) {
  var entry = SUBJECT_STRANDS[subject];
  if (!entry) return [];
  if (Array.isArray(entry)) return entry;
  return entry[annee] || [];
}

// Determines which année to use for a whole Productions batch session.
// Same "the class is homogeneous" assumption Productions already relies
// on elsewhere — reads it straight off the roster. Uses the FIRST
// active grade 1-6 student found.
function getSessionAnnee() {
  var roster = getRoster().filter(function(s) { return s.actif; });
  var g16 = roster.find(function(s) { return isGrade1to6(s.code); });
  return g16 ? g16.annee : null;
}
// ============================================================
// GRADES 1-6 — Split-grade class support for Productions
// ============================================================
// Adds a labeled lookup for grade values, and a helper to detect
// when the active roster spans more than one grade — used by
// Productions setup to know when to show an année selector.
// ============================================================

var ANNEE_LABELS = {
  '1': '1re année',
  '2': '2e année',
  '3': '3e année',
  '4': '4e année',
  '5': '5e année',
  '6': '6e année'
};

// Every distinct grade currently present among active grade 1-6 students.
function getDistinctGrades1to6Active() {
  var roster = getRoster().filter(function(s) { return s.actif && isGrade1to6(s.code); });
  var seen = {};
  roster.forEach(function(s) { seen[s.annee] = true; });
  return Object.keys(seen).sort();
}
// ============================================================
// roster.js — MonProf.ai
// ADDITION: Import parser (preview only — nothing written yet)
// ============================================================
// Reads a transfer file and shows what it contains, matched
// against the CURRENT device's roster. This step never writes
// to storage — that happens in a later piece (review/commit).
//
// Matching is done on prénom + initiale du nom + année, since
// student codes (EL_01, EL_02...) are generated independently per
// device and can't be trusted to mean the same student on both.
// ============================================================

function findLocalStudentMatch(importedStudent, localRoster) {
  return localRoster.find(function(s) {
    return s.prenom.trim().toLowerCase() === importedStudent.prenom.trim().toLowerCase() &&
           s.nomInitial.trim().toLowerCase() === importedStudent.nomInitial.trim().toLowerCase() &&
           s.annee === importedStudent.annee;
  }) || null;
}

function buildImportPreview(importedData) {
  var localRoster = getRoster();
  var importedRoster = importedData.roster || [];
  var importedObs = importedData.observations || [];
  var importedProds = importedData.productions || [];

  var matchedStudents = [];
  var newStudents = [];

  importedRoster.forEach(function(importedStudent) {
    var obsCount = importedObs.filter(function(o) { return o.studentCode === importedStudent.code; }).length;
    var prodCount = importedProds.filter(function(p) { return p.studentCode === importedStudent.code; }).length;

    var photoCount = 0;
    importedObs.forEach(function(o) {
      if (o.studentCode === importedStudent.code && o.photos) photoCount += o.photos.length;
    });
    importedProds.forEach(function(p) {
      if (p.studentCode === importedStudent.code && p.photos) photoCount += p.photos.length;
    });

    var localMatch = findLocalStudentMatch(importedStudent, localRoster);

    var entry = {
      importedCode: importedStudent.code,
      prenom: importedStudent.prenom,
      nomInitial: importedStudent.nomInitial,
      annee: importedStudent.annee,
      pronom: importedStudent.pronom || 'elle',
      actif: importedStudent.actif !== false,
      peiHH: !!importedStudent.peiHH,
      peiAcademique: !!importedStudent.peiAcademique,
      obsCount: obsCount,
      prodCount: prodCount,
      photoCount: photoCount
    };

    if (localMatch) {
      entry.localCode = localMatch.code;
      matchedStudents.push(entry);
    } else {
      newStudents.push(entry);
    }
  });

  var allEntries = matchedStudents.concat(newStudents);

  return {
    exportedAt: importedData.exportedAt || null,
    matchedStudents: matchedStudents,
    newStudents: newStudents,
    totalObservations: importedObs.length,
    totalProductions: importedProds.length,
    totalPhotos: allEntries.reduce(function(sum, s) { return sum + s.photoCount; }, 0)
  };
}

function renderImportPreviewHtml(preview) {
  var html = '<div class="import-preview-box">';
  html += '<h4>Aperçu du fichier de transfert</h4>';
  if (preview.exportedAt) {
    html += '<p>Exporté le: ' + new Date(preview.exportedAt).toLocaleString('fr-CA') + '</p>';
  }
  html += '<p>' + preview.totalObservations + ' observation(s)/conversation(s), ' +
    preview.totalProductions + ' production(s), ' + preview.totalPhotos + ' photo(s) au total.</p>';

  html += '<h5>Élèves reconnus (' + preview.matchedStudents.length + ')</h5>';
  if (preview.matchedStudents.length === 0) {
    html += '<p><em>Aucun élève correspondant trouvé dans la liste de classe actuelle.</em></p>';
  } else {
    html += '<ul>';
    preview.matchedStudents.forEach(function(s) {
      html += '<li>' + s.prenom + ' ' + s.nomInitial + ' (' + s.annee + ') — ' +
        s.obsCount + ' obs., ' + s.prodCount + ' prod., ' + s.photoCount + ' photo(s)</li>';
    });
    html += '</ul>';
  }

 html += '<h5>Élèves non reconnus (' + preview.newStudents.length + ')</h5>';
  if (preview.newStudents.length === 0) {
    html += '<p><em>Aucun.</em></p>';
  } else {
    html += '<p>Cochez les élèves à ajouter à votre liste de classe. Décochez ceux qui ne sont pas les vôtres (ex: élèves d\'un(e) collègue).</p>';
    html += '<ul>';
    preview.newStudents.forEach(function(s, i) {
      html += '<li><label><input type="checkbox" id="import-new-' + i + '" checked> ' +
        s.prenom + ' ' + s.nomInitial + ' (' + s.annee + ') — ' +
        s.obsCount + ' obs., ' + s.prodCount + ' prod., ' + s.photoCount + ' photo(s)</label></li>';
    });
    html += '</ul>';
  }

  html += '<button onclick="handleConfirmImport()">Importer les données (observations, conversations et productions)</button>';
  html += '<span id="import-commit-status"></span>';
  html += '</div>';
  return html;
}

function handleImportFileSelect(event) {
  var file = event.target.files[0];
  var previewArea = document.getElementById('import-preview-area');
  if (!file) return;

  if (previewArea) previewArea.innerHTML = '<p><em>Lecture du fichier...</em></p>';

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var importedData = JSON.parse(e.target.result);
      var preview = buildImportPreview(importedData);
      window._pendingImportData = importedData;
      window._pendingImportPreview = preview;
      if (previewArea) previewArea.innerHTML = renderImportPreviewHtml(preview);
    } catch (err) {
      console.error(err);
      if (previewArea) previewArea.innerHTML = '<p><em>Erreur: ce fichier ne semble pas être un fichier de transfert valide.</em></p>';
    }
  };
  reader.onerror = function() {
    if (previewArea) previewArea.innerHTML = '<p><em>Erreur de lecture du fichier.</em></p>';
  };
  reader.readAsText(file);
}
// ============================================================
// roster.js — MonProf.ai
// ADDITION: Import commit — Observations only (Piece 3a)
// ============================================================
// Builds a map from imported student codes to this device's local
// codes (matched students keep their local code; new students,
// if checked, get created here with a fresh local code). Then
// writes imported observations directly into local storage,
// preserving their original id/date (so re-running the same
// import twice is safe — duplicates are skipped by id), and
// re-saves any embedded photos into this device's own IndexedDB.
//
// Productions import is NOT yet included — see Piece 3b.
// ============================================================

function base64ToBlob(base64String, mimeType) {
  var byteString = atob(base64String.split(',')[1]);
  var byteArray = new Uint8Array(byteString.length);
  for (var i = 0; i < byteString.length; i++) {
    byteArray[i] = byteString.charCodeAt(i);
  }
  return new Blob([byteArray], { type: mimeType });
}

function buildImportCodeMap(preview) {
  var codeMap = {};

  preview.matchedStudents.forEach(function(s) {
    codeMap[s.importedCode] = s.localCode;
  });

  preview.newStudents.forEach(function(s, i) {
    var checkbox = document.getElementById('import-new-' + i);
    var included = checkbox ? checkbox.checked : true;
    if (included) {
      var newStudent = addStudent(s.prenom, s.nomInitial.replace('.', ''), s.pronom, s.annee, s.peiHH, s.peiAcademique);
      if (!s.actif) {
        toggleStudentActif(newStudent.code);
      }
      codeMap[s.importedCode] = newStudent.code;
    } else {
      codeMap[s.importedCode] = null;
    }
  });

  return codeMap;
}

async function commitImportedObservations(importedData, codeMap) {
  var importedObs = importedData.observations || [];
  var localObs = getObservations();
  var localIds = {};
  localObs.forEach(function(o) { localIds[o.id] = true; });

  var addedCount = 0;
  var skippedDuplicates = 0;
  var skippedExcluded = 0;

  for (var i = 0; i < importedObs.length; i++) {
    var o = importedObs[i];
    var localCode = codeMap[o.studentCode];

    if (!localCode) {
      skippedExcluded++;
      continue;
    }
    if (localIds[o.id]) {
      skippedDuplicates++;
      continue;
    }

    var newPhotoIds = [];
    if (o.photos && o.photos.length > 0) {
      for (var j = 0; j < o.photos.length; j++) {
        var photoBlob = base64ToBlob(o.photos[j].data, o.photos[j].mimeType);
        var newMediaId = await saveObservationPhoto(o.id, photoBlob);
        newPhotoIds.push(newMediaId);
      }
    }

    var newEntry = Object.assign({}, o);
    newEntry.studentCode = localCode;
    newEntry.photoIds = newPhotoIds;
    delete newEntry.photos;

    localObs.push(newEntry);
    localIds[o.id] = true;
    addedCount++;
  }

  saveObservations(localObs);
  return { addedCount: addedCount, skippedDuplicates: skippedDuplicates, skippedExcluded: skippedExcluded };
}

async function handleConfirmImport() {
  var statusEl = document.getElementById('import-commit-status');
  var importedData = window._pendingImportData;
  var preview = window._pendingImportPreview;

  if (!importedData || !preview) {
    alert('Aucun fichier chargé.');
    return;
  }

  if (statusEl) statusEl.textContent = ' Importation en cours...';

  try {
    var codeMap = buildImportCodeMap(preview);
    var obsResult = await commitImportedObservations(importedData, codeMap);
    var prodResult = await commitImportedProductions(importedData, codeMap);

    if (statusEl) statusEl.textContent = '';
    alert(
      'Importation terminée.\n\n' +
      'Observations/conversations: ' + obsResult.addedCount + ' ajoutée(s), ' +
      obsResult.skippedDuplicates + ' déjà présente(s), ' +
      obsResult.skippedExcluded + ' ignorée(s) (élève non inclus).\n\n' +
      'Productions: ' + prodResult.addedCount + ' ajoutée(s), ' +
      prodResult.skippedDuplicates + ' déjà présente(s), ' +
      prodResult.skippedExcluded + ' ignorée(s) (élève non inclus).'
    );

    window._pendingImportData = null;
    window._pendingImportPreview = null;
    renderRoster();
  } catch (err) {
    if (statusEl) statusEl.textContent = '';
    alert('Erreur lors de l\'importation. Veuillez réessayer.');
    console.error(err);
  }
}
