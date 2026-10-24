<script>
  import Modal from './Modal.svelte';

  let { title, message, confirmLabel = 'Delete', danger = true, onconfirm, oncancel } = $props();
  let busy = $state(false);

  async function go() {
    busy = true;
    try {
      await onconfirm();
    } finally {
      busy = false;
    }
  }
</script>

<Modal {title} onclose={oncancel}>
  <p class="secondary">{message}</p>
  <div class="actions">
    <button class="btn" type="button" onclick={oncancel} disabled={busy}>Cancel</button>
    <button class="btn {danger ? 'danger' : 'primary'}" type="button" onclick={go} disabled={busy}>{confirmLabel}</button>
  </div>
</Modal>
