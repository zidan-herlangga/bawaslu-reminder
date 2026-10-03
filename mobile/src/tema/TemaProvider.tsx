import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import {
  bayanganGelap,
  bayanganTerang,
  tokensGelap,
  tokensTerang,
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
   * CSS variable untuk dipasang pada View teratas lewat vars(). Kunci harus
   * diawali --, dan nilinya berupa warna atau bayangan.
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

    for (const [nama, nilai] of Object.entries({ ...token, ...bayangan })) {
      hasil[`--${nama}`] = nilai;
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
