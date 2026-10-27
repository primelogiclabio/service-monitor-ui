<script>
  import { onMount } from 'svelte';
  import { getApi } from '../lib/auth.svelte.js';
  import { describeAccess } from '../lib/access.js';

  let view = $state(null);
  let loaded = $state(false);
  let error = $state('');

  const text = $derived(describeAccess(view));

  async function load() {
    try {
      view = await getApi().access();
      error = '';
    } catch (e) {
      error = e.message;
    } finally {
      loaded = true;
    }
  }
  onMount(load);
</script>

<section class="card stack" aria-labelledby="access-h">
  <div>
    <h2 id="access-h">Access</h2>
    <p class="secondary">
      Where people may use this hub from. It is set in the hub's <code>application.yml</code> under
      <code>svcmon.access</code>, not here. To check it, open this page from a phone on mobile data: it should say
      outside, and with outside access off the hub should refuse it.
    </p>
  </div>
  {#if !loaded}
    <p class="muted">Loading…</p>
  {:else if error}
    <p class="form-error" role="alert">{error}</p>
  {:else if text}
    <p>{text.rule} <code>{text.setting}</code></p>
    <div class="banner" class:warn={text.outside} role="status">{text.browser}</div>
    <div class="table-wrap">
      <table class="data">
        <tbody>
          <tr>
            <th scope="row">Internal network</th>
            <td>{#if text.networks.length}{#each text.networks as n, i (n)}{i ? ', ' : ''}<code>{n}</code>{/each}{:else}<span class="muted">none: everyone is outside</span>{/if}</td>
          </tr>
          <tr>
            <th scope="row">Public proxies</th>
            <td>{#if text.proxies.length}{#each text.proxies as p, i (p)}{i ? ', ' : ''}<code>{p}</code>{/each}{:else}<span class="muted">none</span>{/if}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="hint">
      A request that shows up as a public proxy counts as outside, so a proxy that forgets to pass on the visitor's
      address is refused rather than let in. Agents are never refused for where they are.
    </p>
  {/if}
</section>
