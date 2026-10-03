import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FormJadwal, { type ProfilPembuat } from '../../komponen/FormJadwal';
import { Ikon } from '../../komponen/Ikon';
import { useSesi } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { formKosong, type FormJadwal as BentukForm } from '../../shared/validasiJadwal';

// Route tambah jadwal.
//
// Seluruh formulirnya ada di komponen FormJadwal, yang juga dipakai oleh
// layar ubah. Route ini hanya--|IThing ambil sesi, profil, lalu
// menyerahkan ke komponen.

export default function LayarBuatJadwal() {
  const router = useRouter();
  const { session, loading } = useSesi();
  const userId = session?.user.id ?? '';

  const [nilaiAwal, setNilaiAwal] = useState<BentukForm>(() => formKosong());
  const [profil, setProfil] = useState<ProfilPembuat>({
    namaLengkap: null,
    divisi: null,
  });
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    if (!userId) return;

    supabase
      .from('profiles')
      .select('nama_lengkap, divisi')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setProfil({
          namaLengkap: (data?.nama_lengkap as string | null) ?? null,
          divisi: (data?.divisi as string | null) ?? null,
        });
        setSiap(true);
      });
  }, [userId]);

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
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text className="text-center text-sm text-bw-muted">{pesan}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onTutup}
          className="h-14 items-center justify-center rounded-2xl border border-bw-line bg-bw-card px-5 active:opacity-80"
        >
          <Text className="text-base font-bold text-bw-ink-2">Kembali</Text>
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
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Ikon nama="alert-circle" token="bw-red" ukuran={36} />
        <Text className="text-center text-lg font-bold text-bw-ink">{judul}</Text>
        <Text className="text-center text-sm leading-relaxed text-bw-muted">
          {pesan}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onTutup}
          className="mt-2 h-14 items-center justify-center rounded-2xl bg-bw-blue px-6 active:opacity-80"
        >
          <Text className="text-base font-bold text-white">Kembali</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
