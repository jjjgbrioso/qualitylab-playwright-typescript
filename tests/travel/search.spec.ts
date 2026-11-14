import { expect, test } from '@fixtures';
import { travel } from '@data/testData';

const { hotels, filter } = travel;

test.describe('Hotel search', { tag: '@travel' }, () => {
  test.beforeEach(async ({ signIn, hotelsPage }) => {
    await signIn('travel');
    await hotelsPage.goto();
  });

  test('search by destination finds the hotels there', { tag: '@smoke' }, async ({ hotelsPage, api }) => {
    await hotelsPage.search({ destination: hotels.kyoto.destination });

    expect((await hotelsPage.hotelNames()).sort()).toEqual([...hotels.kyoto.names].sort());
    const expected = await (await api.catalog()).hotels({ destination: hotels.kyoto.destination });
    expect((await hotelsPage.hotelIds()).sort()).toEqual(expected.map((hotel) => hotel.id).sort());
  });

  test('filter by stars and amenity shows only matching hotels', async ({ hotelsPage, api }) => {
    await hotelsPage.search({ minStars: filter.minStars, amenity: filter.amenity });

    const expected = await (await api.catalog()).hotels({ minStars: filter.minStars, amenity: filter.amenity });
    expect(expected.length).toBeGreaterThan(0);
    for (const hotel of expected) {
      expect(hotel.starRating).toBeGreaterThanOrEqual(filter.minStars);
      expect(hotel.amenities).toContain(filter.amenity);
    }
    expect((await hotelsPage.hotelIds()).sort()).toEqual(expected.map((hotel) => hotel.id).sort());
  });

  test('a destination with no hotels shows the empty state', { tag: '@negative' }, async ({ hotelsPage }) => {
    await hotelsPage.search({ destination: travel.noMatchDestination });

    await expect(hotelsPage.emptyState).toBeVisible();
    expect(await hotelsPage.hotelIds()).toHaveLength(0);
  });
});
