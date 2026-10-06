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
import { daftarTokenPushDenganUlang } from './notifikasi';
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
  /**
   * Divisi staf ini, atau null kalau belum diketahui.
   *
   * Dipakai untuk menyaring pengingat: jadwal yang menyasar divisi lain bukan
   * urusan staf ini. Dimuat sekali di sini, bukan di tiap layar yang butuh,
   * karena berkasnya satu dan semua pemanggil harus melihat nilai yang sama.
   * Selama null, pengingat tetap ditampilkan: lebih baik satu pengingat yang
   * mungkin tidak relevan daripada jadwal yang terlewat tanpa jejak.
   */
  divisi: string | null;
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
  // Hasil pembacaan profil beserta pemiliknya. Disimpan berpasangan supaya nilai
  // yang tertinggal dari sesi sebelumnya bisa dibuang tanpa menulis state lagi.
  const [pembacaanDivisi, setPembacaanDivisi] = useState<{
    userId: string;
    divisi: string | null;
  } | null>(null);

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

  // Registrasi push dijalankan setiap kali sesi muncul, bukan hanya ketika
  // layar Akun dibuka.
  //
  // Sebelumnya satu-satunya pemanggil ada di tab Akun. Akibatnya perangkat tidak
  // pernah mendaftar push kecuali staf membuka layar itu: server tidak punya
  // token, jadi tidak ada pesan yang bisa dikirim, dan tidak ada satu pun pesan
  // galat yang menunjukkan hal ini karena pendaftarannya tidak pernah dijalankan
  // sama sekali.
  //
  // Token perangkat tidak berubah antar sesi, jadi efek ini berjalan saat sesi
  // ditemukan, bukan tiap render. Kegagalannya ditelan sebagai false: server
  // yang tidak punya token tidak menghalangi staf bekerja, dan percobaan
  // berikutnya tetap jalan saat aplikasi dibuka lagi.
  //
  // Fungsi ini sengaja dipakai di sini dan dibiarkan juga di tab Akun: kalau
  // startup gagal karena jaringan, kunjungan ke Akun memberi satu percobaan
  // lain tanpa harus menutup aplikasi.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    void daftarTokenPushDenganUlang(userId);
  }, [session?.user?.id]);

  // Divisi dibaca terpisah dari sesi karena ada di profiles, bukan auth.users.
  // Dipakai hanya untuk menyaring pengingat; kegagalan membacanya tidak boleh
  // mengeluarkan staf dari aplikasi, jadi nilainya dibiarkan null.
  //
  // Yang disimpan adalah hasil pembacaan beserta userId-nya, bukan divisi polos.
  // Dengan begitu divisi bisa diturunkan saat render: ketika staf keluar, nilai
  // lamanya otomatis tidak berlaku karena userId-nya tidak lagi cocok. Kalau
  // divisi polos yang disimpan, pengosongannya harus lewat setState sinkron di
  // dalam efek, dan itu memicu render berantai.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    let aktif = true;

    void supabase
      .from('profiles')
      .select('divisi')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!aktif) return;
        if (error) {
          console.warn('[sesi] gagal membaca divisi:', error.message);
          return;
        }
        const nilai = (data as { divisi?: string | null } | null)?.divisi ?? null;
        setPembacaanDivisi({
          userId,
          divisi: nilai && nilai.trim() ? nilai.trim() : null,
        });
      });

    return () => {
      aktif = false;
    };
  }, [session?.user?.id]);

  // Hanya berlaku untuk staf yang sedang masuk. Divisi yang tertinggal dari sesi
  // sebelumnya tidak boleh ikut dipakai menyaring pengingat.
  const divisi =
    pembacaanDivisi && pembacaanDivisi.userId === session?.user?.id
      ? pembacaanDivisi.divisi
      : null;

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
      divisi,
    }),
    [session, loading, masuk, daftar, keluar, kirimTautanAturUlang, aturSandiBaru, galat, hapusGalat, divisi]
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