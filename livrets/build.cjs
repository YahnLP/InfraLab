const fs = require('fs');
const L = require('./lib.cjs');
const { d, W, P, H1, H2, H3, B, PB, space, table, box, lines, doc, cover, toc } = L;
const CH = require('./chapters.cjs'), TD = require('./td.cjs'), TR = require('./transfer.cjs'), M = require('./misc.cjs');
const TP = JSON.parse(fs.readFileSync(process.env.CAT || '/tmp/full.json', 'utf8'));
const OUT = process.env.OUT || '../docs/livrets'; fs.mkdirSync(OUT, { recursive: true });
const kindLabel = k => k === 'worked' ? 'compétence travaillée' : 'élément de preuve possible';
const skillsLine = s => s.skills.map(x => `${x.ref} (${kindLabel(x.kind)})`).join(' ; ');
const stars = n => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
const mdClean = s => s;
const NOTE = "InfraLab est un outil pédagogique indépendant. Un TP **travaille** une compétence ou peut fournir un **élément de preuve possible** : il ne « valide » jamais une compétence du référentiel, seule l'équipe pédagogique évalue.";

// ---------- Parties communes ----------
function courseSection() {
  const out = [H1('Partie 1 — Cours')];
  out.push(P("Chaque chapitre correspond à un groupe de TP du simulateur. Lisez le chapitre avant (ou après) les TP : le simulateur vous fait manipuler, le cours vous aide à comprendre. Les mots en **gras** sont à connaître ; le glossaire en fin de livret les regroupe."));
  for (const c of CH) {
    out.push(H1(`Chapitre ${c.n} — ${c.title}`, c.n !== 1 ? true : false));
    out.push(P(`*TP associés : ${c.tps}.*`, { run: { color: '595959' } }));
    out.push(P(c.intro));
    for (const s of c.sections) {
      out.push(H2(s.h));
      for (const t of s.p || []) out.push(P(t));
      for (const b of s.bullets || []) out.push(B(b));
      if (s.table) { out.push(table(s.table)); out.push(space(100)); }
      for (const t of s.p2 || []) out.push(P(t));
    }
    out.push(space(100));
    out.push(L.box('À retenir', c.keypoints.map(k => B(k)), L.LIGHT));
  }
  return out;
}
function tdBlock(t, teacher) {
  const out = [];
  out.push(H2(`TD ${t.n} — ${t.title}`));
  out.push(P(`*Chapitre ${t.ch || '—'}${t.ch ? '' : ' (synthèse)'} · ${t.duration} · ${t.mode}*`, { run: { color: '595959' } }));
  out.push(P(`**Objectif :** ${t.objectif}`));
  for (const e of t.enonce) out.push(P(e));
  if (t.table) { out.push(table(t.table)); out.push(space(100)); }
  t.qs.forEach((q, i) => {
    out.push(P(`**Q${i + 1}.** ${q.q}`, { before: 100, keepNext: true }));
    if (teacher) out.push(L.box('Réponse guidée', [q.a], L.GREEN, '2E7D32'));
    else out.push(...lines(3));
  });
  return out;
}
function glossary() {
  return [H1('Glossaire'), table({ head: ['Terme', 'Définition'], rows: M.glossary.map(g => [`**${g[0]}**`, g[1]]), widths: [2800, 6226] })];
}

// ---------- Livret élève ----------
function student() {
  const c = [];
  c.push(...cover('Livret de l\'élève', 'Cours, TD et TP complémentaires', [
    'Compagnon du simulateur InfraLab (yahnlp.github.io/InfraLab)', 'Entreprise fictive : NovaTech', 'Formation : BTS SIO option SISR', '',
    'Nom : ……………………………………………………   Classe : ……………………', 'Date de début : ……………………']));
  c.push(...toc([['Comment utiliser ce livret'], ['Partie 1 — Cours'], ...CH.map(x => [`Chapitre ${x.n} — ${x.title}`, 1]), ['Partie 2 — Travaux dirigés'], ...TD.map(t => [`TD ${t.n} — ${t.title}`, 1]), ['Partie 3 — Fiches TP (TP 1 à 46)'], ['Annexes et glossaire']]));
  c.push(H1('Comment utiliser ce livret', false));
  c.push(P("Ce livret accompagne le simulateur **InfraLab**. Le simulateur contient 46 TP guidés ; ce livret ajoute **du cours** (pour comprendre), des **TD** (pour s'entraîner sans machine) et, pour chaque TP, une **question pour aller plus loin**."));
  c.push(table({ head: ['Où', 'Quoi', 'Quand'], rows: [
    ['Partie 1', 'Cours : 8 chapitres', 'Avant, pendant ou après les TP du chapitre'],
    ['Partie 2', '18 TD à faire sur papier', 'En séance, seul ou en groupe'],
    ['Partie 3', 'Une fiche par TP (46) : objectifs, question de transfert, journal', 'Après chaque TP'],
    ['Annexes', 'Aide-mémoire : priorités, SLA, tickets, glossaire', 'Toujours à portée de main']], widths: [1500, 4326, 3200] }));
  c.push(space());
  c.push(box('Ce que l\'on attend de vous', [B('**Comprendre plutôt que cliquer** : avant chaque action, dites ce que vous attendez qu\'il se passe.'), B('Utiliser les indices **en dernier recours** : chaque indice réduit la part « autonomie » de votre score.'), B('Répondre aux questions de réflexion **par écrit**, avec vos mots.'), B('Dans les TP où le **temps compte** (encart « Horloge »), c\'est vous qui faites avancer l\'horloge simulée : +15 min, +1 h ou +1 jour.'), B('**Enregistrer** votre travail avec le bouton « Enregistrer » (Ctrl+S) dans le dossier de votre choix, et le rouvrir plus tard avec « Ouvrir » (Ctrl+O) : le TP reprend où vous l\'avez laissé. Le bouton « ? Aide » résume tout cela.'), B('Garder vos comptes rendus exportables (TP terminés) pour votre portfolio.')]));
  c.push(space());
  c.push(box('À propos des compétences', [NOTE], L.WARM, 'B26B00'));
  // cours
  c.push(...courseSection());
  // TD
  c.push(H1('Partie 2 — Travaux dirigés'));
  c.push(P("Les TD se font **sans simulateur**. Répondez dans les espaces prévus. Ils préparent ou prolongent les TP du chapitre indiqué."));
  const tdTable = TD.map(t => [`TD ${t.n}`, t.title, t.ch ? `Chap. ${t.ch}` : 'Synthèse', t.duration]);
  c.push(table({ head: ['N°', 'Titre', 'Cours', 'Durée'], rows: tdTable, widths: [900, 5300, 1500, 1326] }));
  TD.forEach((t, i) => { if (i) c.push(PB()); c.push(...tdBlock(t, false)); });
  // TP
  c.push(H1('Partie 3 — Fiches TP'));
  c.push(P("Une fiche par TP du simulateur. Après le TP, notez votre score, répondez à la question « pour aller plus loin », et faites-la valider par votre formateur."));
  for (const s of TP) {
    const tr = TR[s.number];
    c.push(H2(`TP ${s.number} — ${s.title}`));
    c.push(P(`*${s.levelLabel} · ${s.duration} · difficulté ${stars(s.difficulty)}*`, { run: { color: '595959' }, keepNext: true }));
    c.push(P(`**Contexte.** ${s.context}`, { keepNext: true }));
    if (s.timeNote) c.push(P(`**Horloge.** ${s.timeNote}`, { keepNext: true, run: { color: '7A4A00' } }));
    c.push(P('**Objectifs du TP**', { after: 40, keepNext: true }));
    for (const o of s.objectives) c.push(B(o.label));
    c.push(P(`**Compétence concernée :** ${skillsLine(s)}.`, { before: 80 }));
    c.push(P('**Pour aller plus loin.** ' + tr.q, { before: 80, keepNext: true }));
    c.push(...lines(3));
    c.push(table({ rows: [['Score : ………… / 100', 'Indices utilisés : …………', 'Date : ………………', 'Visa : …………']], widths: [2400, 2400, 2226, 2000] }));
    c.push(space(160));
  }
  // annexes
  c.push(H1('Annexes'));
  c.push(H2('A. Matrice de priorité'));
  c.push(table(CH[2].sections[2].table));
  c.push(H2('B. Cibles de SLA'));
  c.push(table(CH[4].sections[0].table));
  c.push(H2('C. Check-list d\'un bon ticket'));
  ['Qui ? Le demandeur est identifié.', 'Quoi ? Le symptôme est précis (message d\'erreur, application).', 'Où ? Un équipement est lié.', 'Quand ? Depuis quand, quelle fréquence.', 'Qualifié : catégorie, impact, urgence.', 'Solution : symptôme, cause, action, vérification.', 'Vérifié auprès de l\'utilisateur avant clôture.'].forEach(t => c.push(B('☐ ' + t)));
  c.push(H2('D. Statuts d\'un ticket'));
  c.push(P('Nouveau → Qualifié → Attribué → En cours → (En attente) → Résolu → Clos.'));
  c.push(H2('E. Cycle de vie d\'un actif'));
  c.push(P('Commandé → En stock → En service → (En réparation) → Retiré (définitif).'));
  c.push(...glossary());
  return doc('InfraLab — Livret de l\'élève', 'Cours, TD et TP complémentaires', c);
}

// ---------- Livret enseignant ----------
function qBlock(o) {
  const q = o.question; const out = [];
  out.push(P(`**${o.label}** — *${q.prompt}*`, { after: 40, keepNext: true }));
  q.choices.forEach((ch, i) => out.push(P(`${i === q.correct ? '✔' : '○'} ${ch}`, { after: 20, indent: { left: 400 }, run: i === q.correct ? { bold: true, color: '2E7D32' } : {} })));
  out.push(P(`*Explication affichée :* ${q.explain}`, { before: 40, indent: { left: 400 } }));
  return out;
}
function teacher() {
  const c = [];
  c.push(...cover('Livret de l\'enseignant', 'Réponses guidées, corrigés et conduite des séances', [
    'Compagnon du simulateur InfraLab (yahnlp.github.io/InfraLab)', 'Complète le livret de l\'élève', 'Ne pas diffuser aux élèves', '', 'Version : octobre 2026']));
  c.push(...toc([['Utiliser ce livret : progression, évaluation, accompagnement'], ['Partie A — Corrigés des TD'], ...TD.map(t => [`TD ${t.n} — ${t.title}`, 1]), ['Partie B — Guides par TP (TP 1 à 46)'], ['Glossaire']]));
  c.push(H1('Utiliser ce livret', false));
  c.push(P("Ce livret contient les **corrigés des 18 TD**, un **guide par TP** (46) avec les réponses aux questions du simulateur, le parcours attendu, les indices et les pièges, et des repères pour conduire les séances et évaluer."));
  c.push(box('Parti pris pédagogique', [P("Le simulateur ne donne pas la solution : il guide. Les *réponses guidées* de ce livret sont destinées à **vous** pour accompagner. Évitez de les donner d'emblée : posez d'abord la question « qu'attendez-vous qu'il se passe ? »."), P("« Comprendre plutôt que cliquer » : un élève qui réussit un TP sans pouvoir expliquer pourquoi n'a pas compris.")]));
  c.push(space());
  c.push(box('Compétences : formulation à respecter', [NOTE], L.WARM, 'B26B00'));
  c.push(H2('Progression conseillée'));
  c.push(table({ head: ['Séance', 'Contenu'], rows: M.sessions.map(s => [s[0], s[1]]), widths: [2200, 6826] }));
  c.push(P("*Le découpage est indicatif (11 séances de 2 heures). Les TP 36 à 40, 45 et 46 peuvent être traités en autonomie guidée.*", { before: 80 }));
  c.push(H2('Comment lire le score du simulateur'));
  c.push(P("Le score sur 100 se compose de **70 points** d'objectifs, **20 points** de qualité (ticket décrit, solution documentée, vérification) et **10 points** d'autonomie. L'autonomie baisse de 2 points par niveau d'indice, de 1 point par mauvaise réponse à une question, et tombe à 0 si l'élève consulte la solution. Un score élevé avec peu d'autonomie signifie « a réussi en étant guidé » : c'est une information, pas un jugement."));
  c.push(H2('Grille d\'évaluation'));
  c.push(table(Object.assign({}, M.grid, { widths: [1800, 1500, 1700, 2000, 2026] })));
  c.push(P("*À adapter à la séance. Les niveaux ne remplacent pas votre jugement : ils servent à objectiver.*", { before: 80 }));
  c.push(H2('Quand un élève est bloqué'));
  ['Faire reformuler l\'objectif avec ses mots.', 'Demander dans quelle vue il se trouve (Infrastructure ou ITSM).', 'Demander ce qu\'il a vérifié avant d\'agir.', 'Renvoyer vers la leçon de l\'étape plutôt que vers l\'indice.', 'Ne conseiller l\'indice niveau 3 qu\'en dernier recours.'].forEach(t => c.push(B(t)));
  c.push(H2('Utiliser la vue formateur et le compte rendu'));
  c.push(P("À la fin d'un TP, l'élève peut exporter un **compte rendu (HTML)** et ses **données (JSON)**. Le compte rendu contient les objectifs, les réponses, les indices, le score et la chronologie des actions. Il peut servir d'**élément de preuve possible** dans un portfolio, à condition que l'élève l'accompagne de sa propre analyse."));

  // Corrigés TD
  c.push(H1('Partie A — Corrigés des TD'));
  c.push(P("Pour chaque question, la **réponse guidée** donne l'attendu et, quand c'est utile, la discussion. Les réponses acceptables sont souvent plus larges : jugez la justification."));
  TD.forEach((t, i) => { if (i) c.push(PB()); c.push(...tdBlock(t, true)); });

  // Guides TP
  c.push(H1('Partie B — Guides par TP'));
  c.push(P("Pour chaque TP : le contexte, la liste des objectifs avec les réponses aux questions, le parcours attendu, les indices fournis, la question « pour aller plus loin » avec sa réponse, le piège le plus fréquent et le lien avec la réalité professionnelle."));
  const lvls = [...new Set(TP.map(s => s.levelLabel))];
  for (const s of TP) {
    const tr = TR[s.number];
    c.push(H2(`TP ${s.number} — ${s.title}`));
    c.push(P(`*${s.levelLabel} · ${s.duration} · difficulté ${stars(s.difficulty)} · ${skillsLine(s)}*`, { run: { color: '595959' }, keepNext: true }));
    c.push(P(`**Contexte.** ${s.context}`));
    if (s.timeNote) c.push(P(`**Horloge.** ${s.timeNote}`));
    c.push(H3('Objectifs et réponses attendues'));
    const qs = s.objectives.filter(o => o.question), auto = s.objectives.filter(o => !o.question);
    if (auto.length) { c.push(P('*Vérifiés automatiquement par le simulateur :*', { after: 40 })); auto.forEach(o => c.push(B(o.label))); }
    if (qs.length) { c.push(P('*Questions posées :*', { after: 40, before: 80 })); qs.forEach(o => c.push(...qBlock(o))); }
    c.push(H3('Parcours attendu'));
    (s.solutionText || []).forEach((t, i) => c.push(P(`${i + 1}. ${t}`, { after: 40, indent: { left: 300 } })));
    if (s.hints && s.hints.length) {
      c.push(H3('Indices proposés'));
      for (const h of s.hints) {
        const o = s.objectives.find(x => x.id === h.for);
        c.push(P(`**${o ? o.label : h.for}**`, { after: 20, keepNext: true }));
        (h.levels || []).forEach((lv, i) => c.push(P(`Niveau ${i + 1} : ${lv}`, { after: 20, indent: { left: 300 } })));
      }
    }
    c.push(box('Pour aller plus loin — réponse guidée', [P(`**Question :** ${tr.q}`), P(`**Réponse :** ${tr.a}`)], L.GREEN, '2E7D32'));
    c.push(space(60));
    c.push(box('Piège fréquent', [tr.trap], L.WARM, 'B26B00'));
    if (s.realWorld) { c.push(space(60)); c.push(P(`**Dans la réalité.** ${s.realWorld}`)); }
    c.push(space(120));
  }
  c.push(...glossary());
  return doc('InfraLab — Livret de l\'enseignant', 'Réponses guidées et corrigés', c);
}

(async () => {
  for (const [name, mk] of [['InfraLab-Livret-eleve.docx', student], ['InfraLab-Livret-enseignant.docx', teacher]]) {
    const buf = await d.Packer.toBuffer(mk()); fs.writeFileSync(`${OUT}/${name}`, buf); console.log(name, buf.length);
  }
})();
