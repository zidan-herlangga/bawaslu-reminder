import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import { PresenceProvider } from '../lib/presenceContext';
import ThemeToggle from './ThemeToggle';
import useSession from '../hooks/useSession';
import { useOnline } from '../hooks/useOnline';
import { supabase } from '../lib/supabase';
import { enablePush, ensurePushSubscription, isPushReady, notifyNow } from '../lib/push';
import {
  hasSoundActivation,
  isSoundBusy,
  isSoundEnabled,
  playChime,
  playReminderSound,
  setSoundEnabled,
  subscribeSound,
  subscribeSoundActivation,
  subscribeSoundBusy,
} from '../lib/sound';
import { showToast, subscribeToast } from '../lib/toast';

const APP_PATHS = ['/', '/kalender', '/todo', '/jadwal/baru', '/akun'];
// Kanal realtime menarik notifikasi begitu baris masuk. Polling di bawah tetap
// ada sebagai jaring pengaman; barunya baru dipakai setelah kanal terbukti
// benar-benar mengantarkan event, supaya tidak pernah lebih lambat dari sekarang.
const NOTIF_POLL_MS = 15 * 1000;
const NOTIF_POLL_SLOW_MS = 60 * 1000;

const TOAST_TONE = {
  error: 'bg-bw-red-solid text-white ring-bw-red-100',
  success: 'bg-bw-solid text-bw-solid-text ring-bw-line',
  info: 'bg-bw-blue text-white ring-bw-blue-200',
};

function formatLalu(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const menit = Math.floor(diff / 60000);
  if (menit < 1) return 'Baru saja';
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.floor(jam / 24)} hari lalu`;
}

function IconHome({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 9.75V20.25a.75.75 0 0 0 .75.75h4.5v-5.25h3v5.25h4.5a.75.75 0 0 0 .75-.75V9.75" />
    </svg>
  );
}

function IconPlus({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 8.25v7.5M8.25 12h7.5" />
    </svg>
  );
}

function IconCalendar({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3.75" y="5.25" width="16.5" height="15" rx="2" />
      <path strokeLinecap="round" d="M3.75 9.75h16.5M8.25 3.75v3M15.75 3.75v3" />
    </svg>
  );
}

function IconChecklist({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6.75 5.6 8.35 9 5M4 17.25l1.6 1.6L9 15.5" />
      <path strokeLinecap="round" d="M12 7.5h8M12 12h8M12 16.5h8" />
    </svg>
  );
}

function IconUser({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8.25" r="3.75" />
      <path strokeLinecap="round" d="M4.5 20.25c0-3.45 3.36-5.625 7.5-5.625s7.5 2.175 7.5 5.625" />
    </svg>
  );
}

function IconBell({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 9a5.25 5.25 0 1 1 10.5 0c0 3 .75 4.5 1.5 5.25H5.25c.75-.75 1.5-2.25 1.5-5.25Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 18.75a1.5 1.5 0 0 0 3 0" />
    </svg>
  );
}

function IconClose({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function IconVolumeOn({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 9.75v4.5h3l4.5 3.75V6l-4.5 3.75h-3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9a4.5 4.5 0 0 1 0 6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.3 6.75a8.25 8.25 0 0 1 0 10.5" />
    </svg>
  );
}

function IconVolumeOff({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 9.75v4.5h3l4.5 3.75V6l-4.5 3.75h-3Z" />
      <path strokeLinecap="round" d="m16.5 9.75 4.5 4.5M21 9.75l-4.5 4.5" />
    </svg>
  );
}

function IconLogout({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 3.75h3.75A1.5 1.5 0 0 1 20.25 5.25v13.5a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 8.25 14.25 12l-3.75 3.75M14.25 12H4.5" />
    </svg>
  );
}

const ICON_BUTTON_CLASS =
  'relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-transparent bg-transparent text-bw-muted transition-colors hover:bg-bw-blue-50 hover:text-bw-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-bw-blue/40';

const NAV_BASE =
  'flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors';

// Placeholder saat halaman yang dimuat malas belum selesai diunduh.
// Bentuknya mengikuti halaman asli (kartu lebar penuh) supaya tidak melompat
// saat isinya muncul. Sengaja tanpa animasi: tidak ada yang perlu dikecualikan
// untuk prefers-reduced-motion.
function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat halaman...</span>
      <div className="rounded-3xl border border-bw-line bg-bw-card p-4 shadow-card sm:p-5">
        <div className="h-3 w-24 rounded-lg bg-bw-surface" />
        <div className="mt-3 h-5 w-2/3 rounded-lg bg-bw-surface" />
        <div className="mt-4 h-3 w-1/2 rounded-lg bg-bw-surface" />
      </div>
      <div className="rounded-3xl border border-bw-line bg-bw-card p-4 shadow-card sm:p-5">
        <div className="space-y-3">
          <div className="h-3.5 w-full rounded-lg bg-bw-surface" />
          <div className="h-3.5 w-11/12 rounded-lg bg-bw-surface" />
          <div className="h-3.5 w-9/12 rounded-lg bg-bw-surface" />
        </div>
      </div>
      <div className="rounded-3xl border border-bw-line bg-bw-card p-4 shadow-card sm:p-5">
        <div className="space-y-3">
          <div className="h-3.5 w-10/12 rounded-lg bg-bw-surface" />
          <div className="h-3.5 w-full rounded-lg bg-bw-surface" />
        </div>
      </div>
    </div>
  );
}

export default function AppShell() {
  const location = useLocation();
  const { session, signOut } = useSession({ redirect: false });

  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const [soundBusy, setSoundBusy] = useState(() => isSoundBusy());
  const [soundAktif, setSoundAktif] = useState(() => hasSoundActivation());
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState('');
  const [pushOn, setPushOn] = useState(() => isPushReady());
  const [pushBusy, setPushBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const online = useOnline();
  const onlineRef = useRef(online);

  const seenRef = useRef(new Set());
  const silencedRef = useRef(new Set());
  const primedRef = useRef(false);

  const inApp = APP_PATHS.includes(location.pathname);
  const showNav = Boolean(session) && inApp;
  const unread = notifs.filter((item) => !item.dibaca).length;

  // Dipakai sebagai kunci efek realtime. Objek sesi berganti setiap kali
  // Supabase menyegarkan token, jadi memakainya sebagai dependensi membuat
  // kanal dibuat ulang terus-menerus.
  const userId = session?.user?.id ?? null;

  useEffect(() => subscribeSound(setSoundOn), []);
  useEffect(() => subscribeSoundBusy(setSoundBusy), []);

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    setNotifLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('id, judul, pesan, dibaca, created_at, jadwal_id, schedules(kategori)')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('[AppShell] notifikasi gagal dimuat:', error.message);
      setNotifError(
        error.message.includes('schema cache') || error.message.includes('Could not find')
          ? 'Jalankan supabase/schema.sql (bagian 7) di SQL Editor Supabase.'
          : error.message
      );
    } else {
      setNotifError('');
      const rows = data ?? [];
      const fresh = primedRef.current
        ? rows.filter((item) => !seenRef.current.has(item.id))
        : [];

      seenRef.current = new Set(rows.map((item) => item.id));
      primedRef.current = true;
      setNotifs(rows);

        fresh.forEach((item) => {
          // Kalau push-nya sampai, service worker sudah menampilkan notifikasi
          // native, jadi jangan tampilkan dua kali. Suara tetap dimainkan dari
          // halaman ini karena service worker tidak bisa memutar audio: suara
          // bawaan OS sering tidak berbunyi saat tab terlihat, dan channel yang
          // di-mute akan benar-benar diam.
          const perluNotifyNow = !silencedRef.current.delete(item.id);
          const kategori = item.schedules?.kategori;

          void (async () => {
            await playReminderSound(kategori);

            if (perluNotifyNow) {
              await notifyNow({
                title: item.judul || 'Pengingat jadwal',
                body: item.pesan,
                tag: item.id,
              });
            }
          })();
        });
    }
    setNotifLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setNotifs([]);
      setNotifOpen(false);
      primedRef.current = false;
      seenRef.current = new Set();
      silencedRef.current = new Set();
      return undefined;
    }

    loadNotifications();

    let disposed = false;
    let timer = null;
    let subscribed = false;
    let proven = false;

    const schedule = () => {
      if (disposed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(tick, subscribed && proven ? NOTIF_POLL_SLOW_MS : NOTIF_POLL_MS);
    };

    const tick = async () => {
      if (disposed) return;
      try {
        await loadNotifications();
      } catch (error) {
        console.error('[AppShell] pemeriksaan notifikasi gagal:', error);
      }
      schedule();
    };

    const channel = supabase
      .channel(`notifikasi-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `penerima_id=eq.${userId}`,
        },
        () => {
          proven = true;
          schedule();
          void loadNotifications();
        }
      )
      .subscribe((status) => {
        if (disposed) return;
        subscribed = status === 'SUBSCRIBED';
        if (!subscribed) proven = false;
        console.info('[AppShell] kanal notifikasi realtime:', status);
        schedule();
      });

    schedule();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [userId, loadNotifications]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined;
    const onMessage = (event) => {
      const data = event.data;
      if (data && data.type === 'bawaslu-push-shown' && data.id) {
        silencedRef.current.add(String(data.id));
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => subscribeToast((item) => setToast(item)), []);

  // Kabari begitu sinyal kembali, karena orang sering menunggu di halaman ini
  // sambil mengira tombolnya tidak bisa dipakai lagi.
  useEffect(() => {
    // Toast hanya saat transisi mati -> online. Render pertama dilewati: saat
    // itu ref sudah bernilai online, jadi tidak ada yang muncul setiap kali
    // halaman dibuka.
    if (onlineRef.current === false && online) {
      showToast('Sinyal kembali. Perubahan bisa dikirim lagi.', 'success');
    }
    onlineRef.current = online;
  }, [online]);

  useEffect(
    () =>
      subscribeSoundActivation((aktif) => {
        setSoundAktif(aktif);
      }),
    []
  );

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!session || !isPushReady()) return;
    ensurePushSubscription(session).then((result) => setPushOn(Boolean(result.ok)));
  }, [session]);

  useEffect(() => {
    if (!notifOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setNotifOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notifOpen]);

  const markRead = async (id) => {
    const previous = notifs;
    setNotifs((list) => list.map((item) => (item.id === id ? { ...item, dibaca: true } : item)));
    const { data, error } = await supabase
      .from('notifications')
      .update({ dibaca: true })
      .eq('id', id)
      .select('id');
    if (error || !data?.length) setNotifs(previous);
  };

  const markAllRead = async () => {
    if (unread === 0) return;
    const previous = notifs;
    setNotifs((list) => list.map((item) => ({ ...item, dibaca: true })));
    const { data, error } = await supabase
      .from('notifications')
      .update({ dibaca: true })
      .eq('dibaca', false)
      .select('id');
    if (error || !data?.length) setNotifs(previous);
  };

  const handleEnablePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    const result = await enablePush(session);
    setPushOn(Boolean(result.ok));
    if (!result.ok && result.reason !== 'denied') {
      setNotifError(
        result.message ??
          (result.reason === 'no-vapid-key'
            ? 'VITE_VAPID_PUBLIC_KEY belum diisi di file .env.'
            : 'Notifikasi browser tidak bisa diaktifkan.')
      );
    } else if (result.ok) {
      setNotifError('');
    }
    setPushBusy(false);
  };

  const toggleSound = () => {
    if (soundBusy) return;
    const next = !soundOn;
    setSoundEnabled(next);
    if (next) playChime();
  };

  const navItems = [
    { to: '/', label: 'Beranda', icon: IconHome, end: true },
    { to: '/kalender', label: 'Kalender', icon: IconCalendar, end: false },
    { to: '/jadwal/baru', label: 'Buat Jadwal', short: 'Buat', icon: IconPlus, end: false },
    { to: '/todo', label: 'Todo', icon: IconChecklist, end: false },
    { to: '/akun', label: 'Akun', icon: IconUser, end: false },
  ];

  return (
    <div className="flex min-h-dvh justify-center bg-bw-canvas">
      <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-bw-card shadow-card ring-1 ring-bw-line sm:max-w-[560px] md:max-w-[760px] lg:max-w-[860px]">
        <div className="shrink-0 overflow-hidden bg-bw-solid py-1.5">
          <div className="flex items-center justify-center px-4">
            <span className="truncate text-xs font-medium text-bw-solid-muted">
              Bawaslu Bekasi Kota - Sistem Pengingat Jadwal
            </span>
          </div>
        </div>

        <header className="safe-top bw-glass relative z-10 shrink-0 border-x-0 border-t-0 border-b border-bw-line/70 px-3 py-2.5 sm:px-5">
          <div className="flex items-center gap-2.5 pt-2">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <img
                src="/logo-mark.png"
                alt=""
                className="h-9 w-auto shrink-0 object-contain sm:h-10"
                width={176}
                height={192}
              />
              <div className="min-w-0">
                <p className="truncate font-display text-[15px] font-bold leading-tight tracking-tight text-bw-ink">
                  Pengingat Jadwal
                </p>
                <p className="truncate text-[11px] font-medium leading-tight text-bw-muted">
                  Bawaslu Bekasi Kota
                </p>
              </div>
            </div>
            {/* Grup toolbar selalu dirender supaya tombol tema tetap ada di
                halaman masuk. Tanpa sesi, grup ini hanya berisi tombol tema
                dan tetap tampil sebagai pil satu tombol. */}
            <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-bw-line bg-bw-card/60 p-0.5">
              <ThemeToggle />
              {session && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !notifOpen;
                      setNotifOpen(next);
                      if (next) loadNotifications();
                    }}
                    aria-expanded={notifOpen}
                    aria-haspopup="dialog"
                    aria-label={
                      unread > 0 ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'
                    }
                    title="Notifikasi"
                    className={`${ICON_BUTTON_CLASS} ${
                      notifOpen ? 'bg-bw-blue-50 text-bw-blue' : ''
                    }`}
                  >
                    <IconBell className="h-[18px] w-[18px]" />
                    {unread > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 min-w-[16px] rounded-full bg-bw-red-solid px-1 text-center text-[10px] font-bold leading-4 text-white ring-2 ring-bw-card">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={toggleSound}
                    disabled={soundBusy}
                    aria-pressed={soundOn}
                    aria-label={
                      soundOn ? 'Matikan suara pengingat' : 'Nyalakan suara pengingat'
                    }
                    title={
                      soundBusy
                        ? 'Tunggu nada selesai'
                        : soundOn
                          ? 'Matikan suara pengingat'
                          : 'Nyalakan suara pengingat'
                    }
                    className={`${ICON_BUTTON_CLASS} ${
                      soundOn ? 'bg-bw-blue-50 text-bw-blue' : ''
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {soundOn ? (
                      <IconVolumeOn className="h-[18px] w-[18px]" />
                    ) : (
                      <IconVolumeOff className="h-[18px] w-[18px]" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={signOut}
                    aria-label="Keluar dari akun"
                    title="Keluar"
                    className={ICON_BUTTON_CLASS}
                  >
                    <IconLogout className="h-[18px] w-[18px]" />
                  </button>
                </>
              )}
            </div>
          </div>

          {notifOpen && (
            <div
              role="dialog"
              aria-label="Notifikasi"
              className="absolute right-3 top-full z-20 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-bw-line bg-bw-card shadow-xl"
            >
              <div className="flex items-center justify-between gap-2 border-b border-bw-line bg-bw-surface px-3 py-2">
                <p className="text-[12px] font-bold uppercase tracking-wide text-bw-muted">
                  Notifikasi {unread > 0 && <span className="text-bw-red">({unread})</span>}
                </p>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-xs font-semibold text-bw-blue transition-colors hover:underline focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
                    >
                      Tandai semua
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    aria-label="Tutup notifikasi"
                    className="grid h-9 w-9 place-items-center rounded-full text-bw-muted transition-colors hover:bg-bw-surface hover:text-bw-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-bw-blue/40"
                  >
                    <IconClose className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-[55vh] overflow-y-auto overscroll-contain">
                {notifError && (
                  <p className="m-3 rounded-xl bg-bw-red-50 px-3 py-2 text-xs leading-relaxed text-bw-red">
                    {notifError}
                  </p>
                )}

                {!notifError && notifLoading && notifs.length === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-bw-muted">
                    Memuat notifikasi...
                  </p>
                )}

                {!notifError && !notifLoading && notifs.length === 0 && (
                  <p className="px-3 py-6 text-center text-xs leading-relaxed text-bw-muted">
                    Belum ada notifikasi. Pengingat muncul di sini setelah tombol Ingatkan
                    dipakai di Beranda.
                  </p>
                )}

                {!notifError && notifs.length > 0 && (
                  <ul className="divide-y divide-bw-line">
                    {notifs.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!item.dibaca) markRead(item.id);
                          }}
                          className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-bw-blue/40 ${
                            item.dibaca ? '' : 'bg-bw-blue-50/60 hover:bg-bw-blue-50'
                          }`}
                        >
                          <span
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                              item.dibaca ? 'bg-bw-line' : 'bg-bw-blue'
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block text-[12px] ${
                                item.dibaca ? 'font-medium text-bw-muted' : 'font-bold text-bw-ink'
                              }`}
                            >
                              {item.judul}
                            </span>
                            <span className="mt-0.5 block whitespace-pre-line break-words text-xs leading-snug text-bw-muted">
                              {item.pesan}
                            </span>
                            <span className="mt-1 block text-[11px] text-bw-muted">
                              {formatLalu(item.created_at)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="border-t border-bw-line bg-bw-surface px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs leading-snug text-bw-muted">
                    {pushOn
                      ? 'Notifikasi browser aktif.'
                      : 'Notifikasi browser masih nonaktif.'}
                  </p>
                  {!pushOn && (
                    <button
                      type="button"
                      onClick={handleEnablePush}
                      disabled={pushBusy}
                      className="shrink-0 rounded-xl bg-bw-blue px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-bw-blue-200 focus:outline-none focus:ring-2 focus:ring-bw-blue/40 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pushBusy ? 'Memproses...' : 'Aktifkan'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </header>

        {!online && (
          <div
            role="status"
            className="flex shrink-0 items-center gap-2.5 border-b border-bw-amber-100 bg-bw-amber-50 px-4 py-2.5 text-xs font-medium text-bw-amber sm:px-5"
          >
            <svg
              className="h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 8.5a15 15 0 0 1 20 0" />
              <path d="M5.5 12a10 10 0 0 1 13 0" />
              <path d="M9 15.5a5 5 0 0 1 6 0" />
              <path d="M12 19h.01" />
              <path d="M3 3l18 18" strokeWidth="2" />
            </svg>
            <span>
              Sinyal hilang. Jadwal yang tersimpan tetap aman, tapi perubahan baru belum bisa dikirim sampai koneksi kembali.
            </span>
          </div>
        )}

        <main
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain bg-bw-canvas px-4 sm:px-6 ${
            showNav ? 'pb-28 pt-4' : 'py-6'
          }`}
        >
          {session && soundOn && !soundAktif && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-bw-blue-200 bg-bw-blue-50 px-3.5 py-3">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-bw-blue"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
              <p className="min-w-0 flex-1 text-[13px] leading-snug text-bw-blue-900">
                <span className="font-bold">Ketuk layar sekali</span> agar nada pengingat berbunyi.
                Browser memblokir suara otomatis sampai kamu berinteraksi di halaman ini.
              </p>
            </div>
          )}

          <PresenceProvider session={session}>
            <ErrorBoundary key={location.pathname}>
              <Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </PresenceProvider>
        </main>

        {showNav && (
          <nav className="bw-glass safe-bottom pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-3 pt-2 mb-0.5">
            <ul className="pointer-events-auto mx-auto grid max-w-[520px] grid-cols-5 rounded-3xl border border-bw-line bg-bw-card/70 px-1 py-1 shadow-lift backdrop-blur-xl">
              {navItems.map(({ to, label, short, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `${NAV_BASE} relative whitespace-nowrap transition-transform active:scale-[0.94] ${
                        isActive ? 'text-bw-blue' : 'text-bw-muted hover:text-bw-ink'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-bw-blue" />
                        )}
                        <Icon className="h-[22px] w-[22px]" />
                        {short ? (
                          <>
                            <span className="md:hidden">{short}</span>
                            <span className="hidden md:inline">{label}</span>
                          </>
                        ) : (
                          <span>{label}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute inset-x-3 bottom-20 z-40 flex justify-center"
          >
            <p
              className={`max-w-full rounded-3xl px-3.5 py-2.5 text-center text-xs font-semibold leading-snug shadow-lg ring-1 ${
                TOAST_TONE[toast.tone] || TOAST_TONE.info
              }`}
            >
              {toast.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
