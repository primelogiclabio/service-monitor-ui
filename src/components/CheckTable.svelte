<script>
  import { ago, cleanMessage, reading } from '../lib/format.js';
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
          <th>Status</th>
          <th>Type</th>
          {#if showServer}<th>Server</th>{/if}
          <th>Check</th>
          <th class="num">Reading</th>
          <th class="hide-sm">Message</th>
          <th class="hide-sm">Changed</th>
        </tr>
      </thead>
      <tbody>
        {#each checks as c (c.id)}
          <tr>
            <td><StatusBadge status={c.enabled ? c.status : 'OFF'} /></td>
            <td>{c.type}</td>
            {#if showServer}<td>{c.serverName ?? '—'}</td>{/if}
            <td>
              <button class="expander" type="button" aria-expanded={open.has(c.id)} onclick={() => toggle(c.id)}>
                {open.has(c.id) ? '▾' : '▸'} {c.name}
              </button>
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
