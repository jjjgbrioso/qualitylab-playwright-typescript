import type { Locator, Page } from '@playwright/test';

/**
 * Error messages of one form. The app gives every field error and the form-level alert a test id
 * that starts with the form's prefix and ends with "-error", such as "deposit-amount-error".
 */
export class FormErrors {
  readonly all: Locator;

  constructor(private readonly page: Page, prefix: string) {
    this.all = page.locator(`[data-testid^="${prefix}"][data-testid$="-error"]`);
  }

  field(testId: string): Locator {
    return this.page.getByTestId(`${testId}-error`);
  }

  async texts(): Promise<string[]> {
    return (await this.all.allInnerTexts()).map((text) => text.trim()).filter(Boolean);
  }
}
