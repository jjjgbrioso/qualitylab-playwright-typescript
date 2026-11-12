import type { Locator } from '@playwright/test';
import type { AppModule } from '@api/types';
import { BasePage } from '../BasePage';

/** The landing page, where a visitor picks a module before signing in. */
export class HomePage extends BasePage {
  readonly title: Locator = this.byTestId('home-title');

  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.title.waitFor();
  }

  moduleTile(module: AppModule): Locator {
    return this.byTestId(`home-module-${module}`);
  }

  async chooseModule(module: AppModule): Promise<void> {
    await this.moduleTile(module).click();
  }
}
