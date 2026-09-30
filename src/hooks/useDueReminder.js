import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NOTIFICATION_LEAD_MINUTES } from '../constants/options';
import { playReminderSound } from '../lib/sound';
import { notifyNow } from '../lib/push';
import { supabase } from '../lib/supabase';
import { getSlots, sortSlots } from '../lib/slots';

const CHECK_INTERVAL_MS = 30 * 1000;
// Penanda sudah diumumkan disimpan di localStorage supaya tidak berulang setelah
// aplikasi dibuka lagi (aplikasi terpasang sebagai PWA sering ditutup/dibuka).
const SEEN_STORAGE_KEY = 'bawaslu.pengingat.h15';
const SEEN_LIMIT = 200;

function readSeen() {
  try {
    const raw = window.localStorage.getItem(SEEN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function rememberSeen(key) {
  try {
    const list = [...readSeen(), key].slice(-SEEN_LIMIT);
    window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* penyimpanan tidak tersedia */
  }
}

function isSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

// Satu jalur pengumuman saja: pengingat disimpan ke tabel notifications, lalu
// AppShell (realtime/polling) yang memutar suara dan menampilkan notifikasi
// browser dengan isi persis seperti yang terlihat di lonceng. Kalau penyimpanan
// ditolak (RLS belum dijalankan), baru diumumkan langsung sebagai cadangan.
async function announce(schedule, noticeKey, body) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (userId) {
      const { error } = await supabase.from('notifications').insert({
        jadwal_id: schedule.id,
        pengirim_id: userId,
        penerima_id: userId,
        judul: 'Pengingat jadwal',
        pesan: body,
        target_divisi: schedule.target_divisi ?? null,
      });

      if (!error) return;
      console.warn('[pengingat] gagal menyimpan pengingat ke lonceng:', error.message);
    }
  } catch (error) {
    console.warn('[pengingat] gagal menyimpan pengingat ke lonceng:', error);
  }

  playReminderSound(schedule.kategori);
  if (isSupported() && Notification.permission === 'granted') {
    void notifyNow({ title: 'Pengingat jadwal', body, tag: noticeKey }).catch((error) =>
      console.warn('[pengingat] notifikasi lokal gagal:', error)
    );
  }
}

export default function useDueReminder(schedules, divisi) {
  const [permission, setPermission] = useState(() =>
    isSupported() ? Notification.permission : 'unsupported'
  );
  const notifiedRef = useRef(new Set());

  const requestPermission = useCallback(async () => {
    if (!isSupported()) return 'unsupported';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const leadMs = NOTIFICATION_LEAD_MINUTES * 60 * 1000;
      const seen = readSeen();

      schedules.forEach((schedule) => {
        if (schedule.status !== 'Aktif') return;
        if (schedule.target_divisi && schedule.target_divisi !== divisi) return;

        sortSlots(getSlots(schedule)).forEach((slot) => {
          const noticeKey = `${schedule.id}::${slot.mulai}`;
          if (notifiedRef.current.has(noticeKey) || seen.has(noticeKey)) return;

          const start = new Date(slot.mulai).getTime();
          if (Number.isNaN(start)) return;

          const remaining = start - now;
          if (remaining <= 0 || remaining > leadMs) return;

          notifiedRef.current.add(noticeKey);
          rememberSeen(noticeKey);

          const minutes = Math.max(1, Math.round(remaining / 60000));
          const body = `${schedule.judul} dimulai ${minutes} menit lagi.`;
          void announce(schedule, noticeKey, body);
        });
      });
    };

    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [schedules, divisi]);

  return useMemo(
    () => ({
      supported: isSupported(),
      permission,
      requestPermission,
      leadMinutes: NOTIFICATION_LEAD_MINUTES,
    }),
    [permission, requestPermission]
  );
}
