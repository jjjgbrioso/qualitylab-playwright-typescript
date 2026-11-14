import type { CheckoutDetails } from '@api/types';
import data from './test-data.json';

/**
 * Typed access to src/data/test-data.json, where every test input and expected message lives.
 * Specs import from here, never from the JSON file directly, so the helpers below stay in one place.
 */
export const testData = data;
export const { auth, ecommerce, banking, travel } = data;

/** Fills {placeholders} in a message, such as format('Sign in to {module}', { module: 'Banking' }). */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    if (!(key in values)) throw new Error(`No value for ${placeholder} in "${template}".`);
    return String(values[key]);
  });
}

/** Text that a status badge shows, matched without regard to case ("PAID" matches "Paid"). */
export function statusText(status: string): RegExp {
  return new RegExp(status, 'i');
}

/** Shipping and payment details from the JSON, with the chosen test card. */
export function checkoutDetails(cardNumber: string = ecommerce.cards.approved): CheckoutDetails {
  return {
    shipping: { ...ecommerce.checkout.shipping },
    payment: { ...ecommerce.checkout.payment, cardNumber: cardNumber.replace(/\s/g, '') },
  };
}
