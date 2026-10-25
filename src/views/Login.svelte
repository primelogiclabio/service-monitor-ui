<script>
  import { auth, login, loginWithPassword } from '../lib/auth.svelte.js';
  import { theme, cycleTheme } from '../lib/theme.svelte.js';
  import Tip from '../components/Tip.svelte';

  const MODE_KEY = 'sm-login-mode';

  function savedMode() {
    try {
      return localStorage.getItem(MODE_KEY) === 'token' ? 'token' : 'password';
    } catch {
      return 'password';
    }
  }

  // The hub's own administrator signs in with a password; everyone else pastes an API token.
  let mode = $state(savedMode());
  let username = $state('admin');
  let password = $state('');
  let token = $state('');
  let hubUrl = $state('');
  let remember = $state(false);
  let busy = $state(false);
  let error = $state('');

  function choose(next) {
    mode = next;
    error = '';
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // the choice just is not remembered
    }
  }

  function describe(err) {
    if (err.status === 401) return mode === 'token' ? 'The hub did not accept that token.' : 'Wrong user name or password.';
    if (err.status === 404 && mode === 'password') return 'Password sign-in is turned off on this hub. Use an API token.';
    return err.message;
  }

  async function submit(e) {
    e.preventDefault();
    error = '';
    if (mode === 'token' && !token.trim()) {
      error = 'Paste an API token.';
      return;
    }
    if (mode === 'password' && (!username.trim() || !password)) {
      error = 'Enter the user name and password.';
      return;
    }
    busy = true;
    try {
      if (mode === 'token') await login({ hubUrl, token, remember });
      else await loginWithPassword({ hubUrl, username, password, remember });
    } catch (err) {
      error = describe(err);
    } finally {
      busy = false;
    }
  }
</script>

<div class="login">
  <div class="card stack">
    <div>
      <h1>Service Monitor</h1>
      <p class="secondary">
        {mode === 'token' ? 'Sign in with an API token from your hub.' : "Sign in with the hub's administrator account."}
      </p>
    </div>

    {#if auth.error}<div class="banner warn" role="status">{auth.error}</div>{/if}

    <div class="row" role="group" aria-label="Sign in with">
      <button class="btn small" class:primary={mode === 'password'} type="button" aria-pressed={mode === 'password'} onclick={() => choose('password')}>User name and password</button>
      <button class="btn small" class:primary={mode === 'token'} type="button" aria-pressed={mode === 'token'} onclick={() => choose('token')}>API token</button>
    </div>

    <form class="stack" onsubmit={submit} novalidate>
      {#if mode === 'password'}
        <div class="field">
          <label for="username">User name</label>
          <input id="username" type="text" bind:value={username} autocomplete="username" spellcheck="false" />
        </div>
        <div class="field">
          <div class="label-row"><label for="password">Password</label><Tip field="login.password" /></div>
          <input id="password" type="password" bind:value={password} autocomplete="current-password" />
          <span class="hint">After several wrong attempts the hub makes you wait before trying again.</span>
        </div>
      {:else}
        <div class="field">
          <div class="label-row"><label for="token">API token</label><Tip field="login.token" /></div>
          <input id="token" type="password" bind:value={token} autocomplete="off" spellcheck="false" placeholder="svm_a_…" />
          <span class="hint">An ADMIN token can change things; a READ token only views. The hub prints an admin token on first start, and <code>svcmon token create</code> makes more.</span>
        </div>
      {/if}

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
      <span>{mode === 'token' ? 'The token stays in this browser only.' : 'The password is not kept; only the sign-in token stays in this browser.'}</span>
      <button class="btn small ghost" type="button" onclick={cycleTheme}>Theme: {theme.pref}</button>
    </div>
  </div>
</div>
