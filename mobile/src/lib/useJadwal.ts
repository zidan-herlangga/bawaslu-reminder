import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { Jadwal } from '../shared/slots';
import { supabase } from './supabase';

// Pengambilan daftar jadwal.
//
// Port dari src/hooks/useSchedules.js. Jalur sinkronisasinya dipertahankan
// sama: realtime menjadi jalur utama, dengan poll berkala dan refresh saat
// aplikasi kembali aktif sebagai jaring pengaman kalau tabel schedules belum
// masuk publication supabase_realtime.

const POLL_AKTIF_MS = 30 * 1000;
const POLL_SAMBUNG_MS = 90 * 1000;

// Beberapa perubahan beruntun (mis. hapus lalu insert) cukup memicu satu
// pemuatan ulang.
const TUNDA_REALTIME_MS = 250;

// Channel realtime WAJIB punya nama yang berbeda per pemanggil.
//
// RealtimeClient.channel() mencari channel yang sudah ada dengan topik yang
// sama, lalu MENGEMBALIKAN channel itu apa adanya. Channel itu sudah
// di-subscribe, jadi pemanggil kedua yang menuliskannya akan mendapat galat:
//
//   cannot add `postgres_changes` callbacks ... after `subscribe()`
//
// Di aplikasi web ini tidak muncul karena react-router hanya merender satu rute
// pada satu waktu, jadi useSchedules hanya hidup di satu layar. Di Expo Router
// semua tab tetap ter-mount bersamaan: Beranda dan Agenda sama-sama memanggil
// useJadwal pada sesi yang sama. Kalau keduanya memakai nama channel yang sama,
// layar kedua langsung meledak.
//
// Mengganti nama per pemanggil membuat setiap layar punya channel sendiri.
// Bedanya satu koneksi websocket tambahan yang memang sudah dipakai bersama.
let penghitungKanal = 0;

export function namaKanalUnik(awalan: string): string {
  penghitungKanal += 1;
  return `${awalan}-${penghitungKanal}`;
}

export interface HasilJadwal {
  jadwal: Jadwal[];
  memuat: boolean;
  galat: string;
  terhubung: boolean;
  muatUlang: (opts?: { senyap?: boolean }) => Promise<void>;
}

/**
 * Menyusun pesan galat yang sesuai penyebabnya. Petunjuk "jalankan schema.sql"
 * hanya masuk akal untuk masalah skema atau izin; kalau penyebabnya jaringan,
 * petunjuk itu menyesatkan.
 */
function susunPesanGalat(pesan: string): string {
  const masalahJaringan = /network|fetch|timeout|timed out|failed to/i.test(pesan);
  if (masalahJaringan) {
    return 'Tidak bisa terhubung ke server. Periksa koneksi internet, lalu coba lagi.';
  }

  const masalahSkema =
    /schema cache|could not find|does not exist|relation|permission denied/i.test(pesan);

  return (
    `Gagal memuat jadwal. Detail: ${pesan}.` +
    (masalahSkema ? ' Jalankan supabase/schema.sql di SQL Editor Supabase.' : '')
  );
}

export function useJadwal(sessionId: string | null): HasilJadwal {
  const [jadwal, setJadwal] = useState<Jadwal[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [terhubung, setTerhubung] = useState(false);

  const hidup = useRef(true);

  // Nomor permintaan terakhir. Beberapa pemuatan bisa berjalan bersamaan (poll,
  // realtime, tombol segarkan). Hanya hasil dari yang paling baru yang dipakai,
  // supaya jawaban lama yang tiba belakangan tidak menimpa data yang lebih baru.
  const permintaan = useRef(0);

  // Jumlah jadwal yang sedang tampil, dibaca di dalam muatUlang tanpa membuat
  // fungsi itu ikut berubah.
  const jumlah = useRef(0);

  // useRef, bukan useState: nama channel harus tetap sama saat StrictMode
  // menjalankan ulang efek, supaya channel yang dibersihkan dan yang dibuat
  // lagi benar-benar pasangan yang sama.
  const namaKanal = useRef<string | null>(null);
  if (namaKanal.current === null) {
    namaKanal.current = namaKanalUnik('jadwal');
  }

  useEffect(() => {
    hidup.current = true;
    return () => {
      hidup.current = false;
    };
  }, []);

  const muatUlang = useCallback(
    async ({ senyap = false }: { senyap?: boolean } = {}) => {
      const nomor = ++permintaan.current;
      if (!senyap) setMemuat(true);

      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .order('waktu_mulai', { ascending: true });

      // Layar sudah ditutup, atau sudah ada permintaan yang lebih baru.
      if (!hidup.current || nomor !== permintaan.current) return;

      if (error) {
        console.warn('[jadwal] gagal memuat:', error.message);

        // Data yang sudah ada tetap dipertahankan. Di lapangan sinyal sering
        // putus sebentar, dan daftar yang mendadak kosong tiap poll gagal
        // lebih merugikan daripada data yang terlambat beberapa menit.
        // Pemuatan senyap yang gagal tidak perlu mengganggu dengan pesan,
        // kecuali memang belum ada data sama sekali.
        if (!senyap || jumlah.current === 0) {
          setGalat(susunPesanGalat(error.message));
        }
      } else {
        const baris = (data ?? []) as Jadwal[];
        jumlah.current = baris.length;
        setGalat('');
        setJadwal(baris);
      }

      setMemuat(false);
    },
    []
  );

  // Pemuatan awal, dan bersihkan data kalau pengguna keluar. Tanpa
  // pembersihan, akun lain yang masuk di perangkat yang sama sempat melihat
  // jadwal akun sebelumnya sampai pemuatan selesai.
  useEffect(() => {
    if (!sessionId) {
      jumlah.current = 0;
      setJadwal([]);
      return undefined;
    }

    void muatUlang();
    return undefined;
  }, [sessionId, muatUlang]);

  // Realtime: satu channel per pemanggil, bukan per pengguna.
  useEffect(() => {
    if (!sessionId) return undefined;

    let tunda: ReturnType<typeof setTimeout> | undefined;

    const channel = supabase
      .channel(`${namaKanal.current}-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        () => {
          if (tunda) clearTimeout(tunda);
          tunda = setTimeout(() => {
            void muatUlang({ senyap: true });
          }, TUNDA_REALTIME_MS);
        }
      )
      .subscribe((status) => {
        if (!hidup.current) return;
        setTerhubung(status === 'SUBSCRIBED');
      });

    return () => {
      if (tunda) clearTimeout(tunda);
      setTerhubung(false);
      supabase.removeChannel(channel);
    };
  }, [sessionId, muatUlang]);

  // Poll. Di native tidak ada konsep tab tersembunyi, jadi yang menentukan
  // adalah aplikasi sedang aktif atau tidak.
  useEffect(() => {
    if (!sessionId) return undefined;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      if (AppState.currentState === 'active') {
        void muatUlang({ senyap: true });
      }
      timer = setTimeout(
        tick,
        AppState.currentState === 'active' ? POLL_AKTIF_MS : POLL_SAMBUNG_MS
      );
    };

    timer = setTimeout(tick, POLL_AKTIF_MS);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, muatUlang]);

  // Refresh begitu aplikasi kembali dari latar. Di web kejadiannya adalah tab
  // diaktifkan; di native padanannya adalah perubahan AppState.
  useEffect(() => {
    if (!sessionId) return undefined;

    const onPerubahan = (status: AppStateStatus) => {
      if (status === 'active') void muatUlang({ senyap: true });
    };

    const langganan = AppState.addEventListener('change', onPerubahan);
    return () => langganan.remove();
  }, [sessionId, muatUlang]);

  return { jadwal, memuat, galat, terhubung, muatUlang };
}