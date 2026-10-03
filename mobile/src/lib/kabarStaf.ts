// Mengirim pengingat jadwal ke staf lewat server.
//
// dippedakai setelah jadwal baru disimpan, dan juga saat staf menekan tombol
// Ingatkan pada jadwal yang sudah ada. Satu helper untuk dua pemakai supaya
// tidak ada dua versi cara memanggil server.
//
// Yang dikembalikan selalu jujur: true hanya kalau server benar-benar
// menerima. Kalau gagal, pemanggil harus bilang begitu ke pengguna, bukan
// menampilkan keberhasilan seperti yang terjadi sebelumnya.
//
// Penting: kegagalan di sini tidak boleh membatalkan penyimpanan jadwal.
// Jadwal sudah tersimpan di Supabase sebelum panggilan ini, jadi membatalkan
// penyimpanan hanya akan membuat pengguna kehilangan data yang berhasil
// tersimpan.

import { apiUrl } from './api';
import { supabase } from './supabase';

export type HasilKabarStaf =
  | { ok: true }
  | { ok: false; alasan: string };

/**
 * Memberi tahu staf tentang satu jadwal.
 *
 * scheduleId dipakai server sebagai satu-satunya penanda, supaya server tidak
 * perlu menerima ulang isi jadwal yang bisa saja sudah berubah.
 */
export async function beriTahuStaf(scheduleId: string): Promise<HasilKabarStaf> {
  const { data, error } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (error || !token) {
    return {
      ok: false,
      alasan: 'Sesi sudah habis. Masuk ulang lalu kirim ulang pengingatnya.',
    };
  }

  let respons: Response;
  try {
    respons = await fetch(apiUrl('/api/notify'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ scheduleId }),
    });
  } catch (galat) {
    return {
      ok: false,
      alasan: `Tidak ada koneksi ke server: ${
        galat instanceof Error ? galat.message : String(galat)
      }`,
    };
  }

  if (!respons.ok) {
    return {
      ok: false,
      alasan: `Server menjawab HTTP ${respons.status}.`,
    };
  }

  return { ok: true };
}