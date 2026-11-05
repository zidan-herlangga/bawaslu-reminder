import { supabase } from './supabase';

const SKU_FALLBACK = {
  2026: [
    { tanggal: '01-01', nama: 'Tahun Baru 2026 Masehi', jenis: 'libur' },
    { tanggal: '01-16', nama: 'Isra Mikraj Nabi Muhammad SAW', jenis: 'libur' },
    { tanggal: '02-16', nama: 'Tahun Baru Imlek 2577 Kongzili', jenis: 'cuti' },
    { tanggal: '02-17', nama: 'Tahun Baru Imlek 2577 Kongzili', jenis: 'libur' },
    { tanggal: '03-18', nama: 'Hari Suci Nyepi (Tahun Baru Saka 1948)', jenis: 'cuti' },
    { tanggal: '03-19', nama: 'Hari Suci Nyepi (Tahun Baru Saka 1948)', jenis: 'libur' },
    { tanggal: '03-20', nama: 'Idulfitri 1447 Hijriah', jenis: 'cuti' },
    { tanggal: '03-21', nama: 'Idulfitri 1447 Hijriah', jenis: 'libur' },
    { tanggal: '03-22', nama: 'Idulfitri 1447 Hijriah', jenis: 'libur' },
    { tanggal: '03-23', nama: 'Idulfitri 1447 Hijriah', jenis: 'cuti' },
    { tanggal: '03-24', nama: 'Idulfitri 1447 Hijriah', jenis: 'cuti' },
    { tanggal: '04-03', nama: 'Wafat Yesus Kristus', jenis: 'libur' },
    { tanggal: '04-05', nama: 'Kebangkitan Yesus Kristus (Paskah)', jenis: 'libur' },
    { tanggal: '05-01', nama: 'Hari Buruh Internasional', jenis: 'libur' },
    { tanggal: '05-14', nama: 'Kenaikan Yesus Kristus', jenis: 'libur' },
    { tanggal: '05-15', nama: 'Kenaikan Yesus Kristus', jenis: 'cuti' },
    { tanggal: '05-27', nama: 'Iduladha 1447 Hijriah', jenis: 'libur' },
    { tanggal: '05-28', nama: 'Iduladha 1447 Hijriah', jenis: 'cuti' },
    { tanggal: '05-31', nama: 'Hari Raya Waisak 2570 BE', jenis: 'libur' },
    { tanggal: '06-01', nama: 'Hari Lahir Pancasila', jenis: 'libur' },
    { tanggal: '06-16', nama: '1 Muharam, Tahun Baru Islam 1448 Hijriah', jenis: 'libur' },
    { tanggal: '08-17', nama: 'Proklamasi Kemerdekaan RI', jenis: 'libur' },
    { tanggal: '08-25', nama: 'Maulid Nabi Muhammad SAW', jenis: 'libur' },
    { tanggal: '12-24', nama: 'Kelahiran Yesus Kristus', jenis: 'cuti' },
    { tanggal: '12-25', nama: 'Kelahiran Yesus Kristus', jenis: 'libur' },
  ],
  2027: [
    { tanggal: '01-01', nama: 'Tahun Baru 2027 Masehi', jenis: 'libur' },
    { tanggal: '01-05', nama: 'Isra Mikraj Nabi Muhammad SAW', jenis: 'libur' },
    { tanggal: '02-05', nama: 'Tahun Baru Imlek 2578 Kongzili', jenis: 'cuti' },
    { tanggal: '02-06', nama: 'Tahun Baru Imlek 2578 Kongzili', jenis: 'libur' },
    { tanggal: '03-08', nama: 'Hari Suci Nyepi (Tahun Baru Saka 1949)', jenis: 'libur' },
    { tanggal: '03-09', nama: 'Idulfitri 1448 Hijriah', jenis: 'cuti' },
    { tanggal: '03-10', nama: 'Idulfitri 1448 Hijriah', jenis: 'libur' },
    { tanggal: '03-11', nama: 'Idulfitri 1448 Hijriah', jenis: 'libur' },
    { tanggal: '03-12', nama: 'Idulfitri 1448 Hijriah', jenis: 'cuti' },
    { tanggal: '03-15', nama: 'Idulfitri 1448 Hijriah', jenis: 'cuti' },
    { tanggal: '03-25', nama: 'Wafat Yesus Kristus', jenis: 'cuti' },
    { tanggal: '03-26', nama: 'Wafat Yesus Kristus', jenis: 'libur' },
    { tanggal: '03-28', nama: 'Kebangkitan Yesus Kristus (Paskah)', jenis: 'libur' },
    { tanggal: '05-01', nama: 'Hari Buruh Internasional', jenis: 'libur' },
    { tanggal: '05-06', nama: 'Kenaikan Yesus Kristus', jenis: 'libur' },
    { tanggal: '05-17', nama: 'Iduladha 1448 Hijriah', jenis: 'libur' },
    { tanggal: '05-18', nama: 'Iduladha 1448 Hijriah', jenis: 'cuti' },
    { tanggal: '05-19', nama: 'Hari Raya Waisak 2571 BE', jenis: 'cuti' },
    { tanggal: '05-20', nama: 'Hari Raya Waisak 2571 BE', jenis: 'libur' },
    { tanggal: '06-01', nama: 'Hari Lahir Pancasila', jenis: 'libur' },
    { tanggal: '06-06', nama: '1 Muharam, Tahun Baru Islam 1449 Hijriah', jenis: 'libur' },
    { tanggal: '08-15', nama: 'Maulid Nabi Muhammad SAW', jenis: 'libur' },
    { tanggal: '08-17', nama: 'Proklamasi Kemerdekaan RI', jenis: 'libur' },
    { tanggal: '12-24', nama: 'Kelahiran Yesus Kristus', jenis: 'cuti' },
    { tanggal: '12-25', nama: 'Kelahiran Yesus Kristus', jenis: 'libur' },
    { tanggal: '12-26', nama: 'Isra Mikraj Nabi Muhammad SAW', jenis: 'libur' },
  ],
};

function normalisasiJenis(jenis) {
  const lower = String(jenis || '').toLowerCase();
  if (lower.includes('cuti')) return 'cuti_bersama';
  return 'libur_nasional';
}

function formatTanggal(year, mmdd) {
  const [m, d] = mmdd.split('-');
  return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export async function getHolidays(year) {
  const { data, error } = await supabase
    .from('hari_libur')
    .select('tanggal, keterangan, jenis, tahun')
    .eq('tahun', year)
    .order('tanggal', { ascending: true });

  if (error) {
    console.error('[holidays] gagal ambil hari_libur:', error.message);
    return [];
  }

  return data || [];
}

async function syncFromFallback(year) {
  const daftar = SKU_FALLBACK[year] || [];
  if (daftar.length === 0) return { ok: false, count: 0 };
  
  const entries = daftar.map((item) => ({
    tanggal: formatTanggal(year, item.tanggal),
    keterangan: item.nama,
    jenis: item.jenis === 'cuti' ? 'cuti_bersama' : 'libur_nasional',
    tahun: year,
  }));
  
  const { error } = await supabase
    .from('hari_libur')
    .upsert(entries, { onConflict: 'tanggal', ignoreDuplicates: false });
  
  if (error) {
    console.error('[holidays] gagal simpan hari_libur fallback:', error.message);
    return { ok: false, count: 0 };
  }
  
  return { ok: true, count: entries.length };
}

export async function syncHolidays(year) {
  return syncFromFallback(year);
}

export async function ensureHolidays(year) {
  const existing = await getHolidays(year);
  if (existing.length > 0) return existing;
  await syncHolidays(year);
  return getHolidays(year);
}

export function isLiburNasional(holidays, tanggal) {
  return holidays.find((h) => h.tanggal === tanggal && h.jenis === 'libur_nasional') || null;
}

export function isCutiBersama(holidays, tanggal) {
  return holidays.find((h) => h.tanggal === tanggal && h.jenis === 'cuti_bersama') || null;
}

export function getLiburInfo(holidays, tanggal) {
  const libur = holidays.find((h) => h.tanggal === tanggal);
  if (!libur) return null;
  return {
    nama: libur.keterangan,
    jenis: libur.jenis === 'cuti_bersama' ? 'cuti' : 'nasional',
    keterangan: libur.keterangan,
  };
}
