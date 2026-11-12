import type { CheckoutDetails } from '@api/types';

/**
 * Seeded catalogue data the tests rely on. Values that can change on the live site, such as prices,
 * stock and balances, are read from the API during the test instead of being fixed here.
 */
export const products = {
  /** Found by searching for "keyboard". */
  keyboard: { id: 'prod_0003', name: 'Vector Mechanical Keyboard', searchTerm: 'keyboard' },
  /** On sale, so it shows a list price as well as a price. */
  onSaleThrow: { id: 'prod_0009', name: 'Willow Knit Throw' },
  /** Plenty of stock, so cart tests never run out. */
  notebook: { id: 'prod_0027', name: 'Grid Dot Notebook' },
  markers: { id: 'prod_0029', name: 'Whiteboard Marker Pack' },
} as const;

export const categories = { books: 'Books', office: 'Office' } as const;

export const hotels = {
  kyoto: { destination: 'Kyoto', names: ['Gion Townhouse Stay', 'Sakura Garden Hotel'] },
  alfama: { id: 'hotel_0002', rooms: ['room_0002_std', 'room_0002_dlx', 'room_0002_fam'] },
  /** room_0012_std is the only room of its kind, so one booking sells it out. */
  soloRoom: { hotelId: 'hotel_0012', roomId: 'room_0012_std' },
  filter: { minStars: 4, amenity: 'Pool' },
} as const;

export const banking = {
  /** Ten digits, but no account has this number. */
  unknownAccountNumber: '9999999999',
  shortAccountNumber: '12345',
  maxSingleTransactionCents: 1_000_000,
} as const;

export const cards = {
  approved: '4242 4242 4242 4242',
  declined: '4000 0000 0000 0002',
} as const;

export function checkoutDetails(cardNumber: string = cards.approved): CheckoutDetails {
  return {
    shipping: {
      fullName: 'Playwright Tester',
      address: '200 Automation Street',
      city: 'Sampletown',
      postcode: '00000',
      country: 'United States',
    },
    payment: { cardholderName: 'Playwright Tester', cardNumber: cardNumber.replace(/\s/g, ''), expiry: '12/30', cvv: '123' },
  };
}

export const leadGuest = 'Playwright Tester';
