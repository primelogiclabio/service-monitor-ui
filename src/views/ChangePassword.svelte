<script>
  import { auth, logout } from '../lib/auth.svelte.js';
  import { theme, cycleTheme } from '../lib/theme.svelte.js';
  import PasswordForm from '../components/PasswordForm.svelte';
</script>

<div class="login">
  <div class="card stack">
    <div>
      <h1>Choose a new password</h1>
      <p class="secondary">
        Signed in as <strong>{auth.user}</strong>. Your password was set for you (a new account, a new hub or a reset), so
        choose your own before going on.
      </p>
    </div>

    <PasswordForm submitLabel="Change password and continue" idPrefix="must" />

    <div class="row between small muted">
      <button class="btn small" type="button" onclick={logout}>Sign out</button>
      <button class="btn small ghost" type="button" onclick={cycleTheme}>Theme: {theme.pref}</button>
    </div>
  </div>
</div>
