// DIBUAT OLEH scripts/generate-tema.mjs. Jangan disunting manual.
//
// Sumber: src/index.css (aplikasi web). Jalankan `npm run tema` di folder
// mobile setiap kali ada perubahan warna di web.
//
// Nilai ditulis lengkap, bukan sebagai rujukan, karena React Native tidak
// punya CSS variable milik DOM. Nilainya dipasang lewat NativeWind vars(),
// sehingga class seperti bg-bw-card ikut berubah otomatis saat temanya diganti.

export type NamaWarna =
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

export const tokensTerang = {
  'bw-blue': '#e02401',
  'bw-blue-hi': '#bc1e01',
  'bw-blue-50': '#fce9e6',
  'bw-blue-100': '#f7c8c0',
  'bw-blue-200': '#f09280',
  'bw-blue-700': '#921701',
  'bw-blue-900': '#550e00',
  'bw-red': '#d0342c',
  'bw-red-50': '#fcebea',
  'bw-red-100': '#f7d2d0',
  'bw-red-solid': '#b3271f',
  'bw-amber': '#eba83a',
  'bw-amber-50': '#fdf6eb',
  'bw-amber-200': '#f6d8a6',
  'bw-amber-500': '#c18a30',
  'bw-amber-800': '#815c20',
  'bw-amber-900': '#594016',
  'bw-green': '#15803d',
  'bw-green-50': '#eaf7ef',
  'bw-green-200': '#c0e6d0',
  'bw-green-500': '#22a55b',
  'bw-green-700': '#166534',
  'bw-ink': '#1e1b18',
  'bw-ink-2': '#3a3530',
  'bw-muted': '#756f66',
  'bw-line': '#eae4db',
  'bw-surface': '#f6f1ea',
  'bw-canvas': '#faf7f3',
  'bw-card': '#ffffff',
  'bw-solid': '#221f1b',
  'bw-solid-text': '#faf7f3',
  'bw-solid-muted': 'rgba(250, 247, 243, 0.68)',
} as const satisfies Record<NamaWarna, string>;

export const tokensGelap = {
  'bw-blue': '#e02401',
  'bw-blue-hi': '#bc1e01',
  'bw-blue-50': '#1a0b07',
  'bw-blue-100': '#2e130d',
  'bw-blue-200': '#4d2016',
  'bw-blue-700': '#ff866b',
  'bw-blue-900': '#ffc7ba',
  'bw-red': '#ff7b72',
  'bw-red-50': '#331413',
  'bw-red-100': '#4a1d1a',
  'bw-red-solid': '#d0342c',
  'bw-amber': '#f5b840',
  'bw-amber-50': '#251c0a',
  'bw-amber-200': '#453412',
  'bw-amber-500': '#df9e14',
  'bw-amber-800': '#f2c14d',
  'bw-amber-900': '#fae1a8',
  'bw-green': '#4ade80',
  'bw-green-50': '#0e2a16',
  'bw-green-200': '#163a22',
  'bw-green-500': '#22c55e',
  'bw-green-700': '#86efac',
  'bw-ink': '#f5f1ea',
  'bw-ink-2': '#e5ded4',
  'bw-muted': '#a8a094',
  'bw-line': '#2a2620',
  'bw-surface': '#171410',
  'bw-canvas': '#0e0c0a',
  'bw-card': '#1c1814',
  'bw-solid': '#2a241e',
  'bw-solid-text': '#f5f1ea',
  'bw-solid-muted': 'rgba(245, 241, 234, 0.72)',
} as const satisfies Record<NamaWarna, string>;

export type NamaBayangan =
  | 'card'
  | 'lift';

export const bayanganTerang = {
  'card': '0 1px 2px rgba(0, 0, 0, 0.04), 0 12px 32px -18px rgba(0, 0, 0, 0.28)',
  'lift': '0 2px 6px rgba(0, 0, 0, 0.05), 0 20px 44px -22px rgba(0, 0, 0, 0.3)',
} as const satisfies Record<NamaBayangan, string>;

export const bayanganGelap = {
  'card': '0 1px 2px rgba(0, 0, 0, 0.5), 0 12px 32px -18px rgba(0, 0, 0, 0.8)',
  'lift': '0 2px 6px rgba(0, 0, 0, 0.6), 0 20px 44px -22px rgba(0, 0, 0, 0.85)',
} as const satisfies Record<NamaBayangan, string>;
