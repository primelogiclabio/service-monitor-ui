<script>
  import { onMount } from 'svelte';
  import { getApi } from '../lib/auth.svelte.js';
  import { status } from '../lib/status.svelte.js';
  import { notify } from '../lib/notify.svelte.js';
  import { fmtDateTime } from '../lib/format.js';
  import { groupTokens, serverNamesFrom } from '../lib/settings.js';
  import ConfirmDialog from './ConfirmDialog.svelte';

  let tokens = $state([]);
  let loaded = $state(false);
  let error = $state('');
  let revoking = $state(null);

  const groups = $derived(groupTokens(tokens, { serverNames: serverNamesFrom(status.data) }));

  async function load() {
    try {
      tokens = await getApi().tokens();
      error = '';
    } catch (e) {
      error = e.message;
    } finally {
      loaded = true;
    }
  }
  onMount(load);

  async function revoke() {
    const t = revoking;
    try {
      await getApi().revokeToken(t.id);
      notify(t.scope === 'AGENT' ? `Revoked the agent credential of ${t.server}` : `Revoked ${t.name}`, 'success');
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      revoking = null;
      await load();
    }
  }
</script>

<section class="card stack" aria-labelledby="agents-h">
  <div>
    <h2 id="agents-h">Agent credentials</h2>
    <p class="secondary">
      Every server's agent has its own credential, made when it registered and kept in <code>agent.json</code> on that server.
      Revoke one if the server or that file may be in the wrong hands. Join keys are on the <a href="#/enroll">Add server</a> page.
    </p>
  </div>
  {#if !loaded}
    <p class="muted">Loading…</p>
  {:else if error}
    <p class="form-error" role="alert">{error}</p>
  {:else if groups.agents.length === 0}
    <p class="muted">No agents have registered yet.</p>
  {:else}
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Server</th><th class="hide-sm">Registered</th><th>Last used</th><th></th></tr></thead>
        <tbody>
          {#each groups.agents as t (t.id)}
            <tr>
              <td>{t.server}</td>
              <td class="hide-sm">{fmtDateTime(t.createdAt)}</td>
              <td>{t.usedAt ? fmtDateTime(t.usedAt) : '—'}</td>
              <td class="num">
                <button class="btn small danger" type="button" title="Stop this agent reporting. The server stays, offline, until it is enrolled again." onclick={() => (revoking = t)}>Revoke</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<section class="card stack" aria-labelledby="enroll-h">
  <div>
    <h2 id="enroll-h">One-time tokens not used yet</h2>
    <p class="secondary">Made under "Other ways" on the Add server page. Each can still register one server until it expires.</p>
  </div>
  {#if !loaded}
    <p class="muted">Loading…</p>
  {:else if !error && groups.enroll.length === 0}
    <p class="muted">None waiting.</p>
  {:else if !error}
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Label</th><th class="hide-sm">Created</th><th>Expires</th><th></th></tr></thead>
        <tbody>
          {#each groups.enroll as t (t.id)}
            <tr>
              <td>{t.name}</td>
              <td class="hide-sm">{fmtDateTime(t.createdAt)}</td>
              <td>{t.expiresAt ? fmtDateTime(t.expiresAt) : '—'}</td>
              <td class="num">
                <button class="btn small danger" type="button" title="Stop this token registering a server" onclick={() => (revoking = t)}>Revoke</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

{#if revoking}
  <ConfirmDialog
    title={revoking.scope === 'AGENT' ? 'Revoke agent credential' : 'Revoke one-time token'}
    message={revoking.scope === 'AGENT'
      ? `Revoke the credential of the agent on “${revoking.server}”? The server stays on the hub with its checks and history, but its agent can no longer report, so it shows offline until it is enrolled again (Add server, Enroll an installed agent).`
      : `Revoke “${revoking.name}”? It can no longer register a server.`}
    confirmLabel="Revoke"
    onconfirm={revoke}
    oncancel={() => (revoking = null)}
  />
{/if}
