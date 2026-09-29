import { getSlots, sortSlots } from './slots.js';

const EOL = '\r\n';

function pad(value) {
  return String(value).padStart(2, '0');
}

function utcStamp(value) {
  if (value === null || value === undefined || value === '') return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function escapeIcs(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldLine(line) {
  if (line.length <= 74) return line;
  const chunks = [line.slice(0, 74)];
  let rest = line.slice(74);
  while (rest.length > 73) {
    chunks.push(` ${rest.slice(0, 73)}`);
    rest = rest.slice(73);
  }
  if (rest) chunks.push(` ${rest}`);
  return chunks.join(EOL);
}

function safeFilename(title) {
  const slug = String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'jadwal';
}

export function buildIcs(schedule, slotsInput) {
  const slots = sortSlots(slotsInput ?? getSlots(schedule));
  if (slots.length === 0) return '';

  const stamp = utcStamp(new Date().toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Bawaslu Kota Bekasi//Sistem Pengingat Jadwal//ID',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  slots.forEach((slot, index) => {
    const start = utcStamp(slot.mulai);
    if (!start) return;
    const end = utcStamp(slot.selesai);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${schedule.id}-${index}@bawaslu-kota-bekasi`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${start}`);
    if (end) lines.push(`DTEND:${end}`);
    lines.push(`SUMMARY:${escapeIcs(schedule.judul)}`);
    if (schedule.kategori) lines.push(`CATEGORIES:${escapeIcs(schedule.kategori)}`);
    if (schedule.deskripsi) lines.push(`DESCRIPTION:${escapeIcs(schedule.deskripsi)}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join(EOL)}${EOL}`;
}

export function downloadIcs(schedule, slotsInput) {
  const ics = buildIcs(schedule, slotsInput);
  if (!ics) return false;

  const url = URL.createObjectURL(
    new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFilename(schedule.judul)}.ics`;
  anchor.rel = 'noopener';

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function buildGoogleLink(schedule, slot) {
  if (!slot) return '';

  const start = utcStamp(slot.mulai);
  if (!start) return '';

  const startMs = new Date(slot.mulai).getTime();
  const parsedEnd = slot.selesai ? new Date(slot.selesai).getTime() : Number.NaN;
  const endMs =
    Number.isNaN(parsedEnd) || parsedEnd <= startMs
      ? startMs + 60 * 60 * 1000
      : parsedEnd;
  const end = utcStamp(new Date(endMs).toISOString());
  if (!end) return '';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: String(schedule.judul ?? 'Jadwal'),
    dates: `${start}/${end}`,
  });

  const details = [schedule.kategori, schedule.deskripsi]
    .filter(Boolean)
    .join('\n\n');
  if (details) params.set('details', details);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
