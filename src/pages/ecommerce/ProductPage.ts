import { expect, type Locator } from '@playwright/test';
import { toCents } from '@utils/money';
import { BasePage } from '../BasePage';

/** A product's detail page with its add-to-cart form. */
export class ProductPage extends BasePage {
  readonly detail: Locator = this.byTestId('product-detail');
  readonly name: Locator = this.byTestId('product-detail-name');
  readonly price: Locator = this.byTestId('product-detail-price');
  readonly listPrice: Locator = this.byTestId('product-detail-list-price');
  readonly quantity: Locator = this.byTestId('product-quantity-input');
  readonly addToCartButton: Locator = this.byTestId('add-to-cart-button');
  readonly addedMessage: Locator = this.byTestId('add-to-cart-success');
  readonly addError: Locator = this.byTestId('add-to-cart-error');

  async goto(productId: string): Promise<void> {
    await this.page.goto(`/shop/${productId}`);
    await this.detail.waitFor();
  }

  async priceCents(): Promise<number> {
    return toCents(await this.price.innerText());
  }

  /** The original price, shown as "Was $99.99" when the product is on sale. */
  async listPriceCents(): Promise<number> {
    return toCents((await this.listPrice.innerText()).replace(/was/i, ''));
  }

  async addToCart(quantity: number): Promise<void> {
    const countBefore = await this.nav.cartCount();
    // The button stays disabled until the page has loaded its scripts; click waits for that.
    await this.quantity.fill(String(quantity));
    await this.addToCartButton.click();
    await this.addedMessage.waitFor();
    // After the message, the page refreshes its data. The navigation bar's cart count changes
    // when that refresh has finished, so the next navigation will not interrupt it.
    await expect(this.nav.cartLink).toHaveText(`Cart (${countBefore + quantity})`);
  }
}
