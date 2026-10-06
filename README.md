# AFTER-TAX TIPS LADDER CALCULATOR

## Description: 

A web app for planning a Treasury Inflation-Protected Securities (TIPS) ladder. Given the TIPS you already own, it calculates the after-tax, inflation-adjusted cash flow each year and shows where your holdings fall short of or exceed your target spending.

## Features

- Uses daily-refreshed TIPS data (CUSIP, maturity, coupon rate, reference CPI) from the US Treasury Fiscal Data API, computing current index ratios.
- Uses daily-refreshed CPI-U data from the St. Louis Fed's FRED database.
- Adjusts your base cash flow target for inflation(from a historical as-of date to the present).
- Supports both after-tax and pre-tax cash flow targets.
- Accounts for account type (Roth, pretax/traditional IRA/401k, taxable brokerage) when calculating tax drag on coupons and principal.
- Tax-effects increases in principal (phantom income) for taxable brokerage accounts using an assumed inflation rate.
- Supports per-year cash flow overrides for years with different spending needs.
- Saves and loads parameters and holdings via a local JSON configuration file.
- Imports external CSV files (e.g. from tipsladder.com).

## Architecture

The app is a static single-page app (TypeScript + Svelte 5, built with Vite) with no server at runtime. Everything, including the ladder calculations, runs in the browser, and your parameters and holdings are kept in the browser's `sessionStorage` (cleared when the tab or browser is closed).

TIPS and CPI data come from JSON snapshots (`data/tips.json`, `data/cpi.json`) published with the site. A scheduled GitHub Actions workflow refreshes them daily from the Treasury Fiscal Data API and FRED, then rebuilds and redeploys the site to GitHub Pages. The browser computes today's index ratios from the snapshot.

## Setup

**Prerequisites:** Node.js 22+

```bash
npm install
```

Create a `.env` file in the project root with:

```
FRED_API_KEY=your-fred-api-key-here
```

A FRED API key is free and available at [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html). It is used (only at build time, never in the browser) to fetch CPI-U data.

Then download the TIPS and CPI data snapshots into `public/data/`:

```bash
npm run fetch-data
```

## Running

```bash
npm run dev       # development server at http://localhost:5173
npm test          # unit tests (Vitest)
npm run check     # type checks (svelte-check + tsc)
npm run build     # production build into dist/
npm run preview   # serve the production build
```

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` type-checks, tests, fetches fresh data, builds and deploys on every push to `main`, daily on a schedule, and on manual dispatch. One-time repository setup:

1. Add a repository secret named `FRED_API_KEY` (Settings → Secrets and variables → Actions).
2. Set Settings → Pages → Source to **GitHub Actions**.

## Usage

The application is structured into the following pages:

1. **Build Your Ladder** (`#/make_ladder`) — The main interface where you list the TIPS you currently own. Add owned TIPS, select the account type they are held in (taxable, pretax, or roth), and input the quantity (in $1,000 nominal principal increments).
2. **Ladder Parameters** (`#/specs`) — Set your parameters:
   - **Income Tax Rate (%)**: Your marginal tax rate.
   - **Start & End Years**: The horizon of your TIPS ladder.
   - **Base Cash Flow Target**: Your desired annual cash flow. You can choose to specify this target as either **Pre-Tax** or **After-Tax**.
   - **Historical CPI Adjustment**: Optionally adjust your base cash flow target for inflation from a historical date (e.g., matching a past date when your target was set) to the present. The app automatically fetches live CPI-U index data from FRED to perform the calculation.
   - **Phantom Income Tax Adjustment**: Choose whether to tax-effect principal increases for TIPS in taxable accounts using an assumed inflation rate.
   - **One-Time Cash Flow Differences**: Specify one-time annual overrides for years that require higher or lower cash flow targets.
3. **Display Results** (`#/ladder_display`) — View a year-by-year projection of coupons, maturing principal, phantom income adjustments, calculated tax drag, net real after-tax cash flow, and the resulting surplus or shortfall.
4. **Outstanding TIPS** (`#/tips`) — View all outstanding U.S. TIPS fetched from the U.S. Treasury database, along with coupon rates, maturity dates, and live index ratios.
5. **Save/Load Data** (`#/save_load`) — Manage your data. You can save your specs and holdings as a JSON file, load a previously saved configuration, clear all data to start fresh, or upload/import external CSVs.

## Data Formats

### Configuration Save File (JSON)

When you save your data, the app downloads a JSON file containing all parameter specs and owned TIPS. An example layout of this saved data looks like:
```json
{
  "specsData": {
    "tax_rate": 24.0,
    "start_year": 2026,
    "end_year": 2056,
    "base_cash_flow": 50000.0,
    "inflate_base_cf": false,
    "base_cash_flow_date": "2024-01-01",
    "tax_effect_inflation": false,
    "assumed_inflation_rate": 0.0,
    "use_pretax": false,
    "additional_flows": []
  },
  "otipsData": [
    {
      "account_type": "taxable",
      "quantity": 3,
      "cusip": "912828V49",
      "maturity_date": "2030-01-15",
      "coupon_rate": 0.125
    }
  ]
}
```

### Import CSV Format

You can import holdings from external CSV files (such as those exported from other calculators like tipsladder.com). The CSV must use the following column structure:

`CUSIP,Quantity,Account_Type`

For example:
```csv
912828V49,3,taxable
9128282L3,5,pretax
9128283R9,2,roth
```

*Notes on CSV Import:*

- Supported account types are `taxable`, `pretax`, and `roth`.
- If the `Account_Type` column is omitted, the app accepts a simple two-column `CUSIP,Quantity` format and defaults the account type to `pretax`.
- A header row starting with `cusip` is automatically ignored.

### LLM Assistance

This app was developed with the assistance of the free tier of Google's Gemini LLM. The initial structure of the app was created by the LLM from a prompt. That initial structure, however, was simplified and bare-bones in comparison to the current version and did not include key structural changes made later, such as the use of the Django ORM database functionality. The coding in this final version of the app is in essence all human coding, with the LLM used to amplify code generation and to track down issues and problems.

The app was originally written in Django/Python and later converted to a static TypeScript/Svelte app with the assistance of Claude Code.

### Files

#### Application (`src/`)

  1. **lib/ladder.ts** Calculates the ladder years (cash flow, tax drag, surplus/shortfall) from the parameters and owned TIPS.
  2. **lib/csv.ts** Parses imported CSV files (Kevin M's cusip/qty files, tipsladder.com portfolio files, the sample ladder, and old save files of this app).
  3. **lib/holdings.ts** Merges duplicate holdings and tracks changes since the last confirmed ladder (the change list).
  4. **lib/data.ts** Loads the TIPS/CPI snapshots and computes today's reference CPI and index ratios.
  5. **lib/store.svelte.ts** Application state (parameters, holdings, change-list snapshot) persisted to `sessionStorage`, plus import/export actions.
  6. **lib/specs.ts**, **lib/types.ts**, **lib/format.ts**, **lib/dates.ts**, **lib/download.ts** Defaults, types and helpers.
  7. **App.svelte** Layout, navigation (hash routing) and the How-To modal.
  8. **routes/** One component per page: **Specs**, **MakeLadder**, **LadderDisplay**, **OutstandingTips**, **SaveLoad**.
  9. **components/** Shared **Modal** and **HelpIcon** components.
  10. **app.css** Styles. **assets/how-to.md** Help text shown in-app. **assets/sample_ladder.csv** The sample ladder.

#### Other

  11. **scripts/fetch-data.ts** Fetches TIPS (Treasury) and CPI (FRED) data into `public/data/`.
  12. **tests/** Unit tests. `tests/fixtures/python-reference.json` holds synthetic test data with expected results recorded from the original Python implementation.
  13. **csv files/** Example CSV files for import.
  14. **public/favicon.png** App icon.
