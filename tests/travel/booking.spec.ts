import { expect, test } from '@fixtures';
import { errorOf } from '@api/ApiClient';
import type { Booking } from '@api/types';
import type { TravelApi } from '@api/services';
import { format, statusText, travel } from '@data/testData';
import { daysFromToday, freeStay, type Stay } from '@utils/dates';

const { hotels, stays, invalidDates, bookingStatuses, messages, leadGuest } = travel;
const [standardRoom] = hotels.alfama.rooms;

/** Books a room through the API, trying new random dates if a parallel run took the first ones. */
async function bookThroughApi(travelApi: TravelApi, roomId: string, nights: number): Promise<{ booking: Booking; stay: Stay }> {
  for (let attempt = 1; ; attempt++) {
    const stay = freeStay(nights);
    const response = await travelApi.bookRaw({ roomId, checkIn: stay.checkIn, checkOut: stay.checkOut, guests: 1, leadGuestName: leadGuest });
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

    await hotelPage.goto(hotels.alfama.id, freeStay(stays.nights));

    expect((await hotelPage.roomIds()).sort()).toEqual([...hotels.alfama.rooms].sort());
    for (const room of rooms) {
      await expect(hotelPage.available(room.id)).toBeVisible();
      expect(await hotelPage.nightlyRateCents(room.id)).toBe(room.pricePerNightCents);
    }
  });

  test('a fully booked room shows as sold out', { tag: '@negative' }, async ({ hotelPage, roomPage, api, cleanup }) => {
    // Its only unit is booked through the API first, on random far-future dates.
    const travelApi = await api.travel();
    const { booking, stay } = await bookThroughApi(travelApi, hotels.soloRoom.roomId, stays.nights);
    cleanup.add(`cancel booking ${booking.id}`, () => travelApi.cancel(booking.id));

    await hotelPage.goto(hotels.soloRoom.hotelId, stay);
    await expect(hotelPage.soldOut(hotels.soloRoom.roomId)).toBeVisible();

    await roomPage.goto(hotels.soloRoom.roomId, stay);
    await expect(roomPage.soldOut).toHaveText(messages.soldOut);
    await expect(roomPage.submitButton).toHaveCount(0);
  });

  test('the API refuses to book a room that is already taken', { tag: ['@negative', '@api'] }, async ({ api, cleanup }) => {
    const travelApi = await api.travel();
    const { booking, stay } = await bookThroughApi(travelApi, hotels.soloRoom.roomId, 1);
    cleanup.add(`cancel booking ${booking.id}`, () => travelApi.cancel(booking.id));

    const second = await travelApi.bookRaw({ roomId: hotels.soloRoom.roomId, checkIn: stay.checkIn, checkOut: stay.checkOut, guests: 1, leadGuestName: leadGuest });

    expect(second.status()).toBe(409);
    expect((await errorOf(second)).code).toBe(travel.apiErrors.roomUnavailable);
  });
});

test.describe('Bookings', { tag: '@travel' }, () => {
  test.beforeEach(async ({ signIn }) => {
    await signIn('travel');
  });

  test('book a room', { tag: '@smoke' }, async ({ hotelPage, roomPage, bookingPage, api, cleanup }) => {
    const travelApi = await api.travel();
    const nights = stays.bookingNights;
    const stay = freeStay(nights);

    await hotelPage.goto(hotels.alfama.id, stay);
    await hotelPage.viewRoom(standardRoom);
    const rate = await roomPage.nightlyRateCents();
    const bookingId = await roomPage.book(leadGuest);
    cleanup.add(`cancel booking ${bookingId}`, async () => {
      if ((await travelApi.booking(bookingId)).status === bookingStatuses.confirmed) await travelApi.cancel(bookingId);
    });

    await expect(bookingPage.confirmation).toBeVisible();
    await expect(bookingPage.status).toHaveText(statusText(bookingStatuses.confirmed));
    await expect(bookingPage.nights).toContainText(String(nights));
    await expect(bookingPage.leadGuest).toHaveText(leadGuest);
    expect(await bookingPage.totalCents()).toBe(nights * rate);

    const booking = await travelApi.booking(bookingId);
    expect(booking).toMatchObject({ status: bookingStatuses.confirmed, checkIn: stay.checkIn, checkOut: stay.checkOut, nights, totalCents: nights * rate });
    await expect(bookingPage.bookingNumber).toHaveText(booking.bookingNumber);
  });

  test('cancel a booking', async ({ bookingPage, api }) => {
    const travelApi = await api.travel();
    const { booking } = await bookThroughApi(travelApi, standardRoom, stays.nights);

    await bookingPage.goto(booking.id);
    await expect(bookingPage.status).toHaveText(statusText(bookingStatuses.confirmed));
    await bookingPage.cancel();

    await expect(bookingPage.status).toHaveText(statusText(bookingStatuses.cancelled));
    expect((await travelApi.booking(booking.id)).status).toBe(bookingStatuses.cancelled);
  });
});

test.describe('Invalid bookings', { tag: ['@travel', '@negative'] }, () => {
  test.beforeEach(async ({ signIn }) => {
    await signIn('travel');
  });

  test('check-out before check-in is refused', async ({ hotelsPage }) => {
    const dates = invalidDates.checkOutBeforeCheckIn;

    await hotelsPage.goto();
    await hotelsPage.search({ checkIn: daysFromToday(dates.checkInDaysFromToday), checkOut: daysFromToday(dates.checkOutDaysFromToday) });

    await expect(hotelsPage.errors.first()).toContainText(messages.checkOutBeforeCheckIn);
  });

  test('a check-in date in the past is refused', async ({ hotelsPage }) => {
    const dates = invalidDates.pastCheckIn;

    await hotelsPage.goto();
    await hotelsPage.search({ checkIn: daysFromToday(dates.checkInDaysFromToday), checkOut: daysFromToday(dates.checkOutDaysFromToday) });

    await expect(hotelsPage.errors.first()).toContainText(messages.pastCheckIn);
  });

  test('more guests than the room sleeps are refused', async ({ roomPage, api }) => {
    const room = (await (await api.catalog()).rooms(hotels.alfama.id)).find((candidate) => candidate.id === standardRoom)!;

    await roomPage.goto(room.id, freeStay(stays.nights), room.maxGuests + 1);

    await expect(roomPage.guestLimit).toHaveText(format(messages.guestLimit, { maxGuests: room.maxGuests }));
    await expect(roomPage.submitButton).toHaveCount(0);
  });

  test('a stay longer than the maximum is refused', async ({ roomPage }) => {
    await roomPage.goto(standardRoom, freeStay(stays.maxNights + 1));

    await expect(roomPage.stayErrors.first()).toContainText(format(messages.stayTooLong, { maxNights: stays.maxNights }));
    await expect(roomPage.submitButton).toHaveCount(0);
  });
});
