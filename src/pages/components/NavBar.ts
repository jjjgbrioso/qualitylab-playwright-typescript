import type { Locator, Page } from '@playwright/test';

/** The top navigation bar, which shows the module the session is signed in to. */
export class NavBar {
  readonly currentModule: Locator;
  readonly userName: Locator;
  readonly logoutButton: Locator;
  /** "Cart (n)", shown in the E-commerce module. */
  readonly cartLink: Locator;

  constructor(page: Page) {
    this.cartLink = page.getByTestId('nav-link-cart');
    this.currentModule = page.getByTestId('nav-current-module');
    this.userName = page.getByTestId('nav-user-name');
    this.logoutButton = page.getByTestId('nav-logout');
  }

  /** The number of items the navigation bar shows in the cart. */
  async cartCount(): Promise<number> {
    const match = /\((\d+)\)/.exec(await this.cartLink.innerText());
    return match ? Number(match[1]) : 0;
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }
}
