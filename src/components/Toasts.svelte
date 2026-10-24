<script>
  import { toasts, dismiss } from '../lib/notify.svelte.js';
</script>

<div class="toasts" aria-live="polite">
  {#each toasts as t (t.id)}
    <div class="toast {t.kind}" role={t.kind === 'error' ? 'alert' : 'status'}>
      <div class="row between" style="flex-wrap: nowrap">
        <span>{t.message}</span>
        <button class="btn small ghost" type="button" aria-label="Dismiss" onclick={() => dismiss(t.id)}>✕</button>
      </div>
    </div>
  {/each}
</div>
