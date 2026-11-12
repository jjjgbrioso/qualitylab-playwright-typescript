import type { Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/** The customer's order history, with a status filter. */
export class OrdersPage extends BasePage {
  readonly table: Locator = this.byTestId('orders-table');
  readonly emptyState: Locator = this.byTestId('orders-empty-state');
  readonly statusFilter: Locator = this.byTestId('order-status-select');
  readonly applyFilter: Locator = this.byTestId('order-filter-submit');
  readonly title: Locator = this.byTestId('orders-title');

  async goto(): Promise<void> {
    await this.page.goto('/orders');
    await this.title.waitFor();
  }

  row(orderId: string): Locator {
    return this.byTestId(`order-row-${orderId}`);
  }

  status(orderId: string): Locator {
    return this.byTestId(`order-status-${orderId}`);
  }

  async filterByStatus(status: string): Promise<void> {
    await this.statusFilter.selectOption(status);
    await this.submitGetForm(this.applyFilter, { status });
    await this.table.or(this.emptyState).first().waitFor();
  }

  async statuses(): Promise<string[]> {
    const statuses = this.page.locator('[data-testid^="order-status-"]:not([data-testid="order-status-select"])');
    return (await statuses.allInnerTexts()).map((status) => status.trim());
  }

  async open(orderId: string): Promise<void> {
    await this.byTestId(`order-link-${orderId}`).click();
    await this.page.waitForURL(`**/orders/${orderId}`);
  }
}
