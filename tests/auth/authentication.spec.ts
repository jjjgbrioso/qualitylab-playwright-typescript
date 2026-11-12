import { expect, test } from '@fixtures';

test.describe('Authentication', { tag: ['@auth', '@ecommerce'] }, () => {
  test('a customer signs in to E-commerce from the home page', { tag: '@smoke' }, async ({ page, homePage, loginPage, credentials }) => {
    await homePage.goto();
    await homePage.chooseModule('ecommerce');
    await expect(loginPage.title).toHaveText('Sign in to E-commerce');

    await loginPage.signIn(credentials.username, credentials.password);

    await expect(page).toHaveURL(/\/shop/);
    await expect(loginPage.nav.currentModule).toContainText('E-commerce');
    await expect(loginPage.nav.userName).toBeVisible();
  });

  test('a wrong password is refused', { tag: '@negative' }, async ({ page, homePage, loginPage, credentials }) => {
    await homePage.goto();
    await homePage.chooseModule('ecommerce');

    await loginPage.signIn(credentials.username, 'Wrong-Password-1!');

    await expect(loginPage.error).toHaveText('The email or password is incorrect.');
    await expect(page).toHaveURL(/\/login/);
    await expect(loginPage.nav.currentModule).toHaveCount(0);
  });

  test('the sign-in page asks for a module when none is chosen', { tag: '@negative' }, async ({ loginPage, credentials }) => {
    await loginPage.goto();

    await loginPage.signIn(credentials.username, credentials.password);

    await expect(loginPage.moduleError).toHaveText('Choose a module.');
  });

  test('a session opens only the module it signed in to', { tag: '@negative' }, async ({ page, signIn, loginPage }) => {
    await signIn('banking');

    await page.goto('/cart');

    await expect(page).toHaveURL(/\/login\?next=%2Fcart/);
    await expect(loginPage.title).toHaveText('Sign in to E-commerce');
    await expect(loginPage.switchNotice).toContainText('You are signed in to Banking');
  });

  test('signing out ends the session', async ({ page, signIn, shopPage, loginPage }) => {
    await signIn('ecommerce');
    await shopPage.goto();
    await expect(shopPage.nav.currentModule).toContainText('E-commerce');

    await shopPage.nav.logout();
    await expect(shopPage.nav.currentModule).toHaveCount(0);

    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login\?next=%2Forders/);
    await expect(loginPage.requiredNotice).toBeVisible();
  });
});
