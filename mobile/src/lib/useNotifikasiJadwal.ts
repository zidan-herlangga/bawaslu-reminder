import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  cekIzinNotifikasi,
  jadwalkanOtomatis,
  siapkanChannel,
  type StatusNotifikasi,
} from './notifikasi';
import { supabase } from './supabase';

// Menjadwalkan notifikasi sistem untuk semua jadwal.
//
// Kenapa berkas ini ada: notifikasi sistem dan banner dalam aplikasi adalah dua
// hal berbeda. Banner hanya jalan selama aplikasi terbuka, sedangkan notifikasi
// sistem bisa muncul setelah aplikasi ditutup. Untuk yang kedua, Android
// membatalkan semua notifikasi terjadwal begitu proses aplikasi berhenti, jadi
// penjadwalan harus diulang setiap kali daftar jadwal berubah atau aplikasi
// dibuka kembali.
//
// Tanpa berkas ini, tidak ada satu pun tempat yang memanggil penjadwalan, dan
// tidak ada yang pernah berbunyi. Kode penjadwalan saja tidak cukup:
// penjadwalan harus dipicu.
//
// -----------------------------------------------------------------------------
// Izin
//
// Android 13+ membuang setiap notifikasi dari aplikasi yang izinnya belum
// diberikan, termasuk yang sudah dijadwalkan. Jadi izin dibaca lebih dulu, dan
// penjadwalan baru berjalan sesudah izin ada.
//
// Meminta izin harus dari gestur pengguna di Android, jadi di dalam aplikasi ini
// TOMBOL di tab Akun tetap satu-satunya cara memberi izin. Hook ini tidak pernah
// meminta; ia hanya membaca status. Dialog yang muncul di luar gestur diam-diam
// ditolak Android, jadi memanggil requestPermissionsAsync dari sini hanya
// menghasilkan izin yang tidak pernah diberikan.
//
// -----------------------------------------------------------------------------
// Berapa yang dijadwalkan
//
// Semua sesi dalam 24 jam ke depan dicoba, lalu sisanya dilewati. Android
// membatasi jumlah notifikasi terjadwal yang aktif, jadi lebih dari itu hanya
// menambah pekerjaan tanpa menambah yang keluar. Sesi yang paling dekat lebih
// berguna lebih dulu karena itulah yang paling mungkin didengar pengguna.
//
// -----------------------------------------------------------------------------
// Kenapa kanal realtime sendiri
//
// Hook ini memakai kanalnya sendiri, terpisah dari useJadwal. Channel() mencari
// channel yang sudah ada dengan topik sama lalu mengembalikannya apa adanya,
// jadi pemanggil kedua yang menuliskan .on() akan mendapat galat "cannot add
// postgres_changes callbacks after subscribe". useJadwal sudah menyelesaikan ini
// dengan penghitung kanal global; nama di sini diberi akhiran acak supaya tidak
// pernah bentrok dengan layar mana pun.

/** Berapa ke depan sesi ikut dijadwalkan. */
const HORIZON_MS = 24 * 60 * 60 * 1000;

/** Seberapa sering daftar jadwal diperiksa ulang, sebagai jaring pengaman. */
const SELA_JADWAL_MS = 60 * 1000;

/** Jeda perubahan beruntun (hapus lalu insert) supaya memicu satu penjadwalan. */
const TUNDA_REALTIME_MS = 400;

/**
 * Divisi staf yang sedang login.
 *
 * Hanya untuk penyaringan, dan hanya dibaca oleh penjadwalan. Nilai null
 * berarti belum diketahui, dan itu diperlakukan sebagai "jangan menyaring apa
 * pun": profil yang belum termuat bukan alasan untuk membuat jadwal yang
 * milik divisi orang diam-diam terlewat.
 */
export function useNotifikasiJadwal(
  sessionId: string | null,
  divisi: string | null = null
): StatusNotifikasi {
  // null berarti "belum diketahui". Nilai yang dikembalikan ke pemanggil sudah
  // diterjemahkan: tanpa sesi, status izin tidak ada artinya.
  const [izin, setIzin] = useState<StatusNotifikasi | null>(null);

  useEffect(() => {
    if (!sessionId) {
      // Menulis state di dalam efek adalah pola yang ditandai React Compiler.
      // Nilai dikembalikan lewat penjaga di bawah, jadi state tidak perlu
      // ditulis ulang saat pengguna keluar.
      return undefined;
    }

    let dibatalkan = false;
    let sedangMenjadwalkan = false;
    let tunda: ReturnType<typeof setTimeout> | undefined;

    // Deklarasi fungsi, bukan const arrow, supaya ia boleh memanggil dirinya
    // sendiri. Versi dengan useCallback dan rujukan ke dirinya sendiri membuat
    // React Compiler gagal mempertahankan memoization.
    async function jadwalkan(): Promise<void> {
      if (dibatalkan || sedangMenjadwalkan) return;
      sedangMenjadwalkan = true;

      try {
        const now = Date.now();
        const { data, error } = await supabase
          .from('schedules')
          .select('id, judul, status, waktu_mulai, waktu_selesai, slots, target_divisi, kategori')
          .eq('status', 'Aktif')
          .gte('waktu_mulai', new Date(now).toISOString())
          .lte('waktu_mulai', new Date(now + HORIZON_MS).toISOString());

        if (dibatalkan || error || !data?.length) return;

        await jadwalkanOtomatis(data as never[], now, divisi);
      } catch (galat) {
        console.warn('[notifikasi] penjadwalan otomatis gagal:', galat);
      } finally {
        sedangMenjadwalkan = false;
      }
    }

    async function perbaruiIzin(): Promise<void> {
      // Channel dibuat lebih dulu. Di Android 13+ dialog izin tidak muncul kalau
      // belum ada channel, jadi tanpa ini pengguna tidak pernah melihat
      // permintaan izin sama sekali.
      await siapkanChannel();
      const status = await cekIzinNotifikasi();
      if (dibatalkan) return;
      setIzin(status);
    }

    void perbaruiIzin();
    void jadwalkan();

    const channel = supabase
      .channel(`notifikasi-jadwal-${sessionId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        () => {
          if (tunda) clearTimeout(tunda);
          tunda = setTimeout(() => void jadwalkan(), TUNDA_REALTIME_MS);
        }
      )
      .subscribe();

    const dengarAppState = (status: AppStateStatus) => {
      if (status !== 'active') return;
      void perbaruiIzin();
      void jadwalkan();
    };

    const langganan = AppState.addEventListener('change', dengarAppState);
    const selang = setInterval(() => void jadwalkan(), SELA_JADWAL_MS);

    return () => {
      dibatalkan = true;
      if (tunda) clearTimeout(tunda);
      clearInterval(selang);
      langganan.remove();
      supabase.removeChannel(channel);
    };
    // divisi ikut di dependensi: begitu profil termuat, jadwal untuk divisi staf
// sendiri harus dijadwalkan ulang supaya notifikasinya benar-benar berbunyi.
// Jadwal sebelumnya tidak salah, hanya dilewati karena divisi belum diketahui.
  }, [sessionId, divisi]);

  if (!sessionId) return 'belum';
  return izin ?? 'belum';
}