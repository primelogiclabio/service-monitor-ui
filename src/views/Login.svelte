<script>
  import { auth, signIn } from '../lib/auth.svelte.js';
  import { signInMessage } from '../lib/account.js';
  import { theme, cycleTheme } from '../lib/theme.svelte.js';
  import Tip from '../components/Tip.svelte';

  let username = $state('');
  let password = $state('');
  let busy = $state(false);
  let error = $state('');

  // The identity provider's button, on a hub that has one; the password form unless the hub takes only the provider
  // from here (outside the internal network). An older hub says nothing, and then the form is all there is.
  const provider = $derived(auth.access?.provider?.allowed ? auth.access.provider : null);
  const passwordForm = $derived(auth.access?.passwordSignIn !== false);

  async function submit(e) {
    e.preventDefault();
    error = '';
    if (!username.trim() || !password) {
      error = 'Enter your user name and password.';
      return;
    }
    busy = true;
    try {
      await signIn({ username, password });
    } catch (err) {
      error = signInMessage(err);
    } finally {
      password = '';
      busy = false;
    }
  }
</script>

<div class="login">
  <div class="card stack">
    <div>
      <h1>Service Monitor</h1>
      <p class="secondary">
        {#if provider && passwordForm}
          Sign in with your organisation's account, or with your account on this hub.
        {:else if provider}
          Sign in with your organisation's account.
        {:else}
          Sign in with your account on this hub.
        {/if}
      </p>
    </div>

    {#if auth.error}<div class="banner warn" role="status">{auth.error}</div>{/if}

    {#if provider}
      <a class="btn primary" href={provider.startUrl}>{provider.label}</a>
      {#if passwordForm}<p class="small muted divider-text">or with a user name and password</p>{/if}
    {/if}

    {#if passwordForm}
      <form class="stack" onsubmit={submit} novalidate>
        <div class="field">
          <label for="username">User name</label>
          <input id="username" type="text" bind:value={username} autocomplete="username" autocapitalize="none" spellcheck="false" />
        </div>
        <div class="field">
          <div class="label-row"><label for="password">Password</label><Tip field="login.password" /></div>
          <input id="password" type="password" bind:value={password} autocomplete="current-password" />
          <span class="hint">After several wrong attempts the hub makes you wait before trying again.</span>
        </div>
        {#if error}<p class="form-error" role="alert">{error}</p>{/if}
        <button class={provider ? 'btn' : 'btn primary'} type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    {:else if !provider}
      <p class="form-error" role="alert">This hub takes no sign-in from here.</p>
    {:else}
      <p class="hint">From outside the hub's internal network, only this sign-in works.</p>
    {/if}

    <div class="row between small muted">
      <span>This browser keeps no password or token.</span>
      <button class="btn small ghost" type="button" onclick={cycleTheme}>Theme: {theme.pref}</button>
    </div>
  </div>
</div>
