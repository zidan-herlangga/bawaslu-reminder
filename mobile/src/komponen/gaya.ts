import type { StatusAgenda } from '../shared/slots';
import type { TokenWarna } from '../tema/warna';

// Gaya dan pelabelan kategori.
//
// Dipakai bersama oleh kartu jadwal, modal detail, dan daftar agenda.
//
// Class lencana ditulis lengkap karena Tailwind dan NativeWind membacanya saat
// build. Aksen tidak bisa begitu: warnanya dipakai lewat style inline, jadi di
// sini hanya nama tokennya yang disimpan, lalu diterjemahkan oleh useWarna.

export interface GayaKategori {
  /** Class untuk lencana kategori. */
  lencana: string;
  /** Nama token untuk garis aksen tipis di sisi kartu. */
  aksen: TokenWarna;
}

export const GAYA_KATEGORI: Record<string, GayaKategori> = {
  Rapat: { lencana: 'bg-bw-blue-50 border-bw-blue-200', aksen: 'bw-blue' },
  Tugas: { lencana: 'bg-bw-amber-50 border-bw-amber-200', aksen: 'bw-amber-500' },
  Pengawasan: {
    lencana: 'bg-bw-green-50 border-bw-green-200',
    aksen: 'bw-green-500',
  },
  Lainnya: { lencana: 'bg-bw-surface border-bw-line', aksen: 'bw-line' },
};

export function gayaKategori(kategori: string | null | undefined): GayaKategori {
  return GAYA_KATEGORI[kategori ?? ''] ?? GAYA_KATEGORI.Lainnya!;
}

/** Label singkat untuk status agenda. */
export function labelAgenda(state: StatusAgenda): string {
  return state === 'ongoing' ? 'Sedang berlangsung' : 'Selesai';
}
