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

export function Ikon({
  nama,
  token = 'bw-ink-2',
  ukuran = 18,
}: {
  nama: ComponentProps<typeof Ionicons>['name'];
  token?: TokenWarna;
  ukuran?: number;
}) {
  const { warna } = useWarna();

  return <Ionicons name={nama} size={ukuran} color={warna(token)} />;
}
