// Aturan kapan notifikasi boleh dipakai.
//
// Dipisah dari lib/notifikasi.ts supaya bisa diuji tanpa perangkat dan tanpa
// memuat expo-notifications. Aturannya berasal dari isi paket itu sendiri:
//
//   if (isRunningInExpoGo() && !didWarn) {
//     if (Platform.OS === 'android') throw new Error(...);
//     else if (__DEV__) console.warn(...);
//   }
//
// Pemanggilnya ada di lingkup modul, lewat DevicePushTokenAutoRegistration.
// Jadi di Expo Go Android, begitu modul diimpor, modul itu meledak sebelum satu
// pun API-nya sempat dipanggil. Bukan hanya push yang mati: notifikasi lokal
// ikut mati karena keduanya butuh modul yang sama.
//
// Di iOS Expo Go hanya muncul peringatan, jadi semuanya tetap jalan.

export type PetaAplikasi = 'android' | 'ios' | string;

export function notifikasiDidukung(
  platform: PetaAplikasi,
  diExpoGo: boolean
): boolean {
  // Di luar Expo Go, semua platform boleh.
  if (!diExpoGo) return true;

  // Di Expo Go hanya iOS yang aman: di situ paketnya hanya memberi
  // peringatan, sedangkan Android melempar galat. Platform lain diperlakukan
  // seperti Android supaya aturan ini tetap aman untuk platform yang belum
  // pernah diuji.
  return platform === 'ios';
}

/** Pesan yang jujur untuk layar, bukan "gagal" padahal memang tidak didukung. */
export function alasanTidakDidukung(
  platform: PetaAplikasi,
  diExpoGo: boolean
): string | null {
  if (notifikasiDidukung(platform, diExpoGo)) return null;

  return 'Expo Go di Android tidak memakai notifikasi sama sekali, remote maupun lokal. Ini batas dari Expo Go, bukan kesalahan aplikasi. Untuk mengujinya, pasang development build.';
}
