import { expect, test } from '@fixtures';
import { errorOf } from '@api/ApiClient';
import { banking, format } from '@data/testData';
import { uniqueSmallAmountCents } from '@utils/random';

const { accountTypes, messages } = banking;

test.describe('Banking: refused transactions', { tag: ['@banking', '@negative'] }, () => {
  test.beforeEach(async ({ signIn }) => {
    await signIn('banking');
  });

  test('a withdrawal larger than the balance is refused', async ({ exclusive, withdrawalPage, api }) => {
    await exclusive('bank');
    const bank = await api.bank();
    // The account with less money, so the amount is most likely under the single-transaction limit.
    const [checking, savings] = [await bank.accountOfType(accountTypes.checking), await bank.accountOfType(accountTypes.savings)];
    const account = checking.balanceCents <= savings.balanceCents ? checking : savings;
    const tooMuch = account.balanceCents + banking.overBalanceByCents;
    test.skip(tooMuch > banking.maxSingleTransactionCents, 'The balance is above the single-transaction limit.');

    await withdrawalPage.goto();
    await withdrawalPage.submit({ accountId: account.id, amountCents: tooMuch });

    await expect(withdrawalPage.success).toHaveCount(0);
    expect(await withdrawalPage.errors.texts()).toContain(messages.insufficientFunds);
    expect((await bank.account(account.id)).balanceCents, 'balance unchanged').toBe(account.balanceCents);
  });

  test('an amount above the single-transaction limit is refused', async ({ depositPage, api }) => {
    const account = await (await api.bank()).accountOfType(accountTypes.checking);

    await depositPage.goto();
    await depositPage.submit({ accountId: account.id, amountCents: banking.maxSingleTransactionCents + 1 });

    await expect(depositPage.success).toHaveCount(0);
    expect((await depositPage.errors.texts()).join(' ')).toContain(messages.overSingleTransactionLimit);
  });

  // One test per row of banking.invalidTransfers in test-data.json.
  for (const transfer of banking.invalidTransfers) {
    test(`a transfer to ${transfer.name} is refused`, async ({ transferPage, api }) => {
      const bank = await api.bank();
      const from = await bank.accountOfType(accountTypes.checking);
      const savings = await bank.accountOfType(accountTypes.savings);
      const to = format(transfer.to, { sourceAccount: from.accountNumber, savingsAccount: savings.accountNumber });

      await transferPage.goto();
      await transferPage.submit({ accountId: from.id, amountText: transfer.amount, toAccountNumber: to });

      await expect(transferPage.success).toHaveCount(0);
      expect(await transferPage.errors.texts()).toContain(transfer.message);
    });
  }

  test('the API refuses an identical deposit within 30 seconds', { tag: '@api' }, async ({ exclusive, api }) => {
    await exclusive('bank');
    const bank = await api.bank();
    const account = await bank.accountOfType(accountTypes.savings);
    const amount = uniqueSmallAmountCents();

    const first = await bank.depositRaw(account.id, amount);
    expect(first.status()).toBe(201);
    const second = await bank.depositRaw(account.id, amount);

    expect(second.status()).toBe(409);
    const error = await errorOf(second);
    expect(error.code).toBe(banking.apiErrors.duplicateTransaction);
    expect(error.message).toContain(messages.duplicateTransaction);
    expect((await bank.account(account.id)).balanceCents, 'only the first deposit counts').toBe(account.balanceCents + amount);
  });
});
