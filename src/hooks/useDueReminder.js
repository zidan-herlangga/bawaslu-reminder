import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NOTIFICATION_LEAD_MINUTES } from '../constants/options';
import { playReminderSound } from '../lib/sound';
import { notifyNow } from '../lib/push';
import { getSlots, sortSlots } from '../lib/slots';

const CHECK_INTERVAL_MS = 30 * 1000;

function isSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
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

      schedules.forEach((schedule) => {
        if (schedule.status !== 'Aktif') return;
        if (schedule.target_divisi && schedule.target_divisi !== divisi) return;

        sortSlots(getSlots(schedule)).forEach((slot) => {
          const noticeKey = `${schedule.id}::${slot.mulai}`;
          if (notifiedRef.current.has(noticeKey)) return;

          const start = new Date(slot.mulai).getTime();
          if (Number.isNaN(start)) return;

          const remaining = start - now;
          if (remaining <= 0 || remaining > leadMs) return;

          notifiedRef.current.add(noticeKey);

          const minutes = Math.max(1, Math.round(remaining / 60000));
          const body = `${schedule.judul} dimulai ${minutes} menit lagi.`;

          playReminderSound(schedule.kategori);

          if (isSupported() && Notification.permission === 'granted') {
            // Jangan pernah memakai new Notification() langsung: Chrome mobile
            // dan PWA melempar "Illegal constructor" yang menghancurkan halaman.
            void notifyNow({ title: 'Pengingat jadwal', body, tag: noticeKey }).catch(
              (error) => console.warn('[pengingat] notifikasi lokal gagal:', error)
            );
          }
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
