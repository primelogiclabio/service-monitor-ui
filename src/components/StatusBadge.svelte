<script>
  // Status is never shown by color alone: every state has its own shape and a text label.
  let { status = 'UNKNOWN', label = undefined, compact = false } = $props();

  const meta = {
    UP: { text: 'Up', color: 'var(--good)' },
    WARN: { text: 'Warning', color: 'var(--warning)' },
    DOWN: { text: 'Down', color: 'var(--critical)' },
    UNKNOWN: { text: 'Unknown', color: 'var(--unknown)' },
    OFF: { text: 'Disabled', color: 'var(--unknown)' },
    OFFLINE: { text: 'Offline', color: 'var(--critical)' },
  };
  const m = $derived(meta[status] ?? meta.UNKNOWN);
  const kind = $derived(status === 'OFFLINE' ? 'DOWN' : status);
</script>

<span class="badge" style="--c: {m.color}">
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    role={compact ? 'img' : undefined}
    aria-label={compact ? (label ?? m.text) : undefined}
    aria-hidden={compact ? undefined : 'true'}
  >
    {#if kind === 'UP'}
      <circle cx="8" cy="8" r="7" fill="var(--c)" />
      <path d="M4.6 8.3l2.3 2.3 4.5-4.8" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    {:else if kind === 'WARN'}
      <path d="M8 1.2 15.2 14H0.8z" fill="var(--c)" stroke="var(--c)" stroke-width="1.2" stroke-linejoin="round" />
      <path d="M8 6v3.6" stroke="#0b0b0b" stroke-width="1.8" stroke-linecap="round" />
      <circle cx="8" cy="11.8" r="1" fill="#0b0b0b" />
    {:else if kind === 'DOWN'}
      <rect x="1" y="1" width="14" height="14" rx="3.5" fill="var(--c)" />
      <path d="M5.2 5.2l5.6 5.6M10.8 5.2l-5.6 5.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round" />
    {:else if kind === 'OFF'}
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="var(--c)" stroke-width="1.6" />
      <path d="M3.6 12.4l8.8-8.8" stroke="var(--c)" stroke-width="1.6" stroke-linecap="round" />
    {:else}
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="var(--c)" stroke-width="1.6" stroke-dasharray="2.4 2" />
      <path d="M6.2 6.3a1.9 1.9 0 1 1 2.8 1.7c-.7.4-1 .8-1 1.5" fill="none" stroke="var(--c)" stroke-width="1.5" stroke-linecap="round" />
      <circle cx="8" cy="11.7" r="0.9" fill="var(--c)" />
    {/if}
  </svg>
  {#if !compact}<span>{label ?? m.text}</span>{/if}
</span>
