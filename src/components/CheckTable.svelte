<script>
  import { ago, cleanMessage, reading } from '../lib/format.js';
  import { declaredState, isDown } from '../lib/checks.js';
  import StatusBadge from './StatusBadge.svelte';
  import CheckDetail from './CheckDetail.svelte';

  // `checks` are the hub's check views; with showServer each row also needs a serverName.
  let { checks = [], range = '6h', showServer = false, onchanged } = $props();

  let open = $state(new Set());

  function toggle(id) {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    open = next;
  }

  const cols = $derived(showServer ? 7 : 6);
</script>

{#if checks.length === 0}
  <p class="muted" style="padding: 16px">No checks to show.</p>
{:else}
  <div class="table-wrap">
    <table class="data">
      <thead>
        <tr>
          <th title="Up, Warning, Down, Unknown (no result yet) or Off (the check is disabled)">Status</th>
          <th title="What the check tests">Type</th>
          {#if showServer}<th title="The server the check belongs to; empty for checks the hub runs on its own">Server</th>{/if}
          <th title="Click a check to see its history, run it, edit it or delete it">Check</th>
          <th class="num" title="The latest measurement: response time, or percent used for CPU, memory and disk">Reading</th>
          <th class="hide-sm" title="What the latest result said">Message</th>
          <th class="hide-sm" title="How long ago the status last changed">Changed</th>
        </tr>
      </thead>
      <tbody>
        {#each checks as c (c.id)}
          {@const ds = declaredState(c)}
          <tr class:down={isDown(c)}>
            <td><StatusBadge status={c.enabled ? c.status : 'OFF'} /></td>
            <td>{c.type}</td>
            {#if showServer}<td>{c.serverName ?? '—'}</td>{/if}
            <td>
              <button class="expander" type="button" aria-expanded={open.has(c.id)} onclick={() => toggle(c.id)}>
                {open.has(c.id) ? '▾' : '▸'} {c.name}
              </button>
              {#if ds.declared}<span class="source-tag" title={ds.note}>{ds.tag}</span>{/if}
              {#if c.target}<span class="target">{c.target}</span>{/if}
            </td>
            <td class="num">{reading(c)}</td>
            <td class="hide-sm">{cleanMessage(c)}</td>
            <td class="hide-sm muted">{c.lastChange ? ago(c.lastChange) : '—'}</td>
          </tr>
          {#if open.has(c.id)}
            <tr class="detail">
              <td colspan={cols + 1}>
                <CheckDetail check={c} {range} {onchanged} />
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
{/if}
