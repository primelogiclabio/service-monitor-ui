<script>
  import { auth, changePassword } from '../lib/auth.svelte.js';
  import { PASSWORD_MAX, PASSWORD_MIN, newPasswordProblem, passwordChangeMessage } from '../lib/account.js';
  import Tip from './Tip.svelte';

  /** Changes the signed-in user's own password. `onchanged` runs after the hub took it. */
  let { submitLabel = 'Change password', idPrefix = 'pw', onchanged } = $props();

  let currentPassword = $state('');
  let newPassword = $state('');
  let confirm = $state('');
  let busy = $state(false);
  let error = $state('');

  async function submit(e) {
    e.preventDefault();
    error = currentPassword ? newPasswordProblem({ newPassword, confirm, username: auth.user }) : 'Enter your current password.';
    if (error) return;
    busy = true;
    try {
      await changePassword({ currentPassword, newPassword });
      currentPassword = newPassword = confirm = '';
      onchanged?.();
    } catch (err) {
      error = passwordChangeMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<form class="stack" onsubmit={submit} novalidate>
  <!-- Lets a password manager store the new password under the right account. -->
  <input type="text" name="username" value={auth.user} autocomplete="username" hidden readonly />
  <div class="field">
    <label for="{idPrefix}-current">Current password</label>
    <input id="{idPrefix}-current" type="password" bind:value={currentPassword} autocomplete="current-password" />
  </div>
  <div class="field">
    <div class="label-row"><label for="{idPrefix}-new">New password</label><Tip field="password.new" /></div>
    <input id="{idPrefix}-new" type="password" bind:value={newPassword} autocomplete="new-password" maxlength={PASSWORD_MAX} />
    <span class="hint">{PASSWORD_MIN} to {PASSWORD_MAX} characters, not your user name. A few words together are easy to remember.</span>
  </div>
  <div class="field">
    <label for="{idPrefix}-confirm">New password again</label>
    <input id="{idPrefix}-confirm" type="password" bind:value={confirm} autocomplete="new-password" maxlength={PASSWORD_MAX} />
  </div>
  {#if error}<p class="form-error" role="alert">{error}</p>{/if}
  <div><button class="btn primary" type="submit" disabled={busy}>{busy ? 'Changing…' : submitLabel}</button></div>
</form>
