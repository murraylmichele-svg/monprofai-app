// ============================================================
// productions.js — MonProf.ai
// PART 1 of 4: IndexedDB data layer
// ============================================================
// This part only handles storage. No UI yet. Test it in the
// browser console before moving to Part 2.
//
// Two IndexedDB object stores, in a new DB "monprofai_productions":
//   - "productions"      : the evidence record (note, domain, level, etc.)
//   - "production_media" : photo blobs, kept separate so listing
//                           records stays fast even with lots of photos
//
// PRIVACY: photoIds/audioNoteId never leave the device. Only
// studentCode + domain + note + level travel to the API later.
// ============================================================

const PRODUCTIONS_DB_NAME = "monprofai_productions";
const PRODUCTIONS_DB_VERSION = 1;

let productionsDB = null;

function openProductionsDB() {
  return new Promise((resolve, reject) => {
    if (productionsDB) {
      resolve(productionsDB);
      return;
    }

    const request = indexedDB.open(PRODUCTIONS_DB_NAME, PRODUCTIONS_DB_VERSION);

    request.onupgradeneeded = function (event) {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("productions")) {
        const store = db.createObjectStore("productions", { keyPath: "id" });
        store.createIndex("studentCode", "studentCode", { unique: false });
        store.createIndex("activityTag", "activityTag", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains("production_media")) {
        const mediaStore = db.createObjectStore("production_media", { keyPath: "id" });
        mediaStore.createIndex("productionId", "productionId", { unique: false });
      }
    };

    request.onsuccess = function (event) {
      productionsDB = event.target.result;
      resolve(productionsDB);
    };

    request.onerror = function (event) {
      console.error("Erreur d'ouverture de la base productions:", event.target.error);
      reject(event.target.error);
    };
  });
}

function generateProductionId() {
  return "prod_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

function generateMediaId() {
  return "photo_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

// ---- CREATE ----

// studentCode: "EL_04"
// domain: "A" | "B" | "C" | "D"
// note: string (can be empty string, not null)
// level: "emergent" | "developing" | "confirmed" | null
// activityTag: string (can be empty string)
// photoBlobs: array of Blob objects (can be empty array)
async function addProduction({ studentCode, domain, note, level, activityTag, photoBlobs }) {
  const db = await openProductionsDB();
  const productionId = generateProductionId();
  const now = new Date().toISOString();

  const photoIds = [];
  if (photoBlobs && photoBlobs.length > 0) {
    for (const blob of photoBlobs) {
      const mediaId = await saveProductionPhoto(productionId, blob);
      photoIds.push(mediaId);
    }
  }

  const record = {
    id: productionId,
    studentCode: studentCode,
    domain: domain,
    activityTag: activityTag || "",
    note: note || "",
    level: level || null,
    photoIds: photoIds,
    audioNoteId: null,
    createdAt: now,
    editedAt: null,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("productions", "readwrite");
    tx.objectStore("productions").add(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

function saveProductionPhoto(productionId, blob) {
  return openProductionsDB().then((db) => {
    const mediaId = generateMediaId();
    const mediaRecord = {
      id: mediaId,
      productionId: productionId,
      blob: blob,
      mimeType: blob.type || "image/jpeg",
      createdAt: new Date().toISOString(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction("production_media", "readwrite");
      tx.objectStore("production_media").add(mediaRecord);
      tx.oncomplete = () => resolve(mediaId);
      tx.onerror = () => reject(tx.error);
    });
  });
}

// ---- READ ----

async function getProductionsByStudent(studentCode) {
  const db = await openProductionsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("productions", "readonly");
    const index = tx.objectStore("productions").index("studentCode");
    const request = index.getAll(studentCode);
    request.onsuccess = () => {
      const results = request.result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getProductionsByActivity(activityTag) {
  const db = await openProductionsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("productions", "readonly");
    const index = tx.objectStore("productions").index("activityTag");
    const request = index.getAll(activityTag);
    request.onsuccess = () => {
      const results = request.result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getAllProductions() {
  const db = await openProductionsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("productions", "readonly");
    const request = tx.objectStore("productions").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getProductionPhoto(mediaId) {
  const db = await openProductionsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("production_media", "readonly");
    const request = tx.objectStore("production_media").get(mediaId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---- UPDATE ----

async function updateProduction(productionId, changes) {
  const db = await openProductionsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("productions", "readwrite");
    const store = tx.objectStore("productions");
    const getRequest = store.get(productionId);
    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (!record) {
        reject(new Error("Production introuvable: " + productionId));
        return;
      }
      Object.assign(record, changes, { editedAt: new Date().toISOString() });
      store.put(record);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- DELETE ----

async function deleteProduction(productionId) {
  const db = await openProductionsDB();

  // Delete associated photos first
  const production = await new Promise((resolve, reject) => {
    const tx = db.transaction("productions", "readonly");
    const request = tx.objectStore("productions").get(productionId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  if (production && production.photoIds && production.photoIds.length > 0) {
    const mediaTx = db.transaction("production_media", "readwrite");
    const mediaStore = mediaTx.objectStore("production_media");
    production.photoIds.forEach((photoId) => mediaStore.delete(photoId));
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction("productions", "readwrite");
    tx.objectStore("productions").delete(productionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
// ============================================================
// productions.js — MonProf.ai
// PART 2 of 4: Capture UI (batch / activity mode)
// ============================================================
// APPEND this to the END of your existing productions.js.
// Do NOT replace the file — Part 1 (data layer) must stay above this.
//
// Depends on:
//   - Part 1 functions: addProduction()
//   - roster.js: getRoster(), displayName()
//   - app.js: calls renderProductions() when tab is clicked
//   - HTML container: <div id="module-productions"></div>
// ============================================================

var productionSession = {
  active: false,
  activityTag: '',
  domain: 'A',
  studentList: [],   // active students only, snapshot at session start
  currentIndex: 0,
  currentPhotoFile: null,  // File object from the camera input, or null
  savedCount: 0,
  entryMap: {}        // studentCode -> {id, note, level, photoIds} for THIS session
};
var productionViewMode = 'setup'; // 'setup' | 'history'

// ---- MAIN ENTRY POINT (called by app.js) ----

function renderProductions() {
  var container = document.getElementById('module-productions');
  if (!container) return;

  if (productionSession.active) {
    renderProductionCaptureScreen(container);
  } else if (productionViewMode === 'history') {
    renderProductionHistoryScreen(container);
  } else if (productionViewMode === 'grid') {
    renderProductionGridScreen(container);
  } else {
    renderProductionSetupScreen(container);
  }
}

// ---- SCREEN 1: SETUP ----

function renderProductionSetupScreen(container) {
  var html = '<h2>Productions</h2>';
  html += '<div id="production-setup">';
  html += '<h3>Nouvelle séance</h3>';
  html += '<div class="form-row">';
  html += '<input type="text" id="input-activity-tag" placeholder="Nom de l\'activité (ex: Suites de couleurs)" maxlength="80">';
  html += '</div>';
  html += '<div class="form-row">';
  html += '<label for="input-domain">Domaine: </label>';
  html += '<select id="input-domain">';
  html += '<option value="A">A - Langue et mathématiques fondamentales</option>';
  html += '<option value="B">B - Résolution de problèmes et innovation</option>';
  html += '<option value="C">C - Autorégulation et bien-être</option>';
  html += '<option value="D">D - Appartenance et contribution</option>';
  html += '</select>';
  html += '</div>';
  html += '<button onclick="startProductionSession()">Commencer la séance</button> ';
  html += '<button onclick="switchToProductionHistory()">Voir l\'historique par élève</button> ';
  html += '<button onclick="switchToProductionGrid()">Voir la couverture par activité</button>';
  html += '</div>';

  container.innerHTML = html;
}

function startProductionSession() {
  var tagInput = document.getElementById('input-activity-tag');
  var domainInput = document.getElementById('input-domain');
  var tag = tagInput.value.trim();

  if (!tag) {
    alert('Veuillez nommer l\'activité avant de commencer.');
    return;
  }

  var roster = getRoster();
  var activeStudents = roster.filter(function(s) { return s.actif; });

  if (activeStudents.length === 0) {
    alert('Aucun élève actif dans la liste de classe.');
    return;
  }

  productionSession.active = true;
  productionSession.activityTag = tag;
  productionSession.domain = domainInput.value;
  productionSession.studentList = activeStudents;
  productionSession.currentIndex = 0;
  productionSession.currentPhotoFile = null;
  productionSession.savedCount = 0;
  productionSession.entryMap = {};

  renderProductions();
}

// ---- SCREEN 2: CAPTURE LOOP ----

function renderProductionCaptureScreen(container) {
  var idx = productionSession.currentIndex;
  var total = productionSession.studentList.length;

  if (idx >= total) {
    renderProductionSummaryScreen(container);
    return;
  }

  var student = productionSession.studentList[idx];
  var existingEntry = productionSession.entryMap[student.code];

  var html = '<h2>Productions</h2>';
  html += '<p class="production-activity-label">Activité: <strong>' + productionSession.activityTag + '</strong>';
  html += ' &nbsp; | &nbsp; Domaine: <strong>' + productionSession.domain + '</strong>';
  html += ' &nbsp; | &nbsp; Élève ' + (idx + 1) + ' sur ' + total + '</p>';

  html += renderProductionChipStrip();

  html += '<div id="production-capture">';
  html += '<h3>' + displayName(student) + '</h3>';

  if (existingEntry) {
    html += '<div class="production-existing-box">';
    html += '<p><strong>Déjà enregistré pour cette activité:</strong></p>';
    html += '<p>Note existante: ' + (existingEntry.note || '(vide)') + '</p>';
    html += '<p>Niveau actuel: ' + getLevelLabel(existingEntry.level) + '</p>';
    html += '<p>Photos existantes: ' + existingEntry.photoIds.length + '</p>';
    html += '<p><em>Ce que vous ajoutez ci-dessous s\'ajoutera à cette entrée.</em></p>';
    html += '</div>';
  }

  html += '<div class="form-row">';
  html += '<label>' + (existingEntry ? 'Ajouter une photo' : 'Photo') + ' (optionnelle):</label><br>';
  html += '<input type="file" accept="image/*" capture="environment" id="input-photo" onchange="handleProductionPhotoSelect(event)">';
  html += '<span id="photo-status"></span>';
  html += '</div>';

  html += '<div class="form-row">';
  html += '<textarea id="input-note" placeholder="' + (existingEntry ? 'Ajouter à la note...' : 'Qu\'est-ce que cette production démontre?') + '" rows="3" maxlength="500"></textarea>';
  html += '</div>';

  html += '<div class="form-row">';
  html += '<label>Niveau interne (facultatif, jamais montré aux parents):</label><br>';
  if (existingEntry) {
    html += '<label><input type="radio" name="input-level" value="__keep__" checked> Ne pas changer</label> ';
    html += '<label><input type="radio" name="input-level" value=""> Aucun niveau</label> ';
  } else {
    html += '<label><input type="radio" name="input-level" value="" checked> Pas de niveau</label> ';
  }
  html += '<label><input type="radio" name="input-level" value="emergent"> Émergent</label> ';
  html += '<label><input type="radio" name="input-level" value="developing"> En développement</label> ';
  html += '<label><input type="radio" name="input-level" value="confirmed"> Confirmé</label>';
  html += '</div>';

  html += '<button onclick="saveProductionEntry()">' + (existingEntry ? 'Ajouter et suivant' : 'Enregistrer et suivant') + '</button> ';
  html += '<button onclick="skipProductionEntry()">Passer cet élève</button> ';
  html += '<button onclick="endProductionSession()">Terminer la séance</button>';
  html += '</div>';

  container.innerHTML = html;
}

function handleProductionPhotoSelect(event) {
  var file = event.target.files[0];
  productionSession.currentPhotoFile = file || null;
  var status = document.getElementById('photo-status');
  if (status) {
    status.textContent = file ? ' Photo sélectionnée.' : '';
  }
}

function getSelectedProductionLevel() {
  var radios = document.getElementsByName('input-level');
  for (var i = 0; i < radios.length; i++) {
    if (radios[i].checked) return radios[i].value;
  }
  return '';
}

function saveProductionEntry() {
  var student = productionSession.studentList[productionSession.currentIndex];
  var noteInput = document.getElementById('input-note');
  var newNoteText = noteInput ? noteInput.value.trim() : '';
  var levelSelection = getSelectedProductionLevel();
  var newPhotoFile = productionSession.currentPhotoFile;
  var existing = productionSession.entryMap[student.code];

  if (existing) {
    var mergedNote = newNoteText ? (existing.note ? existing.note + ' | ' + newNoteText : newNoteText) : existing.note;
    var mergedLevel = (levelSelection === '__keep__') ? existing.level : (levelSelection || null);

    var afterPhoto;
    if (newPhotoFile) {
      afterPhoto = saveProductionPhoto(existing.id, newPhotoFile).then(function(newPhotoId) {
        return existing.photoIds.concat([newPhotoId]);
      });
    } else {
      afterPhoto = Promise.resolve(existing.photoIds);
    }

    afterPhoto.then(function(mergedPhotoIds) {
      return updateProduction(existing.id, {
        note: mergedNote,
        level: mergedLevel,
        photoIds: mergedPhotoIds
      }).then(function() {
        productionSession.entryMap[student.code] = {
          id: existing.id,
          note: mergedNote,
          level: mergedLevel,
          photoIds: mergedPhotoIds
        };
        advanceProductionSession();
      });
    }).catch(function(err) {
      alert('Erreur lors de la mise à jour. Veuillez réessayer.');
      console.error(err);
    });

  } else {
    var levelToSave = (levelSelection === '__keep__') ? null : (levelSelection || null);
    addProduction({
      studentCode: student.code,
      domain: productionSession.domain,
      note: newNoteText,
      level: levelToSave,
      activityTag: productionSession.activityTag,
      photoBlobs: newPhotoFile ? [newPhotoFile] : []
    }).then(function(record) {
      productionSession.savedCount++;
      productionSession.entryMap[student.code] = {
        id: record.id,
        note: record.note,
        level: record.level,
        photoIds: record.photoIds
      };
      advanceProductionSession();
    }).catch(function(err) {
      alert('Erreur lors de l\'enregistrement. Veuillez réessayer.');
      console.error(err);
    });
  }
}
function skipProductionEntry() {
  advanceProductionSession();
}

function advanceProductionSession() {
  productionSession.currentIndex++;
  productionSession.currentPhotoFile = null;
  renderProductions();
}

function endProductionSession() {
  var container = document.getElementById('module-productions');
  renderProductionSummaryScreen(container);
}

// ---- SCREEN 3: SUMMARY ----

function renderProductionSummaryScreen(container) {
  var html = '<h2>Productions</h2>';
  html += renderProductionChipStrip();
  html += '<div id="production-summary">';
  html += '<h3>Séance terminée</h3>';
  html += '<p>Activité: <strong>' + productionSession.activityTag + '</strong></p>';
  html += '<p>' + productionSession.savedCount + ' entrée(s) enregistrée(s).</p>';
  html += '<p><em>Touchez un nom ci-dessus pour ajouter des informations.</em></p>';
  html += '<button onclick="resetProductionSession()">Nouvelle séance</button>';
  html += '</div>';

  container.innerHTML = html;
}

function resetProductionSession() {
  productionSession.active = false;
  productionSession.activityTag = '';
  productionSession.studentList = [];
  productionSession.currentIndex = 0;
  productionSession.currentPhotoFile = null;
  productionSession.savedCount = 0;
  productionSession.entryMap = {};
  renderProductions();
}
// ============================================================
// productions.js — MonProf.ai
// PART 3 of 4: Per-student timeline (history) view — READ ONLY
// ============================================================
// APPEND this to the END of your productions.js file, after
// Part 1 and Part 2. Also make the 3 small edits described
// separately (state variable, dispatcher, setup button).
//
// Depends on:
//   - Part 1 functions: getProductionsByStudent(), getProductionPhoto()
//   - roster.js: getRoster(), displayName()
// ============================================================

function getDomainLabel(domain) {
  var labels = {
    A: 'A - Langue et mathématiques fondamentales',
    B: 'B - Résolution de problèmes et innovation',
    C: 'C - Autorégulation et bien-être',
    D: 'D - Appartenance et contribution'
  };
  return labels[domain] || domain;
}

function getLevelLabel(level) {
  var labels = {
    emergent: 'Émergent',
    developing: 'En développement',
    confirmed: 'Confirmé'
  };
  return level ? (labels[level] || level) : 'Pas de niveau';
}

function formatProductionDate(isoString) {
  var d = new Date(isoString);
  return d.toLocaleDateString('fr-CA') + ' ' + d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
}

function switchToProductionHistory() {
  productionViewMode = 'history';
  renderProductions();
}

function switchToProductionSetup() {
  productionViewMode = 'setup';
  renderProductions();
}

// ---- HISTORY SCREEN ----

function renderProductionHistoryScreen(container) {
  var roster = getRoster();
  var activeStudents = roster.filter(function(s) { return s.actif; });

  var html = '<h2>Productions</h2>';
  html += '<button onclick="switchToProductionSetup()">Retour</button>';
  html += '<h3>Historique par élève</h3>';

  if (activeStudents.length === 0) {
    html += '<p>Aucun élève actif dans la liste de classe.</p>';
    container.innerHTML = html;
    return;
  }

  html += '<div class="form-row">';
  html += '<label for="history-student-select">Choisir un élève: </label>';
  html += '<select id="history-student-select" onchange="loadAndRenderStudentHistory(this.value)">';
  html += '<option value="">-- Sélectionner --</option>';
  activeStudents.forEach(function(s) {
    html += '<option value="' + s.code + '">' + displayName(s) + '</option>';
  });
  html += '</select>';
  html += '</div>';

  html += '<div id="production-history-results"></div>';

  container.innerHTML = html;
}

async function loadAndRenderStudentHistory(code) {
  var resultsContainer = document.getElementById('production-history-results');
  if (!resultsContainer) return;

  if (!code) {
    resultsContainer.innerHTML = '';
    return;
  }

  resultsContainer.innerHTML = '<p>Chargement...</p>';

  var entries = await getProductionsByStudent(code);

  if (entries.length === 0) {
    resultsContainer.innerHTML = '<p>Aucune production enregistrée pour cet élève.</p>';
    return;
  }

  // Newest first for reading
  entries = entries.slice().reverse();

  var html = '<table class="production-history-table">';

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    html += '<tr class="production-entry">';
    html += '<td class="production-entry-cell">';
    html += '<p><strong>' + formatProductionDate(entry.createdAt) + '</strong></p>';
    html += '<p>' + getDomainLabel(entry.domain) + '</p>';
    if (entry.activityTag) {
      html += '<p><em>' + entry.activityTag + '</em></p>';
    }
    if (entry.note) {
      html += '<p>' + entry.note + '</p>';
    }
    html += '<p>Niveau interne: ' + getLevelLabel(entry.level) + '</p>';

    if (entry.photoIds && entry.photoIds.length > 0) {
      html += '<div class="production-photo-container" id="photo-container-' + entry.id + '"><em>Chargement de la photo...</em></div>';
    }

    html += '</td>';
    html += '</tr>';
  }

  html += '</table>';
  resultsContainer.innerHTML = html;

  // Load photos after the HTML is in place, one at a time
  for (var j = 0; j < entries.length; j++) {
    var e = entries[j];
    if (e.photoIds && e.photoIds.length > 0) {
      loadProductionPhotoIntoContainer(e.id, e.photoIds[0]);
    }
  }
}

async function loadProductionPhotoIntoContainer(productionId, photoId) {
  var mediaRecord = await getProductionPhoto(photoId);
  var photoContainer = document.getElementById('photo-container-' + productionId);
  if (!photoContainer || !mediaRecord || !mediaRecord.blob) return;

  var objectUrl = URL.createObjectURL(mediaRecord.blob);
  photoContainer.innerHTML = '<img src="' + objectUrl + '" class="production-photo-thumb" alt="Photo de production">';
}
// ============================================================
// productions.js — MonProf.ai
// PART 4 of 4: Per-activity coverage grid — READ ONLY
// ============================================================
// APPEND this to the END of your productions.js file, after
// Parts 1, 2, and 3. Also make the 2 small edits described
// separately (setup button, dispatcher).
//
// Depends on:
//   - Part 1 functions: getAllProductions(), getProductionsByActivity()
//   - roster.js: getRoster(), displayName()
//   - Part 3 functions: formatProductionDate()
// ============================================================

function switchToProductionGrid() {
  productionViewMode = 'grid';
  renderProductions();
}

async function getDistinctActivityTags() {
  var all = await getAllProductions();
  var latestByTag = {};

  all.forEach(function(p) {
    if (!p.activityTag) return;
    if (!latestByTag[p.activityTag] || p.createdAt > latestByTag[p.activityTag]) {
      latestByTag[p.activityTag] = p.createdAt;
    }
  });

  var tags = Object.keys(latestByTag);
  tags.sort(function(a, b) {
    return latestByTag[b].localeCompare(latestByTag[a]); // most recent activity first
  });

  return tags;
}

async function renderProductionGridScreen(container) {
  var html = '<h2>Productions</h2>';
  html += '<button onclick="switchToProductionSetup()">Retour</button>';
  html += '<h3>Couverture par activité</h3>';
  html += '<div id="grid-select-area"><p>Chargement des activités...</p></div>';
  html += '<div id="production-grid-results"></div>';

  container.innerHTML = html;

  var tags = await getDistinctActivityTags();
  var selectArea = document.getElementById('grid-select-area');
  if (!selectArea) return; // user navigated away before this finished loading

  if (tags.length === 0) {
    selectArea.innerHTML = '<p>Aucune activité enregistrée pour le moment.</p>';
    return;
  }

  var selectHtml = '<div class="form-row">';
  selectHtml += '<label for="grid-activity-select">Choisir une activité: </label>';
  selectHtml += '<select id="grid-activity-select" onchange="loadAndRenderActivityGrid(this.value)">';
  selectHtml += '<option value="">-- Sélectionner --</option>';
  tags.forEach(function(tag) {
    selectHtml += '<option value="' + tag + '">' + tag + '</option>';
  });
  selectHtml += '</select>';
  selectHtml += '</div>';

  selectArea.innerHTML = selectHtml;
}

async function loadAndRenderActivityGrid(activityTag) {
  var resultsContainer = document.getElementById('production-grid-results');
  if (!resultsContainer) return;

  if (!activityTag) {
    resultsContainer.innerHTML = '';
    return;
  }

  resultsContainer.innerHTML = '<p>Chargement...</p>';

  var roster = getRoster();
  var activeStudents = roster.filter(function(s) { return s.actif; });
  var entries = await getProductionsByActivity(activityTag);

  // Build studentCode -> { count, lastDate } lookup
  var coverage = {};
  entries.forEach(function(e) {
    if (!coverage[e.studentCode]) {
      coverage[e.studentCode] = { count: 0, lastDate: e.createdAt };
    }
    coverage[e.studentCode].count++;
    if (e.createdAt > coverage[e.studentCode].lastDate) {
      coverage[e.studentCode].lastDate = e.createdAt;
    }
  });

  var coveredCount = activeStudents.filter(function(s) { return coverage[s.code]; }).length;

  var html = '<p><strong>' + coveredCount + ' sur ' + activeStudents.length + '</strong> élèves ont une entrée pour cette activité.</p>';
  html += '<table class="production-grid-table">';
  html += '<tr><th>Élève</th><th>Statut</th><th>Entrées</th><th>Dernière</th></tr>';

  activeStudents.forEach(function(s) {
    var info = coverage[s.code];
    html += '<tr>';
    html += '<td>' + displayName(s) + '</td>';
    if (info) {
      html += '<td>✓</td>';
      html += '<td>' + info.count + '</td>';
      html += '<td>' + formatProductionDate(info.lastDate) + '</td>';
    } else {
      html += '<td class="production-grid-missing">✗ Manquant</td>';
      html += '<td>0</td>';
      html += '<td>—</td>';
    }
    html += '</tr>';
  });

  html += '</table>';
  resultsContainer.innerHTML = html;
}
// ============================================================
// productions.js — MonProf.ai
// PART 5 of 7: Live progress chip strip + jump-to-edit
// ============================================================
// APPEND this to the END of your productions.js file.
// Also make Edits 1-6 described separately — this part changes
// several existing functions, not just adds new ones.
// ============================================================

function renderProductionChipStrip() {
  var html = '<div class="production-chip-strip">';

  productionSession.studentList.forEach(function(s, i) {
    var isCurrent = (i === productionSession.currentIndex);
    var isDone = !!productionSession.entryMap[s.code];
    var cssClass = 'production-chip';
    if (isCurrent) cssClass += ' production-chip-current';
    if (isDone) cssClass += ' production-chip-done';

    var prefix = isDone ? '✓ ' : '';
    html += '<span class="' + cssClass + '" onclick="jumpToProductionStudent(' + i + ')">';
    html += prefix + displayName(s);
    html += '</span> ';
  });

  html += '</div>';
  return html;
}

function jumpToProductionStudent(index) {
  productionSession.currentIndex = index;
  productionSession.currentPhotoFile = null;
  renderProductions();
}
