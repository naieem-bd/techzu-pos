import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

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

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z
    .string({ message: 'is required' })
    .regex(/^postgres(ql)?:\/\/.+/, 'must be a postgres:// connection string'),
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
});

export type Config = Readonly<z.infer<typeof envSchema>>;

/**
 * Validates raw environment variables. Pure so it can be unit-tested.
 * The error lists variable names and problems only, never the values (they may be secrets).
 */
export const loadConfig = (env: NodeJS.ProcessEnv): Config => {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => ` - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return Object.freeze(result.data);
};

export const config: Config = loadConfig(process.env);
