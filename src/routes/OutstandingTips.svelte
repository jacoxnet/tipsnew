<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { fixed } from '../lib/format';
</script>

<div class="card">
  <div class="flex justify-between items-center mb-4">
    <h1>Outstanding TIPS</h1>
    <p class="text-secondary">Last Updated: {app.market?.tipsFetched}</p>
    <p class="text-secondary">Source: US Treasury Fiscal Data</p>
  </div>

  <div class="table-container" style="max-height: 600px;">
    <table id="tipsTable">
      <thead>
        <tr>
          <th>CUSIP</th>
          <th>Dated Date</th>
          <th>Maturity Date</th>
          <th>Coupon Rate (%)</th>
          <th>Ref CPI</th>
          <th>Index Ratio</th>
        </tr>
      </thead>
      <tbody>
        {#each app.tips as tip (tip.cusip)}
          <tr>
            <td>{tip.cusip}</td>
            <td>{tip.dated_date}</td>
            <td>{tip.maturity_date}</td>
            <td>{fixed(tip.coupon_rate, 3)}</td>
            <td>{fixed(tip.ref_cpi, 5)}</td>
            <td>{fixed(tip.index_ratio, 5)}</td>
          </tr>
        {:else}
          <tr><td colspan="6" class="text-center">No TIPS data available.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
