import { test as base, expect } from '@playwright/test';
import type { AppModule } from '@api/types';
import { env } from '@config/env';
import { HomePage } from '@pages/common/HomePage';
import { LoginPage } from '@pages/common/LoginPage';

export interface AuthFixtures {
  /** The test customer's login, from TEST_USERNAME and TEST_PASSWORD. */
  credentials: { username: string; password: string };
  /** Signs the browser in to a module through the API, which is faster than the login form. */
  signIn: (module: AppModule) => Promise<void>;
  homePage: HomePage;
  loginPage: LoginPage;
}

/** Sign-in fixtures and the pages used to sign in. */
export const test = base.extend<AuthFixtures>({
  credentials: async ({}, use) => {
    await use(env.credentials());
  },

  signIn: async ({ page, credentials }, use) => {
    await use(async (module) => {
      // page.request shares the browser context's cookies, so the session cookie set by this
      // call signs the browser in.
      const response = await page.request.post('/api/v1/auth/login', {
        data: { email: credentials.username, password: credentials.password, module },
        timeout: 30_000,
      });
      expect(response.ok(), `Sign-in to ${module} returned ${response.status()}`).toBe(true);
    });
  },

  homePage: async ({ page }, use) => use(new HomePage(page)),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
});
