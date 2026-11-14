import { expect, test } from '@fixtures';
import { banking } from '@data/testData';
import { uniqueSmallAmountCents } from '@utils/random';

const { accountTypes, transactionTypes } = banking;

/**
 * Money movements. Each test holds the "bank" lock, so balances read before and after belong to
 * this test alone. Amounts are small and random: the bank refuses an identical transaction within
 * 30 seconds. Deposits, withdrawals and transfers cannot be undone in the app.
 */
test.describe('Deposits, withdrawals and transfers', { tag: '@banking' }, () => {
  test.beforeEach(async ({ exclusive, signIn }) => {
    await exclusive('bank');
    await signIn('banking');
  });

  test('deposit money', { tag: '@smoke' }, async ({ depositPage, api }) => {
    const bank = await api.bank();
    const account = await bank.accountOfType(accountTypes.checking);
    const amount = uniqueSmallAmountCents();

    await depositPage.goto();
    await depositPage.submit({ accountId: account.id, amountCents: amount });

    await expect(depositPage.success).toBeVisible();
    await expect(depositPage.reference).toHaveText(new RegExp(`^${banking.referencePrefix}`));
    expect(await depositPage.newBalanceCents()).toBe(account.balanceCents + amount);

    const transaction = await bank.transactionByReference(account.id, await depositPage.reference.innerText());
    expect(transaction).toMatchObject({ type: transactionTypes.deposit, amountCents: amount, balanceAfterCents: account.balanceCents + amount });
  });

  test('withdraw money', async ({ withdrawalPage, api }) => {
    const bank = await api.bank();
    const account = await bank.accountOfType(accountTypes.checking);
    const amount = uniqueSmallAmountCents();
    test.skip(account.balanceCents < amount, 'The checking account has too little money for a withdrawal.');

    await withdrawalPage.goto();
    await withdrawalPage.submit({ accountId: account.id, amountCents: amount });

    await expect(withdrawalPage.success).toBeVisible();
    expect(await withdrawalPage.newBalanceCents()).toBe(account.balanceCents - amount);
    const transaction = await bank.transactionByReference(account.id, await withdrawalPage.reference.innerText());
    expect(transaction).toMatchObject({ type: transactionTypes.withdrawal, amountCents: amount });
  });

  test('transfer money between own accounts', { tag: '@smoke' }, async ({ transferPage, api }) => {
    const bank = await api.bank();
    const from = await bank.accountOfType(accountTypes.checking);
    const to = await bank.accountOfType(accountTypes.savings);
    const amount = uniqueSmallAmountCents();
    test.skip(from.balanceCents < amount, 'The checking account has too little money for a transfer.');

    await transferPage.goto();
    await transferPage.submit({ accountId: from.id, amountCents: amount, toAccountNumber: to.accountNumber });

    await expect(transferPage.success).toBeVisible();
    expect(await transferPage.newBalanceCents()).toBe(from.balanceCents - amount);
    expect((await bank.account(from.id)).balanceCents).toBe(from.balanceCents - amount);
    expect((await bank.account(to.id)).balanceCents).toBe(to.balanceCents + amount);
    const sent = await bank.transactionByReference(from.id, await transferPage.reference.innerText());
    expect(sent).toMatchObject({ type: transactionTypes.transferOut, amountCents: amount });
  });

  test('the transaction history shows a new deposit and filters by type', async ({ depositPage, accountPage, api }) => {
    const bank = await api.bank();
    const account = await bank.accountOfType(accountTypes.savings);
    const amount = uniqueSmallAmountCents();

    await depositPage.goto();
    await depositPage.submit({ accountId: account.id, amountCents: amount });
    const reference = await depositPage.reference.innerText();
    const transaction = await bank.transactionByReference(account.id, reference);
    expect(transaction, `transaction ${reference} in the API`).toBeDefined();

    await accountPage.goto(account.id);
    await expect(accountPage.reference(transaction!.id)).toHaveText(reference);
    await expect(accountPage.type(transaction!.id)).toHaveText(transactionTypes.deposit);
    expect(await accountPage.amountCents(transaction!.id)).toBe(amount);

    await accountPage.filterByType(transactionTypes.deposit);
    await expect(accountPage.row(transaction!.id)).toBeVisible();
    expect(new Set(await accountPage.types())).toEqual(new Set([transactionTypes.deposit]));
  });
});
