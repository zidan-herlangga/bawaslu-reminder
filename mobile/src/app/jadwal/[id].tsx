import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import FormJadwal, { type ProfilPembuat } from '../../komponen/FormJadwal';
import { LayarGalat, LayarTunggu } from '../../komponen/LayarTunggu';
import { useSesi } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { formDariJadwal, type FormJadwal as BentukForm } from '../../shared/validasiJadwal';

// Route ubah jadwal.
//
// Kepemilikan dicek sebelum form dibuka, dengan pesan yang sama seperti di web:
// jadwal itu milik orang lain sehingga tidak bisa diubah.
//
// RLS sudah menolak update dari akun yang bukan pembuatnya, tapi pesan yang
// muncul dari sana berupa galat teknis yang tidak membantu orang paham. Karena
// itu dicek di sini lebih dulu supaya kalimatnya jelas dan formulirnya tidak
// ikut terbuka.
//
// Memakai FormJadwal yang sama dengan layar tambah, jadi aturan validasi dan
// tampilan tidak mungkin berbeda antara keduanya.

export default function LayarUbahJadwal() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, loading } = useSesi();
  const userId = session?.user.id ?? '';

  const [nilaiAwal, setNilaiAwal] = useState<BentukForm | null>(null);
  const [profil, setProfil] = useState<ProfilPembuat>({ namaLengkap: null, divisi: null });
  const [alasan, setAlasan] = useState<string | null>(null);
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    if (loading) return undefined;

    if (!id) {
      setAlasan('Jadwal tidak ditemukan.');
      setSiap(true);
      return undefined;
    }

    // Tanpa sesi, jadwal tidak akan pernah dimuat. Berhenti di sini dan
    // tampilkan pesan, jangan biarkan layar menunggu selamanya.
    if (!userId) {
      setAlasan('Sesi tidak ditemukan. Silakan masuk kembali.');
      setSiap(true);
      return undefined;
    }

    let aktif = true;

    // Mulai dari keadaan bersih kalau id berganti.
    setSiap(false);
    setAlasan(null);
    setNilaiAwal(null);

    (async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!aktif) return;

      if (error) {
        setAlasan(`Tidak bisa membuka jadwal: ${error.message}`);
        setSiap(true);
        return;
      }

      if (!data) {
        setAlasan('Jadwal sudah dihapus, jadi tidak bisa diubah.');
        setSiap(true);
        return;
      }

      // RLS membuat update hanya mungkin untuk pembuatnya. Kalau jadwal sampai
      // ke sini tapi bukan miliknya, lebih baik berhenti di awal daripada
      // menampilkan form yang pasti ditolak saat disimpan.
      if (data.pembuat_id !== userId) {
        setAlasan('Anda bukan pembuat jadwal ini, jadi tidak bisa mengubahnya.');
        setSiap(true);
        return;
      }

      const profilRow = await supabase
        .from('profiles')
        .select('nama_lengkap, divisi')
        .eq('id', userId)
        .maybeSingle();

      if (!aktif) return;

      setNilaiAwal(formDariJadwal(data as never));
      setProfil({
        namaLengkap: (profilRow.data?.nama_lengkap as string | null) ?? null,
        divisi: (profilRow.data?.divisi as string | null) ?? null,
      });
      setSiap(true);
    })();

    return () => {
      aktif = false;
    };
  }, [id, loading, userId]);

  // Galat dicek lebih dulu. Sebelumnya cabang "menunggu" ada di atas dan
  // menelan semua pesan galat, karena saat galat nilaiAwal selalu null.
  if (alasan) {
    return (
      <LayarGalat
        judul="Tidak bisa diubah"
        pesan={alasan}
        onTutup={() => router.back()}
      />
    );
  }

  if (loading || !siap || !nilaiAwal) {
    return (
      <LayarTunggu pesan="Memuat jadwal..." onTutup={() => router.back()} />
    );
  }

  return (
    <FormJadwal
      mode="ubah"
      idJadwal={id}
      nilaiAwal={nilaiAwal}
      userId={userId}
      email={session?.user.email ?? null}
      profil={profil}
      onTutup={() => router.back()}
      onSelesai={() => router.back()}
    />
  );
}