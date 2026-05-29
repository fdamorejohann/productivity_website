/**
 * date.ts — date utility functions.
 *
 * All weeks start on Monday. Functions here are pure (no side-effects) and
 * work with YYYY-MM-DD strings or Date objects. Keeping date logic isolated
 * here means the rest of the app never has to think about day-of-week math.
 *
 * Important: when constructing a Date from a YYYY-MM-DD string, always append
 * "T00:00:00" to force local-timezone parsing. Without it, Date() treats the
 * string as UTC midnight, which shifts to the previous day in negative-offset
 * time zones (e.g. US timezones).
 */

/**
 * Returns the Monday of the week that contains `date`.
 * Sunday (getDay() === 0) gets diff = -6, rolling back to the previous Monday.
 */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, …, 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Formats a Date as a YYYY-MM-DD string using local time.
 * Used for CompletionLog.date, PlannedTask.date, and map keys.
 */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns the 7 YYYY-MM-DD strings for Mon–Sun of the week starting at `weekStart`.
 * Used to build the planner columns and to scope log lookups to one week.
 */
export function currentWeekKeys(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return toDateString(d);
  });
}

/** Returns today's date as a YYYY-MM-DD string. */
export function today(): string {
  return toDateString(new Date());
}

/** Formats a YYYY-MM-DD string as "Jan 5", "Dec 31", etc. */
export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Returns the abbreviated weekday name for a YYYY-MM-DD string ("Mon", "Tue", …). */
export function getDayName(dateStr: string, short = true): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: short ? "short" : "long" });
}

/** Returns the Monday of the week before the given week start. */
export function prevWeekStart(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() - 7);
  return d;
}

/**
 * Returns all week-start Mondays whose 7-day range overlaps with the given month.
 * Used by getMonthAverage() to find all weeks to average over.
 *
 * A week "overlaps" the month if any of its days fall inside the month — so the
 * first and last weeks of the month may start in an adjacent month.
 */
export function weeksInMonth(year: number, month: number): Date[] {
  const weeks: Date[] = [];
  let w = startOfWeek(new Date(year, month, 1));

  while (true) {
    const weekEnd = new Date(w);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Stop once we've moved fully past the target month
    if (w.getFullYear() > year || (w.getFullYear() === year && w.getMonth() > month)) break;

    if (weekEnd.getMonth() >= month || weekEnd.getFullYear() > year) {
      weeks.push(new Date(w));
    }

    w = new Date(w);
    w.setDate(w.getDate() + 7);
  }

  return weeks;
}
