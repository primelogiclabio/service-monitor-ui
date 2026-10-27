<script>
  import { onMount } from 'svelte';
  import { auth, getApi } from '../lib/auth.svelte.js';
  import { notify } from '../lib/notify.svelte.js';
  import { fmtDateTime } from '../lib/format.js';
  import { ROLES, roleLabel, userAction, userStatus, usernameProblem } from '../lib/account.js';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import Tip from './Tip.svelte';

  let users = $state([]);
  let loaded = $state(false);
  let error = $state('');

  let name = $state('');
  let role = $state('READ');
  let adding = $state(false);
  let formError = $state('');

  // A temporary password the hub just made: kept in this component only, until Done or leaving the page.
  let issued = $state(null);
  // The action waiting for its confirmation: { kind, user, role }.
  let pending = $state(null);
  const dialog = $derived(pending ? userAction(pending.kind, pending.user, pending.role) : null);

  async function load() {
    try {
      users = (await getApi().users()).sort((a, b) => a.username.localeCompare(b.username));
      error = '';
    } catch (e) {
      error = e.message;
    } finally {
      loaded = true;
    }
  }
  onMount(load);

  async function add(e) {
    e.preventDefault();
    formError = usernameProblem(name.trim());
    if (formError) return;
    adding = true;
    try {
      const created = await getApi().createUser({ username: name.trim(), role });
      issued = { username: created.user.username, password: created.temporaryPassword, reset: false };
      name = '';
      await load();
    } catch (err) {
      formError = err.message; // 409 username_taken says which name
    } finally {
      adding = false;
    }
  }

  async function confirm() {
    const { kind, user } = pending;
    const api = getApi();
    try {
      if (kind === 'reset') {
        const reset = await api.resetPassword(user.id);
        issued = { username: reset.user.username, password: reset.temporaryPassword, reset: true };
      } else if (kind === 'delete') {
        await api.deleteUser(user.id);
        notify(`Deleted ${user.username}`, 'success');
      } else {
        const patch = kind === 'role' ? { role: pending.role } : { disabled: kind === 'disable' };
        const updated = await api.updateUser(user.id, patch);
        notify(
          kind === 'role' ? `${updated.username} is now ${roleLabel(updated.role).toLowerCase()}` : `${updated.username} is ${kind}d`,
          'success',
        );
      }
    } catch (e) {
      notify(e.message, 'error'); // 409 last_admin and own_account explain themselves
    } finally {
      pending = null;
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

<form class="card stack" onsubmit={add}>
  <div>
    <h2>Add a user</h2>
    <p class="secondary">The hub makes a temporary password, shown once. The new user signs in with it from the hub's internal network and chooses their own.</p>
  </div>
  <div class="form-grid">
    <div class="field">
      <div class="label-row"><label for="u-name">User name</label><Tip field="user.name" /></div>
      <input id="u-name" type="text" bind:value={name} autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="64" />
    </div>
    <div class="field">
      <div class="label-row"><label for="u-role">Role</label><Tip field="user.role" /></div>
      <select id="u-role" bind:value={role}>
        {#each ROLES as r (r.value)}<option value={r.value}>{r.label}</option>{/each}
      </select>
    </div>
  </div>
  {#if formError}<p class="form-error" role="alert">{formError}</p>{/if}
  <div><button class="btn primary" type="submit" disabled={adding || !name.trim()}>Add user</button></div>
</form>

{#if issued}
  <div class="card stack" aria-live="polite">
    <div class="banner warn">
      {issued.reset ? 'New temporary password' : 'Temporary password'} for “{issued.username}”. It is shown only now. Pass it on
      safely; it works only from the hub's internal network, and they choose their own password when they sign in.
    </div>
    <div class="copybox">
      <pre>{issued.password}</pre>
      <button class="btn" type="button" onclick={() => copy(issued.password)}>Copy</button>
    </div>
    <div><button class="btn small" type="button" onclick={() => (issued = null)}>Done</button></div>
  </div>
{/if}

<section class="card stack" aria-labelledby="users-h">
  <h2 id="users-h">Users</h2>
  {#if !loaded}
    <p class="muted">Loading…</p>
  {:else if error}
    <p class="form-error" role="alert">{error}</p>
  {:else if users.length === 0}
    <p class="muted">No users yet.</p>
  {:else}
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr><th>Name</th><th>Role</th><th>Status</th><th class="hide-sm">Last sign-in</th><th></th></tr>
        </thead>
        <tbody>
          {#each users as u (u.id)}
            {@const self = auth.mode === 'session' && u.username === auth.user}
            <tr>
              <td>{u.username}{#if self}<span class="source-tag">you</span>{/if}</td>
              <td>{roleLabel(u.role)}</td>
              <td>{userStatus(u)}</td>
              <td class="hide-sm">{u.lastSignInAt ? fmtDateTime(u.lastSignInAt) : 'never'}</td>
              <td class="num">
                {#if self}
                  <span class="small muted">Change your password under Account</span>
                {:else}
                  <div class="row" style="justify-content: flex-end">
                    {#if u.role === 'ADMIN'}
                      <button class="btn small" type="button" onclick={() => (pending = { kind: 'role', user: u, role: 'READ' })}>Make read-only</button>
                    {:else}
                      <button class="btn small" type="button" onclick={() => (pending = { kind: 'role', user: u, role: 'ADMIN' })}>Make administrator</button>
                    {/if}
                    <button class="btn small" type="button" onclick={() => (pending = { kind: 'reset', user: u })}>Reset password</button>
                    {#if u.disabled}
                      <button class="btn small" type="button" onclick={() => (pending = { kind: 'enable', user: u })}>Enable</button>
                    {:else}
                      <button class="btn small" type="button" onclick={() => (pending = { kind: 'disable', user: u })}>Disable</button>
                    {/if}
                    <button class="btn small danger" type="button" onclick={() => (pending = { kind: 'delete', user: u })}>Delete</button>
                  </div>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

{#if dialog}
  <ConfirmDialog
    title={dialog.title}
    message={dialog.message}
    confirmLabel={dialog.confirmLabel}
    danger={dialog.danger}
    onconfirm={confirm}
    oncancel={() => (pending = null)}
  />
{/if}
