import { router } from 'expo-router';

// Menutup layar form dengan cara yang benar.
//
// router.back() hanya bisa dipakai kalau ada layar sebelumnya di stack. Kalau
// tidak, React Navigation tidak menemukan navigator yang mau menangani GO_BACK
// dan hanya memunculkan peringatan:
//
//   The action 'GO_BACK' was not handled by any navigator.
//
// Situasi itu nyata, bukan teori. Form jadwal bisa menjadi satu-satunya layar
// di stack kalau:
//   - dibuka lewat deep link atau dari cold start
//   - stack dibangkitan ulang saat hot reload, yang sering terjadi saat
//     sedang menguji di perangkat
//
// Peringatan itu development-only, jadi di rilis ia diam: tombol Kembali
// terlihat seperti tidak berfungsi, tanpa penjelasan apa pun. Karena itu
// pemeriksaan dilakukan di sini, di satu tempat, bukan di tiap pemanggil.

const TIMBULAN_TANPA_KEMBALI = '/(tabs)';

export function kembali(): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(TIMBULAN_TANPA_KEMBALI);
}