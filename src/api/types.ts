/** The parts of the QualityLab API responses these tests use. */

export type AppModule = 'ecommerce' | 'banking' | 'travel' | 'admin';

export interface ApiPage<T> {
  data: T[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number; hasNext: boolean };
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: { field?: string; message: string }[]; requestId?: string };
}

export interface Product {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  listPriceCents: number | null;
  onSale: boolean;
  stock: number;
  inStock: boolean;
  rating: number;
}

export interface CartLine {
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface Cart {
  items: CartLine[];
  itemCount: number;
  subtotalCents: number;
  totalCents: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  items: { productId: string; name: string; quantity: number }[];
}

export interface BankAccount {
  id: string;
  accountNumber: string;
  name: string;
  type: string;
  status: string;
  balanceCents: number;
  locked: boolean;
}

export interface BankTransaction {
  id: string;
  reference: string;
  accountId: string;
  type: string;
  amountCents: number;
  balanceAfterCents: number;
  counterparty: string | null;
}

export interface Hotel {
  id: string;
  name: string;
  city: string;
  country: string;
  starRating: number;
  amenities: string[];
}

export interface Room {
  id: string;
  hotelId: string;
  name: string;
  maxGuests: number;
  pricePerNightCents: number;
  totalRooms: number;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  status: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  leadGuestName: string;
  nights: number;
  totalCents: number;
  room: { id: string; pricePerNightCents: number };
}

export interface CheckoutDetails {
  shipping: { fullName: string; address: string; city: string; postcode: string; country: string };
  payment: { cardholderName: string; cardNumber: string; expiry: string; cvv: string };
}
