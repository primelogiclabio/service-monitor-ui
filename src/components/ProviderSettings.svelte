<script>
  import { onMount } from 'svelte';
  import { getApi } from '../lib/auth.svelte.js';
  import { notify } from '../lib/notify.svelte.js';
  import { providerHealth, providerRows } from '../lib/provider.js';

  let view = $state(null);
  let loaded = $state(false);
  let error = $state('');

  const rows = $derived(providerRows(view));
  const health = $derived(providerHealth(view));

  async function load() {
    try {
      view = await getApi().provider();
      error = '';
    } catch (e) {
      error = e.message;
    } finally {
      loaded = true;
    }
  }
  onMount(load);

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied', 'success', 1800);
    } catch {
      notify('Copy failed; select the text and copy it by hand.', 'error');
    }
  }
</script>

<section class="card stack" aria-labelledby="signin-h">
  <div>
    <h2 id="signin-h">Sign-in with an identity provider</h2>
    <p class="secondary">
      How this hub signs people in with your organisation's identity provider, besides passwords. It is set in the
      hub's <code>application.yml</code> under <code>svcmon.oidc</code>, not here.
    </p>
  </div>
  {#if !loaded}
    <p class="muted">Loading…</p>
  {:else if error}
    <p class="form-error" role="alert">{error}</p>
  {:else if !rows}
    <p>
      This hub has no identity provider: people sign in with a user name and password only. To add one, set
      <code>svcmon.oidc.issuer</code>, <code>client-id</code> and <code>admin-role</code> (and
      <code>svcmon.public-url</code>) and restart the hub; the reference explains each.
    </p>
  {:else}
    <div class="banner" class:warn={!health.ok} role="status">{health.text}</div>
    <div class="table-wrap">
      <table class="data">
        <tbody>
          {#each rows as r (r.label)}
            <tr>
              <th scope="row">{r.label}</th>
              <td>
                {#if r.copy}
                  <code>{r.value}</code>
                  <button class="btn small ghost" type="button" onclick={() => copy(r.value)}>Copy</button>
                {:else}
                  {r.value}
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if view.certificatePem}
      <details>
        <summary>The key pair's certificate (PEM), for a provider that wants it uploaded (Entra ID)</summary>
        <div class="copybox">
          <pre>{view.certificatePem}</pre>
          <button class="btn" type="button" onclick={() => copy(view.certificatePem)}>Copy</button>
        </div>
      </details>
    {/if}
    {#if view.publicKeyPem}
      <details>
        <summary>The hub's public key (PEM), for a provider that wants it pasted</summary>
        <div class="copybox">
          <pre>{view.publicKeyPem}</pre>
          <button class="btn" type="button" onclick={() => copy(view.publicKeyPem)}>Copy</button>
        </div>
      </details>
    {/if}
    <p class="hint">
      Only the public half of the hub's key is shown or ever leaves the hub.
      {#if view.keySource === 'files'}
        The pair comes from files (made with signing-keys-tool): for a new one, make a new pair, point
        <code>svcmon.oidc.private-key-file</code> and <code>certificate-file</code> at it, and give the provider its
        certificate. The hub picks up changed files without a restart.
      {:else}
        A provider that fetches the public key address picks up a new key by itself after
        <code>java -jar svcmon-hub.jar oidc rotate-key</code>.
      {/if}
    </p>
  {/if}
</section>
