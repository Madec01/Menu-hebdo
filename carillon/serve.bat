@echo off
REM Serveur statique local pour CARILLON (le jeu ne fonctionne pas en file://).
cd /d "%~dp0"
echo CARILLON -^> http://localhost:8080/
python -m http.server 8080
