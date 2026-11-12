import { expect, type Locator } from '@playwright/test';
import { toCents } from '@utils/money';
import { BasePage } from '../BasePage';

/** The cart, with quantity changes, removal and the link to checkout. */
export class CartPage extends BasePage {
  readonly root: Locator = this.byTestId('cart');
  readonly summary: Locator = this.byTestId('cart-summary');
  readonly emptyState: Locator = this.byTestId('cart-empty-state');
  readonly subtotal: Locator = this.byTestId('cart-subtotal');
  readonly total: Locator = this.byTestId('cart-total');
  readonly checkoutLink: Locator = this.byTestId('cart-checkout-link');
  readonly error: Locator = this.byTestId('cart-error');

  async goto(): Promise<void> {
    await this.page.goto('/cart');
    await this.summary.or(this.emptyState).first().waitFor();
  }

  line(productId: string): Locator {
    return this.byTestId(`cart-item-${productId}`);
  }

  quantityInput(productId: string): Locator {
    return this.byTestId(`cart-item-quantity-${productId}`);
  }

  lineTotal(productId: string): Locator {
    return this.byTestId(`cart-item-total-${productId}`);
  }

  async lineTotalCents(productId: string): Promise<number> {
    return toCents(await this.lineTotal(productId).innerText());
  }

  /** The cart saves a new quantity when the field loses focus, then shows the new line total. */
  async changeQuantity(productId: string, quantity: number): Promise<void> {
    const before = await this.lineTotal(productId).innerText();
    const input = this.quantityInput(productId);
    await expect(input).toBeEnabled();
    await input.fill(String(quantity));
    await input.blur();
    await expect(this.lineTotal(productId)).not.toHaveText(before);
    await expect(input).toBeEnabled();
  }

  async remove(productId: string): Promise<void> {
    await this.byTestId(`cart-item-remove-${productId}`).click();
    await this.line(productId).waitFor({ state: 'detached' });
  }

  async proceedToCheckout(): Promise<void> {
    await this.checkoutLink.click();
    await this.page.waitForURL('**/checkout');
  }
}
