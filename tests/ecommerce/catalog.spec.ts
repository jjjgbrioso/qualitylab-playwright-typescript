import { expect, test } from '@fixtures';
import { ecommerce } from '@data/testData';

const { products, categories, priceRange, invalidPriceRange, messages } = ecommerce;

/** Search and filters. Expected results come from the API, so they stay right if the catalogue changes. */
test.describe('Product search and filters', { tag: '@ecommerce' }, () => {
  test.beforeEach(async ({ signIn, shopPage }) => {
    await signIn('ecommerce');
    await shopPage.goto();
  });

  test('search finds matching products', { tag: '@smoke' }, async ({ shopPage, api }) => {
    await shopPage.search(products.keyboard.searchTerm);

    const expected = await (await api.catalog()).products({ q: products.keyboard.searchTerm });
    expect(await shopPage.productNames()).toContain(products.keyboard.name);
    expect((await shopPage.productIds()).sort()).toEqual(expected.map((product) => product.id).sort());
  });

  test('a search with no matches shows the empty state', { tag: '@negative' }, async ({ shopPage }) => {
    await shopPage.search(ecommerce.search.noMatchTerm);

    await expect(shopPage.emptyState).toBeVisible();
    await expect(shopPage.cards).toHaveCount(0);
  });

  test('filter by category shows only that category', async ({ shopPage, api }) => {
    await shopPage.filter({ category: categories.books });

    const expected = await (await api.catalog()).products({ category: categories.books });
    expect(expected.length).toBeGreaterThan(0);
    expect((await shopPage.productIds()).sort()).toEqual(expected.map((product) => product.id).sort());
  });

  test('filter by price range keeps every price inside the range', async ({ shopPage, api }) => {
    await shopPage.filter({ minPrice: priceRange.min, maxPrice: priceRange.max });

    const prices = await shopPage.prices();
    expect(prices.length).toBeGreaterThan(0);
    for (const price of prices) {
      expect(price).toBeGreaterThanOrEqual(priceRange.min * 100);
      expect(price).toBeLessThanOrEqual(priceRange.max * 100);
    }
    // The shop shows one page of products; the count above the grid gives the full total.
    const expected = await (await api.catalog()).products({ minPrice: priceRange.min, maxPrice: priceRange.max });
    expect(prices).toHaveLength(Math.min(expected.length, ecommerce.shopPageSize));
    await expect(shopPage.resultCount).toContainText(String(expected.length));
  });

  test('in-stock and on-sale filters show only matching products', async ({ shopPage, api }) => {
    await shopPage.filter({ inStock: true, onSale: true });

    const expected = await (await api.catalog()).products({ inStock: true, onSale: true });
    const ids = await shopPage.productIds();
    expect(ids.sort()).toEqual(expected.map((product) => product.id).sort());
    for (const id of ids) {
      await expect(shopPage.saleBadge(id)).toBeVisible();
      await expect(shopPage.outOfStockBadge(id)).toHaveCount(0);
    }
  });

  test('a maximum price below the minimum is refused', { tag: '@negative' }, async ({ shopPage }) => {
    await shopPage.filter({ minPrice: invalidPriceRange.min, maxPrice: invalidPriceRange.max });

    await expect(shopPage.filterError).toHaveText(messages.invalidPriceRange);
  });

  test('sort by price puts the cheapest product first', async ({ shopPage }) => {
    await shopPage.sortBy(ecommerce.sort.cheapestFirst);

    const prices = await shopPage.prices();
    expect(prices.length).toBeGreaterThan(1);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
});

test.describe('Product details', { tag: '@ecommerce' }, () => {
  test('the detail page shows the product with its sale and original price', async ({ signIn, productPage, api }) => {
    await signIn('ecommerce');
    const expected = await (await api.catalog()).product(products.onSaleThrow.id);

    await productPage.goto(products.onSaleThrow.id);

    await expect(productPage.name).toHaveText(expected.name);
    expect(await productPage.priceCents()).toBe(expected.priceCents);
    expect(expected.listPriceCents, 'the test product should be on sale').not.toBeNull();
    expect(await productPage.listPriceCents()).toBe(expected.listPriceCents);
  });
});
