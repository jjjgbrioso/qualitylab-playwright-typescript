import type { Locator } from '@playwright/test';
import type { CheckoutDetails } from '@api/types';
import { BasePage } from '../BasePage';
import { FormErrors } from '../components/FormErrors';

/** Shipping and payment details, then "Place order". */
export class CheckoutPage extends BasePage {
  readonly form: Locator = this.byTestId('checkout-form');
  readonly submitButton: Locator = this.byTestId('checkout-submit-button');
  readonly error: Locator = this.byTestId('checkout-error');
  readonly errors = new FormErrors(this.page, 'checkout-');

  async goto(): Promise<void> {
    await this.page.goto('/checkout');
    await this.form.waitFor();
  }

  async fill(details: CheckoutDetails): Promise<void> {
    const fields: Record<string, string> = {
      'checkout-full-name': details.shipping.fullName,
      'checkout-address': details.shipping.address,
      'checkout-city': details.shipping.city,
      'checkout-postcode': details.shipping.postcode,
      'checkout-country': details.shipping.country,
      'checkout-card-name': details.payment.cardholderName,
      'checkout-card-number': details.payment.cardNumber,
      'checkout-card-expiry': details.payment.expiry,
      'checkout-card-cvv': details.payment.cvv,
    };
    for (const [testId, value] of Object.entries(fields)) {
      await this.byTestId(`${testId}-input`).fill(value);
    }
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /** Places the order and waits for its confirmation page. Returns the new order's id. */
  async placeOrder(details: CheckoutDetails): Promise<string> {
    await this.fill(details);
    await Promise.all([this.page.waitForURL(/\/orders\/[^/?]+/), this.submit()]);
    return new URL(this.page.url()).pathname.split('/').pop() ?? '';
  }
}
