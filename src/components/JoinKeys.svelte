<script>
  import { onMount } from 'svelte';
  import { getApi } from '../lib/auth.svelte.js';
  import { notify } from '../lib/notify.svelte.js';
  import { fmtDateTime } from '../lib/format.js';
  import { JOIN_EXPIRY_CHOICES } from '../lib/enroll.js';
  import AgentCommands from './AgentCommands.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import Tip from './Tip.svelte';

  /** Join keys: create one, show its install command once, list the existing ones and revoke them. */
  let { hub } = $props();

  let keys = $state([]);
  let loaded = $state(false);
  let listError = $state('');
  let name = $state('');
  let cluster = $state('');
  let expiry = $state('');
  let issued = $state(null);
  let busy = $state(false);
  let error = $state('');
  let revoking = $state(null);

  async function load() {
    try {
      keys = await getApi().joinKeys();
      listError = '';
    } catch (e) {
      listError = e.message;
    } finally {
      loaded = true;
    }
  }
  onMount(load);

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return (error = 'Give the key a name.');
    busy = true;
    error = '';
    try {
      const body = { name: name.trim() };
      if (cluster.trim()) body.cluster = cluster.trim();
      if (expiry !== '') body.expiresInDays = Number(expiry);
      issued = await getApi().createJoinKey(body);
      name = '';
      cluster = '';
      await load();
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }

  async function revoke() {
    const k = revoking;
    try {
      await getApi().revokeJoinKey(k.id);
      notify(`Revoked ${k.name}. Servers it registered keep working.`, 'success');
      if (issued?.id === k.id) issued = null;
      revoking = null;
      await load();
    } catch (e) {
      revoking = null;
      notify(e.message, 'error');
    }
  }
</script>

<section class="card stack" aria-labelledby="join-h">
  <h2 id="join-h">Many servers: a join key</h2>
  <p class="secondary">
    One key and one install command for any number of servers; each registers itself when the agent starts. It works until
    you revoke it, so keep it like a password. Servers it registered keep working after it is revoked.
  </p>

  <form class="stack" onsubmit={create}>
    <div class="form-grid">
      <div class="field">
        <div class="label-row"><label for="jk-name">Name</label><Tip field="joinKey.name" /></div>
        <input id="jk-name" type="text" bind:value={name} placeholder="app servers" autocomplete="off" maxlength="100" />
      </div>
      <div class="field">
        <div class="label-row"><label for="jk-cluster">Cluster (optional)</label><Tip field="joinKey.cluster" /></div>
        <input id="jk-cluster" type="text" bind:value={cluster} placeholder="any" autocomplete="off" maxlength="100" />
      </div>
      <div class="field">
        <div class="label-row"><label for="jk-expiry">Stops working</label><Tip field="joinKey.expiry" /></div>
        <select id="jk-expiry" bind:value={expiry}>
          {#each JOIN_EXPIRY_CHOICES as c (c.label)}<option value={c.days ?? ''}>{c.label}</option>{/each}
        </select>
      </div>
    </div>
    {#if error}<p class="form-error" role="alert">{error}</p>{/if}
    <div><button class="btn primary" type="submit" disabled={busy}>Create join key</button></div>
  </form>

  {#if issued}
    {#key issued.id}
      <div class="stack" aria-live="polite">
        <AgentCommands {issued} {hub} kind="join" idPrefix="join" />
      </div>
    {/key}
  {/if}

  <div class="stack" style="gap: 8px">
    <h3 style="font-size: 1rem">Join keys</h3>
    {#if !loaded}
      <p class="muted">Loading…</p>
    {:else if listError}
      <p class="form-error" role="alert">{listError}</p>
    {:else if keys.length === 0}
      <p class="muted">None yet.</p>
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
  </div>
</section>

{#if revoking}
  <ConfirmDialog
    title="Revoke join key"
    message="Revoke “{revoking.name}”? New servers can no longer register with it. Servers it already registered keep working."
    confirmLabel="Revoke"
    onconfirm={revoke}
    oncancel={() => (revoking = null)}
  />
{/if}
