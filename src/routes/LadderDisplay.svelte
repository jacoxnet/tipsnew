<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { ladderTotals } from '../lib/ladder';
  import { formatBalance, formatMoney } from '../lib/format';
  import Modal from '../components/Modal.svelte';
  import HelpIcon from '../components/HelpIcon.svelte';

  const hasHoldings = $derived(app.holdings.some((h) => h.quantity > 0 && app.tipsByCusip.has(h.cusip)));
  const years = $derived(app.ladderYears);
  const totals = $derived(ladderTotals(years));
  const usePretax = $derived(app.specs.use_pretax);
  const taxEffect = $derived(app.specs.tax_effect_inflation);

  let help = $state<'phantom' | 'taxDrag' | null>(null);

  const color = (v: number) => (v > 0 ? 'var(--success)' : v < 0 ? 'var(--danger)' : 'inherit');
</script>

<div class="card">
  <div class="flex justify-between items-center mb-4">
    <h1>TIPS Ladder Projection</h1>
  </div>

  {#if !hasHoldings}
    <div class="notice notice-error"><strong>Error:</strong> No owned tips found.</div>
  {:else if years.length > 0}
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th class="text-right">
              {usePretax ? 'Target Pre-Tax Cash Flow' : "Target After-Tax Cash Flow in Today's Dollars"}
            </th>
            <th class="text-right">Pre-Tax Cash Flow</th>
            {#if taxEffect}
              <th class="text-right">
                Phantom Income on Principal Increase<HelpIcon onclick={() => (help = 'phantom')} />
              </th>
            {/if}
            <th class="text-right text-danger">Calculated Tax Drag<HelpIcon onclick={() => (help = 'taxDrag')} /></th>
            <th class="text-right" style="border-left: 2px solid var(--border-color);">
              Net Real After-Tax Cash Flow from Portfolio
            </th>
            {#if usePretax}
              <th class="text-right">
                Pre-Tax <span class="text-danger">Shortfall</span> or <span class="text-success">Surplus</span>
              </th>
            {/if}
            <th class="text-right">
              After-Tax <span class="text-danger">Shortfall</span> or <span class="text-success">Surplus</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {#each years as row (row.year)}
            <tr>
              <td><strong>{row.year}</strong></td>
              <td class="text-right">${formatMoney(row.target)}</td>
              <td class="text-right text-success">+${formatMoney(row.pretax_cash_flow)}</td>
              {#if taxEffect}
                <td class="text-right text-success">+${formatMoney(row.principal_adjustment)}</td>
              {/if}
              <td class="text-right text-danger">-${formatMoney(row.tax_drag)}</td>
              <td class="text-right" style="border-left: 2px solid var(--border-color); font-weight:500;">
                ${formatMoney(row.net_flow)}
              </td>
              {#if usePretax}
                <td class="text-right" style="font-weight:700; color: {color(row.pretax_balance)}; white-space: nowrap;">
                  {formatBalance(row.pretax_balance)}
                </td>
              {/if}
              <td class="text-right" style="font-weight:700; color: {color(row.balance)}; white-space: nowrap;">
                {formatBalance(row.balance)}
              </td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr style="border-top: 2px solid var(--border-color);">
            <td colspan={taxEffect ? 6 : 5} class="text-right"><strong>TOTAL</strong></td>
            {#if usePretax}
              <td class="text-right" style="font-weight:700; color: {color(totals.total_pretax_balance)}; white-space: nowrap;">
                {formatBalance(totals.total_pretax_balance)}
              </td>
            {/if}
            <td class="text-right" style="font-weight:700; color: {color(totals.total_balance)}; white-space: nowrap;">
              {formatBalance(totals.total_balance)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  {:else}
    <p class="text-center text-secondary">No projection data to display.</p>
  {/if}
</div>

<Modal small open={help === 'phantom'} onclose={() => (help = null)}>
  <p>This represents the estimated amount of taxable income created each year as a result of the TIPS's inflation adjustment. For TIPS held in a taxable account (but not in a pre-tax or Roth account), taxes are due annually on these adjustments even through the adjusted amount is not received until maturity.</p>
</Modal>
<Modal small open={help === 'taxDrag'} onclose={() => (help = null)}>
  <p>This represents the estimated amount of taxes owed each year. The taxes owed will not be available for other spending.</p>
</Modal>
