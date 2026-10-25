<script>
  import { onMount } from 'svelte';
  import { activeSection } from '../lib/pagenav.js';

  /**
   * A jump menu for a long page: one entry per section (`items` of { id, label }, ids of elements on the page).
   * It stays in view beside the page and marks the section being read. The links are buttons because the address
   * bar belongs to the router: "#some-id" would be taken as another page.
   */
  let { items, label = 'On this page' } = $props();

  let active = $state('');

  function update() {
    const tops = items.map((i) => ({ id: i.id, top: document.getElementById(i.id)?.getBoundingClientRect().top ?? Infinity }));
    const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    active = atEnd && window.scrollY > 0 ? items[items.length - 1].id : activeSection(tops, 96);
  }

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  };

  onMount(() => {
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  });

  function go(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
    active = id;
  }
</script>

<nav class="page-nav" aria-label={label}>
  <h2>{label}</h2>
  <ul>
    {#each items as item (item.id)}
      <li>
        <button type="button" aria-current={active === item.id ? 'location' : undefined} onclick={() => go(item.id)}>
          {item.label}
        </button>
      </li>
    {/each}
  </ul>
</nav>
