<script>
  import { onMount } from 'svelte';
  import { auth, getApi } from '../lib/auth.svelte.js';
  import { notify } from '../lib/notify.svelte.js';
  import { ago, fmtDateTime } from '../lib/format.js';
  import { describeBrowser, ownSessions } from '../lib/account.js';
  import PasswordForm from './PasswordForm.svelte';

  let sessions = $state([]);
  let loaded = $state(false);
  let error = $state('');
  let ending = $state(null);

  async function load() {
    try {
      sessions = ownSessions(await getApi().sessions(), auth.user);
      error = '';
    } catch (e) {
      error = e.message;
    } finally {
      loaded = true;
    }
  }
  // Behind a sign-in proxy the account and its sign-ins belong to the proxy's provider, not to the hub.
  onMount(() => {
    if (auth.mode === 'session') load();
  });

  async function end(s) {
    ending = s.id;
    try {
      await getApi().endSession(s.id);
      notify(`Signed out ${describeBrowser(s.userAgent)}`, 'success');
      await load();
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      ending = null;
    }
  }

  function changed() {
    notify('Password changed. Your other sign-ins have ended.', 'success');
    load();
  }
</script>

{#if auth.mode !== 'session'}
  <section class="card stack">
    <h2>Your account</h2>
    <p class="secondary">
      Signed in as <strong>{auth.user}</strong> through the sign-in service, with {auth.admin ? 'administrator' : 'read-only'}
      access. Your password and sign-ins are managed there.
    </p>
  </section>
{:else}
  <section class="card stack" aria-labelledby="acct-pw">
    <div>
      <h2 id="acct-pw">Change your password</h2>
      <p class="secondary">
        Signed in as <strong>{auth.user}</strong>, with {auth.admin ? 'administrator' : 'read-only'} access. Changing the
        password signs you out everywhere else.
      </p>
    </div>
    <div style="max-width: 420px"><PasswordForm onchanged={changed} /></div>
  </section>

  <section class="card stack" aria-labelledby="acct-sessions">
    <h2 id="acct-sessions">Where you are signed in</h2>
    {#if !loaded}
      <p class="muted">Loading…</p>
    {:else if error}
      <p class="form-error" role="alert">{error}</p>
    {:else if sessions.length === 0}
      <p class="muted">No sign-ins.</p>
    {:else}
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr><th>Browser</th><th class="hide-sm">Address</th><th class="hide-sm">Signed in</th><th>Last active</th><th></th></tr>
          </thead>
          <tbody>
            {#each sessions as s (s.id)}
              <tr>
                <td>{describeBrowser(s.userAgent)}{#if s.current}<span class="source-tag">this browser</span>{/if}</td>
                <td class="hide-sm">{s.clientAddress ?? '—'}</td>
                <td class="hide-sm">{fmtDateTime(s.createdAt)}</td>
                <td title={fmtDateTime(s.lastSeenAt)}>{ago(s.lastSeenAt)}</td>
                <td class="num">
                  {#if !s.current}
                    <button class="btn small" type="button" title="Sign this browser out" disabled={ending === s.id} onclick={() => end(s)}>End</button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
{/if}
