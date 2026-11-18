const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(locale: string): Intl.DateTimeFormat {
  let formatter = formatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    formatters.set(locale, formatter);
  }
  return formatter;
}

/**
 * Long calendar date (`9 de noviembre de 2026`) of a `YYYY-MM-DD` value, read as UTC so the day
 * never moves with the host's time zone (spec004 FR-042). The single policy for an absent or
 * invalid date is `null`: each view decides what to show instead (nothing, "No date", the raw text).
 */
export function formatLongDateUtc(locale: string, value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : formatterFor(locale).format(date);
}
