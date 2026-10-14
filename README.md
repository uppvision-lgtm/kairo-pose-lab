# KAIRO — Pose Lab v2

Simulator robot 3D dengan kendali pose tubuh bagian atas secara langsung dan kamera third person. Robot berdiri di tempat. Arah bahu, siku, pergelangan, kepala, dan torso diterjemahkan menjadi rotasi sendi yang kontinu.

## Jalankan di Mac

Klik dua kali `Luncurkan KAIRO.command`, lalu buka **http://localhost:5188** di Chrome. Jika server sudah berjalan, langsung buka alamatnya. Terminal perlu tetap terbuka selama memakai aplikasi.

```sh
npm ci
npm run dev
```

Port 5188 digunakan agar tidak bertabrakan dengan aplikasi lain yang berjalan di 5173. Semua aset runtime — model pose, WASM, font, dan arena — tersedia lokal setelah instalasi. Video diproses di browser dan tidak disimpan atau dikirim ke server. Tidak perlu akun atau API key.

## Memakai tubuhmu

1. Pilih **Masuk Pose Lab**, lalu izinkan kamera. Kamera juga bisa diaktifkan lewat panel Pilot Link.
2. Duduk tegak; pastikan kepala, bahu, siku, dan kedua tangan terlihat. Tangan santai di depan dada membantu menghindari meja yang menutupi lengan.
3. Tahan posisi selama 2 detik sampai **LIVE · DIRECT POSE** muncul. Kalibrasi membutuhkan sampel yang terlihat terus-menerus.
4. Rentangkan lengan, tekuk siku, gerakkan pergelangan, atau miringkan badan. Posisi sendi robot mengikuti secara langsung; tidak ada pemicu animasi pukulan dari gesture.
5. Jangkau lima sasaran di depan dan samping. Sentuhan aktual tangan atau bilah pedang menggerakkan sasaran; gerakan lebih cepat memberi dorongan lebih besar.

Kamera tunggal memperkirakan kedalaman, sehingga gerak maju–mundur dan bagian tubuh yang tertutup bisa kurang akurat. Setiap lengan ditahan sebentar saat hilang, lalu turun perlahan; lengan lain tetap mengikuti jika masih terlihat. Kontak dinonaktifkan saat kehilangan tracking, kalibrasi, dan penahanan pose. Tracking pergelangan menggunakan titik tangan dari model pose; jari belum dilacak satu per satu.

## Kamera permainan dan peralatan

- Drag pada area arena untuk memutar kamera 360° di sekitar robot.
- Scroll untuk zoom. Tombol **Kamera Belakang** atau **C** mengembalikan pandangan third person.
- **Lihat Depan** memudahkan pemeriksaan gerak seperti cermin.
- **Tahan Pose** membekukan pose yang sedang terlihat sambil membiarkan kamera orbit bergerak. Kamera webcam tetap aktif sampai tombol Matikan Kamera ditekan. Gunakan **Lanjutkan Pose** untuk melanjutkan.
- Kaki dan posisi robot tetap; tidak ada kontrol berjalan.
- **Tinju:** kontak kedua tangan dengan sasaran.
- **Pedang:** dipasang pada tangan kanan dan mengikuti pergelangan, termasuk kontak sepanjang bilahnya.
- **Meriam:** arah laras mengikuti tangan kanan. Tembakkan secara manual dengan **F** atau tombol **Tembak**.
- **Sensor:** atur penghalusan/respons gerakan serta skala gerak kedalaman.
- **Reset Sasaran:** kembalikan sasaran dan angka kontak ke awal.
- **Contoh Gerak:** menggunakan data sensor sintetis melalui jalur pemetaan pose yang sama. Mode ini diberi label DEMO/SIMULASI dan tidak diklaim sebagai tracking webcam.

## Progres versi pertama

Fokus v2 adalah kebebasan gerakan di ruang uji. Peralatan dapat dipilih bebas tanpa kredit. Data duel lama pada `kairo.pilot.v1` tidak diubah. Pengaturan sensor dan peralatan simulator disimpan terpisah pada `kairo.pose.settings.v2`. Kode ekonomi dan pertarungan v1 masih tersedia di `src/game.js`, serta contoh UI v1 di `legacy/`, untuk integrasi ulang setelah kontrol pose cocok. File legacy adalah referensi, bukan aplikasi yang dijalankan.

## Pemeriksaan

```sh
npm test
npm run build
```

Tes mencakup pemetaan lengan kiri/kanan, fleksi siku, mengangkat kedua lengan, kompensasi torso, orientasi pergelangan, kalibrasi tanpa kaki terlihat, kehilangan tracking per lengan, pose freeze, stabilisasi ketika tracking kembali, koordinat invalid, dan benturan yang melewati sasaran di antara dua frame. Tes ekonomi v1 dipertahankan.

Browser QA mencakup contoh pose kontinu, kontak sasaran, pose yang ditahan, pandangan depan/belakang, drag untuk orbit, dan pemuatan webcam/model lokal. Video webcam berhasil masuk pada 640×480. Penyesuaian pose langsung pada tubuh pemain tetap memerlukan kalibrasi dengan kedua lengan terlihat; tes sintetis tidak membuktikan akurasi semua gerakan fisik.

## Struktur

- `src/pose.js`: kalibrasi, pemetaan landmark 3D ke quaternion sendi, smoothing, dan penanganan tracking hilang.
- `src/camera.js`: aliran video serta MediaPipe. Tidak mengklasifikasikan gesture.
- `src/contact.js`: kontak geometris tangan/bilah dan sasaran, serta pencegahan benturan palsu.
- `src/scene.js`: model robot berartikulasi, arena, kamera orbit, sasaran dan efek.
- `src/main.js`: UI simulator, mode sensor/demo, peralatan, dan pengaturan lokal.
- `tests/pose.test.js`: tes pemetaan pose dan kontak.

Referensi: [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js), [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html). Model robot dan arena dibuat secara prosedural, bukan aset film atau GTA.
