// ============================================================
// OBSERVATIONS.JS — Capture observations and conversations
// ============================================================

var OBS_KEY = 'monprofai_observations';

function getObservations() {
  try {
    var data = localStorage.getItem(OBS_KEY);
    return data ? JSON.parse(data) : [];
  } catch(e) {
    return [];
  }
}

function saveObservations(obs) {
  try {
    localStorage.setItem(OBS_KEY, JSON.stringify(obs));
  } catch(e) {
    alert('Erreur: impossible de sauvegarder les observations.');
  }
}

function addObservation(studentCode, type, domaine, note, pending, activityTag, extra) {
  extra = extra || {};
  var obs = getObservations();
  var entry = {
    id: Date.now(),
    studentCode: studentCode,
    type: type,
    domaine: domaine,
    note: note || '',
    pending: pending || false,
    activityTag: activityTag || '',
    linkType: extra.linkType || null,
    hhCategory: extra.hhCategory || null,
    subject: extra.subject || null,
    strand: extra.strand || null,
    achievementCategory: extra.achievementCategory || null,
    date: new Date().toISOString().slice(0, 10),
    timestamp: Date.now()
  };
  obs.push(entry);
  saveObservations(obs);
  return entry;
}

function deleteObservation(id) {
  var obs = getObservations().filter(function(o) { return o.id !== id; });
  saveObservations(obs);
}

function getObservationsForStudent(studentCode) {
  return getObservations().filter(function(o) {
    return o.studentCode === studentCode;
  });
}

// ============================================================
// RENDER
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

  var pendingCount = getPendingCount();
  var html = '<h2>Observations et conversations</h2>';
html += '<button onclick="switchToObsAttentionView()">Voir la liste de suivi</button> ';
  html += '<button onclick="switchToObsDomainView()">Voir la répartition par domaine</button> ';
  html += '<button onclick="switchToObsActivityView()">Voir le suivi par activité</button>';

  // Pending transcription banner
  if (pendingCount > 0) {
    html += '<div class="pending-banner">';
    html += '⏳ ' + pendingCount + ' note(s) vocale(s) en attente de transcription. ';
    html += '<button onclick="handleProcessQueue()">Transcrire maintenant</button>';
    html += '</div>';
  }

  // Capture form
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
  html += '<select id="obs-student" onchange="handleObsStudentChange()">';
  html += '<option value="">-- Sélectionner un élève --</option>';
  roster.forEach(function(s) {
    html += '<option value="' + s.code + '">' + displayName(s) + '</option>';
  });
  html += '</select>';
  html += '</div>';

  // Curriculum-link section — rebuilt dynamically based on the
  // selected student's grade level (see handleObsStudentChange)
  html += '<div id="obs-link-section">';
  html += renderObsLinkSectionHtml('');
  html += '</div>';

  // Note + mic
  html += '<div class="form-row">';
  html += '<label>Note</label>';
  html += '<textarea id="obs-note" rows="3" placeholder="Tapez votre note ou utilisez le micro ci-dessous..."></textarea>';
  html += '</div>';

  // Mic button
  html += '<div class="mic-row">';
  html += '<button id="btn-mic" class="mic-btn" onclick="toggleRecording()">🎤 Dicter</button>';
  html += '<span id="mic-status" class="mic-status"></span>';
  html += '</div>';

  // Google notice (shown once)
  if (!localStorage.getItem('monprofai_voice_notice')) {
    html += '<div class="voice-notice" id="voice-notice">';
    html += '⚠️ La transcription vocale utilise le service Google. Aucun nom de famille n\'est transmis. ';
    html += '<button onclick="dismissVoiceNotice()">Compris</button>';
    html += '</div>';
  }

  html += '<button onclick="submitObsForm()">Enregistrer</button>';
  html += '</div>';

 // History
  html += '<div id="obs-history">';
  html += renderObsHistory();
  html += '</div>';

  html += '<div class="data-management-section">';
  html += '<h3>Gestion des données</h3>';
  html += '<div class="form-row">';
  html += '<label for="clear-student-select-obs">Effacer les données d\'un élève: </label>';
  html += '<select id="clear-student-select-obs">';
  html += '<option value="">-- Sélectionner --</option>';
  roster.forEach(function(s) {
    html += '<option value="' + s.code + '">' + displayName(s) + '</option>';
  });
  html += '</select>';
  html += ' <button class="btn-delete" onclick="handleClearStudentFromDropdown(\'clear-student-select-obs\')">Effacer</button>';
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;
}

// ============================================================
// FORM CONTROLS
// ============================================================

function setObsType(type) {
  document.getElementById('obs-type').value = type;
  document.getElementById('btn-type-obs').className = 'type-btn' + (type === 'observation' ? ' active' : '');
  document.getElementById('btn-type-conv').className = 'type-btn' + (type === 'conversation' ? ' active' : '');
}

function setDomaine(d) {
  document.getElementById('obs-domaine').value = d;
  ['A','B','C','D'].forEach(function(x) {
    document.getElementById('domaine-' + x).className = 'domaine-btn' + (x === d ? ' active' : '');
  });
}

function dismissVoiceNotice() {
  localStorage.setItem('monprofai_voice_notice', 'seen');
  var notice = document.getElementById('voice-notice');
  if (notice) notice.style.display = 'none';
}

// ============================================================
// RECORDING
// ============================================================

function toggleRecording() {
  var micBtn = document.getElementById('btn-mic');
  var micStatus = document.getElementById('mic-status');
  var noteField = document.getElementById('obs-note');

  if (isRecording) {
    // Stop recording
    if (mediaRecorder) {
      stopRecording(function() {});
    }
    isRecording = false;
    if (micBtn) {
      micBtn.textContent = '🎤 Dicter';
      micBtn.classList.remove('recording');
    }
    if (micStatus) micStatus.textContent = '';
    return;
  }

  // Check for Speech Recognition support
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('La dictée vocale n\'est pas supportée dans ce navigateur. Utilisez Chrome.');
    return;
  }

  if (!navigator.onLine) {
    if (micStatus) micStatus.textContent = '⚠️ Hors ligne — tapez votre note manuellement.';
    return;
  }

  // Start live speech recognition
  var recognition = new SpeechRecognition();
  recognition.lang = 'fr-FR';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = function() {
    isRecording = true;
    if (micBtn) {
      micBtn.textContent = '⏹ Arrêter';
      micBtn.classList.add('recording');
    }
    if (micStatus) micStatus.textContent = '🔴 Enregistrement...';
  };

  recognition.onresult = function(e) {
    var transcript = '';
    for (var i = 0; i < e.results.length; i++) {
      transcript += e.results[i][0].transcript;
    }
    if (noteField) noteField.value = transcript;
  };

  recognition.onend = function() {
    isRecording = false;
    if (micBtn) {
      micBtn.textContent = '🎤 Dicter';
      micBtn.classList.remove('recording');
    }
    if (micStatus) micStatus.textContent = '✓ Terminé';
  };

  recognition.onerror = function(e) {
    isRecording = false;
    if (micBtn) {
      micBtn.textContent = '🎤 Dicter';
      micBtn.classList.remove('recording');
    }
    if (micStatus) micStatus.textContent = 'Erreur: ' + e.error;
  };

  recognition.start();
  // Store reference to stop it later
  window._activeRecognition = recognition;
}

function submitObsForm() {
  var studentCode = document.getElementById('obs-student').value;
  var type = document.getElementById('obs-type').value;
  var note = document.getElementById('obs-note').value.trim();

  if (!studentCode) {
    alert('Veuillez sélectionner un élève.');
    return;
  }
  if (!note) {
    alert('Veuillez entrer une note ou dicter un message.');
    return;
  }

  var domaine = '';
  var activityTag = '';
  var extra = {};

  if (isGrade1to6(studentCode)) {
    var linkTypeInput = document.getElementById('obs-linktype');
    var linkType = linkTypeInput ? linkTypeInput.value : 'hh';

    if (linkType === 'hh') {
      var hhSelect = document.getElementById('obs-hh-category');
      extra.linkType = 'hh';
      extra.hhCategory = hhSelect ? hhSelect.value : '';
    } else {
      var subjectSelect = document.getElementById('obs-subject');
      var strandSelect = document.getElementById('obs-strand');
      var achievementSelect = document.getElementById('obs-achievement');
      var sousSujetEl = document.getElementById('obs-sous-sujet');

      extra.linkType = 'expectation';
      extra.subject = subjectSelect ? subjectSelect.value : '';
      extra.strand = strandSelect ? strandSelect.value : '';
      extra.achievementCategory = achievementSelect ? achievementSelect.value : '';
      activityTag = sousSujetEl ? sousSujetEl.value.trim() : '';
    }
  } else {
    var domaineInput = document.getElementById('obs-domaine');
    domaine = domaineInput ? domaineInput.value : 'A';
    var activityInput = document.getElementById('obs-activity');
    activityTag = activityInput ? activityInput.value.trim() : '';
  }

  addObservation(studentCode, type, domaine, note, false, activityTag, extra);
  document.getElementById('obs-note').value = '';
  document.getElementById('obs-student').value = '';
  document.getElementById('obs-link-section').innerHTML = renderObsLinkSectionHtml('');
  document.getElementById('obs-history').innerHTML = renderObsHistory();
}
function handleProcessQueue() {
  if (!navigator.onLine) {
    alert('Aucune connexion internet détectée. Veuillez réessayer à la maison.');
    return;
  }
  processPendingQueue(
    function(done, total) {
      console.log('Transcribed ' + done + ' of ' + total);
    },
    function(total) {
      alert(total + ' note(s) transcrite(s) avec succès!');
      renderObservations();
    }
  );
}

// ============================================================
// HISTORY
// ============================================================

function renderObsHistory() {
  var obs = getObservations();
  var roster = getRoster();

  if (obs.length === 0) {
    return '<p><em>Aucune entrée pour le moment.</em></p>';
  }

  obs = obs.slice().sort(function(a, b) { return b.timestamp - a.timestamp; });

  var html = '<h3>Entrées récentes (' + obs.length + ')</h3>';
  html += '<table class="obs-table">';
  html += '<tr><th>Date</th><th>Élève</th><th>Type</th><th>Dom.</th><th>Activité</th><th>Note</th><th></th></tr>';

  obs.forEach(function(o) {
    var student = roster.find(function(s) { return s.code === o.studentCode; });
    var name = student ? displayName(student) : o.studentCode;
    var typeLabel = o.type === 'conversation' ? '💬' : '👁';
    var noteDisplay = o.pending
      ? '<em class="pending-note">⏳ En attente de transcription</em>'
      : '<span class="editable-note" onclick="editObsNote(' + o.id + ')">' + o.note + '</span>';

    html += '<tr>';
    html += '<td>' + o.date + '</td>';
    html += '<td>' + name + '</td>';
    html += '<td>' + typeLabel + '</td>';
    html += '<td><strong>' + o.domaine + '</strong></td>';
    html += '<td>' + (o.activityTag || '') + '</td>';
    html += '<td>' + noteDisplay + '</td>';
    html += '<td><button class="btn-delete" onclick="deleteObsEntry(' + o.id + ')">✕</button></td>';
    html += '</tr>';
  });

  html += '</table>';
  return html;
}

function editObsNote(id) {
  var obs = getObservations();
  var entry = obs.find(function(o) { return o.id === id; });
  if (!entry) return;

  var newNote = prompt('Modifier la note:', entry.note);
  if (newNote === null) return;

  obs = obs.map(function(o) {
    if (o.id === id) o.note = newNote.trim();
    return o;
  });
  saveObservations(obs);
  document.getElementById('obs-history').innerHTML = renderObsHistory();
}

function deleteObsEntry(id) {
  deleteObservation(id);
  document.getElementById('obs-history').innerHTML = renderObsHistory();
}
// ============================================================
// observations.js — MonProf.ai
// PART O2: "Besoin d'attention" — time-based coverage view
// ============================================================
// APPEND this to the END of your observations.js file.
// Also make the 1 small edit described separately (nav button).
//
// Depends on:
//   - getObservations(), getRoster(), displayName() — already in your files
// ============================================================

var ATTENTION_THRESHOLD_SCHOOL_DAYS = 10;

// Count school days (Mon-Fri) strictly between two dates (exclusive of the start date)
function countSchoolDaysBetween(startDateStr, endDate) {
  var start = new Date(startDateStr + 'T00:00:00');
  var count = 0;
  var cursor = new Date(start);
  cursor.setDate(cursor.getDate() + 1);

  while (cursor <= endDate) {
    var day = cursor.getDay(); // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function switchToObsAttentionView() {
  var container = document.getElementById('module-observations');
  if (!container) return;
  renderObsAttentionView(container);
}

function switchToObsCapture() {
  renderObservations();
}

function renderObsAttentionView(container) {
  var roster = getRoster().filter(function(s) { return s.actif; });
  var allObs = getObservations();
  var today = new Date();

  var rows = roster.map(function(s) {
    var studentObs = allObs.filter(function(o) { return o.studentCode === s.code; });

    if (studentObs.length === 0) {
      return { student: s, lastDate: null, daysSince: Infinity };
    }

    var mostRecent = studentObs.reduce(function(latest, o) {
      return (o.date > latest) ? o.date : latest;
    }, studentObs[0].date);

    var daysSince = countSchoolDaysBetween(mostRecent, today);
    return { student: s, lastDate: mostRecent, daysSince: daysSince };
  });

  // Worst (longest gap) first
  rows.sort(function(a, b) { return b.daysSince - a.daysSince; });

  var html = '<h2>Observations et conversations</h2>';
  html += '<button onclick="switchToObsCapture()">Retour à la capture</button>';
  html += '<h3>Besoin d\'attention</h3>';
  html += '<p>Élèves triés par nombre de jours d\'école depuis leur dernière entrée. ';
  html += 'Seuil signalé: ' + ATTENTION_THRESHOLD_SCHOOL_DAYS + ' jours d\'école.</p>';

  html += '<table class="obs-attention-table">';
  html += '<tr><th>Élève</th><th>Dernière entrée</th><th>Jours d\'école écoulés</th></tr>';

  rows.forEach(function(r) {
    var flagged = (r.daysSince === Infinity) || (r.daysSince >= ATTENTION_THRESHOLD_SCHOOL_DAYS);
    var rowClass = flagged ? 'obs-attention-flagged' : '';
    var daysDisplay = (r.daysSince === Infinity) ? 'Aucune entrée' : r.daysSince;
    var dateDisplay = r.lastDate || '—';

    html += '<tr class="' + rowClass + '">';
    html += '<td>' + (flagged ? '⚠️ ' : '') + displayName(r.student) + '</td>';
    html += '<td>' + dateDisplay + '</td>';
    html += '<td>' + daysDisplay + '</td>';
    html += '</tr>';
  });

  html += '</table>';

  container.innerHTML = html;
}
// ============================================================
// observations.js — MonProf.ai
// PART O3: Domain coverage grid (who has 0 entries in A/B/C/D)
// ============================================================
// APPEND this to the END of your observations.js file, after
// Part O2. Also make the 1 small edit described separately
// (second nav button).
//
// Depends on:
//   - getObservations(), getRoster(), displayName() — already in your files
// ============================================================

function switchToObsDomainView() {
  var container = document.getElementById('module-observations');
  if (!container) return;
  renderObsDomainView(container);
}

function renderObsDomainView(container) {
  var roster = getRoster().filter(function(s) { return s.actif; });
  var allObs = getObservations();
  var domains = ['A', 'B', 'C', 'D'];

  var html = '<h2>Observations et conversations</h2>';
  html += '<button onclick="switchToObsCapture()">Retour à la capture</button>';
  html += '<h3>Répartition par domaine</h3>';
  html += '<p>Nombre d\'entrées par domaine pour chaque élève.</p>';

  html += '<table class="obs-domain-table">';
  html += '<tr><th>Élève</th><th>A</th><th>B</th><th>C</th><th>D</th></tr>';

  roster.forEach(function(s) {
    var studentObs = allObs.filter(function(o) { return o.studentCode === s.code; });
    var domainCounts = { A: 0, B: 0, C: 0, D: 0 };
    studentObs.forEach(function(o) {
      if (domainCounts.hasOwnProperty(o.domaine)) domainCounts[o.domaine]++;
    });

    html += '<tr>';
    html += '<td>' + displayName(s) + '</td>';
    domains.forEach(function(d) {
      var count = domainCounts[d];
      html += '<td class="' + (count === 0 ? 'obs-domain-missing' : '') + '">' + count + '</td>';
    });
    html += '</tr>';
  });

  html += '</table>';

  container.innerHTML = html;
}
// ============================================================
// observations.js — MonProf.ai
// PART O4: Per-activity coverage grid
// ============================================================
// APPEND this to the END of your observations.js file.
// Also make the 1 edit described separately (nav button).
//
// Depends on:
//   - getObservations(), getRoster(), displayName() — already in your files
//   - switchToObsCapture() — Part O2
// ============================================================

function switchToObsActivityView() {
  var container = document.getElementById('module-observations');
  if (!container) return;
  renderObsActivityView(container);
}

function getDistinctObsActivityTags() {
  var all = getObservations();
  var latestByTag = {};

  all.forEach(function(o) {
    if (!o.activityTag) return;
    if (!latestByTag[o.activityTag] || o.date > latestByTag[o.activityTag]) {
      latestByTag[o.activityTag] = o.date;
    }
  });

  var tags = Object.keys(latestByTag);
  tags.sort(function(a, b) {
    return latestByTag[b].localeCompare(latestByTag[a]); // most recent activity first
  });

  return tags;
}

function renderObsActivityView(container) {
  var tags = getDistinctObsActivityTags();

  var html = '<h2>Observations et conversations</h2>';
  html += '<button onclick="switchToObsCapture()">Retour à la capture</button>';
  html += '<h3>Suivi par activité</h3>';

  if (tags.length === 0) {
    html += '<p>Aucune activité enregistrée pour le moment.</p>';
    container.innerHTML = html;
    return;
  }

  html += '<div class="form-row">';
  html += '<label for="obs-activity-select">Choisir une activité: </label>';
  html += '<select id="obs-activity-select" onchange="loadAndRenderObsActivityGrid(this.value)">';
  html += '<option value="">-- Sélectionner --</option>';
  tags.forEach(function(tag) {
    html += '<option value="' + tag + '">' + tag + '</option>';
  });
  html += '</select>';
  html += '</div>';

  html += '<div id="obs-activity-results"></div>';

  container.innerHTML = html;
}

function loadAndRenderObsActivityGrid(activityTag) {
  var resultsContainer = document.getElementById('obs-activity-results');
  if (!resultsContainer) return;

  if (!activityTag) {
    resultsContainer.innerHTML = '';
    return;
  }

  var roster = getRoster().filter(function(s) { return s.actif; });
  var matchingObs = getObservations().filter(function(o) { return o.activityTag === activityTag; });

  var lastDateByStudent = {};
  matchingObs.forEach(function(o) {
    if (!lastDateByStudent[o.studentCode] || o.date > lastDateByStudent[o.studentCode]) {
      lastDateByStudent[o.studentCode] = o.date;
    }
  });

  var coveredCount = roster.filter(function(s) { return lastDateByStudent[s.code]; }).length;

  var html = '<p><strong>' + coveredCount + ' sur ' + roster.length + '</strong> élèves complétés.</p>';
  html += '<table class="obs-activity-table">';
  html += '<tr><th>Élève</th><th></th><th>Date</th></tr>';

  roster.forEach(function(s) {
    var lastDate = lastDateByStudent[s.code];
    html += '<tr>';
    html += '<td>' + displayName(s) + '</td>';
    html += '<td>' + (lastDate ? '✓' : '') + '</td>';
    html += '<td>' + (lastDate || '') + '</td>';
    html += '</tr>';
  });

  html += '</table>';
  resultsContainer.innerHTML = html;
}
// ============================================================
// GRADES 1-6 — PART G2: Dynamic Observations capture form
// ============================================================
// APPEND this to the END of observations.js.
// Also make Edits 1-3 described separately.
//
// Depends on:
//   - isGrade1to6(), HH_CATEGORIES, ACHIEVEMENT_CATEGORIES,
//     GRADES_1_6_SUBJECTS, SUBJECT_STRANDS,
//     DOMAINE_B_FRANCAIS_CONTINUUM — roster.js (Part G1)
// ============================================================

function handleObsStudentChange() {
  var studentCode = document.getElementById('obs-student').value;
  var linkSection = document.getElementById('obs-link-section');
  if (linkSection) {
    linkSection.innerHTML = renderObsLinkSectionHtml(studentCode);
  }
}

function renderObsLinkSectionHtml(studentCode) {
  if (!studentCode) {
    return '<p><em>Sélectionnez un élève pour afficher les champs appropriés.</em></p>';
  }

  var peiReminder = getPeiReminderHtml(studentCode);

  if (!isGrade1to6(studentCode)) {
    var html = '<div class="form-row">';
    html += '<label>Domaine</label>';
    html += '<div class="domaine-btns">';
    html += '<button class="domaine-btn active" id="domaine-A" onclick="setDomaine(\'A\')"><strong>A</strong> Langue & maths</button>';
    html += '<button class="domaine-btn" id="domaine-B" onclick="setDomaine(\'B\')"><strong>B</strong> Résolution & innovation</button>';
    html += '<button class="domaine-btn" id="domaine-C" onclick="setDomaine(\'C\')"><strong>C</strong> Autorégulation & bien-être</button>';
    html += '<button class="domaine-btn" id="domaine-D" onclick="setDomaine(\'D\')"><strong>D</strong> Appartenance & contribution</button>';
    html += '</div>';
    html += '</div>';
    html += '<input type="hidden" id="obs-domaine" value="A">';

    html += '<div class="form-row">';
    html += '<label>Activité (facultatif)</label>';
    html += '<input type="text" id="obs-activity" placeholder="ex: Cercle du matin" maxlength="80">';
    html += '</div>';

    return peiReminder + html;
  }

  var html2 = '<div class="obs-type-toggle">';
  html2 += '<button id="btn-link-hh" class="type-btn active" onclick="setObsLinkType(\'hh\')">HH</button>';
  html2 += '<button id="btn-link-expectation" class="type-btn" onclick="setObsLinkType(\'expectation\')">Attente du curriculum</button>';
  html2 += '</div>';
  html2 += '<input type="hidden" id="obs-linktype" value="hh">';

  html2 += '<div id="obs-hh-fields">';
  html2 += '<div class="form-row">';
  html2 += '<label>Catégorie HH</label>';
  html2 += '<select id="obs-hh-category">';
  HH_CATEGORIES.forEach(function(cat) {
    html2 += '<option value="' + cat + '">' + cat + '</option>';
  });
  html2 += '</select>';
  html2 += '</div>';
  html2 += '</div>';

  html2 += '<div id="obs-expectation-fields" style="display:none;">';
  html2 += buildObsExpectationFieldsHtml(GRADES_1_6_SUBJECTS[0], '');
  html2 += '</div>';

  return peiReminder + html2;
}

function setObsLinkType(type) {
  document.getElementById('obs-linktype').value = type;
  document.getElementById('btn-link-hh').className = 'type-btn' + (type === 'hh' ? ' active' : '');
  document.getElementById('btn-link-expectation').className = 'type-btn' + (type === 'expectation' ? ' active' : '');

  var hhFields = document.getElementById('obs-hh-fields');
  var expectationFields = document.getElementById('obs-expectation-fields');
  if (hhFields) hhFields.style.display = (type === 'hh') ? 'block' : 'none';
  if (expectationFields) expectationFields.style.display = (type === 'expectation') ? 'block' : 'none';
}

function buildObsExpectationFieldsHtml(subject, strand) {
  var strands = SUBJECT_STRANDS[subject] || [];
  if (!strand) strand = strands[0] || '';

  var html = '<div class="form-row">';
  html += '<label>Matière</label>';
  html += '<select id="obs-subject" onchange="handleObsSubjectChange()">';
  GRADES_1_6_SUBJECTS.forEach(function(subj) {
    html += '<option value="' + subj + '"' + (subj === subject ? ' selected' : '') + '>' + subj + '</option>';
  });
  html += '</select>';
  html += '</div>';

  html += '<div class="form-row">';
  html += '<label>Domaine/Volet</label>';
  html += '<select id="obs-strand" onchange="handleObsStrandChange()">';
  strands.forEach(function(s) {
    html += '<option value="' + s + '"' + (s === strand ? ' selected' : '') + '>' + s + '</option>';
  });
  html += '</select>';
  html += '</div>';

  html += '<div class="form-row" id="obs-sous-sujet-row">';
  html += buildObsSousSujetFieldHtml(subject, strand);
  html += '</div>';

  html += '<div class="form-row">';
  html += '<label>Compétence (grille d\'évaluation)</label>';
  html += '<select id="obs-achievement">';
  ACHIEVEMENT_CATEGORIES.forEach(function(cat) {
    html += '<option value="' + cat + '">' + cat + '</option>';
  });
  html += '</select>';
  html += '</div>';

  return html;
}

function buildObsSousSujetFieldHtml(subject, strand) {
  var isDomaineBFrancais = (subject === 'Français' && strand === 'B - Notions fondamentales de la langue');

  if (isDomaineBFrancais) {
    var html = '<label>Notion fondamentale</label>';
    html += '<select id="obs-sous-sujet">';
    DOMAINE_B_FRANCAIS_CONTINUUM.forEach(function(item) {
      html += '<option value="' + item + '">' + item + '</option>';
    });
    html += '</select>';
    return html;
  }

  var html2 = '<label>Sous-sujet (facultatif)</label>';
  html2 += '<input type="text" id="obs-sous-sujet" placeholder="ex: multiplication, triangles..." maxlength="80">';
  return html2;
}

function handleObsSubjectChange() {
  var subject = document.getElementById('obs-subject').value;
  var expectationFields = document.getElementById('obs-expectation-fields');
  if (expectationFields) {
    expectationFields.innerHTML = buildObsExpectationFieldsHtml(subject, '');
  }
}

function handleObsStrandChange() {
  var subject = document.getElementById('obs-subject').value;
  var strand = document.getElementById('obs-strand').value;
  var row = document.getElementById('obs-sous-sujet-row');
  if (row) {
    row.innerHTML = buildObsSousSujetFieldHtml(subject, strand);
  }
}
