# Gestion d'activité – micro-entreprise

Une application simple pour gérer une activité d'auto-entrepreneur en conception mécanique
et en logiciels métiers : **clients, projets, devis, factures, livrables et suivi du temps**.

- Fonctionne **sur votre ordinateur**, dans votre navigateur (Chrome, Edge, Firefox…).
- **Aucune installation** à part Python. Fonctionne sans connexion Internet.
- Vos données restent chez vous, dans un seul fichier : `donnees/gestion.db`.

---

## 1. Installation (une seule fois)

1. Installez **Python 3** depuis <https://www.python.org/downloads/>.
   Sous Windows, **cochez la case « Add Python to PATH »** pendant l'installation.
2. Téléchargez ce dossier (bouton vert **Code → Download ZIP** sur GitHub), puis
   décompressez-le dans un endroit fixe, par exemple `Documents\Gestion_Entreprise`.

## 2. Lancement

- **Windows** : double-cliquez sur **`Lancer.bat`**.
- **Mac / Linux** : double-cliquez sur **`lancer.sh`** (ou tapez `./lancer.sh` dans un terminal).

Une fenêtre noire s'ouvre (c'est le « serveur » local, **laissez-la ouverte**) et
l'application s'affiche dans votre navigateur à l'adresse <http://127.0.0.1:8765>.
Pour arrêter, fermez simplement la fenêtre noire.

> Astuce : ajoutez l'adresse `http://127.0.0.1:8765` dans vos favoris.

## 3. Premiers pas

1. **Paramètres** : saisissez votre nom, SIRET, adresse, IBAN, taux horaire/journalier.
   Ces informations apparaissent automatiquement sur vos devis et factures.
2. **Clients** : créez vos clients.
3. **Projets** : créez une affaire par client (référence automatique `P-2026-001`).
4. Dans un projet : ajoutez des **livrables**, saisissez votre **temps**, créez un **devis**.
5. Devis accepté → bouton **« Facturer ce devis »** → vérifiez → **« Émettre la facture »**.
6. À réception du règlement → **« Enregistrer le paiement »**.

## 4. Fonctionnalités

| Module | Ce qu'il fait |
|---|---|
| **Tableau de bord** | CA encaissé et facturé de l'année, factures à encaisser / en retard, devis en attente, graphique mensuel, suivi du plafond micro-entreprise et du seuil de TVA, estimation des cotisations URSSAF, alertes (factures en retard, devis qui expirent, livrables à rendre). |
| **Clients** | Fiche client, historique des projets, devis et factures, CA réalisé, reste dû. |
| **Projets** | Suivi par affaire : statut, échéance, budget, dossier de travail, temps passé, **taux horaire réel** (facturé ÷ heures passées). |
| **Devis** | Numérotation automatique (`D-2026-001`), lignes en heures / jours / forfait, titres de section, acompte, validité, duplication, conversion en facture. |
| **Factures** | Numérotation chronologique **à l'émission** (`F-2026-001`), facture verrouillée une fois émise (obligation légale), import automatique du temps non facturé, suivi des paiements et retards, **avoirs**. |
| **Livrables** | Plans, modèles 3D, notes de calcul, logiciels… avec **indices de révision** (A → B → C, ou 1.0 → 1.1) et historique des indices. |
| **Suivi du temps** | Saisie des heures par projet, filtre par mois, repérage du temps facturable non encore facturé. |
| **PDF** | Bouton **« Aperçu / PDF »** → dans la fenêtre d'impression, choisissez **« Enregistrer au format PDF »**. |

Les mentions obligatoires sont intégrées aux documents : « EI », SIRET, « TVA non applicable,
art. 293 B du CGI », date d'échéance, pénalités de retard et indemnité forfaitaire de 40 €,
mention « Bon pour accord » sur les devis. Le passage à la TVA est possible dans les Paramètres.

## 5. Sauvegardes

- Une copie automatique de la base est faite **à chaque démarrage** dans
  `donnees/sauvegardes/` (les 30 dernières sont gardées).
- Dans **Paramètres → Sauvegarde**, téléchargez régulièrement un fichier `.json` et
  rangez-le ailleurs (clé USB, cloud). Le même écran permet de le restaurer.
- Pour changer d'ordinateur : copiez tout le dossier, **y compris `donnees/`**.

Le dossier `donnees/` est exclu de Git (`.gitignore`) : vos clients et factures ne seront
jamais publiés sur GitHub.

## 6. À savoir

- Les taux de cotisations et les seuils (plafond micro, franchise de TVA) sont modifiables
  dans les Paramètres ; les valeurs proposées sont **indicatives, vérifiez-les** sur
  <https://www.autoentrepreneur.urssaf.fr>.
- **Facturation électronique** : à partir du 1er septembre 2027, les micro-entreprises devront
  émettre leurs factures entre entreprises via une plateforme agréée. Cet outil produit des PDF :
  il restera utile pour préparer et suivre les factures, mais l'envoi devra alors passer par une
  plateforme.

## 7. Organisation technique (pour information)

```
server.py        petit serveur local (Python, sans dépendance) + base SQLite
app/index.html   page de l'application
app/app.js       logique de l'interface
app/style.css    mise en forme (écran et impression A4)
donnees/         vos données (créé au premier lancement)
```

Pour changer le port (si 8765 est déjà pris) : définir la variable d'environnement
`GESTION_PORT`, par exemple `set GESTION_PORT=8800` avant de lancer.
