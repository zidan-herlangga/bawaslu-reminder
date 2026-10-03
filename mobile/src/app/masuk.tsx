import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../komponen/Ikon';
import { useSesi } from '../lib/session';

// Layar masuk.
//
// Dua hal yang disengaja:
//
// - Tidak ada tombol "Daftar" atau "Lupa kata sandi". Di web keduanya perlu
//   karena Supabase mengirim tautan yang dibuka di peramban. Di native tautan
//   itu ditangani sistem lewat deep link, jadi tidak perlu layar sendiri
// - Galat ditampilkan tepat di atas tombol, bukan di tempat yang jauh. Kesalahan
//   paling sering terjadi di sini adalah email atau kata sandi yang salah, dan
//   pesannya perlu dibaca sebelum orang mencoba lagi

export default function LayarMasuk() {
  const { session, loading, masuk, galat, hapusGalat } = useSesi();
  const [email, setEmail] = useState('');
  const [sandi, setSandi] = useState('');
  const [sibuk, setSibuk] = useState(false);

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
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-5 px-6 py-10">
            <View className="items-center gap-3">
              <View className="h-20 w-20 items-center justify-center rounded-3xl bg-bw-solid">
                <Ikon nama="notifications" token="bw-solid-text" ukuran={36} />
              </View>
              <Text className="text-center text-2xl font-bold text-bw-ink">
                Pengingat Jadwal
              </Text>
              <Text className="text-center text-sm text-bw-muted">
                Aplikasi internal Bawaslu Kota Bekasi
              </Text>
            </View>

            <View className="gap-3">
              <View>
                <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide text-bw-muted">
                  Email
                </Text>
                <TextInput
                  value={email}
                  onChangeText={(nilai) => {
                    setEmail(nilai);
                    if (galat) hapusGalat();
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  placeholder="nama@bawaslu.go.id"
                  placeholderTextColor="#9a9aa0"
                  accessibilityLabel="Email"
                  className="h-14 rounded-2xl border border-bw-line bg-bw-card px-4 text-base text-bw-ink"
                />
              </View>

              <View>
                <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide text-bw-muted">
                  Kata sandi
                </Text>
                <TextInput
                  value={sandi}
                  onChangeText={(nilai) => {
                    setSandi(nilai);
                    if (galat) hapusGalat();
                  }}
                  secureTextEntry
                  textContentType="password"
                  placeholder="Kata sandi"
                  placeholderTextColor="#9a9aa0"
                  accessibilityLabel="Kata sandi"
                  onSubmitEditing={kirim}
                  returnKeyType="go"
                  className="h-14 rounded-2xl border border-bw-line bg-bw-card px-4 text-base text-bw-ink"
                />
              </View>

              {galat ? (
                <View
                  accessibilityRole="alert"
                  className="rounded-2xl border border-bw-red-100 bg-bw-red-50 px-4 py-3"
                >
                  <Text className="text-sm leading-relaxed text-bw-red">
                    {galat}
                  </Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Masuk"
                onPress={kirim}
                disabled={!bisaKirim}
                className={`h-14 items-center justify-center rounded-2xl active:opacity-80 ${
                  bisaKirim ? 'bg-bw-blue' : 'bg-bw-line'
                }`}
              >
                <Text
                  className={`text-base font-bold ${
                    bisaKirim ? 'text-white' : 'text-bw-muted'
                  }`}
                >
                  {sibuk ? 'Memeriksa...' : 'Masuk'}
                </Text>
              </Pressable>
            </View>

            <Text className="text-center text-xs leading-relaxed text-bw-muted">
              Hanya untuk staf yang sudah terdaftar. Hubungi administrator bila
              lupa kata sandi atau belum punya akun.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
