<script>
  import { onMount } from 'svelte';
  import { getApi } from '../lib/auth.svelte.js';
  import { fmtDateTime } from '../lib/format.js';
  import { CATEGORIES, isOk, mergePages, outcomeLabel, whatLabel, whereLabel, whoLabel } from '../lib/activity.js';

  const PAGE = 100;

  let category = $state('');
  let events = $state([]);
  let next = $state(null);
  let loaded = $state(false);
  let loading = $state(false);
  let error = $state('');

  async function load({ older = false } = {}) {
    loading = true;
    try {
      const page = await getApi().audit({ category: category || undefined, before: older ? next : undefined, limit: PAGE });
      events = older ? mergePages(events, page.events) : page.events ?? [];
      next = page.next ?? null;
      error = '';
    } catch (e) {
      error = e.message;
    } finally {
      loaded = true;
      loading = false;
    }
  }
  onMount(load);

  function choose(key) {
    category = key;
    events = [];
    next = null;
    loaded = false;
    load();
  }
</script>

<section class="card stack" aria-labelledby="activity-h">
  <div>
    <h2 id="activity-h">Activity</h2>
    <p class="secondary">
      Who signed in, and who changed what, newest first. The hub keeps sign-ins for 30 days and changes for a year unless
      its <code>svcmon.audit</code> settings say otherwise. It never records passwords, tokens or what was sent, and a name
      nobody has is shown as unknown, since it may be a mistyped password.
    </p>
  </div>
  <div class="segmented" role="group" aria-label="Show">
    {#each CATEGORIES as c (c.key)}
      <button type="button" aria-pressed={category === c.key} onclick={() => choose(c.key)}>{c.label}</button>
    {/each}
  </div>
  {#if !loaded}
    <p class="muted">Loading…</p>
  {:else if error}
    <p class="form-error" role="alert">{error}</p>
  {:else if events.length === 0}
    <p class="muted">Nothing recorded yet.</p>
  {:else}
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr><th>When</th><th>Who</th><th class="hide-sm">From</th><th>What</th><th>Outcome</th></tr>
        </thead>
        <tbody>
          {#each events as e (e.id)}
            {@const w = whatLabel(e)}
            <tr>
              <td style="white-space: nowrap">{fmtDateTime(e.at)}</td>
              <td>{whoLabel(e)}</td>
              <td class="hide-sm">{whereLabel(e)}</td>
              <td>
                <span title={w.call || undefined}>{w.what}</span>
                {#if w.about}<div class="small muted">{w.about}</div>{/if}
              </td>
              <td class:muted={isOk(e)} class:form-error={!isOk(e)}>{outcomeLabel(e)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if next}
      <div><button class="btn small" type="button" onclick={() => load({ older: true })} disabled={loading}>{loading ? 'Loading…' : 'Load older'}</button></div>
    {/if}
  {/if}
</section>
