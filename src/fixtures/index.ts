import { mergeTests } from '@playwright/test';
import { test as bankingTest } from './banking.fixture';
import { test as dataTest } from './data.fixture';
import { test as ecommerceTest } from './ecommerce.fixture';
import { test as travelTest } from './travel.fixture';

/**
 * The `test` every spec file imports. It merges the fixture files:
 *
 * - auth.fixture.ts       credentials, signIn, homePage, loginPage
 * - data.fixture.ts       api, exclusive, cleanup (built on the auth fixtures)
 * - ecommerce.fixture.ts  shopPage, productPage, cartPage, checkoutPage, ordersPage, orderPage
 * - banking.fixture.ts    bankingPage, depositPage, withdrawalPage, transferPage, accountPage
 * - travel.fixture.ts     hotelsPage, hotelPage, roomPage, bookingPage
 */
export const test = mergeTests(dataTest, ecommerceTest, bankingTest, travelTest);

export { expect } from '@playwright/test';
export type { Api, Cleanup, SharedResource } from './data.fixture';
