<script>
  import { status, refresh } from '../lib/status.svelte.js';
  import { auth, getApi } from '../lib/auth.svelte.js';
  import { notify } from '../lib/notify.svelte.js';
  import { RANGES, ago, fmtDateTime, plural } from '../lib/format.js';
  import StatusBadge from '../components/StatusBadge.svelte';
  import CheckTable from '../components/CheckTable.svelte';
  import CheckForm from '../components/CheckForm.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import Modal from '../components/Modal.svelte';

  let { id } = $props();

  let range = $state('6h');
  let adding = $state(false);
  let renaming = $state(false);
  let deleting = $state(false);
  let busy = $state(false);
  let formError = $state('');
  let newName = $state('');
  let newCluster = $state('');

  const found = $derived.by(() => {
    if (!status.data) return null;
    for (const c of status.data.clusters) {
      const s = c.servers.find((x) => x.id === id);
      if (s) return { server: s, cluster: c.name };
    }
    return null;
  });
  const server = $derived(found?.server ?? null);
  const allServers = $derived(status.data ? status.data.clusters.flatMap((c) => c.servers) : []);

  async function addCheck(body) {
    busy = true;
    formError = '';
    try {
      await getApi().createCheck({ ...body, serverId: id });
      adding = false;
      notify(`Added ${body.name}`, 'success');
      await refresh();
    } catch (e) {
      formError = e.message;
    } finally {
      busy = false;
    }
  }

  function startRename() {
    newName = server.name;
    newCluster = server.cluster ?? '';
    formError = '';
    renaming = true;
  }

  async function saveRename(e) {
    e.preventDefault();
    busy = true;
    formError = '';
    try {
      await getApi().updateServer(id, { name: newName, cluster: newCluster });
      renaming = false;
      notify('Server updated', 'success');
      await refresh();
    } catch (err) {
      formError = err.message;
    } finally {
      busy = false;
    }
  }

  async function removeServer() {
    try {
      await getApi().deleteServer(id);
      notify(`Removed ${server.name}`, 'success');
      location.hash = '#/';
      await refresh();
    } catch (e) {
      notify(e.message, 'error');
      deleting = false;
    }
  }
</script>

{#if !status.data}
  <p class="muted">Loading…</p>
{:else if !server}
  <div class="card empty">
    <h2>Server not found</h2>
    <p>It may have been removed.</p>
    <p style="margin-top: 12px"><a href="#/">Back to the overview</a></p>
  </div>
{:else}
  <div class="stack-lg">
    <div>
      <p class="small" style="margin-bottom: 8px"><a href="#/">← Overview</a></p>
      <div class="row between">
        <div class="row" style="gap: 14px">
          <StatusBadge status={server.agentOnline ? server.status : 'OFFLINE'} compact />
          <div>
            <h1 style="font-size: 1.75rem; overflow-wrap: anywhere">{server.name}</h1>
            <p class="small secondary">
              Cluster {found.cluster} · {server.os ?? 'Unknown OS'}{server.agentVersion ? ` · agent ${server.agentVersion}` : ''} ·
              {server.agentOnline ? 'online' : 'agent offline'}, last seen {ago(server.lastSeen)}
              {#if server.lastSeen}({fmtDateTime(server.lastSeen)}){/if}
            </p>
          </div>
        </div>
        {#if auth.admin}
          <div class="row">
            <button class="btn" type="button" onclick={() => { formError = ''; adding = true; }}>Add check</button>
            <button class="btn" type="button" onclick={startRename}>Rename or move</button>
            <button class="btn danger" type="button" onclick={() => (deleting = true)}>Remove</button>
          </div>
        {/if}
      </div>
    </div>

    {#if !server.agentOnline}
      <div class="banner error" role="status">
        The agent on this server has not reported recently, so its checks are out of date. Check that the <code>svcmon-agent</code> service is running and can reach the hub.
      </div>
    {/if}

    <section class="filters" aria-label="Time range">
      <div class="field">
        <span class="label" id="range-label">Time range for charts</span>
        <div class="segmented" role="group" aria-labelledby="range-label">
          {#each RANGES as r (r.key)}
            <button type="button" aria-pressed={range === r.key} onclick={() => (range = r.key)}>{r.label}</button>
          {/each}
        </div>
      </div>
    </section>

    <section class="card flush" aria-labelledby="checks-h">
      <div class="section-head" style="padding: 14px 16px 0">
        <h2 id="checks-h">{server.checks.length} {plural(server.checks.length, 'check')}</h2>
        <span class="small muted">Select a check to see its history</span>
      </div>
      {#if server.checks.length === 0}
        <div class="empty">
          <h2>Nothing is monitored on this server yet</h2>
          <p>Only the checks an admin adds are run. Use <code>svcmon agent services</code> on the server to list what exists.</p>
        </div>
      {:else}
        <CheckTable checks={server.checks} {range} onchanged={refresh} />
      {/if}
    </section>
  </div>

  {#if adding}
    <Modal title="Add a check to {server.name}" onclose={() => (adding = false)}>
      <CheckForm servers={allServers} presetServerId={id} {busy} error={formError} onsubmit={addCheck} oncancel={() => (adding = false)} />
    </Modal>
  {/if}

  {#if renaming}
    <Modal title="Rename or move" onclose={() => (renaming = false)}>
      <form class="stack" onsubmit={saveRename}>
        <div class="field">
          <label for="sv-name">Name</label>
          <input id="sv-name" type="text" bind:value={newName} />
        </div>
        <div class="field">
          <label for="sv-cluster">Cluster</label>
          <input id="sv-cluster" type="text" bind:value={newCluster} placeholder="default" />
          <span class="hint">Servers with the same cluster name are grouped together.</span>
        </div>
        {#if formError}<p class="form-error" role="alert">{formError}</p>{/if}
        <div class="actions">
          <button class="btn" type="button" onclick={() => (renaming = false)} disabled={busy}>Cancel</button>
          <button class="btn primary" type="submit" disabled={busy}>Save</button>
        </div>
      </form>
    </Modal>
  {/if}

  {#if deleting}
    <ConfirmDialog
      title="Remove server"
      message="Remove “{server.name}” and all of its checks and history? The agent will stop being accepted. This cannot be undone."
      confirmLabel="Remove"
      onconfirm={removeServer}
      oncancel={() => (deleting = false)}
    />
  {/if}
{/if}
