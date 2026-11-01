<script>
  import {
    ALERT_STATUSES,
    ALERT_TYPES,
    CHANNEL_NAME_MAX,
    EMAIL_FORMATS,
    MAX_HEADERS,
    SMTP_SECURITY,
    channelProblem,
    channelRequest,
    emptyForm,
    formFromChannel,
    storedSecrets,
  } from '../lib/alerts.js';
  import Tip from './Tip.svelte';

  let { initial = null, busy = false, error = '', onsubmit, oncancel } = $props();

  // The form edits its own copy: starting values are read once, when the dialog opens.
  const start = (() => ({ edit: initial != null, form: initial ? formFromChannel(initial) : emptyForm(), stored: storedSecrets(initial) }))();
  const edit = start.edit;
  const stored = start.stored;
  let form = $state(start.form);
  let localError = $state('');

  const URL_EXAMPLES = {
    SLACK: 'https://hooks.slack.com/services/…',
    DISCORD: 'https://discord.com/api/webhooks/…',
    WEBHOOK: 'https://alerts.internal/hook',
  };
  const keep = (masked) => (masked ? `Saved: ${masked}. Leave empty to keep it.` : '');

  function toggleStatus(value, on) {
    form.statuses = on ? [...form.statuses, value] : form.statuses.filter((s) => s !== value);
  }

  function submit(e) {
    e.preventDefault();
    localError = channelProblem(form, edit);
    if (localError) return;
    onsubmit(channelRequest(form, edit));
  }
</script>

<form onsubmit={submit} class="stack" novalidate>
  <div class="form-grid">
    <div class="field">
      <div class="label-row"><label for="ac-type">Type</label><Tip field="alert.type" /></div>
      <select id="ac-type" bind:value={form.type} disabled={edit}>
        {#each ALERT_TYPES as t (t.value)}<option value={t.value}>{t.label}</option>{/each}
      </select>
    </div>
    <div class="field">
      <div class="label-row"><label for="ac-name">Name</label><Tip field="alert.name" /></div>
      <input id="ac-name" type="text" bind:value={form.name} maxlength={CHANNEL_NAME_MAX} autocomplete="off" placeholder="ops" />
    </div>
  </div>

  <div class="field" role="group" aria-labelledby="ac-on">
    <div class="label-row"><span id="ac-on">Sends on</span><Tip field="alert.statuses" /></div>
    <div class="row" style="gap: 20px">
      {#each ALERT_STATUSES as s (s.value)}
        <label class="check">
          <input type="checkbox" checked={form.statuses.includes(s.value)} onchange={(e) => toggleStatus(s.value, e.currentTarget.checked)} />
          {s.label}
        </label>
      {/each}
    </div>
    <span class="hint">A check or server changing to one of these sends a message. Keep Up to hear when a problem ends.</span>
  </div>

  {#if form.type === 'EMAIL'}
    <div class="form-grid">
      <div class="field">
        <div class="label-row"><label for="ac-host">SMTP server</label><Tip field="alert.smtpHost" /></div>
        <input id="ac-host" type="text" bind:value={form.smtpHost} autocomplete="off" spellcheck="false" placeholder="smtp.example.com" />
      </div>
      <div class="field">
        <div class="label-row"><label for="ac-port">Port</label><Tip field="alert.smtpPort" /></div>
        <input id="ac-port" type="number" min="1" max="65535" bind:value={form.smtpPort} placeholder="587" />
      </div>
      <div class="field">
        <div class="label-row"><label for="ac-security">Security</label><Tip field="alert.security" /></div>
        <select id="ac-security" bind:value={form.security}>
          {#each SMTP_SECURITY as s (s.value)}<option value={s.value}>{s.label}</option>{/each}
        </select>
      </div>
    </div>
    <div class="form-grid">
      <div class="field">
        <div class="label-row"><label for="ac-user">SMTP user name (optional)</label><Tip field="alert.username" /></div>
        <input id="ac-user" type="text" bind:value={form.username} autocomplete="off" spellcheck="false" />
      </div>
      <div class="field">
        <div class="label-row"><label for="ac-pass">SMTP password{stored.password ? '' : ' (optional)'}</label><Tip field="alert.password" /></div>
        <input id="ac-pass" type="password" bind:value={form.password} autocomplete="new-password" placeholder={stored.password ? 'Saved. Leave empty to keep it.' : ''} />
      </div>
    </div>
    <div class="form-grid">
      <div class="field">
        <div class="label-row"><label for="ac-from">From</label><Tip field="alert.from" /></div>
        <input id="ac-from" type="text" inputmode="email" bind:value={form.from} autocomplete="off" spellcheck="false" placeholder="svcmon@example.com" />
      </div>
      <div class="field">
        <div class="label-row"><label for="ac-to">To</label><Tip field="alert.to" /></div>
        <input id="ac-to" type="text" bind:value={form.to} autocomplete="off" spellcheck="false" placeholder="ops@example.com, oncall@example.com" />
        <span class="hint">Up to 20 addresses, separated by commas.</span>
      </div>
      <div class="field">
        <div class="label-row"><label for="ac-format">Format</label><Tip field="alert.format" /></div>
        <select id="ac-format" bind:value={form.format}>
          {#each EMAIL_FORMATS as f (f.value)}<option value={f.value}>{f.label}</option>{/each}
        </select>
      </div>
    </div>
  {:else}
    <div class="field">
      <div class="label-row"><label for="ac-url">{form.type === 'WEBHOOK' ? 'URL' : 'Webhook URL'}</label><Tip field="alert.url" /></div>
      <input id="ac-url" type="text" bind:value={form.url} autocomplete="off" spellcheck="false" placeholder={edit ? keep(stored.url) : URL_EXAMPLES[form.type]} />
      <span class="hint">{edit ? 'Stored as a secret and shown masked. Type a new URL only to replace it.' : 'Stored as a secret: after saving it is shown masked.'}</span>
    </div>
  {/if}

  {#if form.type === 'WEBHOOK'}
    <div class="field">
      <div class="label-row"><label for="ac-secret">Signing secret (optional)</label><Tip field="alert.signingSecret" /></div>
      <input id="ac-secret" type="password" bind:value={form.signingSecret} autocomplete="new-password" placeholder={stored.signingSecret ? 'Saved. Leave empty to keep it.' : ''} />
    </div>
    <div class="field" role="group" aria-labelledby="ac-headers">
      <div class="label-row"><span id="ac-headers">Headers (optional)</span><Tip field="alert.headers" /></div>
      {#each form.headers as h, i (i)}
        <div class="row" style="gap: 8px; flex-wrap: nowrap">
          <input type="text" bind:value={h.name} aria-label="Header {i + 1} name" placeholder="Authorization" autocomplete="off" spellcheck="false" maxlength="64" />
          <input
            type="password"
            bind:value={h.value}
            aria-label="Header {i + 1} value"
            autocomplete="new-password"
            placeholder={edit && h.original && h.original === h.name.trim() ? 'Saved. Leave empty to keep it.' : 'Value'}
          />
          <button class="btn small" type="button" onclick={() => form.headers.splice(i, 1)} aria-label="Remove header {i + 1}">Remove</button>
        </div>
      {/each}
      <div>
        <button class="btn small" type="button" disabled={form.headers.length >= MAX_HEADERS} onclick={() => form.headers.push({ name: '', value: '', original: '' })}>
          Add header
        </button>
      </div>
    </div>
  {/if}

  <span class="check">
    <label class="check"><input type="checkbox" bind:checked={form.enabled} /> Enabled</label>
    <Tip field="alert.enabled" />
  </span>

  {#if localError || error}<p class="form-error" role="alert">{localError || error}</p>{/if}

  <div class="actions">
    <button class="btn" type="button" onclick={oncancel} disabled={busy}>Cancel</button>
    <button class="btn primary" type="submit" disabled={busy}>{edit ? 'Save changes' : 'Add channel'}</button>
  </div>
</form>
