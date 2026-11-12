import { type Api, expect, type SharedResource, test } from '@fixtures';
import { cards, checkoutDetails, products } from '@data/testData';

/**
 * The test customer has one cart on the server. Every test here holds the "cart" lock, so tests
 * in other browsers and workers wait instead of changing the same cart, and each starts empty.
 */
test.describe('Shopping cart and checkout', { tag: '@ecommerce' }, () => {
  test.beforeEach(async ({ exclusive, api, signIn }) => {
    await exclusive('cart');
    await (await api.shop()).clearCart();
    await signIn('ecommerce');
  });

  test.afterEach(async ({ api }) => {
    await (await api.shop()).clearCart();
  });

  test('add a product to the cart', { tag: '@smoke' }, async ({ productPage, cartPage, api }) => {
    const product = await (await api.catalog()).product(products.notebook.id);

    await productPage.goto(product.id);
    await productPage.addToCart(2);
    await cartPage.goto();

    await expect(cartPage.quantityInput(product.id)).toHaveValue('2');
    expect(await cartPage.lineTotalCents(product.id)).toBe(2 * product.priceCents);
    const cart = await (await api.shop()).cart();
    expect(cart.items.map((item) => [item.productId, item.quantity])).toEqual([[product.id, 2]]);
  });

  test('change the quantity of a cart line', async ({ cartPage, api }) => {
    const shop = await api.shop();
    await shop.addToCart(products.notebook.id, 1);
    const unitPrice = (await (await api.catalog()).product(products.notebook.id)).priceCents;

    await cartPage.goto();
    await cartPage.changeQuantity(products.notebook.id, 3);

    expect(await cartPage.lineTotalCents(products.notebook.id)).toBe(3 * unitPrice);
    expect((await shop.cart()).items[0]?.quantity).toBe(3);
  });

  test('remove a product from the cart', async ({ cartPage, api }) => {
    const shop = await api.shop();
    await shop.addToCart(products.notebook.id, 1);
    await shop.addToCart(products.markers.id, 1);

    await cartPage.goto();
    await cartPage.remove(products.notebook.id);

    await expect(cartPage.line(products.markers.id)).toBeVisible();
    await cartPage.remove(products.markers.id);
    await expect(cartPage.emptyState).toBeVisible();
    expect((await shop.cart()).items).toHaveLength(0);
  });

  test('check out with an approved card', { tag: '@smoke' }, async ({ cartPage, checkoutPage, orderPage, ordersPage, api, cleanup }) => {
    const shop = await api.shop();
    await shop.addToCart(products.markers.id, 2);

    await cartPage.goto();
    const cartTotal = await cartPage.total.innerText();
    await cartPage.proceedToCheckout();
    const orderId = await checkoutPage.placeOrder(checkoutDetails(cards.approved));
    cleanup.add(`cancel order ${orderId}`, async () => {
      if ((await shop.order(orderId)).status === 'PAID') await shop.cancelOrder(orderId);
    });

    await expect(orderPage.placedConfirmation).toBeVisible();
    await expect(orderPage.status).toHaveText(/paid/i);
    await expect(orderPage.item(products.markers.id)).toBeVisible();
    await expect(orderPage.total).toHaveText(cartTotal);

    const order = await shop.order(orderId);
    expect(order.status).toBe('PAID');
    await expect(orderPage.orderNumber).toHaveText(order.orderNumber);
    expect((await shop.cart()).items, 'checkout empties the cart').toHaveLength(0);

    await ordersPage.goto();
    await expect(ordersPage.row(orderId)).toBeVisible();
    await expect(ordersPage.status(orderId)).toHaveText(/paid/i);
  });

  test('a declined card does not place an order', { tag: '@negative' }, async ({ checkoutPage, page, api }) => {
    const shop = await api.shop();
    await shop.addToCart(products.markers.id, 1);

    await checkoutPage.goto();
    await checkoutPage.fill(checkoutDetails(cards.declined));
    await checkoutPage.submit();

    await expect(checkoutPage.error).toHaveText('The card was declined. No payment was taken.');
    await expect(page).toHaveURL(/\/checkout/);
    expect((await shop.cart()).items, 'the cart keeps its items').toHaveLength(1);
  });

  test('checkout requires the shipping and payment details', { tag: '@negative' }, async ({ checkoutPage, page, api }) => {
    await (await api.shop()).addToCart(products.markers.id, 1);

    await checkoutPage.goto();
    await checkoutPage.submit();

    await expect(checkoutPage.errors.field('checkout-full-name')).toContainText('Full name');
    await expect(checkoutPage.errors.field('checkout-card-number')).toBeVisible();
    await expect(page).toHaveURL(/\/checkout/);
  });
});

test.describe('Order management', { tag: '@ecommerce' }, () => {
  /** Places an order through the API. The cart lock it takes is held until the test ends. */
  async function placeOrderThroughApi(api: Api, exclusive: (resource: SharedResource) => Promise<void>) {
    await exclusive('cart');
    const shop = await api.shop();
    await shop.clearCart();
    await shop.addToCart(products.markers.id, 1);
    return { shop, order: await shop.checkout(checkoutDetails(cards.approved)) };
  }

  test('order history lists a new order and opens its details', async ({ api, exclusive, cleanup, signIn, ordersPage, orderPage }) => {
    const { shop, order } = await placeOrderThroughApi(api, exclusive);
    cleanup.add(`cancel order ${order.id}`, () => shop.cancelOrder(order.id));
    await signIn('ecommerce');

    await ordersPage.goto();
    await expect(ordersPage.row(order.id)).toBeVisible();
    await expect(ordersPage.status(order.id)).toHaveText(/paid/i);
    await ordersPage.open(order.id);

    await expect(orderPage.orderNumber).toHaveText(order.orderNumber);
    await expect(orderPage.item(products.markers.id)).toBeVisible();
    expect(await orderPage.totalCents()).toBe(order.totalCents);
  });

  test('a customer cancels a paid order', async ({ api, exclusive, cleanup, signIn, orderPage }) => {
    const { shop, order } = await placeOrderThroughApi(api, exclusive);
    // If the test fails before the UI cancels the order, cancel it through the API.
    cleanup.add(`cancel order ${order.id}`, async () => {
      if ((await shop.order(order.id)).status === 'PAID') await shop.cancelOrder(order.id);
    });
    await signIn('ecommerce');

    await orderPage.goto(order.id);
    await orderPage.cancel();

    await expect(orderPage.status).toHaveText(/cancelled/i);
    expect((await shop.order(order.id)).status).toBe('CANCELLED');
  });

  test('the status filter shows only cancelled orders', async ({ api, exclusive, signIn, ordersPage }) => {
    const { shop, order } = await placeOrderThroughApi(api, exclusive);
    await shop.cancelOrder(order.id);
    await signIn('ecommerce');

    await ordersPage.goto();
    await ordersPage.filterByStatus('CANCELLED');

    await expect(ordersPage.row(order.id)).toBeVisible();
    const statuses = await ordersPage.statuses();
    expect(statuses.length).toBeGreaterThan(0);
    for (const status of statuses) expect(status).toMatch(/cancelled/i);
  });
});
