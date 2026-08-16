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
async function addProduction({ studentCode, domain, note, level, activityTag, photoBlobs, linkType, hhCategory, subject, strand, achievementCategory, grade }) {
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
    linkType: linkType || null,
    hhCategory: hhCategory || null,
    subject: subject || null,
    strand: strand || null,
    achievementCategory: achievementCategory || null,
    grade: grade || null,
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
  subject: null,
  strand: null,
  achievementCategory: null,
  studentList: [],   // active students only, snapshot at session start
  currentIndex: 0,
  currentPhotoFile: null,  // File object from the camera input, or null
  currentPhotoPreviewUrl: null,
  savedCount: 0,
  entryMap: {}        // studentCode -> {id, note, level, grade, photoIds} for THIS session
};
var productionViewMode = 'setup'; // 'setup' | 'history'

var PHOTO_MAX_DIMENSION = 600;
var PHOTO_JPEG_QUALITY = 0.5;

function compressPhotoBlob(blob, maxDim, quality) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() {
      var w = img.width;
      var h = img.height;
      if (w > h && w > maxDim) {
        h = Math.round(h * (maxDim / w));
        w = maxDim;
      } else if (h >= w && h > maxDim) {
        w = Math.round(w * (maxDim / h));
        h = maxDim;
      }
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(img.src);
      canvas.toBlob(function(compressedBlob) {
        if (compressedBlob) {
          resolve(compressedBlob);
        } else {
          reject(new Error('toBlob a échoué'));
        }
      }, 'image/jpeg', quality);
    };
    img.onerror = function() {
      reject(new Error('Impossible de charger l\'image pour compression'));
    };
    img.src = URL.createObjectURL(blob);
  });
}

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

var productionCaptureMode = 'single'; // 'single' | 'batch'

function setProductionCaptureMode(mode) {
  productionCaptureMode = mode;
  renderProductions();
}
var productionSingleCapture = {
  photoFile: null,
  photoPreviewUrl: null
};

function renderProductionSingleFormHtml() {
  productionSingleCapture.photoFile = null;
  productionSingleCapture.photoPreviewUrl = null;

  var roster = getRoster().filter(function(s) { return s.actif; });

  if (roster.length === 0) {
    return '<p><em>Aucun élève actif dans la liste de classe.</em></p>';
  }

  var html = '<div class="form-row">';
  html += '<label>Élève</label>';
  html += '<select id="prod-single-student" onchange="handleProductionSingleStudentChange()">';
  html += '<option value="">-- Sélectionner un élève --</option>';
  roster.forEach(function(s) {
    html += '<option value="' + s.code + '">' + displayName(s) + '</option>';
  });
  html += '</select>';
  html += '</div>';

  html += '<div id="prod-single-fields"><p><em>Sélectionnez un élève pour afficher les champs.</em></p></div>';

  return html;
}

function handleProductionSingleStudentChange() {
  var select = document.getElementById('prod-single-student');
  var studentCode = select ? select.value : '';
  var fieldsArea = document.getElementById('prod-single-fields');
  if (!fieldsArea) return;

  productionSingleCapture.photoFile = null;
  productionSingleCapture.photoPreviewUrl = null;

  if (!studentCode) {
    fieldsArea.innerHTML = '<p><em>Sélectionnez un élève pour afficher les champs.</em></p>';
    return;
  }

  if (isGrade1to6(studentCode)) {
    fieldsArea.innerHTML = renderProductionSingleG16FieldsHtml(studentCode);
  } else {
    fieldsArea.innerHTML = renderProductionSingleCaptureFieldsHtml(studentCode);
  }
}

function renderProductionSingleCaptureFieldsHtml(studentCode) {
  var html = getPeiReminderHtml(studentCode);

  html += '<div class="form-row">';
  html += '<label>Domaine</label>';
  html += '<div class="domaine-btns">';
  html += '<button class="domaine-btn active" id="prod-single-domaine-A" onclick="setProductionSingleDomaine(\'A\')"><strong>A</strong> Langue & maths</button>';
  html += '<button class="domaine-btn" id="prod-single-domaine-B" onclick="setProductionSingleDomaine(\'B\')"><strong>B</strong> Résolution & innovation</button>';
  html += '<button class="domaine-btn" id="prod-single-domaine-C" onclick="setProductionSingleDomaine(\'C\')"><strong>C</strong> Autorégulation & bien-être</button>';
  html += '<button class="domaine-btn" id="prod-single-domaine-D" onclick="setProductionSingleDomaine(\'D\')"><strong>D</strong> Appartenance & contribution</button>';
  html += '</div>';
  html += '</div>';
  html += '<input type="hidden" id="prod-single-domaine" value="A">';

  html += '<div class="form-row">';
  html += '<label>Activité (facultatif)</label>';
  html += '<input type="text" id="prod-single-activity" placeholder="ex: Cercle du matin" maxlength="80">';
  html += '</div>';

  html += '<div class="form-row">';
  html += '<label>Note</label>';
  html += '<textarea id="prod-single-note" rows="3" placeholder="Qu\'est-ce que cette production démontre?"></textarea>';
  html += '</div>';

  html += '<div class="form-row">';
  html += '<label>Photo (optionnelle):</label><br>';
  html += '<div id="prod-single-photo-area">' + renderProductionSinglePhotoAreaHtml() + '</div>';
  html += '<span id="prod-single-photo-status"></span>';
  html += '</div>';

  html += '<div class="form-row">';
  html += '<label>Niveau interne (facultatif, jamais montré aux parents):</label><br>';
  html += '<label><input type="radio" name="prod-single-level" value="" checked> Pas de niveau</label> ';
  html += '<label><input type="radio" name="prod-single-level" value="emergent"> Émergent</label> ';
  html += '<label><input type="radio" name="prod-single-level" value="developing"> En développement</label> ';
  html += '<label><input type="radio" name="prod-single-level" value="confirmed"> Confirmé</label>';
  html += '</div>';

  html += '<button onclick="saveProductionSingleEntry(\'' + studentCode + '\')">Enregistrer</button>';
  html += '<span id="prod-single-save-status"></span>';

  return html;
}

function setProductionSingleDomaine(d) {
  document.getElementById('prod-single-domaine').value = d;
  ['A', 'B', 'C', 'D'].forEach(function(x) {
    document.getElementById('prod-single-domaine-' + x).className = 'domaine-btn' + (x === d ? ' active' : '');
  });
}

function renderProductionSinglePhotoAreaHtml() {
  if (productionSingleCapture.photoPreviewUrl) {
    var html = '<div class="photo-preview-box">';
    html += '<img src="' + productionSingleCapture.photoPreviewUrl + '" alt="Aperçu de la photo" class="photo-preview-img">';
    html += '<br><button type="button" onclick="retakeProductionSinglePhoto()">Reprendre la photo</button>';
    html += '</div>';
    return html;
  }
  return '<input type="file" accept="image/*" id="prod-single-photo-input" onchange="handleProductionSinglePhotoSelect(event)">';
}

async function handleProductionSinglePhotoSelect(event) {
  var file = event.target.files[0];
  var status = document.getElementById('prod-single-photo-status');

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
    productionSingleCapture.photoFile = compressedBlob;
    productionSingleCapture.photoPreviewUrl = URL.createObjectURL(compressedBlob);
  } catch (err) {
    console.error('Erreur de compression de la photo:', err);
    productionSingleCapture.photoFile = workingBlob;
    productionSingleCapture.photoPreviewUrl = URL.createObjectURL(workingBlob);
  }

  if (status) status.textContent = '';
  var photoArea = document.getElementById('prod-single-photo-area');
  if (photoArea) photoArea.innerHTML = renderProductionSinglePhotoAreaHtml();
}

function retakeProductionSinglePhoto() {
  if (productionSingleCapture.photoPreviewUrl) {
    URL.revokeObjectURL(productionSingleCapture.photoPreviewUrl);
  }
  productionSingleCapture.photoFile = null;
  productionSingleCapture.photoPreviewUrl = null;

  var photoArea = document.getElementById('prod-single-photo-area');
  if (photoArea) photoArea.innerHTML = renderProductionSinglePhotoAreaHtml();
}

async function saveProductionSingleEntry(studentCode) {
  var domaineInput = document.getElementById('prod-single-domaine');
  var activityInput = document.getElementById('prod-single-activity');
  var noteInput = document.getElementById('prod-single-note');
  var levelRadios = document.getElementsByName('prod-single-level');

  var domaine = domaineInput ? domaineInput.value : 'A';
  var activityTag = activityInput ? activityInput.value.trim() : '';
  var note = noteInput ? noteInput.value.trim() : '';
  var level = '';
  for (var i = 0; i < levelRadios.length; i++) {
    if (levelRadios[i].checked) level = levelRadios[i].value;
  }

  var statusEl = document.getElementById('prod-single-save-status');
  if (statusEl) statusEl.textContent = ' Enregistrement...';

  try {
    await addProduction({
      studentCode: studentCode,
      domain: domaine,
      note: note,
      level: level || null,
      activityTag: activityTag,
      photoBlobs: productionSingleCapture.photoFile ? [productionSingleCapture.photoFile] : []
    });

    productionSingleCapture.photoFile = null;
    productionSingleCapture.photoPreviewUrl = null;

    var studentSelect = document.getElementById('prod-single-student');
    if (studentSelect) studentSelect.value = '';
    var fieldsArea = document.getElementById('prod-single-fields');
    if (fieldsArea) fieldsArea.innerHTML = '<p><em>Sélectionnez un élève pour afficher les champs.</em></p>';

    loadAndRenderRecentProductions();

    if (statusEl) {
      statusEl.textContent = ' ✓ Enregistré';
      setTimeout(function() { statusEl.textContent = ''; }, 2000);
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = '';
    alert('Erreur lors de l\'enregistrement. Veuillez réessayer.');
    console.error(err);
  }
}
function renderProductionSetupScreen(container) {
  var storedSession = getStoredProductionSession();

  var html = '<h2>Productions</h2>';

  if (storedSession) {
    html += '<div class="production-resume-banner">';
    html += '<p><strong>Séance interrompue trouvée:</strong> ' + storedSession.activityTag;
    html += ' (élève ' + (storedSession.currentIndex + 1) + ' sur ' + storedSession.studentList.length + ')</p>';
    html += '<button onclick="resumeProductionSession()">Reprendre la séance</button> ';
    html += '<button onclick="discardStoredProductionSession()">Ignorer</button>';
    html += '</div>';
  }

  html += '<div class="obs-type-toggle">';
  html += '<button class="type-btn' + (productionCaptureMode === 'single' ? ' active' : '') + '" onclick="setProductionCaptureMode(\'single\')">Un élève</button>';
  html += '<button class="type-btn' + (productionCaptureMode === 'batch' ? ' active' : '') + '" onclick="setProductionCaptureMode(\'batch\')">Toute la classe</button>';
  html += '</div>';

  if (productionCaptureMode === 'batch') {
    html += '<div id="production-setup">';
    html += '<h3>Nouvelle séance (toute la classe)</h3>';
    html += '<div id="production-setup-dynamic-fields">';
    html += renderProductionSetupFieldsHtml();
    html += '</div>';
    html += '<button onclick="startProductionSession()">Commencer la séance</button> ';
    html += '<button onclick="switchToProductionHistory()">Voir l\'historique par élève</button> ';
    html += '<button onclick="switchToProductionGrid()">Suivi par activité</button>';
    html += '</div>';
  } else {
    html += '<div id="production-setup">';
    html += '<h3>Nouvelle entrée (un élève)</h3>';
    html += renderProductionSingleFormHtml();
    html += '<button onclick="switchToProductionHistory()">Voir l\'historique par élève</button> ';
    html += '<button onclick="switchToProductionGrid()">Suivi par activité</button>';
    html += '</div>';
  }
  html += '<div id="production-recent-list"><p><em>Chargement...</em></p></div>';

  html += '<div class="data-management-section">';
  html += '<h3>Gestion des données</h3>';
  html += '<div class="form-row">';
  html += '<label for="clear-student-select">Effacer les données d\'un élève: </label>';
  html += '<select id="clear-student-select">';
  html += '<option value="">-- Sélectionner --</option>';
  getRoster().filter(function(s) { return s.actif; }).forEach(function(s) {
    html += '<option value="' + s.code + '">' + displayName(s) + '</option>';
  });
  html += '</select>';
  html += ' <button class="btn-delete" onclick="handleClearStudentFromDropdown(\'clear-student-select\')">Effacer</button>';
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;
  loadAndRenderRecentProductions();
}

function startProductionSession() {
  var grade1to6Mode = isProductionSessionGrade1to6();
  var tag = '';
  var domain = 'A';
  var subject = null, strand = null, achievementCategory = null;

  if (grade1to6Mode) {
    domain = '';
    var subjectSelect = document.getElementById('input-subject');
    var strandSelect = document.getElementById('input-strand');
    var achievementSelect = document.getElementById('input-achievement');
    var nameSelect = document.getElementById('input-activity-tag-select');
    var nameInput = document.getElementById('input-activity-tag');

    subject = subjectSelect ? subjectSelect.value : '';
    strand = strandSelect ? strandSelect.value : '';
    achievementCategory = achievementSelect ? achievementSelect.value : '';
    tag = nameSelect ? nameSelect.value : (nameInput ? nameInput.value.trim() : '');
  } else {
    var tagInput = document.getElementById('input-activity-tag');
    var domainInput = document.getElementById('input-domain');
    tag = tagInput.value.trim();
    domain = domainInput.value;
  }

  if (!tag) {
    alert('Veuillez nommer l\'activité/évaluation avant de commencer.');
    return;
  }

  var roster = getRoster();
  var activeStudents = roster.filter(function(s) { return s.actif; });

  // A Productions session targets one specific activity/évaluation, which in
  // practice is designed for one grade group — even when the strand label
  // itself (e.g. "B - Nombres") happens to be shared across grades. So for
  // any grades 1-6 session, only loop through students in the selected
  // année. For a single-grade class this is a no-op (everyone already
  // matches), it only changes behaviour for split-grade classes.
  var anneeInputForSession = document.getElementById('production-input-annee');
  var sessionAnnee = anneeInputForSession ? anneeInputForSession.value : null;

  if (grade1to6Mode && sessionAnnee) {
    activeStudents = activeStudents.filter(function(s) { return s.annee === sessionAnnee; });
  }

  if (activeStudents.length === 0) {
    alert('Aucun élève actif correspondant à cette année (' + (sessionAnnee || '?') + ') dans la liste de classe.');
    return;
  }

  productionSession.active = true;
  productionSession.activityTag = tag;
  productionSession.domain = domain;
  productionSession.subject = subject;
  productionSession.strand = strand;
  productionSession.achievementCategory = achievementCategory;
  productionSession.studentList = activeStudents;
  productionSession.currentIndex = 0;
  productionSession.currentPhotoFile = null;
  productionSession.currentPhotoPreviewUrl = null;
  productionSession.savedCount = 0;
  productionSession.entryMap = {};

  saveProductionSessionToStorage();
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
  html += '<p class="production-activity-label">Activité/Évaluation: <strong>' + productionSession.activityTag + '</strong>';
  if (productionSession.subject) {
    html += ' &nbsp; | &nbsp; Matière: <strong>' + productionSession.subject + '</strong>';
    html += ' &nbsp; | &nbsp; ' + productionSession.strand;
  } else {
    html += ' &nbsp; | &nbsp; Domaine: <strong>' + productionSession.domain + '</strong>';
  }
  html += ' &nbsp; | &nbsp; Élève ' + (idx + 1) + ' sur ' + total + '</p>';

  html += renderProductionChipStrip();

  html += '<div id="production-capture">';
  html += '<h3>' + displayName(student) + '</h3>';
  html += getPeiReminderHtml(student.code);

  if (existingEntry) {
    html += '<div class="production-existing-box">';
    html += '<p><strong>Déjà enregistré pour cette activité:</strong></p>';
    html += '<p>Note existante: ' + (existingEntry.note || '(vide)') + '</p>';
    if (productionSession.subject) {
      html += '<p>Niveau actuel: ' + (existingEntry.grade || 'Aucun') + '</p>';
    } else {
      html += '<p>Niveau actuel: ' + getLevelLabel(existingEntry.level) + '</p>';
    }
    html += '<p>Photos existantes: ' + existingEntry.photoIds.length + '</p>';
    html += '<p><em>Ce que vous ajoutez ci-dessous s\'ajoutera à cette entrée.</em></p>';
    html += '</div>';
  }

  html += '<div class="form-row">';
  html += '<label>' + (existingEntry ? 'Ajouter une photo' : 'Photo') + ' (optionnelle):</label><br>';
  html += '<div id="production-photo-area">' + renderProductionPhotoAreaHtml() + '</div>';
  html += '<span id="photo-status"></span>';
  html += '</div>';

  html += '<div class="form-row">';
  html += '<textarea id="input-note" placeholder="' + (existingEntry ? 'Ajouter à la note...' : 'Qu\'est-ce que cette production démontre?') + '" rows="3" maxlength="500"></textarea>';
  html += '</div>';

  html += '<div class="form-row">';
  if (productionSession.subject) {
    html += '<label>Niveau (officiel):</label><br>';
    if (existingEntry) {
      html += '<label><input type="radio" name="input-level" value="__keep__" checked> Ne pas changer</label> ';
      html += '<label><input type="radio" name="input-level" value=""> Aucun niveau</label> ';
    } else {
      html += '<label><input type="radio" name="input-level" value="" checked> Pas de niveau</label> ';
    }
    NIVEAU_OPTIONS.forEach(function(niveau) {
      html += '<label><input type="radio" name="input-level" value="' + niveau + '"> ' + niveau + '</label> ';
    });
  } else {
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
  }
  html += '</div>';

  html += '<button onclick="saveProductionEntry()">' + (existingEntry ? 'Ajouter et suivant' : 'Enregistrer et suivant') + '</button> ';
  html += '<button onclick="skipProductionEntry()">Passer cet élève</button> ';
  html += '<button onclick="endProductionSession()">Terminer la séance</button>';
  html += '</div>';

  container.innerHTML = html;
}

function renderProductionPhotoAreaHtml() {
  if (productionSession.currentPhotoPreviewUrl) {
    var html = '<div class="photo-preview-box">';
    html += '<img src="' + productionSession.currentPhotoPreviewUrl + '" alt="Aperçu de la photo" class="photo-preview-img">';
    html += '<br><button type="button" onclick="retakeProductionPhoto()">Reprendre la photo</button>';
    html += '</div>';
    return html;
  }
  return '<input type="file" accept="image/*" id="input-photo" onchange="handleProductionPhotoSelect(event)">';
}

async function handleProductionPhotoSelect(event) {
  var file = event.target.files[0];
  var status = document.getElementById('photo-status');

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
    productionSession.currentPhotoFile = compressedBlob;
    productionSession.currentPhotoPreviewUrl = URL.createObjectURL(compressedBlob);
  } catch (err) {
    console.error('Erreur de compression de la photo:', err);
    productionSession.currentPhotoFile = workingBlob;
    productionSession.currentPhotoPreviewUrl = URL.createObjectURL(workingBlob);
  }

  if (status) status.textContent = '';
  var photoArea = document.getElementById('production-photo-area');
  if (photoArea) photoArea.innerHTML = renderProductionPhotoAreaHtml();
}

function retakeProductionPhoto() {
  if (productionSession.currentPhotoPreviewUrl) {
    URL.revokeObjectURL(productionSession.currentPhotoPreviewUrl);
  }
  productionSession.currentPhotoFile = null;
  productionSession.currentPhotoPreviewUrl = null;

  var photoArea = document.getElementById('production-photo-area');
  if (photoArea) photoArea.innerHTML = renderProductionPhotoAreaHtml();
}

function retakeProductionPhoto() {
  if (productionSession.currentPhotoPreviewUrl) {
    URL.revokeObjectURL(productionSession.currentPhotoPreviewUrl);
  }
  productionSession.currentPhotoFile = null;
  productionSession.currentPhotoPreviewUrl = null;
  renderProductions();
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
  var isG16 = !!productionSession.subject;

  if (existing) {
    var mergedNote = newNoteText ? (existing.note ? existing.note + ' | ' + newNoteText : newNoteText) : existing.note;
    var changes = { note: mergedNote };

    if (isG16) {
      changes.grade = (levelSelection === '__keep__') ? existing.grade : (levelSelection || null);
    } else {
      changes.level = (levelSelection === '__keep__') ? existing.level : (levelSelection || null);
    }

    var afterPhoto;
    if (newPhotoFile) {
      afterPhoto = saveProductionPhoto(existing.id, newPhotoFile).then(function(newPhotoId) {
        return existing.photoIds.concat([newPhotoId]);
      });
    } else {
      afterPhoto = Promise.resolve(existing.photoIds);
    }

    afterPhoto.then(function(mergedPhotoIds) {
      changes.photoIds = mergedPhotoIds;
      return updateProduction(existing.id, changes).then(function() {
        productionSession.entryMap[student.code] = {
          id: existing.id,
          note: mergedNote,
          level: isG16 ? existing.level : changes.level,
          grade: isG16 ? changes.grade : existing.grade,
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
      level: isG16 ? null : levelToSave,
      grade: isG16 ? levelToSave : null,
      activityTag: productionSession.activityTag,
      subject: productionSession.subject,
      strand: productionSession.strand,
      achievementCategory: productionSession.achievementCategory,
      photoBlobs: newPhotoFile ? [newPhotoFile] : []
    }).then(function(record) {
      productionSession.savedCount++;
      productionSession.entryMap[student.code] = {
        id: record.id,
        note: record.note,
        level: record.level,
        grade: record.grade,
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
  productionSession.currentPhotoPreviewUrl = null;
  saveProductionSessionToStorage();
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
  productionSession.subject = null;
  productionSession.strand = null;
  productionSession.achievementCategory = null;
  productionSession.studentList = [];
  productionSession.currentIndex = 0;
  productionSession.currentPhotoFile = null;
  productionSession.currentPhotoPreviewUrl = null;
  productionSession.savedCount = 0;
  productionSession.entryMap = {};
  clearStoredProductionSession();
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
  return d.toLocaleDateString('fr-CA');
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

  if (productionHistoryPreselect) {
    var pre = productionHistoryPreselect;
    productionHistoryPreselect = null;
    var selectEl = document.getElementById('history-student-select');
    if (selectEl) selectEl.value = pre.studentCode;
    loadAndRenderStudentHistory(pre.studentCode).then(function() {
      scrollToAndHighlightEntry(pre.entryId);
    });
  }
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
    if (entry.subject) {
      html += '<p>' + entry.subject + ' — ' + entry.strand + '</p>';
      if (entry.achievementCategory) {
        html += '<p><em>Compétence: ' + entry.achievementCategory + '</em></p>';
      }
    } else {
      html += '<p>' + getDomainLabel(entry.domain) + '</p>';
    }
    if (entry.activityTag) {
      html += '<p><em>' + entry.activityTag + '</em></p>';
    }
    if (entry.note) {
      html += '<p>' + entry.note + '</p>';
    }
    if (entry.subject) {
      html += '<p>Niveau: ' + (entry.grade || 'Aucun') + '</p>';
    } else {
      html += '<p>Niveau interne: ' + getLevelLabel(entry.level) + '</p>';
    }

    if (entry.photoIds && entry.photoIds.length > 0) {
      html += '<div class="production-photo-container" id="photo-container-' + entry.id + '"><em>Chargement de la photo...</em></div>';
    }

    html += '<div class="production-add-note-row">';
    html += '<input type="text" id="add-note-' + entry.id + '" placeholder="Ajouter une note...">';
    html += ' <button onclick="addNoteToHistoryEntry(\'' + entry.id + '\', \'' + code + '\')">Ajouter</button>';
    html += '</div>';

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
  photoContainer.innerHTML = '<img src="' + objectUrl + '" alt="Photo de production" style="max-width:100px; max-height:100px; object-fit:cover; border-radius:4px; cursor:pointer;" onclick="window.open(\'' + objectUrl + '\', \'_blank\')">';
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
  html += '<h3>Suivi par activité</h3>';
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

  var lastDateByStudent = {};
  entries.forEach(function(e) {
    if (!lastDateByStudent[e.studentCode] || e.createdAt > lastDateByStudent[e.studentCode]) {
      lastDateByStudent[e.studentCode] = e.createdAt;
    }
  });

  var coveredCount = activeStudents.filter(function(s) { return lastDateByStudent[s.code]; }).length;

  var html = '<p><strong>' + coveredCount + ' sur ' + activeStudents.length + '</strong> élèves complétés.</p>';
  html += '<table class="production-grid-table">';
  html += '<tr><th>Élève</th><th></th><th>Date</th></tr>';

  activeStudents.forEach(function(s) {
    var lastDate = lastDateByStudent[s.code];
    html += '<tr>';
    html += '<td>' + displayName(s) + '</td>';
    html += '<td>' + (lastDate ? '✓' : '') + '</td>';
    html += '<td>' + (lastDate ? formatProductionDate(lastDate) : '') + '</td>';
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
  productionSession.currentPhotoPreviewUrl = null;
  saveProductionSessionToStorage();
  renderProductions();
}
// ============================================================
// productions.js — MonProf.ai
// ADDITION: Recent entries list on the main Productions screen
// ============================================================
// APPEND this to the END of your productions.js file.
// Also make the 1 edit described separately (setup screen).
//
// Depends on:
//   - getAllProductions(), getProductionPhoto() — Part 1
//   - formatProductionDate() — Part 3
//   - getRoster(), displayName() — roster.js
// ============================================================

var PRODUCTION_RECENT_LIST_LIMIT = 15;

async function loadAndRenderRecentProductions() {
  var container = document.getElementById('production-recent-list');
  if (!container) return;

  var all = await getAllProductions();
  if (!container) return; // guard again in case user navigated away during the await

  if (all.length === 0) {
    container.innerHTML = '<p><em>Aucune entrée pour le moment.</em></p>';
    return;
  }

  var roster = getRoster();
  all = all.slice().sort(function(a, b) { return b.createdAt.localeCompare(a.createdAt); });
  var recent = all.slice(0, PRODUCTION_RECENT_LIST_LIMIT);

 var html = '<h3>Entrées récentes (' + all.length + ')</h3>';
  html += '<table class="production-recent-table">';
  html += '<tr><th>Date</th><th>Élève</th><th>Dom.</th><th>Activité</th><th>Note</th><th>Photo</th><th></th></tr>';

  recent.forEach(function(p) {
    var student = roster.find(function(s) { return s.code === p.studentCode; });
    var name = student ? displayName(student) : p.studentCode;

    html += '<tr>';
    html += '<td>' + formatProductionDate(p.createdAt) + '</td>';
    html += '<td>' + name + '</td>';
    html += '<td><strong>' + (p.subject || p.domain) + '</strong></td>';
    html += '<td>' + (p.activityTag || '') + '</td>';
    html += '<td>' + (p.note || '') + '</td>';
    if (p.photoIds && p.photoIds.length > 0) {
      html += '<td><span id="recent-photo-' + p.id + '"><em>...</em></span></td>';
    } else {
      html += '<td></td>';
    }
    html += '<td><button onclick="jumpToProductionEntryFromRecent(\'' + p.studentCode + '\', \'' + p.id + '\')">Ajouter une note</button></td>';
    html += '</tr>';
  });
  html += '</table>';
  container.innerHTML = html;

  recent.forEach(function(p) {
    if (p.photoIds && p.photoIds.length > 0) {
      loadRecentProductionThumbnail(p.id, p.photoIds[0]);
    }
  });
}

async function loadRecentProductionThumbnail(productionId, photoId) {
  var span = document.getElementById('recent-photo-' + productionId);
  if (!span) return;

  var mediaRecord = await getProductionPhoto(photoId);
  if (!span || !mediaRecord || !mediaRecord.blob) return;

  var objectUrl = URL.createObjectURL(mediaRecord.blob);
  span.innerHTML = '<img src="' + objectUrl + '" alt="Photo" style="max-width:50px; max-height:50px; object-fit:cover; border-radius:4px; cursor:pointer;" onclick="window.open(\'' + objectUrl + '\', \'_blank\')">';
}
// ============================================================
// productions.js — MonProf.ai
// PART 7: Add notes to existing entries from the History view
// ============================================================
// APPEND this to the END of your productions.js file.
// Also make the 1 edit described separately (History loop).
//
// Depends on:
//   - getProductionsByStudent(), updateProduction() — Part 1
//   - loadAndRenderStudentHistory() — Part 3
// ============================================================

async function addNoteToHistoryEntry(productionId, studentCode) {
  var input = document.getElementById('add-note-' + productionId);
  var newText = input ? input.value.trim() : '';
  if (!newText) return;

  var entries = await getProductionsByStudent(studentCode);
  var entry = entries.find(function(e) { return e.id === productionId; });
  if (!entry) return;

  var mergedNote = entry.note ? (entry.note + ' | ' + newText) : newText;

  await updateProduction(productionId, { note: mergedNote });

  loadAndRenderStudentHistory(studentCode);
}
// ============================================================
// productions.js — MonProf.ai
// ADDITION: Jump from recent-entries table to add-note in History
// ============================================================
// APPEND this to the END of your productions.js file.
// Also make Edits 1-2 described separately.
// ============================================================

var productionHistoryPreselect = null; // {studentCode, entryId} or null

function jumpToProductionEntryFromRecent(studentCode, entryId) {
  productionHistoryPreselect = { studentCode: studentCode, entryId: entryId };
  switchToProductionHistory();
}

function scrollToAndHighlightEntry(entryId) {
  var input = document.getElementById('add-note-' + entryId);
  if (!input) return;

  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  input.focus();

  var row = input.closest('tr');
  if (row) {
    row.classList.add('production-entry-highlight');
    setTimeout(function() {
      row.classList.remove('production-entry-highlight');
    }, 2000);
  }
}
// ============================================================
// productions.js — MonProf.ai
// PART 6: Session persistence (survives a closed tab/app)
// ============================================================
// APPEND this to the END of your productions.js file.
// Also make Edits 1-5 described separately.
// ============================================================

var PRODUCTION_SESSION_STORAGE_KEY = 'monprofai_production_session_backup';

function saveProductionSessionToStorage() {
  if (!productionSession.active) return;

  var toStore = {
    active: productionSession.active,
    activityTag: productionSession.activityTag,
    domain: productionSession.domain,
    subject: productionSession.subject,
    strand: productionSession.strand,
    achievementCategory: productionSession.achievementCategory,
    studentList: productionSession.studentList,
    currentIndex: productionSession.currentIndex,
    savedCount: productionSession.savedCount,
    entryMap: productionSession.entryMap
  };

  try {
    localStorage.setItem(PRODUCTION_SESSION_STORAGE_KEY, JSON.stringify(toStore));
  } catch (e) {
    console.error('Impossible de sauvegarder la séance en cours:', e);
  }
}

function getStoredProductionSession() {
  try {
    var raw = localStorage.getItem(PRODUCTION_SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearStoredProductionSession() {
  localStorage.removeItem(PRODUCTION_SESSION_STORAGE_KEY);
}

function resumeProductionSession() {
  var stored = getStoredProductionSession();
  if (!stored) return;

  productionSession.active = true;
  productionSession.activityTag = stored.activityTag;
  productionSession.domain = stored.domain;
  productionSession.subject = stored.subject || null;
  productionSession.strand = stored.strand || null;
  productionSession.achievementCategory = stored.achievementCategory || null;
  productionSession.studentList = stored.studentList;
  productionSession.currentIndex = stored.currentIndex;
  productionSession.savedCount = stored.savedCount;
  productionSession.entryMap = stored.entryMap;
  productionSession.currentPhotoFile = null;
  productionSession.currentPhotoPreviewUrl = null;

  renderProductions();
}

function discardStoredProductionSession() {
  clearStoredProductionSession();
  renderProductions();
}
// ============================================================
// GRADES 1-6 — PART G3: Productions setup fields
// ============================================================
// APPEND this to the END of productions.js.
// Also make Edits 1-10 described separately.
//
// Depends on:
//   - isGrade1to6(), GRADES_1_6_SUBJECTS, SUBJECT_STRANDS,
//     ACHIEVEMENT_CATEGORIES, DOMAINE_B_FRANCAIS_CONTINUUM,
//     NIVEAU_OPTIONS — roster.js (Part G1)
// ============================================================

function isProductionSessionGrade1to6() {
  var roster = getRoster().filter(function(s) { return s.actif; });
  return roster.some(function(s) { return isGrade1to6(s.code); });
}

function renderProductionSetupFieldsHtml() {
  if (!isProductionSessionGrade1to6()) {
    var html = '<div class="form-row">';
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
    return html;
  }

  var grades = getDistinctGrades1to6Active();
  var defaultAnnee = grades.length > 0 ? grades[0] : getSessionAnnee();

  var html2 = '';
  if (grades.length > 1) {
    html2 += buildProductionAnneeSelectorHtml(grades, defaultAnnee);
  }
  html2 += '<div id="production-setup-subject-fields">';
  html2 += buildProductionExpectationSetupHtml(GRADES_1_6_SUBJECTS[0], '', defaultAnnee);
  html2 += '</div>';
  return html2;
}

function buildProductionAnneeSelectorHtml(grades, selectedAnnee) {
  var html = '<div class="form-row">';
  html += '<label>Cette séance porte sur quelle année? (classe à niveaux multiples détectée)</label>';
  html += '<select id="input-production-annee-selector" onchange="handleProductionSetupAnneeChange()">';
  grades.forEach(function(g) {
    var labelText = ANNEE_LABELS[g] || g;
    html += '<option value="' + g + '"' + (g === selectedAnnee ? ' selected' : '') + '>' + labelText + '</option>';
  });
  html += '</select>';
  html += '</div>';
  return html;
}

function handleProductionSetupAnneeChange() {
  var annee = document.getElementById('input-production-annee-selector').value;
  var subjectSelect = document.getElementById('input-subject');
  var currentSubject = subjectSelect ? subjectSelect.value : GRADES_1_6_SUBJECTS[0];
  var wrapper = document.getElementById('production-setup-subject-fields');
  if (wrapper) wrapper.innerHTML = buildProductionExpectationSetupHtml(currentSubject, '', annee);
}

function buildProductionExpectationSetupHtml(subject, strand, annee) {
  var strands = getStrandsForSubject(subject, annee);
  if (!strand) strand = strands[0] || '';

  var html = '<input type="hidden" id="production-input-annee" value="' + (annee || '') + '">';

  html += '<div class="form-row">';
  html += '<label>Matière: </label>';
  html += '<select id="input-subject" onchange="handleProductionSetupSubjectChange()">';
  GRADES_1_6_SUBJECTS.forEach(function(subj) {
    html += '<option value="' + subj + '"' + (subj === subject ? ' selected' : '') + '>' + subj + '</option>';
  });
  html += '</select>';
  html += '</div>';

  html += '<div class="form-row">';
  html += '<label>Domaine/Volet: </label>';
  html += '<select id="input-strand" onchange="handleProductionSetupStrandChange()">';
  strands.forEach(function(s) {
    html += '<option value="' + s + '"' + (s === strand ? ' selected' : '') + '>' + s + '</option>';
  });
  html += '</select>';
  html += '</div>';

  html += '<div class="form-row" id="production-setup-name-row">';
  html += buildProductionSetupNameFieldHtml(subject, strand);
  html += '</div>';

  html += '<div class="form-row">';
  html += '<label>Compétence (grille d\'évaluation): </label>';
  html += '<select id="input-achievement">';
  ACHIEVEMENT_CATEGORIES.forEach(function(cat) {
    html += '<option value="' + cat + '">' + cat + '</option>';
  });
  html += '</select>';
  html += '</div>';

  return html;
}

function buildProductionSetupNameFieldHtml(subject, strand) {
  var isDomaineBFrancais = (subject === 'Français' && strand === 'B - Notions fondamentales de la langue');

  if (isDomaineBFrancais) {
    var html = '<label>Notion fondamentale: </label>';
    html += '<select id="input-activity-tag-select">';
    DOMAINE_B_FRANCAIS_CONTINUUM.forEach(function(item) {
      html += '<option value="' + item + '">' + item + '</option>';
    });
    html += '</select>';
    return html;
  }

  return '<label>Nom de l\'évaluation: </label><input type="text" id="input-activity-tag" placeholder="ex: Test - fractions" maxlength="80">';
}

function handleProductionSetupSubjectChange() {
  var subject = document.getElementById('input-subject').value;
  var anneeInput = document.getElementById('production-input-annee');
  var annee = anneeInput ? anneeInput.value : null;
  var wrapper = document.getElementById('production-setup-subject-fields');
  if (wrapper) wrapper.innerHTML = buildProductionExpectationSetupHtml(subject, '', annee);
}
function handleProductionSetupStrandChange() {
  var subject = document.getElementById('input-subject').value;
  var strand = document.getElementById('input-strand').value;
  var row = document.getElementById('production-setup-name-row');
  if (row) row.innerHTML = buildProductionSetupNameFieldHtml(subject, strand);
}
function renderProductionSingleG16FieldsHtml(studentCode) {
  var student = getRoster().find(function(s) { return s.code === studentCode; });
  var annee = student ? student.annee : null;

  var html = getPeiReminderHtml(studentCode);

  html += '<input type="hidden" id="prod-single-annee" value="' + (annee || '') + '">';

  html += '<div class="form-row">';
  html += '<label>Matière</label>';
  html += '<select id="prod-single-subject" onchange="handleProductionSingleSubjectChange()">';
  GRADES_1_6_SUBJECTS.forEach(function(subj) {
    html += '<option value="' + subj + '">' + subj + '</option>';
  });
  html += '</select>';
  html += '</div>';

  html += '<div id="prod-single-g16-subject-fields">';
  html += buildProductionSingleG16SubjectFieldsHtml(GRADES_1_6_SUBJECTS[0], '', annee);
  html += '</div>';

  html += '<div class="form-row">';
  html += '<label>Compétence (grille d\'évaluation)</label>';
  html += '<select id="prod-single-achievement">';
  ACHIEVEMENT_CATEGORIES.forEach(function(cat) {
    html += '<option value="' + cat + '">' + cat + '</option>';
  });
  html += '</select>';
  html += '</div>';

  html += '<div class="form-row">';
  html += '<label>Note</label>';
  html += '<textarea id="prod-single-note" rows="3" placeholder="Qu\'est-ce que cette production démontre?"></textarea>';
  html += '</div>';

  html += '<div class="form-row">';
  html += '<label>Photo (optionnelle):</label><br>';
  html += '<div id="prod-single-photo-area">' + renderProductionSinglePhotoAreaHtml() + '</div>';
  html += '<span id="prod-single-photo-status"></span>';
  html += '</div>';

  html += '<div class="form-row">';
  html += '<label>Niveau (officiel):</label><br>';
  html += '<label><input type="radio" name="prod-single-niveau" value="" checked> Aucun niveau</label> ';
  NIVEAU_OPTIONS.forEach(function(n) {
    html += '<label><input type="radio" name="prod-single-niveau" value="' + n + '"> ' + n + '</label> ';
  });
  html += '</div>';

  html += '<button onclick="saveProductionSingleG16Entry(\'' + studentCode + '\')">Enregistrer</button>';
  html += '<span id="prod-single-save-status"></span>';

  return html;
}

function buildProductionSingleG16SubjectFieldsHtml(subject, strand, annee) {
  var strands = getStrandsForSubject(subject, annee);
  if (!strand) strand = strands[0] || '';

  var html = '<div class="form-row">';
  html += '<label>Domaine/Volet</label>';
  html += '<select id="prod-single-strand" onchange="handleProductionSingleStrandChange()">';
  strands.forEach(function(s) {
    html += '<option value="' + s + '"' + (s === strand ? ' selected' : '') + '>' + s + '</option>';
  });
  html += '</select>';
  html += '</div>';

  html += '<div class="form-row" id="prod-single-activity-row">';
  html += renderProductionSingleActivityFieldHtml(subject, strand);
  html += '</div>';

  return html;
}

function renderProductionSingleActivityFieldHtml(subject, strand) {
  var isDomaineBFrancais = (subject === 'Français' && strand === 'B - Notions fondamentales de la langue');

  if (isDomaineBFrancais) {
    var html = '<label>Notion fondamentale</label>';
    html += '<select id="prod-single-activity-select">';
    DOMAINE_B_FRANCAIS_CONTINUUM.forEach(function(item) {
      html += '<option value="' + item + '">' + item + '</option>';
    });
    html += '</select>';
    return html;
  }

  return '<label>Activité (facultatif)</label><input type="text" id="prod-single-activity" placeholder="ex: multiplication, triangles..." maxlength="80">';
}

function handleProductionSingleSubjectChange() {
  var subjectSelect = document.getElementById('prod-single-subject');
  var subject = subjectSelect ? subjectSelect.value : GRADES_1_6_SUBJECTS[0];
  var anneeInput = document.getElementById('prod-single-annee');
  var annee = anneeInput ? anneeInput.value : null;

  var wrapper = document.getElementById('prod-single-g16-subject-fields');
  if (wrapper) wrapper.innerHTML = buildProductionSingleG16SubjectFieldsHtml(subject, '', annee);
}

function handleProductionSingleStrandChange() {
  var subjectSelect = document.getElementById('prod-single-subject');
  var strandSelect = document.getElementById('prod-single-strand');
  var subject = subjectSelect ? subjectSelect.value : GRADES_1_6_SUBJECTS[0];
  var strand = strandSelect ? strandSelect.value : '';

  var row = document.getElementById('prod-single-activity-row');
  if (row) row.innerHTML = renderProductionSingleActivityFieldHtml(subject, strand);
}

async function saveProductionSingleG16Entry(studentCode) {
  var subjectSelect = document.getElementById('prod-single-subject');
  var strandSelect = document.getElementById('prod-single-strand');
  var achievementSelect = document.getElementById('prod-single-achievement');
  var activityInput = document.getElementById('prod-single-activity');
  var activitySelect = document.getElementById('prod-single-activity-select');
  var noteInput = document.getElementById('prod-single-note');
  var niveauRadios = document.getElementsByName('prod-single-niveau');

  var subject = subjectSelect ? subjectSelect.value : '';
  var strand = strandSelect ? strandSelect.value : '';
  var achievementCategory = achievementSelect ? achievementSelect.value : '';
  var activityTag = activitySelect ? activitySelect.value : (activityInput ? activityInput.value.trim() : '');
  var note = noteInput ? noteInput.value.trim() : '';
  var niveau = '';
  for (var i = 0; i < niveauRadios.length; i++) {
    if (niveauRadios[i].checked) niveau = niveauRadios[i].value;
  }

  var statusEl = document.getElementById('prod-single-save-status');
  if (statusEl) statusEl.textContent = ' Enregistrement...';

  try {
    await addProduction({
      studentCode: studentCode,
      domain: '',
      note: note,
      level: null,
      grade: niveau || null,
      activityTag: activityTag,
      subject: subject,
      strand: strand,
      achievementCategory: achievementCategory,
      photoBlobs: productionSingleCapture.photoFile ? [productionSingleCapture.photoFile] : []
    });

    productionSingleCapture.photoFile = null;
    productionSingleCapture.photoPreviewUrl = null;

    var studentSelect = document.getElementById('prod-single-student');
    if (studentSelect) studentSelect.value = '';
    var fieldsArea = document.getElementById('prod-single-fields');
    if (fieldsArea) fieldsArea.innerHTML = '<p><em>Sélectionnez un élève pour afficher les champs.</em></p>';

    loadAndRenderRecentProductions();

    if (statusEl) {
      statusEl.textContent = ' ✓ Enregistré';
      setTimeout(function() { statusEl.textContent = ''; }, 2000);
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = '';
    alert('Erreur lors de l\'enregistrement. Veuillez réessayer.');
    console.error(err);
  }
}
