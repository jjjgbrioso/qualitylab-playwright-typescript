import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';

/**
 * Runs against STAGING (the deployed site) by default. Set TEST_ENV=local for a copy on this PC.
 * See README.md for every setting.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',

  // Tests in every file run in parallel. Tests that change the shared test customer's cart or
  // balances take a cross-process lock (src/utils/lock.ts), so they queue instead of colliding.
  fullyParallel: true,
  workers: env.workers ? Number(env.workers) : env.isCI ? 2 : 4,
  retries: env.retries ? Number(env.retries) : env.isCI ? 2 : 1,
  forbidOnly: env.isCI,

  timeout: 60_000,
  expect: { timeout: 15_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
    ['junit', { outputFile: 'reports/junit.xml' }],
    // One-page summary of every run as HTML with a "Download PDF" button, plus the PDF itself.
    ['./src/reporting/HtmlPdfReporter.ts', { outputFolder: 'reports/summary', historyFolder: 'reports/history' }],
  ],

  use: {
    baseURL: env.baseUrl,
    testIdAttribute: 'data-testid',
    // The live site can answer slowly while several browsers run at once.
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    // Evidence is kept only when a test fails, so passing runs stay small.
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    locale: 'en-US',
    timezoneId: 'Asia/Manila',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
