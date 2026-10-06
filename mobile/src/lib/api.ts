// Asal server API.
//
// Aplikasi native tidak punya asal tetap seperti situs web. Endpoint /api/notify
// ada di deployment Vercel, jadi asalnya harus diberikan lewat environment.
//
// Nilai ada di .env sebagai EXPO_PUBLIC_API_ORIGIN. Jangan ditulis langsung di
// sini: alamat deployment bisa berubah, dan menuliskannya di beberapa berkas
// berarti harus dicari di beberapa tempat saat berubah.
//
// Variabel EXPO_PUBLIC_* dibaca saat bundel dibuat, bukan saat aplikasi
// berjalan. Setelah mengubah .env, jalankan ulang dengan cache dibersihkan:
//
//   npx expo start -c

import { Platform } from 'react-native';

const asal = process.env.EXPO_PUBLIC_API_ORIGIN;

export const API_ORIGIN = (asal ?? '').trim().replace(/\/+$/, '');

/**
 * True kalau asal menunjuk ke perangkat itu sendiri.
 *
 * Nilai localhost benar saat pengembangan di komputer, karena server Vite
 * berjalan di komputer yang sama. Di HP, artinya berubah: localhost di dalam
 * HP adalah HP itu sendiri, bukan komputer pengembang. Setiap permintaan ke
 * alamat itu gagal dengan galat jaringan yang tidak menyebut localhost sama
 * sekali, sehingga penyebabnya tidak akan pernah ditebak.
 *
 * Fungsi ini hanya memberi peringatan, bukan menolak. Menolak lebih awal akan
 * mematikan fitur yang mungkin masih berguna, sedangkan peringatan cukup
 * membuat penyebabnya terlihat tanpa mengubah perilaku apa pun.
 */
function asalMenunjukKePerangkatSendiri(): boolean {
  if (Platform.OS === 'web') return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(API_ORIGIN);
}

if (!API_ORIGIN) {
  console.warn(
    '[api] EXPO_PUBLIC_API_ORIGIN belum diisi. Fitur Ingatkan akan gagal. ' +
      'Salin .env.example menjadi .env lalu isi nilainya.'
  );
} else if (!/^https?:\/\//i.test(API_ORIGIN)) {
  console.warn(
    '[api] EXPO_PUBLIC_API_ORIGIN harus diawali http:// atau https://, ' +
      `nilai sekarang: "${API_ORIGIN}".`
  );
} else if (asalMenunjukKePerangkatSendiri()) {
  console.warn(
    `[api] EXPO_PUBLIC_API_ORIGIN masih "${API_ORIGIN}". Nilai itu menunjuk ke ` +
      'perangkat itu sendiri, bukan ke server. Di HP, localhost berarti HP. ' +
      'Ganti dengan alamat Vercel yang terlihat saat membuka aplikasi di browser.'
  );
}

export function apiUrl(jalur: string): string {
  // Tanpa asal, hasilnya hanya jalur relatif yang tidak bisa dipakai fetch di
  // React Native dan memunculkan galat jaringan yang tidak menjelaskan apa-apa.
  // Lebih baik berhenti di sini dengan pesan yang langsung menunjuk penyebabnya.
  if (!API_ORIGIN) {
    throw new Error(
      'Alamat server belum diatur (EXPO_PUBLIC_API_ORIGIN kosong). Hubungi pengembang aplikasi.'
    );
  }

  return `${API_ORIGIN}${jalur.startsWith('/') ? jalur : `/${jalur}`}`;
}