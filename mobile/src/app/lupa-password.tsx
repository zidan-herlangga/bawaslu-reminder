import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BidangAuth, KotakPesan } from '../komponen/BidangAuth';
import { Ikon } from '../komponen/Ikon';
import { useSesi } from '../lib/session';
import { normalkanEmail, pesanGalatAuth } from '../shared/daftar';

// Layar minta tautan atur ulang kata sandi.
//
// Yang ada di layar ini hanya kolom email, dan itu pun sengaja dibuat
// tanpa memberi tahu apakah email itu terdaftar atau tidak. Memberi tahu
// hanya akan membuat orang bisa menebak-nebak email rekan kerja.
//
// redirectTo memakai skema aplikasi, bukan alamat web. Kalau tautannya membuka
// peramban, orang akan melihat halaman web, bukan langkah kedua di sini.
//
// Satu hal yang tidak bisa dikerjakan dari sisi kode: Supabase hanya menerima
// redirectTo yang terdaftar di Authentication > URL Configuration. Kalau
// tautannya tidak masuk ke aplikasi, tambahkan skema aplikasi di sana dulu.

export default function LayarLupaPassword() {
  const { kirimTautanAturUlang } = useSesi();
  const [email, setEmail] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');
  const [terkirim, setTerkirim] = useState(false);
  const refEmail = useRef(null);

  const kirim = async () => {
    if (sibuk) return;

    const bersih = normalkanEmail(email);
    if (!bersih) {
      setGalat('Email wajib diisi.');
      return;
    }

    setSibuk(true);
    setGalat('');

    try {
      await kirimTautanAturUlang(bersih);
      setTerkirim(true);
    } catch (kesalahan) {
      setGalat(pesanGalatAuth(kesalahan));
    } finally {
      setSibuk(false);
    }
  };

  if (terkirim) {
    return (
      <SafeAreaView className="flex-1 bg-bw-canvas" edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <View className="px-6 py-10">
            <View className="items-center">
              <View className="h-24 w-24 items-center justify-center rounded-[32px] bg-bw-green-50">
                <Ikon nama="mail-open-outline" token="bw-green" ukuran={44} />
              </View>
              <Text className="mt-6 text-center text-2xl font-extrabold tracking-tight text-bw-ink">
                Tautan sudah dikirim
              </Text>
              <Text className="mt-2 text-center text-sm leading-relaxed text-bw-muted">
                Periksa kotak masuk dan folder spam di {normalkanEmail(email)}. Tautan
                itu membuka aplikasi ini, dan hanya berlaku sekali.
              </Text>
            </View>

            <View className="mt-8 rounded-[28px] border border-bw-line bg-bw-card p-5">
              <Pressable
                onPress={() => router.replace('/masuk')}
                accessibilityRole="button"
                accessibilityLabel="Kembali ke halaman masuk"
                className="h-14 items-center justify-center rounded-2xl bg-bw-blue active:opacity-80"
              >
                <Text className="text-base font-bold text-white">
                  Kembali ke halaman masuk
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setTerkirim(false);
                  setEmail('');
                }}
                accessibilityRole="button"
                accessibilityLabel="Kirim ulang tautan"
                className="mt-3 h-12 items-center justify-center rounded-2xl active:opacity-70"
              >
                <Text className="text-sm font-bold text-bw-blue">
                  Kirim ulang atau ganti email
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
            <View className="items-center">
              <View className="h-24 w-24 items-center justify-center rounded-[32px] bg-bw-blue-50">
                <Ikon nama="key-outline" token="bw-blue" ukuran={44} />
              </View>
              <Text className="mt-6 text-center text-3xl font-extrabold tracking-tight text-bw-ink">
                Lupa Kata Sandi
              </Text>
              <Text className="mt-1.5 text-center text-sm leading-relaxed text-bw-muted">
                Masukkan email akun Anda. Kami mengirim tautan untuk membuat
                kata sandi baru.
              </Text>
            </View>

            <View className="mt-8 rounded-[28px] border border-bw-line bg-bw-card p-5">
              <BidangAuth
                label="Email"
                nilai={email}
                onUbah={(v) => {
                  setEmail(v);
                  if (galat) setGalat('');
                }}
                jenis="email"
                placeholder="nama@bawaslu.go.id"
                autoComplete="email"
                keyboardType="email-address"
                returnKeyType="go"
                onSubmit={kirim}
                refInput={refEmail}
              />

              {galat ? <KotakPesan nada="galat">{galat}</KotakPesan> : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Kirim tautan atur ulang"
                accessibilityState={{ disabled: email.trim().length === 0 || sibuk, busy: sibuk }}
                onPress={kirim}
                disabled={email.trim().length === 0 || sibuk}
                className={`mt-5 h-14 flex-row items-center justify-center gap-2 rounded-2xl active:opacity-80 ${
                  email.trim().length > 0 || sibuk ? 'bg-bw-blue' : 'bg-bw-line'
                }`}
              >
                {sibuk ? <ActivityIndicator size="small" color="#ffffff" /> : null}
                <Text
                  className={`text-base font-bold ${
                    email.trim().length > 0 || sibuk ? 'text-white' : 'text-bw-muted'
                  }`}
                >
                  {sibuk ? 'Mengirim...' : 'Kirim tautan'}
                </Text>
              </Pressable>
            </View>

            <View className="mt-6 items-center">
              <Pressable
                onPress={() => router.replace('/masuk')}
                accessibilityRole="button"
                accessibilityLabel="Kembali ke halaman masuk"
                hitSlop={8}
                className="h-12 justify-center px-4 active:opacity-70"
              >
                <Text className="text-base font-bold text-bw-blue">
                  Kembali ke halaman masuk
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
