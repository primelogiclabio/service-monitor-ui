<script>
  import { onMount } from 'svelte';
  import { getApi } from '../lib/auth.svelte.js';
  import { notify } from '../lib/notify.svelte.js';
  import { fmtDateTime, scopeLabel } from '../lib/format.js';
  import { API_SCOPES, TOKEN_NAME_MAX, groupTokens, tokenNameProblem } from '../lib/settings.js';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import Tip from './Tip.svelte';

  let tokens = $state([]);
  let loaded = $state(false);
  let error = $state('');
  let revoking = $state(null);

  let name = $state('');
  let scope = $state('READ');
  let making = $state(false);
  let formError = $state('');

  // The token the hub just made: kept in this component only, until Done or leaving the page. Never stored or logged.
  let issued = $state(null);

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

  async function make(e) {
    e.preventDefault();
    formError = tokenNameProblem(name.trim());
    if (formError) return;
    making = true;
    try {
      const created = await getApi().createToken({ name: name.trim(), scope });
      issued = { name: created.name, scope: created.scope, token: created.token };
      name = '';
      scope = 'READ';
      await load();
    } catch (err) {
      formError = err.message;
    } finally {
      making = false;
    }
  }

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

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied', 'success', 1800);
    } catch {
      notify('Copy failed; select the text and copy it by hand.', 'error');
    }
  }
</script>

<form class="card stack" onsubmit={make}>
  <div>
    <h2>Make a token</h2>
    <p class="secondary">
      Tokens are for programs, not people: the <code>svcmon</code> command line (the same program as the agent, used from a
      terminal) and your own scripts. People sign in with their own account instead. The hub shows a new token once; from
      a terminal, <code>svcmon token create</code> makes one too.
    </p>
  </div>
  <div class="form-grid">
    <div class="field">
      <div class="label-row"><label for="t-name">Name</label><Tip field="token.name" /></div>
      <input id="t-name" type="text" bind:value={name} autocomplete="off" spellcheck="false" maxlength={TOKEN_NAME_MAX} placeholder="ops laptop" />
    </div>
    <div class="field">
      <div class="label-row"><label for="t-scope">Access</label><Tip field="token.scope" /></div>
      <select id="t-scope" bind:value={scope}>
        {#each API_SCOPES as s (s.value)}<option value={s.value}>{s.label}</option>{/each}
      </select>
    </div>
  </div>
  {#if formError}<p class="form-error" role="alert">{formError}</p>{/if}
  <div><button class="btn primary" type="submit" disabled={making || !name.trim()}>Make token</button></div>
</form>

{#if issued}
  <div class="card stack" aria-live="polite">
    <div class="banner warn">
      {scopeLabel(issued.scope)} token “{issued.name}”. It is shown only now: copy it to where it will be used. Only a hash
      is kept, so a lost token cannot be shown again. It works only from the hub's internal network.
    </div>
    <div class="copybox">
      <pre>{issued.token}</pre>
      <button class="btn" type="button" onclick={() => copy(issued.token)}>Copy</button>
    </div>
    <p class="small secondary">
      For the command line, run <code>svcmon login --hub &lt;hub address&gt; --token &lt;token&gt;</code> on the computer that will use it.
      A script sends it as <code>Authorization: Bearer &lt;token&gt;</code>.
    </p>
    <div><button class="btn small" type="button" onclick={() => (issued = null)}>Done</button></div>
  </div>
{/if}

<section class="card stack" aria-labelledby="api-h">
  <div>
    <h2 id="api-h">API tokens</h2>
    <p class="secondary">Only a hash is stored, so a lost token cannot be shown again: revoke it and make a new one.</p>
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
