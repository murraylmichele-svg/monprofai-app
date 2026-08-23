// ============================================================
// OBSERVATIONS.JS — Capture observations and conversations
// ============================================================

var OBS_KEY = 'monprofai_observations';

var obsPhotoCapture = {
  photoFile: null,
  photoPreviewUrl: null
};
function renderObsPhotoAreaHtml() {
  if (obsPhotoCapture.photoPreviewUrl) {
    var html = '<div class="photo-preview-box">';
    html += '<img src="' + obsPhotoCapture.photoPreviewUrl + '" alt="Aperçu de la photo" class="photo-preview-img">';
    html += '<br><button type="button" onclick="retakeObsPhoto()">Reprendre la photo</button>';
    html += '</div>';
    return html;
  }
  return '<input type="file" accept="image/*" id="obs-photo-input" onchange="handleObsPhotoSelect(event)">';
}

async function handleObsPhotoSelect(event) {
  var file = event.target.files[0];
  var status = document.getElementById('obs-photo-status');

  if (!file) return;

  if (status) status.textContent = ' Traitement de la photo...';

  var isHeic = file.type === 'image/heic' || file.type === 'image/heif' || /\.(heic|heif)$/i.test(file.name);
  var workingBlob = file;

  if (isHeic && typeof heic2any === 'function') {
    try {
      var converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
      workingBlob = Array.isArray(converted) ? converted[0] : converted;
    } catch (err) {
      console.error('Erreur de conversion HEIC:', err);
    }
  }

  try {
    var compressedBlob = await compressPhotoBlob(workingBlob, PHOTO_MAX_DIMENSION, PHOTO_JPEG_QUALITY);
    obsPhotoCapture.photoFile = compressedBlob;
    obsPhotoCapture.photoPreviewUrl = URL.createObjectURL(compressedBlob);
  } catch (err) {
    console.error('Erreur de compression de la photo:', err);
    obsPhotoCapture.photoFile = workingBlob;
    obsPhotoCapture.photoPreviewUrl = URL.createObjectURL(workingBlob);
  }

  if (status) status.textContent = '';
  var photoArea = document.getElementById('obs-photo-area');
  if (photoArea) photoArea.innerHTML = renderObsPhotoAreaHtml();
}

function retakeObsPhoto() {
  if (obsPhotoCapture.photoPreviewUrl) {
    URL.revokeObjectURL(obsPhotoCapture.photoPreviewUrl);
  }
  obsPhotoCapture.photoFile = null;
  obsPhotoCapture.photoPreviewUrl = null;

  var photoArea = document.getElementById('obs-photo-area');
  if (photoArea) photoArea.innerHTML = renderObsPhotoAreaHtml();
}
function retakeObsPhoto() {
  if (obsPhotoCapture.photoPreviewUrl) {
    URL.revokeObjectURL(obsPhotoCapture.photoPreviewUrl);
  }
  obsPhotoCapture.photoFile = null;
  obsPhotoCapture.photoPreviewUrl = null;

  var photoArea = document.getElementById('obs-photo-area');
  if (photoArea) photoArea.innerHTML = renderObsPhotoAreaHtml();
}

function loadObsHistoryThumbnails() {
  var obs = getObservations();
  obs.forEach(function(o) {
    if (o.photoIds && o.photoIds.length > 0) {
      loadObsRecentThumbnail(o.id, o.photoIds[0]);
    }
  });
}

async function loadObsRecentThumbnail(observationId, photoId) {
  var span = document.getElementById('obs-recent-photo-' + observationId);
  if (!span) return;

  var mediaRecord = await getObservationPhoto(photoId);
  if (!span || !mediaRecord || !mediaRecord.blob) return;

  var objectUrl = URL.createObjectURL(mediaRecord.blob);
  span.innerHTML = '<img src="' + objectUrl + '" alt="Photo" style="max-width:50px; max-height:50px; object-fit:cover; border-radius:4px; cursor:pointer;" onclick="window.open(\'' + objectUrl + '\', \'_blank\')">';
}
// ============================================================
// observations.js — MonProf.ai
// ADDITION: IndexedDB data layer for Observation photos
// ============================================================
// Mirrors the same pattern already used in productions.js for
// Productions photos — a separate IndexedDB database, since photo
// blobs can't live in localStorage alongside the observation data.
// This part only handles storage. No UI yet — test in the browser
// console before moving to the next piece.
// ============================================================

const OBS_MEDIA_DB_NAME = "monprofai_observations_media";
const OBS_MEDIA_DB_VERSION = 1;

let obsMediaDB = null;

function openObsMediaDB() {
  return new Promise((resolve, reject) => {
    if (obsMediaDB) {
      resolve(obsMediaDB);
      return;
    }

    const request = indexedDB.open(OBS_MEDIA_DB_NAME, OBS_MEDIA_DB_VERSION);

    request.onupgradeneeded = function (event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("observation_media")) {
        const store = db.createObjectStore("observation_media", { keyPath: "id" });
        store.createIndex("observationId", "observationId", { unique: false });
      }
    };

    request.onsuccess = function (event) {
      obsMediaDB = event.target.result;
      resolve(obsMediaDB);
    };

    request.onerror = function (event) {
      console.error("Erreur d'ouverture de la base observations_media:", event.target.error);
      reject(event.target.error);
    };
  });
}

function generateObsMediaId() {
  return "obsphoto_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

function saveObservationPhoto(observationId, blob) {
  return openObsMediaDB().then((db) => {
    const mediaId = generateObsMediaId();
    const mediaRecord = {
      id: mediaId,
      observationId: observationId,
      blob: blob,
      mimeType: blob.type || "image/jpeg",
      createdAt: new Date().toISOString(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction("observation_media", "readwrite");
      tx.objectStore("observation_media").add(mediaRecord);
      tx.oncomplete = () => resolve(mediaId);
      tx.onerror = () => reject(tx.error);
    });
  });
}

async function getObservationPhoto(mediaId) {
  const db = await openObsMediaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("observation_media", "readonly");
    const request = tx.objectStore("observation_media").get(mediaId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteObservationPhoto(mediaId) {
  const db = await openObsMediaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("observation_media", "readwrite");
    tx.objectStore("observation_media").delete(mediaId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
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
    photoIds: [],
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
  html += '<div class="mp-view-switcher">';
  html += '<button class="mp-view-btn" onclick="switchToObsAttentionView()"><i class="ti ti-clipboard-list" aria-hidden="true"></i>Suivi</button>';
  html += '<button class="mp-view-btn" onclick="switchToObsDomainView()"><i class="ti ti-chart-pie" aria-hidden="true"></i>Domaines</button>';
  html += '<button class="mp-view-btn" onclick="switchToObsActivityView()"><i class="ti ti-activity" aria-hidden="true"></i>Activités</button>';
  html += '</div>';

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
  html += '<div class="mp-toggle">';
  html += '<button id="btn-type-obs" class="active" onclick="setObsType(\'observation\')"><i class="ti ti-eye" aria-hidden="true"></i>Observation</button>';
  html += '<button id="btn-type-conv" onclick="setObsType(\'conversation\')"><i class="ti ti-message-circle" aria-hidden="true"></i>Conversation</button>';
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

  // Photo
  obsPhotoCapture.photoFile = null;
  obsPhotoCapture.photoPreviewUrl = null;
  html += '<div class="form-row">';
  html += '<label>Photo (optionnelle):</label><br>';
  html += '<div id="obs-photo-area">' + renderObsPhotoAreaHtml() + '</div>';
  html += '<span id="obs-photo-status"></span>';
  html += '</div>';

  // Note + mic
  html += '<div class="form-row">';
  html += '<div class="mp-info-row">';
  html += '<label style="margin:0;">Note</label>';
  html += '<button type="button" class="mp-info-btn" onclick="toggleObsVoiceTip()" aria-label="Aide">?</button>';
  html += '</div>';
  html += '<div id="obs-voice-tip" class="mp-info-tip">La dictée vocale utilise le service Google. Évitez de nommer l\'élève à voix haute — dites plutôt "l\'élève" ou utilisez "il/elle".</div>';
  html += '<textarea id="obs-note" rows="3" placeholder="Tapez votre note ou utilisez le micro ci-dessous..."></textarea>';
  html += '</div>';

  // Mic button
  html += '<button id="btn-mic" class="mp-mic-btn" onclick="toggleRecording()"><i class="ti ti-microphone" aria-hidden="true"></i>Dicter</button>';
  html += '<span id="mic-status" class="mic-status"></span>';

  html += '<button class="mp-save-btn" onclick="submitObsForm()"><i class="ti ti-check" aria-hidden="true"></i>Enregistrer</button>';
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
  loadObsHistoryThumbnails();
}

// ============================================================
// FORM CONTROLS
// ============================================================

function setObsType(type) {
  document.getElementById('obs-type').value = type;
  document.getElementById('btn-type-obs').className = (type === 'observation' ? 'active' : '');
  document.getElementById('btn-type-conv').className = (type === 'conversation' ? 'active' : '');
}

function setDomaine(d) {
  document.getElementById('obs-domaine').value = d;
  ['A','B','C','D','E'].forEach(function(x) {
    document.getElementById('domaine-' + x).className = 'mp-chip' + (x === d ? ' active' : '');
  });
}

function toggleObsVoiceTip() {
  var tip = document.getElementById('obs-voice-tip');
  if (tip) tip.classList.toggle('visible');
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
      micBtn.innerHTML = '<i class="ti ti-microphone" aria-hidden="true"></i>Dicter';
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
      micBtn.innerHTML = '<i class="ti ti-player-stop" aria-hidden="true"></i>Arrêter';
      micBtn.classList.add('recording');
    }
    if (micStatus) micStatus.textContent = 'Enregistrement...';
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
      micBtn.innerHTML = '<i class="ti ti-microphone" aria-hidden="true"></i>Dicter';
      micBtn.classList.remove('recording');
    }
    if (micStatus) micStatus.textContent = 'Terminé';
  };

  recognition.onerror = function(e) {
    isRecording = false;
    if (micBtn) {
      micBtn.innerHTML = '<i class="ti ti-microphone" aria-hidden="true"></i>Dicter';
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

 var newEntry = addObservation(studentCode, type, domaine, note, false, activityTag, extra);

  if (obsPhotoCapture.photoFile) {
    saveObservationPhoto(newEntry.id, obsPhotoCapture.photoFile).then(function(mediaId) {
      var obs = getObservations();
      obs = obs.map(function(o) {
        if (o.id === newEntry.id) {
          o.photoIds = [mediaId];
        }
        return o;
      });
      saveObservations(obs);
      document.getElementById('obs-history').innerHTML = renderObsHistory();
      loadObsHistoryThumbnails();
    });
  }

  obsPhotoCapture.photoFile = null;
  obsPhotoCapture.photoPreviewUrl = null;

  document.getElementById('obs-note').value = '';
  document.getElementById('obs-student').value = '';
  document.getElementById('obs-link-section').innerHTML = renderObsLinkSectionHtml('');
  document.getElementById('obs-photo-area').innerHTML = renderObsPhotoAreaHtml();
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

  var domainColors = {
    A: 'var(--mp-honey)', B: 'var(--mp-plum)', C: 'var(--mp-sage)',
    D: 'var(--mp-plum)', E: 'var(--mp-honey)'
  };

  var html = '<h3>Entrées récentes (' + obs.length + ')</h3>';
  html += '<div class="mp-entry-list">';

  obs.forEach(function(o) {
    var student = roster.find(function(s) { return s.code === o.studentCode; });
    var name = student ? displayName(student) : o.studentCode;
    var typeIcon = o.type === 'conversation' ? 'ti-message-circle' : 'ti-eye';
    var domainKey = o.domaine || '';
    var accentColor = domainColors[domainKey] || 'var(--mp-honey)';
    var domainOrSubject = o.subject || o.domaine || '';
    var noteDisplay = o.pending
      ? '<span class="mp-pending-note">En attente de transcription</span>'
      : '<span class="editable-note" onclick="editObsNote(' + o.id + ')">' + o.note + '</span>';

    html += '<div class="mp-entry-card" style="--entry-color:' + accentColor + ';">';
    html += '<div class="mp-entry-top">';
    html += '<div class="mp-entry-name"><i class="ti ' + typeIcon + '" aria-hidden="true" style="color:var(--mp-taupe); margin-right:4px;"></i>' + name;
    if (domainOrSubject) {
      html += ' <span class="mp-entry-meta">· ' + domainOrSubject + '</span>';
    }
    html += '</div>';
    html += '<button class="mp-entry-delete" aria-label="Supprimer" onclick="deleteObsEntry(' + o.id + ')"><i class="ti ti-trash" aria-hidden="true"></i></button>';
    html += '</div>';
    html += '<div class="mp-entry-note">' + noteDisplay + '</div>';
    if (o.activityTag) {
      html += '<div class="mp-entry-meta" style="font-size:13px; margin-top:2px;">' + o.activityTag + '</div>';
    }
    if (o.photoIds && o.photoIds.length > 0) {
      html += '<div><span id="obs-recent-photo-' + o.id + '"></span></div>';
    }
    html += '<div class="mp-entry-date">' + o.date + '</div>';
    html += '</div>';
  });

  html += '</div>';
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
  loadObsHistoryThumbnails();
}

function deleteObsEntry(id) {
  deleteObservation(id);
  document.getElementById('obs-history').innerHTML = renderObsHistory();
  loadObsHistoryThumbnails();
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
  var domains = ['A', 'B', 'C', 'D', 'E'];

  var html = '<h2>Observations et conversations</h2>';
  html += '<button onclick="switchToObsCapture()">Retour à la capture</button>';
  html += '<h3>Répartition par domaine</h3>';
  html += '<p>Nombre d\'entrées par domaine pour chaque élève.</p>';

  html += '<table class="obs-domain-table">';
  html += '<tr><th>Élève</th><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th></tr>';

  roster.forEach(function(s) {
    var studentObs = allObs.filter(function(o) { return o.studentCode === s.code; });
    var domainCounts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
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
    html += '<div class="mp-chip-row">';
    html += '<button class="mp-chip active" id="domaine-A" onclick="setDomaine(\'A\')" style="--chip-color:var(--mp-honey); --chip-bg:var(--mp-honey-bg);"><i class="ti ti-abc" aria-hidden="true"></i>A · Langue & maths</button>';
    html += '<button class="mp-chip" id="domaine-B" onclick="setDomaine(\'B\')" style="--chip-color:var(--mp-plum); --chip-bg:var(--mp-plum-bg);"><i class="ti ti-bulb" aria-hidden="true"></i>B · Résolution & innovation</button>';
    html += '<button class="mp-chip" id="domaine-C" onclick="setDomaine(\'C\')" style="--chip-color:var(--mp-sage); --chip-bg:var(--mp-sage-bg);"><i class="ti ti-heart" aria-hidden="true"></i>C · Autorégulation & bien-être</button>';
    html += '<button class="mp-chip" id="domaine-D" onclick="setDomaine(\'D\')" style="--chip-color:var(--mp-plum); --chip-bg:var(--mp-plum-bg);"><i class="ti ti-users" aria-hidden="true"></i>D · Appartenance & contribution</button>';
    html += '<button class="mp-chip" id="domaine-E" onclick="setDomaine(\'E\')" style="--chip-color:var(--mp-honey); --chip-bg:var(--mp-honey-bg);"><i class="ti ti-sparkles" aria-hidden="true"></i>E · Éveil religieux</button>';
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
  var linkSectionStudent = getRoster().find(function(s) { return s.code === studentCode; });
  var linkSectionAnnee = linkSectionStudent ? linkSectionStudent.annee : null;
  html2 += buildObsExpectationFieldsHtml(GRADES_1_6_SUBJECTS[0], '', linkSectionAnnee);
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

function buildObsExpectationFieldsHtml(subject, strand, annee) {
  var strands = getStrandsForSubject(subject, annee);
  if (!strand) strand = strands[0] || '';

  var html = '<input type="hidden" id="obs-annee" value="' + (annee || '') + '">';

  html += '<div class="form-row">';
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

  var html2 = '<label>Activité (facultatif)</label>';
  html2 += '<input type="text" id="obs-sous-sujet" placeholder="ex: multiplication, triangles..." maxlength="80">';
  return html2;
}

function handleObsSubjectChange() {
  var subject = document.getElementById('obs-subject').value;
  var anneeInput = document.getElementById('obs-annee');
  var annee = anneeInput ? anneeInput.value : null;
  var expectationFields = document.getElementById('obs-expectation-fields');
  if (expectationFields) {
    expectationFields.innerHTML = buildObsExpectationFieldsHtml(subject, '', annee);
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
