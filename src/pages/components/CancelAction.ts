import type { Locator, Page } from '@playwright/test';

/**
 * The app's two-step cancel control, used for orders and bookings: a "Cancel" button, then a
 * confirm button. Both share a test id prefix, such as "order-cancel".
 */
export class CancelAction {
  readonly button: Locator;
  readonly confirmButton: Locator;
  readonly dismissButton: Locator;
  readonly error: Locator;

  constructor(page: Page, prefix: string) {
    this.button = page.getByTestId(`${prefix}-button`);
    this.confirmButton = page.getByTestId(`${prefix}-confirm`);
    this.dismissButton = page.getByTestId(`${prefix}-dismiss`);
    this.error = page.getByTestId(`${prefix}-error`);
  }

  async confirm(): Promise<void> {
    await this.button.click();
    await this.confirmButton.click();
  }
}
