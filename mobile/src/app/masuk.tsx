import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BidangAuth, KotakPesan } from '../komponen/BidangAuth';
import { Ikon } from '../komponen/Ikon';
import { useSesi } from '../lib/session';

// Layar masuk.
//
// Tiga hal yang disengaja:
//
// - Ada tombol Daftar dan Lupa kata sandi. Keduanya berujung pada tautan
//   dari email yang ditangani sistem lewat deep link, jadi tetap butuh
//   layar sendiri: tautan itu harus mendarat di halaman yang bisa menerima
//   sesi pemulihan.
// - Galat ditampilkan tepat di atas tombol, bukan di tempat yang jauh.
//   Kesalahan paling sering terjadi di sini adalah email atau kata sandi
//   yang salah, dan pesannya perlu dibaca sebelum orang mencoba lagi
// - Isian memakai komponen BidangAuth yang sama dengan halaman Daftar dan
//   Atur Ulang, supaya ketiganya tidak bisa berbeda tampilan

export default function LayarMasuk() {
  const { session, loading, masuk, galat, hapusGalat } = useSesi();
  const [email, setEmail] = useState('');
  const [sandi, setSandi] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [fokus, setFokus] = useState<'email' | 'sandi' | null>(null);
  const [lihatSandi, setLihatSandi] = useState(false);
  const refSandi = useRef<TextInput>(null);

  if (!loading && session) {
    return <Redirect href="/(tabs)" />;
  }

  const bisaKirim = email.trim().length > 0 && sandi.length > 0 && !sibuk;

  const kirim = async () => {
    if (!bisaKirim) return;
    setSibuk(true);
    try {
      await masuk(email.trim(), sandi);
    } catch {
      // Pesan galat sudah disimpan di konteks sesi.
    } finally {
      setSibuk(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bw-canvas" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-6 py-10">
            {/* Identitas aplikasi */}
            <View className="items-center">
              <View className="h-24 w-24 items-center justify-center rounded-[32px] bg-bw-blue-50">
                <View className="h-16 w-16 items-center justify-center rounded-3xl bg-bw-solid">
                  <Ikon nama="notifications" token="bw-solid-text" ukuran={32} />
                </View>
              </View>
              <Text className="mt-6 text-center text-3xl font-extrabold tracking-tight text-bw-ink">
                Pengingat Jadwal
              </Text>
              <Text className="mt-1.5 text-center text-sm text-bw-muted">
                Aplikasi internal Bawaslu Bekasi Kota
              </Text>
            </View>

            {/* Formulir */}
            <View className="mt-9 rounded-[28px] border border-bw-line bg-bw-card p-5">
              <Text className="text-lg font-extrabold text-bw-ink">Masuk</Text>
              <Text className="mt-0.5 text-xs text-bw-muted">
                Gunakan akun yang sudah didaftarkan administrator.
              </Text>

              <BidangAuth
                label="Email"
                nilai={email}
                onUbah={(nilai) => {
                  setEmail(nilai);
                  if (galat) hapusGalat();
                }}
                jenis="email"
                placeholder="nama@bawaslu.go.id"
                autoComplete="email"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmit={() => refSandi.current?.focus()}
              />

              <View className="mt-4">
                <BidangAuth
                  label="Kata sandi"
                  nilai={sandi}
                  onUbah={(nilai) => {
                    setSandi(nilai);
                    if (galat) hapusGalat();
                  }}
                  jenis="sandi"
                  placeholder="Kata sandi"
                  autoComplete="password"
                  returnKeyType="go"
                  onSubmit={kirim}
                  refInput={refSandi}
                />
              </View>
              {galat ? <KotakPesan nada="galat">{galat}</KotakPesan> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Masuk"
                accessibilityState={{ disabled: !bisaKirim, busy: sibuk }}
                onPress={kirim}
                disabled={!bisaKirim}
                android_ripple={bisaKirim ? { color: 'rgba(255,255,255,0.2)' } : undefined}
                className={`mt-5 h-14 flex-row items-center justify-center gap-2 rounded-2xl active:opacity-80 ${
                  bisaKirim || sibuk ? 'bg-bw-blue' : 'bg-bw-line'
                }`}
              >
                {sibuk ? <ActivityIndicator size="small" color="#ffffff" /> : null}
                <Text
                  className={`text-base font-bold ${
                    bisaKirim || sibuk ? 'text-white' : 'text-bw-muted'
                  }`}
                >
                  {sibuk ? 'Memeriksa...' : 'Masuk'}
                </Text>
              </Pressable>
            </View>

            <View className="mt-6 gap-1">
              <Pressable
                onPress={() => router.replace("/daftar")}
                accessibilityRole="button"
                accessibilityLabel="Daftar akun baru"
                className="h-12 items-center justify-center rounded-2xl active:opacity-70"
              >
                <Text className="text-base font-bold text-bw-blue">
                  Belum punya akun? Daftar
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.replace("/lupa-password")}
                accessibilityRole="button"
                accessibilityLabel="Lupa kata sandi"
                className="h-12 items-center justify-center rounded-2xl active:opacity-70"
              >
                <Text className="text-base font-bold text-bw-blue">
                  Lupa kata sandi?
                </Text>
              </Pressable>

              <View className="mt-1 flex-row items-start justify-center gap-2 px-2">
                <Ikon nama="shield-checkmark-outline" token="bw-muted" ukuran={14} />
                <Text className="flex-1 text-center text-xs leading-relaxed text-bw-muted">
                  Hanya untuk staf yang sudah terdaftar. Hubungi administrator
                  bila butuh akses.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}