<script>
  import { notify } from '../lib/notify.svelte.js';
  import { fmtDateTime } from '../lib/format.js';
  import { installCommands } from '../lib/enroll.js';
  import Tip from './Tip.svelte';

  /**
   * The install command for a freshly issued enrollment token or join key (`kind`), for the platforms in `order`
   * (likelier first). A join key that names a cluster decides it, so the cluster box is left out.
   */
  let { issued, hub: initialHub = '', order = ['windows', 'unix'], idPrefix = 'ac', kind = 'enroll' } = $props();

  const join = kind === 'join';

  // Editable copies: starting values are read once, when the token is shown.
  const start = (() => ({ hub: initialHub }))();
  let hub = $state(start.hub);
  let cluster = $state('');

  const commands = $derived(installCommands({ hub, token: issued.token, cluster }));
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

<div class="banner warn">
  {#if join}
    This join key is shown only now. It works on any number of servers until you revoke it{issued.expiresAt
      ? ` or until ${fmtDateTime(issued.expiresAt)}`
      : ''}{issued.cluster ? `, and puts them in cluster ${issued.cluster}` : ''}. Keep it like a password.
  {:else}
    This token is shown only now{issued.expiresAt ? ` and expires ${fmtDateTime(issued.expiresAt)}` : ''}. It works once; if it is
    lost or used, create another.
  {/if}
</div>
<div class="form-grid">
  <div class="field">
    <div class="label-row"><label for="{idPrefix}-hub">Hub address the server will use</label><Tip field="enroll.hub" /></div>
    <input id="{idPrefix}-hub" type="text" bind:value={hub} autocomplete="off" spellcheck="false" />
    <span class="hint">Use the hub's internal address if this page is reached through a load balancer.</span>
  </div>
  {#if !(join && issued.cluster)}
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
  {join ? 'The same command works on every server; on each one it' : 'The command'} registers the server, then installs and starts the agent as a system service. It must be run from the folder
  that holds <code>svcmon</code>. The server appears on the overview once it connects.
</p>
