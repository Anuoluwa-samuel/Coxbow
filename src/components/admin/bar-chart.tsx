import { formatNaira } from "@/lib/money";

/** Simple, dependency-free bar chart. Bars are decorative; an accessible table carries the same numbers. */
export function BarChart({ data, caption }: { data: { label: string; kobo: number }[]; caption: string }) {
  const max = Math.max(...data.map((d) => d.kobo), 1);
  return (
    <figure>
      <div aria-hidden className="flex h-44 items-end gap-3 border-b border-line px-1 pt-2">
        {data.map((d) => (
          <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[0.7rem] font-semibold text-ink-soft">{d.kobo > 0 ? formatNaira(d.kobo) : "–"}</span>
            <div className="w-full max-w-14 rounded-t-lg bg-gradient-to-t from-forest-800 to-forest-600 transition-all" style={{ height: `${Math.max(d.kobo > 0 ? 6 : 2, (d.kobo / max) * 78)}%` }} />
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-2 flex gap-3 px-1">{data.map((d) => <span key={d.label} className="flex-1 text-center text-xs text-ink-mute">{d.label}</span>)}</div>
      <figcaption className="sr-only">{caption}</figcaption>
      <table className="sr-only"><caption>{caption}</caption><thead><tr><th>Period</th><th>Verified payments</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.label}><td>{d.label}</td><td>{formatNaira(d.kobo)}</td></tr>)}</tbody></table>
    </figure>
  );
}
