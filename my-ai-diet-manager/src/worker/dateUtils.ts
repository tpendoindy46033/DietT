/** All dates are plain YYYY-MM-DD strings; the frontend resolves "today" in the user's timezone. */

export function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function addDays(dateStr: string, delta: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function dateRangeEndingAt(endDateStr: string, days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(addDays(endDateStr, -i));
  }
  return dates;
}

export function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
