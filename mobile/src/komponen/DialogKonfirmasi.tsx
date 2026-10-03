import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { Ikon } from './Ikon';

// Dialog konfirmasi yang mengikuti tema aplikasi.
//
// Dialog bawaan Alert tidak bisa memakai warna aplikasi, dan tombolnya terlalu
// kecil untuk jari. Apple HIG menyebut 44pt sebagai batas minimum, dan di sini
// dipakai 56 supaya aman di layar kecil pun.
//
// "Batal" diletakkan di kiri dengan gaya netral, sedangkan tombol tindakan
// berwarna mencolok di kanan. Selama proses berjalan (sibuk), dialog tidak
// bisa ditutup lewat ketukan latar atau tombol Back, supaya orang tidak
// mengira penghapusan dibatalkan padahal permintaannya sudah terkirim.

export function DialogKonfirmasi({
  terbuka,
  judul,
  pesan,
  labelBatal = 'Batal',
  labelSetuju = 'Hapus',
  sibuk = false,
  bahaya = true,
  onBatal,
  onSetuju,
}: {
  terbuka: boolean;
  judul: string;
  pesan: string;
  labelBatal?: string;
  labelSetuju?: string;
  sibuk?: boolean;
  /** true (bawaan): gaya merah untuk tindakan merusak. false: gaya biru. */
  bahaya?: boolean;
  onBatal: () => void;
  onSetuju: () => void;
}) {
  const tutup = () => {
    if (!sibuk) onBatal();
  };

  return (
    <Modal
      visible={terbuka}
      transparent
      animationType="fade"
      onRequestClose={tutup}
      statusBarTranslucent
    >
      <Pressable
        accessible={false}
        onPress={tutup}
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        className="flex-1 items-center justify-center px-6"
      >
        <Pressable
          accessibilityViewIsModal
          accessibilityRole="alert"
          className="w-full max-w-sm rounded-[28px] border border-bw-line bg-bw-card p-6"
          onPress={(peristiwa) => peristiwa.stopPropagation()}
        >
          <View className="items-center">
            <View
              className={`h-16 w-16 items-center justify-center rounded-full ${
                bahaya ? 'bg-bw-red-50' : 'bg-bw-blue-50'
              }`}
            >
              <Ikon
                nama={bahaya ? 'trash-outline' : 'help-circle-outline'}
                token={bahaya ? 'bw-red' : 'bw-blue'}
                ukuran={28}
              />
            </View>
            <Text className="mt-4 text-center text-lg font-extrabold leading-snug text-bw-ink">
              {judul}
            </Text>
            <Text className="mt-2 text-center text-sm leading-relaxed text-bw-muted">
              {pesan}
            </Text>
          </View>

          <View className="mt-6 flex-row gap-3">
            <TombolDialog
              label={labelBatal}
              onPress={onBatal}
              disabled={sibuk}
              className="flex-1 border border-bw-line bg-bw-surface"
            />
            <TombolDialog
              label={sibuk ? 'Memproses...' : labelSetuju}
              onPress={onSetuju}
              disabled={sibuk}
              memuat={sibuk}
              // Latar pekat, jadi teksnya putih. --bw-red-solid dikunci di
              // kedua tema supaya kontras ini selalu aman.
              tokenTeks="bw-solid-text"
              className={`flex-1 ${bahaya ? 'bg-bw-red-solid' : 'bg-bw-blue'}`}
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
  memuat = false,
  className = '',
  tokenTeks = 'bw-ink',
  onLongPress,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  memuat?: boolean;
  className?: string;
  tokenTeks?: keyof typeof GAYA_TEKS;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled), busy: memuat }}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      android_ripple={{ color: 'rgba(128,128,128,0.2)' }}
      className={`h-14 flex-row items-center justify-center gap-2 rounded-2xl active:opacity-80 ${
        disabled && !memuat ? 'opacity-50' : ''
      } ${className}`}
    >
      {memuat ? <ActivityIndicator size="small" color="#ffffff" /> : null}
      <Text className={`text-base font-bold ${GAYA_TEKS[tokenTeks]}`}>
        {label}
      </Text>
    </Pressable>
  );
}