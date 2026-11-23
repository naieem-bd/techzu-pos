import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
import {
  readTlsParams,
  SSLMODES_REQUIRING_TLS,
  SSLMODES_WITHOUT_VERIFICATION,
} from '../utils/connection-string';

// `npm run <x> -w server` runs with cwd=server/, while the .env file lives at the repo root.
// Variables already present in the environment always win (dotenv never overrides them).
dotenv.config({
  path: [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../.env')],
  quiet: true,
});

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

// `z.coerce.boolean()` would turn the string "false" into `true`, so parse explicitly.
const booleanString = z
  .enum(['true', 'false'], { message: 'must be "true" or "false"' })
  .transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z
      .string({ message: 'is required' })
      .regex(/^postgres(ql)?:\/\/.+/, 'must be a postgres:// connection string')
      // The pool reads/strips its TLS query parameters, so it must parse as a URL
      // (URL-encode special characters in the password).
      .refine((value) => URL.canParse(value), 'must be a valid URL (URL-encode the password)'),
    CORS_ORIGIN: z
      .string({ message: 'is required' })
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0),
      )
      .pipe(z.array(z.url({ message: 'each origin must be a valid URL' })).min(1)),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    DB_SSL: booleanString.default(false),
    // Max pg connections per process. Keep it below the server's max_connections
    // (managed Postgres plans often allow only 25-100 in total).
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    // Run the idempotent demo seed after migrations when the production entrypoint starts.
    SEED_ON_START: booleanString.default(false),
  })
  .superRefine((env, ctx) => {
    // DB_SSL is the one switch for TLS (see db/pool-config.ts). A connection string that says
    // otherwise is a misconfiguration: fail at startup instead of silently picking one.
    // An unparseable URL is already reported on DATABASE_URL above.
    if (!URL.canParse(env.DATABASE_URL)) return;
    const { sslmode, channelBinding } = readTlsParams(env.DATABASE_URL);
    if (!env.DB_SSL && sslmode !== null && SSLMODES_REQUIRING_TLS.has(sslmode)) {
      ctx.addIssue({
        code: 'custom',
        path: ['DB_SSL'],
        message: `must be "true" when DATABASE_URL has sslmode=${sslmode}`,
      });
    }
    if (!env.DB_SSL && channelBinding === 'require') {
      ctx.addIssue({
        code: 'custom',
        path: ['DB_SSL'],
        message: 'must be "true" when DATABASE_URL has channel_binding=require (it needs TLS)',
      });
    }
    if (env.DB_SSL && sslmode !== null && SSLMODES_WITHOUT_VERIFICATION.has(sslmode)) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: `sslmode=${sslmode} conflicts with DB_SSL=true (certificates are always verified)`,
      });
    }
  });

export type Config = Readonly<z.infer<typeof envSchema>>;

/**
 * Render sets RENDER_EXTERNAL_URL to the service's public URL. The image serves its own SPA from
 * that origin, so it is a safe CORS default when none is configured. An explicit CORS_ORIGIN wins.
 */
const withHostingDefaults = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const corsOrigin = env.CORS_ORIGIN?.trim();
  const renderUrl = env.RENDER_EXTERNAL_URL?.trim();
  if (corsOrigin || !renderUrl) return env;
  return { ...env, CORS_ORIGIN: renderUrl };
};

/**
 * Validates raw environment variables. Pure so it can be unit-tested.
 * The error lists variable names and problems only, never the values (they may be secrets).
 */
export const loadConfig = (env: NodeJS.ProcessEnv): Config => {
  const result = envSchema.safeParse(withHostingDefaults(env));
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => ` - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return Object.freeze(result.data);
};

export const config: Config = loadConfig(process.env);
