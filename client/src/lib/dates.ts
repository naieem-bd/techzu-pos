/** "YYYY-MM-DD" from an <input type="date">, interpreted as a LOCAL calendar date. */
const parseLocalDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Invalid date: ${value}`);
  }
  return new Date(year, month - 1, day);
};

const pad = (n: number): string => n.toString().padStart(2, '0');

export const toDateInputValue = (date: Date): string =>
  `${date.getFullYear().toString()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export interface DateRangeParams {
  from: string;
  to: string;
}

/**
 * The UI's From/To are inclusive local days. The API wants ISO datetimes with an offset and an
 * EXCLUSIVE `to`, so: from = local midnight of `fromDate`, to = local midnight of the day after
 * `toDate`. toISOString() expresses both instants in UTC ("Z"), which is a valid offset.
 */
export const toRangeParams = (fromDate: string, toDate: string): DateRangeParams => {
  const start = parseLocalDate(fromDate);
  const endExclusive = parseLocalDate(toDate);
  endExclusive.setDate(endExclusive.getDate() + 1);
  return { from: start.toISOString(), to: endExclusive.toISOString() };
};

export interface DateInputRange {
  fromDate: string;
  toDate: string;
}

/** First day of the current month -> today, as date-input values. */
export const monthToDate = (now: Date = new Date()): DateInputRange => ({
  fromDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
  toDate: toDateInputValue(now),
});

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** ISO timestamp -> "12 Nov 2026" in the viewer's timezone. */
export const formatDate = (iso: string): string => DATE_FORMAT.format(new Date(iso));

/** "2026-11-01", "2026-11-22" -> "1 Nov 2026 – 22 Nov 2026" */
export const formatDateRange = ({ fromDate, toDate }: DateInputRange): string =>
  `${DATE_FORMAT.format(parseLocalDate(fromDate))} – ${DATE_FORMAT.format(parseLocalDate(toDate))}`;

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** ISO timestamp -> "22 Nov, 10:58" in the viewer's timezone. */
export const formatDateTime = (iso: string): string => DATE_TIME_FORMAT.format(new Date(iso));
