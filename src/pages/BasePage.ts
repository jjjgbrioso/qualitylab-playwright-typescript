import type { Locator, Page } from '@playwright/test';
import { NavBar } from './components/NavBar';

/** Shared behaviour for every page object. Locators use the app's data-testid attributes. */
export abstract class BasePage {
  readonly nav: NavBar;

  constructor(readonly page: Page) {
    this.nav = new NavBar(page);
  }

  protected byTestId(id: string): Locator {
    return this.page.getByTestId(id);
  }

  /** Every element whose test id starts with a prefix, such as all product cards. */
  protected byTestIdPrefix(prefix: string): Locator {
    return this.page.locator(`[data-testid^="${prefix}"]`);
  }

  /** The ids that follow a prefix, such as "prod_0003" from "product-card-prod_0003". */
  protected async idsAfter(prefix: string): Promise<string[]> {
    const ids = await this.byTestIdPrefix(prefix).evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-testid') ?? ''),
    );
    return ids.map((id) => id.slice(prefix.length));
  }

  /**
   * Submits a plain GET form. The browser loads a new page, so this waits for a URL that carries
   * the expected query values before anything on the new page is read.
   */
  protected async submitGetForm(submit: Locator, expected: Record<string, string>): Promise<void> {
    await Promise.all([
      this.page.waitForURL(
        (url) => Object.entries(expected).every(([key, value]) => url.searchParams.get(key) === value),
        { waitUntil: 'load' },
      ),
      submit.click(),
    ]);
  }
}
