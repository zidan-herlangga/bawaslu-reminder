# Aplikasi Native (Expo)

Aplikasi Android dan iOS untuk pengingat jadwal. Dibuat sebagai tambahan, bukan
pengganti: PWA di folder atas repo ini tetap berjalan dan tidak diubah.

## Mengapa terpisah

Sebagian besar kode di sini ditulis dari awal, padahal hanya sekitar 6 persen
logikanya yang benar-benar bisa dipakai ulang. Yang dipakai ulang adalah aturan
waktu, format tanggal, dan daftar divisi. Sisanya perlu ditulis ulang karena
web memakai DOM dan CSS, sedangkan React Native memakai View dan StyleSheet.

Kalau digabung ke aplikasi web, satu perubahan warna atau aturan jadwal harus
diuji di dua tempat dengan cara berbeda. Dipisah, keduanya bisa berjalan
bersamaan tanpa saling mengganggu.

## Menjalankan

```bash
cd mobile
npm install
cp .env.example .env      # lalu isi nilainya
npm run start             # lalu pindai QR dengan Expo Go
```

Setelah `npm run start` muncul menu. Pilih sesuai perangkat:

| Tombol | Untuk apa |
| --- | --- |
| `a` | Buka di emulator atau perangkat Android |
| `i` | Buka di simulator iOS (hanya macOS) |
| `r` | Muat ulang aplikasi di perangkat yang sedang terhubung |
| `w` | Buka di peramban |

**Jangan menekan `w` kalau maksudnya menguji di HP.** Versi peramban bukan
tujuan aplikasi ini, dan beberapa bagian hanya berfungsi di perangkat: izin
notifikasi, pemutar suara, dan penambahan ke kalender. Tekan `a`, atau pindai
QR dengan Expo Go.

| Perintah | Untuk apa |
| --- | --- |
| `npm start` | Dev server |
| `npm run android` / `npm run ios` | Buka langsung di perangkat |
| `npm run typecheck` | Periksa tipe TypeScript |
| `npm test` | Uji aturan waktu dan urutan daftar |
| `npm run build` | Bundle produksi untuk Android |
| `npm run tema` | Buat ulang tema dari CSS aplikasi web |
| `npm run ascii` | Bersihkan karakter asing yang merusak build |
| `npm run lint` | Lint |

## Sumber warna ada satu

Warna tidak ditulis ulang di sini. `scripts/generate-tema.mjs` membaca
`src/index.css` milik aplikasi web lalu menulis:

- `tailwind.config.js`
- `src/tema/tokens.ts`

Jadi `bg-bw-card` di sini berarti warna yang sama dengan `bg-bw-card` di web.
Kalau warnanya diubah di web, jalankan `npm run tema` di folder ini.

Konsekuensinya: mengubah warna berarti menyentuh dua tempat. Itu disengaja,
dengan syarat generate-tema selalu dijalankan sebelum commit.

## Notifikasi

Dua jenis, dan bedanya penting.

| Jenis | Sumber | Expo Go |
| --- | --- | --- |
| Lokal | Dijadwalkan di perangkat | Berjalan |
| Remote | Dikirim dari server | **Tidak berjalan** |

Notifikasi remote butuh development build, dan sudah dihapus dari Expo Go sejak
SDK 53.Itu bagian yang paling sering membuat orang salah langkah: kode
push akan terlihat benar saat diuji di Expo Go, lalu gagal_total di perangkat
asli.

Untuk tahap sekarang, yang bisa diuji tanpa kredensial apa pun adalah notifikasi
lokal. Pengiriman dari server mengikuti setelah ada development build.

### Untuk push dari server

Tidak memakai Expo Push Service. `api/lib/push-native.js` mengirim langsung ke
Firebase Cloud Messaging (Android) dan Apple Push Notification service (iOS),
supaya tidak ada data staf yang lewat pihak ketiga.

Endpoint-nya tetap `/api/notify` yang sama dengan web, jadi tidak ada pintu
kedua yang bisa gagal diam-diam. Aplikasi tidak perlu memilih jalurnya.

Android butuh `google-services.json` dan kunci service account. iOS butuh Apple
Developer Program ($99/tahun) dan APNs key `.p8`. Keduanya opsional: kalau
tidak diisi, notifikasi ke pengguna web tetap jalan dan hanya perangkat native
yang tidak menerima.

## Batasan yang diketahui

- **Ubah jadwal belum ada** di versi native. Tombolnya ada dan memberi
  penjelasan. Menambahkan formulir di layar sempit jauh lebih besar daripada
  yang terlihat dari daftar tombol
- **Daftar staf aktif** tidak ada di versi native
- **Agenda, bukan grid bulan.** Di layar HP, grid bulan membuat tiap sel
  beberapa sentimeter dan nama jadwal tidak pernah muat. Agenda menjawab
  pertanyaan yang sama dengan lebih cepat, dan navigasi tetap ada lewat
  pemilih tanggal bawaan sistem
- **Belum pernah dijalankan di perangkat sungguhan.** Semuanya baru
  diverifikasi lewat typecheck, unit test, dan bundling

## Struktur

```
src/
--- app/          route Expo Router
-   --- _layout.tsx   provider tema, sesi, dan navigasi
-   --- masuk.tsx     layar masuk
-   --- (tabs)/       beranda, agenda, tugas, akun
--- komponen/     kartu, modal, lencana, ikon
--- lib/          sesi, jadwal, toast, notifikasi
--- shared/       logika yang sama dengan web
--- tema/         token, provider, resolver warna
```

Kode di `shared/` adalah salinan dari aplikasi web. Kalau aturan di sana
berubah, uji di kedua tempat.

## Catatan

Skrip `npm run ascii` sengaja ada. Tulisan yang kadang rusak merusak
nama variabel dan breaking build dengan pesan yang membingungkan; skrip ini
mengganti karakter itu dengan tanda hubung dan memberi tahu berkas mana.
