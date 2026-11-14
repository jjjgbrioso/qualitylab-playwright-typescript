import { expect, test } from '@fixtures';
import { auth, format } from '@data/testData';

test.describe('Authentication', { tag: ['@auth', '@ecommerce'] }, () => {
  test('a customer signs in to E-commerce from the home page', { tag: '@smoke' }, async ({ page, homePage, loginPage, credentials }) => {
    await homePage.goto();
    await homePage.chooseModule('ecommerce');
    await expect(loginPage.title).toHaveText(format(auth.messages.signInTitle, { module: auth.moduleNames.ecommerce }));

    await loginPage.signIn(credentials.username, credentials.password);

    await expect(page).toHaveURL(/\/shop/);
    await expect(loginPage.nav.currentModule).toContainText(auth.moduleNames.ecommerce);
    await expect(loginPage.nav.userName).toBeVisible();
  });

  test('a wrong password is refused', { tag: '@negative' }, async ({ page, homePage, loginPage, credentials }) => {
    await homePage.goto();
    await homePage.chooseModule('ecommerce');

    await loginPage.signIn(credentials.username, auth.wrongPassword);

    await expect(loginPage.error).toHaveText(auth.messages.invalidCredentials);
    await expect(page).toHaveURL(/\/login/);
    await expect(loginPage.nav.currentModule).toHaveCount(0);
  });

  test('the sign-in page asks for a module when none is chosen', { tag: '@negative' }, async ({ loginPage, credentials }) => {
    await loginPage.goto();

    await loginPage.signIn(credentials.username, credentials.password);

    await expect(loginPage.moduleError).toHaveText(auth.messages.chooseModule);
  });

  test('a session opens only the module it signed in to', { tag: '@negative' }, async ({ page, signIn, loginPage }) => {
    await signIn('banking');

    await page.goto(auth.protectedPages.cart);

    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(auth.protectedPages.cart)}`));
    await expect(loginPage.title).toHaveText(format(auth.messages.signInTitle, { module: auth.moduleNames.ecommerce }));
    await expect(loginPage.switchNotice).toContainText(format(auth.messages.signedInToOtherModule, { module: auth.moduleNames.banking }));
  });

  test('signing out ends the session', async ({ page, signIn, shopPage, loginPage }) => {
    await signIn('ecommerce');
    await shopPage.goto();
    await expect(shopPage.nav.currentModule).toContainText(auth.moduleNames.ecommerce);

    await shopPage.nav.logout();
    await expect(shopPage.nav.currentModule).toHaveCount(0);

    await page.goto(auth.protectedPages.orders);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(auth.protectedPages.orders)}`));
    await expect(loginPage.requiredNotice).toBeVisible();
  });
});
