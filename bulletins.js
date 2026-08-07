// ============================================================
// bulletins.js — MonProf.ai
// PART B1 of ?: Evidence data layer
// ============================================================
// This part only assembles and anonymizes data. No AI calls,
// no UI yet — test it in the browser console before moving on.
//
// For a given student, gathers:
//   - Observations (text + conversation notes, tagged by domain)
//   - Productions (evidence notes, tagged by domain)
// Both note fields are run through anonymizeText() so any real
// names typed into free text get swapped for codes before this
// data ever goes near the AI.
//
// Deliberately EXCLUDED from this bundle: Productions' internal
// level (Émergent/En développement/Confirmé) — those levels must
// never influence or appear in generated comment text.
// ============================================================

// ---- SINGLE STUDENT ----

async function getBulletinEvidenceForStudent(studentCode) {
  var obsEntries = getObservationsForStudent(studentCode);
  var prodEntries = await getProductionsByStudent(studentCode);

  var observations = obsEntries.map(function(o) {
    return {
      date: o.date,
      domaine: o.domaine,
      type: o.type,
      activityTag: o.activityTag || '',
      note: anonymizeText(o.note || '')
    };
  });

  var productions = prodEntries.map(function(p) {
    return {
      date: formatProductionDate(p.createdAt),
      domain: p.domain,
      activityTag: p.activityTag || '',
      note: anonymizeText(p.note || '')
    };
  });

  return {
    studentCode: studentCode,
    observations: observations,
    productions: productions
  };
}

// ---- ALL ACTIVE STUDENTS ----

async function getBulletinEvidenceForAllActive() {
  var roster = getRoster().filter(function(s) { return s.actif; });
  var results = [];

  for (var i = 0; i < roster.length; i++) {
    var evidence = await getBulletinEvidenceForStudent(roster[i].code);
    results.push(evidence);
  }

  return results;
}

// ============================================================
// TEMPORARY PLACEHOLDER RENDER — replaced in a later part
// ============================================================

// ============================================================
// bulletins.js — MonProf.ai
// PART B4: UI — student/period picker, generate, editable review
// ============================================================
// APPEND this to the END of your bulletins.js file, after Parts
// B1, B2, and B3. Also DELETE the placeholder renderBulletins()
// function from Part B1 (described separately) — this file
// defines the real one.
//
// Depends on:
//   - generateBulletinForStudent() — Part B3
//   - getRoster(), displayName() — roster.js
// ============================================================

var BULLETIN_DRAFTS_KEY = 'monprofai_bulletin_drafts';

var bulletinUIState = {
  selectedStudent: '',
  selectedPeriod: 'observations_initiales'
};

// ---- DRAFT STORAGE ----

function getBulletinDrafts() {
  try {
    var data = localStorage.getItem(BULLETIN_DRAFTS_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
}

function saveBulletinDrafts(drafts) {
  try {
    localStorage.setItem(BULLETIN_DRAFTS_KEY, JSON.stringify(drafts));
  } catch (e) {
    alert('Erreur: impossible de sauvegarder le brouillon.');
  }
}

function saveBulletinDraft(studentCode, period, data) {
  var drafts = getBulletinDrafts();
  var key = studentCode + '_' + period;
  drafts[key] = {
    studentCode: studentCode,
    period: period,
    type: data.type,
    text: data.text || null,
    domains: data.domains || null,
    generatedAt: new Date().toISOString()
  };
  saveBulletinDrafts(drafts);
}

function getBulletinDraft(studentCode, period) {
  var drafts = getBulletinDrafts();
  return drafts[studentCode + '_' + period] || null;
}

// ---- MAIN RENDER ----

function renderBulletins() {
  var container = document.getElementById('module-bulletins');
  if (!container) return;

  var allActive = getRoster().filter(function(s) { return s.actif; });

  if (allActive.length === 0) {
    container.innerHTML = '<h2>Bulletins</h2><p>Aucun élève actif dans la liste de classe.</p>';
    return;
  }

  var mjRoster = allActive.filter(function(s) { return !isGrade1to6(s.code); });
  var g16Roster = allActive.filter(function(s) { return isGrade1to6(s.code); });

 var html = '';

  if (mjRoster.length > 0) {
    html += '<h2>Bulletin M-J</h2>';
    html += '<div class="form-row">';
    html += '<label for="bulletin-student-select">Élève: </label>';
    html += '<select id="bulletin-student-select" onchange="handleBulletinSelectorChange()">';
    html += '<option value="">-- Sélectionner --</option>';
    mjRoster.forEach(function(s) {
      var selectedAttr = (s.code === bulletinUIState.selectedStudent) ? ' selected' : '';
      html += '<option value="' + s.code + '"' + selectedAttr + '>' + displayName(s) + '</option>';
    });
    html += '</select>';
    html += '</div>';

    html += '<div class="form-row">';
    html += '<label for="bulletin-period-select">Période: </label>';
    html += '<select id="bulletin-period-select" onchange="handleBulletinSelectorChange()">';
    html += '<option value="observations_initiales"' + (bulletinUIState.selectedPeriod === 'observations_initiales' ? ' selected' : '') + '>Première (observations initiales)</option>';
    html += '<option value="deuxieme"' + (bulletinUIState.selectedPeriod === 'deuxieme' ? ' selected' : '') + '>Deuxième période</option>';
    html += '<option value="troisieme"' + (bulletinUIState.selectedPeriod === 'troisieme' ? ' selected' : '') + '>Troisième période</option>';
    html += '</select>';
    html += '</div>';

    html += '<button id="bulletin-generate-btn" onclick="handleGenerateBulletinClick()">Générer le commentaire</button> ';
    html += '<button id="bulletin-generate-all-btn" onclick="handleGenerateAllBulletinsClick()">Générer pour toute la classe</button> ';
    html += '<button onclick="renderBulletinTableView()">Voir tous les brouillons (tableau)</button>';
    html += '<span id="bulletin-generate-status"></span>';

    html += '<div id="bulletin-review-area"></div>';
  }

  if (g16Roster.length > 0) {
    if (mjRoster.length > 0) html += '<hr>';
    html += '<h2>Bulletins — 1re à 6e année</h2>';
    html += '<div id="grade16-bulletin-section">';
    html += renderGrade16BulletinSectionHtml();
    html += '</div>';
  }

  container.innerHTML = html;

  if (mjRoster.length > 0 && bulletinUIState.selectedStudent) {
    renderExistingDraftIfAny();
  }
}

function handleBulletinSelectorChange() {
  var studentSelect = document.getElementById('bulletin-student-select');
  var periodSelect = document.getElementById('bulletin-period-select');

  bulletinUIState.selectedStudent = studentSelect.value;
  bulletinUIState.selectedPeriod = periodSelect.value;

  var reviewArea = document.getElementById('bulletin-review-area');
  if (reviewArea) reviewArea.innerHTML = '';

  if (bulletinUIState.selectedStudent) {
    renderExistingDraftIfAny();
  }
}

function renderExistingDraftIfAny() {
  var draft = getBulletinDraft(bulletinUIState.selectedStudent, bulletinUIState.selectedPeriod);
  if (draft) {
    renderBulletinReview(draft);
  }
}

// ---- GENERATE ----

async function handleGenerateBulletinClick() {
  var studentCode = bulletinUIState.selectedStudent;
  var period = bulletinUIState.selectedPeriod;

  if (!studentCode) {
    alert('Veuillez sélectionner un élève.');
    return;
  }

  var statusEl = document.getElementById('bulletin-generate-status');
  var btn = document.getElementById('bulletin-generate-btn');
  btn.disabled = true;
  if (statusEl) statusEl.textContent = ' Génération en cours...';

  try {
    var result = await generateBulletinForStudent(studentCode, period);
    saveBulletinDraft(studentCode, period, result);
    if (statusEl) statusEl.textContent = '';
    renderBulletinReview(getBulletinDraft(studentCode, period));
  } catch (err) {
    if (statusEl) statusEl.textContent = '';
    alert('Erreur lors de la génération: ' + err.message);
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

// ---- REVIEW / EDIT ----

function escapeHtmlForTextarea(text) {
  var div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function renderBulletinReview(draft) {
  var reviewArea = document.getElementById('bulletin-review-area');
  if (!reviewArea) return;

  var html = '<div class="bulletin-review-box">';
  html += '<h3>Brouillon</h3>';

  if (draft.type === 'combined') {
    html += '<textarea id="bulletin-edit-combined" rows="8">' + escapeHtmlForTextarea(draft.text) + '</textarea>';
  } else {
    var domainLabels = { A: 'Domaine A', B: 'Domaine B', C: 'Domaine C', D: 'Domaine D' };
    ['A', 'B', 'C', 'D'].forEach(function(d) {
      html += '<h4>' + domainLabels[d] + '</h4>';
      html += '<textarea id="bulletin-edit-domain-' + d + '" rows="5">' + escapeHtmlForTextarea((draft.domains && draft.domains[d]) || '') + '</textarea>';
    });
  }

  html += '<button onclick="saveBulletinEdits()">Enregistrer les modifications</button> ';
  html += '<button onclick="copyBulletinDraftToClipboard()">Copier</button>';
  html += '<span id="bulletin-save-status"></span>';
  html += '</div>';

  reviewArea.innerHTML = html;
}

function saveBulletinEdits() {
  var studentCode = bulletinUIState.selectedStudent;
  var period = bulletinUIState.selectedPeriod;
  var draft = getBulletinDraft(studentCode, period);
  if (!draft) return;

  if (draft.type === 'combined') {
    var textarea = document.getElementById('bulletin-edit-combined');
    if (textarea) draft.text = textarea.value;
  } else {
    ['A', 'B', 'C', 'D'].forEach(function(d) {
      var domainTextarea = document.getElementById('bulletin-edit-domain-' + d);
      if (domainTextarea) {
        if (!draft.domains) draft.domains = {};
        draft.domains[d] = domainTextarea.value;
      }
    });
  }

  var drafts = getBulletinDrafts();
  drafts[studentCode + '_' + period] = draft;
  saveBulletinDrafts(drafts);

  var statusEl = document.getElementById('bulletin-save-status');
  if (statusEl) {
    statusEl.textContent = ' ✓ Enregistré';
    setTimeout(function() { statusEl.textContent = ''; }, 2000);
  }
}

// ============================================================
// bulletins.js — MonProf.ai
// PART B2: Prompt builder + single-student generation
// ============================================================
// APPEND this to the END of your bulletins.js file, after Part B1.
//
// Builds the "Relevé des apprentissages : observations initiales"
// prompt (first report of the year — one combined comment across
// all four domains), sends it through the shared Railway proxy,
// and deanonymizes the result.
//
// Depends on:
//   - getBulletinEvidenceForStudent() — Part B1
//   - deanonymizeText() — roster.js
// ============================================================

var BULLETIN_PROXY_URL = 'https://web-production-f1270.up.railway.app/api/claude';
var BULLETIN_PROXY_SECRET = 'monprof-juin2026';

function buildBulletinPrompt(evidence, pronom) {
  var lines = [];

  lines.push('Tu es une enseignante de maternelle/jardin d\'enfants en Ontario qui rédige un commentaire anecdotique pour le "Relevé des apprentissages : observations initiales" (premier bulletin de l\'année).');
  lines.push('');
  lines.push('RÈGLES STRICTES À SUIVRE:');
  lines.push('- Rédige UN SEUL paragraphe qui couvre tous les domaines ensemble, de façon narrative (ne sépare pas par domaine, ne nomme pas les domaines A/B/C/D).');
  lines.push('- Utilise UNIQUEMENT le code de l\'élève fourni ci-dessous pour le désigner (jamais un prénom).');
  lines.push('- Le pronom de l\'enfant est "' + pronom + '". Utilise UNIQUEMENT ce pronom partout dans le texte — n\'écris jamais "il/elle" ensemble ni aucune autre hésitation.');
  lines.push('- Base-toi seulement sur les preuves fournies ci-dessous. N\'invente aucun fait, aucune activité, aucun détail qui n\'y figure pas.');
  lines.push('- Inclus à la fois des points forts ET au moins une prochaine étape, de façon équilibrée.');
  lines.push('- Mentionne une activité précise si cela aide à personnaliser le commentaire (ex: "lors de l\'activité ...").');
  lines.push('- Utilise un langage simple, chaleureux et clair, destiné aux parents — évite le jargon pédagogique.');
   lines.push('- Ton constructif et positif, mais JAMAIS exagéré: évite des mots comme "exemplaire", "remarquable", "irréprochable", "exceptionnel", "excellent", "extraordinaire", "parfait(e)", "toujours" et "jamais". N\'implique jamais que l\'enfant est parfait(e) ou sans défi.');
  lines.push('- Si l\'enfant éprouve des difficultés dans un aspect, formule-le avec douceur et sans jugement (ex: "il commence à...", "elle pourrait...", "il devra...") — jamais de langage dur ou négatif.');
  lines.push('- N\'utilise JAMAIS de descripteurs de niveaux de rendement (comme "émergent", "en développement", "confirmé", ou toute échelle de notation).');
  lines.push('- Ne reprends pas mot pour mot les attentes du curriculum.');
  lines.push('- Longueur cible: un paragraphe solide d\'environ 5 à 7 phrases — substantiel, sans être exagérément long.');
  lines.push('- Réponds UNIQUEMENT avec le texte du commentaire final, sans titre, sans préambule, sans guillemets.');
  lines.push('');
  lines.push('CODE DE L\'ÉLÈVE: ' + evidence.studentCode);
  lines.push('');
  lines.push('PREUVES D\'APPRENTISSAGE (observations, conversations, productions):');

  if (evidence.observations.length === 0 && evidence.productions.length === 0) {
    lines.push('(Aucune preuve enregistrée pour le moment.)');
  }

  evidence.observations.forEach(function(o) {
    var typeLabel = o.type === 'conversation' ? 'Conversation' : 'Observation';
    lines.push('- [' + o.date + '] ' + typeLabel + ' (Domaine ' + o.domaine + ')' +
      (o.activityTag ? ' — Activité: ' + o.activityTag : '') + ': ' + o.note);
  });

  evidence.productions.forEach(function(p) {
    lines.push('- [' + p.date + '] Production (Domaine ' + p.domain + ')' +
      (p.activityTag ? ' — Activité: ' + p.activityTag : '') + ': ' + p.note);
  });

  return lines.join('\n');
}

async function callBulletinProxy(promptText) {
  var response = await fetch(BULLETIN_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Proxy-Secret': BULLETIN_PROXY_SECRET
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 600,
      messages: [
        { role: 'user', content: promptText }
      ]
    })
  });

  var data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error));
  }

  if (!data.content || !Array.isArray(data.content)) {
    throw new Error('Réponse inattendue de l\'API: ' + JSON.stringify(data));
  }

  var textBlock = data.content.find(function(block) { return block.type === 'text'; });

  if (!textBlock || !textBlock.text) {
    throw new Error('Aucun bloc de texte trouvé dans la réponse: ' + JSON.stringify(data));
  }

  return textBlock.text.trim();
}

function deanonymizeBulletinText(text, studentCode) {
  var roster = getRoster();
  var student = roster.find(function(s) { return s.code === studentCode; });
  if (student) {
    text = text.split(student.code).join(student.prenom);
  }
  return text;
}

async function generateBulletinCommentForStudent(studentCode) {
  var roster = getRoster();
  var student = roster.find(function(s) { return s.code === studentCode; });
  var pronom = student ? student.pronom : 'iel';

  var evidence = await getBulletinEvidenceForStudent(studentCode);
  var prompt = buildBulletinPrompt(evidence, pronom);
  var rawComment = await callBulletinProxy(prompt);
  var finalComment = deanonymizeBulletinText(rawComment, studentCode);
  return finalComment;
}
// ============================================================
// bulletins.js — MonProf.ai
// PART B3: Reporting period selection
// ============================================================
// APPEND this to the END of your bulletins.js file, after Part B2.
//
// "observations_initiales" (first report) -> one combined comment,
// same as generateBulletinCommentForStudent() from Part B2.
//
// "deuxieme" / "troisieme" -> four separate comments, one per
// domain (A/B/C/D), each built only from that domain's evidence.
//
// Depends on:
//   - getBulletinEvidenceForStudent(), buildBulletinPrompt(),
//     callBulletinProxy(), deanonymizeBulletinText() — Parts B1/B2
//   - getRoster() — roster.js
// ============================================================

var BULLETIN_PERIODS = {
  observations_initiales: 'Première période (observations initiales) — un commentaire combiné pour tous les domaines',
  deuxieme: 'Deuxième période — un commentaire distinct par domaine',
  troisieme: 'Troisième période — un commentaire distinct par domaine'
};

var BULLETIN_DOMAIN_LABELS = {
  A: 'Notions fondamentales de la langue et des mathématiques',
  B: 'Résolution de problèmes et innovation',
  C: 'Autorégulation et bien-être',
  D: 'Appartenance et contribution'
};

function filterEvidenceByDomain(evidence, domain) {
  return {
    studentCode: evidence.studentCode,
    observations: evidence.observations.filter(function(o) { return o.domaine === domain; }),
    productions: evidence.productions.filter(function(p) { return p.domain === domain; })
  };
}

function buildDomainBulletinPrompt(evidence, domain, pronom, periodLabel) {
  var lines = [];

  lines.push('Tu es une enseignante de maternelle/jardin d\'enfants en Ontario qui rédige un commentaire anecdotique pour le Relevé des apprentissages (' + periodLabel + ').');
  lines.push('Ce commentaire porte UNIQUEMENT sur le Domaine ' + domain + ' — ' + BULLETIN_DOMAIN_LABELS[domain] + '.');
  lines.push('');
  lines.push('RÈGLES STRICTES À SUIVRE:');
  lines.push('- Rédige UN SEUL paragraphe qui porte seulement sur ce domaine (ne mentionne pas les autres domaines).');
  lines.push('- Utilise UNIQUEMENT le code de l\'élève fourni ci-dessous pour le désigner (jamais un prénom).');
  lines.push('- Le pronom de l\'enfant est "' + pronom + '". Utilise UNIQUEMENT ce pronom partout — n\'écris jamais "il/elle" ensemble ni aucune hésitation.');
  lines.push('- Base-toi seulement sur les preuves fournies ci-dessous. N\'invente aucun fait, aucune activité, aucun détail qui n\'y figure pas.');
  lines.push('- Inclus à la fois un point fort ET au moins une prochaine étape, de façon équilibrée.');
  lines.push('- Mentionne une activité précise si cela aide à personnaliser le commentaire.');
  lines.push('- Langage simple, chaleureux, clair, destiné aux parents — évite le jargon pédagogique.');
  lines.push('- Ton constructif et positif, mais JAMAIS exagéré: évite des mots comme "exemplaire", "remarquable", "irréprochable", "exceptionnel", "excellent", "extraordinaire", "parfait(e)", "toujours" et "jamais". N\'implique jamais que l\'enfant est parfait(e) ou sans défi.');
  lines.push('- Si l\'enfant éprouve des difficultés, formule-le avec douceur et sans jugement (ex: "il commence à...", "elle pourrait...", "il devra...").');
  lines.push('- N\'utilise JAMAIS de descripteurs de niveaux de rendement (émergent, en développement, confirmé, ou toute échelle de notation).');
  lines.push('- Ne reprends pas mot pour mot les attentes du curriculum.');
  lines.push('- Longueur cible: environ 3 à 5 phrases pour ce domaine seulement.');
  lines.push('- Réponds UNIQUEMENT avec le texte du commentaire final, sans titre, sans préambule, sans guillemets.');
  lines.push('');
  lines.push('CODE DE L\'ÉLÈVE: ' + evidence.studentCode);
  lines.push('');
  lines.push('PREUVES D\'APPRENTISSAGE POUR CE DOMAINE:');

  if (evidence.observations.length === 0 && evidence.productions.length === 0) {
    lines.push('(Aucune preuve enregistrée pour ce domaine pour le moment.)');
  }

  evidence.observations.forEach(function(o) {
    var typeLabel = o.type === 'conversation' ? 'Conversation' : 'Observation';
    lines.push('- [' + o.date + '] ' + typeLabel + (o.activityTag ? ' — Activité: ' + o.activityTag : '') + ': ' + o.note);
  });

  evidence.productions.forEach(function(p) {
    lines.push('- [' + p.date + '] Production' + (p.activityTag ? ' — Activité: ' + p.activityTag : '') + ': ' + p.note);
  });

  return lines.join('\n');
}

// period: 'observations_initiales' | 'deuxieme' | 'troisieme'
async function generateBulletinForStudent(studentCode, period) {
  var roster = getRoster();
  var student = roster.find(function(s) { return s.code === studentCode; });
  var pronom = student ? student.pronom : 'iel';

  var fullEvidence = await getBulletinEvidenceForStudent(studentCode);

  if (period === 'observations_initiales') {
    var prompt = buildBulletinPrompt(fullEvidence, pronom);
    var rawComment = await callBulletinProxy(prompt);
    return { type: 'combined', text: deanonymizeBulletinText(rawComment, studentCode) };
  }

  var periodLabel = BULLETIN_PERIODS[period] || period;
  var domains = ['A', 'B', 'C', 'D'];
  var result = {};

  for (var i = 0; i < domains.length; i++) {
    var domain = domains[i];
    var domainEvidence = filterEvidenceByDomain(fullEvidence, domain);
    var domainPrompt = buildDomainBulletinPrompt(domainEvidence, domain, pronom, periodLabel);
    var rawDomainComment = await callBulletinProxy(domainPrompt);
    result[domain] = deanonymizeBulletinText(rawDomainComment, studentCode);
  }

  return { type: 'byDomain', domains: result };
}
// ============================================================
// bulletins.js — MonProf.ai
// PART B5: Copy to clipboard, batch generate, summary table
// ============================================================
// APPEND this to the END of your bulletins.js file, after B1-B4.
// Also make Edits 1-2 described separately.
//
// Depends on:
//   - generateBulletinForStudent() — Part B3
//   - getBulletinDrafts(), saveBulletinDraft(), getBulletinDraft() — Part B4
//   - bulletinUIState — Part B4
//   - getRoster(), displayName() — roster.js
// ============================================================

// ---- COPY SINGLE DRAFT (from the review/edit screen) ----

function copyBulletinDraftToClipboard() {
  var studentCode = bulletinUIState.selectedStudent;
  var period = bulletinUIState.selectedPeriod;
  var draft = getBulletinDraft(studentCode, period);
  if (!draft) return;

  var textToCopy = '';

  if (draft.type === 'combined') {
    var textarea = document.getElementById('bulletin-edit-combined');
    textToCopy = textarea ? textarea.value : (draft.text || '');
  } else {
    var domainLabels = { A: 'Domaine A', B: 'Domaine B', C: 'Domaine C', D: 'Domaine D' };
    ['A', 'B', 'C', 'D'].forEach(function(d) {
      var domainTextarea = document.getElementById('bulletin-edit-domain-' + d);
      var val = domainTextarea ? domainTextarea.value : ((draft.domains && draft.domains[d]) || '');
      textToCopy += domainLabels[d] + ':\n' + val + '\n\n';
    });
    textToCopy = textToCopy.trim();
  }

  navigator.clipboard.writeText(textToCopy).then(function() {
    var statusEl = document.getElementById('bulletin-save-status');
    if (statusEl) {
      statusEl.textContent = ' ✓ Copié';
      setTimeout(function() { statusEl.textContent = ''; }, 2000);
    }
  }).catch(function(err) {
    alert('Impossible de copier automatiquement. Veuillez sélectionner et copier le texte manuellement.');
    console.error(err);
  });
}

// ---- BATCH GENERATE FOR WHOLE CLASS ----

async function handleGenerateAllBulletinsClick() {
  var period = bulletinUIState.selectedPeriod;
  var roster = getRoster().filter(function(s) { return s.actif; });

  if (roster.length === 0) {
    alert('Aucun élève actif.');
    return;
  }

  var confirmed = confirm('Générer un commentaire pour les ' + roster.length + ' élèves actifs? Ceci peut prendre plusieurs minutes.');
  if (!confirmed) return;

  var statusEl = document.getElementById('bulletin-generate-status');
  var btn = document.getElementById('bulletin-generate-all-btn');
  if (btn) btn.disabled = true;

  for (var i = 0; i < roster.length; i++) {
    var student = roster[i];
    if (statusEl) {
      statusEl.textContent = ' Génération ' + (i + 1) + ' sur ' + roster.length + ' (' + displayName(student) + ')...';
    }
    try {
      var result = await generateBulletinForStudent(student.code, period);
      saveBulletinDraft(student.code, period, result);
    } catch (err) {
      console.error('Erreur pour ' + student.code + ':', err);
    }
  }

  if (statusEl) statusEl.textContent = '';
  if (btn) btn.disabled = false;

  renderBulletinTableView();
}

// ---- SUMMARY TABLE VIEW ----

function renderBulletinTableView() {
  var reviewArea = document.getElementById('bulletin-review-area');
  if (!reviewArea) return;

  var period = bulletinUIState.selectedPeriod;
  var roster = getRoster().filter(function(s) { return s.actif; });
  var drafts = getBulletinDrafts();

  var html = '<div class="bulletin-table-view">';
  html += '<h3>Tous les brouillons — ' + (BULLETIN_PERIODS[period] || period) + '</h3>';
  html += '<button onclick="copyAllBulletinsToClipboard()">Copier tout (tableau)</button>';
  html += '<table class="bulletin-summary-table">';
  html += '<tr><th>Élève</th><th>Commentaire</th><th></th></tr>';

  roster.forEach(function(s) {
    var draft = drafts[s.code + '_' + period];
    var text = '';

    if (draft) {
      if (draft.type === 'combined') {
        text = draft.text || '';
      } else if (draft.domains) {
        text = ['A', 'B', 'C', 'D'].map(function(d) {
          return d + ': ' + (draft.domains[d] || '');
        }).join(' | ');
      }
    }

    html += '<tr>';
    html += '<td>' + displayName(s) + '</td>';
    html += '<td>' + (text || '<em>Pas encore généré</em>') + '</td>';
    html += '<td><button onclick="copyOneBulletinRow(\'' + s.code + '\')">Copier</button></td>';
    html += '</tr>';
  });

  html += '</table>';
  html += '</div>';

  reviewArea.innerHTML = html;
}

function copyOneBulletinRow(studentCode) {
  var period = bulletinUIState.selectedPeriod;
  var draft = getBulletinDraft(studentCode, period);
  if (!draft) return;

  var text = '';

  if (draft.type === 'combined') {
    text = draft.text || '';
  } else if (draft.domains) {
    text = ['A', 'B', 'C', 'D'].map(function(d) {
      return 'Domaine ' + d + ':\n' + (draft.domains[d] || '');
    }).join('\n\n');
  }

  navigator.clipboard.writeText(text).catch(function(err) {
    alert('Impossible de copier automatiquement.');
    console.error(err);
  });
}

async function copyAllBulletinsToClipboard() {
  var period = bulletinUIState.selectedPeriod;
  var roster = getRoster().filter(function(s) { return s.actif; });
  var drafts = getBulletinDrafts();

  var tsvRows = ['Élève\tCommentaire'];
  var htmlRows = '<tr><th>Élève</th><th>Commentaire</th></tr>';

  roster.forEach(function(s) {
    var draft = drafts[s.code + '_' + period];
    var text = '';

    if (draft) {
      if (draft.type === 'combined') {
        text = draft.text || '';
      } else if (draft.domains) {
        text = ['A', 'B', 'C', 'D'].map(function(d) {
          return 'Domaine ' + d + ': ' + (draft.domains[d] || '');
        }).join('  ');
      }
    }

    var plainText = text.replace(/\t/g, ' ').replace(/\n/g, ' ');
    tsvRows.push(displayName(s) + '\t' + plainText);

    var htmlText = escapeHtmlForTextarea(text).replace(/\n/g, '<br>');
    htmlRows += '<tr><td>' + escapeHtmlForTextarea(displayName(s)) + '</td><td>' + htmlText + '</td></tr>';
  });

  var tsv = tsvRows.join('\n');
  var html = '<table border="1" cellpadding="6" style="border-collapse:collapse;">' + htmlRows + '</table>';

  try {
    var clipboardItem = new ClipboardItem({
      'text/plain': new Blob([tsv], { type: 'text/plain' }),
      'text/html': new Blob([html], { type: 'text/html' })
    });
    await navigator.clipboard.write([clipboardItem]);
    alert('Tableau copié! Vous pouvez maintenant le coller dans Word, Excel ou Google Docs — il apparaîtra comme un vrai tableau.');
  } catch (err) {
    navigator.clipboard.writeText(tsv).then(function() {
      alert('Tableau copié (texte simple). Dans Word, utilisez Insertion > Convertir le texte en tableau si besoin.');
    }).catch(function(err2) {
      alert('Impossible de copier automatiquement.');
      console.error(err2);
    });
    console.error(err);
  }
}
// ============================================================
// GRADES 1-6 — PART G4: Academic (Français/Mathématiques) comments
// ============================================================
// APPEND this to the END of bulletins.js.
// Also make the 1 edit described separately (renderBulletins).
//
// Workflow: pick student + subject + period -> checklist of that
// student's curriculum-linked Observations/Productions for that
// subject -> teacher checks which to include -> generate.
//
// Cote/progress-formula is ALWAYS a manual pick, never AI-suggested,
// per the "jugement professionnel" principle in the Guide d'appui.
//
// Depends on:
//   - getObservationsForStudent(), getProductionsByStudent() — obs/prod files
//   - formatProductionDate() — productions.js Part 3
//   - anonymizeText(), deanonymizeBulletinText(), getRoster(), displayName() — roster.js/bulletins.js
//   - callBulletinProxy() — bulletins.js Part B2
//   - isGrade1to6(), GRADES_1_6_SUBJECTS — roster.js Part G1
//   - escapeHtmlForTextarea() — bulletins.js Part B4
// ============================================================

var GRADE16_DRAFTS_KEY = 'monprofai_grade16_bulletin_drafts';

var COTE_OPTIONS = ['A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-'];
var PROGRES_OPTIONS = ['Progresse avec difficulté', 'Progresse bien', 'Progresse très bien'];

var grade16BulletinState = {
  selectedStudent: '',
  selectedSubject: 'Français',
  selectedPeriod: 'progres',
  entries: [],
  selectedEntryIds: []
};

// ---- DATA ----

async function getGrade16SubjectEntries(studentCode, subject) {
  var obs = getObservationsForStudent(studentCode).filter(function(o) {
    return o.linkType === 'expectation' && o.subject === subject;
  });
  var prod = await getProductionsByStudent(studentCode);
  prod = prod.filter(function(p) { return p.subject === subject; });

  var combined = [];

  obs.forEach(function(o) {
    combined.push({
      id: 'obs_' + o.id,
      date: o.date,
      strand: o.strand,
      achievementCategory: o.achievementCategory,
      activityTag: o.activityTag,
      note: o.note,
      grade: null
    });
  });

  prod.forEach(function(p) {
    combined.push({
      id: 'prod_' + p.id,
      date: formatProductionDate(p.createdAt),
      strand: p.strand,
      achievementCategory: p.achievementCategory,
      activityTag: p.activityTag,
      note: p.note,
      grade: p.grade
    });
  });

  combined.sort(function(a, b) { return a.date.localeCompare(b.date); });
  return combined;
}

// ---- DRAFT STORAGE ----

function getGrade16Drafts() {
  try {
    var data = localStorage.getItem(GRADE16_DRAFTS_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) { return {}; }
}

function saveGrade16Drafts(drafts) {
  try {
    localStorage.setItem(GRADE16_DRAFTS_KEY, JSON.stringify(drafts));
  } catch (e) {
    alert('Erreur: impossible de sauvegarder le brouillon.');
  }
}

function saveGrade16Draft(studentCode, subject, period, text, cote, selectedEntryIds) {
  var drafts = getGrade16Drafts();
  var key = studentCode + '_' + subject + '_' + period;
  drafts[key] = {
    studentCode: studentCode,
    subject: subject,
    period: period,
    text: text,
    cote: cote || null,
    selectedEntryIds: selectedEntryIds,
    generatedAt: new Date().toISOString()
  };
  saveGrade16Drafts(drafts);
}

function getGrade16Draft(studentCode, subject, period) {
  var drafts = getGrade16Drafts();
  return drafts[studentCode + '_' + subject + '_' + period] || null;
}

// ---- PROMPT + GENERATION ----

function buildGrade16SubjectPrompt(period, subject, pronom, studentCode, selectedEntries) {
  var lines = [];
  var periodLabel = period === 'progres'
    ? 'le bulletin de progrès scolaire (première communication, automne)'
    : (period === 'scolaire1' ? 'le bulletin scolaire (deuxième communication, janvier)' : 'le bulletin scolaire (troisième communication, juin)');

  lines.push('Tu es une enseignante en Ontario qui rédige un commentaire de ' + subject + ' pour ' + periodLabel + '.');
  lines.push('');
  lines.push('RÈGLES STRICTES:');
  lines.push('- Rédige un commentaire pour la matière ' + subject + ' seulement.');
  lines.push('- Utilise UNIQUEMENT le code de l\'élève pour le désigner (jamais un prénom).');
  lines.push('- Le pronom de l\'enfant est "' + pronom + '". Utilise UNIQUEMENT ce pronom, jamais "il/elle" ensemble.');
  lines.push('- Base-toi seulement sur les preuves fournies ci-dessous. N\'invente rien.');
  lines.push('- Inclus un point fort ET au moins une prochaine étape, de façon équilibrée.');
  lines.push('- Langage simple et clair, destiné aux parents — évite le jargon pédagogique.');
  lines.push('- Ton constructif et positif, mais JAMAIS exagéré: évite des mots comme "exemplaire", "remarquable", "irréprochable", "exceptionnel", "excellent", "parfait(e)", "toujours" et "jamais". N\'implique jamais que l\'élève est parfait(e) ou sans défi.');
  lines.push('- Si l\'élève éprouve des difficultés, formule-le avec douceur (ex: "devra", "pourrait", "commence à").');
  lines.push('- N\'utilise JAMAIS de cote (lettre) ni de pourcentage dans le texte — la cote est assignée séparément par l\'enseignante.');
  lines.push('- Ne reprends pas mot pour mot les attentes du curriculum.');

  if (period === 'progres') {
    lines.push('- Ce commentaire accompagnera une formule de progrès ("progresse avec difficulté/bien/très bien") choisie séparément par l\'enseignante — ne répète pas cette formule dans le texte.');
    lines.push('- Longueur cible: 3 à 5 phrases.');
  } else {
    lines.push('- Longueur cible: un paragraphe solide d\'environ 5 à 7 phrases.');
  }

  lines.push('- Réponds UNIQUEMENT avec le texte final, sans titre ni préambule.');
  lines.push('');
  lines.push('CODE DE L\'ÉLÈVE: ' + studentCode);
  lines.push('');
  lines.push('PREUVES SÉLECTIONNÉES:');

  if (selectedEntries.length === 0) {
    lines.push('(Aucune preuve sélectionnée.)');
  }

  selectedEntries.forEach(function(e) {
    var gradeInfo = e.grade ? (' [Niveau: ' + e.grade + ']') : '';
    lines.push('- [' + e.date + '] ' + (e.strand || '') +
      (e.achievementCategory ? ' — ' + e.achievementCategory : '') +
      (e.activityTag ? ' — ' + e.activityTag : '') + gradeInfo + ': ' + anonymizeText(e.note));
  });

  return lines.join('\n');
}

async function generateGrade16SubjectComment(studentCode, subject, period, selectedEntryIds, allEntries) {
  var roster = getRoster();
  var student = roster.find(function(s) { return s.code === studentCode; });
  var pronom = student ? student.pronom : 'iel';

  var selectedEntries = allEntries.filter(function(e) { return selectedEntryIds.indexOf(e.id) !== -1; });

  var prompt = buildGrade16SubjectPrompt(period, subject, pronom, studentCode, selectedEntries);
  var rawComment = await callBulletinProxy(prompt);
  return deanonymizeBulletinText(rawComment, studentCode);
}

// ---- UI ----

function renderGrade16BulletinSectionHtml() {
  var roster = getRoster().filter(function(s) { return s.actif && isGrade1to6(s.code); });

  if (roster.length === 0) {
    return '<p>Aucun élève de la 1re à la 6e année dans la liste de classe active.</p>';
  }

  var html = '<div class="form-row">';
  html += '<label for="g16-student-select">Élève: </label>';
  html += '<select id="g16-student-select" onchange="handleGrade16SelectorChange()">';
  html += '<option value="">-- Sélectionner --</option>';
  roster.forEach(function(s) {
    var sel = (s.code === grade16BulletinState.selectedStudent) ? ' selected' : '';
    html += '<option value="' + s.code + '"' + sel + '>' + displayName(s) + '</option>';
  });
  html += '</select>';
  html += '</div>';

  html += '<div class="form-row">';
  html += '<label for="g16-subject-select">Matière: </label>';
  html += '<select id="g16-subject-select" onchange="handleGrade16SelectorChange()">';
  GRADES_1_6_SUBJECTS.forEach(function(subj) {
    var sel = (subj === grade16BulletinState.selectedSubject) ? ' selected' : '';
    html += '<option value="' + subj + '"' + sel + '>' + subj + '</option>';
  });
  html += '</select>';
  html += '</div>';

  html += '<div class="form-row">';
  html += '<label for="g16-period-select">Période: </label>';
  html += '<select id="g16-period-select" onchange="handleGrade16SelectorChange()">';
  html += '<option value="progres"' + (grade16BulletinState.selectedPeriod === 'progres' ? ' selected' : '') + '>Bulletin de progrès (automne)</option>';
  html += '<option value="scolaire1"' + (grade16BulletinState.selectedPeriod === 'scolaire1' ? ' selected' : '') + '>Bulletin scolaire (janvier)</option>';
  html += '<option value="scolaire2"' + (grade16BulletinState.selectedPeriod === 'scolaire2' ? ' selected' : '') + '>Bulletin scolaire (juin)</option>';
  html += '</select>';
  html += '</div>';

  html += '<button onclick="renderGrade16TableView()">Voir tous les brouillons (tableau)</button>';
  html += '<div id="g16-entries-area"><p><em>Sélectionnez un élève et une matière pour voir les preuves disponibles.</em></p></div>';
  html += '<div id="g16-review-area"></div>';

  return html;
}

async function handleGrade16SelectorChange() {
  var studentSelect = document.getElementById('g16-student-select');
  var subjectSelect = document.getElementById('g16-subject-select');
  var periodSelect = document.getElementById('g16-period-select');

  grade16BulletinState.selectedStudent = studentSelect.value;
  grade16BulletinState.selectedSubject = subjectSelect.value;
  grade16BulletinState.selectedPeriod = periodSelect.value;

  var reviewArea = document.getElementById('g16-review-area');
  if (reviewArea) reviewArea.innerHTML = '';

  var entriesArea = document.getElementById('g16-entries-area');

  if (!grade16BulletinState.selectedStudent) {
    if (entriesArea) entriesArea.innerHTML = '<p><em>Sélectionnez un élève et une matière pour voir les preuves disponibles.</em></p>';
    return;
  }

  if (entriesArea) entriesArea.innerHTML = '<p>Chargement des preuves...</p>';

  var entries = await getGrade16SubjectEntries(grade16BulletinState.selectedStudent, grade16BulletinState.selectedSubject);
  grade16BulletinState.entries = entries;

  var existingDraft = getGrade16Draft(grade16BulletinState.selectedStudent, grade16BulletinState.selectedSubject, grade16BulletinState.selectedPeriod);
  grade16BulletinState.selectedEntryIds = existingDraft ? existingDraft.selectedEntryIds : entries.map(function(e) { return e.id; });

  renderGrade16EntriesChecklist();

  if (existingDraft) {
    renderGrade16Review(existingDraft);
  }
}

function renderGrade16EntriesChecklist() {
  var entriesArea = document.getElementById('g16-entries-area');
  if (!entriesArea) return;

  var entries = grade16BulletinState.entries;

  if (entries.length === 0) {
    entriesArea.innerHTML = '<p>Aucune preuve enregistrée pour cette matière.</p>';
    return;
  }

  var html = '<h4>Preuves disponibles (cochez celles à inclure)</h4>';
  html += '<div class="g16-entries-list">';

  entries.forEach(function(e) {
    var checked = grade16BulletinState.selectedEntryIds.indexOf(e.id) !== -1 ? ' checked' : '';
    var gradeInfo = e.grade ? (' — Niveau: ' + e.grade) : '';
    html += '<label class="g16-entry-item">';
    html += '<input type="checkbox" value="' + e.id + '" onchange="toggleGrade16Entry(\'' + e.id + '\', this.checked)"' + checked + '> ';
    html += '<strong>' + e.date + '</strong> — ' + (e.strand || '') +
      (e.achievementCategory ? ' (' + e.achievementCategory + ')' : '') +
      (e.activityTag ? ' — ' + e.activityTag : '') + gradeInfo + '<br>';
    html += '<span class="g16-entry-note">' + (e.note || '') + '</span>';
    html += '</label>';
  });

  html += '</div>';
  html += '<button onclick="handleGenerateGrade16Click()">Générer le commentaire</button>';
  html += '<span id="g16-generate-status"></span>';

  entriesArea.innerHTML = html;
}

function toggleGrade16Entry(entryId, isChecked) {
  var idx = grade16BulletinState.selectedEntryIds.indexOf(entryId);
  if (isChecked && idx === -1) {
    grade16BulletinState.selectedEntryIds.push(entryId);
  } else if (!isChecked && idx !== -1) {
    grade16BulletinState.selectedEntryIds.splice(idx, 1);
  }
}

async function handleGenerateGrade16Click() {
  var statusEl = document.getElementById('g16-generate-status');
  if (statusEl) statusEl.textContent = ' Génération en cours...';

  try {
    var text = await generateGrade16SubjectComment(
      grade16BulletinState.selectedStudent,
      grade16BulletinState.selectedSubject,
      grade16BulletinState.selectedPeriod,
      grade16BulletinState.selectedEntryIds,
      grade16BulletinState.entries
    );

    saveGrade16Draft(
      grade16BulletinState.selectedStudent,
      grade16BulletinState.selectedSubject,
      grade16BulletinState.selectedPeriod,
      text,
      null,
      grade16BulletinState.selectedEntryIds
    );

    if (statusEl) statusEl.textContent = '';
    renderGrade16Review(getGrade16Draft(
      grade16BulletinState.selectedStudent,
      grade16BulletinState.selectedSubject,
      grade16BulletinState.selectedPeriod
    ));
  } catch (err) {
    if (statusEl) statusEl.textContent = '';
    alert('Erreur lors de la génération: ' + err.message);
    console.error(err);
  }
}

function renderGrade16Review(draft) {
  var reviewArea = document.getElementById('g16-review-area');
  if (!reviewArea) return;

  var html = '<div class="bulletin-review-box">';
  html += '<h4>Brouillon</h4>';
  html += '<textarea id="g16-edit-text" rows="6">' + escapeHtmlForTextarea(draft.text) + '</textarea>';

  if (draft.period === 'progres') {
    html += '<div class="form-row">';
    html += '<label>Formule de progrès: </label>';
    html += '<select id="g16-progres-select">';
    html += '<option value="">-- Sélectionner --</option>';
    PROGRES_OPTIONS.forEach(function(opt) {
      html += '<option value="' + opt + '"' + (draft.cote === opt ? ' selected' : '') + '>' + opt + '</option>';
    });
    html += '</select>';
    html += '</div>';
  } else {
    html += '<div class="form-row">';
    html += '<label>Cote: </label>';
    html += '<select id="g16-cote-select">';
    html += '<option value="">-- Sélectionner --</option>';
    COTE_OPTIONS.forEach(function(c) {
      html += '<option value="' + c + '"' + (draft.cote === c ? ' selected' : '') + '>' + c + '</option>';
    });
    html += '</select>';
    html += '</div>';
  }

  html += '<button onclick="saveGrade16Edits()">Enregistrer</button> ';
  html += '<button onclick="copyGrade16DraftToClipboard()">Copier</button>';
  html += '<span id="g16-save-status"></span>';
  html += '</div>';

  reviewArea.innerHTML = html;
}

function saveGrade16Edits() {
  var textarea = document.getElementById('g16-edit-text');
  var cote = null;
  var progresSelect = document.getElementById('g16-progres-select');
  var coteSelect = document.getElementById('g16-cote-select');
  if (progresSelect) cote = progresSelect.value || null;
  if (coteSelect) cote = coteSelect.value || null;

  saveGrade16Draft(
    grade16BulletinState.selectedStudent,
    grade16BulletinState.selectedSubject,
    grade16BulletinState.selectedPeriod,
    textarea.value,
    cote,
    grade16BulletinState.selectedEntryIds
  );

  var statusEl = document.getElementById('g16-save-status');
  if (statusEl) {
    statusEl.textContent = ' ✓ Enregistré';
    setTimeout(function() { statusEl.textContent = ''; }, 2000);
  }
}

function copyGrade16DraftToClipboard() {
  var textarea = document.getElementById('g16-edit-text');
  var progresSelect = document.getElementById('g16-progres-select');
  var coteSelect = document.getElementById('g16-cote-select');
  var extra = '';
  if (progresSelect && progresSelect.value) extra = '\n\n' + progresSelect.value;
  if (coteSelect && coteSelect.value) extra = '\n\nCote: ' + coteSelect.value;

  var text = (textarea ? textarea.value : '') + extra;

  navigator.clipboard.writeText(text).then(function() {
    var statusEl = document.getElementById('g16-save-status');
    if (statusEl) {
      statusEl.textContent = ' ✓ Copié';
      setTimeout(function() { statusEl.textContent = ''; }, 2000);
    }
  }).catch(function(err) {
    alert('Impossible de copier automatiquement.');
    console.error(err);
  });
}
// ============================================================
// GRADES 1-6 — ADDITION: Progress table view
// ============================================================
// APPEND this to the END of bulletins.js.
// Also make the 1 edit described separately (add table button).
//
// Shows, for the currently selected subject + period, every
// active grades 1-6 student and whether a draft already exists —
// useful for resuming after an interruption.
// ============================================================

function renderGrade16TableView() {
  var subjectSelect = document.getElementById('g16-subject-select');
  var periodSelect = document.getElementById('g16-period-select');
  var subject = subjectSelect ? subjectSelect.value : grade16BulletinState.selectedSubject;
  var period = periodSelect ? periodSelect.value : grade16BulletinState.selectedPeriod;

  grade16BulletinState.selectedSubject = subject;
  grade16BulletinState.selectedPeriod = period;

  var reviewArea = document.getElementById('g16-review-area');
  if (reviewArea) reviewArea.innerHTML = '';

  var roster = getRoster().filter(function(s) { return s.actif && isGrade1to6(s.code); });
  var drafts = getGrade16Drafts();

  var periodLabels = {
    progres: 'Bulletin de progrès (automne)',
    scolaire1: 'Bulletin scolaire (janvier)',
    scolaire2: 'Bulletin scolaire (juin)'
  };

  var html = '<h4>Tous les brouillons — ' + subject + ' — ' + (periodLabels[period] || period) + '</h4>';
  html += '<table class="bulletin-summary-table">';
  html += '<tr><th>Élève</th><th>Statut</th><th>Cote/Formule</th><th></th></tr>';

  roster.forEach(function(s) {
    var draft = drafts[s.code + '_' + subject + '_' + period];
    html += '<tr>';
    html += '<td>' + displayName(s) + '</td>';
    if (draft) {
      html += '<td>✓ Généré</td>';
      html += '<td>' + (draft.cote || '—') + '</td>';
      html += '<td><button onclick="loadGrade16StudentIntoView(\'' + s.code + '\')">Voir/Modifier</button></td>';
    } else {
      html += '<td class="production-grid-missing">Pas encore généré</td>';
      html += '<td>—</td>';
      html += '<td><button onclick="loadGrade16StudentIntoView(\'' + s.code + '\')">Commencer</button></td>';
    }
    html += '</tr>';
  });

  html += '</table>';

  var entriesArea = document.getElementById('g16-entries-area');
  if (entriesArea) entriesArea.innerHTML = html;
}

function loadGrade16StudentIntoView(studentCode) {
  var studentSelect = document.getElementById('g16-student-select');
  if (studentSelect) studentSelect.value = studentCode;
  handleGrade16SelectorChange();
}
