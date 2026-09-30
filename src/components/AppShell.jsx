import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import useSession from '../hooks/useSession';
import { supabase } from '../lib/supabase';
import { enablePush, ensurePushSubscription, isPushReady, notifyNow } from '../lib/push';
import {
  isSoundBusy,
  isSoundEnabled,
  playChime,
  playReminderSound,
  setSoundEnabled,
  subscribeSound,
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
  error: 'bg-bw-red text-white ring-bw-red-100',
  success: 'bg-bw-ink text-white ring-black/10',
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

const MARQUEE_ITEMS = ['Bawaslu Kota Bekasi', 'Sistem Pengingat Jadwal'];
const MARQUEE_HALF = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];

function MarqueeGroup({ decorative }) {
  return (
    <span
      className="flex shrink-0 items-center"
      aria-hidden={decorative ? 'true' : undefined}
    >
      {MARQUEE_HALF.map((item, index) => (
        <span key={index} className="flex shrink-0 items-center whitespace-nowrap">
          <span className="px-4">{item}</span>
          <span className="h-1 w-1 shrink-0 rounded-full bg-bw-blue" />
        </span>
      ))}
    </span>
  );
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
  'grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-bw-line bg-white text-bw-muted transition-colors hover:border-bw-blue hover:text-bw-blue focus:outline-none focus:ring-2 focus:ring-bw-blue/40';

const NAV_BASE =
  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors';

export default function AppShell() {
  const location = useLocation();
  const { session, signOut } = useSession({ redirect: false });

  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const [soundBusy, setSoundBusy] = useState(() => isSoundBusy());
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState('');
  const [pushOn, setPushOn] = useState(() => isPushReady());
  const [pushBusy, setPushBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const seenRef = useRef(new Set());
  const silencedRef = useRef(new Set());
  const primedRef = useRef(false);

  const inApp = APP_PATHS.includes(location.pathname);
  const showNav = Boolean(session) && inApp;
  const unread = notifs.filter((item) => !item.dibaca).length;

  useEffect(() => subscribeSound(setSoundOn), []);
  useEffect(() => subscribeSoundBusy(setSoundBusy), []);

  const loadNotifications = useCallback(async () => {
    if (!session) return;
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
        if (silencedRef.current.delete(item.id)) return;
        const kategori = item.schedules?.kategori;
        void (async () => {
          await playReminderSound(kategori);
          await notifyNow({
            title: item.judul || 'Pengingat jadwal',
            body: item.pesan,
            tag: item.id,
          });
        })();
      });
    }
    setNotifLoading(false);
  }, [session]);

  useEffect(() => {
    if (!session) {
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
      .channel(`notifikasi-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `penerima_id=eq.${session.user.id}`,
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
  }, [session, loadNotifications]);

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
    { to: '/todo', label: 'Todo', icon: IconChecklist, end: false },
    { to: '/jadwal/baru', label: 'Buat Jadwal', icon: IconPlus, end: false },
    { to: '/akun', label: 'Akun', icon: IconUser, end: false },
  ];

  return (
    <div className="flex min-h-dvh justify-center bg-bw-canvas">
      <div className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-white shadow-[0_0_50px_rgba(0,0,0,0.18)] ring-1 ring-black/5">
        <div className="bw-marquee shrink-0 overflow-hidden bg-bw-ink py-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/55">
          <span className="sr-only">
            Bawaslu Kota Bekasi - Sistem Pengingat Jadwal
          </span>
          <div className="bw-marquee-track" aria-hidden="true">
            <MarqueeGroup decorative />
            <MarqueeGroup decorative />
          </div>
        </div>

        <header className="relative z-10 flex shrink-0 justify-between items-center gap-3 border-b border-bw-line bg-white px-4 py-3">
          <img
            src="/logo-bawaslu.png"
            alt="Logo Bawaslu"
            className="h-11 w-auto shrink-0 object-contain"
            width={132}
            height={44}
          />
          

          {session && (
            <div className="flex shrink-0 items-center gap-1.5">
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
                className={`${ICON_BUTTON_CLASS} relative ${
                  notifOpen ? 'border-bw-blue-200 bg-bw-blue-50 text-bw-blue' : ''
                }`}
              >
                <IconBell className="h-[18px] w-[18px]" />
                {unread > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 min-w-[16px] rounded-full bg-bw-red px-1 text-center text-[9px] font-bold leading-4 text-white ring-2 ring-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={toggleSound}
                disabled={soundBusy}
                aria-pressed={soundOn}
                aria-label={soundOn ? 'Matikan suara pengingat' : 'Nyalakan suara pengingat'}
                title={soundBusy ? 'Tunggu nada selesai' : soundOn ? 'Matikan suara pengingat' : 'Nyalakan suara pengingat'}
                className={`${ICON_BUTTON_CLASS} ${soundOn ? 'border-bw-blue-200 bg-bw-blue-50 text-bw-blue' : ''} disabled:cursor-not-allowed disabled:opacity-40`}
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
            </div>
          )}

          {notifOpen && (
            <div
              role="dialog"
              aria-label="Notifikasi"
              className="absolute right-3 top-full z-20 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-bw-line bg-white shadow-xl"
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
                      className="text-[11px] font-semibold text-bw-blue transition-colors hover:underline focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
                    >
                      Tandai semua
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    aria-label="Tutup notifikasi"
                    className="grid h-6 w-6 place-items-center rounded text-bw-muted transition-colors hover:bg-bw-line hover:text-bw-ink focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
                  >
                    <IconClose className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-[55vh] overflow-y-auto overscroll-contain">
                {notifError && (
                  <p className="m-3 rounded-lg bg-bw-red-50 px-3 py-2 text-[11px] leading-relaxed text-bw-red">
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
                            <span className="mt-0.5 block whitespace-pre-line break-words text-[11px] leading-snug text-bw-muted">
                              {item.pesan}
                            </span>
                            <span className="mt-1 block text-[10px] text-bw-muted">
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
                  <p className="text-[11px] leading-snug text-bw-muted">
                    {pushOn
                      ? 'Notifikasi browser aktif.'
                      : 'Notifikasi browser masih nonaktif.'}
                  </p>
                  {!pushOn && (
                    <button
                      type="button"
                      onClick={handleEnablePush}
                      disabled={pushBusy}
                      className="shrink-0 rounded-lg bg-bw-blue px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-bw-blue-200 focus:outline-none focus:ring-2 focus:ring-bw-blue/40 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pushBusy ? 'Memproses...' : 'Aktifkan'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </header>

        <main
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain bg-bw-canvas px-4 ${
            showNav ? 'py-4' : 'py-6'
          }`}
        >
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>

        {showNav && (
          <nav className="safe-bottom shrink-0 border-t border-bw-line bg-white pt-1">
            <ul className="grid grid-cols-5">
              {navItems.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `${NAV_BASE} relative whitespace-nowrap ${
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
                        <span>{label}</span>
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
              className={`max-w-full rounded-xl px-3.5 py-2.5 text-center text-xs font-semibold leading-snug shadow-lg ring-1 ${
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
