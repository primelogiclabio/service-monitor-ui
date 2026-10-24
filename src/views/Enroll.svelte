<script>
  import { auth, getApi } from '../lib/auth.svelte.js';
  import { TTL_CHOICES, THIS_SERVER_TTL_MINUTES, guessPlatform, pageIsOnTheHub, thisServerHub } from '../lib/enroll.js';
  import AgentCommands from '../components/AgentCommands.svelte';
  import Help from '../components/Help.svelte';

  // The page's own address: where the hub is if the dashboard is served by it.
  const pageHub = auth.hubUrl || location.origin;
  const onHubMachine = pageIsOnTheHub(pageHub);
  const likely = guessPlatform(navigator.userAgent);
  // When the browser is on the hub's machine its platform is the hub's; otherwise it says nothing about it.
  const thisOrder = onHubMachine && likely === 'unix' ? ['unix', 'windows'] : ['windows', 'unix'];

  let label = $state('');
  let ttl = $state(60);
  let issued = $state(null);
  let busy = $state(false);
  let error = $state('');

  let thisIssued = $state(null);
  let thisBusy = $state(false);
  let thisError = $state('');

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

  async function createForThisServer() {
    thisBusy = true;
    thisError = '';
    try {
      thisIssued = await getApi().enrollmentToken({ name: 'this server', ttlMinutes: THIS_SERVER_TTL_MINUTES });
    } catch (err) {
      thisError = err.message;
    } finally {
      thisBusy = false;
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

  <Help topic="addServer" />

  {#if !auth.admin}
    <div class="banner warn">Creating enrollment tokens needs an ADMIN token. You are signed in with a read-only token.</div>
  {:else}
    <section class="card stack" aria-labelledby="this-server">
      <h2 id="this-server">This server (where the hub runs)</h2>
      <p class="secondary">
        The quickest way to monitor the machine that runs the hub. One click makes a token that is valid for
        {THIS_SERVER_TTL_MINUTES} minutes and fills in the command with the hub's own address.
      </p>
      {#if thisError}<p class="form-error" role="alert">{thisError}</p>{/if}
      {#if !thisIssued}
        <div>
          <button class="btn primary" type="button" onclick={createForThisServer} disabled={thisBusy}>
            Create token for this server
          </button>
        </div>
      {:else}
        <div class="stack" aria-live="polite">
          <AgentCommands issued={thisIssued} hub={thisServerHub(pageHub)} order={thisOrder} idPrefix="this" />
        </div>
      {/if}
    </section>

    <form class="card stack" onsubmit={create}>
      <h2>Another server: 1. Create a one-time token</h2>
      <div class="form-grid">
        <div class="field">
          <label for="e-label">Label (optional)</label>
          <input id="e-label" type="text" bind:value={label} placeholder="web03" autocomplete="off" />
        </div>
        <div class="field">
          <label for="e-ttl">Valid for</label>
          <select id="e-ttl" bind:value={ttl}>
            {#each TTL_CHOICES as c (c.minutes)}<option value={c.minutes}>{c.label}</option>{/each}
          </select>
          <span class="hint">
            The token works once. It expires so one that is lost or forgotten cannot be used later; choose longer only if
            someone will run the command later.
          </span>
        </div>
      </div>
      {#if error}<p class="form-error" role="alert">{error}</p>{/if}
      <div><button class="btn primary" type="submit" disabled={busy}>Create token</button></div>
    </form>

    {#if issued}
      <section class="card stack" aria-live="polite">
        <h2>2. Run this on the server</h2>
        <AgentCommands {issued} hub={pageHub} idPrefix="other" />
      </section>
    {/if}

    <section class="card stack" aria-labelledby="installed">
      <h2 id="installed">Agent already installed?</h2>
      <p class="secondary">
        Once an agent has enrolled it keeps its own permanent credential in <code>agent.json</code> on the server, so the
        one-time token is no longer needed.
      </p>
      <ul class="stack" style="padding-left: 20px">
        <li>
          <strong>It is already on the Overview:</strong> nothing to enroll. To (re)install it as a service from its existing
          settings, run <code>svcmon agent install</code> with no token.
        </li>
        <li>
          <strong>It is not on the Overview</strong> (the server was deleted from the hub, or this is a new hub): create a
          token above and run the same command. Giving <code>--token</code> replaces the old enrollment, and <code>--hub</code>
          can be left out to reuse the hub in the old file.
        </li>
        <li>
          <strong>A server with the same name is still listed:</strong> delete it first (open it and choose Delete) or add
          <code>--name</code> with another name.
        </li>
        <li>
          <strong>Lost or used token:</strong> a token cannot be shown again; create another. Unused ones can be revoked on the
          Tokens page.
        </li>
      </ul>
    </section>
  {/if}
</div>
