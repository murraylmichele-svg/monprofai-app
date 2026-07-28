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
