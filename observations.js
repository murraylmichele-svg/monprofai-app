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

function addObservation(studentCode, type, domaine, note, pending, activityTag) {
  var obs = getObservations();
  var entry = {
    id: Date.now(),
    studentCode: studentCode,
    type: type,
    domaine: domaine,
    note: note || '',
    pending: pending || false,
    activityTag: activityTag || '',
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
  var domaine = document.getElementById('obs-domaine').value;
  var note = document.getElementById('obs-note').value.trim();

  if (!studentCode) {
    alert('Veuillez sélectionner un élève.');
    return;
  }
  if (!note) {
    alert('Veuillez entrer une note ou dicter un message.');
    return;
  }

  addObservation(studentCode, type, domaine, note, false);
  document.getElementById('obs-note').value = '';
  document.getElementById('obs-student').value = '';
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
  html += '<tr><th>Date</th><th>Élève</th><th>Type</th><th>Dom.</th><th>Note</th><th></th></tr>';

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
