/**
 * UTC datetime utilities — all business timestamps are stored and exchanged in UTC.
 * API output uses ISO 8601 with Z suffix; inputs must include timezone (offset or Z).
 */

const ISO_INSTANT_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

/** Space-separated local datetime without timezone — rejected by parseIsoInstantToUtcDate */
const NAIVE_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/;

/**
 * Current instant as a Date (UTC epoch internally; use for DB writes with connection timezone +00:00).
 */
export function nowUtc(): Date {
  return new Date();
}

/**
 * Serialize a Date to ISO 8601 UTC string, e.g. 2026-05-14T09:30:00.000Z
 */
export function toIsoUtc(
  value: Date | string | number | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toISOString();
}

/**
 * Parse an ISO 8601 instant string (must include Z or numeric offset). Rejects naive local strings.
 */
export function parseIsoInstantToUtcDate(value: string): Date {
  const trimmed = value.trim();
  if (NAIVE_DATETIME_REGEX.test(trimmed)) {
    throw new Error(
      'Datetime must include timezone (ISO 8601 with Z or offset, e.g. 2026-05-14T09:30:00.000Z)',
    );
  }
  if (!ISO_INSTANT_REGEX.test(trimmed)) {
    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid ISO datetime: ${value}`);
    }
    const asDate = new Date(parsed);
    if (!trimmed.includes('Z') && !/[+-]\d{2}:?\d{2}$/.test(trimmed)) {
      throw new Error(
        'Datetime must include timezone (ISO 8601 with Z or offset, e.g. 2026-05-14T09:30:00.000Z)',
      );
    }
    return asDate;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid ISO datetime: ${value}`);
  }
  return d;
}

/**
 * Convert a local calendar day in an IANA timezone to UTC [start, end) for DB range queries.
 */
export function parseLocalDateRangeToUtcRange(
  localDate: string,
  timezone: string,
): { startUtc: Date; endUtc: Date } {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateOnly.test(localDate)) {
    throw new Error('localDate must be YYYY-MM-DD');
  }
  const startIso = localDateToUtcIso(localDate, timezone, 0, 0, 0);
  const nextDay = addDaysToDateString(localDate, 1);
  const endIso = localDateToUtcIso(nextDay, timezone, 0, 0, 0);
  return {
    startUtc: new Date(startIso),
    endUtc: new Date(endIso),
  };
}

function addDaysToDateString(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Build UTC instant for local wall-clock in IANA zone (uses Intl for offset).
 */
function localDateToUtcIso(
  localDate: string,
  timezone: string,
  hour: number,
  minute: number,
  second: number,
): string {
  const [y, m, d] = localDate.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d, hour, minute, second));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(probe);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '0';
  const zy = Number(get('year'));
  const zm = Number(get('month'));
  const zd = Number(get('day'));
  const zh = Number(get('hour'));
  const zmin = Number(get('minute'));
  const zs = Number(get('second'));
  const displayedAsUtc = Date.UTC(zy, zm - 1, zd, zh, zmin, zs);
  const desiredAsUtc = Date.UTC(y, m - 1, d, hour, minute, second);
  const offsetMs = displayedAsUtc - desiredAsUtc;
  return new Date(desiredAsUtc - offsetMs).toISOString();
}
