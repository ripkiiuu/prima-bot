@echo off
echo --- Mengupdate Bot ke GitHub ---

echo.
echo 1. Menambahkan file baru...
git add .

echo.
echo 2. Menyimpan perubahan (Commit)...
set /p commit_msg="Masukkan pesan update (contoh: update fitur menu): "
if "%commit_msg%"=="" set commit_msg="Update bot"
git commit -m "%commit_msg%"

echo.
echo 3. Mengirim ke GitHub (Push)...
git push origin main

echo.
echo Selesai! Sekarang login ke VPS dan ketik 'git pull' untuk update.
pause
