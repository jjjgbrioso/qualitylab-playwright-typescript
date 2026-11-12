import { ApiClient } from '@api/ApiClient';
import { BankApi, CatalogApi, ShopApi, TravelApi } from '@api/services';
import type { AppModule } from '@api/types';
import { env } from '@config/env';
import { acquireLock, type HeldLock } from '@utils/lock';
import { test as authTest } from './auth.fixture';

/** Lazily created API clients, one session per module, disposed after the test. */
export interface Api {
  catalog(): Promise<CatalogApi>;
  shop(): Promise<ShopApi>;
  bank(): Promise<BankApi>;
  travel(): Promise<TravelApi>;
}

/** Undo steps for data a test creates. They run after the test, newest first, even when it fails. */
export interface Cleanup {
  add(description: string, undo: () => Promise<unknown>): void;
}

/** Shared state a test must not change at the same time as another test. */
export type SharedResource = 'cart' | 'bank';

export interface DataFixtures {
  /** API sessions for setup and for checking results (Playwright APIRequestContext). */
  api: Api;
  /** Waits until no other test (in any worker or browser) is using the resource, then holds it. */
  exclusive: (resource: SharedResource) => Promise<void>;
  cleanup: Cleanup;
}

const LOCK_WAIT_MS = 4 * 60_000;

/** Test data fixtures: API access, shared-resource locks and cleanup. Built on the auth fixtures for the credentials. */
export const test = authTest.extend<DataFixtures>({
  api: async ({ credentials }, use) => {
    const clients = new Map<string, Promise<ApiClient>>();
    const client = (module: AppModule | 'anonymous') => {
      if (!clients.has(module)) {
        clients.set(
          module,
          module === 'anonymous'
            ? ApiClient.anonymous(env.apiBaseUrl)
            : ApiClient.signedIn(env.apiBaseUrl, module, credentials),
        );
      }
      return clients.get(module)!;
    };
    await use({
      catalog: async () => new CatalogApi(await client('anonymous')),
      shop: async () => new ShopApi(await client('ecommerce')),
      bank: async () => new BankApi(await client('banking')),
      travel: async () => new TravelApi(await client('travel')),
    });
    for (const pending of clients.values()) {
      await pending.then((created) => created.dispose()).catch(() => undefined);
    }
  },

  exclusive: async ({ credentials }, use, testInfo) => {
    const held: HeldLock[] = [];
    await use(async (resource) => {
      const original = testInfo.timeout;
      testInfo.setTimeout(original + LOCK_WAIT_MS);
      const lock = await acquireLock(`${resource}-${credentials.username}`, `${testInfo.project.name}: ${testInfo.title}`, LOCK_WAIT_MS);
      // Time spent queueing does not count against the test.
      testInfo.setTimeout(original + lock.waitedMs);
      held.push(lock);
    });
    for (const lock of held.reverse()) lock.release();
  },

  // Depends on api and exclusive, so its undo steps run before the API sessions close and
  // before any lock is released.
  cleanup: async ({ api: _api, exclusive: _exclusive }, use, testInfo) => {
    const steps: { description: string; undo: () => Promise<unknown> }[] = [];
    await use({ add: (description, undo) => steps.push({ description, undo }) });
    for (const step of steps.reverse()) {
      try {
        await step.undo();
      } catch (error) {
        testInfo.annotations.push({ type: 'cleanup failed', description: `${step.description}: ${String(error)}` });
      }
    }
  },
});
