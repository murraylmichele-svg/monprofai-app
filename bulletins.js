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

function renderBulletins() {
  var container = document.getElementById('module-bulletins');
  if (!container) return;
  container.innerHTML = '<h2>Bulletins</h2><p><em>Module en construction.</em></p>';
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

function buildBulletinPrompt(evidence) {
  var lines = [];

  lines.push('Tu es une enseignante de maternelle/jardin d\'enfants en Ontario qui rédige un commentaire anecdotique pour le "Relevé des apprentissages : observations initiales" (premier bulletin de l\'année).');
  lines.push('');
  lines.push('RÈGLES STRICTES À SUIVRE:');
  lines.push('- Rédige UN SEUL paragraphe qui couvre tous les domaines ensemble, de façon narrative (ne sépare pas par domaine, ne nomme pas les domaines A/B/C/D).');
  lines.push('- Utilise UNIQUEMENT le code de l\'élève fourni ci-dessous pour le désigner (jamais un prénom).');
  lines.push('- Base-toi seulement sur les preuves fournies ci-dessous. N\'invente aucun fait, aucune activité, aucun détail qui n\'y figure pas.');
  lines.push('- Inclus à la fois des points forts ET au moins une prochaine étape, de façon équilibrée.');
  lines.push('- Mentionne une activité précise si cela aide à personnaliser le commentaire (ex: "lors de l\'activité ...").');
  lines.push('- Utilise un langage simple, chaleureux et clair, destiné aux parents — évite le jargon pédagogique.');
  lines.push('- Ton constructif et positif, mais JAMAIS exagéré: évite les superlatifs ("excellent", "extraordinaire", "parfait", "toujours", "jamais") et n\'implique jamais que l\'enfant est parfait ou sans défi.');
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

  if (!data.content || !data.content[0] || !data.content[0].text) {
    throw new Error('Réponse inattendue de l\'API: ' + JSON.stringify(data));
  }

  return data.content[0].text.trim();
}

async function generateBulletinCommentForStudent(studentCode) {
  var evidence = await getBulletinEvidenceForStudent(studentCode);
  var prompt = buildBulletinPrompt(evidence);
  var rawComment = await callBulletinProxy(prompt);
  var finalComment = deanonymizeText(rawComment);
  return finalComment;
}
