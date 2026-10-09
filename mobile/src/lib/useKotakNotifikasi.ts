import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  MAKS_KOTAK_MASUK,
  adaptasiDaftarNotifikasi,
  hitungBelumDibaca,
  kotakAwal,
  notifikasiBaru,
  reducerKotak,
  type BarisNotifikasi,
  type Notifikasi,
} from '../shared/kotakNotifikasi';
import { tampilkanSekarang } from './notifikasi';
import { supabase } from './supabase';
import { namaKanalUnik } from './useJadwal';

// Pengambilan kotak masuk notifikasi.
//
// Port dari src/components/AppShell.jsx. Jalur sinkronisasinya sama: realtime
// menjadi jalur utama, dengan poll berkala dan refresh saat aplikasi kembali
// aktif sebagai jaring pengaman kalau tabel notifications belum masuk
// publication supabase_realtime.
//
// -----------------------------------------------------------------------------
// Kenapa notifikasi baru ditampilkan lewat sistem
//
// Web memakai AudioContext untuk membunyikan nada pengingat, karena peramban
// tidak bisa mempercayai pemutaran suara tanpa gestur pengguna. Di aplikasi
// native tidak ada masalah itu: suara dan heads-up diserahkan ke sistem. Karena
// itu notifikasi baru dipresentasikan sebagai notifikasi sistem seketika, bukan
// dengan memutar berkas suara.
//
// -----------------------------------------------------------------------------
// Tandai sudah baca
//
// Status diubah di layar lebih dulu, lalu disimpan ke database. Kalau database
// menolak, daftar digulung balik. Urutan ini membuat tombol terasa langsung
// tanpa menunggu bolak-balik jaringan, dan tidak pernah menampilkan notifikasi
// sebagai sudah dibaca padahal belum tersimpan.

/** Poll cepat, dipakai sebelum realtime terkonfirmasi. */
const POLL_AKTIF_MS = 30 * 1000;

/** Poll lambat, dipakai setelah realtime terbukti menerima perubahan. */
const POLL_SAMBUNG_MS = 90 * 1000;

/** Beberapa perubahan beruntun cukup memicu satu pemuatan ulang. */
const TUNDA_REALTIME_MS = 300;

/**
 * Dipakai saat tidak ada yang bisa ditampilkan.
 *
 * Harus mutable: nilai ini keluar dari hook sebagai Notifikasi[], dan larik
 * readonly tidak bisa diteruskan ke komponen yang mengubahnya.
 */
const DAFTAR_KOSONG: Notifikasi[] = [];

export interface HasilKotakNotifikasi {
  notifikasi: Notifikasi[];
  belumDibaca: number;
  memuat: boolean;
  galat: string;
  /** Menandai satu notifikasi sudah dibaca, lalu menyimpannya ke database. */
  tandaiDibaca: (id: string) => Promise<void>;
  /** Menandai semua notifikasi sudah dibaca sekaligus. */
  tandaiSemuaDibaca: () => Promise<void>;
  /** Menghapus satu notifikasi dari kotak masuk dan dari database. */
  hapus: (id: string) => Promise<void>;
  /** Menghapus seluruh notifikasi dari kotak masuk dan dari database. */
  hapusSemua: () => Promise<void>;
  muatUlang: () => Promise<void>;
}

/**
 * Menyusun pesan galat yang sesuai penyebabnya. Petunjuk "jalankan schema.sql"
 * hanya masuk akal untuk masalah skema atau izin; untuk masalah jaringan, petunjuk
 * itu menyesatkan.
 */
function susunPesanGalat(pesan: string): string {
  const masalahJaringan = /network|fetch|timeout|timed out|failed to/i.test(pesan);
  if (masalahJaringan) {
    return 'Tidak bisa terhubung ke server. Periksa koneksi internet, lalu coba lagi.';
  }

  const masalahSkema =
    /schema cache|could not find|does not exist|relation|permission denied/i.test(pesan);

  return (
    `Gagal memuat notifikasi. Detail: ${pesan}.` +
    (masalahSkema ? ' Jalankan supabase/schema.sql di SQL Editor Supabase.' : '')
  );
}

export function useKotakNotifikasi(sessionId: string | null): HasilKotakNotifikasi {
  const [keadaan, kirim] = useReducer(reducerKotak, undefined, kotakAwal);
  const [galat, setGalat] = useState('');

  // Id yang sudah pernah dimuat, untuk membedakan notifikasi baru dari yang lama.
  const sudahDilihat = useRef<Set<string>>(new Set());
  // created_at paling baru yang pernah dimuat, dalam milidetik. Baris lama yang
  // baru masuk jendela 30 teratas setelah baris lain dihapus punya waktu yang
  // lebih dulu dari ini, jadi tidak disangka notifikasi baru.
  const maksWaktuDilihat = useRef(0);
  const pemuatanPertama = useRef(true);

  // Keadaan milik staf ini saja. Tanpa penapis ini, baris milik staf sebelumnya
  // bisa tampil sesaat untuk staf berikutnya di perangkat yang sama.
  const milikSesiIni = sessionId !== null && keadaan.userId === sessionId;
  const daftar = milikSesiIni ? keadaan.daftar : DAFTAR_KOSONG;

  const muatUlang = useCallback(async () => {
    if (!sessionId) return;

    const { data, error } = await supabase
        .from('notifications')
        .select('id, judul, pesan, dibaca, created_at, jadwal_id, schedules(kategori)')
        .order('created_at', { ascending: false })
        .limit(MAKS_KOTAK_MASUK);

      if (error) {
        setGalat(susunPesanGalat(error.message));
        return;
      }

      const baris = adaptasiDaftarNotifikasi(
        (data ?? []) as (BarisNotifikasi | null)[]
      );

      // Perhitungan notifikasi baru harus selesai sebelum penanda waktu
      // diperbarui. Kalau dibalik, semua baris akan dianggap sudah pernah
      // dilihat dan tidak ada yang pernah dipresentasikan.
      const baru = notifikasiBaru(
        baris,
        sudahDilihat.current,
        pemuatanPertama.current,
        maksWaktuDilihat.current
      );

      pemuatanPertama.current = false;
      sudahDilihat.current = new Set(baris.map((item) => item.id));
      let maks = maksWaktuDilihat.current;
      for (const item of baris) {
        const t = Date.parse(item.dibuatPada);
        if (Number.isFinite(t) && t > maks) maks = t;
      }
      maksWaktuDilihat.current = maks;

      setGalat('');
      kirim({ jenis: 'muat', userId: sessionId, daftar: baris });

      // Notifikasi tanpa suara cuma menambah angka di badge, dan angka itu tidak
      // menaikkan kepala staf yang sedang mengerjakan hal lain. Hanya baris baru
      // yang dipresentasikan: baris lama yang baru dimuat bukan kabar baru, dan
      // memainkannya akan membuat ponsel berbunyi setiap kali aplikasi dibuka.
      if (baru.length > 0) {
        void Promise.all(
          baru.map((item) =>
            tampilkanSekarang({
              judul: item.judul,
              pesan: item.pesan,
              jadwalId: item.jadwalId,
              kategori: item.kategori,
            })
          )
        );
      }
  }, [sessionId]);

  const tandaiSatu = useCallback(
    async (id: string) => {
      if (!sessionId) return;

      kirim({ jenis: 'tandai', userId: sessionId, id });

      const { error } = await supabase
        .from('notifications')
        .update({ dibaca: true })
        .eq('id', id);

      // Simpan gagal berarti tampilan akan berbohong terus kalau tidak digulung.
      if (error) {
        kirim({ jenis: 'gulungBalik', userId: sessionId });
        setGalat(susunPesanGalat(error.message));
      }
    },
    [sessionId]
  );

  const tandaiSemua = useCallback(async () => {
    if (!sessionId) return;

    kirim({ jenis: 'tandaiSemua', userId: sessionId });

    const { error } = await supabase
      .from('notifications')
      .update({ dibaca: true })
      .eq('dibaca', false);

    if (error) {
      kirim({ jenis: 'gulungBalik', userId: sessionId });
      setGalat(susunPesanGalat(error.message));
    }
  }, [sessionId]);

  const hapusSatu = useCallback(
    async (id: string) => {
      if (!sessionId) return;

      // Baris dibuang dari tampilan lebih dulu, lalu dari database. Kalau
      // database menolak, daftar digulung balik; kalau berhasil, daftar tidak
      // perlu diisi ulang karena penghapusan sudah mencerminkan database.
      kirim({ jenis: 'hapus', userId: sessionId, id });

      const { error } = await supabase.from('notifications').delete().eq('id', id);

      if (error) {
        kirim({ jenis: 'gulungBalik', userId: sessionId });
        setGalat(susunPesanGalat(error.message));
      }
    },
    [sessionId]
  );

  const hapusSemuaSekali = useCallback(async () => {
    if (!sessionId) return;

    if (!daftar.length) return;

    // Seluruh baris dibuang dari tampilan lebih dulu, lalu dari database.
    kirim({ jenis: 'hapusSemua', userId: sessionId });

    const { error } = await supabase.from('notifications').delete().eq('penerima_id', sessionId);

    if (error) {
      kirim({ jenis: 'gulungBalik', userId: sessionId });
      setGalat(susunPesanGalat(error.message));
    }
  }, [sessionId, daftar.length]);

  useEffect(() => {
    if (!sessionId) {
      // Tidak ada state yang perlu dikosongkan: daftar milik sesi lama sudah tidak
      // terlihat karena penyaring userId di atas. Yang harus dibuang adalah penanda
      // "sudah pernah dimuat", supaya notifikasi lama milik staf ini tidak
      // disangka baru ketika ia masuk lagi.
      pemuatanPertama.current = true;
      sudahDilihat.current = new Set();
      maksWaktuDilihat.current = 0;
      return;
    }

    let dibatalkan = false;
    let tunda: ReturnType<typeof setTimeout> | undefined;

    void muatUlang();

    // Poll cepat sampai realtime terkonfirmasi. Setelah itu poll diperlambat:
    // realtime sudah terbukti menerima perubahan, jadi permintaan berulang hanya
    // membebani radio perangkat dan kuota data tanpa menambah ketepatan.
    let selang = setInterval(() => {
      void muatUlang();
    }, POLL_AKTIF_MS);

    const channel = supabase
      .channel(namaKanalUnik(`notifikasi-${sessionId}`))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          if (tunda) clearTimeout(tunda);
          tunda = setTimeout(() => {
            if (!dibatalkan) void muatUlang();
          }, TUNDA_REALTIME_MS);
        }
      )
      .subscribe((status) => {
        if (dibatalkan || status !== 'SUBSCRIBED') return;
        clearInterval(selang);
        selang = setInterval(() => {
          void muatUlang();
        }, POLL_SAMBUNG_MS);
      });

    const dengarAppState = (status: AppStateStatus) => {
      if (status !== 'active') return;
      void muatUlang();
    };

    const langganan = AppState.addEventListener('change', dengarAppState);

    return () => {
      dibatalkan = true;
      if (tunda) clearTimeout(tunda);
      clearInterval(selang);
      langganan.remove();
      void supabase.removeChannel(channel);
    };
  }, [sessionId, muatUlang]);

  return {
    notifikasi: daftar,
    belumDibaca: hitungBelumDibaca(daftar),
    // Sesi tanpa daftar milik sendiri berarti masih memuat, bukan kosong.
    memuat: sessionId !== null && !milikSesiIni,
    galat,
    tandaiDibaca: tandaiSatu,
    tandaiSemuaDibaca: tandaiSemua,
    hapus: hapusSatu,
    hapusSemua: hapusSemuaSekali,
    muatUlang,
  };
}