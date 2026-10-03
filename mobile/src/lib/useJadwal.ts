import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { Jadwal } from '../shared/slots';
import { supabase } from './supabase';

// Pengambilan daftar jadwal.
//
// Port dari src/hooks/useSchedules.js. Jalur sinkronisasinya dipertahankan
// sama: realtime menjadi jalur utama, dengan poll berkala dan refresh saat tab
// kembali aktif sebagai jaring pengaman kalau tabel schedules belum masuk
// publication supabase_realtime.

const POLL_AKTIF_MS = 30 * 1000;
const POLL_SAMBUNG_MS = 90 * 1000;

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

export function namaKanalUnik(pAwalan: string): string {
  penghitungKanal += 1;
  return `${pAwalan}-${penghitungKanal}`;
}

export interface HasilJadwal {
  jadwal: Jadwal[];
  memuat: boolean;
  galat: string;
  terhubung: boolean;
  muatUlang: (opts?: { senyap?: boolean }) => Promise<void>;
}

export function useJadwal(sessionId: string | null): HasilJadwal {
  const [jadwal, setJadwal] = useState<Jadwal[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [terhubung, setTerhubung] = useState(false);

  const hidup = useRef(true);

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

  const muatUlang = useCallback(async ({ senyap = false } = {}) => {
    if (!senyap) setMemuat(true);

    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .order('waktu_mulai', { ascending: true });

    if (!hidup.current) return;

    if (error) {
      console.warn('[jadwal] gagal memuat:', error.message);
      setGalat(
        `Gagal memuat jadwal. Detail: ${error.message}. ` +
          'Jalankan supabase/schema.sql di SQL Editor Supabase.'
      );
      setJadwal([]);
    } else {
      setGalat('');
      setJadwal((data ?? []) as Jadwal[]);
    }

    setMemuat(false);
  }, []);

  useEffect(() => {
    if (!sessionId) return undefined;
    setMemuat(true);
    muatUlang();
  }, [sessionId, muatUlang]);

  // Realtime: satu channel per pemanggil, bukan per pengguna.
  useEffect(() => {
    if (!sessionId) return undefined;

    const channel = supabase
      .channel(`${namaKanal.current}-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        () => {
          muatUlang({ senyap: true });
        }
      )
      .subscribe((status) => {
        if (!hidup.current) return;
        setTerhubung(status === 'SUBSCRIBED');
      });

    return () => {
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
        muatUlang({ senyap: true });
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
      if (status === 'active') muatUlang({ senyap: true });
    };

    const langganan = AppState.addEventListener('change', onPerubahan);
    return () => langganan.remove();
  }, [sessionId, muatUlang]);

  return { jadwal, memuat, galat, terhubung, muatUlang };
}
