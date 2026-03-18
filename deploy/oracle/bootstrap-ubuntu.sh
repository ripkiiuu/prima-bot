#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Jalankan script ini sebagai user biasa yang punya akses sudo, bukan root."
  exit 1
fi

if [[ ! -f "package.json" ]]; then
  echo "Jalankan script ini dari root project bot."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

sudo apt-get update
sudo apt-get install -y \
  ca-certificates \
  curl \
  ffmpeg \
  git \
  gnupg

need_nodesource=0
if ! command -v node >/dev/null 2>&1; then
  need_nodesource=1
else
  node_major="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "${node_major}" -lt 20 ]]; then
    need_nodesource=1
  fi
fi

if [[ "${need_nodesource}" -eq 1 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

sudo npm install -g pm2
npm ci --omit=dev
npx puppeteer browsers install chrome --install-deps

mkdir -p data

cat <<'EOF'

Bootstrap selesai.

Langkah berikutnya:
1. Salin .env.example menjadi .env lalu isi semua API key yang dibutuhkan.
2. Jalankan "npm start" sekali untuk scan QR WhatsApp.
3. Setelah status bot ready, hentikan dengan Ctrl+C.
4. Jalankan "pm2 start ecosystem.config.cjs".
5. Jalankan "pm2 save".
6. Jalankan output dari "pm2 startup systemd -u $USER --hp $HOME".

EOF
