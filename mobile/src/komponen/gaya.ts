import type { StatusAgenda } from '../shared/slots';
import type { TokenWarna } from '../tema/warna';
import type { Ikon } from './Ikon';

// Gaya dan pelabelan kategori.
//
// Dipakai bersama oleh kartu jadwal, modal detail, dan daftar agenda.
//
// Class lencana dan teks ditulis lengkap karena Tailwind dan NativeWind
// membacanya saat build; class yang dirangkai dari string tidak akan
// menghasilkan gaya. Aksen tidak bisa begitu: warnanya dipakai lewat style
// inline, jadi di sini hanya nama tokennya yang disimpan, lalu diterjemahkan
// oleh useWarna.

type NamaIkon = Parameters<typeof Ikon>[0]['nama'];

export interface GayaKategori {
  /** Class untuk latar dan border lencana kategori. */
  lencana: string;
  /** Class untuk warna teks di dalam lencana, supaya kontrasnya terjaga. */
  teks: string;
  /** Nama ikon yang mewakili kategori. */
  ikon: NamaIkon;
  /** Nama token untuk garis aksen tipis di sisi kartu. */
  aksen: TokenWarna;
}

export const GAYA_KATEGORI: Record<string, GayaKategori> = {
  Rapat: {
    lencana: 'bg-bw-blue-50 border-bw-blue-200',
    teks: 'text-bw-blue-700',
    ikon: 'people-outline',
    aksen: 'bw-blue',
  },
  Tugas: {
    lencana: 'bg-bw-amber-50 border-bw-amber-200',
    teks: 'text-bw-ink-2',
    ikon: 'briefcase-outline',
    aksen: 'bw-amber-500',
  },
  Pengawasan: {
    lencana: 'bg-bw-green-50 border-bw-green-200',
    teks: 'text-bw-ink-2',
    ikon: 'eye-outline',
    aksen: 'bw-green-500',
  },
  Lainnya: {
    lencana: 'bg-bw-surface border-bw-line',
    teks: 'text-bw-ink-2',
    ikon: 'ellipsis-horizontal-circle-outline',
    aksen: 'bw-line',
  },
};

export function gayaKategori(kategori: string | null | undefined): GayaKategori {
  return GAYA_KATEGORI[kategori ?? ''] ?? GAYA_KATEGORI.Lainnya!;
}

/** Label singkat untuk status agenda. */
export function labelAgenda(state: StatusAgenda): string {
  return state === 'ongoing' ? 'Sedang berlangsung' : 'Selesai';
}