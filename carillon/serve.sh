#!/usr/bin/env sh
# Serveur statique local pour CARILLON (le jeu ne fonctionne pas en file://).
cd "$(dirname "$0")" && echo "CARILLON → http://localhost:8080/" && python3 -m http.server 8080
