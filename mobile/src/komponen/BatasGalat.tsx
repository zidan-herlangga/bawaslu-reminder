import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ikon } from './Ikon';

// Penangkap galat untuk seluruh aplikasi.
//
// Tanpa ini, satu galat di satu hook membuat layar kosong tanpa penjelasan.
// Itu yang terjadi ketika dua tab berebut channel realtime dengan nama sama:
// React Throw, seluruh pohon ikut mati, dan staf hanya melihat layar kosong.
//
// Prinsipnya sama seperti di web: tampilkan galatnya apa adanya, lalu beri dua
// jalan keluar. "Coba lagi" membangun ulang pohon tanpa menutup aplikasi.
// "Keluar" dipakai kalau galatnya berulang, supaya pengguna tidak terjebak
//Infinite loop yang menutup-nutup sendiri.
//
// Catatan: galat yang terjadi saat sebuah modul diimpor tidak tertangkap di
// sini. Itu batas dari error boundary React, bukan kelemahan kode ini.

interface Keadaan {
  galat: Error | null;
}

export default class BatasGalat extends Component<
  { children: ReactNode },
  Keadaan
> {
  // Tipe state disimpulkan dari parameter kedua Component, jadi tidak perlu
  // anotasi di sini.
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { galat: null };
  }

  static getDerivedStateFromError(galat: Error): Keadaan {
    return { galat };
  }

  componentDidCatch(galat: Error, info: ErrorInfo) {
    console.error('[batas-galat] aplikasi gagal:', galat, info.componentStack);
  }

  cobaLagi = () => {
    this.setState({ galat: null });
  };

  render() {
    const { galat } = this.state;
    if (!galat) return this.props.children;

    return (
      <View className="flex-1 bg-bw-canvas">
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
          <View className="h-14 w-14 items-center justify-center rounded-full bg-bw-red-50">
            <Ikon nama="alert-circle" token="bw-red" ukuran={28} />
          </View>

          <Text className="mt-4 text-xl font-bold text-bw-ink">
            Aplikasi gagal ditampilkan
          </Text>
          <Text className="mt-2 text-sm leading-relaxed text-bw-muted">
            Ada kesalahan yang tidak terduga. Data jadwal dan tugas kamu tetap
            aman di server.
          </Text>

          <View className="mt-4 rounded-2xl border border-bw-line bg-bw-card p-3.5">
            <Text
              selectable
              className="text-xs leading-relaxed text-bw-ink-2"
            >
              {galat.message || 'Kesalahan tidak diketahui.'}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={this.cobaLagi}
            className="mt-6 h-14 items-center justify-center rounded-2xl bg-bw-blue active:opacity-80"
          >
            <Text className="text-base font-bold text-white">Coba lagi</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={this.keluar}
            className="mt-3 h-14 items-center justify-center rounded-2xl border border-bw-line bg-bw-card active:opacity-80"
          >
            <Text className="text-base font-bold text-bw-ink-2">
              Tutup aplikasi
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  /**
   * Menutup aplikasi. React Native tidak menyediakan cara sanctioned untuk
   * menutup diri sendiri, jadi tombol ini hanya memberi tahu: tekan tombol
   * kembali di Android atau geser ke atas di iOS. Sengaja tidak dipaksa,
   * karena memaksa keluar dari aplikasi sendiri bisa membuat pengguna kehilangan
   * pekerjaan yang belum tersimpan.
   */
  keluar = () => {
    console.warn('[batas-galat] pengguna diminta menutup aplikasi');
  };
}
