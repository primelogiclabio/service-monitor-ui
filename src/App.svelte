<script>
  import { onMount } from 'svelte';
  import { auth, restore, signOut } from './lib/auth.svelte.js';
  import { status, startPolling, stopPolling } from './lib/status.svelte.js';
  import { live, toggleLive, stopLive } from './lib/live.svelte.js';
  import { route, startRouter } from './lib/route.svelte.js';
  import { theme, initTheme, cycleTheme } from './lib/theme.svelte.js';
  import { ago } from './lib/format.js';
  import Login from './views/Login.svelte';
  import Overview from './views/Overview.svelte';
  import Server from './views/Server.svelte';
  import Checks from './views/Checks.svelte';
  import Enroll from './views/Enroll.svelte';
  import Tokens from './views/Tokens.svelte';
  import Toasts from './components/Toasts.svelte';

  let ready = $state(false);
  let now = $state(Date.now());

  onMount(() => {
    initTheme();
    startRouter();
    restore().finally(() => (ready = true));
    const t = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(t);
  });

  // Poll the hub while signed in. Live mode, if switched on, takes over from polling until it ends.
  $effect(() => {
    if (auth.token) {
      startPolling();
      return () => {
        stopLive();
        stopPolling();
      };
    }
  });

  const nav = $derived([
    { name: 'overview', href: '#/', label: 'Overview' },
    { name: 'checks', href: '#/checks', label: 'Checks' },
    { name: 'enroll', href: '#/enroll', label: 'Add server' },
    { name: 'tokens', href: '#/tokens', label: 'Tokens' },
  ]);
  const current = $derived(route.name === 'server' ? 'overview' : route.name);
  const themeLabel = $derived({ system: 'Theme: auto', light: 'Theme: light', dark: 'Theme: dark' }[theme.pref]);
  const liveLabel = $derived({ off: 'Live: off', connecting: 'Live: connecting…', on: 'Live: on' }[live.state]);
</script>

{#if !ready}
  <div class="login"><p class="muted">Loading…</p></div>
{:else if !auth.token}
  <Login />
{:else}
  <header class="topbar">
    <div class="container">
      <a class="brand" href="#/">Service Monitor</a>
      <nav class="nav grow" aria-label="Main">
        {#each nav as n (n.name)}
          <a href={n.href} aria-current={current === n.name ? 'page' : undefined}>{n.label}</a>
        {/each}
      </nav>
      <div class="row">
        <button
          class="btn small ghost live-toggle"
          class:on={live.state === 'on'}
          type="button"
          aria-pressed={live.state !== 'off'}
          title="The hub pushes changes as they happen instead of the page refreshing every few seconds. Switches itself off after 5 minutes without activity."
          onclick={toggleLive}
        >
          <span class="live-dot" aria-hidden="true"></span>{liveLabel}
        </button>
        <button class="btn small ghost" type="button" onclick={cycleTheme}>{themeLabel}</button>
        <button class="btn small" type="button" onclick={() => signOut()}>Sign out</button>
      </div>
    </div>
  </header>

  <main class="container" id="content">
    {#if status.error}
      <div class="banner error" role="alert" style="margin-bottom: 16px">
        Cannot reach the hub: {status.error}. Showing the last data received{status.updatedAt ? ` ${ago(status.updatedAt, now)}` : ''}.
      </div>
    {/if}
    {#if auth.hub?.runtimeWarning}
      <div class="banner warn" style="margin-bottom: 16px">{auth.hub.runtimeWarning}</div>
    {/if}

    {#if route.name === 'server'}
      {#key route.params.id}<Server id={route.params.id} />{/key}
    {:else if route.name === 'checks'}
      <Checks />
    {:else if route.name === 'enroll'}
      <Enroll />
    {:else if route.name === 'tokens'}
      <Tokens />
    {:else}
      <Overview />
    {/if}
  </main>

  <footer class="site">
    <div class="container row between">
      <span>
        Hub {auth.hub?.version ?? ''} · {auth.admin ? 'admin access' : 'read-only access'}
        {#if auth.hubUrl}· {auth.hubUrl}{/if}
      </span>
      <span>
        {#if live.state === 'on'}Live{:else if status.updatedAt}Updated {ago(status.updatedAt, now)}{/if}
      </span>
    </div>
  </footer>
{/if}

<Toasts />
