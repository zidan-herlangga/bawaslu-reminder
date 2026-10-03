import { Redirect } from 'expo-router';
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

              <View className="mt-5">
                <Text className="mb-2 ml-1 text-xs font-bold uppercase tracking-widest text-bw-muted">
                  Email
                </Text>
                <View
                  className={`h-14 flex-row items-center gap-2.5 rounded-2xl border-2 bg-bw-surface px-4 ${
                    fokus === 'email' ? 'border-bw-blue' : 'border-transparent'
                  }`}
                >
                  <Ikon
                    nama="mail-outline"
                    token={fokus === 'email' ? 'bw-blue' : 'bw-muted'}
                    ukuran={18}
                  />
                  <TextInput
                    value={email}
                    onChangeText={(nilai) => {
                      setEmail(nilai);
                      if (galat) hapusGalat();
                    }}
                    onFocus={() => setFokus('email')}
                    onBlur={() => setFokus(null)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    placeholder="nama@bawaslu.go.id"
                    placeholderTextColor="#9a9aa0"
                    accessibilityLabel="Email"
                    returnKeyType="next"
                    onSubmitEditing={() => refSandi.current?.focus()}
                    blurOnSubmit={false}
                    className="flex-1 text-base text-bw-ink"
                  />
                </View>
              </View>

              <View className="mt-4">
                <Text className="mb-2 ml-1 text-xs font-bold uppercase tracking-widest text-bw-muted">
                  Kata sandi
                </Text>
                <View
                  className={`h-14 flex-row items-center gap-2.5 rounded-2xl border-2 bg-bw-surface pl-4 pr-1 ${
                    fokus === 'sandi' ? 'border-bw-blue' : 'border-transparent'
                  }`}
                >
                  <Ikon
                    nama="lock-closed-outline"
                    token={fokus === 'sandi' ? 'bw-blue' : 'bw-muted'}
                    ukuran={18}
                  />
                  <TextInput
                    ref={refSandi}
                    value={sandi}
                    onChangeText={(nilai) => {
                      setSandi(nilai);
                      if (galat) hapusGalat();
                    }}
                    onFocus={() => setFokus('sandi')}
                    onBlur={() => setFokus(null)}
                    secureTextEntry={!lihatSandi}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    textContentType="password"
                    placeholder="Kata sandi"
                    placeholderTextColor="#9a9aa0"
                    accessibilityLabel="Kata sandi"
                    onSubmitEditing={kirim}
                    returnKeyType="go"
                    className="flex-1 text-base text-bw-ink"
                  />
                  <Pressable
                    onPress={() => setLihatSandi((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      lihatSandi ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'
                    }
                    hitSlop={8}
                    className="h-12 w-12 items-center justify-center rounded-full active:opacity-70"
                  >
                    <Ikon
                      nama={lihatSandi ? 'eye-off-outline' : 'eye-outline'}
                      token="bw-muted"
                      ukuran={20}
                    />
                  </Pressable>
                </View>
              </View>

              {galat ? (
                <View
                  accessibilityRole="alert"
                  className="mt-4 flex-row items-start gap-2.5 rounded-2xl border border-bw-red-100 bg-bw-red-50 px-4 py-3"
                >
                  <Ikon nama="alert-circle-outline" token="bw-red" ukuran={18} />
                  <Text className="flex-1 text-sm leading-relaxed text-bw-red">
                    {galat}
                  </Text>
                </View>
              ) : null}

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

            <View className="mt-6 flex-row items-start justify-center gap-2 px-2">
              <Text className="flex-1 text-center text-xs leading-relaxed text-bw-muted">
              <Ikon nama="shield-checkmark-outline" token="bw-muted" ukuran={14} />
                Hanya untuk staf yang sudah terdaftar. Hubungi administrator bila
                lupa kata sandi atau belum punya akun.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}