<script module>
  let counter = 0;
</script>

<script>
  import { FIELD_HELP, parts } from '../lib/help.js';
  import { placeTip } from '../lib/tip.js';

  /**
   * An info icon with a short explanation. `field` names an entry of FIELD_HELP; `text` and `label` give one
   * directly. Opens on hover and on keyboard focus, and stays open when clicked or tapped (click again, press
   * Escape or click elsewhere to close), so it works without a mouse and on touch screens.
   */
  let { field = '', text = '', label = '' } = $props();

  const entry = $derived(field ? FIELD_HELP[field] : null);
  const body = $derived(text || entry?.text || '');
  const subject = $derived(label || entry?.label || 'this field');
  const id = `tip-${++counter}`;

  let open = $state(false);
  let pinned = $state(false);
  let spot = $state({ left: 0, top: 0, width: 320, above: false });
  let button;
  let pop = $state();

  function place() {
    if (!button) return;
    const r = button.getBoundingClientRect();
    const height = pop?.offsetHeight ?? 120;
    spot = placeTip(r, { width: window.innerWidth, height: window.innerHeight }, { height });
  }

  function close() {
    pinned = false;
    open = false;
  }

  $effect(() => {
    if (!open) return;
    place();
    // Once it is drawn its real height is known; settle the position (it may flip above the icon).
    queueMicrotask(place);
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // close the note, not the dialog it sits in
      close();
    };
    const onDown = (e) => {
      if (!button?.contains(e.target)) close();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  });
</script>

{#if body}
  <span class="tip">
    <button
      bind:this={button}
      class="tip-btn"
      type="button"
      aria-label="About {subject}"
      aria-expanded={open}
      aria-describedby={open ? id : undefined}
      onmouseenter={() => (open = true)}
      onmouseleave={() => !pinned && (open = false)}
      onfocus={(e) => e.target.matches(':focus-visible') && (open = true)}
      onblur={() => !pinned && (open = false)}
      onclick={() => {
        pinned = !pinned;
        open = pinned;
      }}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
        <circle cx="8" cy="4.8" r="1" fill="currentColor" />
        <path d="M8 7.2v4.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
    </button>
    {#if open}
      <span
        {id}
        bind:this={pop}
        class="tip-pop"
        role="tooltip"
        style="left: {spot.left}px; width: {spot.width}px; {spot.above ? `bottom: ${window.innerHeight - spot.top}px` : `top: ${spot.top}px`}"
      >
        {#each parts(body) as p}{#if p.code}<code>{p.text}</code>{:else}{p.text}{/if}{/each}
      </span>
    {/if}
  </span>
{/if}
