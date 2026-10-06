# Plan: Convert TIPS Ladder app from Django to a static TypeScript + Vite + Svelte SPA

## Context

The app is a small Django project (`core/`, `tipsladder/`, `templates/`, `static/js/*.js`). Django does five things:
1. Fetches TIPS data (Treasury Fiscal Data API) and CPI data (FRED, which needs a secret key) into SQLite, and computes index ratios.
2. Keeps each user's parameters ("specs") and owned TIPS in SQLite, keyed to a session user.
3. Runs the ladder math (`core/ladder_calc.py`), CSV import parsing (`core/dbstuff.py:parse_csv`) and the "snapshot / prev_quantity" diff logic (`core/views.py:make_ladder_view`, `update_owned_tips_view`).
4. Renders 5 pages with Jinja-style templates and hands the data to vanilla JS through `json_script`.
5. Stores feedback.

All of this is single-user, client-side-friendly logic. The goal is a statically served SPA, hosted on GitHub Pages, with no server at runtime.

**Decisions made:**
- **Data:** a scheduled GitHub Action fetches TIPS + CPI daily using the `FRED_API_KEY` repo secret and writes JSON snapshots into the build. The browser computes today's index ratios.
- **Feedback:** removed.
- **Hosting:** GitHub Pages, deployed by an Actions workflow.
- **Persistence:** `sessionStorage`, which matches today's "session ends when the browser closes" behavior.

## Target layout

```
index.html
vite.config.ts          # base: './'  (works under /tipsnew/ on Pages)
tsconfig.json, svelte.config.js, package.json
public/
  favicon.png
  data/tips.json        # seed snapshot committed for local dev; overwritten in CI
  data/cpi.json
scripts/fetch-data.ts   # Node script (run via tsx) → public/data/*.json
src/
  main.ts, App.svelte   # layout: navbar, footer, How-To modal, hash router
  app.css               # copied from static/css/style.css
  lib/
    types.ts            # Tips, Cpi, Specs, CashFlow, OwnedTip, LadderYear, AccountType
    data.ts             # load /data/*.json, computeDailyCpi(), addIndexRatios()
    ladder.ts           # calculateLadder()  (port of core/ladder_calc.py)
    csv.ts              # parseCsv()          (port of core/dbstuff.py:parse_csv)
    holdings.ts         # mergeDuplicates(), diffWithSnapshot(), applyEdit()
    store.ts            # Svelte stores persisted to sessionStorage
    format.ts           # currency / fixed-decimal formatters (replaces floatformat|intcomma)
    download.ts         # Blob / showSaveFilePicker helpers (from save_load.js, make_ladder.js)
  routes/
    MakeLadder.svelte   # default route (old /make_ladder/)
    Specs.svelte
    LadderDisplay.svelte
    OutstandingTips.svelte  (old home.html)
    SaveLoad.svelte
  components/
    Modal.svelte, HelpIcon.svelte, OwnedTipRow.svelte, TipEntryRow.svelte, ChangeListModal.svelte
  assets/how-to.md      # imported with ?raw, rendered with `marked`
  assets/sample_ladder.csv  # imported with ?raw (from "csv files/sample_ladder.csv")
tests/ (vitest)  ladder.test.ts, csv.test.ts, data.test.ts, holdings.test.ts
.github/workflows/deploy.yml
```

Stack: Svelte 5 (runes) + Vite + TypeScript, `marked`, Vitest, `svelte-check`, `tsx` for the fetch script. Routing uses a tiny hand-rolled hash router (`#/specs`, `#/ladder`, …) in `App.svelte`. Five static routes don't justify a dependency, and hash routing avoids GitHub Pages 404s on deep links.

## Step-by-step

### 1. Scaffold
- Run `npm create vite@latest` (svelte-ts template) into the repo root. Add `marked`, `vitest`, `svelte-check`, `tsx`, `@types/node`.
- Scripts: `dev`, `build`, `preview`, `check` (svelte-check + tsc), `test` (vitest run), `fetch-data` (tsx scripts/fetch-data.ts).
- Update `.gitignore` for `node_modules/` and `dist/`.

### 2. Data snapshot script — `scripts/fetch-data.ts`
Port `core/fetch.py`:
- **TIPS:** GET `TIPSURL` with paging (`page[size]=100`, follow `links.next` / `meta.total-pages`), sorted by `-maturity_date`. Keep `cusip, dated_date, maturity_date, interest_rate→coupon_rate, ref_cpi_on_dated_date→ref_cpi`. Dedupe by CUSIP; the current DB uses `cusip` as unique, so this keeps the first one seen. Sort by maturity.
- **CPI:** FRED `CPIAUCNS` observations, all of them since 1997. Port the `HARD_CODED_CPI_2025_10 = 324.461` override for `2025-10-01`, and skip `"."` values.
- Write `public/data/tips.json` and `public/data/cpi.json`, each `{ fetched: ISO date, data: [...] }`.
- Fail loudly (non-zero exit) if either fetch returns nothing, so a deploy never ships empty data.

### 3. Domain logic (pure TS, unit-tested)
- **`data.ts`:**
  - `computeDailyCpi(cpi, today)` ports `calculate_dailyCPI`: CPI from 3 months ago and 2 months ago (first of month), interpolated by `(day-1)/daysInMonth`, using America/New_York "today".
  - If a needed month is missing, fall back to the latest two available months and expose a warning. The Python raises here.
  - `withIndexRatios(tips, dailyCpi)` computes `round(dailyCpi/ref_cpi, 5)`.
  - `latestCpi()` and `cpiAt(dateYYYY-MM-01)` serve the base-cash-flow inflation factor.
- **`ladder.ts`:** a line-for-line port of `calculate_ladder`, as a pure function `(specs, ownedTips, tipsByCusip, cpi) → LadderYear[]`. It keeps every field: target, coupon_income, principal_income, tax_drag, principal_adjustment, pretax_cash_flow, pretax_balance, pretax_shortfall, net_flow, shortfall, balance. It also gets a `totals()` helper (the logic now in `ladder_display_view`).
- **`csv.ts`:** port `parse_csv` with all 4 input formats:
  - Kevin M's cusip/qty file
  - the tipsladder.com portfolio file
  - the app's sample file
  - the old PARAM/ADD_FLOW/OWNED_TIP format
  
  It returns `{ endYear, specs: Partial<Specs>, holdings }`. A small CSV tokenizer handles quoted fields, e.g. `"1.750000%,2028-01-15"` and the quoted tipsladder build file.
  - **Behavior to preserve:** header skip on `cusip`/`type`, lower-casing, default account `pretax`, `endYear = max(currentYear, maturity years)`.
  - **Bug to fix in the port:** a row with a non-numeric quantity currently throws. Skip it instead.
- **`holdings.ts`:**
  - `mergeDuplicates()` (sum by cusip+account).
  - `buildDisplayRows(snapshot, current, tips)` replaces the duplicated prev_quantity/curr_quantity loop in `make_ladder_view` / `update_owned_tips_view`.
  - `applyUpdate(snapshot, current, incoming)` reproduces the delete semantics: a key that is in the snapshot but missing from `incoming` becomes qty 0; a key not in the snapshot is dropped.

### 4. State — `store.ts`
Writable stores, each serialized to `sessionStorage` (wrapped in try/catch):
- `specs` (defaults from `core/models.py`: tax 15, start = current year, end 2030, base CF 10000, date `2024-01-01`, flags false)
- `holdings` — the working set of `{cusip, account_type, quantity}`
- `snapshot` — `Record<"cusip_account", qty>`, the replacement for `request.session['otips_snapshot']`

Derived stores: `tipsWithRatios` (loaded once from `/data/*.json`) and `ladderYears = calculateLadder(...)`. Because the ladder is derived, the old `/update_owned_tips/` round-trip disappears.

Action mapping (view → store action):
- `init_view` / `clear_data_view` → `resetAll()`, which restores default specs, empties holdings, and clears the snapshot.
- `specs_view` POST → `specs.set(...)`, then a "Parameters saved" notice.
- `make_ladder_view` POST ("Confirm Ladder") → drop qty-0 rows and set `snapshot = holdings`.
- `import_data_view` → validate the JSON, then set specs + holdings and clear the snapshot.
- `import_csv_view` / `sample_csv_view` → `parseCsv`. If specs come back, set them; otherwise set `start_year = this year` and `end_year = endYear`. Then replace holdings and clear the snapshot.

### 5. UI (Svelte components, reusing existing CSS classes)
Copy `static/css/style.css` to `src/app.css` unchanged. Keep the class names (`card`, `btn`, `table-container`, `modal`, `help-icon`, `text-success/danger`, …) so the look doesn't change.
- **`App.svelte`:** navbar (same links, plus the Portal link) and footer without the feedback link. The How-To modal renders `how-to.md` through `marked`.
- **`Specs.svelte`:** ports `templates/specs.html` + `specs.js`.
  - Bind form fields to a local copy of the specs. Show/hide assumed inflation and the as-of month/year selects. The year dropdown runs from 1997 to now.
  - Keep add/remove for additional flows.
  - Clamp `start_year` to the current year on load.
  - **Fix:** limit the as-of year/month choices to months that have CPI data. Today a missing month crashes `ladder_calc` (`.first().cpi_value` on None).
- **`MakeLadder.svelte`:** ports `make_ladder.html` + `make_ladder.js`.
  - Year-grouped rows with surplus/shortfall subtotal rows. The pretax/after-tax balance follows `use_pretax`.
  - Display rows show "(previously N)", and edit/delete/add go through entry rows with a TIPS dropdown.
  - "Change List" modal with "Save to CSV".
  - "Confirm Ladder" button(s). Edits update the stores immediately.
- **`LadderDisplay.svelte`:** ports `ladder_display.html`, including:
  - conditional phantom-income and pretax columns
  - the totals footer with a dynamic colspan
  - the "No owned tips found" error state
  - help modals
- **`OutstandingTips.svelte`:** the table from `home.html`, with "Last Updated" set to the snapshot `fetched` date.
- **`SaveLoad.svelte`:** ports `save_load.js`. JSON save keeps the same `{specsData, otipsData}` shape and the `after_tax_TIPS_data.json` file name, using showSaveFilePicker with a Blob fallback. It also has JSON load, CSV load, the sample ladder, and clear (behind a confirm).
  - **Fix:** check file extensions as well as MIME type. On Windows, `.csv` files often report `application/vnd.ms-excel`, so they are silently rejected today.
  - **Fix:** the undefined `data` reference in the catch blocks.

### 6. Deploy — `.github/workflows/deploy.yml`
- Triggers: `push` to `main`, `schedule: cron '17 11 * * *'` (daily, after the usual CPI release time), and `workflow_dispatch`.
- Job: checkout → setup-node (cache npm) → `npm ci` → `npm run fetch-data` (env `FRED_API_KEY: ${{ secrets.FRED_API_KEY }}`) → `npm run check` → `npm test` → `npm run build` → `actions/upload-pages-artifact` (dist) → `actions/deploy-pages`.
- **Manual setup (you):** add the `FRED_API_KEY` repo secret, and set Pages → Source = "GitHub Actions".

### 7. Remove Django and update docs
- **Delete:** `core/`, `tipsladder/`, `templates/`, `static/` (after moving assets), `manage.py`, `main.py`, `requirements.txt`, `pyproject.toml`, `uv.lock`, `.python-version`, `cookies.txt`, `test_calc.py`, `test_fetch.py`, `changes to settings.py.txt`.
- **Keep:** `csv files/` as test fixtures, and `prompts/`.
- **Rewrite** the README Setup / Running / Files sections for npm. The Data Formats section stays as is, since the JSON and CSV formats don't change.
- **Edit** `how-to.md` to remove server or feedback references, and to note that data is cleared when the browser closes.

## Verification
1. `npm run fetch-data` (with a local `.env` FRED key) produces non-empty `public/data/*.json`. Without a key, the committed seed snapshot is used.
2. `npm test` (Vitest):
   - `calculateLadder` cases cover:
     - roth, pretax and taxable accounts
     - maturity-year principal and pretax principal tax
     - phantom income
     - additional flows
     - inflate_base_cf on and off
     - use_pretax balances
   - Expected numbers come from running the current Python `calculate_ladder` once on the same inputs, recorded before Django is deleted.
   - `parseCsv` runs against every file in `csv files/`.
   - `computeDailyCpi` is tested with a fixed date.
   - `applyUpdate` covers the snapshot delete semantics.
3. `npm run check` passes (svelte-check + tsc).
4. `npm run dev` with Playwright (Chromium is preinstalled) walks this flow:
   - load the sample ladder
   - Build page subtotals render
   - edit a qty and see "(previously 3)" and the Change List
   - Confirm
   - change Parameters (taxable + phantom income, pretax toggle)
   - check the Display Results columns and totals
   - save JSON → Clear → load JSON gives the same state
   - reload the page and the state persists (sessionStorage)
   - How-To modal renders
5. `npm run build && npm run preview` with `base: './'`, then load under a subpath to confirm assets and `data/*.json` resolve the way they will on GitHub Pages.
