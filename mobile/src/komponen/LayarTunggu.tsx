import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from './Ikon';

// Layar menunggu dan pesan gagal.
//
// Dipisah dari route supaya /jadwal/baru dan /jadwal/[id] memakai tampilan yang
// sama untuk keadaan sedang memuat dan tidak punya akses.

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
        <TombolKembali label="Kembali" onTekan={onTutup} />
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
        <TombolKembali label="Kembali" onTekan={onTutup} utama />
      </View>
    </SafeAreaView>
  );
}

function TombolKembali({
  label,
  onTekan,
  utama = false,
}: {
  label: string;
  onTekan: () => void;
  utama?: boolean;
}) {
  const kelas = utama
    ? 'bg-bw-blue'
    : 'border border-bw-line bg-bw-card';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onTekan}
      className={`mt-2 h-14 items-center justify-center rounded-2xl px-6 active:opacity-80 ${kelas}`}
    >
      <Text className={`text-base font-bold ${utama ? 'text-white' : 'text-bw-ink-2'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
