import { useTema } from './TemaProvider';
import {
  bayanganGelap,
  bayanganTerang,
  tokensGelap,
  tokensTerang,
} from './tokens';

// Mengambil nilai warna nyata dari nama token.
//
// Ada dua tempat yang tidak bisa memakai class Tailwind:
//
// - Ionicon, yang dirender dari font, bukan View
// - Garis aksen di sisi kartu, yang warnanya dipilih lewat peta, bukan ditulis
//   langsung di berkas komponen
//
// Keduanya memanggil hook ini. Kalau token berubah di src/index.css, nilai di
// sini ikut berubah setelah npm run tema dijalankan, tanpa ada hex yang
// tertinggal di komponen.

export type TokenWarna =
  | 'bw-blue'
  | 'bw-blue-hi'
  | 'bw-blue-50'
  | 'bw-blue-100'
  | 'bw-blue-200'
  | 'bw-blue-700'
  | 'bw-blue-900'
  | 'bw-red'
  | 'bw-red-50'
  | 'bw-red-100'
  | 'bw-red-solid'
  | 'bw-amber'
  | 'bw-amber-50'
  | 'bw-amber-200'
  | 'bw-amber-500'
  | 'bw-amber-800'
  | 'bw-amber-900'
  | 'bw-green'
  | 'bw-green-50'
  | 'bw-green-200'
  | 'bw-green-500'
  | 'bw-green-700'
  | 'bw-ink'
  | 'bw-ink-2'
  | 'bw-muted'
  | 'bw-line'
  | 'bw-surface'
  | 'bw-canvas'
  | 'bw-card'
  | 'bw-solid'
  | 'bw-solid-text'
  | 'bw-solid-muted';

export type TokenBayangan = 'card' | 'lift';

export function useWarna(): {
  warna: (token: TokenWarna) => string;
  bayangan: (token: TokenBayangan) => string;
} {
  const { dipakai } = useTema();
  const tabel = dipakai === 'gelap' ? tokensGelap : tokensTerang;
  const tabelBayangan = dipakai === 'gelap' ? bayanganGelap : bayanganTerang;

  return {
    warna: (token) => tabel[token],
    bayangan: (token) => tabelBayangan[token],
  };
}
