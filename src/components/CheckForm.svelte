<script>
  import { AGENT_ONLY_TYPES, CHECK_TYPES } from '../lib/format.js';
  import { TARGET_HELP, defaultThresholds } from '../lib/checks.js';
  import Help from './Help.svelte';

  let { servers = [], initial = null, presetServerId = '', busy = false, error = '', onsubmit, oncancel } = $props();

  // The form edits its own copy: starting values are read once, when the dialog opens.
  const start = (() => {
    const c = initial?.config ?? {};
    return {
      edit: initial != null,
      cfg: c,
      type: initial?.type ?? (presetServerId ? 'SERVICE' : 'HTTP'),
      name: initial?.name ?? '',
      target: initial?.target ?? '',
      serverId: initial?.serverId ?? presetServerId ?? '',
      runFrom: initial?.runFrom ?? (presetServerId ? 'AGENT' : 'HUB'),
      interval: initial?.intervalSeconds ?? (presetServerId ? 30 : 60),
      timeoutMs: initial?.timeoutMs ?? 5000,
      failures: initial?.failuresBeforeDown ?? 1,
      enabled: initial?.enabled ?? true,
    };
  })();
  const edit = start.edit;
  const cfg = start.cfg;

  let type = $state(start.type);
  let name = $state(start.name);
  let target = $state(start.target);
  let serverId = $state(start.serverId);
  let runFrom = $state(start.runFrom);
  let interval = $state(start.interval);
  let timeoutMs = $state(start.timeoutMs);
  let failures = $state(start.failures);
  let enabled = $state(start.enabled);
  let warn = $state(cfg.warn ?? '');
  let crit = $state(cfg.crit ?? '');
  let expectStatus = $state(cfg.expectStatus ?? '');
  let keyword = $state(cfg.keyword ?? '');
  let followRedirects = $state(cfg.followRedirects ?? true);
  let ignoreTls = $state(cfg.ignoreTls ?? false);
  let certWarnDays = $state(cfg.certWarnDays ?? '');
  let localError = $state('');
  let intervalTouched = edit;

  const agentOnly = $derived(AGENT_ONLY_TYPES.includes(type));
  const needsTarget = $derived(type !== 'CPU' && type !== 'MEMORY');
  const needsServer = $derived(agentOnly || runFrom === 'AGENT');
  const thresholdType = $derived(type === 'CPU' || type === 'MEMORY' || type === 'DISK');
  const help = $derived(TARGET_HELP[type]);
  const defaults = $derived(defaultThresholds(type));

  function changeType(e) {
    type = e.target.value;
    if (AGENT_ONLY_TYPES.includes(type)) runFrom = 'AGENT';
    else if (!edit) runFrom = serverId ? runFrom : 'HUB';
    if (!intervalTouched) interval = AGENT_ONLY_TYPES.includes(type) ? 30 : 60;
  }

  function submit(e) {
    e.preventDefault();
    localError = '';
    if (!name.trim()) return (localError = 'Give the check a name.');
    if (needsTarget && !target.trim()) return (localError = `${help?.label ?? 'Target'} is required.`);
    if (needsServer && !serverId) return (localError = 'Choose the server this check belongs to.');
    for (const [label, v, min, max] of [
      ['Interval', interval, 5, 86400],
      ['Timeout', timeoutMs, 100, 120000],
      ['Failures before down', failures, 1, 20],
    ]) {
      const n = Number(v);
      if (!Number.isFinite(n) || n < min || n > max) return (localError = `${label} must be between ${min} and ${max}.`);
    }

    const config = { ...cfg };
    const setOrDelete = (key, value) => {
      if (value === '' || value == null) delete config[key];
      else config[key] = value;
    };
    if (type === 'HTTP') {
      setOrDelete('expectStatus', expectStatus.trim());
      setOrDelete('keyword', keyword);
      setOrDelete('followRedirects', followRedirects ? null : false);
      setOrDelete('ignoreTls', ignoreTls ? true : null);
      setOrDelete('certWarnDays', certWarnDays === '' ? '' : Number(certWarnDays));
    }
    if (thresholdType) {
      setOrDelete('warn', warn === '' ? '' : Number(warn));
      setOrDelete('crit', crit === '' ? '' : Number(crit));
    }
    const body = {
      name: name.trim(),
      type,
      config,
      intervalSeconds: Number(interval),
      timeoutMs: Number(timeoutMs),
      failuresBeforeDown: Number(failures),
      runFrom,
      enabled,
    };
    if (needsTarget) body.target = target.trim();
    if (serverId) body.serverId = serverId;
    onsubmit(body);
  }
</script>

<form onsubmit={submit} class="stack" novalidate>
  {#if !edit}<Help topic="addCheck" />{/if}
  <div class="form-grid">
    <div class="field">
      <label for="cf-type">Type</label>
      <select id="cf-type" value={type} onchange={changeType} disabled={edit}>
        {#each CHECK_TYPES as t}<option value={t}>{t}</option>{/each}
      </select>
      {#if agentOnly}<span class="hint">Runs on the server's agent.</span>{/if}
    </div>
    <div class="field">
      <label for="cf-name">Name</label>
      <input id="cf-name" type="text" bind:value={name} maxlength="200" autocomplete="off" />
    </div>
  </div>

  {#if needsTarget}
    <div class="field">
      <label for="cf-target">{help?.label ?? 'Target'}</label>
      <input id="cf-target" type="text" bind:value={target} placeholder={help?.placeholder} autocomplete="off" spellcheck="false" />
      {#if help?.hint}<span class="hint">{help.hint}</span>{/if}
    </div>
  {/if}

  <div class="form-grid">
    <div class="field">
      <label for="cf-server">Server{needsServer ? '' : ' (optional)'}</label>
      <select id="cf-server" bind:value={serverId}>
        <option value="">{needsServer ? 'Choose a server' : 'None (hub-level check)'}</option>
        {#each servers as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
      </select>
    </div>
    {#if !agentOnly}
      <div class="field">
        <label for="cf-run">Runs from</label>
        <select id="cf-run" bind:value={runFrom}>
          <option value="HUB">The hub</option>
          <option value="AGENT">The server's agent</option>
        </select>
        <span class="hint">Run from the agent to test from that server's side of the network.</span>
      </div>
    {/if}
  </div>

  {#if type === 'HTTP'}
    <div class="form-grid">
      <div class="field">
        <label for="cf-status">Accepted status codes</label>
        <input id="cf-status" type="text" bind:value={expectStatus} placeholder="200-299" autocomplete="off" />
        <span class="hint">For example 200-299,301</span>
      </div>
      <div class="field">
        <label for="cf-keyword">Body must contain</label>
        <input id="cf-keyword" type="text" bind:value={keyword} autocomplete="off" />
      </div>
      <div class="field">
        <label for="cf-cert">Warn before certificate expires (days)</label>
        <input id="cf-cert" type="number" min="1" bind:value={certWarnDays} placeholder="14" />
      </div>
    </div>
    <div class="row" style="gap: 20px">
      <label class="check"><input type="checkbox" bind:checked={followRedirects} /> Follow redirects</label>
      <label class="check"><input type="checkbox" bind:checked={ignoreTls} /> Accept any TLS certificate</label>
    </div>
  {/if}

  {#if thresholdType}
    <div class="form-grid">
      <div class="field">
        <label for="cf-warn">Warning at (% used)</label>
        <input id="cf-warn" type="number" min="0" max="100" step="any" bind:value={warn} placeholder={String(defaults?.warn ?? '')} />
      </div>
      <div class="field">
        <label for="cf-crit">Down at (% used)</label>
        <input id="cf-crit" type="number" min="0" max="100" step="any" bind:value={crit} placeholder={String(defaults?.crit ?? '')} />
      </div>
    </div>
  {/if}

  <div class="form-grid">
    <div class="field">
      <label for="cf-interval">Every (seconds)</label>
      <input id="cf-interval" type="number" min="5" bind:value={interval} oninput={() => (intervalTouched = true)} />
    </div>
    <div class="field">
      <label for="cf-timeout">Timeout (ms)</label>
      <input id="cf-timeout" type="number" min="100" step="100" bind:value={timeoutMs} />
    </div>
    <div class="field">
      <label for="cf-failures">Failures before down</label>
      <input id="cf-failures" type="number" min="1" max="20" bind:value={failures} />
      <span class="hint">Avoids alerts for a single dropped packet.</span>
    </div>
  </div>

  <label class="check"><input type="checkbox" bind:checked={enabled} /> Enabled</label>

  {#if localError || error}<p class="form-error" role="alert">{localError || error}</p>{/if}

  <div class="actions">
    <button class="btn" type="button" onclick={oncancel} disabled={busy}>Cancel</button>
    <button class="btn primary" type="submit" disabled={busy}>{edit ? 'Save changes' : 'Add check'}</button>
  </div>
</form>
