/* =====================================================================
   Gestion d'activité — interface (JavaScript sans dépendance)
   ===================================================================== */
'use strict';

/* ---------------------------------------------------------------------
   Outils
   --------------------------------------------------------------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtEur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const fmtNb = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const eur = n => fmtEur.format(Number(n) || 0);
const nb = n => fmtNb.format(Number(n) || 0);
const arrondi = n => Math.round((Number(n) || 0) * 100) / 100;
const fdate = d => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function auj() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function ajouterJours(date, n) {
  const d = new Date((date || auj()) + 'T12:00:00');
  d.setDate(d.getDate() + (Number(n) || 0));
  return d.toISOString().slice(0, 10);
}
const annee = d => (d || '').slice(0, 4);
const copie = o => JSON.parse(JSON.stringify(o));

function toast(msg, erreur = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'visible' + (erreur ? ' erreur' : '');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.className = ''), 2500);
}

/* ---------------------------------------------------------------------
   Données (API locale)
   --------------------------------------------------------------------- */
const COLLECTIONS = ['parametres', 'clients', 'projets', 'devis', 'factures', 'livrables', 'temps'];
const S = {};

async function api(methode, url, corps) {
  const r = await fetch(url, {
    method: methode,
    headers: { 'Content-Type': 'application/json' },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  if (!r.ok) {
    let m = r.statusText;
    try { m = (await r.json()).erreur || m; } catch (e) { /* ignore */ }
    throw new Error(m);
  }
  return r.json();
}

async function chargerTout() {
  await Promise.all(COLLECTIONS.map(async c => { S[c] = await api('GET', '/api/' + c); }));
}

async function sauver(col, obj) {
  try {
    const r = obj.id ? await api('PUT', `/api/${col}/${obj.id}`, obj) : await api('POST', `/api/${col}`, obj);
    Object.assign(obj, r);
    const i = S[col].findIndex(x => x.id === obj.id);
    if (i >= 0) S[col][i] = obj; else S[col].push(obj);
    return obj;
  } catch (e) {
    toast('Erreur d\'enregistrement : ' + e.message, true);
    throw e;
  }
}

async function supprimer(col, id) {
  await api('DELETE', `/api/${col}/${id}`);
  S[col] = S[col].filter(x => x.id !== id);
}

const trouver = (col, id) => S[col].find(x => String(x.id) === String(id));
const nomClient = id => trouver('clients', id)?.nom || '—';
const titreProjet = id => { const p = trouver('projets', id); return p ? `${p.ref} – ${p.titre}` : '—'; };

/* ---------------------------------------------------------------------
   Paramètres par défaut
   --------------------------------------------------------------------- */
const DEFAUTS = {
  nom: '', activite: 'Conception mécanique & logiciels métiers pour l\'industrie', mentionEI: true,
  adresse: '', cp: '', ville: '', tel: '', email: '', site: '', siret: '', ape: '',
  banque: '', iban: '', bic: '',
  prefixDevis: 'D', prefixFacture: 'F', delaiPaiement: 30, validiteDevis: 30, acompteDefaut: 30,
  tauxHoraire: 55, tauxJournalier: 450,
  tvaApplicable: false, tauxTVA: 20, mentionTVA: 'TVA non applicable, art. 293 B du CGI',
  penalites: 'En cas de retard de paiement, des pénalités de retard sont exigibles au taux égal à trois fois le taux d\'intérêt légal en vigueur, ainsi qu\'une indemnité forfaitaire pour frais de recouvrement de 40 € (art. L.441-10 et D.441-5 du Code de commerce). Pas d\'escompte pour paiement anticipé.',
  conditionsDevis: 'Les fichiers sources (CAO, code source) restent la propriété du prestataire jusqu\'au paiement intégral. Toute modification du cahier des charges fera l\'objet d\'un avenant.',
  mentionPied: 'Dispensé d\'immatriculation au registre du commerce et des sociétés (RCS) et au répertoire des métiers (RM)',
  tauxCotisations: 26.1, plafondCA: 83600, seuilTVA: 37500,
};
const P = () => ({ ...DEFAUTS, ...(S.parametres[0] || {}) });

/* ---------------------------------------------------------------------
   Listes de valeurs
   --------------------------------------------------------------------- */
const DOMAINES = ['Conception mécanique', 'Logiciel métier', 'Calcul / simulation', 'Conseil / expertise', 'Autre'];
const STATUTS_PROJET = ['Prospect', 'En cours', 'En pause', 'Terminé', 'Annulé'];
const STATUTS_DEVIS = ['Brouillon', 'Envoyé', 'Accepté', 'Refusé', 'Expiré'];
const TYPES_LIVRABLE = ['Modèle 3D', 'Plan 2D / mise en plan', 'Nomenclature', 'Note de calcul', 'Cahier des charges', 'Rapport / étude', 'Logiciel / exécutable', 'Code source', 'Documentation', 'Autre'];
const STATUTS_LIVRABLE = ['À faire', 'En cours', 'En vérification', 'Livré', 'Validé client'];
const UNITES = ['h', 'j', 'forfait', 'u', 'lot', 'mois'];
const MODES_PAIEMENT = ['Virement', 'Chèque', 'Espèces', 'Carte bancaire', 'Autre'];

const COULEUR_STATUT = {
  'Prospect': '', 'En cours': 'bleu', 'En pause': 'orange', 'Terminé': 'vert', 'Annulé': '',
  'Brouillon': '', 'Envoyé': 'bleu', 'Accepté': 'vert', 'Refusé': 'rouge', 'Expiré': 'orange',
  'À faire': '', 'En vérification': 'orange', 'Livré': 'vert', 'Validé client': 'vert',
};
const badge = (txt, couleur) => `<span class="badge ${couleur ?? COULEUR_STATUT[txt] ?? ''}">${esc(txt)}</span>`;

/* ---------------------------------------------------------------------
   Calculs métier
   --------------------------------------------------------------------- */
function totaux(doc) {
  const ht = arrondi((doc.lignes || []).filter(l => l.type !== 'titre')
    .reduce((s, l) => s + (Number(l.qte) || 0) * (Number(l.pu) || 0), 0));
  const tva = doc.tva ? arrondi(ht * doc.tva / 100) : 0;
  return { ht, tva, ttc: arrondi(ht + tva) };
}

function etatFacture(f) {
  if (f.statut === 'brouillon') return ['Brouillon', ''];
  if (f.statut === 'annulee') return ['Annulée (avoir)', ''];
  if (f.type === 'avoir') {
    if (f.statut === 'payee') return ['Remboursé', 'vert'];
    if (f.statut === 'solde') return ['Avoir soldé', 'vert'];
    return ['À rembourser', 'orange'];
  }
  if (f.statut === 'payee') return ['Payée', 'vert'];
  if (f.dateEcheance && f.dateEcheance < auj()) return ['En retard', 'rouge'];
  return ['À payer', 'bleu'];
}
const badgeFacture = f => { const [t, c] = etatFacture(f); return badge(t, c); };
const factureAPayer = f => f.type !== 'avoir' && f.statut === 'emise';
const factureEnRetard = f => factureAPayer(f) && f.dateEcheance && f.dateEcheance < auj();

function etatDevis(d) {
  if (d.statut === 'Envoyé' && d.dateValidite && d.dateValidite < auj()) return 'Expiré';
  return d.statut;
}

function prochainNumero(prefixe, an, liste) {
  const re = new RegExp('^' + prefixe.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-' + an + '-(\\d+)$');
  const max = liste.reduce((m, x) => { const r = re.exec(x || ''); return r ? Math.max(m, Number(r[1])) : m; }, 0);
  return `${prefixe}-${an}-${String(max + 1).padStart(3, '0')}`;
}

function indiceSuivant(ind) {
  ind = String(ind || '').trim();
  if (!ind) return 'A';
  if (/^[A-Z]+$/i.test(ind)) {
    const l = ind.toUpperCase().split('');
    let i = l.length - 1;
    while (i >= 0) { if (l[i] === 'Z') { l[i] = 'A'; i--; } else { l[i] = String.fromCharCode(l[i].charCodeAt(0) + 1); break; } }
    if (i < 0) l.unshift('A');
    return l.join('');
  }
  const m = ind.match(/^(.*?)(\d+)$/);
  if (m) return m[1] + (Number(m[2]) + 1);
  return ind + '-2';
}

/* ---------------------------------------------------------------------
   Formulaires génériques
   --------------------------------------------------------------------- */
function champ(c, v) {
  const val = v ?? c.def ?? '';
  if (c.t === 'checkbox') {
    return `<label class="champ case ${c.plein ? 'plein' : ''}"><input type="checkbox" name="${c.n}" ${val ? 'checked' : ''}> ${esc(c.l)}</label>`;
  }
  let inp;
  if (c.t === 'select') {
    const opts = typeof c.opts === 'function' ? c.opts() : c.opts;
    inp = `<select name="${c.n}">${opts.map(o => {
      const [k, l] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(k)}" ${String(k) === String(val) ? 'selected' : ''}>${esc(l)}</option>`;
    }).join('')}</select>`;
  } else if (c.t === 'textarea') {
    inp = `<textarea name="${c.n}" rows="${c.rows || 3}">${esc(val)}</textarea>`;
  } else {
    inp = `<input type="${c.t || 'text'}" name="${c.n}" value="${esc(val)}" ${c.step ? `step="${c.step}"` : ''} placeholder="${esc(c.ph || '')}">`;
  }
  return `<label class="champ ${c.plein ? 'plein' : ''}">${esc(c.l)}${c.req ? ' *' : ''}${inp}${c.aide ? `<span class="aide">${esc(c.aide)}</span>` : ''}</label>`;
}

const formHtml = (champs, obj = {}, cls = '') =>
  `<form class="form-grille ${cls}" onsubmit="return false">${champs.map(c => (c.titre ? `<h3>${esc(c.titre)}</h3>` : champ(c, obj[c.n]))).join('')}</form>`;

function lireForm(form, champs) {
  const o = {};
  for (const c of champs) {
    if (!c.n || !form.elements[c.n]) continue;
    const e = form.elements[c.n];
    o[c.n] = c.t === 'checkbox' ? e.checked : c.t === 'number' ? (e.value === '' ? '' : Number(e.value)) : e.value.trim();
  }
  return o;
}

function verifierRequis(champs, data) {
  const manquant = champs.find(c => c.req && (data[c.n] === '' || data[c.n] == null));
  if (manquant) { toast(`Le champ « ${manquant.l} » est obligatoire`, true); return false; }
  return true;
}

/* ---------------------------------------------------------------------
   Fenêtre modale
   --------------------------------------------------------------------- */
function modal(titre, corps, boutons = [], large = false) {
  $('#modal-titre').textContent = titre;
  $('#modal-corps').innerHTML = corps;
  $('#modal').style.maxWidth = large ? '860px' : '680px';
  const pied = $('#modal-pied');
  pied.innerHTML = '';
  boutons.forEach(b => {
    const el = document.createElement('button');
    el.className = 'btn ' + (b.cls || '');
    el.textContent = b.l;
    el.onclick = async () => {
      if (b.f) {
        try { if ((await b.f()) === false) return; } catch (e) { console.error(e); return; }
      }
      fermerModal();
    };
    pied.appendChild(el);
  });
  $('#modal-fond').classList.add('ouvert');
  const premier = $('#modal-corps input, #modal-corps select, #modal-corps textarea');
  if (premier) premier.focus();
}
function fermerModal() { $('#modal-fond').classList.remove('ouvert'); }
$('#modal-fermer').onclick = fermerModal;
document.addEventListener('keydown', e => { if (e.key === 'Escape') fermerModal(); });

function confirmer(message, libelle = 'Confirmer', cls = 'primaire') {
  return new Promise(res => {
    modal('Confirmation', `<p>${message}</p>`, [
      { l: 'Annuler', f: () => res(false) },
      { l: libelle, cls, f: () => res(true) },
    ]);
    $('#modal-fermer').onclick = () => { fermerModal(); res(false); $('#modal-fermer').onclick = fermerModal; };
  });
}

function editerModal(col, champs, obj, titre, apres) {
  modal(titre, formHtml(champs, obj), [
    { l: 'Annuler' },
    {
      l: 'Enregistrer', cls: 'primaire', f: async () => {
        const data = lireForm($('#modal-corps form'), champs);
        if (!verifierRequis(champs, data)) return false;
        const r = await sauver(col, Object.assign(obj, data));
        toast('Enregistré');
        if (apres) await apres(r);
        render();
      },
    },
  ]);
}

/* ---------------------------------------------------------------------
   Définition des formulaires
   --------------------------------------------------------------------- */
const optClients = () => [['', '— Choisir un client —'], ...S.clients.slice().sort((a, b) => a.nom.localeCompare(b.nom)).map(c => [c.id, c.nom])];
const optProjets = clientId => () => [['', '— Aucun projet —'], ...S.projets
  .filter(p => !clientId || String(p.clientId) === String(clientId))
  .map(p => [p.id, `${p.ref} – ${p.titre}`])];

const CHAMPS_CLIENT = [
  { n: 'nom', l: 'Raison sociale / Nom', req: true },
  { n: 'type', l: 'Type', t: 'select', opts: ['Entreprise', 'Particulier', 'Administration'] },
  { n: 'contact', l: 'Interlocuteur' },
  { n: 'fonction', l: 'Fonction' },
  { n: 'email', l: 'E-mail', t: 'email' },
  { n: 'tel', l: 'Téléphone' },
  { n: 'adresse', l: 'Adresse', t: 'textarea', rows: 2, plein: true },
  { n: 'cp', l: 'Code postal' },
  { n: 'ville', l: 'Ville' },
  { n: 'siret', l: 'SIRET / SIREN' },
  { n: 'tvaIntra', l: 'N° TVA intracommunautaire' },
  { n: 'delaiPaiement', l: 'Délai de paiement (jours)', t: 'number', aide: 'Vide = valeur des paramètres' },
  { n: 'notes', l: 'Notes', t: 'textarea', plein: true },
];

const champsProjet = () => [
  { n: 'titre', l: 'Intitulé du projet', req: true, plein: true },
  { n: 'clientId', l: 'Client', t: 'select', opts: optClients, req: true },
  { n: 'domaine', l: 'Domaine', t: 'select', opts: DOMAINES },
  { n: 'statut', l: 'Statut', t: 'select', opts: STATUTS_PROJET, def: 'En cours' },
  { n: 'budget', l: 'Budget prévu (€ HT)', t: 'number', step: '0.01' },
  { n: 'dateDebut', l: 'Date de début', t: 'date', def: auj() },
  { n: 'dateFin', l: 'Échéance', t: 'date' },
  { n: 'dossier', l: 'Dossier du projet (chemin ou lien)', plein: true, ph: 'ex : D:\\Affaires\\2026\\P-2026-001' },
  { n: 'description', l: 'Description / cahier des charges', t: 'textarea', rows: 4, plein: true },
];

const champsLivrable = () => [
  { n: 'projetId', l: 'Projet', t: 'select', opts: optProjets(), req: true, plein: true },
  { n: 'nom', l: 'Désignation', req: true, ph: 'ex : Plan d\'ensemble support moteur' },
  { n: 'reference', l: 'Référence / n° de plan', ph: 'ex : SUP-001' },
  { n: 'type', l: 'Type', t: 'select', opts: TYPES_LIVRABLE },
  { n: 'indice', l: 'Indice / version', def: 'A', aide: 'A, B, C… ou 1.0, 1.1…' },
  { n: 'statut', l: 'Statut', t: 'select', opts: STATUTS_LIVRABLE },
  { n: 'datePrevue', l: 'Date prévue', t: 'date' },
  { n: 'dateLivraison', l: 'Date de livraison', t: 'date' },
  { n: 'lien', l: 'Fichier (chemin ou lien)', plein: true },
  { n: 'notes', l: 'Notes', t: 'textarea', plein: true },
];

const champsTemps = () => [
  { n: 'date', l: 'Date', t: 'date', def: auj(), req: true },
  { n: 'heures', l: 'Durée (heures)', t: 'number', step: '0.25', req: true },
  { n: 'projetId', l: 'Projet', t: 'select', opts: optProjets(), req: true, plein: true },
  { n: 'description', l: 'Travail réalisé', t: 'textarea', rows: 2, plein: true },
  { n: 'facturable', l: 'Temps facturable', t: 'checkbox', def: true },
];

const CHAMPS_PARAMETRES = [
  { titre: 'Votre entreprise' },
  { n: 'nom', l: 'Prénom NOM (ou nom commercial)', req: true },
  { n: 'activite', l: 'Activité (sous-titre des documents)' },
  { n: 'mentionEI', l: 'Afficher la mention « Entrepreneur individuel (EI) » (obligatoire depuis 2022)', t: 'checkbox', plein: true },
  { n: 'adresse', l: 'Adresse', t: 'textarea', rows: 2, plein: true },
  { n: 'cp', l: 'Code postal' },
  { n: 'ville', l: 'Ville' },
  { n: 'tel', l: 'Téléphone' },
  { n: 'email', l: 'E-mail' },
  { n: 'site', l: 'Site web' },
  { n: 'siret', l: 'SIRET' },
  { n: 'ape', l: 'Code APE / NAF', ph: 'ex : 7112B' },
  { titre: 'Coordonnées bancaires (affichées sur les factures)' },
  { n: 'banque', l: 'Banque' },
  { n: 'bic', l: 'BIC' },
  { n: 'iban', l: 'IBAN', plein: true },
  { titre: 'Devis et factures' },
  { n: 'prefixDevis', l: 'Préfixe des devis', aide: 'Numéro : D-2026-001' },
  { n: 'prefixFacture', l: 'Préfixe des factures', aide: 'Numéro : F-2026-001' },
  { n: 'delaiPaiement', l: 'Délai de paiement par défaut (jours)', t: 'number', aide: '30 jours maximum par défaut, 60 jours max. si convenu' },
  { n: 'validiteDevis', l: 'Durée de validité des devis (jours)', t: 'number' },
  { n: 'tauxHoraire', l: 'Taux horaire (€ HT)', t: 'number', step: '0.01' },
  { n: 'tauxJournalier', l: 'Taux journalier (€ HT)', t: 'number', step: '0.01' },
  { n: 'acompteDefaut', l: 'Acompte par défaut sur les devis (%)', t: 'number' },
  { n: 'tvaApplicable', l: 'Je facture la TVA (franchise en base dépassée)', t: 'checkbox' },
  { n: 'tauxTVA', l: 'Taux de TVA (%)', t: 'number', step: '0.1' },
  { n: 'mentionTVA', l: 'Mention si TVA non applicable', plein: true },
  { n: 'penalites', l: 'Conditions de paiement / pénalités (factures)', t: 'textarea', rows: 3, plein: true },
  { n: 'conditionsDevis', l: 'Conditions particulières (devis)', t: 'textarea', rows: 3, plein: true },
  { n: 'mentionPied', l: 'Mention en pied de page', t: 'textarea', rows: 2, plein: true },
  { titre: 'Suivi micro-entreprise (indicatif — à vérifier sur autoentrepreneur.urssaf.fr)' },
  { n: 'tauxCotisations', l: 'Taux de cotisations sociales (%)', t: 'number', step: '0.1', aide: 'Prestations de services BNC (libéral non réglementé)' },
  { n: 'plafondCA', l: 'Plafond de CA micro-entreprise (€)', t: 'number' },
  { n: 'seuilTVA', l: 'Seuil de franchise en base de TVA (€)', t: 'number' },
];

/* ---------------------------------------------------------------------
   Routeur
   --------------------------------------------------------------------- */
let quitterVue = null; // fonction appelée avant de quitter une vue (sauvegarde en attente)

async function render() {
  if (quitterVue) { const f = quitterVue; quitterVue = null; await f(); }
  const [vue, id] = (location.hash.replace(/^#\/?/, '') || 'tableau').split('/');
  $$('#nav a').forEach(a => a.classList.toggle('actif', a.getAttribute('href') === '#/' + vue));
  const p = P();
  $('#nav-marque').innerHTML = `${esc(p.nom || 'Gestion d\'activité')}<small>${esc(p.nom ? p.activite : 'Micro-entreprise')}</small>`;
  const vues = {
    tableau: vueTableau, clients: id ? () => vueClient(id) : vueClients,
    projets: id ? () => vueProjet(id) : vueProjets,
    devis: id ? () => vueDocument('devis', id) : vueListeDevis,
    factures: id ? () => vueDocument('factures', id) : vueListeFactures,
    livrables: vueLivrables, temps: vueTemps, parametres: vueParametres,
  };
  (vues[vue] || vueTableau)();
}
window.addEventListener('hashchange', render);

const V = () => $('#vue');
const entete = (titre, boutons = '', fil = '') =>
  `<div class="entete">${fil ? `<div style="flex-basis:100%" class="fil">${fil}</div>` : ''}<h1>${titre}</h1><div class="actions">${boutons}</div></div>`;
const vide = (n, msg) => `<tr><td colspan="${n}" class="vide">${msg}</td></tr>`;
function brancher(selecteur, evenement, f) { $$(selecteur).forEach(el => el.addEventListener(evenement, e => f(el, e))); }
function clicLignes() {
  brancher('tr[data-href]', 'click', (tr, e) => { if (!e.target.closest('button, a')) location.hash = tr.dataset.href; });
}

/* ---------------------------------------------------------------------
   Tableau de bord
   --------------------------------------------------------------------- */
let anneeTableau = auj().slice(0, 4);

function vueTableau() {
  const p = P();
  const an = anneeTableau;
  const emises = S.factures.filter(f => f.statut !== 'brouillon');
  const payees = emises.filter(f => f.statut === 'payee' && annee(f.datePaiement) === an);
  const encaisse = arrondi(payees.reduce((s, f) => s + totaux(f).ht, 0));
  const facture = arrondi(emises.filter(f => annee(f.date) === an).reduce((s, f) => s + totaux(f).ht, 0));
  const aPayer = emises.filter(factureAPayer);
  const retard = aPayer.filter(factureEnRetard);
  const devisEnCours = S.devis.filter(d => etatDevis(d) === 'Envoyé');
  const devisAn = S.devis.filter(d => annee(d.date) === an);
  const acceptes = devisAn.filter(d => d.statut === 'Accepté').length;
  const refuses = devisAn.filter(d => ['Refusé', 'Expiré'].includes(etatDevis(d))).length;
  const transfo = acceptes + refuses ? Math.round(100 * acceptes / (acceptes + refuses)) + ' %' : '—';
  const cotis = arrondi(encaisse * (Number(p.tauxCotisations) || 0) / 100);

  const parMois = Array(12).fill(0);
  payees.forEach(f => { parMois[Number(f.datePaiement.slice(5, 7)) - 1] += totaux(f).ht; });
  const maxMois = Math.max(...parMois, 1);

  const barreSeuil = (lib, val, seuil) => {
    const pct = seuil ? Math.min(100, 100 * val / seuil) : 0;
    const cls = pct >= 100 ? 'rouge' : pct >= 80 ? 'orange' : '';
    return `<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;margin-bottom:5px">
      <span>${lib}</span><span class="num">${eur(val)} / ${eur(seuil)} (${Math.round(pct)} %)</span></div>
      <div class="barre ${cls}"><div style="width:${pct}%"></div></div></div>`;
  };

  // Alertes
  const alertes = [];
  retard.forEach(f => alertes.push(`<div class="alerte-ligne">${badge('Retard', 'rouge')}<div class="txt"><a href="#/factures/${f.id}">Facture ${esc(f.numero)} – ${esc(nomClient(f.clientId))}</a><div class="aide">Échue le ${fdate(f.dateEcheance)}</div></div><span class="num">${eur(totaux(f).ttc)}</span></div>`));
  S.devis.filter(d => d.statut === 'Envoyé' && d.dateValidite && d.dateValidite >= auj() && d.dateValidite <= ajouterJours(auj(), 7))
    .forEach(d => alertes.push(`<div class="alerte-ligne">${badge('Devis', 'orange')}<div class="txt"><a href="#/devis/${d.id}">${esc(d.numero)} – ${esc(nomClient(d.clientId))}</a><div class="aide">Expire le ${fdate(d.dateValidite)} : relancer le client</div></div><span class="num">${eur(totaux(d).ht)}</span></div>`));
  const livEnCours = S.livrables.filter(l => !['Livré', 'Validé client'].includes(l.statut) && l.datePrevue);
  livEnCours.filter(l => l.datePrevue < auj())
    .forEach(l => alertes.push(`<div class="alerte-ligne">${badge('Livrable', 'rouge')}<div class="txt"><a href="#/projets/${l.projetId}">${esc(l.nom)} (ind. ${esc(l.indice)})</a><div class="aide">En retard – prévu le ${fdate(l.datePrevue)} · ${esc(titreProjet(l.projetId))}</div></div></div>`));
  livEnCours.filter(l => l.datePrevue >= auj() && l.datePrevue <= ajouterJours(auj(), 14)).sort((a, b) => a.datePrevue.localeCompare(b.datePrevue))
    .forEach(l => alertes.push(`<div class="alerte-ligne">${badge('Livrable', 'bleu')}<div class="txt"><a href="#/projets/${l.projetId}">${esc(l.nom)} (ind. ${esc(l.indice)})</a><div class="aide">À livrer le ${fdate(l.datePrevue)} · ${esc(titreProjet(l.projetId))}</div></div></div>`));

  const projetsActifs = S.projets.filter(pr => pr.statut === 'En cours');
  const annees = [...new Set([auj().slice(0, 4), ...S.factures.map(f => annee(f.date)), ...S.factures.map(f => annee(f.datePaiement))].filter(Boolean))].sort().reverse();

  V().innerHTML = `
    ${entete('Tableau de bord', `<select id="choix-annee">${annees.map(a => `<option ${a === an ? 'selected' : ''}>${a}</option>`).join('')}</select>
      <a class="btn" href="#/devis" onclick="nouveauDevis();return false">+ Devis</a>
      <a class="btn primaire" href="#/factures" onclick="nouvelleFacture();return false">+ Facture</a>`)}
    ${!p.nom ? `<div class="carte" style="border-color:#f0c36d;background:#fffaf0">👋 Bienvenue ! Commencez par renseigner vos informations (nom, SIRET, adresse, IBAN…) dans <a class="lien" href="#/parametres">Paramètres</a> : elles apparaîtront sur vos devis et factures.</div>` : ''}
    <div class="grille g4" style="margin-bottom:20px">
      <div class="kpi"><div class="lib">CA encaissé ${an}</div><div class="val">${eur(encaisse)}</div><div class="sous">Base de la déclaration URSSAF</div></div>
      <div class="kpi"><div class="lib">Facturé ${an}</div><div class="val">${eur(facture)}</div><div class="sous">${emises.filter(f => annee(f.date) === an && f.type !== 'avoir').length} facture(s) émise(s)</div></div>
      <div class="kpi"><div class="lib">À encaisser</div><div class="val">${eur(aPayer.reduce((s, f) => s + totaux(f).ttc, 0))}</div><div class="sous" style="${retard.length ? 'color:var(--danger)' : ''}">${retard.length} en retard</div></div>
      <div class="kpi"><div class="lib">Devis en attente</div><div class="val">${eur(devisEnCours.reduce((s, d) => s + totaux(d).ht, 0))}</div><div class="sous">${devisEnCours.length} devis · transformation ${an} : ${transfo}</div></div>
    </div>
    <div class="grille g2">
      <div>
        <div class="carte">
          <h2>Encaissements mensuels ${an} (HT)</h2>
          <div class="graph">${parMois.map((v, i) => `<div class="col"><div class="bulle">${MOIS[i]} : ${eur(v)}</div><div class="b" style="height:${(100 * v / maxMois).toFixed(1)}%"></div></div>`).join('')}</div>
          <div class="graph-mois">${MOIS.map(m => `<span>${m}</span>`).join('')}</div>
        </div>
        <div class="carte">
          <h2>Seuils micro-entreprise ${an}</h2>
          ${barreSeuil('Plafond du régime micro', encaisse, Number(p.plafondCA))}
          ${p.tvaApplicable ? '' : barreSeuil('Franchise en base de TVA', encaisse, Number(p.seuilTVA))}
          <div style="display:flex;justify-content:space-between;border-top:1px solid var(--bordure);padding-top:10px">
            <span>Cotisations sociales estimées (${nb(p.tauxCotisations)} %)</span><strong class="num">${eur(cotis)}</strong></div>
          <div class="aide" style="margin-top:6px">Estimation indicative sur le CA encaissé. Vérifiez les taux et seuils en vigueur dans Paramètres.</div>
        </div>
      </div>
      <div>
        <div class="carte"><h2>À surveiller</h2>${alertes.length ? alertes.join('') : '<div class="vide">Rien à signaler 👍</div>'}</div>
        <div class="carte">
          <h2>Projets en cours <a class="btn petit droite" href="#/projets">Voir tout</a></h2>
          <table class="liste"><thead><tr><th>Projet</th><th>Client</th><th>Livrables</th><th class="num">Temps</th></tr></thead><tbody>
          ${projetsActifs.map(pr => {
            const liv = S.livrables.filter(l => String(l.projetId) === String(pr.id));
            const ok = liv.filter(l => ['Livré', 'Validé client'].includes(l.statut)).length;
            const h = S.temps.filter(t => String(t.projetId) === String(pr.id)).reduce((s, t) => s + (Number(t.heures) || 0), 0);
            return `<tr class="clic" data-href="#/projets/${pr.id}"><td><strong>${esc(pr.ref)}</strong> ${esc(pr.titre)}</td><td>${esc(nomClient(pr.clientId))}</td><td>${liv.length ? `${ok}/${liv.length}` : '—'}</td><td class="num">${nb(h)} h</td></tr>`;
          }).join('') || vide(4, 'Aucun projet en cours')}
          </tbody></table>
        </div>
      </div>
    </div>`;
  $('#choix-annee').onchange = e => { anneeTableau = e.target.value; render(); };
  clicLignes();
}

/* ---------------------------------------------------------------------
   Clients
   --------------------------------------------------------------------- */
let filtreClients = '';

function caClient(id) {
  return arrondi(S.factures.filter(f => f.statut !== 'brouillon' && String(f.clientId) === String(id)).reduce((s, f) => s + totaux(f).ht, 0));
}

function vueClients() {
  const q = filtreClients.toLowerCase();
  const liste = S.clients.filter(c => !q || [c.nom, c.contact, c.ville, c.email].join(' ').toLowerCase().includes(q))
    .sort((a, b) => a.nom.localeCompare(b.nom));
  V().innerHTML = `
    ${entete('Clients', '<button class="btn primaire" id="nouveau">+ Nouveau client</button>')}
    <div class="carte">
      <div class="filtres"><input id="recherche" placeholder="Rechercher…" value="${esc(filtreClients)}"></div>
      <table class="liste"><thead><tr><th>Client</th><th>Interlocuteur</th><th>Contact</th><th>Ville</th><th class="num">Projets</th><th class="num">CA facturé HT</th></tr></thead><tbody>
      ${liste.map(c => `<tr class="clic" data-href="#/clients/${c.id}">
        <td><strong>${esc(c.nom)}</strong></td><td>${esc(c.contact)}</td>
        <td>${esc(c.email)}${c.email && c.tel ? '<br>' : ''}${esc(c.tel)}</td><td>${esc(c.ville)}</td>
        <td class="num">${S.projets.filter(p => String(p.clientId) === String(c.id)).length}</td>
        <td class="num">${eur(caClient(c.id))}</td></tr>`).join('') || vide(6, 'Aucun client. Cliquez sur « + Nouveau client » pour commencer.')}
      </tbody></table>
    </div>`;
  $('#nouveau').onclick = () => editerModal('clients', CHAMPS_CLIENT, { type: 'Entreprise' }, 'Nouveau client');
  $('#recherche').oninput = e => { filtreClients = e.target.value; const pos = e.target.selectionStart; vueClients(); const r = $('#recherche'); r.focus(); r.setSelectionRange(pos, pos); };
  clicLignes();
}

function tableDocuments(col, docs) {
  const estFacture = col === 'factures';
  return `<table class="liste"><thead><tr><th>N°</th><th>Date</th><th>Objet</th><th class="num">Montant HT</th><th>Statut</th></tr></thead><tbody>
    ${docs.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(d => `<tr class="clic" data-href="#/${col}/${d.id}">
      <td><strong>${esc(d.numero || '(brouillon)')}</strong>${d.type === 'avoir' ? ' <span class="aide">avoir</span>' : ''}</td><td>${fdate(d.date)}</td><td>${esc(d.objet)}</td>
      <td class="num">${eur(totaux(d).ht)}</td><td>${estFacture ? badgeFacture(d) : badge(etatDevis(d))}</td></tr>`).join('') || vide(5, 'Aucun document')}
    </tbody></table>`;
}

function vueClient(id) {
  const c = trouver('clients', id);
  if (!c) { location.hash = '#/clients'; return; }
  const projets = S.projets.filter(p => String(p.clientId) === String(id));
  const devis = S.devis.filter(d => String(d.clientId) === String(id));
  const factures = S.factures.filter(f => String(f.clientId) === String(id));
  const du = factures.filter(factureAPayer).reduce((s, f) => s + totaux(f).ttc, 0);
  V().innerHTML = `
    ${entete(esc(c.nom), `<button class="btn" id="modifier">Modifier</button>
      <button class="btn" id="nv-projet">+ Projet</button><button class="btn" id="nv-devis">+ Devis</button>
      <button class="btn primaire" id="nv-facture">+ Facture</button><button class="btn danger" id="suppr">Supprimer</button>`,
      '<a href="#/clients">Clients</a> ›')}
    <div class="grille g4" style="margin-bottom:20px">
      <div class="kpi"><div class="lib">CA facturé (total)</div><div class="val">${eur(caClient(id))}</div></div>
      <div class="kpi"><div class="lib">Reste dû</div><div class="val">${eur(du)}</div></div>
      <div class="kpi"><div class="lib">Projets</div><div class="val">${projets.length}</div></div>
      <div class="kpi"><div class="lib">Devis</div><div class="val">${devis.length}</div></div>
    </div>
    <div class="grille g2">
      <div class="carte"><h2>Coordonnées</h2><dl class="infos">
        <dt>Type</dt><dd>${esc(c.type)}</dd>
        <dt>Interlocuteur</dt><dd>${esc(c.contact)}${c.fonction ? ' – ' + esc(c.fonction) : ''}</dd>
        <dt>E-mail</dt><dd>${c.email ? `<a class="lien" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}</dd>
        <dt>Téléphone</dt><dd>${esc(c.tel)}</dd>
        <dt>Adresse</dt><dd>${esc(c.adresse)}\n${esc(c.cp)} ${esc(c.ville)}</dd>
        <dt>SIRET</dt><dd>${esc(c.siret)}</dd><dt>TVA intra.</dt><dd>${esc(c.tvaIntra)}</dd>
        <dt>Notes</dt><dd>${esc(c.notes)}</dd></dl></div>
      <div class="carte"><h2>Projets</h2><table class="liste"><thead><tr><th>Réf.</th><th>Projet</th><th>Statut</th></tr></thead><tbody>
        ${projets.map(p => `<tr class="clic" data-href="#/projets/${p.id}"><td><strong>${esc(p.ref)}</strong></td><td>${esc(p.titre)}</td><td>${badge(p.statut)}</td></tr>`).join('') || vide(3, 'Aucun projet')}
      </tbody></table></div>
    </div>
    <div class="carte"><h2>Devis</h2>${tableDocuments('devis', devis)}</div>
    <div class="carte"><h2>Factures</h2>${tableDocuments('factures', factures)}</div>`;
  $('#modifier').onclick = () => editerModal('clients', CHAMPS_CLIENT, c, 'Modifier le client');
  $('#nv-projet').onclick = () => nouveauProjet({ clientId: c.id });
  $('#nv-devis').onclick = () => nouveauDevis({ clientId: c.id });
  $('#nv-facture').onclick = () => nouvelleFacture({ clientId: c.id });
  $('#suppr').onclick = async () => {
    if (projets.length || devis.length || factures.length) return toast('Impossible : ce client a des projets, devis ou factures.', true);
    if (await confirmer(`Supprimer le client « ${esc(c.nom)} » ?`, 'Supprimer', 'danger')) {
      await supprimer('clients', c.id); location.hash = '#/clients';
    }
  };
  clicLignes();
}

/* ---------------------------------------------------------------------
   Projets
   --------------------------------------------------------------------- */
let filtreProjets = { statut: 'actifs', q: '' };

function nouveauProjet(pre = {}) {
  if (!S.clients.length) return toast('Créez d\'abord un client.', true);
  const obj = { statut: 'En cours', domaine: DOMAINES[0], dateDebut: auj(), ...pre };
  editerModal('projets', champsProjet(), obj, 'Nouveau projet', async r => {
    if (!r.ref) {
      r.ref = prochainNumero('P', annee(r.dateDebut) || auj().slice(0, 4), S.projets.map(p => p.ref));
      await sauver('projets', r);
    }
    location.hash = '#/projets/' + r.id;
  });
}

function vueProjets() {
  const q = filtreProjets.q.toLowerCase();
  const liste = S.projets.filter(p => {
    if (filtreProjets.statut === 'actifs' && !['Prospect', 'En cours', 'En pause'].includes(p.statut)) return false;
    if (!['actifs', ''].includes(filtreProjets.statut) && p.statut !== filtreProjets.statut) return false;
    return !q || [p.ref, p.titre, nomClient(p.clientId), p.domaine].join(' ').toLowerCase().includes(q);
  }).sort((a, b) => (b.ref || '').localeCompare(a.ref || ''));
  V().innerHTML = `
    ${entete('Projets', '<button class="btn primaire" id="nouveau">+ Nouveau projet</button>')}
    <div class="carte">
      <div class="filtres"><input id="recherche" placeholder="Rechercher…" value="${esc(filtreProjets.q)}">
        <select id="f-statut">${[['actifs', 'Projets actifs'], ['', 'Tous les statuts'], ...STATUTS_PROJET.map(s => [s, s])].map(([k, l]) => `<option value="${k}" ${k === filtreProjets.statut ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <table class="liste"><thead><tr><th>Réf.</th><th>Projet</th><th>Client</th><th>Domaine</th><th>Échéance</th><th class="num">Temps</th><th class="num">Facturé HT</th><th>Statut</th></tr></thead><tbody>
      ${liste.map(p => {
        const h = S.temps.filter(t => String(t.projetId) === String(p.id)).reduce((s, t) => s + (Number(t.heures) || 0), 0);
        const fact = S.factures.filter(f => f.statut !== 'brouillon' && String(f.projetId) === String(p.id)).reduce((s, f) => s + totaux(f).ht, 0);
        const retard = p.dateFin && p.dateFin < auj() && p.statut === 'En cours';
        return `<tr class="clic" data-href="#/projets/${p.id}"><td><strong>${esc(p.ref)}</strong></td><td>${esc(p.titre)}</td>
          <td>${esc(nomClient(p.clientId))}</td><td>${esc(p.domaine)}</td><td style="${retard ? 'color:var(--danger);font-weight:600' : ''}">${fdate(p.dateFin)}</td>
          <td class="num">${nb(h)} h</td><td class="num">${eur(fact)}</td><td>${badge(p.statut)}</td></tr>`;
      }).join('') || vide(8, 'Aucun projet')}
      </tbody></table>
    </div>`;
  $('#nouveau').onclick = () => nouveauProjet();
  $('#f-statut').onchange = e => { filtreProjets.statut = e.target.value; vueProjets(); };
  $('#recherche').oninput = e => { filtreProjets.q = e.target.value; const pos = e.target.selectionStart; vueProjets(); const r = $('#recherche'); r.focus(); r.setSelectionRange(pos, pos); };
  clicLignes();
}

function tableLivrables(liste, avecProjet) {
  return `<table class="liste"><thead><tr>${avecProjet ? '<th>Projet</th>' : ''}<th>Livrable</th><th>Type</th><th>Indice</th><th>Prévu</th><th>Livré</th><th>Statut</th><th></th></tr></thead><tbody>
    ${liste.map(l => {
      const retard = l.datePrevue && l.datePrevue < auj() && !['Livré', 'Validé client'].includes(l.statut);
      return `<tr>${avecProjet ? `<td><a class="lien" href="#/projets/${l.projetId}">${esc(trouver('projets', l.projetId)?.ref || '—')}</a><div class="aide">${esc(nomClient(trouver('projets', l.projetId)?.clientId))}</div></td>` : ''}
      <td><strong>${esc(l.nom)}</strong>${l.reference ? `<div class="aide">${esc(l.reference)}</div>` : ''}
        ${l.lien ? `<div class="aide" title="${esc(l.lien)}">📁 ${esc(l.lien.length > 45 ? '…' + l.lien.slice(-44) : l.lien)}</div>` : ''}
        ${(l.historique || []).length ? `<div class="historique">Historique : ${l.historique.map(h => `${esc(h.indice)} (${fdate(h.date)})`).join(', ')}</div>` : ''}</td>
      <td>${esc(l.type)}</td><td><strong>${esc(l.indice)}</strong></td>
      <td style="${retard ? 'color:var(--danger);font-weight:600' : ''}">${fdate(l.datePrevue)}</td><td>${fdate(l.dateLivraison)}</td><td>${badge(l.statut)}</td>
      <td class="act"><button class="btn petit" data-liv-livrer="${l.id}" title="Marquer comme livré aujourd'hui">✓ Livré</button>
        <button class="btn petit" data-liv-rev="${l.id}" title="Créer un nouvel indice de révision">+ Indice</button>
        <button class="btn petit" data-liv-edit="${l.id}">Modifier</button></td></tr>`;
    }).join('') || vide(avecProjet ? 8 : 7, 'Aucun livrable')}
    </tbody></table>`;
}

function brancherLivrables() {
  brancher('[data-liv-edit]', 'click', b => {
    const l = trouver('livrables', b.dataset.livEdit);
    modal('Modifier le livrable', formHtml(champsLivrable(), l), [
      { l: 'Supprimer', cls: 'danger', f: async () => { if (await confirmer('Supprimer ce livrable ?', 'Supprimer', 'danger')) { await supprimer('livrables', l.id); render(); } } },
      { l: 'Annuler' },
      { l: 'Enregistrer', cls: 'primaire', f: async () => { const d = lireForm($('#modal-corps form'), champsLivrable()); if (!verifierRequis(champsLivrable(), d)) return false; await sauver('livrables', Object.assign(l, d)); render(); } },
    ]);
  });
  brancher('[data-liv-livrer]', 'click', async b => {
    const l = trouver('livrables', b.dataset.livLivrer);
    l.statut = 'Livré'; l.dateLivraison = auj();
    await sauver('livrables', l); toast('Livrable marqué comme livré'); render();
  });
  brancher('[data-liv-rev]', 'click', async b => {
    const l = trouver('livrables', b.dataset.livRev);
    const suivant = indiceSuivant(l.indice);
    modal(`Nouvel indice pour « ${l.nom} »`, `<form class="form-grille" onsubmit="return false">
        <label class="champ">Indice actuel<input value="${esc(l.indice)}" disabled></label>
        <label class="champ">Nouvel indice<input name="indice" value="${esc(suivant)}"></label>
        <label class="champ plein">Motif de la révision<textarea name="motif" rows="2" placeholder="ex : modification perçage suite retour client"></textarea></label>
        <label class="champ">Nouvelle date prévue<input type="date" name="datePrevue" value="${esc(l.datePrevue && l.datePrevue > auj() ? l.datePrevue : '')}"></label></form>
        <p class="aide">L'indice actuel sera conservé dans l'historique du livrable.</p>`, [
      { l: 'Annuler' },
      {
        l: 'Créer l\'indice', cls: 'primaire', f: async () => {
          const f = $('#modal-corps form');
          l.historique = [...(l.historique || []), { indice: l.indice, date: l.dateLivraison || auj(), statut: l.statut, motif: l.motifRevision || '' }];
          l.indice = f.elements.indice.value.trim() || suivant;
          l.motifRevision = f.elements.motif.value.trim();
          l.datePrevue = f.elements.datePrevue.value;
          l.dateLivraison = ''; l.statut = 'En cours';
          if (l.motifRevision) l.notes = `${l.notes ? l.notes + '\n' : ''}Ind. ${l.indice} : ${l.motifRevision}`;
          await sauver('livrables', l); toast('Nouvel indice ' + l.indice); render();
        },
      },
    ]);
  });
}

function nouveauLivrable(pre = {}) {
  if (!S.projets.length) return toast('Créez d\'abord un projet.', true);
  editerModal('livrables', champsLivrable(), { indice: 'A', statut: 'À faire', type: TYPES_LIVRABLE[0], ...pre }, 'Nouveau livrable');
}
function nouveauTemps(pre = {}) {
  if (!S.projets.length) return toast('Créez d\'abord un projet.', true);
  const dernier = S.temps[S.temps.length - 1];
  editerModal('temps', champsTemps(), { date: auj(), facturable: true, projetId: dernier?.projetId, ...pre }, 'Saisir du temps');
}

function tableTemps(liste, avecProjet) {
  const total = liste.reduce((s, t) => s + (Number(t.heures) || 0), 0);
  return `<table class="liste"><thead><tr><th>Date</th>${avecProjet ? '<th>Projet</th>' : ''}<th>Travail réalisé</th><th class="num">Durée</th><th>Facturation</th><th></th></tr></thead><tbody>
    ${liste.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(t => {
      const f = t.factureId && trouver('factures', t.factureId);
      return `<tr><td>${fdate(t.date)}</td>${avecProjet ? `<td><a class="lien" href="#/projets/${t.projetId}">${esc(titreProjet(t.projetId))}</a></td>` : ''}
      <td class="pre" style="white-space:pre-wrap">${esc(t.description)}</td><td class="num">${nb(t.heures)} h</td>
      <td>${f ? `<a class="lien" href="#/factures/${f.id}">${esc(f.numero || 'brouillon')}</a>` : t.facturable ? badge('À facturer', 'orange') : badge('Non facturable')}</td>
      <td class="act"><button class="btn petit" data-temps-edit="${t.id}">Modifier</button></td></tr>`;
    }).join('') || vide(avecProjet ? 6 : 5, 'Aucune saisie')}
    </tbody>${liste.length ? `<tfoot><tr><td colspan="${avecProjet ? 3 : 2}">Total</td><td class="num">${nb(total)} h</td><td colspan="2"></td></tr></tfoot>` : ''}</table>`;
}

function brancherTemps() {
  brancher('[data-temps-edit]', 'click', b => {
    const t = trouver('temps', b.dataset.tempsEdit);
    modal('Modifier la saisie', formHtml(champsTemps(), t), [
      { l: 'Supprimer', cls: 'danger', f: async () => { if (await confirmer('Supprimer cette saisie ?', 'Supprimer', 'danger')) { await supprimer('temps', t.id); render(); } } },
      { l: 'Annuler' },
      { l: 'Enregistrer', cls: 'primaire', f: async () => { const d = lireForm($('#modal-corps form'), champsTemps()); if (!verifierRequis(champsTemps(), d)) return false; await sauver('temps', Object.assign(t, d)); render(); } },
    ]);
  });
}

function vueProjet(id) {
  const p = trouver('projets', id);
  if (!p) { location.hash = '#/projets'; return; }
  const meme = x => String(x.projetId) === String(id);
  const livrables = S.livrables.filter(meme);
  const devis = S.devis.filter(meme);
  const factures = S.factures.filter(meme);
  const temps = S.temps.filter(meme);
  const heures = temps.reduce((s, t) => s + (Number(t.heures) || 0), 0);
  const aFacturer = temps.filter(t => t.facturable && !t.factureId).reduce((s, t) => s + (Number(t.heures) || 0), 0);
  const devisAcc = devis.filter(d => d.statut === 'Accepté').reduce((s, d) => s + totaux(d).ht, 0);
  const facture = factures.filter(f => f.statut !== 'brouillon').reduce((s, f) => s + totaux(f).ht, 0);
  const tauxReel = heures ? facture / heures : 0;
  V().innerHTML = `
    ${entete(`${esc(p.ref)} – ${esc(p.titre)}`, `<button class="btn" id="modifier">Modifier</button>
      <button class="btn" id="nv-devis">+ Devis</button><button class="btn primaire" id="nv-facture">+ Facture</button>
      <button class="btn danger" id="suppr">Supprimer</button>`,
      `<a href="#/projets">Projets</a> › <a href="#/clients/${p.clientId}">${esc(nomClient(p.clientId))}</a> ›`)}
    <div class="grille g4" style="margin-bottom:20px">
      <div class="kpi"><div class="lib">Devis accepté(s)</div><div class="val">${eur(devisAcc)}</div><div class="sous">Budget prévu : ${p.budget ? eur(p.budget) : '—'}</div></div>
      <div class="kpi"><div class="lib">Facturé HT</div><div class="val">${eur(facture)}</div><div class="sous">${devisAcc ? `${Math.round(100 * facture / devisAcc)} % du devis` : ''}</div></div>
      <div class="kpi"><div class="lib">Temps passé</div><div class="val">${nb(heures)} h</div><div class="sous">${nb(aFacturer)} h non facturée(s)</div></div>
      <div class="kpi"><div class="lib">Taux horaire réel</div><div class="val">${heures && facture ? eur(tauxReel) : '—'}</div><div class="sous">Facturé ÷ temps passé</div></div>
    </div>
    <div class="carte"><h2>Informations ${badge(p.statut)}</h2><dl class="infos">
      <dt>Client</dt><dd><a class="lien" href="#/clients/${p.clientId}">${esc(nomClient(p.clientId))}</a></dd>
      <dt>Domaine</dt><dd>${esc(p.domaine)}</dd>
      <dt>Période</dt><dd>${fdate(p.dateDebut)} → ${fdate(p.dateFin) || '…'}</dd>
      <dt>Dossier</dt><dd>${esc(p.dossier)}</dd>
      <dt>Description</dt><dd>${esc(p.description)}</dd></dl></div>
    <div class="carte"><h2>Livrables <button class="btn petit droite" id="nv-livrable">+ Livrable</button></h2>${tableLivrables(livrables, false)}</div>
    <div class="grille g2">
      <div class="carte"><h2>Devis</h2>${tableDocuments('devis', devis)}</div>
      <div class="carte"><h2>Factures</h2>${tableDocuments('factures', factures)}</div>
    </div>
    <div class="carte"><h2>Temps passé <button class="btn petit droite" id="nv-temps">+ Saisir du temps</button></h2>${tableTemps(temps, false)}</div>`;
  $('#modifier').onclick = () => editerModal('projets', champsProjet(), p, 'Modifier le projet');
  $('#nv-devis').onclick = () => nouveauDevis({ clientId: p.clientId, projetId: p.id, objet: p.titre });
  $('#nv-facture').onclick = () => nouvelleFacture({ clientId: p.clientId, projetId: p.id, objet: p.titre });
  $('#nv-livrable').onclick = () => nouveauLivrable({ projetId: p.id });
  $('#nv-temps').onclick = () => nouveauTemps({ projetId: p.id });
  $('#suppr').onclick = async () => {
    if (devis.length || factures.length) return toast('Impossible : ce projet a des devis ou factures.', true);
    if (await confirmer(`Supprimer le projet « ${esc(p.titre)} » ainsi que ses livrables et saisies de temps ?`, 'Supprimer', 'danger')) {
      for (const l of livrables) await supprimer('livrables', l.id);
      for (const t of temps) await supprimer('temps', t.id);
      await supprimer('projets', p.id); location.hash = '#/projets';
    }
  };
  brancherLivrables(); brancherTemps(); clicLignes();
}

/* ---------------------------------------------------------------------
   Livrables (vue globale)
   --------------------------------------------------------------------- */
let filtreLivrables = 'ouverts';
function vueLivrables() {
  const liste = S.livrables.filter(l => {
    const fini = ['Livré', 'Validé client'].includes(l.statut);
    if (filtreLivrables === 'ouverts') return !fini;
    if (filtreLivrables === 'retard') return !fini && l.datePrevue && l.datePrevue < auj();
    if (filtreLivrables === 'livres') return fini;
    return true;
  }).sort((a, b) => (a.datePrevue || '9999').localeCompare(b.datePrevue || '9999'));
  V().innerHTML = `
    ${entete('Livrables', '<button class="btn primaire" id="nouveau">+ Nouveau livrable</button>')}
    <div class="carte">
      <div class="filtres"><select id="filtre">${[['ouverts', 'À livrer'], ['retard', 'En retard'], ['livres', 'Livrés'], ['tous', 'Tous']]
        .map(([k, l]) => `<option value="${k}" ${k === filtreLivrables ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      ${tableLivrables(liste, true)}
    </div>`;
  $('#nouveau').onclick = () => nouveauLivrable();
  $('#filtre').onchange = e => { filtreLivrables = e.target.value; vueLivrables(); };
  brancherLivrables();
}

/* ---------------------------------------------------------------------
   Suivi du temps
   --------------------------------------------------------------------- */
let filtreTemps = { mois: auj().slice(0, 7), projet: '' };
function vueTemps() {
  const liste = S.temps.filter(t => (!filtreTemps.mois || (t.date || '').startsWith(filtreTemps.mois)) && (!filtreTemps.projet || String(t.projetId) === filtreTemps.projet));
  V().innerHTML = `
    ${entete('Suivi du temps', '<button class="btn primaire" id="nouveau">+ Saisir du temps</button>')}
    <div class="carte">
      <div class="filtres"><label class="aide">Mois</label><input type="month" id="f-mois" value="${esc(filtreTemps.mois)}">
        <select id="f-projet">${optProjets()().map(([k, l]) => `<option value="${k}" ${String(k) === filtreTemps.projet ? 'selected' : ''}>${k ? esc(l) : 'Tous les projets'}</option>`).join('')}</select></div>
      ${tableTemps(liste, true)}
      <p class="aide">Astuce : dans une facture en brouillon liée à un projet, le bouton « Importer le temps non facturé » ajoute automatiquement ces heures.</p>
    </div>`;
  $('#nouveau').onclick = () => nouveauTemps();
  $('#f-mois').onchange = e => { filtreTemps.mois = e.target.value; vueTemps(); };
  $('#f-projet').onchange = e => { filtreTemps.projet = e.target.value; vueTemps(); };
  brancherTemps();
}

/* ---------------------------------------------------------------------
   Devis & factures : listes
   --------------------------------------------------------------------- */
async function nouveauDevis(pre = {}) {
  if (!S.clients.length) { toast('Créez d\'abord un client.', true); location.hash = '#/clients'; return; }
  const p = P();
  const d = {
    numero: prochainNumero(p.prefixDevis, auj().slice(0, 4), S.devis.map(x => x.numero)),
    date: auj(), dateValidite: ajouterJours(auj(), p.validiteDevis), statut: 'Brouillon',
    clientId: '', projetId: '', objet: '', acompte: Number(p.acompteDefaut) || 0,
    tva: p.tvaApplicable ? Number(p.tauxTVA) : null, lignes: [{ designation: '', qte: 1, unite: 'forfait', pu: 0 }],
    notes: '', conditions: p.conditionsDevis, ...pre,
  };
  const r = await sauver('devis', d);
  location.hash = '#/devis/' + r.id;
}

async function nouvelleFacture(pre = {}) {
  if (!S.clients.length) { toast('Créez d\'abord un client.', true); location.hash = '#/clients'; return; }
  const p = P();
  const client = trouver('clients', pre.clientId);
  const delai = client && client.delaiPaiement !== '' && client.delaiPaiement != null ? client.delaiPaiement : p.delaiPaiement;
  const f = {
    numero: '', type: 'facture', statut: 'brouillon', date: auj(), dateEcheance: ajouterJours(auj(), delai),
    clientId: '', projetId: '', devisId: '', objet: '', periode: '', tva: p.tvaApplicable ? Number(p.tauxTVA) : null,
    lignes: [{ designation: '', qte: 1, unite: 'forfait', pu: 0 }], notes: '', ...pre,
  };
  const r = await sauver('factures', f);
  location.hash = '#/factures/' + r.id;
}

let filtreDevis = { statut: '', q: '' };
function vueListeDevis() {
  const q = filtreDevis.q.toLowerCase();
  const liste = S.devis.filter(d => (!filtreDevis.statut || etatDevis(d) === filtreDevis.statut) &&
    (!q || [d.numero, d.objet, nomClient(d.clientId)].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => (b.numero || '').localeCompare(a.numero || ''));
  const total = liste.reduce((s, d) => s + totaux(d).ht, 0);
  V().innerHTML = `
    ${entete('Devis', '<button class="btn primaire" id="nouveau">+ Nouveau devis</button>')}
    <div class="carte">
      <div class="filtres"><input id="recherche" placeholder="Rechercher…" value="${esc(filtreDevis.q)}">
        <select id="f-statut"><option value="">Tous les statuts</option>${STATUTS_DEVIS.map(s => `<option ${s === filtreDevis.statut ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <table class="liste"><thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Objet</th><th>Validité</th><th class="num">Montant HT</th><th>Statut</th></tr></thead><tbody>
      ${liste.map(d => `<tr class="clic" data-href="#/devis/${d.id}"><td><strong>${esc(d.numero)}</strong></td><td>${fdate(d.date)}</td>
        <td>${esc(nomClient(d.clientId))}</td><td>${esc(d.objet)}</td><td>${fdate(d.dateValidite)}</td>
        <td class="num">${eur(totaux(d).ht)}</td><td>${badge(etatDevis(d))}</td></tr>`).join('') || vide(7, 'Aucun devis')}
      </tbody>${liste.length ? `<tfoot><tr><td colspan="5">Total (${liste.length})</td><td class="num">${eur(total)}</td><td></td></tr></tfoot>` : ''}</table>
    </div>`;
  $('#nouveau').onclick = () => nouveauDevis();
  $('#f-statut').onchange = e => { filtreDevis.statut = e.target.value; vueListeDevis(); };
  $('#recherche').oninput = e => { filtreDevis.q = e.target.value; const pos = e.target.selectionStart; vueListeDevis(); const r = $('#recherche'); r.focus(); r.setSelectionRange(pos, pos); };
  clicLignes();
}

let filtreFactures = { etat: '', annee: '', q: '' };
function vueListeFactures() {
  const q = filtreFactures.q.toLowerCase();
  const liste = S.factures.filter(f => (!filtreFactures.etat || etatFacture(f)[0] === filtreFactures.etat) &&
    (!filtreFactures.annee || annee(f.date) === filtreFactures.annee) &&
    (!q || [f.numero, f.objet, nomClient(f.clientId)].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => (b.numero || 'ZZZ').localeCompare(a.numero || 'ZZZ') || b.id - a.id);
  const tot = liste.reduce((s, f) => { const t = totaux(f); return { ht: s.ht + t.ht, ttc: s.ttc + t.ttc }; }, { ht: 0, ttc: 0 });
  const etats = ['Brouillon', 'À payer', 'En retard', 'Payée', 'Annulée (avoir)', 'À rembourser', 'Remboursé', 'Avoir soldé'];
  const annees = [...new Set(S.factures.map(f => annee(f.date)))].sort().reverse();
  V().innerHTML = `
    ${entete('Factures', '<button class="btn primaire" id="nouveau">+ Nouvelle facture</button>')}
    <div class="carte">
      <div class="filtres"><input id="recherche" placeholder="Rechercher…" value="${esc(filtreFactures.q)}">
        <select id="f-etat"><option value="">Tous les états</option>${etats.map(s => `<option ${s === filtreFactures.etat ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <select id="f-annee"><option value="">Toutes les années</option>${annees.map(a => `<option ${a === filtreFactures.annee ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
      <table class="liste"><thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Objet</th><th>Échéance</th><th class="num">HT</th><th class="num">TTC</th><th>État</th></tr></thead><tbody>
      ${liste.map(f => `<tr class="clic" data-href="#/factures/${f.id}"><td><strong>${esc(f.numero || '(brouillon)')}</strong>${f.type === 'avoir' ? ' <span class="aide">avoir</span>' : ''}</td>
        <td>${fdate(f.date)}</td><td>${esc(nomClient(f.clientId))}</td><td>${esc(f.objet)}</td><td>${fdate(f.dateEcheance)}</td>
        <td class="num">${eur(totaux(f).ht)}</td><td class="num">${eur(totaux(f).ttc)}</td><td>${badgeFacture(f)}</td></tr>`).join('') || vide(8, 'Aucune facture')}
      </tbody>${liste.length ? `<tfoot><tr><td colspan="5">Total (${liste.length})</td><td class="num">${eur(tot.ht)}</td><td class="num">${eur(tot.ttc)}</td><td></td></tr></tfoot>` : ''}</table>
    </div>`;
  $('#nouveau').onclick = () => nouvelleFacture();
  $('#f-etat').onchange = e => { filtreFactures.etat = e.target.value; vueListeFactures(); };
  $('#f-annee').onchange = e => { filtreFactures.annee = e.target.value; vueListeFactures(); };
  $('#recherche').oninput = e => { filtreFactures.q = e.target.value; const pos = e.target.selectionStart; vueListeFactures(); const r = $('#recherche'); r.focus(); r.setSelectionRange(pos, pos); };
  clicLignes();
}

/* ---------------------------------------------------------------------
   Éditeur de devis / facture
   --------------------------------------------------------------------- */
function vueDocument(col, id) {
  const doc = trouver(col, id);
  if (!doc) { location.hash = '#/' + col; return; }
  const p = P();
  const estFacture = col === 'factures';
  const estAvoir = doc.type === 'avoir';
  const verrouille = estFacture && doc.statut !== 'brouillon';
  const dis = verrouille ? 'disabled' : '';
  doc.lignes = doc.lignes || [];

  let minuterie = null;
  const flush = async () => {
    if (!minuterie) return;
    clearTimeout(minuterie); minuterie = null;
    await sauver(col, doc);
    const e = $('#etat-sauv'); if (e) e.textContent = 'Enregistré ✓';
  };
  quitterVue = flush;
  const planifier = () => {
    $('#etat-sauv').textContent = 'Modification…';
    clearTimeout(minuterie);
    minuterie = setTimeout(flush, 600);
  };

  const titre = estFacture ? (estAvoir ? 'Avoir' : 'Facture') : 'Devis';
  const numero = doc.numero || 'brouillon (numéro attribué à l\'émission)';
  let boutons = `<span class="aide" id="etat-sauv">${verrouille ? '🔒 Document émis (non modifiable)' : 'Enregistrement automatique'}</span>
    <button class="btn" id="b-apercu">🖨 Aperçu / PDF</button>`;
  if (!estFacture) {
    boutons += `<button class="btn" id="b-dupliquer">Dupliquer</button>
      <button class="btn primaire" id="b-convertir">→ Facturer ce devis</button>
      <button class="btn danger" id="b-suppr">Supprimer</button>`;
  } else if (doc.statut === 'brouillon') {
    boutons += `<button class="btn danger" id="b-suppr">Supprimer</button>
      <button class="btn succes" id="b-emettre">✓ Émettre ${estAvoir ? 'l\'avoir' : 'la facture'}</button>`;
  } else if (!estAvoir && doc.statut === 'emise') {
    boutons += `<button class="btn" id="b-avoir">Créer un avoir</button><button class="btn succes" id="b-payer">€ Enregistrer le paiement</button>`;
  } else if (estAvoir && doc.statut === 'emise') {
    boutons += `<button class="btn succes" id="b-payer">Enregistrer le remboursement</button>`;
  } else if (doc.statut === 'payee') {
    boutons += `<button class="btn" id="b-annuler-paiement">Annuler le paiement</button>${estAvoir ? '' : '<button class="btn" id="b-avoir">Créer un avoir</button>'}`;
  }

  const optsStatut = STATUTS_DEVIS.map(s => `<option ${s === doc.statut ? 'selected' : ''}>${s}</option>`).join('');
  const lien = (c, i, t) => (i ? `<a class="lien" href="#/${c}/${i}">${esc(t)}</a>` : '');

  V().innerHTML = `
    ${entete(`${titre} ${esc(doc.numero || '')} ${estFacture ? badgeFacture(doc) : badge(etatDevis(doc))}`, boutons,
      `<a href="#/${col}">${estFacture ? 'Factures' : 'Devis'}</a> ›`)}
    ${estAvoir && doc.refFactureId ? `<div class="carte">Avoir sur la facture ${lien('factures', doc.refFactureId, trouver('factures', doc.refFactureId)?.numero || '')}</div>` : ''}
    ${doc.devisId ? `<div class="aide" style="margin:-10px 0 14px">Issue du devis ${lien('devis', doc.devisId, trouver('devis', doc.devisId)?.numero || '')}</div>` : ''}
    ${doc.statut === 'payee' ? `<div class="carte" style="background:var(--succes-fond);border-color:#b5dfc4">${estAvoir ? 'Remboursé' : 'Payée'} le <strong>${fdate(doc.datePaiement)}</strong> par ${esc(doc.modePaiement || '—')}</div>` : ''}
    <div class="carte">
      <div class="form-grille c3" id="entete-doc">
        <label class="champ">Numéro<input value="${esc(numero)}" disabled></label>
        <label class="champ">Client *<select data-k="clientId" ${dis}>${optClients().map(([k, l]) => `<option value="${k}" ${String(k) === String(doc.clientId) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        <label class="champ">Projet<select data-k="projetId" id="sel-projet" ${dis}></select></label>
        <label class="champ plein">Objet<input data-k="objet" value="${esc(doc.objet)}" ${dis} placeholder="ex : Conception d'un outillage de contrôle"></label>
        <label class="champ">Date<input type="date" data-k="date" value="${esc(doc.date)}" ${dis}></label>
        ${estFacture ? `
          <label class="champ">Échéance<input type="date" data-k="dateEcheance" value="${esc(doc.dateEcheance)}" ${dis}></label>
          <label class="champ">Période / date de la prestation<input data-k="periode" value="${esc(doc.periode)}" ${dis} placeholder="ex : septembre 2026"></label>`
        : `
          <label class="champ">Valable jusqu'au<input type="date" data-k="dateValidite" value="${esc(doc.dateValidite)}"></label>
          <label class="champ">Statut<select data-k="statut">${optsStatut}</select></label>
          <label class="champ">Acompte à la commande (%)<input type="number" data-k="acompte" value="${esc(doc.acompte)}" min="0" max="100"></label>`}
        <label class="champ">TVA<select data-k="tva" ${dis}><option value="">Non applicable (art. 293 B)</option>
          ${[20, 10, 5.5].map(t => `<option value="${t}" ${Number(doc.tva) === t ? 'selected' : ''}>${nb(t)} %</option>`).join('')}</select></label>
      </div>
    </div>
    <div class="carte">
      <h2>Prestations</h2>
      <table class="lignes"><thead><tr><th>Désignation</th><th class="c-qte">Qté</th><th class="c-unite">Unité</th><th class="c-pu">P.U. HT</th><th class="c-tot num">Total HT</th><th class="c-act"></th></tr></thead>
        <tbody id="corps-lignes"></tbody></table>
      ${verrouille ? '' : `<div class="actions" style="margin-top:10px">
        <button class="btn petit" data-ajout="ligne">+ Ligne</button>
        <button class="btn petit" data-ajout="heures">+ Heures (${eur(p.tauxHoraire)}/h)</button>
        <button class="btn petit" data-ajout="jours">+ Jours (${eur(p.tauxJournalier)}/j)</button>
        <button class="btn petit" data-ajout="titre">+ Titre de section</button>
        ${estFacture ? '<button class="btn petit" id="b-temps">⏱ Importer le temps non facturé du projet</button>' : ''}
      </div>`}
      <div class="totaux" id="totaux"></div>
    </div>
    <div class="carte">
      <div class="form-grille">
        <label class="champ plein">Note affichée sur le document<textarea data-k="notes" rows="2" ${dis}>${esc(doc.notes)}</textarea></label>
        ${estFacture ? '' : `<label class="champ plein">Conditions particulières<textarea data-k="conditions" rows="3">${esc(doc.conditions)}</textarea></label>`}
      </div>
    </div>`;

  // ----- liste des projets dépendante du client
  const remplirProjets = () => {
    $('#sel-projet').innerHTML = optProjets(doc.clientId)().map(([k, l]) => `<option value="${k}" ${String(k) === String(doc.projetId) ? 'selected' : ''}>${esc(l)}</option>`).join('');
  };
  remplirProjets();

  // ----- champs d'en-tête
  brancher('[data-k]', 'input', el => {
    const k = el.dataset.k;
    let v = el.value;
    if (k === 'tva') v = v === '' ? null : Number(v);
    if (k === 'acompte') v = Number(v) || 0;
    doc[k] = v;
    if (k === 'clientId') {
      doc.projetId = '';
      remplirProjets();
      const c = trouver('clients', v);
      if (estFacture && c && c.delaiPaiement !== '' && c.delaiPaiement != null) {
        doc.dateEcheance = ajouterJours(doc.date, c.delaiPaiement);
        $('[data-k="dateEcheance"]').value = doc.dateEcheance;
      }
    }
    if (k === 'date' && estFacture) {
      const c = trouver('clients', doc.clientId);
      const delai = c && c.delaiPaiement !== '' && c.delaiPaiement != null ? c.delaiPaiement : p.delaiPaiement;
      doc.dateEcheance = ajouterJours(v, delai);
      $('[data-k="dateEcheance"]').value = doc.dateEcheance;
    }
    if (k === 'tva') afficherTotaux();
    planifier();
  });

  // ----- lignes
  const afficherTotaux = () => {
    const t = totaux(doc);
    const acompte = !estFacture && Number(doc.acompte) ? `<div><span>Acompte ${nb(doc.acompte)} %</span><span>${eur(t.ttc * doc.acompte / 100)}</span></div>` : '';
    $('#totaux').innerHTML = doc.tva
      ? `<div><span>Total HT</span><span>${eur(t.ht)}</span></div><div><span>TVA ${nb(doc.tva)} %</span><span>${eur(t.tva)}</span></div><div class="net"><span>Total TTC</span><span>${eur(t.ttc)}</span></div>${acompte}`
      : `<div class="net"><span>Total HT (net à payer)</span><span>${eur(t.ht)}</span></div><div class="aide" style="justify-content:flex-end">${esc(p.mentionTVA)}</div>${acompte}`;
  };
  const afficherLignes = () => {
    $('#corps-lignes').innerHTML = doc.lignes.map((l, i) => {
      const act = verrouille ? '' : `<button class="btn petit" data-monter="${i}" title="Monter">↑</button><button class="btn petit danger" data-suppr="${i}" title="Supprimer">×</button>`;
      if (l.type === 'titre') {
        return `<tr><td colspan="5"><input data-i="${i}" data-f="designation" value="${esc(l.designation)}" placeholder="Titre de section (ex : Phase 1 – Avant-projet)" style="font-weight:600" ${dis}></td><td class="c-act">${act}</td></tr>`;
      }
      return `<tr>
        <td><textarea data-i="${i}" data-f="designation" rows="2" placeholder="Description de la prestation" ${dis}>${esc(l.designation)}</textarea></td>
        <td class="c-qte"><input type="number" step="any" data-i="${i}" data-f="qte" value="${esc(l.qte)}" ${dis}></td>
        <td class="c-unite"><select data-i="${i}" data-f="unite" ${dis}>${UNITES.map(u => `<option ${u === l.unite ? 'selected' : ''}>${u}</option>`).join('')}</select></td>
        <td class="c-pu"><input type="number" step="0.01" data-i="${i}" data-f="pu" value="${esc(l.pu)}" ${dis}></td>
        <td class="c-tot num" id="tot-${i}">${eur((Number(l.qte) || 0) * (Number(l.pu) || 0))}</td>
        <td class="c-act">${act}</td></tr>`;
    }).join('') || `<tr><td colspan="6" class="vide">Aucune ligne</td></tr>`;
    brancher('#corps-lignes [data-i]', 'input', el => {
      const i = Number(el.dataset.i), f = el.dataset.f;
      doc.lignes[i][f] = ['qte', 'pu'].includes(f) ? (el.value === '' ? '' : Number(el.value)) : el.value;
      const td = $('#tot-' + i);
      if (td) td.textContent = eur((Number(doc.lignes[i].qte) || 0) * (Number(doc.lignes[i].pu) || 0));
      afficherTotaux(); planifier();
    });
    brancher('#corps-lignes [data-suppr]', 'click', b => { doc.lignes.splice(Number(b.dataset.suppr), 1); afficherLignes(); afficherTotaux(); planifier(); });
    brancher('#corps-lignes [data-monter]', 'click', b => {
      const i = Number(b.dataset.monter); if (!i) return;
      [doc.lignes[i - 1], doc.lignes[i]] = [doc.lignes[i], doc.lignes[i - 1]];
      afficherLignes(); planifier();
    });
  };
  afficherLignes(); afficherTotaux();

  brancher('[data-ajout]', 'click', b => {
    const t = b.dataset.ajout;
    const l = t === 'titre' ? { type: 'titre', designation: '' }
      : t === 'heures' ? { designation: 'Études et conception', qte: 1, unite: 'h', pu: Number(p.tauxHoraire) || 0 }
        : t === 'jours' ? { designation: 'Prestation d\'ingénierie', qte: 1, unite: 'j', pu: Number(p.tauxJournalier) || 0 }
          : { designation: '', qte: 1, unite: 'forfait', pu: 0 };
    doc.lignes.push(l); afficherLignes(); afficherTotaux(); planifier();
    const champs = $$('#corps-lignes [data-f="designation"]'); champs[champs.length - 1]?.focus();
  });

  // ----- actions
  $('#b-apercu').onclick = async () => { await flush(); imprimer(col, doc); };
  const on = (sel, f) => { const el = $(sel); if (el) el.onclick = f; };

  on('#b-suppr', async () => {
    if (!(await confirmer(`Supprimer ${estFacture ? 'ce brouillon' : 'le devis ' + esc(doc.numero)} ?`, 'Supprimer', 'danger'))) return;
    clearTimeout(minuterie); minuterie = null; quitterVue = null;
    for (const t of S.temps.filter(t => String(t.factureId) === String(doc.id))) { t.factureId = ''; await sauver('temps', t); }
    await supprimer(col, doc.id); location.hash = '#/' + col;
  });

  on('#b-dupliquer', async () => {
    await flush();
    const c = copie(doc); delete c.id; delete c.cree_le; delete c.modifie_le;
    Object.assign(c, { numero: prochainNumero(p.prefixDevis, auj().slice(0, 4), S.devis.map(x => x.numero)), date: auj(), dateValidite: ajouterJours(auj(), p.validiteDevis), statut: 'Brouillon' });
    const r = await sauver('devis', c); toast('Devis dupliqué'); location.hash = '#/devis/' + r.id;
  });

  on('#b-convertir', async () => {
    if (!doc.clientId) return toast('Choisissez un client.', true);
    const deja = S.factures.filter(f => String(f.devisId) === String(doc.id));
    if (deja.length && !(await confirmer(`Ce devis a déjà ${deja.length} facture(s) associée(s). Créer une nouvelle facture ?`))) return;
    doc.statut = 'Accepté'; await flush(); await sauver('devis', doc);
    await nouvelleFacture({ clientId: doc.clientId, projetId: doc.projetId, devisId: doc.id, objet: doc.objet, tva: doc.tva, lignes: copie(doc.lignes) });
    toast('Facture créée à partir du devis');
  });

  on('#b-temps', async () => {
    if (!doc.projetId) return toast('Choisissez d\'abord un projet.', true);
    const ent = S.temps.filter(t => String(t.projetId) === String(doc.projetId) && t.facturable && !t.factureId);
    if (!ent.length) return toast('Aucun temps non facturé sur ce projet.', true);
    const h = arrondi(ent.reduce((s, t) => s + (Number(t.heures) || 0), 0));
    const dates = ent.map(t => t.date).sort();
    const pr = trouver('projets', doc.projetId);
    doc.lignes = doc.lignes.filter(l => l.designation || Number(l.pu));
    doc.lignes.push({ designation: `Études et conception – ${pr.titre}\nTravaux réalisés du ${fdate(dates[0])} au ${fdate(dates[dates.length - 1])}`, qte: h, unite: 'h', pu: Number(p.tauxHoraire) || 0 });
    for (const t of ent) { t.factureId = doc.id; await sauver('temps', t); }
    afficherLignes(); afficherTotaux(); planifier();
    toast(`${nb(h)} h importée(s)`);
  });

  on('#b-emettre', async () => {
    await flush();
    if (!doc.clientId) return toast('Choisissez un client.', true);
    if (!doc.lignes.some(l => l.type !== 'titre' && l.designation)) return toast('Ajoutez au moins une ligne.', true);
    if (!p.nom || !p.siret) return toast('Renseignez au moins votre nom et votre SIRET dans Paramètres.', true);
    const emises = S.factures.filter(f => f.numero);
    const derniere = emises.map(f => f.date).sort().pop();
    if (derniere && doc.date < derniere) return toast(`La date doit être postérieure ou égale à celle de la dernière facture émise (${fdate(derniere)}).`, true);
    const num = prochainNumero(p.prefixFacture, annee(doc.date), emises.map(f => f.numero));
    if (!(await confirmer(`Émettre ${estAvoir ? 'l\'avoir' : 'la facture'} sous le numéro <strong>${esc(num)}</strong> ?<br><br>
      Une fois émise, elle ne pourra plus être modifiée ni supprimée (obligation légale). En cas d'erreur, il faudra établir un avoir.`, 'Émettre'))) return;
    doc.numero = num; doc.statut = 'emise';
    if (estAvoir) {
      const orig = trouver('factures', doc.refFactureId);
      if (orig && orig.statut === 'emise') { orig.statut = 'annulee'; doc.statut = 'solde'; await sauver('factures', orig); }
    }
    await sauver('factures', doc); toast(`${titre} ${num} émis(e)`); render();
  });

  on('#b-payer', () => {
    modal(estAvoir ? 'Enregistrer le remboursement' : 'Enregistrer le paiement', `<form class="form-grille" onsubmit="return false">
      <label class="champ">Date<input type="date" name="date" value="${auj()}"></label>
      <label class="champ">Mode<select name="mode">${MODES_PAIEMENT.map(m => `<option>${m}</option>`).join('')}</select></label></form>`, [
      { l: 'Annuler' },
      {
        l: 'Valider', cls: 'succes', f: async () => {
          const f = $('#modal-corps form');
          doc.statut = 'payee'; doc.datePaiement = f.elements.date.value || auj(); doc.modePaiement = f.elements.mode.value;
          await sauver('factures', doc); toast('Paiement enregistré'); render();
        },
      },
    ]);
  });

  on('#b-annuler-paiement', async () => {
    if (!(await confirmer('Annuler l\'enregistrement du paiement ?'))) return;
    doc.statut = 'emise'; doc.datePaiement = ''; doc.modePaiement = '';
    await sauver('factures', doc); render();
  });

  on('#b-avoir', async () => {
    if (!(await confirmer(`Créer un avoir (facture d'annulation) pour la facture ${esc(doc.numero)} ?<br><br>Les lignes seront reprises en négatif ; vous pourrez les ajuster pour un avoir partiel.`, 'Créer l\'avoir'))) return;
    await nouvelleFacture({
      type: 'avoir', refFactureId: doc.id, clientId: doc.clientId, projetId: doc.projetId, tva: doc.tva,
      objet: `Avoir sur facture ${doc.numero} du ${fdate(doc.date)}`, dateEcheance: auj(),
      lignes: doc.lignes.map(l => (l.type === 'titre' ? { ...l } : { ...l, qte: -(Number(l.qte) || 0) })),
    });
  });
}

/* ---------------------------------------------------------------------
   Impression (aperçu → PDF via le navigateur)
   --------------------------------------------------------------------- */
function docHtml(col, d) {
  const p = P();
  const c = trouver('clients', d.clientId) || {};
  const estFacture = col === 'factures';
  const estAvoir = d.type === 'avoir';
  const t = totaux(d);
  const titre = estFacture ? (estAvoir ? 'AVOIR' : 'FACTURE') : 'DEVIS';
  const brouillon = estFacture && d.statut === 'brouillon';
  const lignes = d.lignes.map(l => (l.type === 'titre'
    ? `<tr><td colspan="5" style="font-weight:700;background:#f2f4f8;-webkit-print-color-adjust:exact;print-color-adjust:exact">${esc(l.designation)}</td></tr>`
    : `<tr><td class="pre">${esc(l.designation)}</td><td class="n">${nb(l.qte)}</td><td>${esc(l.unite)}</td><td class="n">${eur(l.pu)}</td><td class="n">${eur((Number(l.qte) || 0) * (Number(l.pu) || 0))}</td></tr>`)).join('');
  const ref = estAvoir && trouver('factures', d.refFactureId);
  const devis = d.devisId && trouver('devis', d.devisId);

  return `<div class="doc">
    ${brouillon ? '<div style="position:fixed;top:40%;left:0;right:0;text-align:center;font-size:90pt;color:rgba(200,0,0,.12);transform:rotate(-30deg);font-weight:700;pointer-events:none">BROUILLON</div>' : ''}
    <div class="d-tete">
      <div class="d-emetteur">
        <div class="nom">${esc(p.nom || 'Votre nom (à renseigner dans Paramètres)')}</div>
        ${p.mentionEI ? '<div>Entrepreneur individuel (EI)</div>' : ''}
        <div class="act">${esc(p.activite)}</div>
        <div class="pre">${esc(p.adresse)}</div><div>${esc(p.cp)} ${esc(p.ville)}</div>
        ${p.tel ? `<div>Tél. : ${esc(p.tel)}</div>` : ''}${p.email ? `<div>${esc(p.email)}</div>` : ''}${p.site ? `<div>${esc(p.site)}</div>` : ''}
        ${p.siret ? `<div>SIRET : ${esc(p.siret)}</div>` : ''}
      </div>
      <div class="d-titre">
        <h1>${titre}</h1>
        <div class="no">N° ${esc(d.numero || 'BROUILLON')}</div>
        <div>Date : ${fdate(d.date)}</div>
        ${estFacture && !estAvoir ? `<div>Échéance : ${fdate(d.dateEcheance)}</div>` : ''}
        ${!estFacture ? `<div>Valable jusqu'au : ${fdate(d.dateValidite)}</div>` : ''}
      </div>
    </div>
    <div class="d-bloc">
      <div>
        ${d.objet ? `<div class="d-objet"><strong>Objet :</strong> ${esc(d.objet)}</div>` : ''}
        ${d.projetId ? `<div>Projet : ${esc(trouver('projets', d.projetId)?.ref || '')}</div>` : ''}
        ${devis ? `<div>Selon devis n° ${esc(devis.numero)} du ${fdate(devis.date)}</div>` : ''}
        ${ref ? `<div>Annule et remplace la facture n° ${esc(ref.numero)} du ${fdate(ref.date)}</div>` : ''}
        ${estFacture && d.periode ? `<div>Date / période de la prestation : ${esc(d.periode)}</div>` : ''}
        ${estFacture ? '<div>Nature de l\'opération : prestation de services</div>' : ''}
      </div>
      <div class="d-client">
        <div class="t">${estFacture ? 'Facturé à' : 'Client'}</div>
        <strong>${esc(c.nom)}</strong>
        ${c.contact ? `<div>À l'attention de ${esc(c.contact)}</div>` : ''}
        <div class="pre">${esc(c.adresse)}</div><div>${esc(c.cp)} ${esc(c.ville)}</div>
        ${c.siret ? `<div>SIREN/SIRET : ${esc(c.siret)}</div>` : ''}${c.tvaIntra ? `<div>TVA : ${esc(c.tvaIntra)}</div>` : ''}
      </div>
    </div>
    <table><thead><tr><th>Désignation</th><th class="n">Qté</th><th>Unité</th><th class="n">P.U. HT</th><th class="n">Total HT</th></tr></thead><tbody>${lignes}</tbody></table>
    <div class="d-totaux">
      ${d.tva
        ? `<div><span>Total HT</span><span>${eur(t.ht)}</span></div><div><span>TVA ${nb(d.tva)} %</span><span>${eur(t.tva)}</span></div><div class="net"><span>${estAvoir ? 'Total avoir TTC' : estFacture ? 'Net à payer TTC' : 'Total TTC'}</span><span>${eur(t.ttc)}</span></div>`
        : `<div class="net"><span>${estAvoir ? 'Total avoir' : estFacture ? 'Net à payer' : 'Total'}</span><span>${eur(t.ht)}</span></div>`}
      ${!estFacture && Number(d.acompte) ? `<div><span>Acompte à la commande (${nb(d.acompte)} %)</span><span>${eur(t.ttc * d.acompte / 100)}</span></div>` : ''}
    </div>
    ${d.tva ? '' : `<div class="d-mention">${esc(p.mentionTVA)}</div>`}
    ${d.notes ? `<div class="d-cond pre">${esc(d.notes)}</div>` : ''}
    <div class="d-cond">
      ${estFacture && !estAvoir ? `
        <p><strong>Conditions de paiement :</strong> paiement à réception, au plus tard le ${fdate(d.dateEcheance)}${p.iban ? ', par virement bancaire.' : '.'}</p>
        ${p.iban ? `<p><strong>Coordonnées bancaires :</strong> ${p.banque ? esc(p.banque) + ' – ' : ''}IBAN ${esc(p.iban)}${p.bic ? ' – BIC ' + esc(p.bic) : ''}</p>` : ''}
        <p>${esc(p.penalites)}</p>` : ''}
      ${!estFacture ? `
        ${d.conditions ? `<p class="pre">${esc(d.conditions)}</p>` : ''}
        <p>Devis gratuit. Prix exprimés en euros. Conditions de paiement : ${nb(p.delaiPaiement)} jours à réception de facture${Number(d.acompte) ? `, acompte de ${nb(d.acompte)} % à la commande` : ''}.</p>` : ''}
    </div>
    ${!estFacture ? `<div class="d-signature"><div>Bon pour accord – date, signature et cachet du client,<br>précédés de la mention « Devis reçu avant l'exécution des travaux, bon pour accord ».</div></div>` : ''}
    <div class="d-pied">
      ${esc(p.nom)}${p.mentionEI ? ' – EI' : ''} – ${esc(p.adresse).replace(/\n/g, ', ')} ${esc(p.cp)} ${esc(p.ville)}<br>
      ${p.siret ? `SIRET ${esc(p.siret)}` : ''}${p.ape ? ` – APE ${esc(p.ape)}` : ''}${p.mentionPied ? ` – ${esc(p.mentionPied)}` : ''}
    </div>
  </div>`;
}

function imprimer(col, doc) {
  $('#impression').innerHTML = docHtml(col, doc);
  const ancien = document.title;
  const client = (nomClient(doc.clientId) || '').replace(/[^\w\-]+/g, '_');
  document.title = `${doc.numero || 'brouillon'}_${client}`; // nom proposé pour le PDF
  setTimeout(() => { window.print(); document.title = ancien; }, 50);
}

/* ---------------------------------------------------------------------
   Paramètres & sauvegarde
   --------------------------------------------------------------------- */
function vueParametres() {
  const p = P();
  V().innerHTML = `
    ${entete('Paramètres', '<button class="btn primaire" id="enregistrer">Enregistrer</button>')}
    <div class="carte">${formHtml(CHAMPS_PARAMETRES, p)}</div>
    <div class="carte">
      <h2>Sauvegarde des données</h2>
      <p>Vos données sont dans le fichier <code>donnees/gestion.db</code> du dossier de l'application. Une copie automatique est faite à chaque démarrage dans <code>donnees/sauvegardes/</code>.</p>
      <p>Pour plus de sécurité, téléchargez régulièrement une sauvegarde et rangez-la sur un autre support (clé USB, cloud…).</p>
      <div class="actions">
        <a class="btn" href="/api/export" download>⬇ Télécharger une sauvegarde (.json)</a>
        <label class="btn">⬆ Restaurer une sauvegarde<input type="file" id="restaurer" accept=".json" hidden></label>
      </div>
    </div>`;
  $('#enregistrer').onclick = async () => {
    const data = lireForm($('#vue form'), CHAMPS_PARAMETRES);
    if (!verifierRequis(CHAMPS_PARAMETRES, data)) return;
    const obj = S.parametres[0] || { id: 1 };
    await sauver('parametres', Object.assign(obj, data));
    toast('Paramètres enregistrés'); render();
  };
  $('#restaurer').onchange = async e => {
    const fichier = e.target.files[0];
    if (!fichier) return;
    let data;
    try { data = JSON.parse(await fichier.text()); } catch (err) { return toast('Fichier invalide', true); }
    if (!data || !Array.isArray(data.clients)) return toast('Ce fichier n\'est pas une sauvegarde valide', true);
    if (!(await confirmer('Remplacer <strong>toutes</strong> les données actuelles par celles de la sauvegarde ?<br>(une copie de sécurité des données actuelles sera faite automatiquement)', 'Restaurer', 'danger'))) return;
    await api('POST', '/api/import', data);
    await chargerTout(); toast('Sauvegarde restaurée'); location.hash = '#/tableau'; render();
  };
}

/* ---------------------------------------------------------------------
   Démarrage
   --------------------------------------------------------------------- */
(async () => {
  try {
    await chargerTout();
    render();
  } catch (e) {
    V().innerHTML = `<div class="carte"><h2>Impossible de joindre le serveur local</h2>
      <p>Lancez l'application avec <strong>Lancer.bat</strong> (Windows) ou <strong>lancer.sh</strong> (Mac/Linux), puis rechargez cette page.</p>
      <p class="aide">${esc(e.message)}</p></div>`;
  }
})();
