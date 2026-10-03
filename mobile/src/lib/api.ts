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

const asal = process.env.EXPO_PUBLIC_API_ORIGIN;

if (!asal) {
  console.warn(
    '[api] EXPO_PUBLIC_API_ORIGIN belum diisi. Fitur Ingatkan akan gagal. ' +
      'Salin .env.example menjadi .env lalu isi nilainya.'
  );
} else if (!/^https?:\/\//i.test(asal)) {
  console.warn(
    '[api] EXPO_PUBLIC_API_ORIGIN harus diawali http:// atau https://, ' +
      `nilai sekarang: "${asal}".`
  );
}

export const API_ORIGIN = (asal ?? '').trim().replace(/\/+$/, '');

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