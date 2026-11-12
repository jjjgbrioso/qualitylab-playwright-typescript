import type { Locator } from '@playwright/test';
import type { Stay } from '@utils/dates';
import { toCents } from '@utils/money';
import { BasePage } from '../BasePage';

/** One hotel and its rooms. With stay dates, each room shows whether it is available. */
export class HotelPage extends BasePage {
  readonly roomList: Locator = this.byTestId('room-list');

  async goto(hotelId: string, stay: Stay, guests = 1): Promise<void> {
    await this.page.goto(`/travel/hotels/${hotelId}?checkIn=${stay.checkIn}&checkOut=${stay.checkOut}&guests=${guests}`);
    await this.roomList.waitFor();
  }

  roomIds(): Promise<string[]> {
    return this.idsAfter('room-card-');
  }

  available(roomId: string): Locator {
    return this.byTestId(`room-available-${roomId}`);
  }

  soldOut(roomId: string): Locator {
    return this.byTestId(`room-sold-out-${roomId}`);
  }

  async nightlyRateCents(roomId: string): Promise<number> {
    return toCents(await this.byTestId(`room-price-${roomId}`).innerText());
  }

  async viewRoom(roomId: string): Promise<void> {
    await this.byTestId(`room-view-${roomId}`).click();
    await this.page.waitForURL(`**/travel/rooms/${roomId}**`);
  }
}
