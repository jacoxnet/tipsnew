<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { currentYear } from '../lib/dates';
  import Modal from '../components/Modal.svelte';
  import HelpIcon from '../components/HelpIcon.svelte';

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const thisYear = currentYear();
  const s = app.specs;

  // form state (numbers are bound as numbers; empty inputs become null)
  let taxRate = $state<number | null>(s.tax_rate);
  let taxEffectInflation = $state(s.tax_effect_inflation ? 'yes' : 'no');
  let assumedInflationRate = $state<number | null>(s.assumed_inflation_rate);
  let startYear = $state<number | null>(Math.max(s.start_year, thisYear));
  let endYear = $state<number | null>(s.end_year);
  let baseCashFlow = $state<number | null>(s.base_cash_flow);
  let usePretax = $state(s.use_pretax);
  let inflateBaseCf = $state(s.inflate_base_cf ? 'yes' : 'no');
  let asOfYear = $state(s.base_cash_flow_date.slice(0, 4));
  let asOfMonth = $state(s.base_cash_flow_date.slice(5, 7));
  let flows = $state<{ id: number; year: number | null; amount: number | null }[]>(
    s.additional_flows.map((f, i) => ({ id: i, ...f })),
  );
  let nextFlowId = flows.length;

  let saved = $state(false);
  let help = $state<'taxEffect' | 'asOfDate' | 'cashFlowDiff' | null>(null);

  // As-of dates are limited to months with published CPI
  const cpiMonths = $derived(new Set(app.cpi.map((c) => c.as_of_date.slice(0, 7))));
  const asOfYears = $derived(
    [...new Set(app.cpi.map((c) => c.as_of_date.slice(0, 4)))]
      .filter((y) => +y >= 1997)
      .sort()
      .reverse(),
  );
  function monthAvailable(m: number): boolean {
    return !asOfYear || cpiMonths.has(`${asOfYear}-${String(m).padStart(2, '0')}`);
  }
  $effect(() => {
    if (asOfMonth && asOfYear && !cpiMonths.has(`${asOfYear}-${asOfMonth}`)) asOfMonth = '';
  });

  function addFlow() {
    flows.push({ id: nextFlowId++, year: null, amount: null });
    saved = false;
  }

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    const taxEffect = taxEffectInflation === 'yes';
    const inflate = inflateBaseCf === 'yes';
    app.setSpecs({
      tax_rate: taxRate ?? 0,
      start_year: startYear ?? thisYear,
      end_year: endYear ?? thisYear,
      base_cash_flow: baseCashFlow ?? 0,
      inflate_base_cf: inflate,
      base_cash_flow_date: asOfYear && asOfMonth ? `${asOfYear}-${asOfMonth}-01` : s.base_cash_flow_date,
      tax_effect_inflation: taxEffect,
      assumed_inflation_rate: taxEffect ? (assumedInflationRate ?? 0) : 0.0,
      use_pretax: usePretax,
      additional_flows: flows
        .filter((f) => f.year !== null && f.amount !== null)
        .map((f) => ({ year: f.year!, amount: f.amount! })),
    });
    saved = true;
  }
</script>

<div class="card">
  <div class="flex justify-between items-start mb-4">
    <h1 style="margin-top: 0.25rem;">Ladder Parameters</h1>
    <div style="display: flex; gap: 1rem; align-items: center;">
      {#if saved}<span class="text-success" role="status">Parameters saved</span>{/if}
      <button type="submit" form="specsForm" class="btn btn-primary" style="font-size: 1.125rem; padding: 1rem 2rem">
        Confirm Parameters
      </button>
    </div>
  </div>

  <form id="specsForm" onsubmit={onSubmit} oninput={() => (saved = false)}>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
      <!-- Basic Parameters -->
      <div>
        <div class="form-group">
          <label for="taxRate">Income Tax Rate (%)</label>
          <input type="number" id="taxRate" placeholder="e.g., 24" step="0.1" required bind:value={taxRate} />
        </div>
        <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label for="taxEffectInflation">
              Tax-Effect Increases in Principal?<HelpIcon onclick={() => (help = 'taxEffect')} />
            </label>
            <select id="taxEffectInflation" bind:value={taxEffectInflation}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          {#if taxEffectInflation === 'yes'}
            <div>
              <label for="assumedInflationRate">Assumed Inflation Rate (%)</label>
              <input type="number" id="assumedInflationRate" placeholder="e.g., 2.0" step="0.1" required
                bind:value={assumedInflationRate} />
            </div>
          {/if}
        </div>
        <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label for="startYear">Start Year</label>
            <input type="number" id="startYear" placeholder="e.g., 2026" min={thisYear} required bind:value={startYear} />
          </div>
          <div>
            <label for="endYear">End Year</label>
            <input type="number" id="endYear" placeholder="e.g., 2056" min={startYear ?? thisYear} required
              bind:value={endYear} />
          </div>
        </div>
        <div class="form-group">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <label for="baseCashFlow" style="margin-bottom: 0;">Base Real After-Tax Cash Flow ($/Year)</label>
            <label style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; margin-bottom: 0; cursor: pointer; white-space: nowrap;">
              <input type="checkbox" id="usePretax" style="margin: 0; cursor: pointer;" bind:checked={usePretax} />
              Use Pre-Tax Cash Flow
            </label>
          </div>
          <input type="number" id="baseCashFlow" placeholder="e.g., 50000" required bind:value={baseCashFlow} />
        </div>
        <div class="form-group">
          <label for="inflateBaseCf">
            Inflate Base Real Cash Flow from a historical date to the present?<HelpIcon
              onclick={() => (help = 'asOfDate')} />
          </label>
          <select id="inflateBaseCf" bind:value={inflateBaseCf}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
          {#if inflateBaseCf === 'yes'}
            <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
              <select id="baseCashFlowMonth" aria-label="As-of month" required bind:value={asOfMonth}>
                <option value="" disabled>Month</option>
                {#each MONTHS as name, i}
                  {@const mm = String(i + 1).padStart(2, '0')}
                  <option value={mm} disabled={!monthAvailable(i + 1)}>{mm} - {name}</option>
                {/each}
              </select>
              <select id="baseCashFlowYear" aria-label="As-of year" required bind:value={asOfYear}>
                <option value="" disabled>Year</option>
                {#each asOfYears as y}
                  <option value={y}>{y}</option>
                {/each}
              </select>
            </div>
          {/if}
        </div>
      </div>

      <!-- Different Cash Flows -->
      <div>
        <div class="flex justify-between items-center mb-4" style="margin-top:0;">
          <h3 style="margin-bottom:0;">
            One-Time Real After-Tax Cash Flow Differences (Optional)<HelpIcon onclick={() => (help = 'cashFlowDiff')} />
          </h3>
          <button type="button" class="btn btn-secondary btn-sm" onclick={addFlow}>+ Add Year</button>
        </div>
        {#each flows as flow, i (flow.id)}
          <div class="form-group flex items-center gap-4 add-flow-row">
            <div style="flex:1;">
              <input type="number" class="flow-year" placeholder="Year (e.g., 2030)" aria-label="Year" required
                bind:value={flow.year} />
            </div>
            <div style="flex:1;">
              <input type="number" class="flow-amount" placeholder="Amount ($)" aria-label="Amount" required
                bind:value={flow.amount} />
            </div>
            <button type="button" class="btn btn-danger btn-sm" onclick={() => { flows.splice(i, 1); saved = false; }}>
              Remove
            </button>
          </div>
        {/each}
      </div>
    </div>
  </form>

  <hr style="border:0; border-top:1px solid var(--border-color); margin: 2rem 0;" />
</div>

<Modal small open={help === 'taxEffect'} onclose={() => (help = null)}>
  <p>To reduce the after-tax cash flow by the estimated taxes due on the TIPS's inflation adjustments, select "yes" and enter an assumed inflation rate.</p>
</Modal>
<Modal small open={help === 'asOfDate'} onclose={() => (help = null)}>
  <p>Select "Yes" if the base cash flow amount was determined at a past date and you want it adjusted to today's dollars. For example, if in March 2022 this was $30,000 and inflation since then has been 10%, the app will increase the cash flow to $33,000. Select "No" to use the amount as entered without any inflation adjustment.</p>
</Modal>
<Modal small open={help === 'cashFlowDiff'} onclose={() => (help = null)}>
  <p>If additional (or lesser) cash flow is desired from the ladder in any years (to, for example, buy a car or cover gap years or other periods when no TIPS mature), use this feature to specify how much cash flow you desire in those years.</p>
</Modal>
