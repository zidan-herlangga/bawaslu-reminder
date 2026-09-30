import { useEffect, useState } from 'react';

function pad(value) {
  return String(value).padStart(2, '0');
}

export default function ClockWidget() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const tanggal = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <section className="rounded-xl border border-bw-blue-200 bg-gradient-to-br from-bw-blue to-bw-blue-hi p-4 text-white shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">
          Waktu Sekarang
        </p>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
          WIB
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-display text-[36px] font-bold leading-none tracking-tight tabular-nums">
          {pad(now.getHours())}:{pad(now.getMinutes())}
        </span>
        <span className="font-display text-lg font-semibold leading-none tabular-nums text-white/70">
          :{pad(now.getSeconds())}
        </span>
      </div>

      <p className="mt-2.5 border-t border-white/25 pt-2.5 text-xs text-white/85">
        {tanggal}
      </p>
    </section>
  );
}
