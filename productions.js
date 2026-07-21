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
  savedCount: 0
};

// ---- MAIN ENTRY POINT (called by app.js) ----

function renderProductions() {
  var container = document.getElementById('module-productions');
  if (!container) return;

  if (!productionSession.active) {
    renderProductionSetupScreen(container);
  } else {
    renderProductionCaptureScreen(container);
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
  html += '<button onclick="startProductionSession()">Commencer la séance</button>';
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

  var html = '<h2>Productions</h2>';
  html += '<p class="production-activity-label">Activité: <strong>' + productionSession.activityTag + '</strong>';
  html += ' &nbsp; | &nbsp; Domaine: <strong>' + productionSession.domain + '</strong>';
  html += ' &nbsp; | &nbsp; Élève ' + (idx + 1) + ' sur ' + total + '</p>';

  html += '<div id="production-capture">';
  html += '<h3>' + displayName(student) + '</h3>';

  html += '<div class="form-row">';
  html += '<label>Photo (optionnelle):</label><br>';
  html += '<input type="file" accept="image/*" capture="environment" id="input-photo" onchange="handleProductionPhotoSelect(event)">';
  html += '<span id="photo-status"></span>';
  html += '</div>';

  html += '<div class="form-row">';
  html += '<textarea id="input-note" placeholder="Qu\'est-ce que cette production démontre?" rows="3" maxlength="500"></textarea>';
  html += '</div>';

  html += '<div class="form-row">';
  html += '<label>Niveau interne (facultatif, jamais montré aux parents):</label><br>';
  html += '<label><input type="radio" name="input-level" value=""> Pas de niveau</label> ';
  html += '<label><input type="radio" name="input-level" value="emergent"> Émergent</label> ';
  html += '<label><input type="radio" name="input-level" value="developing"> En développement</label> ';
  html += '<label><input type="radio" name="input-level" value="confirmed"> Confirmé</label>';
  html += '</div>';

  html += '<button onclick="saveProductionEntry()">Enregistrer et suivant</button> ';
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
    if (radios[i].checked) return radios[i].value || null;
  }
  return null;
}

function saveProductionEntry() {
  var student = productionSession.studentList[productionSession.currentIndex];
  var noteInput = document.getElementById('input-note');
  var note = noteInput ? noteInput.value.trim() : '';
  var level = getSelectedProductionLevel();
  var photoBlobs = productionSession.currentPhotoFile ? [productionSession.currentPhotoFile] : [];

  addProduction({
    studentCode: student.code,
    domain: productionSession.domain,
    note: note,
    level: level,
    activityTag: productionSession.activityTag,
    photoBlobs: photoBlobs
  }).then(function() {
    productionSession.savedCount++;
    advanceProductionSession();
  }).catch(function(err) {
    alert('Erreur lors de l\'enregistrement. Veuillez réessayer.');
    console.error(err);
  });
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
  html += '<div id="production-summary">';
  html += '<h3>Séance terminée</h3>';
  html += '<p>Activité: <strong>' + productionSession.activityTag + '</strong></p>';
  html += '<p>' + productionSession.savedCount + ' entrée(s) enregistrée(s).</p>';
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
  renderProductions();
}
