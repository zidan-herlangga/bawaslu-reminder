// Pemformatan tanggal dan jam dalam bahasa Indonesia.
//
// Port dari src/lib/formatWaktu.js. Versi ini memakai API Tanggal global,
// yang tersedia penuh di Hermes, sehingga hasilnya sama persis dengan web.

function amanTanggal(nilai: string | number | Date | null | undefined): Date | null {
  if (nilai === null || nilai === undefined || nilai === '') return null;
  const date = nilai instanceof Date ? nilai : new Date(nilai);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatJam(iso: string | null | undefined): string {
  const date = amanTanggal(iso);
  if (!date) return '';
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTanggalPanjang(nilai: string | number | Date): string {
  const date = amanTanggal(nilai);
  if (!date) return '';
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatWaktuLengkap(iso: string | null | undefined): string {
  const date = amanTanggal(iso);
  if (!date) return '';
  return date.toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTanggalPendek(iso: string | null | undefined): string {
  const date = amanTanggal(iso);
  if (!date) return '';
  return date.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "2 hari lagi", "3 jam 5 menit lagi", atau "Sudah dimulai". */
export function formatSisa(targetMs: number, now: number): string {
  const diff = targetMs - now;
  if (diff <= 0) return 'Sudah dimulai';

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} hari lagi`;
  if (hours > 0) return `${hours} jam ${minutes} menit lagi`;
  if (minutes > 0) return `${minutes} menit lagi`;
  return 'Kurang dari 1 menit';
}

/**
 * Kalender bulanan untuk satu bulan, termasuk sel kosong di awal dan akhir
 * supaya baris selalu tujuh kolom. Baris pertama dimulai pada hari Senin.
 */
export function bangunKalender(
  tahun: number,
  bulan: number
): (Date | null)[] {
  const totalHari = new Date(tahun, bulan + 1, 0).getDate();
  const hariPertama = new Date(tahun, bulan, 1).getDay();
  const geser = (hariPertama + 6) % 7;

  const sel: (Date | null)[] = [];
  for (let i = 0; i < geser; i += 1) sel.push(null);
  for (let hari = 1; hari <= totalHari; hari += 1) sel.push(new Date(tahun, bulan, hari));
  while (sel.length % 7 !== 0) sel.push(null);

  return sel;
}
