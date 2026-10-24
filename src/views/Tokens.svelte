<script>
  import { onMount } from 'svelte';
  import { auth, getApi } from '../lib/auth.svelte.js';
  import { notify } from '../lib/notify.svelte.js';
  import { fmtDateTime } from '../lib/format.js';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';

  let tokens = $state([]);
  let loaded = $state(false);
  let error = $state('');
  let name = $state('');
  let scope = $state('READ');
  let issued = $state(null);
  let busy = $state(false);
  let revoking = $state(null);

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
  onMount(() => {
    if (auth.admin) load();
  });

  async function create(e) {
    e.preventDefault();
    busy = true;
    error = '';
    try {
      issued = await getApi().createToken({ name: name.trim(), scope });
      name = '';
      await load();
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }

  async function revoke() {
    const t = revoking;
    try {
      await getApi().revokeToken(t.id);
      notify(`Revoked ${t.name}`, 'success');
      revoking = null;
      await load();
    } catch (e) {
      revoking = null;
      notify(e.message, 'error');
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

<div class="stack-lg">
  <div>
    <h1 style="font-size: 1.75rem">API tokens</h1>
    <p class="secondary" style="margin-top: 4px">Tokens let the CLI, scripts and this dashboard talk to the hub. Only a hash is stored, so a lost token cannot be shown again; revoke it and make a new one.</p>
  </div>

  {#if !auth.admin}
    <div class="banner warn">Managing tokens needs an ADMIN token.</div>
  {:else}
    <form class="card stack" onsubmit={create}>
      <h2>Create a token</h2>
      <div class="form-grid">
        <div class="field">
          <label for="t-name">What it is for</label>
          <input id="t-name" type="text" bind:value={name} placeholder="ops laptop" autocomplete="off" />
        </div>
        <div class="field">
          <label for="t-scope">Access</label>
          <select id="t-scope" bind:value={scope}>
            <option value="READ">Read only</option>
            <option value="ADMIN">Admin (can change everything)</option>
          </select>
        </div>
      </div>
      {#if error}<p class="form-error" role="alert">{error}</p>{/if}
      <div><button class="btn primary" type="submit" disabled={busy || !name.trim()}>Create token</button></div>
    </form>

    {#if issued}
      <div class="card stack" aria-live="polite">
        <div class="banner warn">Copy this token now. It is not shown again.</div>
        <div class="copybox">
          <pre>{issued.token}</pre>
          <button class="btn" type="button" onclick={() => copy(issued.token)}>Copy</button>
        </div>
      </div>
    {/if}

    <section class="card flush" aria-labelledby="tk-h">
      <div class="section-head" style="padding: 14px 16px 0"><h2 id="tk-h">Existing tokens</h2></div>
      {#if !loaded}
        <p class="muted" style="padding: 16px">Loading…</p>
      {:else}
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Name</th><th>Access</th><th class="hide-sm">Created</th><th class="hide-sm">Expires</th><th>Used</th><th></th></tr></thead>
            <tbody>
              {#each tokens as t (t.id)}
                <tr>
                  <td>{t.name}</td>
                  <td>{t.scope === 'ENROLL' ? 'Enrollment (one use)' : t.scope === 'AGENT' ? 'Agent' : t.scope === 'ADMIN' ? 'Admin' : 'Read only'}</td>
                  <td class="hide-sm">{fmtDateTime(t.createdAt)}</td>
                  <td class="hide-sm">{t.expiresAt ? fmtDateTime(t.expiresAt) : '—'}</td>
                  <td>{t.usedAt ? fmtDateTime(t.usedAt) : '—'}</td>
                  <td class="num"><button class="btn small danger" type="button" onclick={() => (revoking = t)}>Revoke</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  {/if}
</div>

{#if revoking}
  <ConfirmDialog
    title="Revoke token"
    message="Revoke “{revoking.name}”? Anything using it stops working immediately."
    confirmLabel="Revoke"
    onconfirm={revoke}
    oncancel={() => (revoking = null)}
  />
{/if}
