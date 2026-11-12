import type { Locator } from '@playwright/test';
import { toCents } from '@utils/money';
import { BasePage } from '../BasePage';

/** One bank account: balance and transaction history with a type filter. */
export class AccountPage extends BasePage {
  readonly balance: Locator = this.byTestId('account-balance');
  readonly transactions: Locator = this.byTestId('transactions-table');
  readonly emptyState: Locator = this.byTestId('transactions-empty-state');
  readonly typeFilter: Locator = this.byTestId('transaction-type-select');
  readonly applyFilter: Locator = this.byTestId('transaction-filter-submit');

  async goto(accountId: string): Promise<void> {
    await this.page.goto(`/banking/accounts/${accountId}`);
    await this.balance.waitFor();
  }

  async balanceCents(): Promise<number> {
    return toCents(await this.balance.innerText());
  }

  /** The history row for one transaction, by its id. */
  row(transactionId: string): Locator {
    return this.byTestId(`transaction-row-${transactionId}`);
  }

  type(transactionId: string): Locator {
    return this.byTestId(`transaction-type-${transactionId}`);
  }

  async amountCents(transactionId: string): Promise<number> {
    return Math.abs(toCents(await this.byTestId(`transaction-amount-${transactionId}`).innerText()));
  }

  reference(transactionId: string): Locator {
    return this.byTestId(`transaction-reference-${transactionId}`);
  }

  async filterByType(type: string): Promise<void> {
    await this.typeFilter.selectOption(type);
    await this.submitGetForm(this.applyFilter, { type });
    await this.transactions.or(this.emptyState).first().waitFor();
  }

  async types(): Promise<string[]> {
    const types = this.page.locator('[data-testid^="transaction-type-"]:not([data-testid="transaction-type-select"])');
    return (await types.allInnerTexts()).map((type) => type.trim());
  }
}
