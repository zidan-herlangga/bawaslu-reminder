import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NOTIFICATION_LEAD_MINUTES } from '../constants/options';
import { playReminderSound } from '../lib/sound';
import { notifyNow } from '../lib/push';
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

// Pengingat untuk orang yang sedang membuka halaman.
//
// Baris lonceng TIDAK ditulis dari sini. Tabel notifications tidak punya
// kebijakan INSERT untuk pengguna biasa, jadi percobaan itu selalu ditolak RLS
// dan hanya menghasilkan satu warning di konsol. Selain itu pengingat ini hanya
// untuk dirinya sendiri, jadi tidak akan pernah sampai ke staf lain.
//
// Yang menulis ke lonceng adalah api/pengingat-terjadwal.js, dijalankan cron
// di server, dengan service role dan penerima yang dihitung ulang untuk semua
// staf yang relevan. Jalur ini sekarang hanya jadi suara dan notifikasi
// browser bagi tab yang sedang terbuka, supaya orang itu tahu seketika tanpa
// perlu membuka aplikasi.
function announce(schedule, noticeKey, body) {
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
          announce(schedule, noticeKey, body);
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
