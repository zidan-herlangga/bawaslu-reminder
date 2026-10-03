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
  'bw-blue': '#0071e3',
  'bw-blue-hi': '#0062c4',
  'bw-blue-50': '#eaf4fd',
  'bw-blue-100': '#d6e9fa',
  'bw-blue-200': '#aed3f3',
  'bw-blue-700': '#0058ac',
  'bw-blue-900': '#0a3f66',
  'bw-red': '#d70015',
  'bw-red-50': '#fdecee',
  'bw-red-100': '#f9d8dd',
  'bw-red-solid': '#c10841',
  'bw-amber': '#a85b00',
  'bw-amber-50': '#fdf3e6',
  'bw-amber-200': '#f4dcb8',
  'bw-amber-500': '#d98200',
  'bw-amber-800': '#8a4700',
  'bw-amber-900': '#6f3a00',
  'bw-green': '#046c4e',
  'bw-green-50': '#e6f5ef',
  'bw-green-200': '#b7dfd0',
  'bw-green-500': '#05855f',
  'bw-green-700': '#045f45',
  'bw-ink': '#1c1c1e',
  'bw-ink-2': '#2c2c2e',
  'bw-muted': '#6b6b70',
  'bw-line': '#e1e1e4',
  'bw-surface': '#f4f4f6',
  'bw-canvas': '#f2f2f7',
  'bw-card': '#ffffff',
  'bw-solid': '#1c1c1e',
  'bw-solid-text': '#f5f5f7',
  'bw-solid-muted': 'rgba(245, 245, 247, 0.68)',
} as const satisfies Record<NamaWarna, string>;

export const tokensGelap = {
  'bw-blue': '#0a84ff',
  'bw-blue-hi': '#409cff',
  'bw-blue-50': '#10243a',
  'bw-blue-100': '#16344f',
  'bw-blue-200': '#1d4a70',
  'bw-blue-700': '#6cb6ff',
  'bw-blue-900': '#cfe6ff',
  'bw-red': '#ff6961',
  'bw-red-50': '#35181a',
  'bw-red-100': '#4d2023',
  'bw-red-solid': '#c10841',
  'bw-amber': '#ffb340',
  'bw-amber-50': '#33240f',
  'bw-amber-200': '#4d361a',
  'bw-amber-500': '#ff9f0a',
  'bw-amber-800': '#ffd08a',
  'bw-amber-900': '#ffe0b0',
  'bw-green': '#32d74b',
  'bw-green-50': '#0f2f1c',
  'bw-green-200': '#1c4a30',
  'bw-green-500': '#30d158',
  'bw-green-700': '#7ce495',
  'bw-ink': '#f5f5f7',
  'bw-ink-2': '#ebebef',
  'bw-muted': '#a1a1a8',
  'bw-line': '#38383d',
  'bw-surface': '#121214',
  'bw-canvas': '#08080a',
  'bw-card': '#1c1c1e',
  'bw-solid': '#2c2c2e',
  'bw-solid-text': '#f5f5f7',
  'bw-solid-muted': 'rgba(245, 245, 247, 0.72)',
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
