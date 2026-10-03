import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FormJadwal, { type ProfilPembuat } from '../../komponen/FormJadwal';
import { Ikon } from '../../komponen/Ikon';
import { useSesi } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { formKosong, type FormJadwal as BentukForm } from '../../shared/validasiJadwal';

// Route tambah jadwal.
//
// Seluruh formulirnya ada di komponen FormJadwal, yang juga dipakai oleh
// layar ubah. Route ini hanya mengambil sesi dan profil, lalu menyerahkannya
// ke komponen tersebut.

export default function LayarBuatJadwal() {
  const router = useRouter();
  const { session, loading } = useSesi();
  const userId = session?.user.id ?? '';

  const [nilaiAwal] = useState<BentukForm>(() => formKosong());
  const [profil, setProfil] = useState<ProfilPembuat>({
    namaLengkap: null,
    divisi: null,
  });
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    if (!userId) return undefined;

    // Mencegah setState setelah layar ditutup sebelum profil selesai dimuat.
    let dibatalkan = false;

    supabase
      .from('profiles')
      .select('nama_lengkap, divisi')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (dibatalkan) return;
        setProfil({
          namaLengkap: (data?.nama_lengkap as string | null) ?? null,
          divisi: (data?.divisi as string | null) ?? null,
        });
        setSiap(true);
      });

    return () => {
      dibatalkan = true;
    };
  }, [userId]);

  // Tanpa sesi, profil tidak akan pernah dimuat. Tanpa cabang ini layar akan
  // menampilkan "Menyiapkan formulir..." selamanya.
  if (!loading && !session) {
    return (
      <LayarGalat
        judul="Sesi tidak ditemukan"
        pesan="Silakan masuk kembali untuk membuat jadwal."
        onTutup={() => router.back()}
      />
    );
  }

  if (loading || !siap) {
    return (
      <LayarTunggu
        pesan="Menyiapkan formulir..."
        onTutup={() => router.back()}
      />
    );
  }

  return (
    <FormJadwal
      mode="buat"
      nilaiAwal={nilaiAwal}
      userId={userId}
      email={session?.user.email ?? null}
      profil={profil}
      onTutup={() => router.back()}
      onSelesai={() => router.back()}
    />
  );
}

export function LayarTunggu({
  pesan,
  onTutup,
}: {
  pesan: string;
  onTutup: () => void;
}) {
  return (
    <SafeAreaView className="flex-1 bg-bw-canvas" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center px-8">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-bw-blue-50">
          <ActivityIndicator size="large" color="#0071e3" />
        </View>
        <Text className="mt-5 text-center text-base font-bold text-bw-ink">
          {pesan}
        </Text>
        <Text className="mt-1.5 text-center text-xs leading-relaxed text-bw-muted">
          Mohon tunggu sebentar.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={onTutup}
          android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
          className="mt-8 h-12 flex-row items-center justify-center gap-1.5 rounded-full border border-bw-line bg-bw-card px-6 active:opacity-70"
        >
          <Ikon nama="chevron-back" token="bw-ink-2" ukuran={16} />
          <Text className="text-sm font-bold text-bw-ink-2">Kembali</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function LayarGalat({
  judul,
  pesan,
  onTutup,
}: {
  judul: string;
  pesan: string;
  onTutup: () => void;
}) {
  return (
    <SafeAreaView className="flex-1 bg-bw-canvas" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center px-8">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-bw-red-50">
          <Ikon nama="alert-circle" token="bw-red" ukuran={40} />
        </View>
        <Text className="mt-5 text-center text-xl font-extrabold text-bw-ink">
          {judul}
        </Text>
        <Text className="mt-2 text-center text-sm leading-relaxed text-bw-muted">
          {pesan}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={onTutup}
          android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
          className="mt-8 h-14 w-full max-w-xs items-center justify-center rounded-2xl bg-bw-blue active:opacity-80"
        >
          <Text className="text-base font-bold text-white">Kembali</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}