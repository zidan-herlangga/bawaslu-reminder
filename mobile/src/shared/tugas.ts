// Logika tanggal untuk daftar tugas.
//
// Port dari src/components/TodoPage.jsx di web. Kolom `todos.tanggal` bertipe
// date di Postgres, jadi nilainya sampai ke klien sebagai teks 'YYYY-MM-DD'
// tanpa zona waktu. Karena itu semua perbandingan di sini memakai teks, bukan
// objek Date: Kalau tanggal dibaca sebagai tengah malam UTC lalu diformat
// dengan toLocaleDateString, hasilnya bergeser sehari di semua perangkat yang
// zona waktunya di belakang UTC. Web sudah menghindari itu dengan memecah
// teksnya sendiri, dan modul ini melakukan hal yang sama.

export type TabTugas = 'tanggal' | 'semua';

export interface Tugas {
  id: string;
  teks: string;
  tanggal: string | null;
  selesai: boolean;
}

export const TAB_TUGAS: readonly { id: TabTugas; label: string }[] = [
  { id: 'tanggal', label: 'Tanggal dipilih' },
  { id: 'semua', label: 'Semua tugas' },
];

const POLA_TANGGAL = /^(\d{4})-(\d{2})-(\d{2})$/;

// Tanggal 'YYYY-MM-DD' sebagai tengah malam waktu lokal, bukan UTC.
export function keTanggalLokal(nilai: string): Date | null {
  const cocok = POLA_TANGGAL.exec(nilai.trim());
  if (!cocok) return null;

  const tahun = Number(cocok[1]);
  const bulan = Number(cocok[2]);
  const hari = Number(cocok[3]);
  const date = new Date(tahun, bulan - 1, hari);

  // Konstruktor Date punya kebiasaan lama: tahun 0 sampai 99 dipetakan ke
  // 1900-an, jadi new Date(7, 0, 2) berarti 2 Januari 1907. setFullYear
  // membatalkan kebiasaan itu supaya tahun empat digit apa pun dibaca apa adanya.
  if (tahun >= 0 && tahun <= 99) date.setFullYear(tahun);

  // Tanggal seperti 2026-02-31 digeser oleh Date menjadi bulan berikutnya.
  // Kalau itu terjadi, nilai aslinya bukan tanggal yang sah.
  if (
    date.getFullYear() !== tahun ||
    date.getMonth() !== bulan - 1 ||
    date.getDate() !== hari
  ) {
    return null;
  }

  return date;
}

// Tanggal lokal sekarang sebagai 'YYYY-MM-DD'. Sengaja tidak memakai
// toISOString(), yang mengubahnya ke UTC dan bisa menghasilkan kemarin.
export function tanggalDariDate(date: Date): string {
  const tahun = String(date.getFullYear()).padStart(4, '0');
  const bulan = String(date.getMonth() + 1).padStart(2, '0');
  const hari = String(date.getDate()).padStart(2, '0');
  return `${tahun}-${bulan}-${hari}`;
}

export function tanggalHariIni(waktu: Date = new Date()): string {
  return tanggalDariDate(waktu);
}

// Nilai tanggal dari database dibiarkan apa adanya supaya bisa dibandingkan
// dengan teks yang sama. Yang tidak bisa dipakai untuk tampilan dibuang.
export function normalkanTanggal(nilai: string | null | undefined): string | null {
  if (typeof nilai !== 'string') return null;
  const rapi = nilai.trim();
  if (rapi === '') return null;
  return keTanggalLokal(rapi) ? rapi : null;
}

export function geserTanggal(tanggal: string, jumlahHari: number): string {
  const dasar = keTanggalLokal(tanggal);
  if (!dasar) return tanggalHariIni();

  const geser = new Date(
    dasar.getFullYear(),
    dasar.getMonth(),
    dasar.getDate() + jumlahHari
  );
  return tanggalDariDate(geser);
}

export function visibleTugas(
  daftar: readonly Tugas[],
  tab: TabTugas,
  tanggal: string
): Tugas[] {
  if (tab === 'semua') return [...daftar];
  return daftar.filter((item) => item.tanggal === tanggal);
}

export function kelompokTugas(daftar: readonly Tugas[]): {
  belum: Tugas[];
  sudah: Tugas[];
  persen: number;
} {
  const belum: Tugas[] = [];
  const sudah: Tugas[] = [];

  for (const item of daftar) {
    if (item.selesai) sudah.push(item);
    else belum.push(item);
  }

  const persen =
    daftar.length > 0 ? Math.round((sudah.length / daftar.length) * 100) : 0;

  return { belum, sudah, persen };
}