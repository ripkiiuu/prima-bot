@echo off
echo --- Setting up Git Repository ---

echo.
echo 1. Initializing Git...
git init

echo.
echo 2. Adding files...
git add .

echo.
echo 3. Committing files...
git commit -m "Siap deploy ke VPS"

echo.
echo 4. Renaming branch to main...
git branch -M main

echo.
echo 5. Configuring remote repository...
git remote remove origin 2>nul
git remote add origin https://github.com/ripkiiuu/bot-prima.git

echo.
echo --- Setup Complete! ---
echo.
echo Sekarang jalankan perintah ini untuk upload:
echo    git push -u origin main
echo.
pause
