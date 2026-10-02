import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

// Daftar siapa yang sedang membuka aplikasi, memakai Realtime Presence.
//
// Sengaja memakai Presence bawaan Supabase dan bukan tabel baru, jadi tidak
// perlu menjalankan SQL apa pun di Supabase. Presence hanya hidup selama kanal
// terhubung: begitu pengguna menutup tab, logout, atau kehilangan koneksi,
// entrinya hilang sendiri tanpa perlu ada yang membersihkannya.
//
// Dua hal yang harus ditangani supaya daftarnya tidak berbohong:
//
// 1. Satu pengguna bisa membuka aplikasi di beberapa tab sekaligus. Presence
//    menghitung satu entri per tab, jadi tanpa penggabungan satu orang akan
//    muncul beberapa kali. Dikelompokkan per userId di sini.
// 2. Presence butuh sinkronisasi lewat jaringan. Kalau koneksi putus tanpa
//    sempat memberitahu server, entri bisa tertinggal sementara. Setiap entri
//    membawa waktu pengiriman, dan yang sudah lewat ambang dianggap offline
//    supaya daftar tidak menampilkan orang yang sudah pergi lama.

const CHANNEL_NAMA = 'bawaslu-aktif';
const AMBANG_STALE_MS = 90 * 1000;
// Penyegaran berkala juga berfungsi sebagai penanda waktu, supaya entri milik
// pengguna ini tidak dianggap basi dan daftar orang lain tetap ikut segar.
const POLL_MS = 25 * 1000;

function ambilWaktu(payload) {
  const nilai = payload?.at;
  const waktu = typeof nilai === 'number' ? nilai : Date.parse(nilai);
  return Number.isFinite(waktu) ? waktu : 0;
}

export default function usePresence(session, profile) {
  const [daftar, setDaftar] = useState([]);
  const [terhubung, setTerhubung] = useState(false);

  const channelRef = useRef(null);
  const timerRef = useRef(null);

  const userId = session?.user?.id ?? '';
  const nama = profile?.nama_lengkap ?? '';
  const jabatan = profile?.jabatan ?? '';
  const divisi = profile?.divisi ?? '';

  const terapkan = useCallback(
    (state) => {
      const sekarang = Date.now();
      const perUser = new Map();

      Object.keys(state ?? {}).forEach((key) => {
        const entries = state[key] ?? [];

        entries.forEach((entry) => {
          const payload = entry ?? {};
          const id = payload.userId;
          if (!id) return;

          const waktu = ambilWaktu(payload);
          if (waktu && sekarang - waktu > AMBANG_STALE_MS) return;

          const sebelumnya = perUser.get(id);
          // Simpan entri terbaru saja: satu orang dengan beberapa tab tetap
          // menjadi satu baris.
          if (!sebelumnya || waktu > sebelumnya.at) {
            perUser.set(id, {
              id,
              nama: payload.nama || 'Tanpa nama',
              jabatan: payload.jabatan || '',
              divisi: payload.divisi || '',
              at: waktu,
              jumlahPerangkat: 1,
            });
          }
        });
      });

      // Jumlah tab per orang dihitung terpisah supaya perangkat banyak tetap
      // terbaca sebagai satu orang, bukan beberapa baris.
      Object.keys(state ?? {}).forEach((key) => {
        const entries = state[key] ?? [];
        const hitung = new Map();
        entries.forEach((entry) => {
          const id = entry?.userId;
          if (!id) return;
          hitung.set(id, (hitung.get(id) ?? 0) + 1);
        });
        hitung.forEach((jumlah, id) => {
          const ada = perUser.get(id);
          if (ada) ada.jumlahPerangkat = jumlah;
        });
      });

      const hasil = [...perUser.values()].sort((a, b) => {
        if (a.id === userId) return -1;
        if (b.id === userId) return 1;
        return a.nama.localeCompare(b.nama, 'id-ID');
      });

      setDaftar(hasil);
    },
    [userId]
  );

  useEffect(() => {
    if (!userId) {
      setDaftar([]);
      setTerhubung(false);
      return undefined;
    }

    const payloadKirim = () => ({
      userId,
      nama,
      jabatan,
      divisi,
      at: Date.now(),
    });

    const channel = supabase.channel(CHANNEL_NAMA, {
      config: {
        // Presence punya jeda bawaan 30 detik. Diperpanjang agar daftar tidak
        // berkedip ketika jaringan sesaat lambat.
        presence: { key: userId },
      },
    });

    const segarkan = () => {
      terapkan(channel.presenceState());
    };

    channel.on('presence', { event: 'sync' }, segarkan);
    channel.on('presence', { event: 'join' }, segarkan);
    channel.on('presence', { event: 'leave' }, segarkan);

    channel.subscribe((status) => {
      setTerhubung(status === 'SUBSCRIBED');
      if (status === 'SUBSCRIBED') {
        void channel.track(payloadKirim());
        segarkan();
      }
    });

    channelRef.current = channel;

    timerRef.current = setInterval(() => {
      if (!channelRef.current) return;
      void channelRef.current.track(payloadKirim());
      terapkan(channelRef.current.presenceState());
    }, POLL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      channelRef.current = null;
      setTerhubung(false);
      void supabase.removeChannel(channel);
    };
  }, [userId, nama, jabatan, divisi, terapkan]);

  return { daftar, terhubung, jumlah: daftar.length };
}