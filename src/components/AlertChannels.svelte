<script>
  import { onMount } from 'svelte';
  import { getApi } from '../lib/auth.svelte.js';
  import { notify } from '../lib/notify.svelte.js';
  import { ago, fmtDateTime } from '../lib/format.js';
  import { channelAction, channelState, channelTarget, sendsOnLabel, testOutcome, toggleBody, typeLabel } from '../lib/alerts.js';
  import StatusBadge from './StatusBadge.svelte';
  import Modal from './Modal.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import AlertChannelForm from './AlertChannelForm.svelte';

  let channels = $state([]);
  let loaded = $state(false);
  let error = $state('');

  // The open form: null when closed, { channel: null } to add, { channel } to edit.
  let form = $state(null);
  let busy = $state(false);
  let formError = $state('');
  // The channel whose test message is on its way.
  let testing = $state('');
  // The action waiting for its confirmation: { kind, channel }.
  let pending = $state(null);
  const switchedOn = $derived(channels.filter((c) => c.enabled).length);
  const dialog = $derived(
    pending ? channelAction(pending.kind, pending.channel, { lastOn: pending.channel.enabled && switchedOn === 1 }) : null,
  );

  async function load() {
    try {
      channels = (await getApi().alertChannels()).sort((a, b) => a.name.localeCompare(b.name));
      error = '';
    } catch (e) {
      error = e.message;
    } finally {
      loaded = true;
    }
  }
  onMount(load);

  function open(channel) {
    formError = '';
    form = { channel };
  }

  async function save(body) {
    const editing = form.channel;
    busy = true;
    formError = '';
    try {
      const saved = editing ? await getApi().replaceAlertChannel(editing.id, body) : await getApi().createAlertChannel(body);
      form = null;
      notify(editing ? `Saved ${saved.name}` : `Added ${saved.name}. Send a test to check it works.`, 'success');
      await load();
    } catch (e) {
      formError = e.message; // 409 says the name is taken; 400 says which setting is wrong
    } finally {
      busy = false;
    }
  }

  async function test(channel) {
    testing = channel.id;
    try {
      const outcome = testOutcome(channel, await getApi().testAlertChannel(channel.id));
      notify(outcome.message, outcome.kind);
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      testing = '';
      await load(); // the hub records the test's outcome on the channel
    }
  }

  async function enable(channel) {
    try {
      await getApi().replaceAlertChannel(channel.id, toggleBody(channel));
      notify(`${channel.name} is enabled`, 'success');
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      await load();
    }
  }

  async function confirm() {
    const { kind, channel } = pending;
    try {
      if (kind === 'delete') {
        await getApi().deleteAlertChannel(channel.id);
        notify(`Deleted ${channel.name}`, 'success');
      } else {
        await getApi().replaceAlertChannel(channel.id, toggleBody(channel));
        notify(`${channel.name} is disabled`, 'success');
      }
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      pending = null;
      await load();
    }
  }
</script>

<section class="card stack" aria-labelledby="alerts-h">
  <div class="row" style="justify-content: space-between; align-items: flex-start">
    <div>
      <h2 id="alerts-h">Alert channels</h2>
      <p class="secondary">
        Where the hub sends a message when a check changes status or a server's agent goes silent, and again when it
        recovers. Each channel chooses which statuses it hears about.
      </p>
    </div>
    <button class="btn primary" type="button" onclick={() => open(null)}>Add channel</button>
  </div>

  {#if !loaded}
    <p class="muted">Loading…</p>
  {:else if error}
    <p class="form-error" role="alert">{error}</p>
  {:else if channels.length === 0}
    <p class="muted">No alert channels yet, so nobody hears when something goes down. Add one, then send a test.</p>
  {:else}
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr><th>Name</th><th class="hide-sm">Sends on</th><th class="hide-sm">Last delivered</th><th>State</th><th></th></tr>
        </thead>
        <tbody>
          {#each channels as ch (ch.id)}
            {@const health = channelState(ch)}
            {@const target = channelTarget(ch)}
            <tr>
              <!-- The type goes with where it sends, under the name, so a phone has room for the actions. -->
              <td>{ch.name}<span class="target">{typeLabel(ch.type)}{target ? ` · ${target}` : ''}</span></td>
              <td class="hide-sm">{sendsOnLabel(ch.statuses)}</td>
              <td class="hide-sm" title={ch.lastSuccessAt ? fmtDateTime(ch.lastSuccessAt) : undefined}>{ago(ch.lastSuccessAt)}</td>
              <td>
                <StatusBadge status={health.status} label={health.label} />
                {#if health.detail}<span class="target">{health.detail}</span>{/if}
              </td>
              <td class="num">
                <div class="row" style="justify-content: flex-end">
                  <button class="btn small" type="button" disabled={testing === ch.id} onclick={() => test(ch)}>
                    {testing === ch.id ? 'Sending…' : 'Send test'}
                  </button>
                  <button class="btn small" type="button" onclick={() => open(ch)}>Edit</button>
                  {#if ch.enabled}
                    <button class="btn small" type="button" onclick={() => (pending = { kind: 'disable', channel: ch })}>Disable</button>
                  {:else}
                    <button class="btn small" type="button" onclick={() => enable(ch)}>Enable</button>
                  {/if}
                  <button class="btn small danger" type="button" onclick={() => (pending = { kind: 'delete', channel: ch })}>Delete</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

{#if form}
  <Modal title={form.channel ? `Edit ${form.channel.name}` : 'Add an alert channel'} onclose={() => (form = null)}>
    <AlertChannelForm initial={form.channel} {busy} error={formError} onsubmit={save} oncancel={() => (form = null)} />
  </Modal>
{/if}

{#if dialog}
  <ConfirmDialog
    title={dialog.title}
    message={dialog.message}
    confirmLabel={dialog.confirmLabel}
    danger={dialog.danger}
    onconfirm={confirm}
    oncancel={() => (pending = null)}
  />
{/if}
