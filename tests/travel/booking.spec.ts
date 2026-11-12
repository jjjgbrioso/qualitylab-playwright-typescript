import { expect, test } from '@fixtures';
import { errorOf } from '@api/ApiClient';
import type { Booking } from '@api/types';
import type { TravelApi } from '@api/services';
import { hotels, leadGuest } from '@data/testData';
import { daysFromToday, freeStay, type Stay } from '@utils/dates';

/** Books a room through the API, trying new random dates if a parallel run took the first ones. */
async function bookThroughApi(travel: TravelApi, roomId: string, nights: number): Promise<{ booking: Booking; stay: Stay }> {
  for (let attempt = 1; ; attempt++) {
    const stay = freeStay(nights);
    const response = await travel.bookRaw({ roomId, checkIn: stay.checkIn, checkOut: stay.checkOut, guests: 1, leadGuestName: leadGuest });
    if (response.status() === 201) return { booking: ((await response.json()) as { data: Booking }).data, stay };
    if (response.status() !== 409 || attempt === 5) throw new Error(`Booking ${roomId} failed: ${response.status()} ${await response.text()}`);
  }
}

test.describe('Room availability', { tag: '@travel' }, () => {
  test.beforeEach(async ({ signIn }) => {
    await signIn('travel');
  });

  test('rooms on free dates are available at their nightly rate', async ({ hotelPage, api }) => {
    const rooms = await (await api.catalog()).rooms(hotels.alfama.id);

    await hotelPage.goto(hotels.alfama.id, freeStay(2));

    expect((await hotelPage.roomIds()).sort()).toEqual([...hotels.alfama.rooms].sort());
    for (const room of rooms) {
      await expect(hotelPage.available(room.id)).toBeVisible();
      expect(await hotelPage.nightlyRateCents(room.id)).toBe(room.pricePerNightCents);
    }
  });

  test('a fully booked room shows as sold out', { tag: '@negative' }, async ({ hotelPage, roomPage, api, cleanup }) => {
    // Its only unit is booked through the API first, on random far-future dates.
    const travel = await api.travel();
    const { booking, stay } = await bookThroughApi(travel, hotels.soloRoom.roomId, 2);
    cleanup.add(`cancel booking ${booking.id}`, () => travel.cancel(booking.id));

    await hotelPage.goto(hotels.soloRoom.hotelId, stay);
    await expect(hotelPage.soldOut(hotels.soloRoom.roomId)).toBeVisible();

    await roomPage.goto(hotels.soloRoom.roomId, stay);
    await expect(roomPage.soldOut).toHaveText('This room is sold out for these dates.');
    await expect(roomPage.submitButton).toHaveCount(0);
  });

  test('the API refuses to book a room that is already taken', { tag: ['@negative', '@api'] }, async ({ api, cleanup }) => {
    const travel = await api.travel();
    const { booking, stay } = await bookThroughApi(travel, hotels.soloRoom.roomId, 1);
    cleanup.add(`cancel booking ${booking.id}`, () => travel.cancel(booking.id));

    const second = await travel.bookRaw({ roomId: hotels.soloRoom.roomId, checkIn: stay.checkIn, checkOut: stay.checkOut, guests: 1, leadGuestName: leadGuest });

    expect(second.status()).toBe(409);
    expect((await errorOf(second)).code).toBe('ROOM_UNAVAILABLE');
  });
});

test.describe('Bookings', { tag: '@travel' }, () => {
  test.beforeEach(async ({ signIn }) => {
    await signIn('travel');
  });

  test('book a room', { tag: '@smoke' }, async ({ hotelPage, roomPage, bookingPage, api, cleanup }) => {
    const travel = await api.travel();
    const stay = freeStay(3);
    const [roomId] = hotels.alfama.rooms;

    await hotelPage.goto(hotels.alfama.id, stay);
    await hotelPage.viewRoom(roomId);
    const rate = await roomPage.nightlyRateCents();
    const bookingId = await roomPage.book(leadGuest);
    cleanup.add(`cancel booking ${bookingId}`, async () => {
      if ((await travel.booking(bookingId)).status === 'CONFIRMED') await travel.cancel(bookingId);
    });

    await expect(bookingPage.confirmation).toBeVisible();
    await expect(bookingPage.status).toHaveText(/confirmed/i);
    await expect(bookingPage.nights).toContainText('3');
    await expect(bookingPage.leadGuest).toHaveText(leadGuest);
    expect(await bookingPage.totalCents()).toBe(3 * rate);

    const booking = await travel.booking(bookingId);
    expect(booking).toMatchObject({ status: 'CONFIRMED', checkIn: stay.checkIn, checkOut: stay.checkOut, nights: 3, totalCents: 3 * rate });
    await expect(bookingPage.bookingNumber).toHaveText(booking.bookingNumber);
  });

  test('cancel a booking', async ({ bookingPage, api }) => {
    const travel = await api.travel();
    const { booking } = await bookThroughApi(travel, hotels.alfama.rooms[0], 2);

    await bookingPage.goto(booking.id);
    await expect(bookingPage.status).toHaveText(/confirmed/i);
    await bookingPage.cancel();

    await expect(bookingPage.status).toHaveText(/cancelled/i);
    expect((await travel.booking(booking.id)).status).toBe('CANCELLED');
  });
});

test.describe('Invalid bookings', { tag: ['@travel', '@negative'] }, () => {
  test.beforeEach(async ({ signIn }) => {
    await signIn('travel');
  });

  test('check-out before check-in is refused', async ({ hotelsPage }) => {
    await hotelsPage.goto();
    await hotelsPage.search({ checkIn: daysFromToday(60), checkOut: daysFromToday(58) });

    await expect(hotelsPage.errors.first()).toContainText('Check-out must be after check-in.');
  });

  test('a check-in date in the past is refused', async ({ hotelsPage }) => {
    await hotelsPage.goto();
    await hotelsPage.search({ checkIn: daysFromToday(-3), checkOut: daysFromToday(2) });

    await expect(hotelsPage.errors.first()).toContainText('Check-in cannot be in the past.');
  });

  test('more guests than the room sleeps are refused', async ({ roomPage, api }) => {
    const room = (await (await api.catalog()).rooms(hotels.alfama.id)).find((candidate) => candidate.id === hotels.alfama.rooms[0])!;

    await roomPage.goto(room.id, freeStay(2), room.maxGuests + 1);

    await expect(roomPage.guestLimit).toHaveText(`This room sleeps at most ${room.maxGuests} guests.`);
    await expect(roomPage.submitButton).toHaveCount(0);
  });

  test('a stay longer than 30 nights is refused', async ({ roomPage }) => {
    const stay = freeStay(31);

    await roomPage.goto(hotels.alfama.rooms[0], stay);

    await expect(roomPage.stayErrors.first()).toContainText('A stay can be at most 30 nights.');
    await expect(roomPage.submitButton).toHaveCount(0);
  });
});
