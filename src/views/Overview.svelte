<script>
  import { status, refresh } from '../lib/status.svelte.js';
  import { auth } from '../lib/auth.svelte.js';
  import { ago, cleanMessage, headline, plural } from '../lib/format.js';
  import { serverHref } from '../lib/router.js';
  import StatusBadge from '../components/StatusBadge.svelte';
  import CheckTable from '../components/CheckTable.svelte';

  let cluster = $state('all');
  let query = $state('');
  let problemsOnly = $state(false);

  const data = $derived(status.data);
  const head = $derived(headline(data));
  const servers = $derived(data ? data.clusters.flatMap((c) => c.servers) : []);
  const offline = $derived(servers.filter((s) => !s.agentOnline).length);

  function serverMatches(s) {
    if (problemsOnly && s.status === 'UP') return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.os ?? '').toLowerCase().includes(q) ||
      s.checks.some((c) => c.name.toLowerCase().includes(q))
    );
  }

  const visible = $derived(
    data
      ? data.clusters
          .filter((c) => cluster === 'all' || c.name === cluster)
          .map((c) => ({ ...c, servers: c.servers.filter(serverMatches) }))
          .filter((c) => c.servers.length > 0)
      : [],
  );

  const hubChecks = $derived(
    data
      ? data.hubChecks.filter((c) => (!problemsOnly || c.status !== 'UP') && (!query.trim() || c.name.toLowerCase().includes(query.trim().toLowerCase())))
      : [],
  );

  function problems(s) {
    return s.checks.filter((c) => c.enabled && c.status !== 'UP').slice(0, 3);
  }
  function passing(s) {
    return s.checks.filter((c) => c.enabled && c.status === 'UP').length;
  }
</script>

<div class="stack-lg" class:stale={status.loading && !data}>
  {#if !data}
    <div class="hero"><div><h1>{head.text}…</h1></div></div>
  {:else}
    <section class="hero tone-{head.tone}" aria-live="polite">
      <StatusBadge status={head.tone} compact label={head.text} />
      <div>
        <h1>{head.text}</h1>
        <p class="sub">
          {servers.length - offline} of {servers.length} {plural(servers.length, 'server')} online ·
          {data.summary.checks.up + data.summary.checks.warn + data.summary.checks.down + data.summary.checks.unknown} checks
        </p>
      </div>
    </section>

    <section class="tiles" aria-label="Summary">
      <div class="tile"><div class="label">Servers online</div><div class="value">{servers.length - offline}<span class="muted" style="font-size: 1rem"> / {servers.length}</span></div></div>
      <div class="tile"><div class="label">Checks up</div><div class="value">{data.summary.checks.up}</div></div>
      <div class="tile"><div class="label">Warnings</div><div class="value">{data.summary.checks.warn}</div></div>
      <div class="tile"><div class="label">Checks down</div><div class="value">{data.summary.checks.down}</div></div>
      <div class="tile"><div class="label">Unknown</div><div class="value">{data.summary.checks.unknown}</div><div class="sub">No result yet</div></div>
    </section>

    <section class="filters" aria-label="Filters">
      <div class="field">
        <label for="f-cluster">Cluster</label>
        <select id="f-cluster" bind:value={cluster}>
          <option value="all">All clusters</option>
          {#each data.clusters as c (c.name)}<option value={c.name}>{c.name}</option>{/each}
        </select>
      </div>
      <div class="field" style="flex: 1 1 200px">
        <label for="f-q">Search</label>
        <input id="f-q" type="search" bind:value={query} placeholder="Server, OS or check name" />
      </div>
      <label class="check" style="min-height: 36px"><input type="checkbox" bind:checked={problemsOnly} /> Problems only</label>
    </section>

    {#if servers.length === 0 && data.hubChecks.length === 0}
      <div class="card empty">
        <h2>Nothing is monitored yet</h2>
        <p>Register a server with an agent, or add a check that the hub runs itself.</p>
        <p style="margin-top: 12px">
          {#if auth.admin}<a class="btn primary" href="#/enroll" style="display: inline-block; text-decoration: none">Add a server</a>{:else}Ask an admin to add one.{/if}
        </p>
      </div>
    {:else}
      {#each visible as c (c.name)}
        <section aria-labelledby="cl-{c.name}">
          <div class="cluster-head">
            <StatusBadge status={c.status} compact />
            <h2 id="cl-{c.name}">{c.name}</h2>
            <span class="muted small">{c.servers.length} {plural(c.servers.length, 'server')}</span>
          </div>
          <div class="cards">
            {#each c.servers as s (s.id)}
              <a class="server-card tone-{s.status}" href={serverHref(s.id)}>
                <div class="row between" style="flex-wrap: nowrap">
                  <span class="name">{s.name}</span>
                  <StatusBadge status={s.agentOnline ? s.status : 'OFFLINE'} />
                </div>
                <div class="small muted">
                  {s.os ?? 'Unknown OS'} · {s.agentOnline ? `seen ${ago(s.lastSeen)}` : `agent silent since ${ago(s.lastSeen)}`}
                </div>
                {#if problems(s).length}
                  <ul>
                    {#each problems(s) as p (p.id)}
                      <li><StatusBadge status={p.status} compact /> <span><strong>{p.name}</strong> <span class="secondary">{cleanMessage(p)}</span></span></li>
                    {/each}
                  </ul>
                {:else}
                  <div class="small secondary">{passing(s)} {plural(passing(s), 'check')} passing</div>
                {/if}
              </a>
            {/each}
          </div>
        </section>
      {/each}

      {#if visible.length === 0 && servers.length > 0}
        <p class="muted">No servers match these filters.</p>
      {/if}

      {#if hubChecks.length > 0 && cluster === 'all'}
        <section class="card flush" aria-labelledby="hub-checks">
          <div class="section-head" style="padding: 14px 16px 0">
            <h2 id="hub-checks">Checks run by the hub</h2>
          </div>
          <CheckTable checks={hubChecks} onchanged={refresh} />
        </section>
      {/if}
    {/if}
  {/if}
</div>
