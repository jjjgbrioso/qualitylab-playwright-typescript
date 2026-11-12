import { test as base } from '@playwright/test';
import { AccountPage } from '@pages/banking/AccountPage';
import { BankingDashboardPage } from '@pages/banking/BankingDashboardPage';
import { BankTransactionPage } from '@pages/banking/BankTransactionPage';

export interface BankingFixtures {
  bankingPage: BankingDashboardPage;
  depositPage: BankTransactionPage;
  withdrawalPage: BankTransactionPage;
  transferPage: BankTransactionPage;
  accountPage: AccountPage;
}

/** Banking page objects. */
export const test = base.extend<BankingFixtures>({
  bankingPage: async ({ page }, use) => use(new BankingDashboardPage(page)),
  depositPage: async ({ page }, use) => use(new BankTransactionPage(page, 'deposit')),
  withdrawalPage: async ({ page }, use) => use(new BankTransactionPage(page, 'withdrawal')),
  transferPage: async ({ page }, use) => use(new BankTransactionPage(page, 'transfer')),
  accountPage: async ({ page }, use) => use(new AccountPage(page)),
});
