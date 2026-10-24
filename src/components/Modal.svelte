<script>
  import { onMount } from 'svelte';

  let { title, onclose, children } = $props();
  let dialog;

  onMount(() => {
    const previous = document.activeElement;
    const first = dialog.querySelector('input, select, textarea, button:not([data-close])');
    (first ?? dialog).focus();
    return () => previous?.focus?.();
  });

  function keydown(e) {
    if (e.key === 'Escape') onclose();
    if (e.key !== 'Tab') return;
    // Keep focus inside the dialog.
    const items = [...dialog.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')];
    if (items.length === 0) return;
    const firstEl = items[0];
    const lastEl = items[items.length - 1];
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onmousedown={(e) => e.target === e.currentTarget && onclose()}>
  <div class="modal" role="dialog" aria-modal="true" aria-label={title} tabindex="-1" bind:this={dialog} onkeydown={keydown}>
    <h2>{title}</h2>
    {@render children?.()}
  </div>
</div>
