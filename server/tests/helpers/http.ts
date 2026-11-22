export interface ApiError {
  code: string;
  message: string;
  details?: { location: string; path: string; message: string }[];
}

/** Supertest bodies are `any`; these narrow them once instead of casting in every test. */
export const errorOf = (body: unknown): ApiError => (body as { error: ApiError }).error;

// T is the caller's expected DTO type (a typed cast for test readability); single use is intended.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export const dataOf = <T>(body: unknown): T => (body as { data: T }).data;

export const metaOf = (body: unknown): { total: number; limit: number; offset: number } =>
  (body as { meta: { total: number; limit: number; offset: number } }).meta;

export const errorPaths = (body: unknown): string[] =>
  (errorOf(body).details ?? []).map((d) => `${d.location}.${d.path}`);
