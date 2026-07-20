// ============================================================
// AUDIO-QUEUE.JS — Record, store, and transcribe voice notes
// ============================================================

var AUDIO_QUEUE_KEY = 'monprofai_audio_queue';
var mediaRecorder = null;
var audioChunks = [];
var isRecording = false;

// ============================================================
// INDEXEDDB SETUP — for storing audio blobs
// ============================================================

var db = null;

function initDB() {
  return new Promise(function(resolve, reject) {
    var request = indexedDB.open('monprofai_audio', 1);
    request.onupgradeneeded = function(e) {
      var database = e.target.result;
      if (!database.objectStoreNames.contains('audio')) {
        database.createObjectStore('audio', { keyPath: 'id' });
      }
    };
    request.onsuccess = function(e) {
      db = e.target.result;
      resolve(db);
    };
    request.onerror = function(e) {
      reject(e);
    };
  });
}

// Save audio blob to IndexedDB
function saveAudioBlob(id, blob) {
  return new Promise(function(resolve, reject) {
    var tx = db.transaction('audio', 'readwrite');
    var store = tx.objectStore('audio');
    store.put({ id: id, blob: blob });
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

// Get audio blob from IndexedDB
function getAudioBlob(id) {
  return new Promise(function(resolve, reject) {
    var tx = db.transaction('audio', 'readonly');
    var store = tx.objectStore('audio');
    var request = store.get(id);
    request.onsuccess = function() {
      resolve(request.result ? request.result.blob : null);
    };
    request.onerror = reject;
  });
}

// Delete audio blob from IndexedDB
function deleteAudioBlob(id) {
  return new Promise(function(resolve, reject) {
    var tx = db.transaction('audio', 'readwrite');
    var store = tx.objectStore('audio');
    store.delete(id);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

// ============================================================
// AUDIO QUEUE — pending transcriptions
// ============================================================

function getAudioQueue() {
  try {
    var data = localStorage.getItem(AUDIO_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch(e) {
    return [];
  }
}

function saveAudioQueue(queue) {
  try {
    localStorage.setItem(AUDIO_QUEUE_KEY, JSON.stringify(queue));
  } catch(e) {
    console.error('Could not save audio queue');
  }
}

function addToAudioQueue(obsId, audioId) {
  var queue = getAudioQueue();
  queue.push({ obsId: obsId, audioId: audioId });
  saveAudioQueue(queue);
}

function removeFromAudioQueue(obsId) {
  var queue = getAudioQueue().filter(function(q) {
    return q.obsId !== obsId;
  });
  saveAudioQueue(queue);
}

function getPendingCount() {
  return getAudioQueue().length;
}

// ============================================================
// RECORDING
// ============================================================

function startRecording(onStart, onError) {
  if (isRecording) return;

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(function(stream) {
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = function(e) {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.start();
      isRecording = true;
      if (onStart) onStart();
    })
    .catch(function(err) {
      if (onError) onError(err);
    });
}

function stopRecording(onComplete) {
  if (!isRecording || !mediaRecorder) return;

  mediaRecorder.onstop = function() {
    var blob = new Blob(audioChunks, { type: 'audio/webm' });
    isRecording = false;
    // Stop all tracks to release microphone
    mediaRecorder.stream.getTracks().forEach(function(t) { t.stop(); });
    if (onComplete) onComplete(blob);
  };

  mediaRecorder.stop();
}

// ============================================================
// TRANSCRIPTION (requires internet — done at home)
// ============================================================

function transcribeBlob(blob) {
  return new Promise(function(resolve, reject) {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      reject(new Error('Speech recognition not supported in this browser.'));
      return;
    }

    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    var recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = false;

    // Play audio through a hidden audio element so recognition can process it
    var url = URL.createObjectURL(blob);
    var audio = new Audio(url);

    recognition.onresult = function(e) {
      var transcript = e.results[0][0].transcript;
      URL.revokeObjectURL(url);
      resolve(transcript);
    };

    recognition.onerror = function(e) {
      URL.revokeObjectURL(url);
      reject(new Error('Transcription error: ' + e.error));
    };

    recognition.start();
    audio.play();
  });
}

// ============================================================
// PROCESS PENDING QUEUE
// ============================================================

function processPendingQueue(onProgress, onComplete) {
  var queue = getAudioQueue();
  if (queue.length === 0) {
    if (onComplete) onComplete(0);
    return;
  }

  // Check for internet
  if (!navigator.onLine) {
    alert('Aucune connexion internet. Veuillez réessayer à la maison.');
    return;
  }

  var processed = 0;
  var total = queue.length;

  function processNext(index) {
    if (index >= queue.length) {
      if (onComplete) onComplete(processed);
      return;
    }

    var item = queue[index];

    getAudioBlob(item.audioId).then(function(blob) {
      if (!blob) {
        // Audio missing — remove from queue
        removeFromAudioQueue(item.obsId);
        processNext(index + 1);
        return;
      }

      // Use Web Speech API for transcription
      var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert('La transcription vocale n\'est pas supportée dans ce navigateur. Utilisez Chrome.');
        return;
      }

      var recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.continuous = true;
      recognition.interimResults = false;

      var url = URL.createObjectURL(blob);
      var audio = new Audio(url);

      recognition.onresult = function(e) {
        var transcript = Array.from(e.results)
          .map(function(r) { return r[0].transcript; })
          .join(' ');

        // Update the observation note
        var obs = getObservations();
        obs = obs.map(function(o) {
          if (o.id === item.obsId) {
            o.note = transcript;
            o.pending = false;
          }
          return o;
        });
        saveObservations(obs);

        // Clean up
        deleteAudioBlob(item.audioId);
        removeFromAudioQueue(item.obsId);
        URL.revokeObjectURL(url);
        processed++;

        if (onProgress) onProgress(processed, total);
        processNext(index + 1);
      };

      recognition.onerror = function(e) {
        URL.revokeObjectURL(url);
        processNext(index + 1);
      };

      recognition.start();
      audio.play();

    }).catch(function() {
      processNext(index + 1);
    });
  }

  processNext(0);
}

// Initialize DB on load
initDB().catch(function(e) {
  console.error('IndexedDB init failed:', e);
});
