export function getSlots(schedule) {
  const raw = schedule?.slots;

  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter((slot) => slot && slot.mulai);
  }

  if (schedule?.waktu_mulai) {
    return [
      {
        mulai: schedule.waktu_mulai,
        selesai: schedule.waktu_selesai ?? null,
      },
    ];
  }

  return [];
}

export function slotDayKey(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function sortSlots(slots) {
  return [...slots].sort(
    (a, b) => new Date(a.mulai).getTime() - new Date(b.mulai).getTime()
  );
}

export function resolveAgenda(slots, now = Date.now()) {
  const items = sortSlots(slots)
    .map((slot) => ({
      start: new Date(slot.mulai).getTime(),
      end: slot.selesai ? new Date(slot.selesai).getTime() : null,
    }))
    .filter((item) => !Number.isNaN(item.start));

  const ongoing = items.find(
    (item) => item.start <= now && (item.end === null || item.end >= now)
  );
  if (ongoing) return { state: 'ongoing', nextStart: null };

  const upcoming = items.find((item) => item.start > now);
  if (upcoming) return { state: 'upcoming', nextStart: upcoming.start };

  return { state: 'done', nextStart: null };
}
