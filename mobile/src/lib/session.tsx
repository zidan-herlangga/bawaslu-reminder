import type { AuthError, Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Linking from 'expo-linking';
import { pesanGalatAuth } from '../shared/daftar';
import { supabase } from './supabase';
import type { HasilDaftar, NilaiPendaftaranTanpaSandi } from '../shared/daftar';

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
  daftar: (nilai: NilaiPendaftaranTanpaSandi) => Promise<HasilDaftar>;
  kirimTautanAturUlang: (email: string) => Promise<void>;
  aturSandiBaru: (sandi: string) => Promise<void>;
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

  /**
   * Membuat akun baru, lalu menulis baris profilnya.
   *
   * Dua langkah, bukan satu, dan urutannya penting: profil baru hanya boleh
   * ditulis kalau akunnya benar-benar jadi. Kalau dibalik, bisa ada baris
   * profiles untuk orang yang tidak punya akun.
   *
   * "Kembalikan tanpa sesi" berarti signUp tidak mengembalikan sesi, yaitu
   * Confirm email masih aktif di Supabase. Kasus itu dikembalikan sebagai
   * nilai, bukan dilempar, supaya layar bisa menampilkan petunjuk cara
   * memperbaikinya.
   */
  const daftar = useCallback(
    async (nilai: NilaiPendaftaranTanpaSandi): Promise<HasilDaftar> => {
      setGalat('');

      const { data, error } = await supabase.auth.signUp({
        email: nilai.email,
        password: nilai.sandi,
        options: {
          data: {
            nama_lengkap: nilai.namaLengkap,
            divisi: nilai.divisi,
            jabatan: nilai.jabatan,
          },
        },
      });

      if (error) throw error;
      if (!data.user) return { ok: false, sebab: 'tidak-ada-pengguna' };

      // Confirm email masih aktif: akun sudah dibuat tapi belum bisa dipakai.
      // Menulis profil di sini akan ditolak RLS karena belum ada sesi.
      if (!data.session) {
        return { ok: false, sebab: 'butuh-konfirmasi-email' };
      }

      const { error: galatProfil } = await supabase.from('profiles').insert({
        id: data.user.id,
        nama_lengkap: nilai.namaLengkap,
        email: nilai.email,
        divisi: nilai.divisi,
        jabatan: nilai.jabatan,
        role_akses: 'Staf',
        status_akun: 'Aktif',
      });

      if (galatProfil) return { ok: false, sebab: 'profil-gagal' };

      return { ok: true };
    },
    []
  );

  /**
   * Meminta Supabase mengirim tautan atur ulang kata sandi.
   *
   * redirectTo memakai skema aplikasi, bukan alamat web, supaya tautannya
   * membuka aplikasi ini di perangkat. Skemanya diambil dari app.json:
   * bawaslu-jadwal, dari app.json. authorities=reset-password menunjuk route
   * menerima tautan itu.
   */
  const kirimTautanAturUlang = useCallback(async (email: string) => {
    setGalat('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: Linking.createURL('reset-password'),
    });

    if (error) {
      setGalat(pesanGalatAuth(error));
      throw error;
    }
  }, []);

  /**
   * Menyimpan kata sandi baru setelah tautan atur ulang dibuka.
   */
  const aturSandiBaru = useCallback(async (sandi: string) => {
    setGalat('');

    const { error } = await supabase.auth.updateUser({ password: sandi });

    if (error) {
      setGalat(pesanGalatAuth(error));
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
    () => ({
      session,
      loading,
      masuk,
      daftar,
      keluar,
      kirimTautanAturUlang,
      aturSandiBaru,
      galat,
      hapusGalat,
    }),
    [session, loading, masuk, daftar, keluar, kirimTautanAturUlang, aturSandiBaru, galat, hapusGalat]
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