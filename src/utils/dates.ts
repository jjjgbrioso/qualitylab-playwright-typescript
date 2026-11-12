export interface Stay {
  checkIn: string;
  checkOut: string;
  nights: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD in UTC, the form the app's date inputs and API use. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysFromToday(days: number): string {
  const today = new Date();
  const utcMidnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return isoDate(new Date(utcMidnight + days * DAY_MS));
}

/**
 * A stay far in the future (400 to 700 days ahead) at a random start, so parallel runs and real
 * visitors are very unlikely to hold the same room on the same nights.
 */
export function freeStay(nights: number): Stay {
  const start = 400 + Math.floor(Math.random() * 300);
  return { checkIn: daysFromToday(start), checkOut: daysFromToday(start + nights), nights };
}
