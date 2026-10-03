// Opsi bersama dengan aplikasi web.
//
// Port dari src/constants/options.js. Hanya DIVISI_SHORT yang sering dipakai
// di tampilan; sisanya ikut dibawa supaya daftar divisi tidak pernah berbeda
// antara web dan native.

export const DIVISI_OPTIONS = [
  'Pencegahan, Partisipasi Masyarakat, dan Humas',
  'Hukum dan Penyelesaian Sengketa',
  'Penanganan Pelanggaran dan Data Informasi',
  'Sumber Daya Manusia, Organisasi, Diklat, dan Fasilitasi',
];

export const DIVISI_SHORT: Record<string, string> = {
  'Pencegahan, Partisipasi Masyarakat, dan Humas': 'Pencegahan & Humas',
  'Hukum dan Penyelesaian Sengketa': 'Hukum & Sengketa',
  'Penanganan Pelanggaran dan Data Informasi': 'Pelanggaran & Data',
  'Sumber Daya Manusia, Organisasi, Diklat, dan Fasilitasi': 'SDM & Diklat',
};

export interface OpsiDivisi {
  value: string;
  label: string;
}

export const DIVISI_FILTER_OPTIONS: OpsiDivisi[] = [
  { value: '', label: 'Semua Divisi' },
  ...DIVISI_OPTIONS.map((value) => ({
    value,
    label: DIVISI_SHORT[value] ?? value,
  })),
];

export const JABATAN_OPTIONS = [
  'Ketua / Komisioner',
  'Koordinator Divisi',
  'Staf Teknis',
  'Staf Pendukung',
];

export const KATEGORI_OPTIONS = ['Rapat', 'Tugas', 'Pengawasan', 'Lainnya'];

export const MIN_PASSWORD_LENGTH = 6;

export const NOTIFICATION_LEAD_MINUTES = 15;

/** Nama divisi yang lebih enak dibaca di layar sempit. */
export function namaDivisi(divisi: string | null | undefined): string {
  if (!divisi) return 'Semua staf';
  return DIVISI_SHORT[divisi] ?? divisi;
}
