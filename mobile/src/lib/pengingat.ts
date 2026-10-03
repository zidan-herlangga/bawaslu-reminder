// Mesin pengingat yang berjalan di dalam aplikasi.
//
// Kenapa ada berkas ini: di Expo Go Android tidak ada notifikasi sistem sama
// sekali, lokal maupun remote, karena expo-notifications melempar galat begitu
// modulnya diimpor. Jadi kalau hanya mengandalkan notifikasi sistem, pengingat
// tidak akan pernah sampai di perangkat yang paling banyak dipakai untuk
// mencoba aplikasi ini.
//
// Yang bisa dipakai: pengingat di dalam aplikasi sendiri. Banner muncul di atas
// layar selama aplikasi terbuka. Lebih terbatas dari notifikasi sistem, tapi
// tidak bergantung pada satu paket pun yang tidak tersedia.
//
// Batasan yang harus jujur ditampilkan: ini hanya jalan saat aplikasi terbuka.
// Kalau aplikasi ditutup, tidak ada yang membangunkan perangkat. Notifikasi
// sistem hanya mungkin di development build, dan itu bukan sesuatu yang bisa
// diperbaiki dengan menulis kode.
//
// -----------------------------------------------------------------------------
// Bentuk data
//
// Kueri diambil langsung dari Supabase, bukan dari useJadwal, dengan sengaja:
// - hanya perlu jadwal yang mulai dalam jendela +/- 15 menit, jadi muatannya
//   kecil dan tidak membanjiri jaringan
// - tidak bergantung pada layar mana yang sedang terbuka, jadi pengingat tetap
//   muncul di Beranda, Agenda, Kalender, dan layar form
// - tidak membuat channel realtime tambahan. useJadwal sudah memakai satu per
//   pemanggil, dan menambah satu lagi hanya menambah beban tanpa manfaat
//
// Jadwal bisa punya beberapa sesi, jadi yang perlu dihitung
// shared/pengingat.ts dari slot yang dikembalikan kueri.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  AMBANG_TELAT_MS,
  JENDELA_AWAL_MS,
  kalimatPengingat,
  kunciBolehDilupakan,
  yangBelumDitampilkan,
  sesiMasukJendela,
  type BarisJadwal,
} from '../shared/pengingat';
import { supabase } from './supabase';

// Jendela waktu yang dicari dari server. Sedikit lebih lebar dari jendela
// yang dipakai saat memutuskan tampil, supaya jam perangkat yang meleset
// beberapa detik tidak membuat sesi terlewat sepenuhnya.
const MARGIN_JENDELA_MS = 60 * 1000;

/** Seberapa sering aplikasi memeriksa ulang. */
const SELA_PERIKSA_MS = 30 * 1000;

/** Batas jumlah banner yang ditampilkan sekaligus. */
const MAKS_BANNER = 3;

export interface Pengingat {
  kunci: string;
  jadwalId: string;
  judul: string;
  nada: 'mendatang' | 'berlangsung';
  /** Kalimat siap tampil, dihitung di lapisan ini supaya komponen polos. */
  teks: string;
}

/**
 * Memantau jadwal dan memberi tahu pemanggil saat ada yang perlu diingatkan.
 *
 * Yang dijaga di sini:
 * - satu pengingat per sesi, tidak berulang setiap 30 detik
 * - kunci yang sudah lewat dibersihkan supaya Set tidak tumbuh terus
 * - saat aplikasi baru aktif lagi, langsung dicek, tanpa menunggu 30 detik
 * - offline tidak menghasilkan pengingat berulang: kueri yang gagal tidak
 *   menandai sesi sebagai sudah ditampilkan
 */
export function usePengingat(sessionId: string | null): {
  pengingat: Pengingat[];
  tandaiSudahDibaca: (kunci: string) => void;
} {
  const [pengingat, setPengingat] = useState<Pengingat[]>([]);
  const sudahDitampilkan = useRef<Set<string>>(new Set());
  const sedangMemeriksa = useRef(false);

  const tandaiSudahDibaca = useCallback((kunci: string) => {
    setPengingat((sebelumnya) =>
      sebelumnya.filter((item) => item.kunci !== kunci)
    );
  }, []);

  const periksa = useCallback(async () => {
    if (!sessionId) return;
    if (sedangMemeriksa.current) return;
    sedangMemeriksa.current = true;

    try {
      const now = Date.now();
      const dari = new Date(now - AMBANG_TELAT_MS - MARGIN_JENDELA_MS).toISOString();
      const sampai = new Date(now + JENDELA_AWAL_MS + MARGIN_JENDELA_MS).toISOString();

      const { data, error } = await supabase
        .from('schedules')
        .select('id, judul, status, waktu_mulai, waktu_selesai, slots')
        .eq('status', 'Aktif')
        .gte('waktu_mulai', dari)
        .lte('waktu_mulai', sampai);

      if (error || !data?.length) return;

      const kandidat = sesiMasukJendela(
        data as BarisJadwal[],
        Date.now()
      );

const baru = yangBelumDitampilkan(kandidat, sudahDitampilkan.current);
      if (baru.length === 0) return;

      // Ditandai hanya setelah kueri benar-benar berhasil. Kueri yang gagal
      // harus dicoba lagi, bukan dianggap sudah diingatkan.
      for (const item of baru) sudahDitampilkan.current.add(item.kunci);

      // Kunci yang sesinya sudah lewat bisa dibuang supaya Set tidak menumpuk
      // terus selama aplikasi dipakai seharian.
      for (const kunci of kunciBolehDilupakan(kandidat, Date.now())) {
        sudahDitampilkan.current.delete(kunci);
      }

      // Teks dihitung sekali di sini, bukan di komponen. Komponen tidak perlu
      // tahu bentuk kuncinya untuk bisa menampilkan kalimat yang benar.
      const untukDitampilkan: Pengingat[] = baru.map((item) => ({
        kunci: item.kunci,
        jadwalId: item.jadwalId,
        judul: item.judul,
        nada: item.nada,
        teks: kalimatPengingat(item),
      }));

      // Yang paling baru tetap di slice terakhir supaya banner baru selalu terlihat
      // di atas, bukan tersembunyi di belakang yang lama.
      setPengingat((sebelumnya) =>
        [...sebelumnya, ...untukDitampilkan].slice(-MAKS_BANNER)
      );
    } catch (galat) {
      console.warn('[pengingat] pemeriksaan gagal:', galat);
    } finally {
      sedangMemeriksa.current = false;
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setPengingat([]);
      sudahDitampilkan.current.clear();
      return;
    }

    void periksa();

    const selang = setInterval(() => {
      void periksa();
    }, SELA_PERIKSA_MS);

    const dengarAppState = (status: AppStateStatus) => {
      // Aplikasi yang diaktifkan kembali sudah bisa saja melewati beberapa
      // sesi, jadi langsung dicek, bukan menunggu selang berikutnya.
      if (status === 'active') void periksa();
    };

    const langganan = AppState.addEventListener('change', dengarAppState);

    return () => {
      clearInterval(selang);
      langganan.remove();
    };
  }, [sessionId, periksa]);

  // Banner yang sudah lewat tidak boleh menggantung di layar.
  const aktif = useMemo(() => {
    const now = Date.now();
    return pengingat
      .filter((item) => {
        const mulai = Number(item.kunci.split('@')[1]);
        return Number.isFinite(mulai) && mulai >= now - AMBANG_TELAT_MS;
      })
      .slice(0, MAKS_BANNER);
  }, [pengingat]);

  return { pengingat: aktif, tandaiSudahDibaca };
}