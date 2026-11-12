import { test as base } from '@playwright/test';
import { CartPage } from '@pages/ecommerce/CartPage';
import { CheckoutPage } from '@pages/ecommerce/CheckoutPage';
import { OrderPage } from '@pages/ecommerce/OrderPage';
import { OrdersPage } from '@pages/ecommerce/OrdersPage';
import { ProductPage } from '@pages/ecommerce/ProductPage';
import { ShopPage } from '@pages/ecommerce/ShopPage';

export interface EcommerceFixtures {
  shopPage: ShopPage;
  productPage: ProductPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  ordersPage: OrdersPage;
  orderPage: OrderPage;
}

/** E-commerce page objects. */
export const test = base.extend<EcommerceFixtures>({
  shopPage: async ({ page }, use) => use(new ShopPage(page)),
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
  ordersPage: async ({ page }, use) => use(new OrdersPage(page)),
  orderPage: async ({ page }, use) => use(new OrderPage(page)),
});
