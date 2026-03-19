@echo off
echo --- Fixing Upload Issues ---

echo.
echo Mencoba mengambil perubahan dari GitHub dulu (Pull)...
git pull origin main --allow-unrelated-histories

echo.
echo Sekarang mencoba upload lagi (Push)...
git push -u origin main

pause
