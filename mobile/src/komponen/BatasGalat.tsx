import { Ionicons } from '@expo/vector-icons';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  Appearance,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Penangkap galat untuk seluruh aplikasi.
//
// Tanpa ini, satu galat di satu hook membuat layar kosong tanpa penjelasan.
// Itu yang terjadi ketika dua tab berebut channel realtime dengan nama sama:
// React melempar galat, seluruh pohon ikut mati, dan staf hanya melihat layar
// kosong.
//
// Prinsipnya sama seperti di web: tampilkan galatnya apa adanya, lalu beri dua
// jalan keluar. "Coba lagi" membangun ulang pohon tanpa menutup aplikasi.
// "Tutup aplikasi" dipakai kalau galatnya berulang, supaya pengguna tidak
// terjebak dalam siklus coba-gagal-coba.
//
// Layar galat sengaja TIDAK memakai token tema (bw-*) dan komponen Ikon.
// Pembungkus vars() dari NativeWind dipasang di dalam pohon yang dijaga
// komponen ini, jadi saat galat terjadi token itu tidak punya nilai. Selain
// itu, kalau galatnya berasal dari tema itu sendiri, layar galat ikut rusak.
// Warna diambil langsung dari pengaturan terang/gelap sistem.
//
// Catatan: galat yang terjadi saat sebuah modul diimpor tidak tertangkap di
// sini. Itu batas dari error boundary React, bukan kelemahan kode ini.

interface Keadaan {
  galat: Error | null;
  detailTerbuka: boolean;
}

const WARNA = {
  terang: {
    latar: '#f5f5f7',
    kartu: '#ffffff',
    garis: '#e5e5ea',
    teks: '#1d1d1f',
    redup: '#6b6b70',
    teksKedua: '#3a3a3c',
    biru: '#0071e3',
    merah: '#d92d20',
    merahMuda: '#fee4e2',
  },
  gelap: {
    latar: '#000000',
    kartu: '#1c1c1e',
    garis: '#38383a',
    teks: '#f5f5f7',
    redup: '#98989d',
    teksKedua: '#d1d1d6',
    biru: '#2997ff',
    merah: '#ff6961',
    merahMuda: '#3b1a18',
  },
} as const;

export default class BatasGalat extends Component<
  { children: ReactNode },
  Keadaan
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { galat: null, detailTerbuka: false };
  }

  static getDerivedStateFromError(galat: Error): Partial<Keadaan> {
    return { galat };
  }

  componentDidCatch(galat: Error, info: ErrorInfo) {
    console.error('[batas-galat] aplikasi gagal:', galat, info.componentStack);
  }

  cobaLagi = () => {
    this.setState({ galat: null, detailTerbuka: false });
  };

  alihDetail = () => {
    this.setState((s) => ({ detailTerbuka: !s.detailTerbuka }));
  };

  /**
   * Menutup aplikasi. Hanya Android yang mengizinkannya lewat BackHandler.
   * iOS tidak menyediakan cara resmi untuk menutup diri sendiri, jadi di sana
   * tombol ini tidak ditampilkan dan diganti petunjuk.
   */
  keluar = () => {
    if (Platform.OS === 'android') BackHandler.exitApp();
  };

  render() {
    const { galat, detailTerbuka } = this.state;
    if (!galat) return this.props.children;

    const w = WARNA[Appearance.getColorScheme() === 'dark' ? 'gelap' : 'terang'];
    const diAndroid = Platform.OS === 'android';

    return (
      <SafeAreaView
        edges={['top', 'bottom']}
        style={{ flex: 1, backgroundColor: w.latar }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 28,
            paddingVertical: 32,
          }}
        >
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: w.merahMuda,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="alert-circle" size={44} color={w.merah} />
            </View>

            <Text
              style={{
                marginTop: 20,
                fontSize: 22,
                fontWeight: '800',
                color: w.teks,
                textAlign: 'center',
              }}
            >
              Aplikasi gagal ditampilkan
            </Text>
            <Text
              style={{
                marginTop: 8,
                fontSize: 14,
                lineHeight: 21,
                color: w.redup,
                textAlign: 'center',
              }}
            >
              Ada kesalahan yang tidak terduga. Data jadwal dan tugas kamu tetap
              aman di server.
            </Text>
          </View>

          {/* Detail teknis */}
          <View
            style={{
              marginTop: 24,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: w.garis,
              backgroundColor: w.kartu,
              overflow: 'hidden',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: detailTerbuka }}
              accessibilityLabel={
                detailTerbuka ? 'Sembunyikan detail teknis' : 'Tampilkan detail teknis'
              }
              onPress={this.alihDetail}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 14,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: w.redup,
                }}
              >
                Detail teknis
              </Text>
              <Ionicons
                name={detailTerbuka ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={w.redup}
              />
            </Pressable>

            {detailTerbuka ? (
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: w.garis,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <Text
                  selectable
                  style={{ fontSize: 12, lineHeight: 18, color: w.teksKedua }}
                >
                  {galat.message || 'Kesalahan tidak diketahui.'}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Tombol */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Coba lagi"
            onPress={this.cobaLagi}
            android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
            style={({ pressed }) => ({
              marginTop: 24,
              height: 56,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderRadius: 16,
              backgroundColor: w.biru,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="refresh" size={20} color="#ffffff" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff' }}>
              Coba lagi
            </Text>
          </Pressable>

          {diAndroid ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tutup aplikasi"
              onPress={this.keluar}
              android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
              style={({ pressed }) => ({
                marginTop: 12,
                height: 56,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: w.garis,
                backgroundColor: w.kartu,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: w.teksKedua }}>
                Tutup aplikasi
              </Text>
            </Pressable>
          ) : (
            <Text
              style={{
                marginTop: 16,
                fontSize: 12,
                lineHeight: 18,
                color: w.redup,
                textAlign: 'center',
              }}
            >
              Kalau galat berulang, tutup aplikasi dengan menggeser ke atas dari
              tepi bawah layar, lalu buka lagi.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }
}