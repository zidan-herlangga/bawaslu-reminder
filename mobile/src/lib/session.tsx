import type { AuthError, Session } from '@supabase/supabase-js';
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
// penjagaannya dilakukan tiap layar: layar masuk mengarahkan yang sudah punya
// sesi ke tab, dan layout tab mengarahkan yang belum punya sesi ke layar masuk.
// Hook ini hanya melaporkan apa yang terjadi, tanpa menyentuh navigasi.

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

/**
 * Menerjemahkan galat masuk dari Supabase menjadi kalimat yang berguna bagi
 * staf. Pencocokan memakai kode galat dan teks pesan, bukan status HTTP saja:
 * status 400 juga dipakai untuk kasus lain, misalnya email yang belum
 * dikonfirmasi, dan itu tidak boleh dibaca sebagai "kata sandi salah".
 */
function terjemahkanGalatMasuk(error: AuthError): string {
  const pesan = error.message.toLowerCase();
  const kode = (error as { code?: string }).code;

  if (kode === 'invalid_credentials' || pesan.includes('invalid login credentials')) {
    return 'Email atau kata sandi tidak cocok.';
  }

  if (kode === 'email_not_confirmed' || pesan.includes('email not confirmed')) {
    return 'Email belum dikonfirmasi. Hubungi administrator.';
  }

  if (error.status === 429 || kode === 'over_request_rate_limit') {
    return 'Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.';
  }

  if (pesan.includes('network') || pesan.includes('fetch')) {
    return 'Tidak bisa terhubung ke server. Periksa koneksi internet.';
  }

  return `Gagal masuk: ${error.message}`;
}

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
      setGalat(terjemahkanGalatMasuk(error));
      throw error;
    }
  }, []);

  const keluar = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) return;

    console.warn('[sesi] gagal keluar:', error.message);

    // Kalau server tidak terjangkau (mis. tanpa internet), pengguna tetap harus
    // bisa keluar dari perangkat ini. Hapus sesi lokal saja sebagai cadangan.
    const lokal = await supabase.auth.signOut({ scope: 'local' });
    if (lokal.error) {
      console.warn('[sesi] gagal menghapus sesi lokal:', lokal.error.message);
      setGalat(`Gagal keluar: ${lokal.error.message}`);
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