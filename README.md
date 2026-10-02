# bawaslu-reminder

Aplikasi pengingat jadwal internal untuk **Bawaslu Bekasi Kota**. Staf membuat
jadwal, lalu menekan tombol **Ingatkan** untuk mengirim pengingat ke seluruh staf
atau satu divisi. Notifikasi bisa muncul di dalam aplikasi maupun lewat Web Push
di HP.

Dibangun sebagai PWA (Progressive Web App), jadi bisa dipasang ke layar utama dan
berjalan seperti aplikasi biasa.

---

## Daftar Isi

- [Fitur](#fitur)
- [Teknologi](#teknologi)
- [Menjalankan Secara Lokal](#menjalankan-secara-lokal)
- [Variabel Environment](#variabel-environment)
- [Menyiapkan Database](#menyiapkan-database)
- [Deploy ke Vercel](#deploy-ke-vercel)
- [Menjalankan Pengujian](#menjalankan-pengujian)
- [Struktur Proyek](#struktur-proyek)
- [Catatan Teknis](#catatan-teknis)
- [Yang Belum Terselesaikan](#yang-belum-terselesaikan)

---

## Fitur

| Halaman | Isi |
| --- | --- |
| **Beranda** | Jam realtime, jadwal berikutnya dengan hitung mundur, daftar jadwal, tombol Ingatkan |
| **Kalender** | Kalender bulanan, tandai libur nasional dan cuti bersama 2026-2027, filter, pencarian, ekspor Google Calendar dan `.ics` |
| **Buat Jadwal** | Formulir dengan beberapa sesi (slot), target penerima, kategori |
| **Todo** | Daftar tugas pribadi per akun |
| **Akun** | Ubah profil, ganti password, pengaturan suara per kategori, daftar Staf Aktif |

### Detail yang perlu diketahui

- **Nada berbeda per kategori.** Rapat, Tugas, dan Pengawasan punya nada sendiri.
- **Pengingat otomatis.** 15 menit sebelum jadwal dimulai.
- **Staf Aktif.** Daftar siapa yang sedang membuka aplikasi, diperbarui realtime
  di halaman Akun.
- **Tema terang, gelap, atau ikut sistem.** Tersimpan di perangkat masing-masing.
- **PWA.** Bisa dipasang ke layar utama HP.
- **Notifikasi per kategori.** Saat aplikasi tertutup, penerima tetap bisa
  membedakan jenis pengingat dari judul, warna ikon, dan pola getaran.

---

## Teknologi

| Lapisan | Pilihan |
| --- | --- |
| Antarmuka | React 19 |
| Build | Vite 8 |
| Gaya | Tailwind CSS v4, memakai token warna sendiri |
| Routing | React Router 7 |
| Database | Supabase (PostgreSQL, Auth, Realtime) |
| Server | Fungsi serverless Vercel di `api/notify.js` |
| Push | Web Push lewat `web-push` |

---

## Menjalankan Secara Lokal

### Kebutuhan

- Node.js 20 atau lebih baru
- Akun Supabase
- VAPID keypair untuk Web Push

### Langkah

```bash
# 1. Pasang dependensi
npm install

# 2. Siapkan environment
cp .env.example .env
#    lalu isi .env dengan nilai aslimu

# 3. Jalankan
npm run dev
```

Buka `http://localhost:5173`.

> `npm run dev` menjalankan server API juga. Ada plugin Vite kecil di
> `vite.config.js` yang memuat `api/notify.js` sebagai middleware, karena
> `npm run dev` sendiri memang tidak menjalankan folder `api/`.

### Perintah

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi ke `dist/` |
| `npm run preview` | Menjalankan hasil build |
| `npm run vapid` | Membuat VAPID keypair baru |
| `npm test` | Uji ICS dan penjaga API, tanpa jaringan |
| `npm run test:e2e` | Uji integrasi, butuh dev server menyala |
| `npm run push:cek` | Mengirim push uji ke semua endpoint, melaporkan yang mati |
---

## Variabel Environment

Salin `.env.example` menjadi `.env`, lalu isi. **Jangan pernah meng-commit `.env`.**

| Nama | Dipakai di | Keterangan |
| --- | --- | --- |
| `SUPABASE_URL` | server | URL proyek Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Rahasia, bypass RLS. Jangan pernah memakai prefix `VITE_` |
| `VAPID_PUBLIC_KEY` | server dan browser | Kunci publik push |
| `VAPID_PRIVATE_KEY` | server | Rahasia. Jangan pernah kirim ke browser |
| `VAPID_SUBJECT` | server | Email pemilik langganan, format `mailto:...` |
| `VITE_SUPABASE_URL` | browser | URL Supabase |
| `VITE_SUPABASE_ANON_KEY` | browser | Anon key, aman untuk dipublikasikan |
| `VITE_VAPID_PUBLIC_KEY` | browser | Kunci publik push |

Buat VAPID keypair dengan:

```bash
npm run vapid
```

Saat deploy ke Vercel,etapkan semua variabel di atas pada environment
**Production**, **Preview**, dan **Development**. Kalau ada yang lupa,
`/api/notify` membalas `500` dengan pesan yang menyebut variabel mana yang kosong.

---

## Menyiapkan Database

Jalankan **`supabase/schema.sql`** di SQL Editor Supabase. Berkas itu idempoten
( memakai `if not exists`), jadi aman dijalankan berulang kali.

Isinya:

1. Tabel `profiles` beserta RLS, setiap pengguna hanya boleh menyentuh barisnya sendiri
2. Tabel `schedules` beserta RLS, semua boleh melihat, hanya pembuat boleh ubah atau hapus
3. Tabel `todos`, pribadi per akun
4. Tabel `notifications` dan `push_subscriptions` beserta RLS
5. Trigger opsional untuk membuat baris `profiles` otomatis

### Realtime (opsional tapi disarankan)

Tanpa langkah ini, sinkron antar perangkat masih jalan lewat polling 30 detik.
Dengan langkah ini, jadi instan.

```sql
alter publication supabase_realtime add table public.schedules;
alter publication supabase_realtime add table public.notifications;
```

Kalau muncul galat `already member of publication`, berarti sudah ditambahkan.

Fitur **Staf Aktif** tidak butuh SQL apa pun karena memakai Realtime Presence,
bukan tabel.

### Supabase Auth

Di **Authentication > URL Configuration**:

- **Site URL**: domain produksi, contoh `https://domain-anda.vercel.app`
- **Redirect URLs**: domain produksi dengan `/*`, plus `http://localhost:5173/*`

---

## Deploy ke Vercel

```bash
# 1. Hubungkan folder ini ke project Vercel
vercel --prod

# 2. Set variabel environment, bukan lewat kode
vercel env add SUPABASE_SERVICE_ROLE_KEY production
#    ulangi untuk variabel lainnya

# 3. Deploy ulang supaya environment terbaca
vercel --prod
```

### Catatan penting soal domain

**Push subscription terikat pada domain.** Begitu domain berubah:

- Semua perangkat wajib memasang ulang PWA di domain baru
- Subscription lama dibersihkan server sendiri saat kode 404 atau 410

Ganti nama domain dengan:

```bash
vercel project rename <nama-lama> <nama-baru>
```

Kalau setelah rename domain baru membalas `302` ke halaman login Vercel, berarti
**Deployment Protection** aktif. Matikan di **Settings > Deployment Protection**.

---

## Menjalankan Pengujian

### Uji tanpa jaringan

```bash
npm test
```

- **`scripts/test-ics.mjs`** - 22 pemeriksaan pada pembuat berkas kalender:
  line ending CRLF, batas 75 oktet per baris, konversi zona waktu WIB ke UTC,
  escaping koma, titik, dan backslash, UID unik per sesi, serta tautan Google
  Calendar. Tidak menyentuh jaringan.
- **`scripts/test-notify.mjs`** - 5 pemeriksaan penjaga di `api/notify.js`:
  penolakan metode, environment kosong, token kosong, dan bentuk body dari Vercel.

### Uji integrasi

```bash
# Butuh dev server menyala di terminal lain
npm run test:e2e
```

> **Peringatan:** `test:e2e` menulis ke database Supabase sungguhan. Skrip ini
> membuat akun uji lewat Supabase Admin API, membuat jadwal, memanggil
> `/api/notify`, lalu menghapus akun uji di akhir. Jadwal dan notifikasi ikut
> terhapus karena cascade. Tetap, jangan menjalankannya terhadap database produksi
> tanpa ditinjau lebih dulu.

### Memeriksa kesehatan push

```bash
npm run push:cek
```

Skrip ini mengirim satu notifikasi uji ke setiap endpoint yang tersimpan di
`push_subscriptions`, lalu melaporkan mana yang masih hidup.

| Hasil | Artinya |
| --- | --- |
| `HIDUP` | Endpoint masih bisa dikirimi pesan |
| `MATI` dengan HTTP 404 atau 410 | Subscription sudah tidak valid, hapus barisnya |

Endpoint yang mati sebaiknya dihapus karena setiap pengiriman berikutnya akan
percuma dan menambah satu permintaan gagal. `api/notify.js` sudah-membersihkan
otomatis saat menerima 404 atau 410, tapi cleaned manual bisa lebih cepat.

---

## Struktur Proyek

```
.
|-- api/
|   `-- notify.js             Fungsi serverless: kirim push dan tulis notifikasi
|-- public/
|   |-- sw.js                 Service worker: push dan getaran per kategori
|   |-- notification.wav      Nada bawaan
|   |-- rapat.wav            Nada kategori Rapat
|   |-- tugas.wav             Nada kategori Tugas
|   |-- pengawasan.wav        Nada kategori Pengawasan
|   |-- icon-*.png            Ikon aplikasi dan ikon notifikasi per kategori
|   `-- logo-mark.png         Emblem untuk launcher
|-- scripts/                  Skrip uji
|-- src/
|   |-- components/           Satu berkas per halaman
|   |-- constants/options.js  Opsi dropdown bersama
|   |-- data/hariLibur.js     Data libur nasional dan cuti bersama 2026-2027
|   |-- hooks/                useSession, useSchedules, useDueReminder, usePresence
|   |-- lib/                  sound, push, theme, calendar, slots, toast, presenceContext
|   |-- App.jsx               Definisi rute
|   |-- main.jsx              Titik masuk
|   `-- index.css             Token warna, tema, utilitas
|-- supabase/schema.sql       Skema database lengkap dengan RLS
`-- vercel.json               Rewrite SPA dengan pengecualian /api/
```

### Routing

Semua halaman dimuat dengan `lazy()`, kecuali `AppShell` yang memuat navigasi,
push, suara pengingat, dan provider Staf Aktif. `AppShell` tidak pernah dilepas
saat rute berganti.

---

## Catatan Teknis

### Suara notifikasi punya dua jalur

| Keadaan | Yang berbunyi | Bisa dikontrol? |
| --- | --- | --- |
| Aplikasi terbuka | File `.wav` per kategori, lewat elemen `<audio>` | Ya |
| Aplikasi tertutup | Suara bawaan sistem operasi | Tidak |

Browser mengabaikan opsi `sound` pada notifikasi service worker, dan service
worker tidak punya `AudioContext`. Jadi suara kustom hanya bisa berbunyi selama
halaman masih hidup.

Playback memakai elemen `<audio>`, bukan Web Audio, karena Chrome men-suspend
`AudioContext` saat tab masuk background. Elemen `<audio>` diprioritaskan sebagai
media dan tetap berbunyi.

Selain itu, Chrome memblokir audio sampai pengguna pernah menyentuh halaman pada
setiap kali tab baru dimuat. Karena itu ada indikator **Ketuk layar sekali** di
Beranda, dan penguji nada per kategori di halaman Akun.

### Sinkron data

Tiga lapis dan berlapis:

1. Realtime Supabase untuk jadwal dan notifikasi
2. Polling 30 detik saat tab aktif, 90 detik saat tersembunyi
3. Refresh saat tab dikembalikan ke depan

Polling tetap dipertahankan supaya aplikasi tetap benar walau SQL realtime belum
dijalankan.

### Batas platform yang tidak bisa dilawan

- Web Push hanya jalan di HTTPS atau di `localhost`
- Service worker butuh HTTPS
- iOS Safari butuh pengguna menyentuh halaman dulu sebelum audio boleh berbunyi
- **iPhone dan iPad: Web Push hanya jalan kalau PWA sudah dipasang ke layar
  utama.** Tanpa itu, tidak ada `PushManager` sama sekali. Ini aturan Apple,
  bukan sesuatu yang bisa diperbaiki di kode
- **Desktop: notifikasi tetap sampai meski jendela browser ditutup**, asalkan
  subscription-nya ada dan tidak di-silence lewat setelan sistem. Ini sudah
  dibuktikan: push uji diterima perangkat yang sedang tidak membuka tab
- Notifikasi bisa hilang kalau pengguna menyilence channel aplikasi, atau
- Notifikasi bisa hilang kalau pengguna menyilence channel aplikasi, atau
  menonaktifkan notifikasi untuk situs tersebut di pengaturan sistem

### Push tidak akan sampai bila langganan belum ada

Notifikasi push **butuh** subscription yang tersimpan di server. Kalau
`subscribe()` gagal, perangkat itu tidak akan pernah menerima notifikasi,
  hal ini tidak bergantung pada siapa pun yang mengirim.

Dua penyebab yang pernah terjadi:

1. **Balapan service worker.** `register()` selesai sebelum worker active, lalu
   `pushManager.subscribe()` ditolak dengan
   `Subscription failed - no active Service Worker`. Sekarang `push.js` menunggu
   worker benar-benar active sebelum subscribe.
2. **Domain berubah.** Subscription terikat pada origin. Begitu domain diganti,
   semua langganan lama mati dan perangkat wajib memasang ulang PWA.

---

## Yang Belum Terselesaikan

Dicatat apa adanya supaya tidak ada yang mengira sudah beres:

- **Route `/jadwal/baru` belum punya penjaga role.** Halaman ini terbuka untuk
  semua pengguna yang sudah masuk. Kalau RLS `schedules` masih longgar, staf
  bisa membuat jadwal atas nama sendiri. Layak ditutup dengan penjaga role.
- **Tampilan belum pernah dilihat langsung.** Semua perubahan antarmuka
  diverifikasi lewat audit kode dan perhitungan kontras, bukan lewat mata.
- **Suara belum pernah didengar.** Perbaikannya terbukti benar secara logika dan
  strukturnya teruji, tapi belum ada yang memastikan nada per kategorinya
  terdengar di perangkat nyata.
- **Skrip uji belum menjadi bagian alur build.** `npm test` harus dijalankan
  manual.

---

## Lisensi

Internal. Hak cipta dilindungi.
