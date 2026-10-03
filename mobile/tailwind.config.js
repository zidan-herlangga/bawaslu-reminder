// DIBUAT OLEK scripts/generate-tema.mjs. Jangan disunting manual.
//
// Sumber: src/index.css (aplikasi web). Warna diekspos sebagai CSS variable
// supaya pergantian tema cukup mengganti variabelnya, tanpa kelas dark:.
//
// Font tidak dioverride. Web memakai stack font sistem, dan React Native juga
// memakai font sistem sebagai bawaan: SF Pro di iOS, Roboto di Android.
// Menyalin nama seperti "-apple-system" akan merusak, karena itu bukan nama
// font yang dipahami React Native.
//
// Stack web --font-sans    : -apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, Roboto, system-ui, sans-serif
// Stack web --font-display : -apple-system, BlinkMacSystemFont, SF Pro Display, Segoe UI, Roboto, system-ui, sans-serif

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bw-blue': 'var(--bw-blue)',
        'bw-blue-hi': 'var(--bw-blue-hi)',
        'bw-blue-50': 'var(--bw-blue-50)',
        'bw-blue-100': 'var(--bw-blue-100)',
        'bw-blue-200': 'var(--bw-blue-200)',
        'bw-blue-700': 'var(--bw-blue-700)',
        'bw-blue-900': 'var(--bw-blue-900)',
        'bw-red': 'var(--bw-red)',
        'bw-red-50': 'var(--bw-red-50)',
        'bw-red-100': 'var(--bw-red-100)',
        'bw-red-solid': 'var(--bw-red-solid)',
        'bw-amber': 'var(--bw-amber)',
        'bw-amber-50': 'var(--bw-amber-50)',
        'bw-amber-200': 'var(--bw-amber-200)',
        'bw-amber-500': 'var(--bw-amber-500)',
        'bw-amber-800': 'var(--bw-amber-800)',
        'bw-amber-900': 'var(--bw-amber-900)',
        'bw-green': 'var(--bw-green)',
        'bw-green-50': 'var(--bw-green-50)',
        'bw-green-200': 'var(--bw-green-200)',
        'bw-green-500': 'var(--bw-green-500)',
        'bw-green-700': 'var(--bw-green-700)',
        'bw-ink': 'var(--bw-ink)',
        'bw-ink-2': 'var(--bw-ink-2)',
        'bw-muted': 'var(--bw-muted)',
        'bw-line': 'var(--bw-line)',
        'bw-surface': 'var(--bw-surface)',
        'bw-canvas': 'var(--bw-canvas)',
        'bw-card': 'var(--bw-card)',
        'bw-solid': 'var(--bw-solid)',
        'bw-solid-text': 'var(--bw-solid-text)',
        'bw-solid-muted': 'var(--bw-solid-muted)',
      },
      boxShadow: {
        'card': 'var(--bw-glass-shadow)',
        'lift': 'var(--bw-elevated)',
      },
    },
  },
  plugins: [],
};
