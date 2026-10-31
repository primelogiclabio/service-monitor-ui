<script>
  import { status, refresh } from '../lib/status.svelte.js';
  import { auth, getApi } from '../lib/auth.svelte.js';
  import { notify } from '../lib/notify.svelte.js';
  import { CHECK_TYPES, RANGES } from '../lib/format.js';
  import { filterChecks, flattenChecks } from '../lib/checks.js';
  import CheckTable from '../components/CheckTable.svelte';
  import CheckForm from '../components/CheckForm.svelte';
  import Modal from '../components/Modal.svelte';
  import WithHelp from '../components/WithHelp.svelte';

  let range = $state('6h');
  let query = $state('');
  let cluster = $state('all');
  let type = $state('all');
  let state = $state('all');
  let adding = $state(false);
  let busy = $state(false);
  let formError = $state('');

  const servers = $derived(status.data ? status.data.clusters.flatMap((c) => c.servers) : []);
  const all = $derived(flattenChecks(status.data));
  const shown = $derived(filterChecks(all, { cluster, type, state, query }));

  async function create(body) {
    busy = true;
    formError = '';
    try {
      await getApi().createCheck(body);
      adding = false;
      notify(`Added ${body.name}`, 'success');
      await refresh();
    } catch (e) {
      formError = e.message;
    } finally {
      busy = false;
    }
  }
</script>

<WithHelp topic="monitors" placed>
{#snippet children(help)}
<div class="stack-lg">
  <div class="row between">
    <h1 style="font-size: 1.75rem">Monitors</h1>
    <div class="row">
      {@render help()}
      {#if auth.admin}
        <button class="btn primary" type="button" onclick={() => { formError = ''; adding = true; }}>Add check</button>
      {/if}
    </div>
  </div>

  <section class="filters" aria-label="Filters">
    <div class="field" style="flex: 1 1 220px">
      <label for="c-q">Search</label>
      <input id="c-q" type="search" bind:value={query} placeholder="Name, target or server" />
    </div>
    <div class="field">
      <label for="c-cluster">Cluster</label>
      <select id="c-cluster" bind:value={cluster}>
        <option value="all">All clusters</option>
        {#each status.data?.clusters ?? [] as cl (cl.name)}<option value={cl.name}>{cl.name}</option>{/each}
      </select>
    </div>
    <div class="field">
      <label for="c-type">Type</label>
      <select id="c-type" bind:value={type}>
        <option value="all">All types</option>
        {#each CHECK_TYPES as t}<option value={t}>{t}</option>{/each}
      </select>
    </div>
    <div class="field">
      <label for="c-state">Show</label>
      <select id="c-state" bind:value={state}>
        <option value="all">Everything</option>
        <option value="problems">Problems only</option>
        <option value="disabled">Disabled</option>
      </select>
    </div>
    <div class="field">
      <span class="label" id="c-range">Chart range</span>
      <div class="segmented" role="group" aria-labelledby="c-range">
        {#each RANGES as r (r.key)}
          <button type="button" aria-pressed={range === r.key} onclick={() => (range = r.key)}>{r.label}</button>
        {/each}
      </div>
    </div>
  </section>

  <section class="card flush">
    {#if !status.data}
      <p class="muted" style="padding: 16px">Loading…</p>
    {:else}
      <CheckTable checks={shown} {range} showServer onchanged={refresh} />
    {/if}
  </section>
</div>
{/snippet}
</WithHelp>

{#if adding}
  <Modal title="Add a check" onclose={() => (adding = false)}>
    <CheckForm {servers} {busy} error={formError} onsubmit={create} oncancel={() => (adding = false)} />
  </Modal>
{/if}
