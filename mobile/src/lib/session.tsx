import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from './supabase';

// Sesi masuk, mengikuti pola src/hooks/useSession.js di web.
//
// Bedanya: di web perpindahan halaman ditangani router, sedangkan di native
// yang mengarahkan ke layar masuk adalah layout di src/app/_layout.tsx. Hook
// ini hanya melaporkan apa yang terjadi, tanpa menyentuh navigasi.

export interface NilaiSesi {
  session: Session | null;
  loading: boolean;
  masuk: (email: string, password: string) => Promise<void>;
  keluar: () => Promise<void>;
  /** Pesan galat terakhir, dibersihkan setelah dibaca. */
  galat: string;
  hapusGalat: () => void;
}

const KonteksSesi = createContext<NilaiSesi | null>(null);

export function SesiProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    let aktif = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!aktif) return;
        if (error) {
          console.warn('[sesi] gagal membaca sesi:', error.message);
        }
        setSession(data.session);
      })
      .catch((error) => {
        console.warn('[sesi] gagal membaca sesi:', error?.message);
      })
      .finally(() => {
        if (aktif) setLoading(false);
      });

    const { data: langganan } = supabase.auth.onAuthStateChange(
      (_peristiwa, sesiBerikutnya) => {
        setSession(sesiBerikutnya);
        setLoading(false);
      }
    );

    return () => {
      aktif = false;
      langganan.subscription.unsubscribe();
    };
  }, []);

  const masuk = useCallback(async (email: string, password: string) => {
    setGalat('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Pesan dari Supabase dalam bahasa Inggris dan cukup teknis. Yang lebih
      // berguna bagi staf adalah menyebut kredensialnya secara langsung.
      const salahSandi =
        error.message.toLowerCase().includes('invalid login credentials') ||
        error.status === 400;

      setGalat(
        salahSandi
          ? 'Email atau kata sandi tidak cocok.'
          : `Gagal masuk: ${error.message}`
      );
      throw error;
    }
  }, []);

  const keluar = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn('[sesi] gagal keluar:', error.message);
      setGalat(`Gagal keluar: ${error.message}`);
    }
  }, []);

  const hapusGalat = useCallback(() => setGalat(''), []);

  const nilai = useMemo<NilaiSesi>(
    () => ({ session, loading, masuk, keluar, galat, hapusGalat }),
    [session, loading, masuk, keluar, galat, hapusGalat]
  );

  return <KonteksSesi.Provider value={nilai}>{children}</KonteksSesi.Provider>;
}

export function useSesi(): NilaiSesi {
  const nilai = useContext(KonteksSesi);
  if (!nilai) {
    throw new Error('useSesi harus dipakai di dalam SesiProvider.');
  }
  return nilai;
}
