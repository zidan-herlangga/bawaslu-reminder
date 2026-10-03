import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../../komponen/Ikon';
import { showToast } from '../../lib/toast';
import { useSesi } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { useTema, type PilihanTema } from '../../tema/TemaProvider';
import { mintaIzinNotifikasi } from '../../lib/notifikasi';

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

export default function LayarAkun() {
  const { session, keluar } = useSesi();
  const { pilihan, setPilihan } = useTema();

  const [profil, setProfil] = useState<Profil | null>(null);
  const [izinNotifikasi, setIzinNotifikasi] = useState<'belum' | 'ya' | 'tidak'>('belum');

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
    void cekIzinNotifikasi(setIzinNotifikasi);
  }, []);

  const mintaIzin = useCallback(async () => {
    const hasil = await mintaIzinNotifikasi();
    setIzinNotifikasi(hasil);

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

  return (
    <SafeAreaView className="flex-1 bg-bw-canvas" edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text className="text-xl font-bold text-bw-ink">Akun</Text>

        <View className="mt-4 items-center rounded-3xl border border-bw-line bg-bw-card p-5">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-bw-blue-50">
            <Text className="text-xl font-bold text-bw-blue-700">
              {inisial(profil?.nama_lengkap ?? session?.user.email)}
            </Text>
          </View>
          <Text className="mt-3 text-center text-base font-bold text-bw-ink">
            {profil?.nama_lengkap ?? 'Nama belum dilengkapi'}
          </Text>
          <Text className="mt-0.5 text-center text-sm text-bw-muted">
            {session?.user.email}
          </Text>
          {profil?.role_akses ? (
            <View className="mt-3 rounded-full bg-bw-surface px-3 py-1">
              <Text className="text-xs font-bold text-bw-ink-2">
                {profil.role_akses}
              </Text>
            </View>
          ) : null}
        </View>

        <Bagian judul="Tampilan">
          <PilihanTema
            nilai={pilihan}
            onPilih={(nilai) => setPilihan(nilai as PilihanTema)}
          />
        </Bagian>

        <Bagian judul="Notifikasi">
          <Baris
            ikon="notifications-outline"
            judul="Izin notifikasi"
            keterangan={
              izinNotifikasi === 'ya'
                ? 'Diizinkan'
                : izinNotifikasi === 'tidak'
                  ? 'Ditolak'
                  : 'Belum diminta'
            }
            onTekan={mintaIzin}
          />
          <Text className="mt-2 text-xs leading-relaxed text-bw-muted">
            Izin hanya diminta satu kali. Menolaknya berarti pengingat tidak akan
            sampai saat aplikasi ditutup.
          </Text>
        </Bagian>

        <Bagian judul="Aplikasi">
          <Baris ikon="information-circle-outline" judul="Versi" keterangan="1.0.0" />
          <Baris
            ikon="log-out-outline"
            judul="Keluar"
            keterangan="Hapus sesi dari perangkat"
            bahaya
            onTekan={konfirmasiKeluar}
          />
        </Bagian>
      </ScrollView>
    </SafeAreaView>
  );
}

function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <View className="mt-6">
      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-bw-muted">
        {judul}
      </Text>
      <View className="overflow-hidden rounded-3xl border border-bw-line bg-bw-card">
        {children}
      </View>
    </View>
  );
}

function Baris({
  ikon,
  judul,
  keterangan,
  onTekan,
  bahaya = false,
}: {
  ikon: Parameters<typeof Ikon>[0]['nama'];
  judul: string;
  keterangan: string;
  onTekan?: () => void;
  bahaya?: boolean;
}) {
  return (
    <Pressable
      onPress={onTekan}
      disabled={!onTekan}
      accessibilityRole={onTekan ? 'button' : 'text'}
      className="min-h-14 flex-row items-center gap-3 border-b border-bw-line px-4 py-3 active:opacity-70"
    >
      <Ikon
        nama={ikon}
        ukuran={20}
        token={bahaya ? 'bw-red' : 'bw-muted'}
      />
      <View className="min-w-0 flex-1">
        <Text
          className={`text-sm font-semibold ${bahaya ? 'text-bw-red' : 'text-bw-ink'}`}
        >
          {judul}
        </Text>
        <Text className="text-xs text-bw-muted">{keterangan}</Text>
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
  const opsi: { kunci: PilihanTema; label: string; ikon: 'sunny' | 'moon' | 'phone-portrait' }[] = [
    { kunci: 'terang', label: 'Terang', ikon: 'sunny' },
    { kunci: 'gelap', label: 'Gelap', ikon: 'moon' },
    { kunci: 'sistem', label: 'Sistem', ikon: 'phone-portrait' },
  ];

  return (
    <View className="flex-row gap-2 p-3">
      {opsi.map((opsi) => {
        const aktif = nilai === opsi.kunci;
        return (
          <Pressable
            key={opsi.kunci}
            onPress={() => onPilih(opsi.kunci)}
            accessibilityRole="radio"
            accessibilityState={{ selected: aktif }}
            className={`flex-1 items-center gap-1.5 rounded-2xl border py-3 active:opacity-70 ${
              aktif
                ? 'border-bw-blue bg-bw-blue-50'
                : 'border-bw-line bg-bw-surface'
            }`}
          >
            <Ikon
              nama={opsi.ikon}
              ukuran={20}
              token={aktif ? 'bw-blue' : 'bw-muted'}
            />
            <Text
              className={`text-xs font-bold ${aktif ? 'text-bw-blue-700' : 'text-bw-ink-2'}`}
            >
              {opsi.label}
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

async function cekIzinNotifikasi(
  ubah: (nilai: 'belum' | 'ya' | 'tidak') => void
): Promise<void> {
  try {
    const modul = await import('expo-notifications');
    const status = await modul.getPermissionsAsync();
    ubah(
      status.granted ? 'ya' : status.canAskAgain === false ? 'tidak' : 'belum'
    );
  } catch {
    ubah('belum');
  }
}
