const base = new URL('../src/lib/calendar.js', import.meta.url);

const { buildIcs, buildGoogleLink } = await import(base.href);

const schedule = {
  id: 'abc-123',
  judul: 'Rapat Koordinasi, Divisi; Humas',
  kategori: 'Rapat',
  deskripsi: 'Baris satu\nBaris dua, dengan koma dan backslash \\ seharusnya aman',
  slots: [
    { mulai: '2026-10-05T09:00:00+07:00', selesai: '2026-10-05T11:00:00+07:00' },
    { mulai: '2026-10-07T13:30:00+07:00', selesai: null },
  ],
};

const ics = buildIcs(schedule);
console.log('--- ICS ---');
console.log(ics);

const lines = ics.split('\r\n');
let ok = true;

const checks = [
  ['CRLF endings (no lone LF)', !ics.replace(/\r\n/g, '').includes('\n')],
  ['starts BEGIN:VCALENDAR', ics.startsWith('BEGIN:VCALENDAR')],
  ['ends END:VCALENDAR\\r\\n', ics.endsWith('END:VCALENDAR\r\n')],
  ['2 VEVENT', (ics.match(/BEGIN:VEVENT/g) || []).length === 2],
  ['no raw newline in value', !ics.replace(/\r\n/g, '').includes('\n')],
  ['line <= 75 octets', lines.every((l) => Buffer.byteLength(l, 'utf8') <= 75)],
  ['DTSTART WIB->UTC = 09:00+07 => 02:00Z', ics.includes('DTSTART:20261005T020000Z')],
  ['DTEND 11:00+07 => 04:00Z', ics.includes('DTEND:20261005T040000Z')],
  ['slot tanpa selesai => tanpa DTEND', ics.includes('DTSTART:20261007T063000Z') && !/DTEND:1970|DTEND:20261007/.test(ics)],
  ['slot tanpa selesai => epoch tidak bocor', !ics.includes('19700101')],
  ['escaping koma', ics.includes('SUMMARY:Rapat Koordinasi\\, Divisi\\; Humas')],
  ['escaping newline', ics.includes('DESCRIPTION:Baris satu\\nBaris dua\\, dengan koma')],
  ['escaping backslash', /backslash \\\\ seharusnya/.test(ics.replace(/\r\n /g, ''))],
  ['UID unik per slot', /UID:abc-123-0@/.test(ics) && /UID:abc-123-1@/.test(ics)],
];

const empty = buildIcs({ id: 'x', judul: 'Kosong', slots: [] });
checks.push(['slots kosong => string kosong', empty === '']);

const legacy = buildIcs({ id: 'y', judul: 'Legacy', waktu_mulai: '2026-11-01T08:00:00+07:00', waktu_selesai: '2026-11-01T09:00:00+07:00' });
checks.push(['fallback waktu_mulai', legacy.includes('DTSTART:20261101T010000Z')]);

const link = buildGoogleLink(schedule, schedule.slots[0]);
console.log('--- GOOGLE ---');
console.log(link);
checks.push(['google action=TEMPLATE', link.includes('action=TEMPLATE')]);
checks.push(['google dates format', /dates=20261005T020000Z%2F20261005T040000Z/.test(link)]);
checks.push(['google encode koma', link.includes('text=Rapat+Koordinasi%2C')]);

const linkNoEnd = buildGoogleLink(schedule, schedule.slots[1]);
checks.push(['google tanpa selesai => +1 jam', /dates=20261007T063000Z%2F20261007T073000Z/.test(linkNoEnd)]);

const badSlot = buildIcs({ id: 'z', judul: 'Z', slots: [{ mulai: null, selesai: null }, { mulai: '2026-12-01T10:00:00Z', selesai: null }] });
checks.push(['slot tanpa mulai dilewati', (badSlot.match(/BEGIN:VEVENT/g) || []).length === 1]);
checks.push(['slot tanpa mulai tidak jadi epoch', !badSlot.includes('19700101')]);

for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
  if (!pass) ok = false;
}

console.log(ok ? '\nSEMUA LULUS' : '\nADA YG GAGAL');
process.exit(ok ? 0 : 1);
