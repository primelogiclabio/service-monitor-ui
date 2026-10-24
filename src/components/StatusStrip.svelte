<script>
  import { fmtClock } from '../lib/format.js';
  import StatusBadge from './StatusBadge.svelte';

  // For checks without a number (service up/down): the last results as a strip, plus a text summary and table.
  let { results = [] } = $props(); // newest first, as the hub returns them

  const recent = $derived(results.slice(0, 120).reverse());
  const upCount = $derived(recent.filter((r) => r.status === 'UP').length);
  const colors = { UP: 'var(--good)', WARN: 'var(--warning)', DOWN: 'var(--critical)', UNKNOWN: 'var(--unknown)' };
  let showTable = $state(false);
</script>

<div class="chart-card">
  <div class="chart-head">
    <span class="title">Recent results</span>
    <span class="row" style="gap: 10px">
      <span class="latest">{upCount} of {recent.length} up</span>
      <button class="btn small ghost" type="button" aria-pressed={showTable} onclick={() => (showTable = !showTable)}>
        {showTable ? 'Hide table' : 'Table'}
      </button>
    </span>
  </div>
  {#if recent.length === 0}
    <div class="chart-empty">No results yet</div>
  {:else}
    <div class="strip" role="img" aria-label="{upCount} of {recent.length} recent results were up">
      {#each recent as r (r.ts)}
        <span class="tick" style="--c: {colors[r.status] ?? colors.UNKNOWN}" title="{fmtClock(r.ts)} {r.status}"></span>
      {/each}
    </div>
  {/if}
  {#if showTable}
    <div class="chart-table table-wrap">
      <table class="data">
        <thead><tr><th>Time</th><th>Status</th><th>Message</th></tr></thead>
        <tbody>
          {#each results.slice(0, 100) as r (r.ts)}
            <tr><td>{fmtClock(r.ts)}</td><td><StatusBadge status={r.status} /></td><td>{r.message ?? ''}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
