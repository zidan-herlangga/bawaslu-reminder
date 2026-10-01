const STORAGE_KEY = 'bawaslu.tema';

// Tiga pilihan, bukan dua. "Sistem" mengikuti setelan perangkat dan ikut
// berubah sendiri saat pengguna mengganti tema di HP.
export const TEMA = {
  SISTEM: 'sistem',
  TERANG: 'terang',
  GELAP: 'gelap',
};

const listeners = new Set();

function mediaGelap() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function bacaTersimpan() {
  try {
    const nilai = window.localStorage.getItem(STORAGE_KEY);
    if (nilai === TEMA.TERANG || nilai === TEMA.GELAP || nilai === TEMA.SISTEM) {
      return nilai;
    }
  } catch {
    /* mode privat: abaikan */
  }
  return TEMA.SISTEM;
}

// Menyelesaikan pilihan pengguna menjadi mode yang benar-benar dipakai.
export function temaEfektif(pilihan) {
  if (pilihan === TEMA.TERANG) return 'terang';
  if (pilihan === TEMA.GELAP) return 'gelap';
  return mediaGelap() ? 'gelap' : 'terang';
}

export function getTema() {
  if (typeof window === 'undefined') return TEMA.SISTEM;
  return bacaTersimpan();
}

function warnaiMeta(mode) {
  if (typeof document === 'undefined') return;

  // Warna bilah status di Android dan PWA harus ikut mode efektif, bukan
  // setelan sistem, supaya tema gelap tidak menampilkan batu putih yang
  // menyilaukan di layar gelap.
  const warna = mode === 'gelap' ? '#08080a' : '#f2f2f7';

  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.removeAttribute('media');
    meta.setAttribute('content', warna);
  });
}

function terapkan(pilihan) {
  if (typeof document === 'undefined') return;

  const mode = temaEfektif(pilihan);
  const root = document.documentElement;

  root.dataset.tema = mode;
  root.dataset.temaPilihan = pilihan;

  warnaiMeta(mode);
  listeners.forEach((listener) => listener(pilihan, mode));
}

export function setTema(pilihan) {
  if (pilihan !== TEMA.TERANG && pilihan !== TEMA.GELAP && pilihan !== TEMA.SISTEM) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, pilihan);
  } catch {
    /* mode privat: abaikan */
  }

  terapkan(pilihan);
}

export function subscribeTema(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Dipanggil sekali saat aplikasi dimuat, dan lagi setiap kali setelan sistem
// berubah selama aplikasi terbuka.
export function initTema() {
  if (typeof window === 'undefined') return () => {};

  const pilihan = bacaTersimpan();
  terapkan(pilihan);

  if (!window.matchMedia) return () => {};

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onPerubahan = () => {
    // Hanya pilihan "Sistem" yang perlu mengikuti perubahan; pilihan eksplisit
    // tidak boleh ditimpa oleh setelan perangkat.
    if (bacaTersimpan() === TEMA.SISTEM) terapkan(TEMA.SISTEM);
  };

  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', onPerubahan);
    return () => mq.removeEventListener('change', onPerubahan);
  }

  // Safari lawas hanya punya addListener.
  if (typeof mq.addListener === 'function') {
    mq.addListener(onPerubahan);
    return () => mq.removeListener(onPerubahan);
  }

  return () => {};
}