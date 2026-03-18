# Deploy ke Oracle Cloud Free Tier

Panduan ini untuk project di folder ini yang memakai `whatsapp-web.js`, `LocalAuth`, dan Puppeteer headless.

## Arsitektur yang dipakai

Per 18 Maret 2026, Oracle Cloud Free Tier masih menyediakan shape Always Free:

- `VM.Standard.E2.1.Micro` (AMD/x86)
- `VM.Standard.A1.Flex` (Arm)

Untuk bot ini, pilih `VM.Standard.E2.1.Micro` lebih dulu. Alasannya sederhana: Puppeteer secara default mengunduh browser Linux x86, sedangkan browser Linux arm64 tidak disediakan oleh Chrome for Testing. Jalur Arm masih mungkin, tapi setup-nya lebih ribet dan bukan opsi tercepat untuk deploy pertama.

Sumber:

- https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm
- https://docs.oracle.com/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- https://pptr.dev/troubleshooting

## 1. Buat VM Oracle

Di Oracle Cloud Console:

1. Buat Compute Instance baru.
2. Image: `Ubuntu 22.04` atau `Ubuntu 24.04`.
3. Shape: `VM.Standard.E2.1.Micro`.
4. Centang `Always Free eligible`.
5. Tambahkan public IP.
6. Masukkan SSH public key milikmu.
7. Untuk security list, cukup buka port `22` untuk SSH. Bot ini tidak perlu port HTTP publik.

## 2. Masuk ke server

Contoh:

```bash
ssh ubuntu@IP_SERVER_ORACLE
```

Kalau username default image kamu berbeda, sesuaikan.

## 3. Clone project

```bash
git clone <URL_REPO_KAMU> wa-bot
cd wa-bot
```

Kalau repo belum ada di GitHub, kamu bisa upload manual ke server dengan SFTP atau ZIP.

## 4. Install dependency server

Jalankan script yang sudah disiapkan:

```bash
bash deploy/oracle/bootstrap-ubuntu.sh
```

Script ini akan:

- install Node.js 20
- install `ffmpeg`
- install `pm2`
- install dependency npm production
- install Chrome + dependency Linux yang dibutuhkan Puppeteer

## 5. Isi environment

```bash
cp .env.example .env
nano .env
```

Minimal isi yang kamu perlukan:

- `ADMINS`
- `GEMINI_API_KEY` atau provider AI lain yang benar-benar kamu pakai
- `OPENWEATHER_API_KEY` kalau command cuaca dipakai
- `OCR_API_KEY` kalau command OCR dipakai

## 6. Login WhatsApp pertama kali

Jangan langsung pakai PM2. Login pertama lebih aman dilakukan di terminal biasa supaya QR code mudah discan.

```bash
npm start
```

Lalu:

1. scan QR dari terminal SSH
2. tunggu sampai muncul log bot siap
3. hentikan proses dengan `Ctrl+C`

Setelah itu sesi akan tersimpan di folder `.wwebjs_auth`.

## 7. Jalankan 24/7 dengan PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u $USER --hp $HOME
```

Jalankan juga command terakhir yang dihasilkan oleh `pm2 startup`, karena PM2 biasanya akan mencetak satu command `sudo` tambahan.

Perintah penting:

```bash
pm2 status
pm2 logs wa-bot-premium
pm2 restart wa-bot-premium
pm2 stop wa-bot-premium
```

## 8. File penting yang harus tetap ada

- `.env`
- `.wwebjs_auth/`
- `.wwebjs_cache/`
- `data/`

Kalau folder `.wwebjs_auth` hilang, biasanya kamu harus scan QR ulang.

## 9. Catatan penting untuk bot ini

- Runtime server sekarang mendukung `PUPPETEER_EXECUTABLE_PATH` jika nanti kamu ingin memakai browser sistem.
- Session path bisa dipindah dengan `WWEBJS_DATA_PATH`.
- Bot sudah ditambahkan graceful shutdown agar proses PM2 tidak memutus sesi secara kasar.

## 10. Troubleshooting cepat

Kalau bot gagal start karena browser:

```bash
npx puppeteer browsers install chrome --install-deps
```

Kalau auth gagal total:

```bash
rm -rf .wwebjs_auth
npm start
```

Kalau RAM terasa sempit di `E2.1.Micro`:

- nonaktifkan fitur yang berat dipakai terus-menerus
- hindari banyak proses lain di VM
- pertimbangkan pindah ke instance Oracle lain atau VPS murah
