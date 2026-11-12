import type { Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

export interface HotelSearch {
  destination?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  minStars?: number;
  amenity?: string;
}

/** Hotel search with destination, dates, guests, stars and amenity. */
export class HotelsPage extends BasePage {
  readonly form: Locator = this.byTestId('hotel-filter-form');
  readonly destination: Locator = this.byTestId('hotel-destination-input');
  readonly checkIn: Locator = this.byTestId('hotel-check-in-input');
  readonly checkOut: Locator = this.byTestId('hotel-check-out-input');
  readonly guests: Locator = this.byTestId('hotel-guests-input');
  readonly stars: Locator = this.byTestId('hotel-stars-select');
  readonly amenity: Locator = this.byTestId('hotel-amenity-select');
  readonly searchButton: Locator = this.byTestId('hotel-filter-submit');
  readonly grid: Locator = this.byTestId('hotel-grid');
  readonly emptyState: Locator = this.byTestId('hotel-empty-state');
  readonly errors: Locator = this.byTestIdPrefix('hotel-filter-error-');

  async goto(): Promise<void> {
    await this.page.goto('/travel/hotels');
    await this.form.waitFor();
  }

  async search(search: HotelSearch): Promise<void> {
    const expected: Record<string, string> = {};
    if (search.destination !== undefined) {
      await this.destination.fill(search.destination);
      expected.destination = search.destination;
    }
    if (search.checkIn !== undefined) {
      await this.checkIn.fill(search.checkIn);
      expected.checkIn = search.checkIn;
    }
    if (search.checkOut !== undefined) {
      await this.checkOut.fill(search.checkOut);
      expected.checkOut = search.checkOut;
    }
    if (search.guests !== undefined) {
      await this.guests.fill(String(search.guests));
      expected.guests = String(search.guests);
    }
    if (search.minStars !== undefined) {
      await this.stars.selectOption(String(search.minStars));
      expected.minStars = String(search.minStars);
    }
    if (search.amenity !== undefined) {
      await this.amenity.selectOption(search.amenity);
      expected.amenity = search.amenity;
    }
    await this.submitGetForm(this.searchButton, expected);
    await this.grid.or(this.emptyState).or(this.errors.first()).first().waitFor();
  }

  hotelIds(): Promise<string[]> {
    return this.idsAfter('hotel-card-');
  }

  async hotelNames(): Promise<string[]> {
    return (await this.byTestIdPrefix('hotel-name-').allInnerTexts()).map((name) => name.trim());
  }

  card(hotelId: string): Locator {
    return this.byTestId(`hotel-card-${hotelId}`);
  }
}
