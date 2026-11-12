import type { Locator } from '@playwright/test';
import type { AppModule } from '@api/types';
import { BasePage } from '../BasePage';

/** The sign-in page. When it is opened for a module's page, the module is fixed and not shown. */
export class LoginPage extends BasePage {
  readonly title: Locator = this.byTestId('login-title');
  readonly email: Locator = this.byTestId('login-email-input');
  readonly password: Locator = this.byTestId('login-password-input');
  readonly moduleSelect: Locator = this.byTestId('login-module-select');
  readonly submitButton: Locator = this.byTestId('login-submit-button');
  readonly error: Locator = this.byTestId('login-error');
  readonly moduleError: Locator = this.byTestId('login-module-error');
  readonly switchNotice: Locator = this.byTestId('login-switch-notice');
  readonly requiredNotice: Locator = this.byTestId('login-required-notice');

  /** The plain sign-in page, where the visitor chooses the module. */
  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.title.waitFor();
  }

  async signIn(username: string, password: string, module?: AppModule): Promise<void> {
    await this.email.fill(username);
    await this.password.fill(password);
    if (module) await this.moduleSelect.selectOption(module);
    await this.submitButton.click();
  }
}
