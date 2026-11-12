import { expect, test } from '@fixtures';
import { errorOf } from '@api/ApiClient';
import { banking } from '@data/testData';
import { uniqueSmallAmountCents } from '@utils/random';

test.describe('Banking: refused transactions', { tag: ['@banking', '@negative'] }, () => {
  test.beforeEach(async ({ signIn }) => {
    await signIn('banking');
  });

  test('a withdrawal larger than the balance is refused', async ({ exclusive, withdrawalPage, api }) => {
    await exclusive('bank');
    const bank = await api.bank();
    // The account with less money, so balance + ₱1.00 is most likely under the single-transaction limit.
    const [checking, savings] = [await bank.accountOfType('CHECKING'), await bank.accountOfType('SAVINGS')];
    const account = checking.balanceCents <= savings.balanceCents ? checking : savings;
    const tooMuch = account.balanceCents + 100;
    test.skip(tooMuch > banking.maxSingleTransactionCents, 'The balance is above the single-transaction limit.');

    await withdrawalPage.goto();
    await withdrawalPage.submit({ accountId: account.id, amountCents: tooMuch });

    await expect(withdrawalPage.success).toHaveCount(0);
    expect(await withdrawalPage.errors.texts()).toContain('The account balance is too low for this transaction.');
    expect((await bank.account(account.id)).balanceCents, 'balance unchanged').toBe(account.balanceCents);
  });

  test('an amount above the single-transaction limit is refused', async ({ depositPage, api }) => {
    const account = await (await api.bank()).accountOfType('CHECKING');

    await depositPage.goto();
    await depositPage.submit({ accountId: account.id, amountCents: banking.maxSingleTransactionCents + 1 });

    await expect(depositPage.success).toHaveCount(0);
    expect((await depositPage.errors.texts()).join(' ')).toContain('at most ₱10,000.00');
  });

  const invalidTransfers = [
    { name: 'an account number that is not 10 digits', to: banking.shortAccountNumber, amount: '10.00', message: 'Account number must be exactly 10 digits.' },
    { name: 'an account number nobody has', to: banking.unknownAccountNumber, amount: '10.00', message: 'No account matches this value.' },
    { name: 'the same account as the source', to: 'SOURCE', amount: '10.00', message: 'Choose a different destination account.' },
    { name: 'an amount of zero', to: 'SAVINGS', amount: '0', message: 'Amount must be greater than zero.' },
  ];

  for (const transfer of invalidTransfers) {
    test(`a transfer to ${transfer.name} is refused`, async ({ transferPage, api }) => {
      const bank = await api.bank();
      const from = await bank.accountOfType('CHECKING');
      const to =
        transfer.to === 'SOURCE' ? from.accountNumber : transfer.to === 'SAVINGS' ? (await bank.accountOfType('SAVINGS')).accountNumber : transfer.to;

      await transferPage.goto();
      await transferPage.submit({ accountId: from.id, amountText: transfer.amount, toAccountNumber: to });

      await expect(transferPage.success).toHaveCount(0);
      expect(await transferPage.errors.texts()).toContain(transfer.message);
    });
  }

  test('the API refuses an identical deposit within 30 seconds', { tag: '@api' }, async ({ exclusive, api }) => {
    await exclusive('bank');
    const bank = await api.bank();
    const account = await bank.accountOfType('SAVINGS');
    const amount = uniqueSmallAmountCents();

    const first = await bank.depositRaw(account.id, amount);
    expect(first.status()).toBe(201);
    const second = await bank.depositRaw(account.id, amount);

    expect(second.status()).toBe(409);
    const error = await errorOf(second);
    expect(error.code).toBe('DUPLICATE_TRANSACTION');
    expect(error.message).toContain('An identical transaction was made in the last');
    expect((await bank.account(account.id)).balanceCents, 'only the first deposit counts').toBe(account.balanceCents + amount);
  });
});
