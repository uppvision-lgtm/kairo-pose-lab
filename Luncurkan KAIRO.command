#!/bin/zsh -l
cd "$(dirname "$0")" || exit 1
if ! command -v npm >/dev/null 2>&1; then
  echo 'Node.js belum tersedia. Install Node.js LTS lalu jalankan kembali.'
  read '?Tekan Enter untuk menutup...'
  exit 1
fi
if [ ! -d node_modules ]; then
  npm ci || exit 1
fi
echo 'KAIRO siap dibuka di http://localhost:5188'
echo 'Biarkan jendela ini terbuka selama bermain. Ctrl+C untuk menghentikan server.'
npm run dev -- --port 5188 --strictPort
