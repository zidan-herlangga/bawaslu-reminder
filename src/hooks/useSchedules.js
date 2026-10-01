import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

// Jadwal perlu ikut berubah di layar pengguna lain begitu ada yang menambah,
// mengubah, atau menghapus. Realtime jadi jalur utama, tapi tabel `schedules`
// hanya ikut terkirim kalau sudah ditambahkan ke publication supabase_realtime
// (SQL Editor). Supaya tetap benar walau SQL itu belum dijalankan, ada tiga
// jaring pengaman: poll berkala, refresh saat tab kembali aktif, dan refresh
// saat jendela browser regain focus.

const POLL_AKTIF_MS = 30 * 1000;
const POLL_SAMBUNG_MS = 90 * 1000;

export default function useSchedules(session) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [terhubung, setTerhubung] = useState(false);

  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async ({ senyap = false } = {}) => {
    if (!senyap) setLoading(true);

    const { data, error: err } = await supabase
      .from('schedules')
      .select('*')
      .order('waktu_mulai', { ascending: true });

    if (!mounted.current) return;

    if (err) {
      console.error('[useSchedules] gagal memuat jadwal:', err.message);
      setError(
        `Gagal memuat jadwal. Detail: ${err.message}. ` +
          'Jalankan supabase/schema.sql di SQL Editor Supabase untuk membuat tabel beserta aturan RLS-nya.'
      );
      setSchedules([]);
    } else {
      setError('');
      setSchedules(data ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session) return undefined;

    setLoading(true);
    reload();
  }, [session, reload]);

  // Realtime: satu channel per sesi, dibersihkan saat logout atau unmount.
  useEffect(() => {
    if (!session) return undefined;

    const channel = supabase
      .channel(`jadwal-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
        reload({ senyap: true });
      })
      .subscribe((status) => {
        if (!mounted.current) return;
        setTerhubung(status === 'SUBSCRIBED');
      });

    return () => {
      setTerhubung(false);
      supabase.removeChannel(channel);
    };
  }, [session, reload]);

  // Poll: cepat saat tab aktif, lambat saat tersembunyi supaya tidak boros.
  useEffect(() => {
    if (!session) return undefined;

    let timer = null;

    const tick = () => {
      if (document.visibilityState === 'visible') reload({ senyap: true });
      timer = setTimeout(tick, document.visibilityState === 'visible' ? POLL_AKTIF_MS : POLL_SAMBUNG_MS);
    };

    timer = setTimeout(tick, POLL_AKTIF_MS);

    return () => clearTimeout(timer);
  }, [session, reload]);

  // Refresh begitu tab dikembalikan ke depan atau jendela difokuskan.
  useEffect(() => {
    if (!session) return undefined;

    const onVisible = () => {
      if (document.visibilityState === 'visible') reload({ senyap: true });
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [session, reload]);

  return { schedules, loading, error, reload, terhubung };
}
