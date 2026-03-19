# Panduan Deploy Bot WhatsApp ke VPS (Ubuntu 22.04)

Ini adalah panduan khusus untuk VPS kamu (`103.217.145.151`).

## Bagian 1: Upload Kode ke GitHub (Di Laptop Kamu)

1.  Buka terminal di folder project ini.
2.  Jalankan perintah berikut satu per satu:

```bash
# Inisialisasi Git (jika belum pernah)
git init

# Tambahkan semua file
git add .

# Simpan perubahan
git commit -m "Siap deploy ke VPS"

# Ubah nama branch utama jadi 'main'
git branch -M main

# HUBUNGKAN KE GITHUB
# Ganti URL di bawah dengan URL repository GitHub kamu yang baru dibuat
# Contoh: https://github.com/username/bot-wa.git
git remote add origin <URL_REPO_GITHUB_KAMU>

# Upload kode
git push -u origin main
```

_Catatan: Jika error saat `git remote add`, coba `git remote set-url origin <URL_REPO_GITHUB_KAMU>`._

---

## Bagian 2: Setup VPS (Di Server)

1.  Masuk ke VPS kamu:

    ```bash
    ssh ripkiiuu@103.217.145.151
    ```

    _(Masukkan password VPS kamu jika diminta)_

2.  Update dan install tool dasar:

    ```bash
    sudo apt update && sudo apt upgrade -y
    sudo apt install -y curl git ffmpeg build-essential
    ```

3.  Install Node.js (versi 20 LTS disarankan):

    ```bash
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    ```

4.  Install PM2 (untuk menjalankan bot 24/7):
    ```bash
    sudo npm install -g pm2
    ```

---

## Bagian 3: Install Bot di VPS

1.  Download kode dari GitHub:

    ```bash
    # Ganti URL ini dengan URL repo kamu
    git clone <URL_REPO_GITHUB_KAMU> bot-wa
    cd bot-wa
    ```

2.  Install library bot:

    ```bash
    npm install
    ```

3.  Install Chrome untuk Puppeteer (PENTING untuk Linux):

    ```bash
    npx puppeteer browsers install chrome --install-deps
    ```

4.  Setup konfigurasi:
    ```bash
    cp .env.example .env
    nano .env
    ```
    _Isi data yang diperlukan di file `.env` (API Key, Owner Number, dll). Tekan `Ctrl+X`, lalu `Y`, lalu `Enter` untuk menyimpan._

---

## Bagian 4: Menjalankan Bot

### Langkah 1: Scan QR Code (Manual dulu)

Jalankan perintah ini untuk memunculkan QR Code di terminal:

```bash
npm start
```

1.  Scan QR code dengan HP kamu.
2.  Tunggu sampai muncul pesan "Client is ready!".
3.  Tekan `Ctrl + C` untuk mematikan bot sementara.

### Langkah 2: Jalankan 24/7 dengan PM2

Sekarang jalankan bot di background:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

_(Copy dan jalankan perintah `sudo` yang muncul dari output `pm2 startup` jika ada)_

---

## Perintah Berguna Lainnya

- Cek status bot: `pm2 status`
- Lihat log/error: `pm2 logs wa-bot-premium`
- Restart bot: `pm2 restart wa-bot-premium`
- Stop bot: `pm2 stop wa-bot-premium`
