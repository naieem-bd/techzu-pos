/**
 * Money arrives from the API as decimal strings ("4.50") and is sent back as strings. It is never
 * parsed to a float: arithmetic happens on integer cents (BigInt), display works on the string.
 */

/** Same rule as the server's MoneyInput: non-negative, up to 10 integer digits, 0-2 decimals. */
export const MONEY_INPUT_RE = /^\d{1,10}(\.\d{1,2})?$/;

const CURRENCY_SYMBOL = '$';
const MONEY_RE = /^(\d+)(?:\.(\d{1,2}))?$/;

export const isMoneyInput = (value: string): boolean => MONEY_INPUT_RE.test(value);

/** "4.5" -> 450n. Throws on anything that is not a non-negative decimal string. */
export const toCents = (value: string): bigint => {
  const match = MONEY_RE.exec(value.trim());
  if (!match?.[1]) throw new Error(`Invalid money value: ${value}`);
  const fraction = (match[2] ?? '').padEnd(2, '0');
  return BigInt(match[1]) * 100n + BigInt(fraction);
};

/** 450n -> "4.50" */
export const fromCents = (cents: bigint): string => {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return `${whole.toString()}.${fraction}`;
};

/** Canonical two-decimal form of a valid amount ("4.5" -> "4.50"), for comparisons. */
export const normalizeMoney = (value: string): string => fromCents(toCents(value));

const groupThousands = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "1234.5" -> "$1,234.50". The single display helper for every amount in the UI. */
export const formatMoney = (value: string): string => {
  const [whole = '0', fraction = '00'] = normalizeMoney(value).split('.');
  return `${CURRENCY_SYMBOL}${groupThousands(whole)}.${fraction}`;
};

/** total / count rounded half-up to cents; null when count is 0. */
export const averageMoney = (total: string, count: number): string | null => {
  if (count <= 0) return null;
  const divisor = BigInt(count);
  return fromCents((toCents(total) * 2n + divisor) / (divisor * 2n));
};

/** Bar width in percent (0-100) of `part` relative to `max`. Display ratio only, not money. */
export const percentOf = (part: string, max: string): number => {
  const maxCents = toCents(max);
  if (maxCents === 0n) return 0;
  return Number((toCents(part) * 10000n) / maxCents) / 100;
};
