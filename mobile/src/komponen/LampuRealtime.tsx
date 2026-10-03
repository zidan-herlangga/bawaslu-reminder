import { Text, View } from 'react-native';
import { Ikon, type NamaIkon } from './Ikon';

// Lampu kecil yang menunjukkan apakah realtime benar-benar hidup.
//
// Kenapa perlu ada di layar: kalau tabelnya tidak terdaftar di publication
// supabase_realtime, channel tetap bilang SUBSCRIBED dan tidak ada error
// apa pun. Daftarnya tetap bergerak karena ada polling sebagai jaring
// pengaman, jadi dari sisi pemakaian aplikasi ini terlihat normal saja.
//
// Tanpa lampu ini, satu-satunya cara tahu apakah realtime-nya hidup adalah
// dengan mengubah data dari akun lain dan memperhatikan kecepatan. Jadi
// statusnya ditampilkan, apa adanya.
//
// Kata-katanya sengaja jujur. "Sinkron berkala" bukan berarti gagal total:
// polling tetap jalan, hanya jeda lebih lama.

export function LampuRealtime({ terhubung }: { terhubung: boolean }) {
  const warna = terhubung ? 'bg-bw-green-500' : 'bg-bw-amber-500';
  const ikon: NamaIkon = terhubung ? 'flash' : 'cloud-offline-outline';
  const teks = terhubung ? 'Realtime aktif' : 'Sinkron berkala';

  return (
    <View className="mt-2 flex-row items-center gap-1.5">
      <View className={`h-2 w-2 rounded-full ${warna}`} />
      <Ikon
        nama={ikon}
        token={terhubung ? 'bw-green-500' : 'bw-amber-500'}
        ukuran={12}
      />
      <Text className="text-xs text-bw-muted">{teks}</Text>
    </View>
  );
}