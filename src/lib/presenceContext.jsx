import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import fetchProfile from '../lib/fetchProfile';
import usePresence from '../hooks/usePresence';

// Presence harus hidup selama aplikasi terbuka, bukan hanya di satu halaman.
// Kalau hook-nya dipanggil di dalam satu komponen halaman, channel ikut mati
// begitu pengguna pindah halaman dan daftarnya langsung kosong.
//
// Karena itu hook-nya dijalankan satu kali di provider, lalu hasilnya dibaca
// semua halaman lewat usePresenceList(). Provider ini dipasang di AppShell
// yang tidak pernah dilepas saat rute berganti.

const PresenceContext = createContext({
  daftar: [],
  terhubung: false,
  jumlah: 0,
  profile: null,
});

export function PresenceProvider({ session, children }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return undefined;
    }

    let active = true;
    void fetchProfile(session).then((data) => {
      if (active) setProfile(data);
    });

    return () => {
      active = false;
    };
  }, [session]);

  const { daftar, terhubung, jumlah } = usePresence(session, profile);

  const nilai = useMemo(
    () => ({ daftar, terhubung, jumlah, profile }),
    [daftar, terhubung, jumlah, profile]
  );

  return <PresenceContext.Provider value={nilai}>{children}</PresenceContext.Provider>;
}

export function usePresenceList() {
  return useContext(PresenceContext);
}