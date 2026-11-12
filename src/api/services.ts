import type { ApiClient } from './ApiClient';
import { idempotencyKey } from '@utils/random';
import type {
  BankAccount,
  BankTransaction,
  Booking,
  Cart,
  CheckoutDetails,
  Hotel,
  Order,
  Product,
  Room,
} from './types';

/** Public catalogue reads: products and hotels. No sign-in needed. */
export class CatalogApi {
  constructor(private readonly api: ApiClient) {}

  async products(query: {
    q?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    onSale?: boolean;
    sort?: string;
  } = {}): Promise<Product[]> {
    return (await this.api.getPage<Product>('products', { ...query, pageSize: 100 })).data;
  }

  product(id: string): Promise<Product> {
    return this.api.get<Product>(`products/${id}`);
  }

  async hotels(query: { destination?: string; minStars?: number; amenity?: string } = {}): Promise<Hotel[]> {
    return (await this.api.getPage<Hotel>('hotels', { ...query, pageSize: 50 })).data;
  }

  async rooms(hotelId: string): Promise<Room[]> {
    return (await this.api.get<{ rooms: Room[] }>(`hotels/${hotelId}`)).rooms;
  }
}

/** The test customer's cart and orders (E-commerce session). */
export class ShopApi {
  constructor(private readonly api: ApiClient) {}

  cart(): Promise<Cart> {
    return this.api.get<Cart>('cart');
  }

  addToCart(productId: string, quantity: number): Promise<Cart> {
    return this.api.post<Cart>('cart/items', { productId, quantity });
  }

  clearCart(): Promise<void> {
    return this.api.delete('cart');
  }

  checkout(details: CheckoutDetails): Promise<Order> {
    return this.api.post<Order>('orders', details);
  }

  order(id: string): Promise<Order> {
    return this.api.get<Order>(`orders/${id}`);
  }

  cancelOrder(id: string): Promise<Order> {
    return this.api.post<Order>(`orders/${id}/cancel`);
  }
}

/** The test customer's bank accounts (Banking session). */
export class BankApi {
  constructor(readonly client: ApiClient) {}

  accounts(): Promise<BankAccount[]> {
    return this.client.get<BankAccount[]>('bank/accounts');
  }

  account(id: string): Promise<BankAccount> {
    return this.client.get<BankAccount>(`bank/accounts/${id}`);
  }

  /** The customer's first open account of a type, such as CHECKING or SAVINGS. */
  async accountOfType(type: string): Promise<BankAccount> {
    const match = (await this.accounts()).find((account) => account.type === type && account.status === 'ACTIVE' && !account.locked);
    if (!match) throw new Error(`The test customer has no open ${type} account.`);
    return match;
  }

  async transactions(accountId: string, type?: string): Promise<BankTransaction[]> {
    return (await this.client.getPage<BankTransaction>(`bank/accounts/${accountId}/transactions`, { type, pageSize: 50 })).data;
  }

  async transactionByReference(accountId: string, reference: string): Promise<BankTransaction | undefined> {
    return (await this.transactions(accountId)).find((transaction) => transaction.reference === reference);
  }

  deposit(accountId: string, amountCents: number): Promise<BankTransaction> {
    return this.client.post<BankTransaction>('bank/deposits', { accountId, amountCents }, { 'Idempotency-Key': idempotencyKey() });
  }

  /** Sends a deposit and returns the raw response, for checks on refused requests. */
  depositRaw(accountId: string, amountCents: number) {
    return this.client.postRaw('bank/deposits', { accountId, amountCents }, { 'Idempotency-Key': idempotencyKey() });
  }
}

/** The test customer's hotel bookings (Travel session). */
export class TravelApi {
  constructor(private readonly api: ApiClient) {}

  book(input: { roomId: string; checkIn: string; checkOut: string; guests: number; leadGuestName: string }): Promise<Booking> {
    return this.api.post<Booking>('bookings', input);
  }

  bookRaw(input: { roomId: string; checkIn: string; checkOut: string; guests: number; leadGuestName: string }) {
    return this.api.postRaw('bookings', input);
  }

  booking(id: string): Promise<Booking> {
    return this.api.get<Booking>(`bookings/${id}`);
  }

  cancel(id: string): Promise<Booking> {
    return this.api.post<Booking>(`bookings/${id}/cancel`);
  }
}
