import { expect, test } from '@fixtures';
import { hotels } from '@data/testData';

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
    await hotelsPage.search({ minStars: hotels.filter.minStars, amenity: hotels.filter.amenity });

    const expected = await (await api.catalog()).hotels({ minStars: hotels.filter.minStars, amenity: hotels.filter.amenity });
    expect(expected.length).toBeGreaterThan(0);
    for (const hotel of expected) {
      expect(hotel.starRating).toBeGreaterThanOrEqual(hotels.filter.minStars);
      expect(hotel.amenities).toContain(hotels.filter.amenity);
    }
    expect((await hotelsPage.hotelIds()).sort()).toEqual(expected.map((hotel) => hotel.id).sort());
  });

  test('a destination with no hotels shows the empty state', { tag: '@negative' }, async ({ hotelsPage }) => {
    await hotelsPage.search({ destination: 'Atlantis' });

    await expect(hotelsPage.emptyState).toBeVisible();
    expect(await hotelsPage.hotelIds()).toHaveLength(0);
  });
});
