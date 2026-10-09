import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import {
  bayanganGelap,
  bayanganTerang,
  tokensGelap,
  tokensTerang,
  type NamaWarna,
} from './tokens';

// Tema untuk aplikasi native.
//
// Warna tidak ditulis ulang di sini. Nilainya diambil dari src/tema/tokens.ts,
// yang dibuat oleh scripts/generate-tema.mjs membaca src/index.css milik web.
// Jadi ada satu sumber warna untuk kedua aplikasi.
//
// Kelas NativeWind menulis ke CSS variable. Karena itu pergantian tema cukup
// mengganti isi variabelnya: bg-bw-card tidak perlu tahu bahwa temanya
// berganti.
//
// Proyek ini memakai mode CSS-first Tailwind v4 (tanpa tailwind.config.js):
// utility bg-bw-card dikompilasi menjadi `background-color: var(--color-bw-card)`
// dan shadow-card menjadi `box-shadow: var(--shadow-card)`. Karena itu kunci
// di sini harus memakai awalan namespace tersebut supaya cocok dengan var()
// yang dirujuk class:
//
//   --color-bw-card  <- untuk bg-bw-card, text-bw-card, border-bw-card, dst.
//   --shadow-card    <- untuk shadow-card, shadow-lift, dst.
//
// Catatan penting: vars() dari NativeWind mengembalikan objek style yang harus
// dipasang ke sebuah View, bukan fungsi yang bisa dipanggil bebas. Karena itu
// variabelnya dikumpulkan di sini lalu dipasang di View teratas pada layout.

export type PilihanTema = 'terang' | 'gelap' | 'sistem';
export type TemaEfektif = 'terang' | 'gelap';

const KUNCI_PILIHAN = 'b-waslu-jadwal.tema';

export interface NilaiTema {
  pilihan: PilihanTema;
  /** Tema yang benar-benar dipakai, setelah pilihan "sistem" diselesaikan. */
  dipakai: TemaEfektif;
  /**
   * CSS variable untuk dipasang pada View teratas lewat vars(). Warna memakai
   * awalan --color-, bayangan memakai --shadow-, supaya cocok dengan var() yang
   * dirujuk utility Tailwind v4. Nilainya berupa warna atau bayangan.
   */
  variabel: Record<`--${string}`, string>;
  setPilihan: (pilihan: PilihanTema) => void;
}

const KonteksTema = createContext<NilaiTema | null>(null);

export function TemaProvider({ children }: { children: React.ReactNode }) {
  const sistem = useColorScheme();
  const [pilihan, setPilihanState] = useState<PilihanTema>('sistem');

  useEffect(() => {
    let batal = false;

    AsyncStorage.getItem(KUNCI_PILIHAN)
      .then((nilai) => {
        if (batal || !nilai) return;
        if (nilai === 'terang' || nilai === 'gelap' || nilai === 'sistem') {
          setPilihanState(nilai);
        }
      })
      .catch((error) => {
        console.warn('[tema] gagal membaca pilihan tersimpan:', error?.message);
      });

    return () => {
      batal = true;
    };
  }, []);

  // useColorScheme memakai nama bawaan React Native: 'light' dan 'dark',
  // bukan 'terang' dan 'gelap'. Pencocokanagainst 'gelap' di sini akan selalu
  // salah dan membuat mode sistem selalu jatuh ke terang.
  const dipakai: TemaEfektif =
    pilihan === 'sistem' ? (sistem === 'dark' ? 'gelap' : 'terang') : pilihan;

  const variabel = useMemo(() => {
    const token = dipakai === 'gelap' ? tokensGelap : tokensTerang;
    const bayangan = dipakai === 'gelap' ? bayanganGelap : bayanganTerang;

    const hasil: Record<`--${string}`, string> = {};

    for (const [nama, nilai] of Object.entries(token)) {
      hasil[`--color-${nama}`] = nilai;
    }

    for (const [nama, nilai] of Object.entries(bayangan)) {
      hasil[`--shadow-${nama}`] = nilai;
    }

    // Semantik gluestack diarahkan ke palet hangat aplikasi supaya komponen
    // seperti Button, Card, dan Input ikut berubah saat temanya berganti,
    // alih-alih terkunci ke abu-abu netral dari config gluestack.
    const semantik: Record<string, NamaWarna> = {
      '--color-primary': 'bw-blue',
      '--color-primary-foreground': 'bw-solid-text',
      '--color-secondary': 'bw-surface',
      '--color-secondary-foreground': 'bw-ink',
      '--color-background': 'bw-canvas',
      '--color-foreground': 'bw-ink',
      '--color-card': 'bw-card',
      '--color-card-foreground': 'bw-ink',
      '--color-popover': 'bw-card',
      '--color-popover-foreground': 'bw-ink',
      '--color-muted': 'bw-surface',
      '--color-muted-foreground': 'bw-muted',
      '--color-accent': 'bw-blue-50',
      '--color-accent-foreground': 'bw-blue-700',
      '--color-destructive': 'bw-red',
      '--color-border': 'bw-line',
      '--color-input': 'bw-line',
      '--color-ring': 'bw-blue',
      '--color-outline': 'bw-line',
    };

    for (const [kunci, nama] of Object.entries(semantik)) {
      hasil[kunci as `--${string}`] = token[nama];
    }

    return hasil;
  }, [dipakai]);

  const setPilihan = useCallback((baru: PilihanTema) => {
    setPilihanState(baru);
    AsyncStorage.setItem(KUNCI_PILIHAN, baru).catch((error) => {
      console.warn('[tema] gagal menyimpan pilihan:', error?.message);
    });
  }, []);

  const nilai = useMemo<NilaiTema>(
    () => ({ pilihan, dipakai, variabel, setPilihan }),
    [pilihan, dipakai, variabel, setPilihan]
  );

  return <KonteksTema.Provider value={nilai}>{children}</KonteksTema.Provider>;
}

export function useTema(): NilaiTema {
  const nilai = useContext(KonteksTema);
  if (!nilai) {
    throw new Error('useTema harus dipakai di dalam TemaProvider.');
  }
  return nilai;
}
