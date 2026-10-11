#!/usr/bin/env python3
"""
Gestion d'activité - serveur local.

Lance un petit serveur web sur votre ordinateur (http://127.0.0.1:8765)
et ouvre l'interface dans le navigateur. Aucune installation requise :
uniquement Python 3.8+ (bibliothèque standard).

Les données sont enregistrées dans le fichier  donnees/gestion.db  (SQLite).
Une copie de sauvegarde est faite automatiquement à chaque démarrage dans
donnees/sauvegardes/ (les 30 dernières sont conservées).
"""

import json
import os
import shutil
import sqlite3
import sys
import threading
import webbrowser
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HOTE = "127.0.0.1"
PORT = int(os.environ.get("GESTION_PORT", "8765"))

RACINE = os.path.dirname(os.path.abspath(__file__))
DOSSIER_APP = os.path.join(RACINE, "app")
DOSSIER_DONNEES = os.path.join(RACINE, "donnees")
DOSSIER_SAUVEGARDES = os.path.join(DOSSIER_DONNEES, "sauvegardes")
FICHIER_BDD = os.path.join(DOSSIER_DONNEES, "gestion.db")
NB_SAUVEGARDES = 30

COLLECTIONS = ("parametres", "clients", "projets", "devis", "factures", "livrables", "temps")

verrou = threading.Lock()


def connexion():
    con = sqlite3.connect(FICHIER_BDD)
    con.row_factory = sqlite3.Row
    return con


def initialiser_bdd():
    os.makedirs(DOSSIER_DONNEES, exist_ok=True)
    with connexion() as con:
        for nom in COLLECTIONS:
            con.execute(
                f"""CREATE TABLE IF NOT EXISTS {nom} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    data TEXT NOT NULL,
                    cree_le TEXT NOT NULL,
                    modifie_le TEXT NOT NULL
                )"""
            )


def sauvegarde_automatique():
    if not os.path.exists(FICHIER_BDD):
        return
    os.makedirs(DOSSIER_SAUVEGARDES, exist_ok=True)
    horodatage = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    shutil.copy2(FICHIER_BDD, os.path.join(DOSSIER_SAUVEGARDES, f"gestion_{horodatage}.db"))
    anciennes = sorted(f for f in os.listdir(DOSSIER_SAUVEGARDES) if f.endswith(".db"))
    for f in anciennes[:-NB_SAUVEGARDES]:
        os.remove(os.path.join(DOSSIER_SAUVEGARDES, f))


def ligne_vers_dict(ligne):
    d = json.loads(ligne["data"])
    d["id"] = ligne["id"]
    d["cree_le"] = ligne["cree_le"]
    d["modifie_le"] = ligne["modifie_le"]
    return d


def nettoyer(data):
    return {k: v for k, v in data.items() if k not in ("id", "cree_le", "modifie_le")}


def maintenant():
    return datetime.now().isoformat(timespec="seconds")


def tout_exporter(con):
    return {nom: [ligne_vers_dict(l) for l in con.execute(f"SELECT * FROM {nom} ORDER BY id")]
            for nom in COLLECTIONS}


class Gestionnaire(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DOSSIER_APP, **kwargs)

    def log_message(self, format, *args):
        pass  # console silencieuse

    # ---------- utilitaires ----------
    def envoyer_json(self, objet, code=200, entetes=None):
        corps = json.dumps(objet, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corps)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (entetes or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(corps)

    def lire_json(self):
        taille = int(self.headers.get("Content-Length") or 0)
        if not taille:
            return {}
        return json.loads(self.rfile.read(taille).decode("utf-8"))

    def route(self):
        morceaux = [m for m in urlparse(self.path).path.split("/") if m]
        if not morceaux or morceaux[0] != "api":
            return None
        return morceaux[1:]

    def erreur(self, code, message):
        self.envoyer_json({"erreur": message}, code)

    def end_headers(self):
        # évite que le navigateur garde une ancienne version de l'interface
        if not self.path.startswith("/api"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    # ---------- méthodes HTTP ----------
    def do_GET(self):
        r = self.route()
        if r is None:
            return super().do_GET()
        try:
            with verrou, connexion() as con:
                if r == ["export"]:
                    nom = f"gestion_export_{datetime.now().strftime('%Y-%m-%d')}.json"
                    return self.envoyer_json(tout_exporter(con), entetes={
                        "Content-Disposition": f'attachment; filename="{nom}"'})
                if len(r) == 1 and r[0] in COLLECTIONS:
                    lignes = con.execute(f"SELECT * FROM {r[0]} ORDER BY id").fetchall()
                    return self.envoyer_json([ligne_vers_dict(l) for l in lignes])
                if len(r) == 2 and r[0] in COLLECTIONS:
                    l = con.execute(f"SELECT * FROM {r[0]} WHERE id=?", (int(r[1]),)).fetchone()
                    return self.envoyer_json(ligne_vers_dict(l)) if l else self.erreur(404, "Introuvable")
            self.erreur(404, "Route inconnue")
        except Exception as e:  # pragma: no cover
            self.erreur(500, str(e))

    def do_POST(self):
        r = self.route()
        if r is None:
            return self.erreur(404, "Route inconnue")
        try:
            data = self.lire_json()
            with verrou, connexion() as con:
                if r == ["import"]:
                    # restauration complète depuis un export JSON
                    sauvegarde_automatique()
                    for nom in COLLECTIONS:
                        con.execute(f"DELETE FROM {nom}")
                        con.execute("DELETE FROM sqlite_sequence WHERE name=?", (nom,))
                        for obj in data.get(nom, []):
                            con.execute(
                                f"INSERT INTO {nom} (id, data, cree_le, modifie_le) VALUES (?,?,?,?)",
                                (obj.get("id"), json.dumps(nettoyer(obj), ensure_ascii=False),
                                 obj.get("cree_le") or maintenant(), obj.get("modifie_le") or maintenant()))
                    return self.envoyer_json({"ok": True})
                if len(r) == 1 and r[0] in COLLECTIONS:
                    t = maintenant()
                    cur = con.execute(
                        f"INSERT INTO {r[0]} (data, cree_le, modifie_le) VALUES (?,?,?)",
                        (json.dumps(nettoyer(data), ensure_ascii=False), t, t))
                    l = con.execute(f"SELECT * FROM {r[0]} WHERE id=?", (cur.lastrowid,)).fetchone()
                    return self.envoyer_json(ligne_vers_dict(l), 201)
            self.erreur(404, "Route inconnue")
        except Exception as e:
            self.erreur(500, str(e))

    def do_PUT(self):
        r = self.route()
        if r is None or len(r) != 2 or r[0] not in COLLECTIONS:
            return self.erreur(404, "Route inconnue")
        try:
            data = self.lire_json()
            with verrou, connexion() as con:
                ident = int(r[1])
                existe = con.execute(f"SELECT id FROM {r[0]} WHERE id=?", (ident,)).fetchone()
                t = maintenant()
                if existe:
                    con.execute(f"UPDATE {r[0]} SET data=?, modifie_le=? WHERE id=?",
                                (json.dumps(nettoyer(data), ensure_ascii=False), t, ident))
                else:
                    con.execute(f"INSERT INTO {r[0]} (id, data, cree_le, modifie_le) VALUES (?,?,?,?)",
                                (ident, json.dumps(nettoyer(data), ensure_ascii=False), t, t))
                l = con.execute(f"SELECT * FROM {r[0]} WHERE id=?", (ident,)).fetchone()
                return self.envoyer_json(ligne_vers_dict(l))
        except Exception as e:
            self.erreur(500, str(e))

    def do_DELETE(self):
        r = self.route()
        if r is None or len(r) != 2 or r[0] not in COLLECTIONS:
            return self.erreur(404, "Route inconnue")
        with verrou, connexion() as con:
            con.execute(f"DELETE FROM {r[0]} WHERE id=?", (int(r[1]),))
        self.envoyer_json({"ok": True})


def main():
    initialiser_bdd()
    sauvegarde_automatique()
    try:
        serveur = ThreadingHTTPServer((HOTE, PORT), Gestionnaire)
    except OSError:
        print(f"Le port {PORT} est déjà utilisé : l'application est sans doute déjà lancée.")
        webbrowser.open(f"http://{HOTE}:{PORT}/")
        return
    url = f"http://{HOTE}:{PORT}/"
    print("=" * 60)
    print("  Gestion d'activité - serveur démarré")
    print(f"  Adresse : {url}")
    print(f"  Données : {FICHIER_BDD}")
    print("  Laissez cette fenêtre ouverte pendant l'utilisation.")
    print("  Pour arrêter : fermez cette fenêtre (ou Ctrl+C).")
    print("=" * 60)
    if "--sans-navigateur" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur.")


if __name__ == "__main__":
    main()
