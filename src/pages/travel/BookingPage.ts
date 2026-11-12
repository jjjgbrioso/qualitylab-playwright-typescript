import type { Locator } from '@playwright/test';
import { toCents } from '@utils/money';
import { BasePage } from '../BasePage';
import { CancelAction } from '../components/CancelAction';

/** One hotel booking: number, status, nights, total, lead guest and the cancel control. */
export class BookingPage extends BasePage {
  readonly bookingNumber: Locator = this.byTestId('booking-detail-title');
  readonly confirmation: Locator = this.byTestId('booking-confirmation');
  readonly status: Locator = this.byTestId('booking-detail-status');
  readonly nights: Locator = this.byTestId('booking-detail-nights');
  readonly total: Locator = this.byTestId('booking-detail-total');
  readonly leadGuest: Locator = this.byTestId('booking-detail-lead-guest');
  readonly cancelAction = new CancelAction(this.page, 'booking-cancel');

  async goto(bookingId: string): Promise<void> {
    await this.page.goto(`/bookings/${bookingId}`);
    await this.status.waitFor();
  }

  async totalCents(): Promise<number> {
    return toCents(await this.total.innerText());
  }

  async cancel(): Promise<void> {
    await this.cancelAction.confirm();
  }
}
