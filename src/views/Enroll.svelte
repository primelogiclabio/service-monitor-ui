<script>
  import { auth, getApi } from '../lib/auth.svelte.js';
  import { notify } from '../lib/notify.svelte.js';
  import { fmtDateTime } from '../lib/format.js';
  import { JOIN_EXPIRY_CHOICES, TTL_CHOICES, guessPlatform, pageIsOnTheHub, thisServerHub } from '../lib/enroll.js';
  import AgentCommands from '../components/AgentCommands.svelte';
  import JoinKeyList from '../components/JoinKeyList.svelte';
  import WithHelp from '../components/WithHelp.svelte';
  import Tip from '../components/Tip.svelte';

  // The page's own address: where the hub is if the dashboard is served by it.
  const pageHub = auth.hubUrl || location.origin;
  const localHub = thisServerHub(pageHub);
  // When the browser is on the hub's machine its platform is the likelier one; otherwise Windows comes first.
  const order = pageIsOnTheHub(pageHub) && guessPlatform(navigator.userAgent) === 'unix' ? ['unix', 'windows'] : ['windows', 'unix'];

  // Step 1: the join key that goes into the command. A new key fills it in; a saved one can be pasted.
  let created = $state(null);
  let pasted = $state('');
  let keysKnown = $state(null); // the hub's join keys once loaded (admins only)
  let creating = $state(false);
  let name = $state('servers');
  let cluster = $state('');
  let expiry = $state('');
  let busy = $state(false);
  let error = $state('');
  let listVersion = $state(0);

  // Step 2: a new agent, or one that is already installed and only needs to register here.
  let way = $state('new');

  const key = $derived(pasted.trim() || created?.token || '');
  const keyCluster = $derived(!pasted.trim() && created?.cluster ? created.cluster : null);
  const showCreate = $derived(creating || (keysKnown !== null && keysKnown.length === 0 && !created));

  async function createKey(e) {
    e.preventDefault();
    if (!name.trim()) return (error = 'Give the key a name.');
    busy = true;
    error = '';
    try {
      const body = { name: name.trim() };
      if (cluster.trim()) body.cluster = cluster.trim();
      if (expiry !== '') body.expiresInDays = Number(expiry);
      created = await getApi().createJoinKey(body);
      pasted = '';
      creating = false;
      listVersion++;
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
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

  // Other ways: a one-time token for a single server.
  let label = $state('');
  let ttl = $state(60);
  let issued = $state(null);
  let tokenBusy = $state(false);
  let tokenError = $state('');

  async function createToken(e) {
    e.preventDefault();
    tokenBusy = true;
    tokenError = '';
    try {
      issued = await getApi().enrollmentToken({ name: label.trim() || undefined, ttlMinutes: Number(ttl) });
    } catch (err) {
      tokenError = err.message;
    } finally {
      tokenBusy = false;
    }
  }
</script>

<WithHelp topic="addServer">
<div class="stack-lg" style="max-width: 820px">
  <div>
    <h1 style="font-size: 1.75rem">Add a server</h1>
    <p class="secondary" style="margin-top: 4px">
      Servers add themselves. Install the small <code>svcmon</code> agent with this hub's address and a join key, and it
      registers on its own when it starts. It only connects out, so the server needs no open ports.
    </p>
  </div>

  <section class="card stack" aria-labelledby="step-key">
    <h2 id="step-key">1. A join key</h2>
    <p class="secondary">
      One key works for any number of servers. It is shown only when it is created, so save it somewhere safe and reuse it.
    </p>

    {#if created}
      <div class="banner warn" aria-live="polite">
        New join key “{created.name}”. It is shown only now and works until you revoke it{created.expiresAt
          ? ` or until ${fmtDateTime(created.expiresAt)}`
          : ''}{created.cluster ? `; it puts servers in cluster ${created.cluster}` : ''}. Keep it like a password.
      </div>
      <div class="copybox">
        <pre>{created.token}</pre>
        <button class="btn" type="button" onclick={() => copy(created.token)}>Copy</button>
      </div>
    {/if}

    <div class="field">
      <div class="label-row">
        <label for="jk-paste">{created ? 'Or paste another join key' : 'Paste a join key you saved'}</label>
        <Tip field="joinKey.paste" />
      </div>
      <input id="jk-paste" type="text" bind:value={pasted} placeholder="svm_j_…" autocomplete="off" spellcheck="false" />
    </div>

    {#if auth.admin}
      {#if showCreate}
        <form class="stack" onsubmit={createKey}>
          <div class="form-grid">
            <div class="field">
              <div class="label-row"><label for="jk-name">Name</label><Tip field="joinKey.name" /></div>
              <input id="jk-name" type="text" bind:value={name} autocomplete="off" maxlength="100" />
            </div>
            <div class="field">
              <div class="label-row"><label for="jk-cluster">Cluster (optional)</label><Tip field="joinKey.cluster" /></div>
              <input id="jk-cluster" type="text" bind:value={cluster} placeholder="any" autocomplete="off" maxlength="100" />
            </div>
            <div class="field">
              <div class="label-row"><label for="jk-expiry">Stops working</label><Tip field="joinKey.expiry" /></div>
              <select id="jk-expiry" bind:value={expiry}>
                {#each JOIN_EXPIRY_CHOICES as c (c.label)}<option value={c.days ?? ''}>{c.label}</option>{/each}
              </select>
            </div>
          </div>
          {#if error}<p class="form-error" role="alert">{error}</p>{/if}
          <div class="row">
            <button class="btn primary" type="submit" disabled={busy}>Create join key</button>
            {#if creating}<button class="btn" type="button" onclick={() => (creating = false)}>Cancel</button>{/if}
          </div>
        </form>
      {:else}
        <div><button class="btn" type="button" onclick={() => (creating = true)}>Create a new join key</button></div>
      {/if}

      <details>
        <summary class="small secondary" style="cursor: pointer">
          Join keys on this hub{keysKnown ? ` (${keysKnown.length})` : ''}
        </summary>
        <div style="margin-top: 8px">
          <JoinKeyList version={listVersion} onloaded={(k) => (keysKnown = k)} />
        </div>
      </details>
    {:else}
      <p class="muted">Creating a join key needs an ADMIN token; ask an admin for one and paste it above.</p>
    {/if}
  </section>

  <section class="card stack" aria-labelledby="step-run">
    <h2 id="step-run">2. On each server</h2>
    <div class="segmented" role="group" aria-label="Is the agent already on the server?">
      <button type="button" aria-pressed={way === 'new'} onclick={() => (way = 'new')}>Install a new agent</button>
      <button type="button" aria-pressed={way === 'existing'} onclick={() => (way = 'existing')}>Agent already installed</button>
    </div>
    {#if way === 'new'}
      <ol class="steps">
        <li>Copy the <code>svcmon</code> program to the server. It is one file; see the README, "Build the agent and CLI".</li>
        <li>Run the command below there, from the folder that holds it.</li>
      </ol>
    {:else}
      <p class="secondary">
        For an agent installed earlier, for example registered with another hub or removed from this one. It keeps its program
        and service and only changes which hub it reports to. If the server is already on the <a href="#/">Overview</a> and
        online, there is nothing to do; if an old entry with its name is still listed, remove it first (open it and choose
        Remove) or add <code>--name</code>.
      </p>
    {/if}
    {#key `${way}|${keyCluster}`}
      <AgentCommands
        token={key}
        placeholder="<join key>"
        hub={pageHub}
        {localHub}
        {order}
        mode={way}
        fixedCluster={keyCluster}
        idPrefix="add"
      />
    {/key}
    {#if !key}<p class="small muted">Create or paste a join key in step 1 and it is filled in here.</p>{/if}
  </section>

  <section class="card stack" aria-labelledby="step-see">
    <h2 id="step-see">3. Watch it appear</h2>
    <p>
      The server shows up on the <a href="#/">Overview</a> within seconds of the command finishing. Nothing is monitored until
      you add checks: open the server and choose Add check.
    </p>
  </section>

  <details class="card">
    <summary style="cursor: pointer"><strong>Other ways</strong>: a one-time token for a single server</summary>
    <div class="stack" style="margin-top: 14px">
      {#if auth.admin}
        <form class="stack" onsubmit={createToken}>
          <h3 style="font-size: 1rem">A one-time token</h3>
          <p class="secondary">Works once, for one server, and expires. Use it when you would rather not keep a reusable key.</p>
          <div class="form-grid">
            <div class="field">
              <div class="label-row"><label for="e-label">Label (optional)</label><Tip field="enroll.label" /></div>
              <input id="e-label" type="text" bind:value={label} placeholder="web03" autocomplete="off" />
            </div>
            <div class="field">
              <div class="label-row"><label for="e-ttl">Valid for</label><Tip field="enroll.ttl" /></div>
              <select id="e-ttl" bind:value={ttl}>
                {#each TTL_CHOICES as c (c.minutes)}<option value={c.minutes}>{c.label}</option>{/each}
              </select>
            </div>
          </div>
          {#if tokenError}<p class="form-error" role="alert">{tokenError}</p>{/if}
          <div><button class="btn" type="submit" disabled={tokenBusy}>Create one-time token</button></div>
        </form>
        {#if issued}
          {#key issued.id}
            <div class="stack" aria-live="polite">
              <div class="banner warn">
                This token is shown only now{issued.expiresAt ? ` and expires ${fmtDateTime(issued.expiresAt)}` : ''}. It works
                once; if it is lost or used, create another.
              </div>
              <AgentCommands token={issued.token} hub={pageHub} {localHub} {order} idPrefix="once" />
            </div>
          {/key}
        {/if}
      {/if}

    </div>
  </details>
</div>
</WithHelp>
