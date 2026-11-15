# QualityLab: Playwright TypeScript framework

> Part of **[QualityLab](https://github.com/jjjgbrioso/QualityLab)**, a QA portfolio project. The app under test is live at https://quality-lab-jb.vercel.app.
> Test projects: [Selenium Java](https://github.com/jjjgbrioso/qualitylab-selenium-java) · [Playwright TypeScript](https://github.com/jjjgbrioso/qualitylab-playwright-typescript) · [Postman + Newman](https://github.com/jjjgbrioso/qualitylab-api-testing) · [JMeter](https://github.com/jjjgbrioso/qualitylab-jmeter)

UI tests for the deployed QualityLab site, with API-assisted setup and checks, written with Playwright Test and TypeScript. They run in Chromium, Firefox and WebKit, in parallel.

The framework is independent of the web application and of the Selenium Java framework. It only drives the site through a browser and its public REST API (`/api/v1`).

| Part | Tool |
| --- | --- |
| Language | TypeScript 5.9 (strict) |
| Runner | Playwright Test 1.65 |
| Runtime | Node.js 20.12 or newer (developed on Node 24) |
| Package manager | npm |

## Sample reports

Run against the deployed site on 14 November 2026.

| Run | Result | Report |
| --- | --- | --- |
| Fully passed | **141 of 141 passed** (100%), 0 flaky, in Chromium, Firefox and WebKit, 3m 23s | [PDF](docs/test-reports/passed/test-report.pdf) · [HTML](docs/test-reports/passed/test-report.html) |
| With failures | 25 of 33 passed, **8 failed** (75.8%). **A demonstration:** the read-only search and filter tests were run with a deliberately strict 4-second limit per test (`--timeout=4000`, no retries), so the slower ones fail with "Test timeout of 4000ms exceeded". | [PDF](docs/test-reports/failed/test-report.pdf) · [HTML](docs/test-reports/failed/test-report.html) |

What a report contains: the run details (date, environment, browsers, duration), the totals and pass rate, one table per module with each test's result and time, and for each failure the error message and the screenshot taken when it failed. Open the **PDF** links to read a report on GitHub; GitHub shows HTML files as source code, so download an HTML file and open it in a browser.

The **Video**, **Trace** and **Full Playwright report** links in a report only work on the machine that ran the tests, because they point into its local `test-results` folder.

## What is tested

47 tests per browser, 141 in total across Chromium, Firefox and WebKit.

| Area | Spec file | Tests |
| --- | --- | --- |
| Authentication | `tests/auth/authentication.spec.ts` | Sign in from the home page, wrong password, missing module, one module per session, sign out |
| E-commerce catalogue | `tests/ecommerce/catalog.spec.ts` | Search, no-match search, filter by category, price range, in stock + on sale, invalid price range, sort by price, product details |
| Cart, checkout, orders | `tests/ecommerce/cart-checkout.spec.ts` | Add to cart, change quantity, remove items, checkout with an approved card, declined card, missing checkout details, order history and details, cancel an order, filter orders by status |
| Banking balances | `tests/banking/accounts.spec.ts` | Total equals the sum of accounts, page balances match the API |
| Banking transactions | `tests/banking/transactions.spec.ts` | Deposit, withdrawal, transfer between own accounts, transaction history with type filter |
| Banking negative | `tests/banking/negative.spec.ts` | Insufficient balance, over the single-transaction limit, 4 invalid transfers, duplicate deposit refused by the API |
| Travel search | `tests/travel/search.spec.ts` | Search by destination, filter by stars and amenity, no results |
| Travel bookings | `tests/travel/booking.spec.ts` | Rooms available on free dates, sold-out room, API refuses a taken room, book a room, cancel a booking, check-out before check-in, past check-in, too many guests, stay over 30 nights |

Tags: `@smoke`, `@auth`, `@ecommerce`, `@banking`, `@travel`, `@negative`, `@api`.

## Project structure

```text
playwright-typescript/
├── playwright.config.ts        Browsers, parallelism, retries, reporters, screenshots, video, traces
├── package.json                Scripts and pinned dependencies
├── tsconfig.json               Strict TypeScript with path aliases (@pages, @api, @fixtures ...)
├── .env.example                Settings template (copy to .env, which git ignores)
├── src/
│   ├── config/env.ts           LOCAL / STAGING settings from environment variables and .env
│   ├── fixtures/               Fixture files, merged in index.ts into the `test` every spec imports
│   │   ├── auth.fixture.ts     credentials, signIn, homePage, loginPage
│   │   ├── data.fixture.ts     api, exclusive (lock), cleanup
│   │   ├── ecommerce.fixture.ts, banking.fixture.ts, travel.fixture.ts   Page objects per module
│   │   └── index.ts            mergeTests(...) and expect
│   ├── api/                    APIRequestContext client, typed models, domain helpers
│   ├── pages/                  Page objects
│   │   ├── components/         Reusable parts: NavBar, CancelAction, FormErrors
│   │   ├── common/             Home, login
│   │   ├── ecommerce/          Shop, product, cart, checkout, orders, order
│   │   ├── banking/            Dashboard, deposit/withdrawal/transfer, account
│   │   └── travel/             Hotels, hotel, room, booking
│   ├── data/
│   │   ├── test-data.json      All test inputs and expected messages, by module
│   │   └── testData.ts         Typed loader for the JSON, plus format() and checkoutDetails()
│   ├── reporting/              Summary reporter: HTML with a Download PDF button, and the PDF
│   └── utils/                  Money parsing, stay dates, random amounts, cross-process lock
└── tests/                      Spec files by module
```

### How it works

- **Page Object Model.** Each page class holds its locators (the app's `data-testid` attributes) and actions. Tests read like the user's steps.
- **Fixtures + spec files.** Spec files (`tests/**/*.spec.ts`) hold only test steps and checks. Everything they need comes from fixtures. Each spec imports `test` and `expect` from `@fixtures` (`src/fixtures/index.ts`), which merges the fixture files with Playwright's `mergeTests`. A test asks for what it needs by name, for example `async ({ signIn, cartPage, api }) => { ... }`, and Playwright creates only those, then tears them down after the test. The fixtures provide:
  - `signIn(module)` signs the browser in through the API in under a second. Only the authentication tests use the login form.
  - `api` creates API sessions on demand (`api.catalog()`, `api.shop()`, `api.bank()`, `api.travel()`) for setup and for checking results.
  - `exclusive(resource)` waits for and holds a shared resource (see below).
  - `cleanup.add(...)` registers undo steps, such as cancelling an order or booking. They run after the test even when it fails.
- **Test data in JSON.** Every input and expected message lives in `src/data/test-data.json`, grouped by `auth`, `ecommerce`, `banking` and `travel`. This covers product and hotel ids, search terms, price ranges, quantities, test cards, checkout details, stay lengths, invalid inputs, statuses and error texts. Spec files contain no hard-coded values. They import the data through `src/data/testData.ts`, for example `import { ecommerce } from '@data/testData'`.
  - Messages with a number use `{placeholders}`, filled with `format()`, for example `format(travel.messages.guestLimit, { maxGuests: 2 })`.
  - The invalid-transfer cases are a list in the JSON (`banking.invalidTransfers`). Adding a row adds a test.
  - Framework settings stay in code: random amount and date ranges in `src/utils`, lock timings, and the environment defaults in `src/config/env.ts`.
- **API-assisted tests.** Expected search and filter results, prices and balances come from the API at run time, so tests stay correct when live data changes. Orders and bookings for the history and cancel tests are created through the API, which is faster than the UI.
- **Explicit waits only.** Playwright's auto-waiting and web-first assertions (`expect(locator).toHaveText(...)`). No fixed sleeps.

### Parallel runs against one shared customer

All tests sign in as one test customer, who has one cart and one set of bank balances on the server. Tests that change these hold a lock while they run:

- `cart`: cart, checkout and order tests
- `bank`: deposits, withdrawals, transfers, and balance comparisons

The lock (`src/utils/lock.ts`) works across all Playwright worker processes and browsers on the machine. Tests that need the same lock queue for each other; everything else runs fully in parallel. Time spent waiting for a lock does not count against the test's timeout.

The lock covers one machine only. If you shard a run across several CI machines, give each machine its own test customer.

### Safe to run against the live site

- Banking amounts are random and small (₱1.01 to ₱9.99), which also avoids the bank's 30-second duplicate-transaction rule.
- Hotel stays use random dates 400 to 700 days ahead.
- Orders and bookings are cancelled after the test. Carts are emptied after cart tests.
- Deposits, withdrawals and transfers cannot be undone in the app. They stay in the test customer's history.

## Installation

Requirements: Node.js 20.12 or newer, and internet access. Check with `node -v`.

Run these in the `playwright-typescript` folder.

Install the packages (exact versions from `package-lock.json`):

```bash
npm ci
```

Download the three test browsers (about 1.3 GB including Chromium headless shell and ffmpeg, once per machine):

```bash
npx playwright install chromium firefox webkit
```

On Linux CI, add the browsers' system libraries with `npx playwright install --with-deps chromium firefox webkit`.

## Configuration

| Variable | Meaning | Default |
| --- | --- | --- |
| `TEST_ENV` | `staging` (the deployed site) or `local` | `staging` |
| `BASE_URL` | Site under test | staging: `https://quality-lab-jb.vercel.app`, local: `http://localhost:3100` |
| `API_BASE_URL` | REST API used for setup and checks | `<BASE_URL>/api/v1` |
| `TEST_USERNAME` | Test customer's email | **Required** |
| `TEST_PASSWORD` | Test customer's password | **Required** |
| `WORKERS` | Parallel workers | 4 (2 on CI) |
| `RETRIES` | Retries for a failed test | 1 (2 on CI) |

Values are read from real environment variables first, then from a `.env` file in this folder. Copy `.env.example` to `.env` and fill it in. `.env` is git-ignored, so **credentials never reach the repository**.

The test customer must be the seeded banking customer, because the banking tests use that customer's checking and savings accounts.

Setting the credentials for one PowerShell window instead of `.env`:

```powershell
$env:TEST_USERNAME = Read-Host "Test email"
$env:TEST_PASSWORD = Read-Host "Test password" -MaskInput
```

Choosing the environment in PowerShell:

```powershell
$env:TEST_ENV = "local"
```

## Running the tests

| Goal | Command |
| --- | --- |
| Everything, all three browsers | `npm test` |
| One browser | `npm run test:chromium` (or `test:firefox`, `test:webkit`) |
| Smoke tests | `npm run test:smoke` |
| One module | `npm run test:ecommerce` (or `test:banking`, `test:travel`) |
| Watch it run in a visible browser | `npm run test:headed` |
| One spec file | `npx playwright test tests/travel/booking.spec.ts` |
| Tests whose title matches | `npx playwright test -g "transfer"` |
| More or fewer workers | `npx playwright test --workers=2` |
| Step through a test | `npx playwright test tests/banking/transactions.spec.ts --project=chromium --debug` |
| Interactive UI mode | `npx playwright test --ui` |
| Type-check | `npm run typecheck` |

## Reports and failure evidence

| Output | Contents |
| --- | --- |
| `reports/summary/test-report.html` | **Summary report of the latest run**, with a **Download PDF** button. Open it with `npm run report:summary`. |
| `reports/summary/test-report.pdf` | The same summary as a PDF (A4, page numbers) |
| `reports/history/<date-time>/` | The summary HTML and PDF of every earlier run |
| `reports/html/` | Playwright HTML report. Open it with `npm run report`. |
| `reports/results.json` | Results as JSON |
| `reports/junit.xml` | JUnit XML for CI tools |
| `test-results/<test>/` | For each failed test: `test-failed-1.png` (screenshot), `video.webm`, and `trace.zip` |

### The summary report

Every run, whatever is selected (all tests, one browser, one file, the VS Code extension), ends by writing the summary report. It is made by a custom reporter, `src/reporting/HtmlPdfReporter.ts`, registered in `playwright.config.ts`. It shows:

- **Run details:** date and time, environment and site, browsers, workers, duration, and whether the run passed
- **Totals:** test runs, passed, failed, flaky, skipped, pass rate
- **One table per module:** one row per test, one column per browser, with the result and time of each
- **Failures:** the error message, the screenshot from the moment of failure (embedded, so it is in the PDF too), and links to the video and trace

The **Download PDF** button saves the PDF. The PDF is printed at the end of the run by Playwright's own Chromium (`src/reporting/print-pdf.cjs`), so no other tools are needed, and it is embedded in the button, so the download works in any browser, even from a local file. The PDF leaves out the buttons and links, and adds page numbers. Session tokens in error messages are replaced with `[hidden]`.

**The report opens in Google Chrome when the run finishes.** If Chrome is not installed, it opens in the default browser. Change this with `OPEN_REPORT` in `.env`:

| `OPEN_REPORT` | When the report opens |
| --- | --- |
| `always` (default) | After every run, including single tests run from VS Code |
| `on-failure` | Only when a test failed |
| `never` | Never. Open it yourself with `npm run report:summary`. |

It never opens on CI (when `CI` is set). Set `CHROME_PATH` if Chrome is installed somewhere unusual.

Each run also copies its summary to `reports/history/<date-time>/`. Delete old folders there when you no longer need them. The video and trace links point into `test-results/`, which the next run clears, so they only work in the latest report.

Screenshots, videos and traces are kept only for failed tests (`only-on-failure` / `retain-on-failure`), so passing runs stay small. The HTML report links to each one.

To open a trace, use the trace viewer in the HTML report, or:

```bash
npx playwright show-trace test-results/<test-folder>/trace.zip
```

The trace shows every action, a DOM snapshot before and after it, network calls and console output.

A test that failed once and passed on retry is marked **flaky** in the report.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `TEST_USERNAME is not set` | Create `.env` from `.env.example`, or set the variables in your shell. |
| `Executable doesn't exist` | Run `npx playwright install chromium firefox webkit`. |
| `Waited 240s for the "cart-..." lock` | Another run on this PC is holding it, or a run was killed. Locks from dead processes clear themselves; otherwise delete the `qualitylab-playwright-locks` folder in your temp directory. |
| Many timeouts on the first tests | The live site can be slow to wake up. Run again, or lower `--workers`. |
| `Sign-in to banking returned 401` | The credentials are wrong, or the account is not the seeded banking customer. |
| WebKit fails on an older Linux | Use `npx playwright install --with-deps webkit`. |
| Every Firefox test fails with `browserType.launch: spawn UNKNOWN` (Windows) | Windows refused to start Firefox from the default browser folder ("side-by-side configuration is incorrect" in the Application event log). Keep the browsers in the project instead: add `PLAYWRIGHT_BROWSERS_PATH=0` to `.env`, then in PowerShell run `$env:PLAYWRIGHT_BROWSERS_PATH = "0"; npx playwright install chromium firefox webkit`. This was needed on the Windows 11 26H2 PC used to build this framework. |
