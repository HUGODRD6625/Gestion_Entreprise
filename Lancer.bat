@echo off
chcp 65001 >nul
title Gestion d'activite
cd /d "%~dp0"
where py >nul 2>nul && (py -3 server.py & goto fin)
where python >nul 2>nul && (python server.py & goto fin)
echo.
echo Python n'est pas installe sur cet ordinateur.
echo Telechargez-le sur https://www.python.org/downloads/
echo (cochez "Add Python to PATH" pendant l'installation), puis relancez ce fichier.
echo.
pause
:fin
