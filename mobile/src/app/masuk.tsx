import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import SafeAreaView from '../komponen/SafeAreaView';
import { Button, ButtonSpinner, ButtonText } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Text as GlText } from '../components/ui/text';
import { BidangAuth, KotakPesan } from '../komponen/BidangAuth';
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
            <View className="mx-auto w-full max-w-md">
              {/* Identitas aplikasi */}
              <View className="items-center">
                <View className="h-20 w-20 items-center justify-center rounded-[26px] bg-bw-blue-50">
                  <Image
                    source={require('../../assets/icon.png')}
                    style={{ width: 64, height: 64, borderRadius: 16 }}
                    accessibilityLabel="Logo Pengingat Jadwal"
                  />
                </View>
                <GlText className="mt-6 text-center text-3xl font-extrabold tracking-tight text-bw-ink">
                  Pengingat Jadwal
                </GlText>
                <GlText className="mt-1.5 text-center text-sm text-bw-muted">
                  Aplikasi internal Bawaslu Bekasi Kota
                </GlText>
              </View>

              {/* Formulir */}
              <Card className="mt-9 rounded-[28px] border-bw-line bg-bw-card p-5">
                <Text className="text-lg font-extrabold text-bw-ink">Masuk</Text>
                <BidangAuth
                  label="Email"
                  nilai={email}
                  onUbah={(nilai) => {
                    setEmail(nilai);
                    if (galat) hapusGalat();
                  }}
                  jenis="email"
                  placeholder="Email yang telah didaftarkan"
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

                <Button
                  size="lg"
                  accessibilityLabel="Masuk"
                  accessibilityState={{ disabled: !bisaKirim, busy: sibuk }}
                  onPress={kirim}
                  isDisabled={!bisaKirim}
                  className="mt-5 h-14 w-full rounded-2xl px-4 bg-bw-blue data-[hover=true]:bg-bw-blue-hi data-[active=true]:bg-bw-blue-hi data-[disabled=true]:bg-bw-line data-[disabled=true]:opacity-60"
                >
                  {sibuk ? <ButtonSpinner color="#ffffff" size="small" /> : null}
                  <ButtonText className="text-base font-bold text-white">
                    {sibuk ? 'Memeriksa...' : 'Masuk'}
                  </ButtonText>
                </Button>
              </Card>

              <View className="mt-6 gap-1">
                <Pressable
                  onPress={() => router.replace('/daftar')}
                  accessibilityRole="button"
                  accessibilityLabel="Daftar akun baru"
                  className="h-12 items-center justify-center rounded-2xl active:opacity-70"
                >
                  <Text className="text-base font-bold text-bw-blue">
                    Belum punya akun? Daftar
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => router.replace('/lupa-password')}
                  accessibilityRole="button"
                  accessibilityLabel="Lupa kata sandi"
                  className="h-12 items-center justify-center rounded-2xl active:opacity-70"
                >
                  <Text className="text-base font-bold text-bw-blue">
                    Lupa kata sandi?
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}