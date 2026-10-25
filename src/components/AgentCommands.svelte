<script>
  import { notify } from '../lib/notify.svelte.js';
  import { installCommands, reconnectCommands } from '../lib/enroll.js';
  import Tip from './Tip.svelte';

  /**
   * The commands for each platform in `order` (likelier first), filled in with `token` (a join key or a one-time
   * token) or `placeholder` until there is one; Copy waits for the token. `mode` 'new' installs the agent; 'existing'
   * registers an agent that is already installed and restarts its service, which differs between Linux and macOS.
   * The hub address is known from this page, so it is only shown, with a way to change it; `localHub` offers the hub's
   * own address for its own machine. `hub` and `cluster` are bindable so a parent can keep them when the mode changes.
   * A join key that pins a cluster (`fixedCluster`) decides it, so the cluster box is left out.
   */
  let {
    token = '',
    placeholder = '<token>',
    hub = $bindable(''),
    cluster = $bindable(''),
    localHub = '',
    order = ['windows', 'unix'],
    mode = 'new',
    idPrefix = 'ac',
    fixedCluster = null,
  } = $props();

  let changingHub = $state(false);

  const existing = $derived(mode === 'existing');
  const commands = $derived(
    (existing ? reconnectCommands : installCommands)({ hub, token, cluster: fixedCluster ? '' : cluster, placeholder }),
  );
  const platforms = $derived(existing ? order.flatMap((p) => (p === 'unix' ? ['linux', 'macos'] : [p])) : order);
  const labels = {
    windows: 'Windows — in an elevated PowerShell',
    unix: 'Linux or macOS',
    linux: 'Linux',
    macos: 'macOS',
  };

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied', 'success', 1800);
    } catch {
      notify('Copy failed; select the text and copy it by hand.', 'error');
    }
  }
</script>

<div class="form-grid">
  {#if fixedCluster}
    <div class="field">
      <span class="label">Cluster</span>
      <p class="secondary">{fixedCluster} <span class="muted">(set by the join key)</span></p>
    </div>
  {:else}
    <div class="field">
      <div class="label-row"><label for="{idPrefix}-cluster">Cluster (optional)</label><Tip field="enroll.cluster" /></div>
      <input id="{idPrefix}-cluster" type="text" bind:value={cluster} placeholder="prod" autocomplete="off" />
    </div>
  {/if}
  <div class="field">
    {#if changingHub || !hub.trim()}
      <div class="label-row"><label for="{idPrefix}-hub">Hub address the server will use</label><Tip field="enroll.hub" /></div>
      <input id="{idPrefix}-hub" type="text" bind:value={hub} autocomplete="off" spellcheck="false" />
      <span class="hint">
        Use the hub's internal address if this page is reached through a load balancer.
        {#if localHub && hub.trim() !== localHub}
          <button class="btn small ghost inline-link" type="button" onclick={() => (hub = localHub)}>
            Installing on the hub's own machine? Use {localHub}
          </button>
        {/if}
      </span>
    {:else}
      <div class="label-row"><span class="label">Hub address the server will use</span><Tip field="enroll.hub" /></div>
      <p class="hub-known">
        <code>{hub}</code>
        <button class="btn small ghost inline-link" type="button" onclick={() => (changingHub = true)}>Change</button>
      </p>
    {/if}
  </div>
</div>

{#each platforms as os (os)}
  <div class="field">
    <span class="label">{labels[os]}</span>
    <div class="copybox">
      <pre>{commands[os]}</pre>
      <button class="btn" type="button" disabled={!token} onclick={() => copy(commands[os])}>Copy</button>
    </div>
  </div>
{/each}
<p class="small muted">
  {#if existing}
    Run it as an administrator from the folder of the installed <code>svcmon</code>. It registers the server with this hub
    under its host name (add <code>--name</code> for another), replacing any earlier registration, then restarts the agent
    so it reports here.
  {:else}
    Run it from the folder that holds <code>svcmon</code>. It registers the server under its host name (add
    <code>--name</code> for another), then installs and starts the agent as a system service.
  {/if}
</p>
