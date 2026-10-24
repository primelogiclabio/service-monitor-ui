<script>
  import { auth, getApi } from '../lib/auth.svelte.js';
  import { notify } from '../lib/notify.svelte.js';
  import { fmtDateTime } from '../lib/format.js';

  let label = $state('');
  let cluster = $state('');
  let ttl = $state(60);
  let agentHub = $state(auth.hubUrl || location.origin);
  let issued = $state(null);
  let busy = $state(false);
  let error = $state('');

  async function create(e) {
    e.preventDefault();
    busy = true;
    error = '';
    try {
      issued = await getApi().enrollmentToken({ name: label.trim() || undefined, ttlMinutes: Number(ttl) });
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }

  const quote = (s) => (/[\s"']/.test(s) ? `"${s}"` : s);
  const installArgs = $derived(
    `--hub ${agentHub.trim() || '<hub address>'} --token ${issued?.token ?? '<token>'}${cluster.trim() ? ` --cluster ${quote(cluster.trim())}` : ''}`,
  );
  const winCmd = $derived(`.\\svcmon.exe agent install ${installArgs}`);
  const unixCmd = $derived(`sudo ./svcmon agent install ${installArgs}`);

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied', 'success', 1800);
    } catch {
      notify('Copy failed; select the text and copy it by hand.', 'error');
    }
  }
</script>

<div class="stack-lg" style="max-width: 820px">
  <div>
    <h1 style="font-size: 1.75rem">Add a server</h1>
    <p class="secondary" style="margin-top: 4px">
      Install the small <code>svcmon</code> agent on a server. It connects out to the hub, so the server needs no open ports.
      Nothing is monitored until you add checks for it.
    </p>
  </div>

  {#if !auth.admin}
    <div class="banner warn">Creating enrollment tokens needs an ADMIN token. You are signed in with a read-only token.</div>
  {:else}
    <form class="card stack" onsubmit={create}>
      <h2>1. Create a one-time token</h2>
      <div class="form-grid">
        <div class="field">
          <label for="e-label">Label (optional)</label>
          <input id="e-label" type="text" bind:value={label} placeholder="web03" autocomplete="off" />
        </div>
        <div class="field">
          <label for="e-ttl">Valid for (minutes)</label>
          <input id="e-ttl" type="number" min="1" max="1440" bind:value={ttl} />
          <span class="hint">The token works once, then it is spent.</span>
        </div>
      </div>
      {#if error}<p class="form-error" role="alert">{error}</p>{/if}
      <div><button class="btn primary" type="submit" disabled={busy}>Create token</button></div>
    </form>

    {#if issued}
      <section class="card stack" aria-live="polite">
        <h2>2. Run this on the server</h2>
        <div class="banner warn">
          This token is shown only now{issued.expiresAt ? ` and expires ${fmtDateTime(issued.expiresAt)}` : ''}.
        </div>
        <div class="form-grid">
          <div class="field">
            <label for="e-hub">Hub address the server will use</label>
            <input id="e-hub" type="text" bind:value={agentHub} autocomplete="off" spellcheck="false" />
            <span class="hint">Use the hub's internal address if this page is reached through a load balancer.</span>
          </div>
          <div class="field">
            <label for="e-cluster">Cluster (optional)</label>
            <input id="e-cluster" type="text" bind:value={cluster} placeholder="prod" autocomplete="off" />
          </div>
        </div>

        <div class="field">
          <span class="label">Windows — in an elevated PowerShell</span>
          <div class="copybox">
            <pre>{winCmd}</pre>
            <button class="btn" type="button" onclick={() => copy(winCmd)}>Copy</button>
          </div>
        </div>
        <div class="field">
          <span class="label">Linux or macOS</span>
          <div class="copybox">
            <pre>{unixCmd}</pre>
            <button class="btn" type="button" onclick={() => copy(unixCmd)}>Copy</button>
          </div>
        </div>
        <p class="small muted">
          The command registers the server, then installs and starts the agent as a system service. The server appears on the overview once it connects.
        </p>
      </section>
    {/if}
  {/if}
</div>
