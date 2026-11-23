/**
 * libpq-style TLS query parameters that hosted Postgres URLs carry, e.g. Neon's
 * `?sslmode=require&channel_binding=require`.
 *
 * node-postgres treats these badly for us: the parsed URL is merged OVER the explicit pool config
 * (so `sslmode` replaces our `ssl: { rejectUnauthorized: true }`), `sslmode=require` prints a
 * SECURITY WARNING (pg v9 will turn it into "encrypt but don't verify"), and `channel_binding` is
 * ignored. So the app reads them, strips them, and sets `ssl` / `enableChannelBinding` itself.
 */
export const TLS_QUERY_PARAMS = ['sslmode', 'channel_binding'] as const;

export interface TlsParams {
  sslmode: string | null;
  channelBinding: string | null;
}

/** sslmode values that demand TLS, and ones that would weaken or disable it. */
export const SSLMODES_REQUIRING_TLS: ReadonlySet<string> = new Set([
  'require',
  'verify-ca',
  'verify-full',
]);
export const SSLMODES_WITHOUT_VERIFICATION: ReadonlySet<string> = new Set(['disable', 'no-verify']);

/** Throws a TypeError for an unparseable URL; callers decide how to report it (never echo it). */
export const readTlsParams = (connectionString: string): TlsParams => {
  const { searchParams } = new URL(connectionString);
  return {
    sslmode: searchParams.get('sslmode'),
    channelBinding: searchParams.get('channel_binding'),
  };
};

/** The same URL without the TLS parameters above; every other parameter is kept as-is. */
export const withoutTlsParams = (connectionString: string): string => {
  const url = new URL(connectionString);
  for (const param of TLS_QUERY_PARAMS) url.searchParams.delete(param);
  return url.toString();
};
