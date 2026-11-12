import { test as base } from '@playwright/test';
import { BookingPage } from '@pages/travel/BookingPage';
import { HotelPage } from '@pages/travel/HotelPage';
import { HotelsPage } from '@pages/travel/HotelsPage';
import { RoomPage } from '@pages/travel/RoomPage';

export interface TravelFixtures {
  hotelsPage: HotelsPage;
  hotelPage: HotelPage;
  roomPage: RoomPage;
  bookingPage: BookingPage;
}

/** Travel page objects. */
export const test = base.extend<TravelFixtures>({
  hotelsPage: async ({ page }, use) => use(new HotelsPage(page)),
  hotelPage: async ({ page }, use) => use(new HotelPage(page)),
  roomPage: async ({ page }, use) => use(new RoomPage(page)),
  bookingPage: async ({ page }, use) => use(new BookingPage(page)),
});
