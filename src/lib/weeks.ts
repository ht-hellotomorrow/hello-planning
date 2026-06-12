// Tutte le settimane sono identificate dalla data del Lunedì (UTC, yyyy-mm-dd).
// Lavoriamo in UTC per evitare problemi di timezone/DST.

export function parseISO(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function toMonday(d: Date): Date {
  const day = d.getUTCDay(); // 0=Dom .. 6=Sab
  const diff = day === 0 ? -6 : 1 - day;
  const r = new Date(d);
  r.setUTCDate(d.getUTCDate() + diff);
  r.setUTCHours(0, 0, 0, 0);
  return r;
}

export function addWeeks(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(d.getUTCDate() + 7 * n);
  return r;
}

export function weeksBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (7 * 86400000));
}

export function weekRange(startMonday: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => addWeeks(startMonday, i));
}

const MONTH_NAMES = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

export function monthLabel(d: Date): string {
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function dayMonth(d: Date): string {
  return `${d.getUTCDate()}`;
}

const MONTH_ABBR = [
  "GEN",
  "FEB",
  "MAR",
  "APR",
  "MAG",
  "GIU",
  "LUG",
  "AGO",
  "SET",
  "OTT",
  "NOV",
  "DIC",
];

export function weekDayLabel(d: Date): string {
  return `${d.getUTCDate()} ${MONTH_ABBR[d.getUTCMonth()]}`;
}

export type MonthSpan = { label: string; count: number };

export function groupByMonth(weeks: Date[]): MonthSpan[] {
  const out: MonthSpan[] = [];
  for (const w of weeks) {
    const label = monthLabel(w);
    const last = out[out.length - 1];
    if (last && last.label === label) {
      last.count += 1;
    } else {
      out.push({ label, count: 1 });
    }
  }
  return out;
}

export function todayMondayISO(): string {
  return isoDate(toMonday(new Date()));
}

export function defaultViewStartISO(weeksBeforeToday = 2): string {
  const monday = toMonday(new Date());
  return isoDate(addWeeks(monday, -weeksBeforeToday));
}

// Primo lunedì del mese a `monthOffset` rispetto al mese di `d`.
// monthOffset = -1 → primo lunedì del mese precedente.
// "Primo lunedì" = toMonday(giorno 1) — può cadere nel mese precedente
// (gestiamo questo prendendo direttamente il giorno 1 se è lunedì,
// altrimenti il lunedì successivo).
export function firstMondayOfMonthOffset(d: Date, monthOffset: number): Date {
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + monthOffset, 1),
  );
  const day = target.getUTCDay(); // 0=Dom .. 6=Sab
  const daysToAdd = day === 1 ? 0 : day === 0 ? 1 : 8 - day;
  const r = new Date(target);
  r.setUTCDate(target.getUTCDate() + daysToAdd);
  r.setUTCHours(0, 0, 0, 0);
  return r;
}
