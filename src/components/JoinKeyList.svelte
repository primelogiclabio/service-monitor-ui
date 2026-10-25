<script>
  import { getApi } from '../lib/auth.svelte.js';
  import { notify } from '../lib/notify.svelte.js';
  import { fmtDateTime } from '../lib/format.js';
  import ConfirmDialog from './ConfirmDialog.svelte';

  /** The hub's join keys with Revoke. Reloads whenever `version` changes; reports the keys through `onloaded`. */
  let { version = 0, onloaded } = $props();

  let keys = $state([]);
  let loaded = $state(false);
  let error = $state('');
  let revoking = $state(null);

  async function load() {
    try {
      keys = await getApi().joinKeys();
      error = '';
      onloaded?.(keys);
    } catch (e) {
      error = e.message;
    } finally {
      loaded = true;
    }
  }

  $effect(() => {
    version; // reload when the parent says the list changed
    load();
  });

  async function revoke() {
    const k = revoking;
    try {
      await getApi().revokeJoinKey(k.id);
      notify(`Revoked ${k.name}. Servers it registered keep working.`, 'success');
      revoking = null;
      await load();
    } catch (e) {
      revoking = null;
      notify(e.message, 'error');
    }
  }
</script>

{#if !loaded}
  <p class="muted">Loading…</p>
{:else if error}
  <p class="form-error" role="alert">{error}</p>
{:else if keys.length === 0}
  <p class="muted">No join keys yet.</p>
{:else}
  <div class="table-wrap">
    <table class="data">
      <thead>
        <tr>
          <th>Name</th>
          <th title="Servers it registers are put in this cluster">Cluster</th>
          <th class="num" title="How many servers it has registered">Servers</th>
          <th class="hide-sm">Last used</th>
          <th class="hide-sm">Stops working</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each keys as k (k.id)}
          <tr>
            <td>{k.name}</td>
            <td>{k.cluster ?? 'any'}</td>
            <td class="num">{k.useCount ?? 0}</td>
            <td class="hide-sm">{k.usedAt ? fmtDateTime(k.usedAt) : '—'}</td>
            <td class="hide-sm">{k.expiresAt ? fmtDateTime(k.expiresAt) : 'when revoked'}</td>
            <td class="num">
              <button
                class="btn small danger"
                type="button"
                title="Stop this key registering servers. Servers it already registered keep working."
                onclick={() => (revoking = k)}>Revoke</button
              >
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

{#if revoking}
  <ConfirmDialog
    title="Revoke join key"
    message="Revoke “{revoking.name}”? New servers can no longer register with it. Servers it already registered keep working."
    confirmLabel="Revoke"
    onconfirm={revoke}
    oncancel={() => (revoking = null)}
  />
{/if}
