import type { Locator } from '@playwright/test';
import { toCents } from '@utils/money';
import { BasePage } from '../BasePage';

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  onSale?: boolean;
}

/** The catalogue: search, filters, sorting and product cards. */
export class ShopPage extends BasePage {
  readonly header: Locator = this.byTestId('shop-header');
  readonly searchInput: Locator = this.byTestId('product-search-input');
  readonly searchButton: Locator = this.byTestId('product-search-button');
  readonly category: Locator = this.byTestId('product-category-select');
  readonly minPrice: Locator = this.byTestId('product-min-price-input');
  readonly maxPrice: Locator = this.byTestId('product-max-price-input');
  readonly inStock: Locator = this.byTestId('product-in-stock-checkbox');
  readonly onSale: Locator = this.byTestId('product-on-sale-checkbox');
  readonly applyFilters: Locator = this.byTestId('product-filter-submit');
  readonly sort: Locator = this.byTestId('product-sort-select');
  readonly resultCount: Locator = this.byTestId('product-result-count');
  readonly grid: Locator = this.byTestId('product-grid');
  readonly emptyState: Locator = this.byTestId('product-empty-state');
  readonly filterError: Locator = this.byTestId('product-filter-error');
  readonly cards: Locator = this.byTestIdPrefix('product-card-');

  async goto(): Promise<void> {
    await this.page.goto('/shop');
    await this.header.waitFor();
  }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await this.submitGetForm(this.searchButton, { q: term });
    await this.waitForResults();
  }

  async filter(filters: ProductFilters): Promise<void> {
    const expected: Record<string, string> = {};
    if (filters.category !== undefined) {
      await this.category.selectOption(filters.category);
      expected.category = filters.category;
    }
    if (filters.minPrice !== undefined) {
      await this.minPrice.fill(String(filters.minPrice));
      expected.minPrice = String(filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      await this.maxPrice.fill(String(filters.maxPrice));
      expected.maxPrice = String(filters.maxPrice);
    }
    if (filters.inStock !== undefined) {
      await this.inStock.setChecked(filters.inStock);
      if (filters.inStock) expected.inStock = 'true';
    }
    if (filters.onSale !== undefined) {
      await this.onSale.setChecked(filters.onSale);
      if (filters.onSale) expected.onSale = 'true';
    }
    await this.submitGetForm(this.applyFilters, expected);
    await this.waitForResults();
  }

  /** The sort list submits the form as soon as it changes. */
  async sortBy(value: string): Promise<void> {
    await Promise.all([
      this.page.waitForURL((url) => url.searchParams.get('sort') === value, { waitUntil: 'load' }),
      this.sort.selectOption(value),
    ]);
    await this.waitForResults();
  }

  async waitForResults(): Promise<void> {
    await this.resultCount.or(this.emptyState).or(this.filterError).first().waitFor();
  }

  productIds(): Promise<string[]> {
    return this.idsAfter('product-card-');
  }

  async productNames(): Promise<string[]> {
    return (await this.byTestIdPrefix('product-name-').allInnerTexts()).map((name) => name.trim());
  }

  /** Card prices in cents, in the order shown. */
  async prices(): Promise<number[]> {
    const ids = await this.productIds();
    const prices: number[] = [];
    for (const id of ids) prices.push(toCents(await this.byTestId(`product-price-${id}`).innerText()));
    return prices;
  }

  saleBadge(productId: string): Locator {
    return this.byTestId(`product-sale-badge-${productId}`);
  }

  outOfStockBadge(productId: string): Locator {
    return this.byTestId(`product-out-of-stock-${productId}`);
  }
}
