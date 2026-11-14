import { expect, test } from '@fixtures';
import { banking } from '@data/testData';

test.describe('Account balances', { tag: '@banking' }, () => {
  test.beforeEach(async ({ signIn }) => {
    await signIn('banking');
  });

  test('the total balance is the sum of the account balances', { tag: '@smoke' }, async ({ bankingPage }) => {
    await bankingPage.goto();

    const ids = await bankingPage.accountIds();
    expect(ids.length).toBeGreaterThan(0);
    let sum = 0;
    for (const id of ids) sum += await bankingPage.accountBalanceCents(id);
    expect(await bankingPage.totalBalanceCents()).toBe(sum);
  });

  test('the dashboard and account page match the balances from the API', async ({ exclusive, bankingPage, accountPage, api }) => {
    // Hold the bank so no other test moves money between reading the page and the API.
    await exclusive('bank');
    const bank = await api.bank();
    const accounts = await bank.accounts();

    await bankingPage.goto();
    for (const account of accounts) {
      expect(await bankingPage.accountBalanceCents(account.id), account.name).toBe(account.balanceCents);
    }

    const checking = await bank.accountOfType(banking.accountTypes.checking);
    await accountPage.goto(checking.id);
    expect(await accountPage.balanceCents()).toBe(checking.balanceCents);
    await expect(accountPage.transactions.or(accountPage.emptyState).first()).toBeVisible();
  });
});
