import type { Locator } from '@playwright/test';
import type { Stay } from '@utils/dates';
import { toCents } from '@utils/money';
import { BasePage } from '../BasePage';

/** A room for chosen dates: price summary, availability messages and the booking form. */
export class RoomPage extends BasePage {
  readonly detail: Locator = this.byTestId('room-detail');
  readonly nightlyRate: Locator = this.byTestId('room-nightly-rate');
  readonly summary: Locator = this.byTestId('booking-summary');
  readonly soldOut: Locator = this.byTestId('booking-sold-out');
  readonly guestLimit: Locator = this.byTestId('booking-guest-limit');
  readonly stayErrors: Locator = this.byTestIdPrefix('stay-error-');
  readonly form: Locator = this.byTestId('booking-form');
  readonly leadGuest: Locator = this.byTestId('booking-lead-guest-input');
  readonly submitButton: Locator = this.byTestId('booking-submit-button');
  readonly bookingError: Locator = this.byTestId('booking-error');

  async goto(roomId: string, stay: Pick<Stay, 'checkIn' | 'checkOut'>, guests = 1): Promise<void> {
    await this.page.goto(`/travel/rooms/${roomId}?checkIn=${stay.checkIn}&checkOut=${stay.checkOut}&guests=${guests}`);
    await this.nightlyRate.waitFor();
  }

  async nightlyRateCents(): Promise<number> {
    return toCents(await this.nightlyRate.innerText());
  }

  /** Books the room and waits for the booking page. Returns the new booking's id. */
  async book(leadGuest: string): Promise<string> {
    await this.leadGuest.fill(leadGuest);
    await Promise.all([this.page.waitForURL(/\/bookings\/[^/?]+/), this.submitButton.click()]);
    return new URL(this.page.url()).pathname.split('/').pop() ?? '';
  }
}
