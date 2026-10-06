<script lang="ts">
  import { app } from '../lib/store.svelte';
  import type { AccountType, Holding, HoldingRow } from '../lib/types';
  import { changeList, changeListCsv, holdingKey } from '../lib/holdings';
  import { accountTypeLabel, balanceClass, formatBalance } from '../lib/format';
  import { yearOf } from '../lib/dates';
  import { downloadText } from '../lib/download';
  import Modal from '../components/Modal.svelte';

  interface Entry {
    /** key of the row being edited, or null when adding a new TIPS */
    editingKey: string | null;
    cusip: string;
    account_type: AccountType;
    quantity: number | null;
  }

  let entry = $state<Entry | null>(null);
  let changeListOpen = $state(false);
  let confirmed = $state(false);
  let entryForm = $state<HTMLFormElement>();

  const rows = $derived(app.holdingRows);
  const changes = $derived(changeList(rows));
  const balanceByYear = $derived(
    new Map(app.ladderYears.map((r) => [r.year, app.specs.use_pretax ? r.pretax_balance : r.balance])),
  );
  const years = $derived(
    Array.from({ length: Math.max(0, app.specs.end_year - app.specs.start_year + 1) }, (_, i) => app.specs.start_year + i),
  );
  const outsideRows = $derived(
    rows.filter((r) => {
      const y = yearOf(r.maturity_date);
      return y < app.specs.start_year || y > app.specs.end_year;
    }),
  );

  function rowsInYear(y: number): HoldingRow[] {
    return rows.filter((r) => yearOf(r.maturity_date) === y);
  }

  function otherHoldings(exceptKey: string | null): Holding[] {
    return rows
      .filter((r) => holdingKey(r) !== exceptKey)
      .map((r) => ({ cusip: r.cusip, account_type: r.account_type, quantity: r.quantity }));
  }

  function startAdd() {
    if (entry && entry.editingKey === null) return;
    entry = { editingKey: null, cusip: '', account_type: 'roth', quantity: null };
  }

  function startEdit(r: HoldingRow) {
    entry = { editingKey: holdingKey(r), cusip: r.cusip, account_type: r.account_type, quantity: r.quantity };
  }

  function confirmEntry() {
    if (!entry || !entryForm) return;
    if (!entryForm.reportValidity()) return;
    app.updateHoldings([
      ...otherHoldings(entry.editingKey),
      { cusip: entry.cusip, account_type: entry.account_type, quantity: entry.quantity! },
    ]);
    entry = null;
    confirmed = false;
  }

  function deleteRow(r: HoldingRow) {
    app.updateHoldings(otherHoldings(holdingKey(r)));
    confirmed = false;
  }

  function confirmLadder() {
    entry = null;
    app.confirmLadder();
    confirmed = true;
  }

  function saveChangeList() {
    downloadText(changeListCsv(changes), 'tips_change_list.csv', 'text/csv;charset=utf-8;');
  }
</script>

{#snippet entryRow()}
  {#if entry}
    <tr class="tip-entry-row">
      <td colspan="3">
        <select form="entryForm" class="tip-id-cusipmaturitycoupon" aria-label="TIPS" required bind:value={entry.cusip}
          style="width:100%; min-width:160px; padding:0.35rem 0.5rem; font-size:0.85rem;">
          <option value="" disabled>Select a TIPS...</option>
          {#each app.tips as t (t.cusip)}
            <option value={t.cusip}>CUSIP: {t.cusip}, Coupon: {t.coupon_rate}%, Maturity: {t.maturity_date}</option>
          {/each}
        </select>
      </td>
      <td>
        <select form="entryForm" class="tip-account-type" aria-label="Account type" bind:value={entry.account_type}
          style="width:100%; padding:0.35rem 0.5rem; font-size:0.85rem;">
          <option value="roth">Roth</option>
          <option value="pretax">Pretax (e.g., 401k/IRA)</option>
          <option value="taxable">Taxable Brokerage</option>
        </select>
      </td>
      <td>
        <input form="entryForm" type="number" class="tip-quantity" aria-label="Quantity" placeholder="No. of $1k bonds"
          min="1" step="1" required bind:value={entry.quantity}
          style="width:100%; padding:0.35rem 0.5rem; font-size:0.85rem;" />
      </td>
      <td style="white-space:nowrap;">
        <button type="button" class="icon-btn icon-btn-confirm" title="Confirm" onclick={confirmEntry}>&#10003;</button>
        <button type="button" class="icon-btn icon-btn-cancel" title="Cancel" onclick={() => (entry = null)}>&#10005;</button>
      </td>
    </tr>
  {/if}
{/snippet}

{#snippet holdingRow(r: HoldingRow)}
  {#if entry && entry.editingKey === holdingKey(r)}
    {@render entryRow()}
  {:else}
    <tr class="owned-tip-row confirmed">
      <td>{r.cusip}</td>
      <td>{r.maturity_date}</td>
      <td>{r.coupon_rate}%</td>
      <td>{accountTypeLabel(r.account_type)}</td>
      <td>
        {r.quantity}
        {#if r.prev_quantity !== r.quantity}
          <em style="font-size:0.85rem; color:var(--text-secondary);">(previously {r.prev_quantity})</em>
        {/if}
      </td>
      <td style="white-space:nowrap;">
        <button type="button" class="icon-btn icon-btn-edit" title="Edit this TIPS" onclick={() => startEdit(r)}>&#9998;</button>
        {#if r.quantity !== 0}
          <button type="button" class="icon-btn icon-btn-delete" title="Delete this TIPS" onclick={() => deleteRow(r)}>&#128465;</button>
        {/if}
      </td>
    </tr>
  {/if}
{/snippet}

{#snippet actionButtons()}
  {#if changes.length > 0}
    <button type="button" class="btn btn-secondary" style="font-size: 1.125rem; padding: 1rem 2rem;"
      onclick={() => (changeListOpen = true)}>Change List</button>
  {/if}
  <button type="button" class="btn btn-primary" style="font-size: 1.125rem; padding: 1rem 2rem;" onclick={confirmLadder}>
    Confirm Ladder
  </button>
{/snippet}

<!-- entry-row inputs live in table cells; they belong to this (empty) form for validation -->
<form id="entryForm" bind:this={entryForm} onsubmit={(e) => { e.preventDefault(); confirmEntry(); }}></form>

<div class="card">
  <div class="flex justify-between items-start mb-4">
    <h1 style="margin-top: 0.25rem;">Build Your Ladder</h1>
    <div style="display: flex; gap: 1rem; align-items: center;">
      {#if confirmed}<span class="text-success" role="status">Ladder confirmed</span>{/if}
      {@render actionButtons()}
    </div>
  </div>

  <hr style="border:0; border-top:1px solid var(--border-color); margin: 2rem 0;" />

  <div class="flex justify-between items-center mb-4">
    <h3 style="margin-bottom:0;">Currently Owned TIPS</h3>
  </div>
  <div class="table-container mb-4">
    <table id="ownedTipsTable">
      <thead>
        <tr>
          <th>CUSIP</th>
          <th>Maturity</th>
          <th>Coupon</th>
          <th>Account Type</th>
          <th>Quantity ($1000 blocks)</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {#if rows.length === 0 && !entry}
          <tr>
            <td colspan="6" class="text-center text-secondary">
              No TIPS added yet. Use the <strong>+</strong> button to add a TIPS.
            </td>
          </tr>
        {/if}
        {#each years as y (y)}
          {@const balance = balanceByYear.get(y) ?? 0}
          <tr class="subtotal-row">
            <td colspan="4" style="color: var(--text-secondary);">Year {y} Surplus/Shortfall</td>
            <td class="text-right {balanceClass(balance)}" style="font-weight: 700;">{formatBalance(balance, true)}</td>
            <td></td>
          </tr>
          {#each rowsInYear(y) as r (holdingKey(r))}
            {@render holdingRow(r)}
          {/each}
        {/each}
        {#if outsideRows.length > 0}
          <tr class="subtotal-row">
            <td colspan="6" style="color: var(--text-secondary);">
              Maturing outside the ladder years ({app.specs.start_year}–{app.specs.end_year})
            </td>
          </tr>
          {#each outsideRows as r (holdingKey(r))}
            {@render holdingRow(r)}
          {/each}
        {/if}
        {#if entry && entry.editingKey === null}
          {@render entryRow()}
        {/if}
        <tr>
          <td colspan="6" style="text-align:center; padding: 0.5rem;">
            <button type="button" class="icon-btn icon-btn-add" title="Add TIPS" onclick={startAdd}>&#43;</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="mt-4" style="padding-top:1rem; display: flex; justify-content: flex-end; gap: 1rem; align-items: center;">
    {@render actionButtons()}
  </div>
</div>

<Modal bind:open={changeListOpen} contentStyle="max-width: 850px;">
  <h2>Change List</h2>
  <p class="text-secondary mb-4">
    The following changes have been made to your owned TIPS. You can save this list to a CSV file.
  </p>
  <div class="table-container mb-4">
    <table>
      <thead>
        <tr>
          <th>Action</th>
          <th>CUSIP</th>
          <th>Maturity</th>
          <th>Coupon</th>
          <th>Account Type</th>
          <th class="text-right">Quantity</th>
        </tr>
      </thead>
      <tbody>
        {#each changes as c (holdingKey(c.row))}
          {@const cls = c.action === 'Sell' ? 'text-danger' : 'text-success'}
          <tr>
            <td class={cls} style="font-weight:700;">{c.action}</td>
            <td>{c.row.cusip}</td>
            <td>{c.row.maturity_date}</td>
            <td>{c.row.coupon_rate}%</td>
            <td>{accountTypeLabel(c.row.account_type)}</td>
            <td class="text-right {cls}" style="font-weight:700;">{c.quantity > 0 ? `+${c.quantity}` : c.quantity}</td>
          </tr>
        {:else}
          <tr><td colspan="6" class="text-center text-secondary">No changes made.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
  <div class="flex justify-between items-center">
    <button type="button" class="btn btn-primary" onclick={saveChangeList}>Save to CSV</button>
    <button type="button" class="btn btn-secondary" onclick={() => (changeListOpen = false)}>Close</button>
  </div>
</Modal>
