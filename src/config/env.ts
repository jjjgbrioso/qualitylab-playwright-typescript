import fs from 'node:fs';
import path from 'node:path';

/**
 * Run settings. Values come from real environment variables first, then from the git-ignored
 * .env file, then from the defaults of the chosen environment (LOCAL or STAGING).
 */

const envFile = path.resolve(__dirname, '..', '..', '.env');
if (fs.existsSync(envFile)) {
  // Variables that are already set in the environment keep their values.
  process.loadEnvFile(envFile);
}

export type EnvironmentName = 'local' | 'staging';

const DEFAULT_BASE_URLS: Record<EnvironmentName, string> = {
  local: 'http://localhost:3100',
  staging: 'https://quality-lab-jb.vercel.app',
};

function value(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  return raw ? raw : undefined;
}

function environmentName(): EnvironmentName {
  const name = (value('TEST_ENV') ?? 'staging').toLowerCase();
  if (name !== 'local' && name !== 'staging') {
    throw new Error(`TEST_ENV must be "local" or "staging", not "${name}".`);
  }
  return name;
}

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function required(name: string): string {
  const found = value(name);
  if (!found) {
    throw new Error(
      `${name} is not set. Set it as an environment variable, or copy .env.example to .env and fill it in.`,
    );
  }
  return found;
}

const name = environmentName();
const baseUrl = withoutTrailingSlash(value('BASE_URL') ?? DEFAULT_BASE_URLS[name]);

export const env = {
  name,
  baseUrl,
  apiBaseUrl: withoutTrailingSlash(value('API_BASE_URL') ?? `${baseUrl}/api/v1`),
  isCI: Boolean(process.env.CI),
  workers: value('WORKERS'),
  retries: value('RETRIES'),
  /** Read lazily, so listing tests or type-checking works without credentials. */
  credentials(): { username: string; password: string } {
    return { username: required('TEST_USERNAME'), password: required('TEST_PASSWORD') };
  },
} as const;
