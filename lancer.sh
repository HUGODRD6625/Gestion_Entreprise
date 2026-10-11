#!/bin/sh
# Lancement de l'application (Mac / Linux)
cd "$(dirname "$0")" || exit 1
exec python3 server.py
