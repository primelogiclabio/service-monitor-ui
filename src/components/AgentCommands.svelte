<script>
  import { notify } from '../lib/notify.svelte.js';
  import { installCommands } from '../lib/enroll.js';
  import Tip from './Tip.svelte';

  /**
   * The install command for each platform in `order` (likelier first), filled in with `token` (a join key or a
   * one-time token) or `placeholder` until there is one. `localHub` offers the hub's own address for installing on
   * its machine. A join key that pins a cluster (`fixedCluster`) decides it, so the cluster box is left out.
   */
  let {
    token = '',
    placeholder = '<token>',
    hub: initialHub = '',
    localHub = '',
    order = ['windows', 'unix'],
    idPrefix = 'ac',
    fixedCluster = null,
  } = $props();

  // Editable copies: starting values are read once, when the commands are first shown.
  const start = (() => ({ hub: initialHub }))();
  let hub = $state(start.hub);
  let cluster = $state('');

  const commands = $derived(installCommands({ hub, token, cluster: fixedCluster ? '' : cluster, placeholder }));
  const labels = { windows: 'Windows — in an elevated PowerShell', unix: 'Linux or macOS' };

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
  <div class="field">
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
  </div>
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
</div>

{#each order as os (os)}
  <div class="field">
    <span class="label">{labels[os]}</span>
    <div class="copybox">
      <pre>{commands[os]}</pre>
      <button class="btn" type="button" onclick={() => copy(commands[os])}>Copy</button>
    </div>
  </div>
{/each}
<p class="small muted">
  Run it from the folder that holds <code>svcmon</code>. It registers the server under its host name (add
  <code>--name</code> for another), then installs and starts the agent as a system service.
</p>
