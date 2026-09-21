/** Returns today's date as YYYY-MM-DD in the given IANA timezone. */
export function todayInTimezone(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Returns the current time as HH:MM in the given IANA timezone. */
export function nowTimeInTimezone(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().slice(11, 16);
  }
}

export function addDaysLocal(dateStr: string, delta: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDateLabel(dateStr: string, options: { weekday?: boolean } = {}): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = date.getUTCDate();
  if (options.weekday) {
    const weekday = WEEKDAY_LABELS[date.getUTCDay()];
    return `${weekday}, ${month} ${day}`;
  }
  return `${month} ${day}`;
}

export function formatTimeLabel(time: string): string {
  const [hourStr, minuteStr] = time.split(":");
  const hour = Number(hourStr);
  const minute = minuteStr ?? "00";
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${period}`;
}

export function isToday(dateStr: string, timezone: string): boolean {
  return dateStr === todayInTimezone(timezone);
}
