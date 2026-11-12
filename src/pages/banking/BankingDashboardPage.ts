import type { Locator } from '@playwright/test';
import { toCents } from '@utils/money';
import { BasePage } from '../BasePage';

/** The banking home: total balance, one card per account, recent transactions. */
export class BankingDashboardPage extends BasePage {
  readonly title: Locator = this.byTestId('banking-title');
  readonly totalBalance: Locator = this.byTestId('banking-total-balance');
  readonly accountList: Locator = this.byTestId('account-list');

  async goto(): Promise<void> {
    await this.page.goto('/banking');
    await this.totalBalance.waitFor();
  }

  async totalBalanceCents(): Promise<number> {
    return toCents(await this.totalBalance.innerText());
  }

  accountIds(): Promise<string[]> {
    return this.idsAfter('account-card-');
  }

  async accountBalanceCents(accountId: string): Promise<number> {
    return toCents(await this.byTestId(`account-balance-${accountId}`).innerText());
  }
}
