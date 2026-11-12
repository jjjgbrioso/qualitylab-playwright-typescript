import type { Locator, Page } from '@playwright/test';
import { toAmountInput, toCents } from '@utils/money';
import { BasePage } from '../BasePage';
import { FormErrors } from '../components/FormErrors';

export type TransactionKind = 'deposit' | 'withdrawal' | 'transfer';

const PATHS: Record<TransactionKind, string> = {
  deposit: '/banking/deposit',
  withdrawal: '/banking/withdraw',
  transfer: '/banking/transfer',
};

/**
 * The deposit, withdrawal and transfer forms. They share one layout, and every test id starts
 * with the form's name, such as "deposit-amount-input" or "transfer-success".
 */
export class BankTransactionPage extends BasePage {
  readonly form: Locator;
  readonly account: Locator;
  readonly amount: Locator;
  readonly toAccountNumber: Locator;
  readonly submitButton: Locator;
  readonly success: Locator;
  readonly reference: Locator;
  readonly newBalance: Locator;
  readonly errors: FormErrors;

  constructor(page: Page, readonly kind: TransactionKind) {
    super(page);
    this.form = this.byTestId(`${kind}-form`);
    this.account = this.byTestId(`${kind}-account-select`);
    this.amount = this.byTestId(`${kind}-amount-input`);
    this.toAccountNumber = this.byTestId('transfer-to-account-input');
    this.submitButton = this.byTestId(`${kind}-submit-button`);
    this.success = this.byTestId(`${kind}-success`);
    this.reference = this.byTestId(`${kind}-reference`);
    this.newBalance = this.byTestId(`${kind}-new-balance`);
    this.errors = new FormErrors(page, `${kind}-`);
  }

  async goto(): Promise<void> {
    await this.page.goto(PATHS[this.kind]);
    await this.form.waitFor();
  }

  /** Fills and sends the form, then waits for either the success message or an error. */
  async submit(input: { accountId: string; amountCents?: number; amountText?: string; toAccountNumber?: string }): Promise<void> {
    await this.account.selectOption(input.accountId);
    if (this.kind === 'transfer' && input.toAccountNumber !== undefined) {
      await this.toAccountNumber.fill(input.toAccountNumber);
    }
    await this.amount.fill(input.amountText ?? toAmountInput(input.amountCents ?? 0));
    await this.submitButton.click();
    await this.success.or(this.errors.all).first().waitFor();
  }

  async newBalanceCents(): Promise<number> {
    return toCents(await this.newBalance.innerText());
  }
}
