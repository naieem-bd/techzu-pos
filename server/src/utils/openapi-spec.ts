import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

/**
 * docs/openapi.yaml at the repo root. This file sits at the same depth in `src/utils` and
 * `dist/utils`, so one relative path works for `tsx`, ts-jest and the compiled build.
 */
export const DEFAULT_OPENAPI_SPEC_PATH = path.resolve(__dirname, '../../../docs/openapi.yaml');

export interface OpenApiSpec {
  openapi: string;
  info: Record<string, unknown>;
  paths: Record<string, unknown>;
  [key: string]: unknown;
}

/** A missing or broken spec is a value, not a throw: the API must keep working without docs. */
export type OpenApiSpecResult = { ok: true; spec: OpenApiSpec } | { ok: false; reason: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Reads and parses the spec once. Only a shallow shape check is done here (OpenAPI 3.1 with
 * `info` and `paths`); the test suite checks the contents in depth.
 */
export const loadOpenApiSpec = (filePath: string): OpenApiSpecResult => {
  let text: string;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch (err) {
    return { ok: false, reason: `cannot read ${filePath}: ${messageOf(err)}` };
  }

  let doc: unknown;
  try {
    // logLevel 'error': throw on errors, never print warnings to the console ('silent' would
    // swallow errors too). yaml's default alias limit guards against "billion laughs" input.
    doc = parse(text, { logLevel: 'error' });
  } catch (err) {
    return { ok: false, reason: `invalid YAML in ${filePath}: ${messageOf(err)}` };
  }

  if (
    !isRecord(doc) ||
    typeof doc.openapi !== 'string' ||
    !doc.openapi.startsWith('3.1.') ||
    !isRecord(doc.info) ||
    !isRecord(doc.paths)
  ) {
    return { ok: false, reason: `${filePath} is not an OpenAPI 3.1 document with info and paths` };
  }

  return { ok: true, spec: { ...doc, openapi: doc.openapi, info: doc.info, paths: doc.paths } };
};
