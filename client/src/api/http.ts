/**
 * The only place the client talks HTTP. Success bodies are `{ data, meta? }`; error bodies are
 * `{ error: { code, message, details? } }` and become a thrown ApiError carrying the server's
 * message, which the UI shows as-is in a toast.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
}

export interface Envelope<TData, TMeta = undefined> {
  data: TData;
  meta: TMeta;
}

const API_BASE = '/api';

const buildUrl = (path: string, query: RequestOptions['query']): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return `${API_BASE}${path}${search ? `?${search}` : ''}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

const toApiError = (status: number, body: unknown): ApiError => {
  const error = isRecord(body) ? body.error : undefined;
  if (isRecord(error) && typeof error.code === 'string' && typeof error.message === 'string') {
    return new ApiError(status, error.code, error.message, error.details);
  }
  return new ApiError(status, 'UNKNOWN_ERROR', `Request failed with status ${status.toString()}`);
};

/** Low-level request returning the whole envelope (for endpoints whose `meta` matters). */
export const requestEnvelope = async <TData, TMeta = undefined>(
  path: string,
  options: RequestOptions = {},
): Promise<Envelope<TData, TMeta>> => {
  const { method = 'GET', query, body, signal } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  if (signal) init.signal = signal;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), init);
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection.');
  }

  const json = await readJson(response);
  if (!response.ok) throw toApiError(response.status, json);
  // 204 No Content (e.g. unassign) has no envelope.
  if (!isRecord(json)) return { data: undefined as TData, meta: undefined as TMeta };
  return { data: json.data as TData, meta: json.meta as TMeta };
};

/** Request returning only `data`. */
export const request = async <TData>(path: string, options?: RequestOptions): Promise<TData> =>
  (await requestEnvelope<TData>(path, options)).data;
