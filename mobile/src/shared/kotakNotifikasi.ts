// Aturan kotak masuk notifikasi.
//
// Dipisah dari hook supaya bisa diuji tanpa perangkat, tanpa Supabase, dan
// tanpa komponen UI. Port dari src/components/AppShell.jsx: web sudah punya
// kotak masuk dengan riwayat, penanda belum dibaca, dan tandai sudah baca;
// mobile belum punya sama sekali.
//
// -----------------------------------------------------------------------------
// Bentuk data
//
// Kolom notifications dipakai apa adanya: pengirim dan penerima memakai id
// pengguna, sedangkan divisi sasaran disimpan di baris yang sama. Semua baris di
// inbox adalah milik pengguna ini karena kebijakan RLS "read own notifications"
// hanya membalas baris dengan penerima_id = pengguna yang sedang masuk. Jadi
// penyaringan divisi tidak dilakukan di sini: baris yang sudah sampai ke kotak
// masuk memang ditujukan untuk pengguna ini.
//
// -----------------------------------------------------------------------------
// Kenapa hanya terbaru
//
// Notifikasi menumpuk tanpa batas dan tidak ada yang membersihkannya. Menampilkan
// semuanya membuat waktu muat halaman bertambah lama setiap minggu aplikasi
// dipakai. Web memakai 30 baris terbaru, dan angka itu dipertahankan supaya
// kedua sisi menampilkan isi yang sama. Badge belum dibaca tetap menghitung
// semua yang belum dibaca, bukan hanya yang kebetulan terlihat di 30 baris itu.

/** Berapa notifikasi terbaru yang ditampilkan di kotak masuk. */
export const MAKS_KOTAK_MASUK = 30;

export interface Notifikasi {
  id: string;
  judul: string;
  pesan: string;
  dibaca: boolean;
  dibuatPada: string;
  jadwalId: string | null;
  /** Kategori jadwal, kalau relasi schedules ikut ikutkan dalam query. */
  kategori: string | null;
}

/** Bentuk baris dari PostgREST, yang bisa saja tidak lengkap. */
export interface BarisNotifikasi {
  id: string;
  judul?: string | null;
  pesan?: string | null;
  dibaca?: boolean | null;
  created_at?: string | null;
  jadwal_id?: string | null;
  schedules?: { kategori?: string | null } | null;
}

/**
 * Menyesuaikan satu baris database menjadi bentuk yang dipakai layar.
 *
 * created_at yang tidak terbaca tidak dibuang: urutan sudah ditentukan database,
 * jadi nilai aslinya disimpan apa adanya. Menggantinya dengan tanggal yang
 * dibuat-buat akan lebih buruk, karena layar bisa menampilkan "1 Januari 1970"
 * untuk notifikasi yang sebenarnya baru saja datang.
 */
export function adaptasiNotifikasi(baris: BarisNotifikasi): Notifikasi {
  const jadwal = Array.isArray(baris.schedules) ? baris.schedules[0] : baris.schedules;

  return {
    id: baris.id,
    judul: (baris.judul ?? '').trim() || 'Pengingat jadwal',
    pesan: (baris.pesan ?? '').trim(),
    // Kolomnya default false di database, tapi null masih mungkin muncul dari
    // baris lama yang ditulis sebelum kolomnya ada. null berarti belum dibaca:
    // menganggapnya sudah dibaca membuat notifikasi hilang tanpa pernah terlihat.
    dibaca: baris.dibaca === true,
    dibuatPada: baris.created_at ?? '',
    jadwalId: baris.jadwal_id ?? null,
    kategori: (jadwal?.kategori ?? '').trim() || null,
  };
}

/** Menyesuaikan seluruh hasil query, membuang baris tanpa id. */
export function adaptasiDaftarNotifikasi(
  baris: readonly (BarisNotifikasi | null | undefined)[]
): Notifikasi[] {
  return baris
    .filter((item): item is BarisNotifikasi => Boolean(item?.id))
    .map(adaptasiNotifikasi);
}

/** Berapa notifikasi yang belum dibaca. */
export function hitungBelumDibaca(
  daftar: readonly Pick<Notifikasi, 'dibaca'>[]
): number {
  return daftar.reduce((jumlah, item) => (item.dibaca ? jumlah : jumlah + 1), 0);
}

/**
 * Menandai satu notifikasi sudah dibaca, tanpa mengubah baris lain.
 *
 * Mengembalikan daftar baru, bukan mengubah daftar yang sama. Ini yang membuat
 * penggambar ulang layar bisa terjadi: kalau larik yang sama diubah diam-diam,
 * React tidak tahu ada yang berubah dan layar tetap menampilkan yang lama.
 */
export function tandaiDibaca(
  daftar: readonly Notifikasi[],
  id: string
): Notifikasi[] {
  return daftar.map((item) => (item.id === id ? { ...item, dibaca: true } : item));
}

/** Menandai semua notifikasi sudah dibaca sekaligus. */
export function tandaiSemuaDibaca(daftar: readonly Notifikasi[]): Notifikasi[] {
  return daftar.map((item) => (item.dibaca ? item : { ...item, dibaca: true }));
}

/**
 * Membuang satu notifikasi dari daftar.
 *
 * Mengembalikan daftar baru, bukan mengubah daftar yang sama, supaya React
 * bisa menggambar ulang layar setelah penghapusan.
 */
export function hapusDariDaftar(
  daftar: readonly Notifikasi[],
  id: string
): Notifikasi[] {
  return daftar.filter((item) => item.id !== id);
}

/**
 * Menghapus seluruh notifikasi sekaligus.
 *
 * Selalu mengembalikan daftar kosong yang baru, bukan mengubah daftar yang
 * sama, supaya React bisa menggambar ulang layar setelah penghapusan.
 */
export function hapusSemuaDariDaftar(daftar: readonly Notifikasi[]): Notifikasi[] {
  return [];
}

/**
 * Notifikasi yang baru muncul sejak pemuatan sebelumnya.
 *
 * Web memakai ini untuk membunyikan suara pengingat begitu notifikasi masuk,
 * supaya staf yang sedang mengerjakan hal lain tetap diberi tahu tanpa harus
 * membuka kotak masuk. Hasil pemuatan pertama tidak dihitung: baris lama yang
 * baru dimuat bukan kabar baru, dan memainkannya akan berbunyi setiap kali
 * aplikasi dibuka.
 *
 * Parameter `sudahDilihat` harus berisi id yang sudah pernah dimuat. Bernilai
 * true berarti pemuatan ini yang pertama, jadi tidak ada yang baru.
 *
 * Parameter `maksWaktuDilihat`, kalau berangka, adalah nilai created_at paling
 * baru yang pernah dimuat (dalam milidetik). Notifikasi di kotak masuk selalu
 * terurut dari yang terbaru, dan baris baru selalu mendarat di atas. Jadi sebuah
 * baris hanya benar-benar baru kalau dibuat setelah maksimum ini. Tanpa patokan
 * ini, baris lama yang baru masuk jendela 30 teratas - misalnya karena baris di
 * atasnya dihapus - disangka kabar baru, berbunyi, dan membuat pengguna merasa
 * notifikasinya justru berlipat. Baris punya created_at kosong ikut dianggap
 * bukan baru, karena waktu kemunculannya memang tidak diketahui.
 */
export function notifikasiBaru(
  barisSekarang: readonly Notifikasi[],
  sudahDilihat: ReadonlySet<string>,
  pemuatanPertama: boolean,
  maksWaktuDilihat?: number
): Notifikasi[] {
  if (pemuatanPertama) return [];
  return barisSekarang.filter((item) => {
    if (sudahDilihat.has(item.id)) return false;
    if (Number.isFinite(maksWaktuDilihat)) {
      const t = Date.parse(item.dibuatPada);
      return Number.isFinite(t) && t > (maksWaktuDilihat ?? 0);
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Keadaan kotak masuk
//
// Dipisah dari hook supaya aturan pembaruan dan pembatalannya bisa diuji tanpa
// perangkat dan tanpa Supabase. Reducer dipilih, bukan beberapa useState, karena
// tandai sudah dibaca butuh dua langkah: tampilan diubah lebih dulu supaya
// terasa langsung, lalu dikembalikan seperti semula kalau database menolak.
// Kalau itu ditulis sebagai dua state terpisah, urutan pembaruannya tidak
// terjamin dan tidak ada tempat untuk menyimpan snapshot pembatalan.
//
// Keadaan ini ikut tinggal di berkas yang sama, bukan berkas terpisah. Alasannya
// teknis: modul ini diuji dengan `node --experimental-strip-types`, yang
// mewajibkan ekstensi eksis pada impor relatif, sementara tsconfig Expo memakai
// resolusi bundler yang justru menolak ekstensi. Menjaga semua aturan kotak
// masuk di satu berkas membuat kedua pembatasan itu tidak diperlukan.

export interface KeadaanKotak {
  /** Staf pemilik daftar ini. */
  userId: string;
  daftar: Notifikasi[];
  /**
   * Daftar sebelum perubahan terakhir, untuk dikembalikan kalau penyimpanan
   * ke database gagal. Null berarti tidak ada perubahan yang perlu dibatalkan.
   */
  gulungBalik: Notifikasi[] | null;
}

export type AksiKotak =
  | { jenis: 'muat'; userId: string; daftar: Notifikasi[] }
  | { jenis: 'tandai'; userId: string; id: string }
  | { jenis: 'tandaiSemua'; userId: string }
  | { jenis: 'hapus'; userId: string; id: string }
  | { jenis: 'hapusSemua'; userId: string }
  | { jenis: 'gulungBalik'; userId: string };

export function kotakAwal(): KeadaanKotak {
  return { userId: '', daftar: [], gulungBalik: null };
}

/**
 * Menerjemahkan aksi menjadi keadaan berikutnya.
 *
 * Murni: tidak menyentuh jaringan, waktu, atau state di luar argumennya.
 *
 * Dua jenis aksi punya aturan berbeda soal siapa pemilik daftar:
 *
 * - 'muat' selalu diterima, dan hasilnya yang menentukan pemilik. Kalau muat
 *   ikut ditolak saat pemiliknya berbeda, maka staf berikutnya yang masuk di
 *   perangkat yang sama tidak akan pernah mendapat daftar sama sekali, karena
 *   state lama masih ada dan tidak pernah dikosongkan.
 * - Aksi yang mengubah isi daftar ('tandai', 'tandaiSemua', 'hapus',
 *   'hapusSemua', 'gulungBalik') ditolak kalau pemiliknya berbeda. Ini yang
 *   mencegah hasil query lama milik staf A menimpa daftar yang sedang dilihat
 *   staf B.
 *
 * Kalau 'muat' untuk staf A tiba belakangan setelah staf B masuk, pemilik daftar
 * berubah jadi A dan layar menampilkan kosong, bukan menampilkan data A. Ini
 * mencegah kebocoran data: paling lama sebentar kosong.
 */
export function reducerKotak(
  keadaan: KeadaanKotak,
  aksi: AksiKotak
): KeadaanKotak {
  if (aksi.jenis === 'muat') {
    return { userId: aksi.userId, daftar: aksi.daftar, gulungBalik: null };
  }

  if (aksi.userId !== keadaan.userId) return keadaan;

  switch (aksi.jenis) {
    case 'tandai': {
      // Sudah dibaca: tidak ada yang berubah, dan tidak perlu ada snapshot.
      if (keadaan.daftar.some((item) => item.id === aksi.id && item.dibaca)) {
        return keadaan;
      }
      return {
        userId: keadaan.userId,
        daftar: tandaiDibaca(keadaan.daftar, aksi.id),
        gulungBalik: keadaan.daftar,
      };
    }

    case 'tandaiSemua': {
      const belumAda = keadaan.daftar.filter((item) => !item.dibaca);
      if (belumAda.length === 0) return keadaan;
      return {
        userId: keadaan.userId,
        daftar: tandaiSemuaDibaca(keadaan.daftar),
        gulungBalik: keadaan.daftar,
      };
    }

    case 'hapus': {
      // Tidak ada di daftar: tidak ada yang berubah, dan tidak perlu snapshot.
      if (!keadaan.daftar.some((item) => item.id === aksi.id)) return keadaan;
      return {
        userId: keadaan.userId,
        daftar: hapusDariDaftar(keadaan.daftar, aksi.id),
        gulungBalik: keadaan.daftar,
      };
    }

    case 'hapusSemua': {
      // Sudah kosong: tidak ada yang berubah, dan tidak perlu snapshot.
      if (keadaan.daftar.length === 0) return keadaan;
      return {
        userId: keadaan.userId,
        daftar: hapusSemuaDariDaftar(keadaan.daftar),
        gulungBalik: keadaan.daftar,
      };
    }

    case 'gulungBalik':
      return gulungBalikKotak(keadaan);

    default:
      return keadaan;
  }
}

/**
 * Mengembalikan daftar seperti semula setelah penyimpanan gagal.
 *
 * Snapshot pembatalan langsung dibuang setelah dipakai. Kalau tidak, snapshot itu
 * menggantung dan akan dipakai lagi untuk pembatalan yang tidak terkait,
 * mengembalikan daftar ke kondisi yang sudah usang.
 */
export function gulungBalikKotak(keadaan: KeadaanKotak): KeadaanKotak {
  if (!keadaan.gulungBalik) return keadaan;
  return { ...keadaan, daftar: keadaan.gulungBalik, gulungBalik: null };
}