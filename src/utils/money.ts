/** Turns displayed money such as "₱1,234.56", "$80.00" or "-₱5.00" into whole cents. */
export function toCents(text: string): number {
  const cleaned = text.replace(/[^0-9.-]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error(`"${text}" is not an amount of money.`);
  }
  return Math.round(Number(cleaned) * 100);
}

/** Cents as the plain decimal a form field expects, such as 1234 -> "12.34". */
export function toAmountInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
