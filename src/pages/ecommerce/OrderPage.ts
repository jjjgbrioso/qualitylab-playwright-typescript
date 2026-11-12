import type { Locator } from '@playwright/test';
import { toCents } from '@utils/money';
import { BasePage } from '../BasePage';
import { CancelAction } from '../components/CancelAction';

/** One order: its number, status, items and totals, and the cancel control. */
export class OrderPage extends BasePage {
  readonly orderNumber: Locator = this.byTestId('order-detail-title');
  readonly status: Locator = this.byTestId('order-detail-status');
  readonly placedConfirmation: Locator = this.byTestId('order-placed-confirmation');
  readonly total: Locator = this.byTestId('order-total');
  readonly cancelAction = new CancelAction(this.page, 'order-cancel');

  async goto(orderId: string): Promise<void> {
    await this.page.goto(`/orders/${orderId}`);
    await this.orderNumber.waitFor();
  }

  item(productId: string): Locator {
    return this.byTestId(`order-item-${productId}`);
  }

  async totalCents(): Promise<number> {
    return toCents(await this.total.innerText());
  }

  async cancel(): Promise<void> {
    await this.cancelAction.confirm();
  }
}
