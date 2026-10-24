<script>
  import { untrack } from 'svelte';
  import { auth, getApi } from '../lib/auth.svelte.js';
  import { status } from '../lib/status.svelte.js';
  import { notify } from '../lib/notify.svelte.js';
  import { chartKind, rangeMs, toPoints, ago, fmtDateTime } from '../lib/format.js';
  import { defToRequest, thresholdsFor } from '../lib/checks.js';
  import MetricChart from './MetricChart.svelte';
  import StatusStrip from './StatusStrip.svelte';
  import Modal from './Modal.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import CheckForm from './CheckForm.svelte';

  let { check, range = '6h', onchanged } = $props();

  const LIMIT = 5000;
  let results = $state([]);
  let def = $state(null);
  let loadError = $state('');
  let loaded = $state(false);
  let editing = $state(false);
  let deleting = $state(false);
  let busy = $state(false);
  let formError = $state('');

  const kind = $derived(chartKind(check.type));
  const points = $derived(kind ? toPoints(results, kind.field) : []);
  const limits = $derived(thresholdsFor(check.type, def?.config));
  const title = $derived(
    { CPU: 'CPU used', MEMORY: 'Memory used', DISK: `Disk used (${check.target})`, HTTP: 'Response time', TCP: 'Connect time', PING: 'Round-trip time' }[check.type] ?? 'Results',
  );
  const servers = $derived(status.data ? status.data.clusters.flatMap((c) => c.servers) : []);

  async function load() {
    const api = getApi();
    if (!api) return;
    try {
      const since = Date.now() - rangeMs(range);
      const [rows, d] = await Promise.all([api.results(check.id, { since, limit: LIMIT }), api.check(check.id)]);
      results = rows;
      def = d;
      loadError = '';
    } catch (e) {
      loadError = e.message;
    } finally {
      loaded = true;
    }
  }

  // Reload when the check or range changes, and every 30 seconds while open.
  $effect(() => {
    check.id;
    range;
    untrack(load);
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  });

  async function runNow() {
    busy = true;
    try {
      const r = await getApi().runCheck(check.id);
      notify(`${check.name}: ${r.status}${r.message ? ` — ${r.message}` : ''}`, r.status === 'UP' ? 'success' : 'info');
      await load();
      onchanged?.();
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      busy = false;
    }
  }

  async function toggleEnabled() {
    busy = true;
    try {
      const current = def ?? (await getApi().check(check.id));
      await getApi().replaceCheck(check.id, defToRequest(current, { enabled: !current.enabled }));
      notify(`${check.name} ${current.enabled ? 'disabled' : 'enabled'}`, 'success');
      await load();
      onchanged?.();
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      busy = false;
    }
  }

  async function save(body) {
    busy = true;
    formError = '';
    try {
      await getApi().replaceCheck(check.id, body);
      editing = false;
      notify(`Saved ${body.name}`, 'success');
      await load();
      onchanged?.();
    } catch (e) {
      formError = e.message;
    } finally {
      busy = false;
    }
  }

  async function remove() {
    try {
      await getApi().deleteCheck(check.id);
      deleting = false;
      notify(`Deleted ${check.name}`, 'success');
      onchanged?.();
    } catch (e) {
      deleting = false;
      notify(e.message, 'error');
    }
  }
</script>

<div class="stack">
  <div class="row between">
    <p class="small secondary">
      Runs on {check.runFrom === 'HUB' ? 'the hub' : 'the server’s agent'}
      {#if def}· every {def.intervalSeconds}s · down after {def.failuresBeforeDown} {def.failuresBeforeDown === 1 ? 'failure' : 'failures'}{/if}
      {#if check.lastChange}· status changed {ago(check.lastChange)} ({fmtDateTime(check.lastChange)}){/if}
    </p>
    {#if auth.admin}
      <div class="row">
        {#if check.runFrom === 'HUB'}
          <button class="btn small" type="button" title="Run this check now and record the result" onclick={runNow} disabled={busy}>Run now</button>
        {/if}
        <button class="btn small" type="button" title={check.enabled ? 'Stop running this check; its history is kept' : 'Start running this check again'} onclick={toggleEnabled} disabled={busy}>{check.enabled ? 'Disable' : 'Enable'}</button>
        <button class="btn small" type="button" title="Change this check's settings" onclick={() => { formError = ''; editing = true; }} disabled={busy || !def}>Edit</button>
        <button class="btn small danger" type="button" title="Delete this check and its history" onclick={() => (deleting = true)} disabled={busy}>Delete</button>
      </div>
    {/if}
  </div>

  {#if loadError}
    <div class="banner error" role="alert">{loadError}</div>
  {/if}

  <div class:stale={!loaded}>
    {#if kind}
      <MetricChart {points} unit={kind.unit} warn={limits.warn} crit={limits.crit} {title} />
    {:else}
      <StatusStrip {results} />
    {/if}
  </div>
  {#if results.length >= LIMIT}
    <p class="small muted">Showing the latest {LIMIT} results; the hub returns at most that many per request.</p>
  {/if}
</div>

{#if editing && def}
  <Modal title="Edit check" onclose={() => (editing = false)}>
    <CheckForm {servers} initial={def} {busy} error={formError} onsubmit={save} oncancel={() => (editing = false)} />
  </Modal>
{/if}

{#if deleting}
  <ConfirmDialog
    title="Delete check"
    message="Delete “{check.name}” and its history? This cannot be undone."
    onconfirm={remove}
    oncancel={() => (deleting = false)}
  />
{/if}
