import { useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
} from 'react-native';
import { Ikon } from './Ikon';

// Isian formulir untuk halaman auth: masuk, daftar, dan atur ulang kata sandi.
//
//previously markup-nya ditulis ulang di tiap layar, jadi perubahan tinggi atau
// warna ikon harus diubah di empat tempat. Sekarang satu komponen, dan keempat
// layar otomatis terlihat sama.
//
// Perbedaan penting dari isian biasa: tinggi minimum 56 poin, karena di layar
// aplikasi dipakai sambil berdiri dengan satu tangan, target sentuh yang kecil akan
// kecil akan sering meleset.

export type JenisBidang = 'teks' | 'email' | 'sandi';

export interface BidangAuthProps {
  label: string;
  nilai: string;
  onUbah: (nilai: string) => void;
  jenis?: JenisBidang;
  placeholder?: string;
  autoComplete?: 'email' | 'password' | 'name' | 'off';
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmit?: () => void;
  refInput?: React.Ref<TextInput> | null;
  /** Tampilkan ikon di dalam isian. Mati untuk kolom yang terlalu sempit. */
  adaIkon?: boolean;
}

export function BidangAuth({
  label,
  nilai,
  onUbah,
  jenis = 'teks',
  placeholder,
  autoComplete = 'off',
  keyboardType,
  returnKeyType,
  onSubmit,
  refInput,
  adaIkon = true,
}: BidangAuthProps) {
  const [fokus, setFokus] = useState(false);
  const [lihatSandi, setLihatSandi] = useState(false);

  const namaIkon =
    jenis === 'email'
      ? 'mail-outline'
      : jenis === 'sandi'
        ? 'lock-closed-outline'
        : 'person-outline';

  const token = fokus ? 'bw-blue' : 'bw-muted';

  return (
    <View>
      <Text className="mb-2 ml-1 text-xs font-bold uppercase tracking-widest text-bw-muted">
        {label}
      </Text>

      <View
        className={`h-14 flex-row items-center gap-2.5 rounded-2xl border-2 bg-bw-surface pl-4 pr-1 ${
          fokus ? 'border-bw-blue' : 'border-transparent'
        }`}
      >
        {adaIkon ? <Ikon nama={namaIkon} token={token} ukuran={18} /> : null}

        <TextInput
          ref={refInput}
          value={nilai}
          onChangeText={onUbah}
          onFocus={() => setFokus(true)}
          onBlur={() => setFokus(false)}
          secureTextEntry={jenis === 'sandi' && !lihatSandi}
          autoCapitalize={jenis === 'email' || jenis === 'sandi' ? 'none' : 'words'}
          autoCorrect={false}
          autoComplete={autoComplete}
          keyboardType={keyboardType}
          textContentType={jenis === 'email' ? 'emailAddress' : undefined}
          placeholder={placeholder}
          placeholderTextColor="#9a9aa0"
          accessibilityLabel={label}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmit}
          blurOnSubmit={false}
          className="flex-1 text-base text-bw-ink"
        />

        {jenis === 'sandi' ? (
          <Pressable
            onPress={() => setLihatSandi((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={lihatSandi ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            hitSlop={8}
            className="h-12 w-12 items-center justify-center rounded-full active:opacity-70"
          >
            <Ikon
              nama={lihatSandi ? 'eye-off-outline' : 'eye-outline'}
              token="bw-muted"
              ukuran={20}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Gaya tiap nada pesan. Dipisah agar tipe ikon dan warnanya tetap sempit. */
const GAYA: Record<
  'galat' | 'info' | 'sukses',
  {
    wadah: string;
    ikon: Parameters<typeof Ikon>[0]['nama'];
    token: NonNullable<Parameters<typeof Ikon>[0]['token']>;
  }
> = {
  galat: {
    wadah: 'border-bw-red-100 bg-bw-red-50',
    ikon: 'alert-circle-outline',
    token: 'bw-red',
  },
  info: {
    wadah: 'border-bw-blue-200 bg-bw-blue-50',
    ikon: 'information-circle-outline',
    token: 'bw-blue',
  },
  sukses: {
    wadah: 'border-bw-green-200 bg-bw-green-50',
    ikon: 'checkmark-circle-outline',
    token: 'bw-green',
  },
};

/** Kotak pesan galat atau pemberitahuan, dipakai keempat halaman auth. */
export function KotakPesan({
  nada,
  children,
}: {
  nada: 'galat' | 'info' | 'sukses';
  children: React.ReactNode;
}) {
  const gaya = GAYA[nada];

  return (
    <View
      accessibilityRole={nada === 'galat' ? 'alert' : 'summary'}
      className={`mt-4 flex-row items-start gap-2.5 rounded-2xl border px-4 py-3 ${gaya.wadah}`}
    >
      <Ikon nama={gaya.ikon} token={gaya.token} ukuran={18} />
      <Text className="flex-1 text-sm leading-relaxed text-bw-ink-2">
        {children}
      </Text>
    </View>
  );
}