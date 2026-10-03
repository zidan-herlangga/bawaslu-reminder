import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useWarna, type TokenWarna } from '../tema/warna';

// Pembungkus Ionicon.
//
// Ionicon dirender dari font, bukan View, jadi warnanya harus diberikan sebagai
// nilai warna nyata: class Tailwind tidak berlaku di sana. Pembungkus ini
// menerjemahkan nama token menjadi nilai yang sedang dipakai tema, jadi ikon
// tidak perlu tahu soal tema sama sekali:
//
//   <Ikon nama="checkmark" token="bw-muted" />
//
// Ikon dianggap hiasan dan disembunyikan dari pembaca layar. Maknanya harus
// datang dari teks atau accessibilityLabel di sebelahnya (mis. pada Pressable
// yang membungkusnya), supaya TalkBack dan VoiceOver tidak membacakan nama
// glyph yang tidak berarti.

/** Nama ikon yang valid. Bisa diimpor di berkas lain menggantikan Parameters<typeof Ikon>. */
export type NamaIkon = ComponentProps<typeof Ionicons>['name'];

export function Ikon({
  nama,
  token = 'bw-ink-2',
  ukuran = 18,
}: {
  nama: NamaIkon;
  token?: TokenWarna;
  ukuran?: number;
}) {
  const { warna } = useWarna();

  return (
    <Ionicons
      name={nama}
      size={ukuran}
      color={warna(token)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}