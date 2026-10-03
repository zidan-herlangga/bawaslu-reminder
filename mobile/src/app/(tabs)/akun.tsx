import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../../komponen/Ikon';
import { showToast } from '../../lib/toast';
import { useSesi } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { useTema, type PilihanTema } from '../../tema/TemaProvider';
import {
  alasanTidakBisaDipakai,
  cekIzinNotifikasi,
  mintaIzinNotifikasi,
  pesanStatus,
  type StatusNotifikasi,
} from '../../lib/notifikasi';

// Akun: profil, tema, dan notifikasi.
//
// Kehilangan layar Daftar dan Lupa Kata Sandi disengaja. Di web keduanya perlu
// karena tautan Supabase dibuka di peramban; di native tautan itu ditangani
// sistem lewat deep link, jadi tidak perlu layar tersendiri. Membuat ulang
// layar yang tidak pernah dipakai hanya menambah tempat untuk diperawat.

interface Profil {
  nama_lengkap: string | null;
  jabatan: string | null;
  divisi: string | null;
  role_akses: string | null;
}

type NamaIkon = Parameters<typeof Ikon>[0]['nama'];

export default function LayarAkun() {
  const { session, keluar } = useSesi();
  const { pilihan, setPilihan } = useTema();

  const [profil, setProfil] = useState<Profil | null>(null);
  const [izinNotifikasi, setIzinNotifikasi] = useState<StatusNotifikasi>('belum');

  useEffect(() => {
    if (!session) return;

    supabase
      .from('profiles')
      .select('nama_lengkap, jabatan, divisi, role_akses')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.warn('[akun] gagal memuat profil:', error.message);
          return;
        }
        setProfil(data as Profil | null);
      });
  }, [session]);

  useEffect(() => {
    // Memakai fungsi dari lib/notifikasi, bukan pemeriksaan sendiri di sini.
    // Fungsi itu tahu kapan lingkungan ini tidak mendukung notifikasi, sehingga
    // tidak pernah menyentuh expo-notifications di Expo Go Android.
    void cekIzinNotifikasi().then(setIzinNotifikasi);
  }, []);

  const mintaIzin = useCallback(async () => {
    const hasil = await mintaIzinNotifikasi();
    setIzinNotifikasi(hasil);

    if (hasil === 'ekspo-go') {
      showToast(
        'Notifikasi butuh development build. Di Expo Go bagian ini tidak tersedia.',
        'info'
      );
      return;
    }

    if (hasil === 'tidak') {
      showToast(
        'Izin notifikasi ditolak. Aktifkan dari pengaturan sistem, bukan dari aplikasi.',
        'galat'
      );
      return;
    }

    if (hasil === 'ya') {
      showToast('Notifikasi diizinkan.', 'sukses');
      return;
    }

    showToast('Izin notifikasi belum diberikan.', 'info');
  }, []);

  const konfirmasiKeluar = useCallback(() => {
    Alert.alert('Keluar dari aplikasi?', 'Sesi akan dihapus dari perangkat ini.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: () => {
          void keluar();
        },
      },
    ]);
  }, [keluar]);

  const subjudulProfil = [profil?.jabatan, profil?.divisi].filter(Boolean).join(' · ');

  return (
    <SafeAreaView className="flex-1 bg-bw-canvas" edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }}
      >
        <Text className="text-3xl font-extrabold tracking-tight text-bw-ink">Akun</Text>
        <Text className="mt-1 text-sm text-bw-muted">
          Kelola profil, tampilan, dan notifikasi.
        </Text>

        {/* Kartu profil */}
        <View className="mt-5 overflow-hidden rounded-[28px] border border-bw-line bg-bw-card">
          <View className="h-20 bg-bw-blue-50" />
          <View className="-mt-10 items-center px-5 pb-6">
            <View className="h-20 w-20 items-center justify-center rounded-full border-4 border-bw-card bg-bw-blue">
              <Text className="text-2xl font-extrabold text-white">
                {inisial(profil?.nama_lengkap ?? session?.user.email)}
              </Text>
            </View>

            <Text className="mt-3 text-center text-lg font-bold text-bw-ink">
              {profil?.nama_lengkap ?? 'Nama belum dilengkapi'}
            </Text>
            <Text className="mt-0.5 text-center text-sm text-bw-muted">
              {session?.user.email}
            </Text>

            {subjudulProfil ? (
              <Text className="mt-1 text-center text-xs text-bw-muted">
                {subjudulProfil}
              </Text>
            ) : null}

            {profil?.role_akses ? (
              <View className="mt-3 rounded-full bg-bw-blue-50 px-3.5 py-1.5">
                <Text className="text-xs font-bold uppercase tracking-wide text-bw-blue-700">
                  {profil.role_akses}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <Bagian judul="Tampilan">
          <PilihanTema
            nilai={pilihan}
            onPilih={(nilai) => setPilihan(nilai as PilihanTema)}
          />
        </Bagian>

        <Bagian
          judul="Notifikasi"
          catatan={
            izinNotifikasi === 'ekspo-go'
              ? alasanTidakBisaDipakai() ??
                'Notifikasi tidak tersedia di lingkungan ini.'
              : 'Izin hanya diminta satu kali. Menolaknya berarti pengingat tidak akan sampai saat aplikasi ditutup.'
          }
        >
          <Baris
            ikon="notifications-outline"
            judul="Izin notifikasi"
            keterangan={pesanStatus(izinNotifikasi)}
            onTekan={izinNotifikasi === 'ekspo-go' ? undefined : mintaIzin}
            terakhir
          />
        </Bagian>

        <Bagian judul="Aplikasi">
          <Baris ikon="information-circle-outline" judul="Versi" keterangan="1.0.0" />
          <Baris
            ikon="log-out-outline"
            judul="Keluar"
            keterangan="Hapus sesi dari perangkat"
            bahaya
            onTekan={konfirmasiKeluar}
            terakhir
          />
        </Bagian>
      </ScrollView>
    </SafeAreaView>
  );
}

function Bagian({
  judul,
  catatan,
  children,
}: {
  judul: string;
  catatan?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-7">
      <Text className="mb-2 ml-1 text-xs font-bold uppercase tracking-widest text-bw-muted">
        {judul}
      </Text>
      <View className="overflow-hidden rounded-3xl border border-bw-line bg-bw-card">
        {children}
      </View>
      {catatan ? (
        <Text className="ml-1 mt-2 text-xs leading-relaxed text-bw-muted">{catatan}</Text>
      ) : null}
    </View>
  );
}

function Baris({
  ikon,
  judul,
  keterangan,
  onTekan,
  bahaya = false,
  terakhir = false,
}: {
  ikon: NamaIkon;
  judul: string;
  keterangan: string;
  onTekan?: () => void;
  bahaya?: boolean;
  terakhir?: boolean;
}) {
  return (
    <Pressable
      onPress={onTekan}
      disabled={!onTekan}
      accessibilityRole={onTekan ? 'button' : 'text'}
      android_ripple={onTekan ? { color: 'rgba(0,0,0,0.06)' } : undefined}
      className={`min-h-16 flex-row items-center gap-3.5 px-4 py-3 active:opacity-70 ${
        terakhir ? '' : 'border-b border-bw-line'
      }`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-2xl bg-bw-surface">
        <Ikon nama={ikon} ukuran={20} token={bahaya ? 'bw-red' : 'bw-blue'} />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className={`text-[15px] font-semibold ${bahaya ? 'text-bw-red' : 'text-bw-ink'}`}
        >
          {judul}
        </Text>
        <Text className="mt-0.5 text-xs text-bw-muted">{keterangan}</Text>
      </View>
      {onTekan ? <Ikon nama="chevron-forward" ukuran={16} token="bw-muted" /> : null}
    </Pressable>
  );
}

function PilihanTema({
  nilai,
  onPilih,
}: {
  nilai: PilihanTema;
  onPilih: (nilai: string) => void;
}) {
  const daftar: { kunci: PilihanTema; label: string; ikon: 'sunny' | 'moon' | 'phone-portrait' }[] = [
    { kunci: 'terang', label: 'Terang', ikon: 'sunny' },
    { kunci: 'gelap', label: 'Gelap', ikon: 'moon' },
    { kunci: 'sistem', label: 'Sistem', ikon: 'phone-portrait' },
  ];

  return (
    <View
      accessibilityRole="radiogroup"
      className="flex-row gap-2 p-3"
    >
      {daftar.map((item) => {
        const aktif = nilai === item.kunci;
        return (
          <Pressable
            key={item.kunci}
            onPress={() => onPilih(item.kunci)}
            accessibilityRole="radio"
            accessibilityState={{ selected: aktif }}
            className={`flex-1 items-center gap-2 rounded-2xl border-2 py-3.5 active:opacity-70 ${
              aktif ? 'border-bw-blue bg-bw-blue-50' : 'border-transparent bg-bw-surface'
            }`}
          >
            <Ikon
              nama={item.ikon}
              ukuran={22}
              token={aktif ? 'bw-blue' : 'bw-muted'}
            />
            <Text
              className={`text-xs font-bold ${aktif ? 'text-bw-blue-700' : 'text-bw-ink-2'}`}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function inisial(nama: string | null | undefined): string {
  if (!nama) return '?';
  const bagian = nama.trim().split(/\s+/).slice(0, 2);
  return bagian.map((kata) => kata.charAt(0).toUpperCase()).join('');
}