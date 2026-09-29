import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import useSession from '../hooks/useSession';
import { isSoundEnabled, playChime, setSoundEnabled, subscribeSound } from '../lib/sound';

const APP_PATHS = ['/', '/kalender', '/jadwal/baru', '/akun'];

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

function IconUser({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8.25" r="3.75" />
      <path strokeLinecap="round" d="M4.5 20.25c0-3.45 3.36-5.625 7.5-5.625s7.5 2.175 7.5 5.625" />
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

  const inApp = APP_PATHS.includes(location.pathname);
  const showNav = Boolean(session) && inApp;

  useEffect(() => subscribeSound(setSoundOn), []);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    if (next) playChime();
  };

  const navItems = [
    { to: '/', label: 'Beranda', icon: IconHome, end: true },
    { to: '/kalender', label: 'Kalender', icon: IconCalendar, end: false },
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

        <header className="flex shrink-0 justify-between items-center gap-3 border-b border-bw-line bg-white px-4 py-3">
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
                onClick={toggleSound}
                aria-pressed={soundOn}
                aria-label={soundOn ? 'Matikan suara pengingat' : 'Nyalakan suara pengingat'}
                title={soundOn ? 'Matikan suara pengingat' : 'Nyalakan suara pengingat'}
                className={`${ICON_BUTTON_CLASS} ${soundOn ? 'border-bw-blue-200 bg-bw-blue-50 text-bw-blue' : ''}`}
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
            <ul className="grid grid-cols-4">
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
      </div>
    </div>
  );
}
