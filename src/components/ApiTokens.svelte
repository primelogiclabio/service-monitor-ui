<script>
  import { onMount } from 'svelte';
  import { getApi } from '../lib/auth.svelte.js';
  import { notify } from '../lib/notify.svelte.js';
  import { fmtDateTime, scopeLabel } from '../lib/format.js';
  import { groupTokens } from '../lib/settings.js';
  import ConfirmDialog from './ConfirmDialog.svelte';

  let tokens = $state([]);
  let loaded = $state(false);
  let error = $state('');
  let revoking = $state(null);

  const apiTokens = $derived(groupTokens(tokens).api);

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
      notify(`Revoked ${t.name}`, 'success');
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      revoking = null;
      await load();
    }
  }
</script>

<section class="card stack" aria-labelledby="api-h">
  <div>
    <h2 id="api-h">API tokens</h2>
    <p class="secondary">
      Tokens are for programs, not people: the <code>svcmon</code> command line (the same program as the agent, used from a
      terminal) and your own scripts. People sign in with their own account instead. Make one with
      <code>svcmon token create</code>. Only a hash is stored, so a lost token cannot be shown again: revoke it and make a
      new one.
    </p>
  </div>
  {#if !loaded}
    <p class="muted">Loading…</p>
  {:else if error}
    <p class="form-error" role="alert">{error}</p>
  {:else if apiTokens.length === 0}
    <p class="muted">No API tokens.</p>
  {:else}
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr><th>Name</th><th>Access</th><th class="hide-sm">Created</th><th class="hide-sm">Expires</th><th></th></tr>
        </thead>
        <tbody>
          {#each apiTokens as t (t.id)}
            <tr>
              <td>{t.name}</td>
              <td>{scopeLabel(t.scope)}</td>
              <td class="hide-sm">{fmtDateTime(t.createdAt)}</td>
              <td class="hide-sm">{t.expiresAt ? fmtDateTime(t.expiresAt) : '—'}</td>
              <td class="num">
                <button class="btn small danger" type="button" aria-label="Revoke the token {t.name}" title="Stop this token working. Anything using it is locked out; this cannot be undone." onclick={() => (revoking = t)}>Revoke</button>
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
    title="Revoke token"
    message="Revoke “{revoking.name}”? Anything using it stops working immediately."
    confirmLabel="Revoke"
    onconfirm={revoke}
    oncancel={() => (revoking = null)}
  />
{/if}
