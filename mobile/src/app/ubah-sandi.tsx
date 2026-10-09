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
import SafeAreaView from '../komponen/SafeAreaView';
import { BidangAuth, KotakPesan } from '../komponen/BidangAuth';
import { Ikon } from '../komponen/Ikon';
import { kembali } from '../lib/kembali';
import { showToast } from '../lib/toast';
import { useSesi } from '../lib/session';
import {
  kalimatGalat,
  pesanGalatAuth,
  validasiSandiBaru,
} from '../shared/daftar';

// Layar ubah kata sandi dari dalam aplikasi.
//
// Berbeda dengan halaman atur ulang, orang di sini sudah masuk dan tahu
// kata sandi lamanya. Karena itu langkah pertama adalah verifikasi: sandi
// lama dikirim ke Supabase lewat masuk ulang, dan hanya kalau itu benar
// barulah sandi baru disimpan. Tanpa langkah ini perangkat yang tertinggal
// bisa mengganti kata sandi tanpa pernah mengetahui yang lama.
//
// Urutan validasi mengikuti shared/daftar.ts (aturan yang sama dengan web),
// ditambah satu aturan lokal: sandi baru tidak boleh sama dengan sandi lama,
// karena mengganti sandi dengan nilai yang sama tidak ada gunanya dan sering
// berarti salah kolom.

export default function LayarUbahSandi() {
  const { ubahSandi } = useSesi();
  const [sandiLama, setSandiLama] = useState('');
  const [sandiBaru, setSandiBaru] = useState('');
  const [ulang, setUlang] = useState('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const refSandiLama = useRef(null);

  const simpan = async () => {
    if (sibuk) return;

    if (!sandiLama.trim()) {
      setGalat('Kata sandi saat ini wajib diisi.');
      return;
    }
    if (validasiSandiBaru(sandiBaru).length > 0) {
      setGalat(kalimatGalat(validasiSandiBaru(sandiBaru)));
      return;
    }
    if (sandiBaru !== ulang) {
      setGalat('Konfirmasi kata sandi tidak sama.');
      return;
    }
    if (sandiBaru === sandiLama) {
      setGalat('Kata sandi baru tidak boleh sama dengan kata sandi saat ini.');
      return;
    }

    setSibuk(true);
    setGalat('');

    try {
      await ubahSandi(sandiLama, sandiBaru);
      showToast('Kata sandi berhasil diubah.', 'sukses');
      kembali();
    } catch (kesalahan) {
      setGalat(pesanGalatAuth(kesalahan));
    } finally {
      setSibuk(false);
    }
  };

  const lengkap =
    sandiLama.trim().length > 0 && sandiBaru.length > 0 && ulang.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-bw-canvas" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-6 pt-6">
            <Pressable
              onPress={kembali}
              accessibilityRole="button"
              accessibilityLabel="Kembali ke halaman akun"
              hitSlop={10}
              className="-ml-2 h-11 w-11 items-center justify-center rounded-full active:opacity-70"
            >
              <Ikon nama="chevron-back" token="bw-ink-2" ukuran={22} />
            </Pressable>

            <Text className="mt-2 text-3xl font-extrabold tracking-tight text-bw-ink">
              Ubah Kata Sandi
            </Text>
            <Text className="mt-1.5 text-sm text-bw-muted">
              Verifikasi kata sandi saat ini, lalu pilih yang baru.
            </Text>

            <View className="mt-6 rounded-[28px] border border-bw-line bg-bw-card p-5">
              <BidangAuth
                label="Kata sandi saat ini"
                nilai={sandiLama}
                onUbah={(v) => {
                  setSandiLama(v);
                  if (galat) setGalat('');
                }}
                jenis="sandi"
                placeholder="Ketik kata sandi lama"
                autoComplete="password"
                returnKeyType="next"
                refInput={refSandiLama}
              />

              <View className="mt-4">
                <BidangAuth
                  label="Kata sandi baru"
                  nilai={sandiBaru}
                  onUbah={(v) => {
                    setSandiBaru(v);
                    if (galat) setGalat('');
                  }}
                  jenis="sandi"
                  placeholder="Minimal 6 karakter"
                  autoComplete="new-password"
                  returnKeyType="next"
                />
              </View>

              <View className="mt-4">
                <BidangAuth
                  label="Ulangi kata sandi baru"
                  nilai={ulang}
                  onUbah={(v) => {
                    setUlang(v);
                    if (galat) setGalat('');
                  }}
                  jenis="sandi"
                  placeholder="Ketik sekali lagi"
                  autoComplete="new-password"
                  returnKeyType="go"
                  onSubmit={simpan}
                />
              </View>

              {galat ? <KotakPesan nada="galat">{galat}</KotakPesan> : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Simpan kata sandi baru"
                accessibilityState={{ disabled: !lengkap || sibuk, busy: sibuk }}
                onPress={simpan}
                disabled={!lengkap || sibuk}
                className={`mt-5 h-14 flex-row items-center justify-center gap-2 rounded-2xl active:opacity-80 ${
                  lengkap || sibuk ? 'bg-bw-blue' : 'bg-bw-line'
                }`}
              >
                {sibuk ? <ActivityIndicator size="small" color="#ffffff" /> : null}
                <Text
                  className={`text-base font-bold ${
                    lengkap || sibuk ? 'text-white' : 'text-bw-muted'
                  }`}
                >
                  {sibuk ? 'Menyimpan...' : 'Simpan kata sandi'}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
