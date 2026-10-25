<script>
  import { onMount } from 'svelte';
  import { auth, getApi } from '../lib/auth.svelte.js';
  import { notify } from '../lib/notify.svelte.js';
  import { fmtDateTime } from '../lib/format.js';
  import { JOIN_EXPIRY_CHOICES, TTL_CHOICES, guessPlatform, pageIsOnTheHub, thisServerHub } from '../lib/enroll.js';
  import { addKeyFor } from '../lib/addKey.js';
  import AgentCommands from '../components/AgentCommands.svelte';
  import JoinKeyList from '../components/JoinKeyList.svelte';
  import WithHelp from '../components/WithHelp.svelte';
  import Tip from '../components/Tip.svelte';

  // The page's own address: where the hub is if the dashboard is served by it.
  const pageHub = auth.hubUrl || location.origin;
  const localHub = thisServerHub(pageHub);
  // When the browser is on the hub's machine its platform is the likelier one; otherwise Windows comes first.
  const order = pageIsOnTheHub(pageHub) && guessPlatform(navigator.userAgent) === 'unix' ? ['unix', 'windows'] : ['windows', 'unix'];

  // What the server needs: a new agent, or one that is already installed and only has to register here.
  let way = $state('new');
  let hub = $state(pageHub);
  let cluster = $state('');

  // The join key in the command. The dashboard makes a short-lived one for an admin; a key pasted or created
  // under "Other ways" takes its place.
  let auto = $state(null);
  let autoBusy = $state(false);
  let autoError = $state('');
  let pasted = $state('');
  let custom = $state(null);

  const pastedKey = $derived(pasted.trim());
  const key = $derived(pastedKey || custom?.token || auto?.token || '');
  const keyCluster = $derived(!pastedKey && custom?.cluster ? custom.cluster : null);

  async function makeKey(fresh = false) {
    if (!auth.admin) return;
    autoBusy = true;
    autoError = '';
    try {
      auto = await addKeyFor(getApi()).get({ fresh });
    } catch (err) {
      autoError = err.message;
    } finally {
      autoBusy = false;
    }
  }

  onMount(() => {
    makeKey();
  });

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied', 'success', 1800);
    } catch {
      notify('Copy failed; select the text and copy it by hand.', 'error');
    }
  }

  // Other ways: a join key that lasts longer.
  let keyName = $state('servers');
  let keyClusterInput = $state('');
  let expiry = $state('');
  let keyBusy = $state(false);
  let keyError = $state('');
  let listVersion = $state(0);

  async function createKey(e) {
    e.preventDefault();
    if (!keyName.trim()) return (keyError = 'Give the key a name.');
    keyBusy = true;
    keyError = '';
    try {
      const body = { name: keyName.trim() };
      if (keyClusterInput.trim()) body.cluster = keyClusterInput.trim();
      if (expiry !== '') body.expiresInDays = Number(expiry);
      custom = await getApi().createJoinKey(body);
      pasted = '';
      listVersion++;
    } catch (err) {
      keyError = err.message;
    } finally {
      keyBusy = false;
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
  <a class="btn back" href="#/">← Dashboard</a>
  <div>
    <h1 style="font-size: 1.75rem">Add a server</h1>
    <p class="secondary" style="margin-top: 4px">
      Servers add themselves. Choose what the server needs, then copy the command and run it there. It registers with this
      hub on its own and only connects out, so the server needs no open ports.
    </p>
  </div>

  <section class="card stack" aria-labelledby="add-way">
    <h2 id="add-way">What does the server need?</h2>
    <div class="segmented" role="group" aria-label="What does the server need?">
      <button type="button" aria-pressed={way === 'new'} onclick={() => (way = 'new')}>Install a new agent</button>
      <button type="button" aria-pressed={way === 'existing'} onclick={() => (way = 'existing')}>Enroll an installed agent</button>
    </div>
    {#if way === 'new'}
      <ol class="steps">
        <li>Copy the <code>svcmon</code> program to the server. It is one file; see the README, "Build the agent and CLI".</li>
        <li>Run the command below there, from the folder that holds it.</li>
      </ol>
    {:else}
      <p class="secondary">
        For a server that already runs the agent, for example one registered with another hub or removed from this one. Run
        the command below there; it keeps the agent's program and service and only changes which hub it reports to.
      </p>
    {/if}

    <AgentCommands
      token={key}
      placeholder="<join key>"
      bind:hub
      bind:cluster
      {localHub}
      {order}
      mode={way}
      fixedCluster={keyCluster}
      idPrefix="add"
    />

    <div aria-live="polite">
      {#if pastedKey}
        <p class="small muted">The command uses the join key you pasted under Other ways.</p>
      {:else if custom}
        <p class="small muted">The command uses the join key “{custom.name}” you created under Other ways.</p>
      {:else if auto}
        <p class="small muted">
          The command holds a join key the dashboard just made for it. It works for any number of servers{auto.expiresAt
            ? ` until ${fmtDateTime(auto.expiresAt)}`
            : ''}, so keep the command like a password.
          <button class="btn small ghost inline-link" type="button" disabled={autoBusy} onclick={() => makeKey(true)}>Make a new one</button>
        </p>
      {:else if autoError}
        <p class="form-error" role="alert">
          Could not make a join key: {autoError}
          <button class="btn small ghost inline-link" type="button" disabled={autoBusy} onclick={() => makeKey()}>Try again</button>
        </p>
      {:else if autoBusy}
        <p class="small muted">Preparing the command…</p>
      {:else if !auth.admin}
        <p class="small muted">Making the command needs an ADMIN token. Sign in with one, or paste a join key under Other ways.</p>
      {/if}
    </div>

    <p class="secondary">
      The server shows up on the <a href="#/">Dashboard</a> within seconds. Nothing is monitored until you add checks: open the
      server and choose Add check.
    </p>
  </section>

  <details class="card">
    <summary style="cursor: pointer"><strong>Other ways</strong>: your own join key, one that lasts longer, or a one-time token</summary>
    <div class="stack" style="margin-top: 14px">
      <div class="stack">
        <div class="field">
          <div class="label-row"><label for="jk-paste">Use a join key you already have</label><Tip field="joinKey.paste" /></div>
          <input id="jk-paste" type="text" bind:value={pasted} placeholder="svm_j_…" autocomplete="off" spellcheck="false" />
        </div>
      </div>

      {#if auth.admin}
        <form class="stack other-way" onsubmit={createKey}>
          <h3 style="font-size: 1rem">A join key that lasts longer</h3>
          <p class="secondary">
            One key works for any number of servers until it is revoked or expires. It is shown only when it is created, so
            save it somewhere safe; the command above then uses it.
          </p>
          <div class="form-grid">
            <div class="field">
              <div class="label-row"><label for="jk-name">Name</label><Tip field="joinKey.name" /></div>
              <input id="jk-name" type="text" bind:value={keyName} autocomplete="off" maxlength="100" />
            </div>
            <div class="field">
              <div class="label-row"><label for="jk-cluster">Cluster (optional)</label><Tip field="joinKey.cluster" /></div>
              <input id="jk-cluster" type="text" bind:value={keyClusterInput} placeholder="any" autocomplete="off" maxlength="100" />
            </div>
            <div class="field">
              <div class="label-row"><label for="jk-expiry">Stops working</label><Tip field="joinKey.expiry" /></div>
              <select id="jk-expiry" bind:value={expiry}>
                {#each JOIN_EXPIRY_CHOICES as c (c.label)}<option value={c.days ?? ''}>{c.label}</option>{/each}
              </select>
            </div>
          </div>
          {#if keyError}<p class="form-error" role="alert">{keyError}</p>{/if}
          <div><button class="btn" type="submit" disabled={keyBusy}>Create join key</button></div>
        </form>
        {#if custom}
          <div class="stack" aria-live="polite">
            <div class="banner warn">
              New join key “{custom.name}”. It is shown only now and works until you revoke it{custom.expiresAt
                ? ` or until ${fmtDateTime(custom.expiresAt)}`
                : ''}{custom.cluster ? `; it puts servers in cluster ${custom.cluster}` : ''}. Keep it like a password.
            </div>
            <div class="copybox">
              <pre>{custom.token}</pre>
              <button class="btn" type="button" onclick={() => copy(custom.token)}>Copy</button>
            </div>
          </div>
        {/if}
        <details>
          <summary class="small secondary" style="cursor: pointer">Join keys on this hub</summary>
          <div style="margin-top: 8px">
            <JoinKeyList version={listVersion} />
          </div>
        </details>

        <form class="stack other-way" onsubmit={createToken}>
          <h3 style="font-size: 1rem">A one-time token for a single server</h3>
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
              <AgentCommands token={issued.token} {hub} {localHub} {order} idPrefix="once" />
            </div>
          {/key}
        {/if}
      {:else}
        <p class="muted">Creating join keys and one-time tokens needs an ADMIN token.</p>
      {/if}
    </div>
  </details>
</div>
</WithHelp>
