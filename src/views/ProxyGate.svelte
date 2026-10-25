<script>
  import { auth, logout, redirectToSignIn } from '../lib/auth.svelte.js';
  import { theme, cycleTheme } from '../lib/theme.svelte.js';
</script>

<div class="login">
  <div class="card stack">
    <div>
      <h1>Service Monitor</h1>
      {#if auth.gate === 'signin'}
        <p class="secondary">{auth.redirecting ? 'Taking you to the sign-in page…' : 'Sign in to continue.'}</p>
      {:else if auth.gate === 'forbidden'}
        <p class="secondary">You are signed in, but this account may not use the dashboard. Only administrators can.</p>
      {:else if auth.gate === 'signedout'}
        <p class="secondary">Signing you out…</p>
      {/if}
    </div>

    {#if auth.error}<div class="banner warn" role="status">{auth.error}</div>{/if}

    <div class="row">
      {#if auth.gate === 'signin' && auth.proxy?.signInUrl}
        <button class="btn primary" type="button" onclick={() => redirectToSignIn()}>Sign in</button>
      {:else if auth.gate === 'forbidden' && auth.proxy?.signOutUrl}
        <button class="btn primary" type="button" onclick={logout}>Sign out</button>
      {/if}
    </div>

    <div class="row between small muted">
      <span></span>
      <button class="btn small ghost" type="button" onclick={cycleTheme}>Theme: {theme.pref}</button>
    </div>
  </div>
</div>
