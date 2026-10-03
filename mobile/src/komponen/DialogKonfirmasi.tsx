import { Modal, Pressable, Text, View } from 'react-native';
import { Ikon } from './Ikon';

// Dialog konfirmasi yang mengikuti tema aplikasi.
//
// Dialog bawaan Alert tidak bisa memakai warna aplikasi, dan tombolnya terlalu
// kecil untuk jari:_context Apple HIG menyebut 44pt sebagai batas minimum,
// dan di sini dipakai 56px supaya aman di layar kecil pun tidak meleset.
//
// "Batal" diletakkan lebih dulu secara visual dan diberi gaya netral, supaya
  // tindakan paling aman adalah yang paling mudah tidak sengaja terpilih.

export function DialogKonfirmasi({
  terbuka,
  judul,
  pesan,
  labelBatal = 'Batal',
  labelSetuju = 'Hapus',
  sibuk = false,
  onBatal,
  onSetuju,
}: {
  terbuka: boolean;
  judul: string;
  pesan: string;
  labelBatal?: string;
  labelSetuju?: string;
  sibuk?: boolean;
  onBatal: () => void;
  onSetuju: () => void;
}) {
  return (
    <Modal
      visible={terbuka}
      transparent
      animationType="fade"
      onRequestClose={onBatal}
      statusBarTranslucent
    >
      <Pressable
        className="flex-1 items-center justify-center bg-bw-ink/45 px-5"
        onPress={onBatal}
      >
        <Pressable
          accessibilityViewIsModal
          accessibilityRole="alert"
          className="w-full max-w-sm rounded-3xl border border-bw-line bg-bw-card p-5"
          onPress={(peristiwa) => peristiwa.stopPropagation()}
        >
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bw-red-50">
              <Ikon nama="alert-circle" token="bw-red" ukuran={22} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-base font-bold leading-snug text-bw-ink">
                {judul}
              </Text>
              <Text className="mt-1 text-sm leading-relaxed text-bw-muted">
                {pesan}
              </Text>
            </View>
          </View>

          <View className="mt-5 flex-row gap-2">
            <TombolDialog
              label={labelBatal}
              onPress={onBatal}
              className="flex-1 border border-bw-line bg-bw-card"
            />
            <TombolDialog
              label={sibuk ? 'Memproses...' : labelSetuju}
              onPress={onSetuju}
              disabled={sibuk}
              // Tombol destruktif memakai latar merah pekat, jadi teksnya
              // harus putih. --bw-red-solid sengaja dikunci di kedua tema
              // supaya kontras ini selalu aman.
              tokenTeks="bw-solid-text"
              className="flex-1 bg-bw-red-solid"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Peta statis, bukan kelas yang dirangkai. Tailwind dan NativeWind membaca
// kelas saat build, jadi 'text-' + namaToken tidak akan pernah menghasilkan
// gaya apa pun.
const GAYA_TEKS: Record<'bw-ink' | 'bw-solid-text' | 'bw-muted', string> = {
  'bw-ink': 'text-bw-ink',
  'bw-solid-text': 'text-bw-solid-text',
  'bw-muted': 'text-bw-muted',
};

export function TombolDialog({
  label,
  onPress,
  disabled,
  className = '',
  tokenTeks = 'bw-ink',
  onLongPress,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
  tokenTeks?: keyof typeof GAYA_TEKS;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      className={`h-14 items-center justify-center rounded-xl active:opacity-80 ${
        disabled ? 'opacity-50' : ''
      } ${className}`}
    >
      <Text className={`text-base font-bold ${GAYA_TEKS[tokenTeks]}`}>
        {label}
      </Text>
    </Pressable>
  );
}
