<script>
  import { auth, login } from '../lib/auth.svelte.js';
  import { theme, cycleTheme } from '../lib/theme.svelte.js';
  import Tip from '../components/Tip.svelte';

  let token = $state('');
  let hubUrl = $state('');
  let remember = $state(false);
  let busy = $state(false);
  let error = $state('');

  async function submit(e) {
    e.preventDefault();
    error = '';
    if (!token.trim()) {
      error = 'Paste an API token.';
      return;
    }
    busy = true;
    try {
      await login({ hubUrl, token, remember });
    } catch (err) {
      error = err.status === 401 ? 'The hub did not accept that token.' : err.message;
    } finally {
      busy = false;
    }
  }
</script>

<div class="login">
  <div class="card stack">
    <div>
      <h1>Service Monitor</h1>
      <p class="secondary">Sign in with an API token from your hub.</p>
    </div>

    {#if auth.error}<div class="banner warn" role="status">{auth.error}</div>{/if}

    <form class="stack" onsubmit={submit} novalidate>
      <div class="field">
        <div class="label-row"><label for="token">API token</label><Tip field="login.token" /></div>
        <input id="token" type="password" bind:value={token} autocomplete="off" spellcheck="false" placeholder="svm_a_…" />
        <span class="hint">An ADMIN token can change things; a READ token only views. The hub prints an admin token on first start, and <code>svcmon token create</code> makes more.</span>
      </div>

      <details>
        <summary class="small secondary" style="cursor: pointer">Hub address</summary>
        <div class="field" style="margin-top: 8px">
          <div class="label-row"><label for="hub">Hub URL</label><Tip field="login.hub" /></div>
          <input id="hub" type="text" bind:value={hubUrl} placeholder="Leave empty to use this site" autocomplete="off" spellcheck="false" />
          <span class="hint">Only needed when the dashboard is hosted apart from the hub. The hub must allow this site's address (CORS).</span>
        </div>
      </details>

      <label class="check"><input type="checkbox" bind:checked={remember} /> Remember this browser</label>
      {#if error}<p class="form-error" role="alert">{error}</p>{/if}
      <button class="btn primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>

    <div class="row between small muted">
      <span>The token stays in this browser only.</span>
      <button class="btn small ghost" type="button" onclick={cycleTheme}>Theme: {theme.pref}</button>
    </div>
  </div>
</div>
