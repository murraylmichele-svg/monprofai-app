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
