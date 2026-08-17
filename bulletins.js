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
    html += '<h2>Bulletin 1re - 6e année</h2>';
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

var SUBJECT_CHAR_LIMITS = {
  'Français': 1000,
  'Mathématiques': 1100,
  'Sciences et technologie': 1000,
  'Études sociales': 700,
  'Enseignement religieux': 575
};

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
function getSubjectPrepositionPhrase(subject) {
  var startsWithVowelSound = /^[aeiouhâäéèêëîïôöùûü]/i.test(subject);
  return startsWithVowelSound ? ('d\'' + subject) : ('de ' + subject);
}
function buildGrade16SubjectPrompt(period, subject, pronom, studentCode, selectedEntries) {
  var lines = [];
  var periodLabel = period === 'progres'
    ? 'le bulletin de progrès scolaire (première communication, automne)'
    : (period === 'scolaire1' ? 'le bulletin scolaire (deuxième communication, janvier)' : 'le bulletin scolaire (troisième communication, juin)');
  var charLimit = SUBJECT_CHAR_LIMITS[subject] || 1000;
  var targetChars = Math.round(charLimit * 0.9);

  lines.push('Tu es une enseignante en Ontario qui rédige un commentaire ' + getSubjectPrepositionPhrase(subject) + ' pour ' + periodLabel + '.');
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
  lines.push('- Rédige le commentaire ENTIÈREMENT EN FRANÇAIS, même si le nom de la matière ou des volets du curriculum est en anglais (c\'est le cas pour Anglais, par exemple).');
  lines.push('- Rédige TOUT le commentaire comme UN SEUL paragraphe continu, sans saut de ligne ni ligne vide entre les phrases — même en passant du point fort à la prochaine étape.');
  lines.push('- Longueur cible: maximum ' + charLimit + ' caractères, espaces compris — c\'est la limite du système Aspen utilisé pour imprimer les bulletins. Vise environ ' + targetChars + ' caractères pour laisser une marge de sécurité.');
  if (period === 'progres') {
    lines.push('- Ce commentaire accompagnera une formule de progrès ("progresse avec difficulté/bien/très bien") choisie séparément par l\'enseignante — ne répète pas cette formule dans le texte.');
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

var MAX_SHORTEN_ATTEMPTS = 3;

async function shortenCommentViaAI(rawText, charLimit) {
  var targetChars = Math.round(charLimit * 0.95);
  var prompt = 'Voici un commentaire de bulletin qui dépasse la limite permise de ' + charLimit +
    ' caractères (espaces compris).\n\n' +
    'COMMENTAIRE ACTUEL (' + rawText.length + ' caractères):\n' + rawText + '\n\n' +
    'Reformule ce commentaire pour qu\'il tienne en moins de ' + targetChars +
    ' caractères, en conservant le même sens, le même ton constructif et les mêmes informations essentielles (point fort et prochaine étape). ' +
    'Ne raccourcis pas simplement en supprimant des phrases à la fin — reformule l\'ensemble de façon plus concise. ' +
    'Réponds UNIQUEMENT avec le texte final reformulé, sans préambule, sans guillemets, sans indication du nombre de caractères.';

  return await callBulletinProxy(prompt);
}

// Guaranteed last-resort fallback if the AI still won't comply after retries —
// cuts at the last full sentence within the limit when possible, otherwise
// at the last word boundary. This is pure local text manipulation, not an
// API call, so it's safe to run on the already-deanonymized final text.
function truncateToSentenceBoundary(text, limit) {
  if (text.length <= limit) return text;

  var truncated = text.slice(0, limit);
  var lastPeriod = truncated.lastIndexOf('. ');

  if (lastPeriod > limit * 0.5) {
    return truncated.slice(0, lastPeriod + 1).trim();
  }

  var lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 0) {
    return truncated.slice(0, lastSpace).trim() + '…';
  }

  return truncated.trim();
}

async function generateGrade16SubjectComment(studentCode, subject, period, selectedEntryIds, allEntries, onStatusUpdate) {
  var roster = getRoster();
  var student = roster.find(function(s) { return s.code === studentCode; });
  var pronom = student ? student.pronom : 'iel';

  var selectedEntries = allEntries.filter(function(e) { return selectedEntryIds.indexOf(e.id) !== -1; });

  var prompt = buildGrade16SubjectPrompt(period, subject, pronom, studentCode, selectedEntries);
  var rawComment = await callBulletinProxy(prompt);

  var charLimit = SUBJECT_CHAR_LIMITS[subject] || 1000;

  // Check against the deanonymized (final, real-name) length, since that's
  // what actually gets pasted into Aspen — but keep sending only the
  // anonymized/coded version to the AI for every shorten attempt, per the
  // privacy rule that real names never leave the device.
  for (var attempt = 0; attempt < MAX_SHORTEN_ATTEMPTS; attempt++) {
    var deanonymized = deanonymizeBulletinText(rawComment, studentCode);
    if (deanonymized.length <= charLimit) {
      return deanonymized;
    }
    if (onStatusUpdate) onStatusUpdate(' Ajustement de la longueur...');
    rawComment = await shortenCommentViaAI(rawComment, charLimit);
  }

  // Guaranteed fallback: even if the AI never got it under the limit,
  // the teacher will never see an over-limit draft.
  var finalText = deanonymizeBulletinText(rawComment, studentCode);
  return truncateToSentenceBoundary(finalText, charLimit);
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

  html += '<hr>';
  html += '<h3>Habiletés d\'apprentissage et habitudes de travail (HH)</h3>';
  html += '<div id="hh-section">';
  html += renderHHSectionHtml();
  html += '</div>';

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
      grade16BulletinState.entries,
      function(message) {
        if (statusEl) statusEl.textContent = message;
      }
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
  html += '<textarea id="g16-edit-text" rows="6" oninput="updateG16CharCount()">' + escapeHtmlForTextarea(draft.text) + '</textarea>';
  html += '<div id="g16-char-count"></div>';

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
  updateG16CharCount();
}

function updateG16CharCount() {
  var textarea = document.getElementById('g16-edit-text');
  var countEl = document.getElementById('g16-char-count');
  if (!textarea || !countEl) return;
  var count = textarea.value.length;
  var limit = SUBJECT_CHAR_LIMITS[grade16BulletinState.selectedSubject] || 1000;
  countEl.textContent = count + ' / ' + limit + ' caractères (limite Aspen)';
  countEl.style.color = count > limit ? '#c0392b' : '#666';
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
// ============================================================
// GRADES 1-6 — HH (Habiletés d'apprentissage et habitudes de
// travail) sentence-picker
// ============================================================
// APPEND this to the END of bulletins.js.
// Also make the 1 edit described separately.
//
// Rebuilds the old tool's HH tab: E/T/S/N cote picker per
// category, radio-selected Forces/Prochaines étapes phrases,
// auto-assembled comment, editable, char-count vs 2560 limit.
//
// All phrase content below has been retoned from the original —
// superlative language ("exemplaire", "remarquable",
// "irréprochable", etc.) removed, approved category by category.
//
// Depends on:
//   - getRoster(), displayName(), isGrade1to6(), getPeiReminderHtml() — roster.js
//   - escapeHtmlForTextarea() — bulletins.js Part B4
// ============================================================

var HH_DRAFTS_KEY = 'monprofai_hh_bulletin_drafts';

var HH_CATEGORY_KEYS = [
  { key: 'oral', label: 'Utilisation du français oral' },
  { key: 'fiabilite', label: 'Fiabilité' },
  { key: 'organisation', label: 'Sens de l\'organisation' },
  { key: 'autonomie', label: 'Autonomie' },
  { key: 'collaboration', label: 'Esprit de collaboration' },
  { key: 'initiative', label: 'Sens de l\'initiative' },
  { key: 'autoregulation', label: 'Autorégulation' }
];

var HH_FORCES_PHRASES = {
  oral: {
    E: [
      "s'exprime avec aisance et assurance en français dans la plupart des situations.",
      "communique ses idées clairement et enrichit les discussions par ses interventions de qualité.",
      "utilise un vocabulaire riche et varié et s'exprime avec fluidité en français.",
      "prend la parole avec confiance et articule ses pensées de façon précise et organisée."
    ],
    T: [
      "s'exprime généralement bien en français et contribue positivement aux échanges.",
      "participe activement aux discussions et utilise le français avec confiance.",
      "communique ses idées de façon claire et respecte les règles de la communication orale.",
      "s'exprime avec aisance dans la plupart des contextes et enrichit les échanges de la classe."
    ],
    S: [
      "fait des efforts constants pour communiquer en français lors des activités de classe.",
      "utilise le français en classe et continue à développer sa fluidité à l'oral.",
      "participe aux échanges et fait des progrès dans l'utilisation du français oral.",
      "s'améliore dans sa capacité à exprimer ses idées en français lors des activités."
    ],
    N: [
      "est encouragé(e) à prendre davantage d'initiatives pour communiquer en français.",
      "travaille à renforcer son utilisation du français dans les contextes scolaires.",
      "est invité(e) à s'exprimer plus régulièrement en français lors des discussions et des activités.",
      "bénéficierait de pratiquer davantage la communication orale en français au quotidien."
    ]
  },
  fiabilite: {
    E: [
      "remet généralement ses travaux dans les délais et assume ses responsabilités avec soin.",
      "fait preuve d'une bonne fiabilité : les tâches sont généralement complètes, soignées et remises à temps.",
      "respecte la grande majorité des échéances et produit un travail de qualité constante.",
      "démontre un bon sens des responsabilités et fait preuve de constance dans son travail."
    ],
    T: [
      "est généralement fiable et remet la plupart de ses travaux à temps.",
      "assume ses responsabilités scolaires avec sérieux et constance.",
      "fait preuve de fiabilité dans la majorité des situations et respecte les consignes données.",
      "remet ses travaux dans les délais et démontre un bon sens des responsabilités."
    ],
    S: [
      "remet habituellement ses travaux, bien que des rappels soient parfois nécessaires.",
      "fait des efforts pour respecter les attentes en matière de fiabilité.",
      "progresse dans le respect des délais et des responsabilités scolaires.",
      "s'améliore dans la remise de ses travaux et dans le suivi des consignes."
    ],
    N: [
      "est invité(e) à développer de meilleures habitudes pour remettre ses travaux à temps.",
      "travaille à améliorer sa constance dans le respect des délais et des consignes.",
      "gagnerait à développer des stratégies pour mieux gérer ses responsabilités scolaires.",
      "est encouragé(e) à prendre ses engagements scolaires plus au sérieux et de façon constante."
    ]
  },
  organisation: {
    E: [
      "gère son matériel et son temps de façon efficace, ce qui favorise sa réussite.",
      "fait preuve d'un bon sens de l'organisation : son espace de travail et son agenda sont généralement en ordre.",
      "planifie son travail avec méthode et utilise efficacement les outils organisationnels à sa disposition.",
      "démontre une bonne organisation qui lui permet d'aborder les tâches avec sérénité et efficacité."
    ],
    T: [
      "s'organise bien et gère efficacement son matériel scolaire.",
      "démontre un bon sens de l'organisation dans la gestion de ses tâches et de son matériel.",
      "utilise des stratégies organisationnelles efficaces pour gérer son travail et ses responsabilités.",
      "maintient un espace de travail ordonné et gère son temps de façon satisfaisante."
    ],
    S: [
      "fait des progrès dans l'organisation de son travail et de son matériel.",
      "s'améliore dans la gestion de son temps et de ses responsabilités scolaires.",
      "développe des stratégies pour mieux s'organiser et gérer ses tâches quotidiennes.",
      "fait des efforts pour maintenir son matériel en ordre et respecter les échéances."
    ],
    N: [
      "est encouragé(e) à développer des stratégies d'organisation plus efficaces.",
      "bénéficierait de soutien pour améliorer l'organisation de son travail et de son matériel.",
      "gagnerait à utiliser des outils de planification pour mieux gérer son temps et ses responsabilités.",
      "est invité(e) à développer de meilleures habitudes organisationnelles pour favoriser sa réussite."
    ]
  },
  autonomie: {
    E: [
      "travaille de façon autonome et sait trouver des ressources pour surmonter les défis.",
      "fait preuve d'une bonne autonomie : elle/il prend des initiatives et cherche à résoudre les problèmes de façon indépendante.",
      "aborde les tâches avec confiance et persévère de façon autonome face aux difficultés.",
      "démontre une bonne autonomie : elle/il gère son travail de façon indépendante et efficace."
    ],
    T: [
      "travaille généralement de façon autonome et cherche de l'aide au bon moment.",
      "démontre une bonne autonomie dans la réalisation de ses tâches scolaires.",
      "complète la plupart de ses tâches de façon indépendante et sait quand demander de l'aide.",
      "fait preuve d'une bonne capacité à travailler seul(e) et à gérer son apprentissage."
    ],
    S: [
      "développe son autonomie et fait des progrès dans sa capacité à travailler de façon indépendante.",
      "s'efforce de compléter ses tâches de façon plus autonome.",
      "fait des efforts pour travailler de façon plus indépendante et recourir moins souvent à l'aide.",
      "progresse dans son autonomie et développe sa confiance lors des tâches individuelles."
    ],
    N: [
      "est encouragé(e) à tenter de résoudre les problèmes avant de demander de l'aide.",
      "travaille à développer sa confiance et son autonomie dans les tâches scolaires.",
      "gagnerait à développer des stratégies pour travailler de façon plus indépendante.",
      "est invité(e) à persévérer davantage avant de chercher l'aide de l'enseignant(e)."
    ]
  },
  collaboration: {
    E: [
      "collabore bien avec ses pairs : elle/il écoute les autres, partage ses idées et contribue positivement au travail d'équipe.",
      "est un(e) coéquipier(ère) fiable, toujours prêt(e) à soutenir ses pairs et à travailler dans un esprit d'équipe.",
      "démontre de bonnes habiletés de collaboration : elle/il valorise les idées des autres et contribue avec enthousiasme.",
      "joue un rôle positif dans les travaux d'équipe et encourage ses coéquipiers avec bienveillance."
    ],
    T: [
      "collabore bien avec ses pairs et contribue positivement aux travaux d'équipe.",
      "démontre un bon esprit de collaboration et respecte les idées des autres.",
      "participe activement aux activités de groupe et fait preuve d'écoute envers ses pairs.",
      "travaille bien en équipe et s'assure que chacun peut contribuer au projet commun."
    ],
    S: [
      "fait des efforts pour collaborer avec ses pairs lors des travaux d'équipe.",
      "développe ses habiletés de collaboration et participe aux activités de groupe.",
      "progresse dans sa capacité à travailler en équipe et à respecter les idées des autres.",
      "s'améliore dans son rôle de coéquipier(ère) et fait des efforts pour contribuer au groupe."
    ],
    N: [
      "est invité(e) à développer davantage son esprit de collaboration lors des travaux en équipe.",
      "travaille à améliorer sa façon d'interagir et de contribuer lors des activités collaboratives.",
      "gagnerait à pratiquer l'écoute active et le partage des responsabilités dans les travaux de groupe.",
      "est encouragé(e) à s'engager plus activement dans les projets d'équipe et à respecter les rôles de chacun."
    ]
  },
  initiative: {
    E: [
      "fait preuve d'un bon sens de l'initiative : elle/il cherche régulièrement à approfondir ses apprentissages et propose des idées nouvelles.",
      "prend des initiatives de façon proactive et enrichit les apprentissages par sa curiosité.",
      "s'engage avec enthousiasme dans des projets qui stimulent sa créativité.",
      "propose régulièrement des idées originales qui enrichissent la classe."
    ],
    T: [
      "prend souvent des initiatives et cherche à approfondir ses apprentissages.",
      "démontre un bon sens de l'initiative et participe activement à la vie de la classe.",
      "s'engage avec enthousiasme dans les projets et propose régulièrement des idées pertinentes.",
      "fait preuve d'initiative dans son travail et cherche souvent à en apprendre davantage."
    ],
    S: [
      "commence à prendre davantage d'initiatives dans son apprentissage.",
      "fait des efforts pour s'impliquer de façon plus proactive dans les activités de classe.",
      "progresse dans sa capacité à prendre des initiatives et à s'engager dans son apprentissage.",
      "développe son sens de l'initiative et commence à proposer ses idées avec plus de confiance."
    ],
    N: [
      "est encouragé(e) à prendre plus d'initiatives et à s'impliquer davantage dans ses apprentissages.",
      "bénéficierait de s'engager plus activement dans les activités et de proposer ses idées.",
      "gagnerait à se fixer des défis personnels et à chercher à dépasser les attentes minimales.",
      "est invité(e) à s'impliquer davantage dans les projets et à prendre davantage d'initiatives."
    ]
  },
  autoregulation: {
    E: [
      "gère ses émotions et ses comportements de façon appropriée, même dans des situations difficiles.",
      "fait preuve d'une bonne autorégulation : elle/il reconnaît ses besoins et utilise des stratégies efficaces.",
      "démontre une bonne maturité dans la gestion de ses émotions et de ses réactions.",
      "utilise des stratégies d'autorégulation variées et efficaces qui lui permettent de maintenir un comportement positif."
    ],
    T: [
      "gère généralement bien ses émotions et ses comportements en classe.",
      "utilise des stratégies d'autorégulation efficaces et maintient un comportement positif.",
      "reconnaît ses besoins émotionnels et utilise des stratégies appropriées pour y répondre.",
      "démontre une bonne capacité à gérer ses réactions et à maintenir un environnement de travail positif."
    ],
    S: [
      "développe des stratégies pour mieux gérer ses émotions et ses comportements.",
      "fait des progrès dans sa capacité à s'autoréguler en situation de défi.",
      "s'améliore dans la gestion de ses émotions et fait des efforts pour maintenir un comportement approprié.",
      "apprend à utiliser des stratégies d'autorégulation et progresse dans ce domaine."
    ],
    N: [
      "est soutenu(e) dans le développement de stratégies d'autorégulation plus efficaces.",
      "travaille à développer des outils pour mieux gérer ses émotions et ses réactions.",
      "bénéficierait d'un soutien pour développer des stratégies adaptées à la gestion de ses émotions.",
      "est encouragé(e) à pratiquer les stratégies d'autorégulation apprises pour mieux gérer les situations difficiles."
    ]
  }
};

var HH_PROCHAINES_PHRASES = {
  oral: [
    "continuer à utiliser le français dans tous les contextes, y compris lors des échanges informels",
    "enrichir son vocabulaire et prendre des risques linguistiques en français",
    "s'exercer à structurer ses interventions orales de façon plus claire et organisée",
    "participer plus régulièrement aux discussions en classe et oser s'exprimer en français"
  ],
  fiabilite: [
    "développer des stratégies pour respecter les délais de façon plus constante",
    "renforcer sa routine de vérification avant de remettre ses travaux",
    "utiliser un agenda ou une liste de tâches pour mieux suivre ses responsabilités",
    "s'engager à remettre ses travaux de façon complète et dans les délais établis"
  ],
  organisation: [
    "développer un système personnel d'organisation de son agenda et de son matériel",
    "utiliser des outils de planification pour mieux gérer son temps",
    "prendre l'habitude de préparer son matériel à l'avance et de vérifier son espace de travail",
    "utiliser un cahier de planification ou un organisateur pour structurer ses tâches quotidiennes"
  ],
  autonomie: [
    "pratiquer des stratégies de résolution de problèmes avant de demander de l'aide",
    "développer sa confiance en ses propres capacités lors des tâches individuelles",
    "s'exercer à relire les consignes attentivement avant de demander une explication",
    "développer des stratégies pour aborder les tâches difficiles de façon plus indépendante"
  ],
  collaboration: [
    "pratiquer l'écoute active et le partage des responsabilités lors des travaux en équipe",
    "développer des stratégies pour contribuer positivement aux discussions de groupe",
    "apprendre à valoriser les idées des autres et à chercher des compromis lors des désaccords",
    "s'exercer à prendre un rôle actif et à respecter les contributions de chaque membre de l'équipe"
  ],
  initiative: [
    "se fixer des objectifs personnels et chercher à les dépasser",
    "s'impliquer de façon proactive dans les projets de classe et proposer des idées",
    "chercher des occasions d'approfondir ses apprentissages au-delà des attentes minimales",
    "développer sa curiosité intellectuelle en posant des questions et en explorant de nouveaux sujets"
  ],
  autoregulation: [
    "identifier et pratiquer des stratégies d'autorégulation efficaces en situation de stress",
    "reconnaître ses déclencheurs émotionnels et utiliser des stratégies de gestion apprises",
    "s'exercer à utiliser des techniques de gestion des émotions lors des moments difficiles",
    "développer un répertoire de stratégies personnelles pour maintenir un comportement positif en classe"
  ]
};

var hhState = {
  selectedStudent: '',
  selectedPeriod: 'progres',
  cotes: {},
  selectedForces: {},
  selectedProchaines: {},
  peiSentenceIncluded: false,
  peiSentenceText: ''
};

var PEI_SENTENCE_TEMPLATE_KEY = 'monprofai_pei_sentence_template';

function getPeiSentenceTemplate() {
  try {
    return localStorage.getItem(PEI_SENTENCE_TEMPLATE_KEY) || '';
  } catch (e) {
    return '';
  }
}

function savePeiSentenceTemplate(text) {
  try {
    localStorage.setItem(PEI_SENTENCE_TEMPLATE_KEY, text || '');
  } catch (e) {
    alert('Erreur: impossible de sauvegarder le modèle d\'énoncé PEI.');
  }
}

// ---- DRAFT STORAGE ----

function getHHDrafts() {
  try {
    var data = localStorage.getItem(HH_DRAFTS_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) { return {}; }
}

function saveHHDrafts(drafts) {
  try {
    localStorage.setItem(HH_DRAFTS_KEY, JSON.stringify(drafts));
  } catch (e) {
    alert('Erreur: impossible de sauvegarder le brouillon HH.');
  }
}

function saveHHDraft(studentCode, period, data) {
  var drafts = getHHDrafts();
  var key = studentCode + '_' + period;
  drafts[key] = {
    studentCode: studentCode,
    period: period,
    cotes: data.cotes,
    selectedForces: data.selectedForces,
    selectedProchaines: data.selectedProchaines,
    peiSentenceIncluded: data.peiSentenceIncluded || false,
    peiSentenceText: data.peiSentenceText || '',
    text: data.text,
    generatedAt: new Date().toISOString()
  };
  saveHHDrafts(drafts);
}

function getHHDraft(studentCode, period) {
  var drafts = getHHDrafts();
  return drafts[studentCode + '_' + period] || null;
}

// ---- UI ----

function renderHHSectionHtml() {
  var roster = getRoster().filter(function(s) { return s.actif && isGrade1to6(s.code); });

  if (roster.length === 0) {
    return '<p>Aucun élève de la 1re à la 6e année dans la liste de classe active.</p>';
  }

  var html = '<div class="form-row">';
  html += '<label for="hh-student-select">Élève: </label>';
  html += '<select id="hh-student-select" onchange="handleHHSelectorChange()">';
  html += '<option value="">-- Sélectionner --</option>';
  roster.forEach(function(s) {
    var sel = (s.code === hhState.selectedStudent) ? ' selected' : '';
    html += '<option value="' + s.code + '"' + sel + '>' + displayName(s) + '</option>';
  });
  html += '</select>';
  html += '</div>';

  html += '<div class="form-row">';
  html += '<label for="hh-period-select">Période: </label>';
  html += '<select id="hh-period-select" onchange="handleHHSelectorChange()">';
  html += '<option value="progres"' + (hhState.selectedPeriod === 'progres' ? ' selected' : '') + '>Bulletin de progrès (automne)</option>';
  html += '<option value="scolaire1"' + (hhState.selectedPeriod === 'scolaire1' ? ' selected' : '') + '>Bulletin scolaire (janvier)</option>';
  html += '<option value="scolaire2"' + (hhState.selectedPeriod === 'scolaire2' ? ' selected' : '') + '>Bulletin scolaire (juin)</option>';
  html += '</select>';
  html += '</div>';

  html += '<button onclick="renderHHTableView()">Voir tous les brouillons (tableau)</button>';
  html += '<div id="hh-dynamic-area"><p><em>Sélectionnez un élève pour commencer.</em></p></div>';

  return html;
}

function handleHHSelectorChange() {
  var studentSelect = document.getElementById('hh-student-select');
  var periodSelect = document.getElementById('hh-period-select');

  hhState.selectedStudent = studentSelect.value;
  hhState.selectedPeriod = periodSelect.value;

  var dynamicArea = document.getElementById('hh-dynamic-area');

  if (!hhState.selectedStudent) {
    hhState.cotes = {};
    hhState.selectedForces = {};
    hhState.selectedProchaines = {};
    if (dynamicArea) dynamicArea.innerHTML = '<p><em>Sélectionnez un élève pour commencer.</em></p>';
    return;
  }

  var existingDraft = getHHDraft(hhState.selectedStudent, hhState.selectedPeriod);
  var roster = getRoster();
  var student = roster.find(function(s) { return s.code === hhState.selectedStudent; });
  var hasPeiHH = student && student.peiHH;

  if (existingDraft) {
    hhState.cotes = existingDraft.cotes || {};
    hhState.selectedForces = existingDraft.selectedForces || {};
    hhState.selectedProchaines = existingDraft.selectedProchaines || {};
    hhState.peiSentenceIncluded = existingDraft.peiSentenceIncluded || false;
    hhState.peiSentenceText = existingDraft.peiSentenceText || getPeiSentenceTemplate();
  } else {
    hhState.cotes = {};
    hhState.selectedForces = {};
    hhState.selectedProchaines = {};
    hhState.peiSentenceIncluded = !!hasPeiHH;
    hhState.peiSentenceText = getPeiSentenceTemplate();
  }

  renderHHDynamicArea();
}
function renderHHDynamicArea() {
  var dynamicArea = document.getElementById('hh-dynamic-area');
  if (!dynamicArea) return;

  var roster = getRoster();
  var student = roster.find(function(s) { return s.code === hhState.selectedStudent; });

  var html = getPeiReminderHtml(hhState.selectedStudent);

  if (student && student.peiHH) {
    html += '<div class="hh-pei-box">';
    html += '<label><input type="checkbox" id="hh-pei-include"' + (hhState.peiSentenceIncluded ? ' checked' : '') +
      ' onchange="toggleHHPeiInclude(this.checked)"> Inclure l\'énoncé PEI dans ce commentaire</label>';
    html += '<textarea id="hh-pei-text" rows="2" placeholder="Collez ici l\'énoncé fourni par la SERT..." oninput="updateHHPeiText(this.value)">' +
      escapeHtmlForTextarea(hhState.peiSentenceText) + '</textarea>';
    html += '<button onclick="saveHHPeiTemplate()">Enregistrer comme modèle par défaut</button>';
    html += '</div>';
  }

  html += '<div class="hh-categories">';
  HH_CATEGORY_KEYS.forEach(function(cat) {
    var currentCote = hhState.cotes[cat.key];
    html += '<div class="hh-category-block">';
    html += '<div class="hh-category-label">' + cat.label + '</div>';
    html += '<div class="hh-cote-btns">';
    ['E', 'T', 'S', 'N'].forEach(function(c) {
      var activeClass = (currentCote === c) ? ' active' : '';
      html += '<button class="hh-cote-btn' + activeClass + '" onclick="selectHHCote(\'' + cat.key + '\', \'' + c + '\')">' + c + '</button>';
    });
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';

  var withCotes = HH_CATEGORY_KEYS.filter(function(cat) { return hhState.cotes[cat.key]; });

  html += '<h4>Points forts</h4>';
  html += '<div id="hh-forces-container">';
  if (withCotes.length === 0) {
    html += '<p><em>Sélectionnez d\'abord les cotes ci-dessus.</em></p>';
  } else {
    withCotes.forEach(function(cat) {
      var cote = hhState.cotes[cat.key];
      var phrases = (HH_FORCES_PHRASES[cat.key] && HH_FORCES_PHRASES[cat.key][cote]) || [];
      html += '<div class="hh-phrase-block">';
      html += '<div class="hh-phrase-block-label">' + cat.label + ' — ' + cote + '</div>';
      phrases.forEach(function(phrase, idx) {
        var checked = (hhState.selectedForces[cat.key] === phrase) ? ' checked' : '';
        html += '<label class="hh-phrase-item">';
        html += '<input type="radio" name="hh-force-' + cat.key + '"' + checked +
          ' onclick="toggleHHForce(\'' + cat.key + '\', ' + idx + ', this)"> ';
        html += '<span>' + phrase + '</span>';
        html += '</label>';
      });
      html += '</div>';
    });
  }
  html += '</div>';

  html += '<h4>Prochaines étapes</h4>';
  html += '<div id="hh-prochaines-container">';
  if (withCotes.length === 0) {
    html += '<p><em>Sélectionnez d\'abord les cotes ci-dessus.</em></p>';
  } else {
    withCotes.forEach(function(cat) {
      var phrases = HH_PROCHAINES_PHRASES[cat.key] || [];
      html += '<div class="hh-phrase-block">';
      html += '<div class="hh-phrase-block-label">' + cat.label + '</div>';
      phrases.forEach(function(phrase, idx) {
        var checked = (hhState.selectedProchaines[cat.key] === phrase) ? ' checked' : '';
        html += '<label class="hh-phrase-item">';
        html += '<input type="radio" name="hh-prochaine-' + cat.key + '"' + checked +
          ' onclick="toggleHHProchaine(\'' + cat.key + '\', ' + idx + ', this)"> ';
        html += '<span>' + phrase + '</span>';
        html += '</label>';
      });
      html += '</div>';
    });
  }
  html += '</div>';

  html += '<h4>Commentaire assemblé</h4>';
  html += '<textarea id="hh-assembled-text" rows="6" oninput="updateHHCharCount()">' +
    escapeHtmlForTextarea(assembleHHComment()) + '</textarea>';
  html += '<div id="hh-char-count"></div>';

  html += '<button onclick="saveHHDraftFromUI()">Enregistrer</button> ';
  html += '<button onclick="copyHHDraftToClipboard()">Copier</button>';
  html += '<span id="hh-save-status"></span>';

  dynamicArea.innerHTML = html;
  updateHHCharCount();
}

function selectHHCote(key, cote) {
  hhState.cotes[key] = cote;
  hhState.selectedForces[key] = null;
  renderHHDynamicArea();
}

function toggleHHForce(key, idx, radioEl) {
  if (radioEl.dataset.wasChecked === 'true') {
    radioEl.checked = false;
    radioEl.dataset.wasChecked = 'false';
    hhState.selectedForces[key] = null;
  } else {
    var radios = document.getElementsByName('hh-force-' + key);
    for (var i = 0; i < radios.length; i++) radios[i].dataset.wasChecked = 'false';
    radioEl.dataset.wasChecked = 'true';
    var cote = hhState.cotes[key];
    var phrases = (HH_FORCES_PHRASES[key] && HH_FORCES_PHRASES[key][cote]) || [];
    hhState.selectedForces[key] = phrases[idx] || null;
  }
  updateHHAssembledText();
}

function toggleHHProchaine(key, idx, radioEl) {
  if (radioEl.dataset.wasChecked === 'true') {
    radioEl.checked = false;
    radioEl.dataset.wasChecked = 'false';
    hhState.selectedProchaines[key] = null;
  } else {
    var radios = document.getElementsByName('hh-prochaine-' + key);
    for (var i = 0; i < radios.length; i++) radios[i].dataset.wasChecked = 'false';
    radioEl.dataset.wasChecked = 'true';
    var phrases = HH_PROCHAINES_PHRASES[key] || [];
    hhState.selectedProchaines[key] = phrases[idx] || null;
  }
  updateHHAssembledText();
}

function assembleHHComment() {
  var roster = getRoster();
  var student = roster.find(function(s) { return s.code === hhState.selectedStudent; });
  var prenom = student ? student.prenom : '[Prénom]';
  var pronom = student ? student.pronom : 'elle';
  var pronSujet = pronom === 'elle' ? 'Elle' : (pronom === 'il' ? 'Il' : 'Iel');
  var pronObj = pronom === 'elle' ? 'elle' : (pronom === 'il' ? 'il' : 'iel');

  var forcePhrases = [];
  HH_CATEGORY_KEYS.forEach(function(cat) {
    var phrase = hhState.selectedForces[cat.key];
    if (phrase) forcePhrases.push(phrase);
  });

  var prochainePhrases = [];
  HH_CATEGORY_KEYS.forEach(function(cat) {
    var phrase = hhState.selectedProchaines[cat.key];
    if (phrase) prochainePhrases.push(phrase);
  });

  var parts = [];

  if (forcePhrases.length > 0) {
    var joined = forcePhrases.map(function(phrase, idx) {
      if (idx === 0) return prenom + ' ' + phrase;
      return pronSujet + ' ' + phrase;
    }).join(' ');
    parts.push(joined);
  }

  if (prochainePhrases.length > 0) {
    var periodPhrase = hhState.selectedPeriod === 'progres'
      ? ('Pour la prochaine étape, ' + pronObj + ' est invité(e) à ' + prochainePhrases.join(' et à ') + '.')
      : ('Pour continuer à progresser, ' + pronObj + ' est encouragé(e) à ' + prochainePhrases.join(' et à ') + '.');
    parts.push(periodPhrase);
  }

  if (hhState.peiSentenceIncluded && hhState.peiSentenceText && hhState.peiSentenceText.trim()) {
    parts.push(hhState.peiSentenceText.trim());
  }

  var comment = parts.join(' ').trim();

  if (pronom === 'elle') {
    comment = comment.split('elle/il').join('elle').split('encouragé(e)').join('encouragée')
      .split('invité(e)').join('invitée').split('soutenu(e)').join('soutenue');
  } else if (pronom === 'il') {
    comment = comment.split('elle/il').join('il').split('encouragé(e)').join('encouragé')
      .split('invité(e)').join('invité').split('soutenu(e)').join('soutenu');
  } else {
    comment = comment.split('elle/il').join('iel').split('encouragé(e)').join('encouragé·e')
      .split('invité(e)').join('invité·e').split('soutenu(e)').join('soutenu·e');
  }

  return comment;
}

function updateHHAssembledText() {
  var textarea = document.getElementById('hh-assembled-text');
  if (textarea) textarea.value = assembleHHComment();
  updateHHCharCount();
}

function updateHHCharCount() {
  var textarea = document.getElementById('hh-assembled-text');
  var countEl = document.getElementById('hh-char-count');
  if (!textarea || !countEl) return;
  var count = textarea.value.length;
  var limit = 2560;
  countEl.textContent = count + ' / ' + limit + ' caractères';
  countEl.style.color = count > limit ? '#c0392b' : '#666';
}

function saveHHDraftFromUI() {
  var textarea = document.getElementById('hh-assembled-text');
  var text = textarea ? textarea.value : '';

  saveHHDraft(hhState.selectedStudent, hhState.selectedPeriod, {
    cotes: hhState.cotes,
    selectedForces: hhState.selectedForces,
    selectedProchaines: hhState.selectedProchaines,
    peiSentenceIncluded: hhState.peiSentenceIncluded,
    peiSentenceText: hhState.peiSentenceText,
    text: text
  });

  var statusEl = document.getElementById('hh-save-status');
  if (statusEl) {
    statusEl.textContent = ' ✓ Enregistré';
    setTimeout(function() { statusEl.textContent = ''; }, 2000);
  }
}

function copyHHDraftToClipboard() {
  var textarea = document.getElementById('hh-assembled-text');
  var text = textarea ? textarea.value : '';
  navigator.clipboard.writeText(text).then(function() {
    var statusEl = document.getElementById('hh-save-status');
    if (statusEl) {
      statusEl.textContent = ' ✓ Copié';
      setTimeout(function() { statusEl.textContent = ''; }, 2000);
    }
  }).catch(function(err) {
    alert('Impossible de copier automatiquement.');
    console.error(err);
  });
}

function renderHHTableView() {
  var periodSelect = document.getElementById('hh-period-select');
  var period = periodSelect ? periodSelect.value : hhState.selectedPeriod;
  hhState.selectedPeriod = period;

  var roster = getRoster().filter(function(s) { return s.actif && isGrade1to6(s.code); });
  var drafts = getHHDrafts();

  var periodLabels = {
    progres: 'Bulletin de progrès (automne)',
    scolaire1: 'Bulletin scolaire (janvier)',
    scolaire2: 'Bulletin scolaire (juin)'
  };

  var html = '<h4>Tous les brouillons HH — ' + (periodLabels[period] || period) + '</h4>';
  html += '<table class="bulletin-summary-table">';
  html += '<tr><th>Élève</th><th>Statut</th><th></th></tr>';

  roster.forEach(function(s) {
    var draft = drafts[s.code + '_' + period];
    html += '<tr>';
    html += '<td>' + displayName(s) + '</td>';
    if (draft) {
      html += '<td>✓ Complété</td>';
      html += '<td><button onclick="loadHHStudentIntoView(\'' + s.code + '\')">Voir/Modifier</button></td>';
    } else {
      html += '<td class="production-grid-missing">Pas encore commencé</td>';
      html += '<td><button onclick="loadHHStudentIntoView(\'' + s.code + '\')">Commencer</button></td>';
    }
    html += '</tr>';
  });

  html += '</table>';

  var dynamicArea = document.getElementById('hh-dynamic-area');
  if (dynamicArea) dynamicArea.innerHTML = html;
}

function loadHHStudentIntoView(studentCode) {
  var studentSelect = document.getElementById('hh-student-select');
  if (studentSelect) studentSelect.value = studentCode;
  handleHHSelectorChange();
}
// ============================================================
// GRADES 1-6 — ADDITION: Editable PEI sentence for HH
// ============================================================
// APPEND this to the END of bulletins.js.
// Also make Edits A-E described separately.
// ============================================================

function toggleHHPeiInclude(checked) {
  hhState.peiSentenceIncluded = checked;
  updateHHAssembledText();
}

function updateHHPeiText(text) {
  hhState.peiSentenceText = text;
  updateHHAssembledText();
}

function saveHHPeiTemplate() {
  savePeiSentenceTemplate(hhState.peiSentenceText);
  alert('Modèle d\'énoncé PEI enregistré. Il sera proposé par défaut pour les prochains élèves.');
}
