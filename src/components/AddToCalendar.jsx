import { downloadIcs, buildGoogleLink } from '../lib/calendar';
import { getSlots, sortSlots } from '../lib/slots';

const LINK_CLASS =
  'inline-flex items-center rounded-full border border-bw-line bg-white px-2.5 py-1 text-[11px] font-semibold text-bw-muted transition-colors hover:border-bw-blue hover:text-bw-blue focus:outline-none focus:ring-2 focus:ring-bw-blue/40';

export default function AddToCalendar({ schedule }) {
  const slots = sortSlots(getSlots(schedule));
  if (slots.length === 0) return null;

  const now = Date.now();
  const next =
    slots.find((slot) => new Date(slot.mulai).getTime() >= now) ?? slots[0];
  const href = buildGoogleLink(schedule, next);
  if (!href) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={LINK_CLASS}
      >
        Google Calendar
      </a>
      <button
        type="button"
        onClick={() => downloadIcs(schedule, slots)}
        className={LINK_CLASS}
      >
        Unduh .ics
      </button>
    </div>
  );
}
