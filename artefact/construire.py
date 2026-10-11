#!/usr/bin/env python3
"""Construit la version « artefact claude.ai » (un seul fichier HTML) à partir de app/.

Différences avec la version locale :
- pas de serveur : les données sont stockées dans la base de l'artefact (capacité db),
  ou à défaut dans le navigateur ;
- navigation interne (pas d'URL #/...) ;
- PDF généré dans la page (html2pdf) et proposé au téléchargement.
"""
import os, re

ICI = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(ICI, '..', 'app')
js = open(os.path.join(APP, 'app.js'), encoding='utf-8').read()
css = open(os.path.join(APP, 'style.css'), encoding='utf-8').read()


def remplacer(texte, ancien, nouveau, n=1):
    trouve = texte.count(ancien)
    assert trouve == n, f'{trouve} occurrence(s) au lieu de {n} : {ancien[:70]!r}'
    return texte.replace(ancien, nouveau)


# ---------- stockage ----------
debut = js.index('async function api(')
fin = js.index('const trouver =')
js = js[:debut] + r'''let DB = null;
const CLE_LOCALE = 'gestion-activite-v1';

async function chargerTout() {
  try { DB = window.claude && window.claude.use ? await window.claude.use('db') : null; } catch (e) { DB = null; }
  if (DB) {
    try {
      await Promise.all(COLLECTIONS.map(async c => {
        const s = await DB.collection(c).get();
        S[c] = s.docs.map(d => ({ ...copie(d.data()), id: Number(d.id) })).sort((a, b) => a.id - b.id);
      }));
      return;
    } catch (e) { console.warn('db indisponible', e); DB = null; }
  }
  let data = {};
  try { data = JSON.parse(localStorage.getItem(CLE_LOCALE) || '{}'); } catch (e) { /* stockage bloqué */ }
  COLLECTIONS.forEach(c => { S[c] = Array.isArray(data[c]) ? data[c] : []; });
}

function persisterLocal() { try { localStorage.setItem(CLE_LOCALE, JSON.stringify(S)); } catch (e) { /* ignore */ } }

const filesEcriture = {}; // une écriture à la fois par document
function ecrire(col, obj) {
  if (!DB) { persisterLocal(); return Promise.resolve(); }
  const corps = copie(obj); delete corps.id;
  const cle = col + '/' + obj.id;
  const p = (filesEcriture[cle] || Promise.resolve()).catch(() => {}).then(() => DB.collection(col).doc(String(obj.id)).set(corps));
  filesEcriture[cle] = p;
  return p;
}

async function sauver(col, obj) {
  const t = new Date().toISOString().slice(0, 19);
  if (!obj.id) { obj.id = S[col].reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1; obj.cree_le = t; }
  obj.modifie_le = t;
  const i = S[col].findIndex(x => x.id === obj.id);
  if (i >= 0) S[col][i] = obj; else S[col].push(obj);
  try { await ecrire(col, obj); } catch (e) {
    toast('Erreur d\'enregistrement : ' + (e && e.code === 'quota_exceeded' ? 'espace de stockage plein' : (e && e.message) || e), true);
    throw e;
  }
  return obj;
}

async function supprimer(col, id) {
  S[col] = S[col].filter(x => x.id !== id);
  if (DB) await DB.collection(col).doc(String(id)).delete(); else persisterLocal();
}

async function remplacerTout(data) {
  for (const c of COLLECTIONS) {
    if (DB) for (const x of S[c]) await DB.collection(c).doc(String(x.id)).delete();
    S[c] = [];
    for (const x of (data[c] || [])) { const o = copie(x); if (!o.id) continue; o.id = Number(o.id); S[c].push(o); await ecrire(c, o); }
  }
  persisterLocal();
}

''' + js[fin:]

# ---------- navigation interne ----------
js = re.sub(r'location\.hash = ([^;]+);', r'naviguer(\1);', js)
js = remplacer(js, "const [vue, id] = (location.hash.replace(/^#\\/?/, '') || 'tableau').split('/');",
               "const [vue, id] = route.split('/');")
js = remplacer(js, "window.addEventListener('hashchange', render);", r'''let route = /^#[a-z]+$/.test(location.hash) ? location.hash.slice(1) : 'tableau';
function naviguer(h) { route = String(h).replace(/^#\/?/, '') || 'tableau'; render(); window.scrollTo(0, 0); }
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#/"]');
  if (!a || e.defaultPrevented) return;
  e.preventDefault(); naviguer(a.getAttribute('href'));
});''')

# ---------- tableaux défilants sur petit écran ----------
js = js.replace('<table class="liste">', '<div class="defile"><table class="liste">')
js = js.replace('<table class="lignes">', '<div class="defile"><table class="lignes">')
js = remplacer(js, '<table><thead><tr><th>Désignation</th>', '<div><table><thead><tr><th>Désignation</th>')
js = js.replace('</table>', '</table></div>')

# ---------- couleurs en dur -> jetons ----------
js = remplacer(js, 'style="border-color:#f0c36d;background:#fffaf0"', 'style="border-color:var(--alerte);background:var(--alerte-fond)"')
js = remplacer(js, 'border-color:#b5dfc4', 'border-color:var(--succes)')

# ---------- aperçu + PDF ----------
debut = js.index('function imprimer(col, doc)')
fin = js.index('/* ---------------------------------------------------------------------\n   Paramètres & sauvegarde')
js = js[:debut] + r'''function imprimer(col, doc) {
  const client = (nomClient(doc.clientId) || '').replace(/[^\w\-]+/g, '_');
  const nom = `${doc.numero || 'brouillon'}_${client}`;
  modal('Aperçu – ' + (doc.numero || 'brouillon'), `<div class="papier-cadre"><div class="papier">${docHtml(col, doc)}</div></div>`, [
    { l: 'Fermer' },
    { l: '⬇ Télécharger le PDF', cls: 'primaire', f: async () => { await telechargerPdf(col, doc, nom); return false; } },
  ], true);
}

async function telechargerPdf(col, doc, nom) {
  if (!window.html2pdf) return toast('Le module PDF n\'a pas pu se charger.', true);
  const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
  if (!dl) return toast('Le téléchargement n\'est pas disponible dans cette vue.', true);
  toast('Préparation du PDF…');
  const hote = document.createElement('div');
  hote.style.cssText = 'position:fixed;left:-10000px;top:0;';
  hote.innerHTML = `<div class="papier">${docHtml(col, doc)}</div>`;
  document.body.appendChild(hote);
  try {
    const blob = await html2pdf().set({
      margin: [10, 10, 12, 10], image: { type: 'jpeg', quality: 0.96 },
      html2canvas: { scale: 2, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: 'css', avoid: ['tr', '.d-totaux', '.d-signature', '.d-cond', '.d-pied'] },
    }).from(hote.firstElementChild).outputPdf('blob');
    await dl.save({ filename: nom + '.pdf', data: blob });
    toast('PDF enregistré');
  } catch (e) {
    if (e && e.code !== 'declined') toast('Échec du PDF : ' + ((e && e.message) || e), true);
  } finally { hote.remove(); }
}

''' + js[fin:]
js = remplacer(js, "${brouillon ? '<div style=\"position:fixed;", "${brouillon ? '<div style=\"position:absolute;")

# ---------- sauvegarde ----------
js = remplacer(js, '''<p>Vos données sont dans le fichier <code>donnees/gestion.db</code> du dossier de l'application. Une copie automatique est faite à chaque démarrage dans <code>donnees/sauvegardes/</code>.</p>''',
               '''<p id="info-stockage"></p>''')
js = remplacer(js, '<a class="btn" href="/api/export" download>⬇ Télécharger une sauvegarde (.json)</a>',
               '<button class="btn" id="exporter">⬇ Télécharger une sauvegarde (.json)</button>')
js = remplacer(js, "await api('POST', '/api/import', data);\n    await chargerTout();", "await remplacerTout(data);")
js = remplacer(js, "  $('#restaurer').onchange", r'''  $('#info-stockage').textContent = DB
    ? 'Vos données sont enregistrées dans cet artefact. Elles ne sont lisibles que par vous, même si vous partagez le lien.'
    : 'Le stockage en ligne n\'est pas disponible dans cette vue : les données sont gardées dans ce navigateur uniquement.';
  $('#exporter').onclick = async () => {
    const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    if (!dl) return toast('Le téléchargement n\'est pas disponible dans cette vue.', true);
    const data = {}; COLLECTIONS.forEach(c => { data[c] = S[c]; });
    try { await dl.save({ filename: `gestion_sauvegarde_${auj()}.json`, data: JSON.stringify(data, null, 1) }); toast('Sauvegarde enregistrée'); }
    catch (e) { if (e && e.code !== 'declined') toast('Échec : ' + e.message, true); }
  };
  $('#restaurer').onchange''')

# ---------- données d'exemple ----------
js = remplacer(js, "Commencez par renseigner vos informations (nom, SIRET, adresse, IBAN…) dans <a class=\"lien\" href=\"#/parametres\">Paramètres</a> : elles apparaîtront sur vos devis et factures.",
               "Commencez par renseigner vos informations (nom, SIRET, adresse, IBAN…) dans <a class=\"lien\" href=\"#/parametres\">Paramètres</a> : elles apparaîtront sur vos devis et factures.${S.clients.length ? '' : ' Pour découvrir l\\'outil, vous pouvez aussi <a class=\"lien\" href=\"#\" onclick=\"chargerExemple();return false\">charger un exemple</a> (client, projet, livrables, devis — à supprimer ensuite).'}")
js = remplacer(js, "/* ---------------------------------------------------------------------\n   Démarrage", r'''async function chargerExemple() {
  const c = await sauver('clients', { nom: 'Hydrotech Industries (exemple)', type: 'Entreprise', contact: 'Mme Lefèvre', fonction: 'Responsable méthodes', email: 'methodes@exemple.fr', tel: '04 00 00 00 00', adresse: '8 avenue de l\'Industrie', cp: '38000', ville: 'Grenoble', notes: 'Données d\'exemple : supprimez-les quand vous voulez.' });
  const pr = await sauver('projets', { ref: `P-${auj().slice(0, 4)}-001`, titre: 'Banc d\'essai de vannes (exemple)', clientId: String(c.id), domaine: 'Conception mécanique', statut: 'En cours', dateDebut: ajouterJours(auj(), -20), dateFin: ajouterJours(auj(), 40), budget: 6800, description: 'Conception d\'un banc d\'essai d\'étanchéité pour vannes DN50 à DN150, 16 bar.' });
  const pid = String(pr.id);
  await sauver('livrables', { projetId: pid, nom: 'Modèle 3D du bâti', reference: 'BEV-100', type: 'Modèle 3D', indice: 'B', statut: 'Livré', datePrevue: ajouterJours(auj(), -5), dateLivraison: ajouterJours(auj(), -6), historique: [{ indice: 'A', date: ajouterJours(auj(), -12), statut: 'Livré' }] });
  await sauver('livrables', { projetId: pid, nom: 'Mise en plan ensemble', reference: 'BEV-100-PL', type: 'Plan 2D / mise en plan', indice: 'A', statut: 'En cours', datePrevue: ajouterJours(auj(), 9) });
  await sauver('livrables', { projetId: pid, nom: 'Note de calcul bride de serrage', type: 'Note de calcul', indice: 'A', statut: 'À faire', datePrevue: ajouterJours(auj(), 16) });
  for (const [j, h, d] of [[-18, 4, 'Analyse du cahier des charges'], [-15, 7, 'Pré-étude, architecture du bâti'], [-10, 6.5, 'Modélisation 3D'], [-3, 3, 'Reprise suite revue client (indice B)']]) {
    await sauver('temps', { date: ajouterJours(auj(), j), heures: h, projetId: pid, description: d, facturable: true });
  }
  const p = P();
  await sauver('devis', { numero: prochainNumero(p.prefixDevis, auj().slice(0, 4), S.devis.map(x => x.numero)), date: ajouterJours(auj(), -22), dateValidite: ajouterJours(auj(), 8), statut: 'Accepté', clientId: String(c.id), projetId: pid, objet: 'Banc d\'essai de vannes', acompte: 30, tva: null, conditions: p.conditionsDevis, notes: '',
    lignes: [{ type: 'titre', designation: 'Phase 1 – Avant-projet' }, { designation: 'Analyse du besoin, architecture, pré-dimensionnement', qte: 2, unite: 'j', pu: 450 },
      { type: 'titre', designation: 'Phase 2 – Conception détaillée' }, { designation: 'Modélisation 3D, mises en plan, nomenclature', qte: 6, unite: 'j', pu: 450 }, { designation: 'Note de calcul bride de serrage', qte: 1, unite: 'forfait', pu: 600 }] });
  toast('Exemple chargé'); naviguer('projets/' + pr.id);
}

/* ---------------------------------------------------------------------
   Démarrage''')

js = remplacer(js, '''<p>Lancez l'application avec <strong>Lancer.bat</strong> (Windows) ou <strong>lancer.sh</strong> (Mac/Linux), puis rechargez cette page.</p>''',
               '''<p>Rechargez la page. Si le problème persiste, vos données restent intactes : réessayez plus tard.</p>''')
js = remplacer(js, '<h2>Impossible de joindre le serveur local</h2>', '<h2>Chargement impossible</h2>')
assert 'api(' not in js and 'location.hash =' not in js and 'window.print' not in js

# ---------- CSS ----------
css = css[css.index('* { box-sizing'):]
css = re.sub(r'/\* ---------- document imprimable.*?(?=\.doc \{)', '', css, flags=re.S)
css = re.sub(r'@media print \{.*?\n\}\n', '', css, flags=re.S)
for a, b in [
    ('background: #fff; border: 1px solid var(--bordure)', 'background: var(--champ); border: 1px solid var(--bordure)'),
    ('#modal { background: #fff;', '#modal { background: var(--surface);'),
    ('.btn.primaire { background: var(--primaire); border-color: var(--primaire); color: #fff; }', '.btn.primaire { background: var(--primaire); border-color: var(--primaire); color: var(--sur-primaire); }'),
    ('.btn.primaire:hover { background: #184e9e; }', '.btn.primaire:hover { background: var(--primaire-fort); }'),
    ('.btn.succes { background: var(--succes); border-color: var(--succes); color: #fff; }', '.btn.succes { background: var(--succes); border-color: var(--succes); color: var(--sur-primaire); }'),
    ('.graph .col:hover .b { background: #184e9e; }', '.graph .col:hover .b { background: var(--primaire-fort); }'),
    ('background: var(--texte); color: #fff; padding: 4px 8px', 'background: var(--texte); color: var(--fond); padding: 4px 8px'),
    ('#toast { position: fixed; bottom: 24px; right: 24px; background: var(--texte); color: #fff;', '#toast { position: fixed; bottom: calc(24px + env(safe-area-inset-bottom, 0px)); right: 24px; background: var(--texte); color: var(--fond);'),
    ('#nav .marque { padding: 20px 18px 16px; color: #fff;', '#nav .marque { padding: 20px 18px 16px; color: var(--nav-fort);'),
    ('#nav a:hover { background: rgba(255,255,255,.05); color: #fff; }', '#nav a:hover { background: rgba(255,255,255,.05); color: var(--nav-fort); }'),
    ('#nav a.actif { background: rgba(255,255,255,.08); color: #fff; border-left-color: #5b9bff; }', '#nav a.actif { background: rgba(255,255,255,.08); color: var(--nav-fort); border-left-color: var(--nav-accent); }'),
    ('color: #7d879a; }', 'color: var(--nav-discret); }'),
    ('outline: 2px solid #9cc0f5;', 'outline: 2px solid var(--focus);'),
    ('position: sticky; top: 0; height: 100vh;', 'position: sticky; top: env(safe-area-inset-top, 0px); height: 100vh; overflow-y: auto;'),
    ('background: rgba(15, 22, 35, .45);', 'background: var(--voile);'),
]:
    css = remplacer(css, a, b)

TOKENS = '''/* Bureau d'études : barre latérale « bleu plan », papier blanc pour les documents, chiffres alignés. */
:root {
  --fond: #f2f4f7; --surface: #ffffff; --champ: #ffffff; --bordure: #d9dee7;
  --texte: #1b2230; --texte-2: #566173; --texte-3: #7f8a9c;
  --primaire: #1f5fbf; --primaire-fort: #184e9e; --primaire-clair: #e6eefb; --sur-primaire: #ffffff; --focus: #9cc0f5;
  --nav: #14213a; --nav-texte: #c2cadb; --nav-fort: #ffffff; --nav-accent: #5b9bff; --nav-discret: #7d879a;
  --succes: #1e7f47; --succes-fond: #e1f3e8; --alerte: #a86300; --alerte-fond: #fff2d9;
  --danger: #b8382b; --danger-fond: #fce6e3; --gris-fond: #eaedf2; --voile: rgba(15, 22, 35, .45);
  --rayon: 8px; --ombre: 0 1px 3px rgba(20, 30, 50, .08);
  --police: "IBM Plex Sans", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
  --police-titre: "IBM Plex Sans Condensed", "IBM Plex Sans", "Arial Narrow", sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --fond: #0f141d; --surface: #171e2a; --champ: #1d2533; --bordure: #2c3647;
  --texte: #e4e8ef; --texte-2: #a6b0c0; --texte-3: #7d889a;
  --primaire: #4d8ef0; --primaire-fort: #6aa1f5; --primaire-clair: #1b2c47; --sur-primaire: #0b1220; --focus: #4d8ef0;
  --nav: #0b1019; --nav-texte: #aab4c6; --nav-fort: #ffffff; --nav-accent: #6aa1f5; --nav-discret: #6c778a;
  --succes: #4cc27f; --succes-fond: #15301f; --alerte: #f0a63a; --alerte-fond: #33260f;
  --danger: #f07468; --danger-fond: #3a1a17; --gris-fond: #232c3b; --voile: rgba(0, 0, 0, .6);
  --ombre: 0 1px 3px rgba(0, 0, 0, .4); color-scheme: dark;
} }
:root[data-theme="dark"] {
  --fond: #0f141d; --surface: #171e2a; --champ: #1d2533; --bordure: #2c3647;
  --texte: #e4e8ef; --texte-2: #a6b0c0; --texte-3: #7d889a;
  --primaire: #4d8ef0; --primaire-fort: #6aa1f5; --primaire-clair: #1b2c47; --sur-primaire: #0b1220; --focus: #4d8ef0;
  --nav: #0b1019; --nav-texte: #aab4c6; --nav-fort: #ffffff; --nav-accent: #6aa1f5; --nav-discret: #6c778a;
  --succes: #4cc27f; --succes-fond: #15301f; --alerte: #f0a63a; --alerte-fond: #33260f;
  --danger: #f07468; --danger-fond: #3a1a17; --gris-fond: #232c3b; --voile: rgba(0, 0, 0, .6);
  --ombre: 0 1px 3px rgba(0, 0, 0, .4); color-scheme: dark;
}
'''
css = TOKENS + css
css = remplacer(css, 'font-family: "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;', 'font-family: var(--police);')
css += '''
html, body { height: auto; min-height: 100%; }
.entete h1, .carte h2, .kpi .val, #nav .marque { font-family: var(--police-titre); }
.entete h1 { text-wrap: balance; }
.defile { overflow-x: auto; max-width: 100%; }
.carte, .kpi, main { min-width: 0; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
/* Document : papier blanc dans les deux thèmes */
.papier-cadre { overflow-x: auto; background: var(--gris-fond); padding: 16px; border-radius: 6px; }
.papier { width: 718px; background: #ffffff; color: #111111; padding: 28px; position: relative; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,.15); }
.papier .doc { position: relative; overflow: hidden; }
@media (max-width: 520px) { .g4 { grid-template-columns: 1fr; } .entete h1 { font-size: 19px; } }
@media (prefers-reduced-motion: reduce) { #toast { transition: none; } }
'''

html = open(os.path.join(APP, 'index.html'), encoding='utf-8').read()
corps = html[html.index('<div id="app">'):html.index('<script src="app.js">')]
corps = re.sub(r'href="#/', 'href="#/', corps)
corps = remplacer(corps, '<div class="bas">Données enregistrées localement<br>dans donnees/gestion.db</div>', '<div class="bas">Données privées,<br>visibles par vous seul</div>')
corps = remplacer(corps, '  <div id="impression"></div>\n', '')

sortie = f'''<title>Gestion d'activité</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Condensed:wght@500;600&display=swap">
<style>
{css}</style>
{corps}<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<script>
{js}</script>
'''
open(os.path.join(ICI, 'gestion-activite.html'), 'w', encoding='utf-8').write(sortie)
print('OK', len(sortie), 'octets')
