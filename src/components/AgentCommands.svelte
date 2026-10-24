<script>
  import { notify } from '../lib/notify.svelte.js';
  import { fmtDateTime } from '../lib/format.js';
  import { installCommands } from '../lib/enroll.js';

  /** The install command for a freshly issued enrollment token, for the platforms in `order` (likelier first). */
  let { issued, hub: initialHub = '', order = ['windows', 'unix'], idPrefix = 'ac' } = $props();

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
  This token is shown only now{issued.expiresAt ? ` and expires ${fmtDateTime(issued.expiresAt)}` : ''}. It works once; if it is
  lost or used, create another.
</div>
<div class="form-grid">
  <div class="field">
    <label for="{idPrefix}-hub">Hub address the server will use</label>
    <input id="{idPrefix}-hub" type="text" bind:value={hub} autocomplete="off" spellcheck="false" />
    <span class="hint">Use the hub's internal address if this page is reached through a load balancer.</span>
  </div>
  <div class="field">
    <label for="{idPrefix}-cluster">Cluster (optional)</label>
    <input id="{idPrefix}-cluster" type="text" bind:value={cluster} placeholder="prod" autocomplete="off" />
  </div>
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
  The command registers the server, then installs and starts the agent as a system service. It must be run from the folder
  that holds <code>svcmon</code>. The server appears on the overview once it connects.
</p>
