<script>
  import { onMount } from 'svelte';
  import { auth, logout, redirectEnded, restore, screen } from './lib/auth.svelte.js';
  import { status, startPolling, stopPolling } from './lib/status.svelte.js';
  import { live, toggleLive, stopLive } from './lib/live.svelte.js';
  import { route, startRouter } from './lib/route.svelte.js';
  import { theme, initTheme, cycleTheme } from './lib/theme.svelte.js';
  import { ago } from './lib/format.js';
  import Login from './views/Login.svelte';
  import ChangePassword from './views/ChangePassword.svelte';
  import ProxyGate from './views/ProxyGate.svelte';
  import Refused from './views/Refused.svelte';
  import Overview from './views/Overview.svelte';
  import Server from './views/Server.svelte';
  import Checks from './views/Checks.svelte';
  import Enroll from './views/Enroll.svelte';
  import Settings from './views/Settings.svelte';
  import Help from './views/Help.svelte';
  import Toasts from './components/Toasts.svelte';

  let ready = $state(false);
  let now = $state(Date.now());
  const view = $derived(screen(ready));

  onMount(() => {
    initTheme();
    startRouter();
    restore().finally(() => (ready = true));
    const t = setInterval(() => (now = Date.now()), 1000);
    const back = (e) => {
      if (e.persisted) redirectEnded();
    };
    window.addEventListener('pageshow', back);
    return () => {
      clearInterval(t);
      window.removeEventListener('pageshow', back);
    };
  });

  // Poll the hub while signed in. Live mode, if switched on, takes over from polling until it ends.
  $effect(() => {
    if (auth.signedIn) {
      startPolling();
      return () => {
        stopLive();
        stopPolling();
      };
    }
  });

  const nav = $derived([
    { name: 'overview', href: '#/', label: 'Dashboard' },
    { name: 'checks', href: '#/checks', label: 'Monitors' },
    { name: 'settings', href: '#/settings', label: 'Settings' },
    { name: 'help', href: '#/help', label: 'Help' },
  ]);
  // A server's page and Add server are reached from the dashboard, so the dashboard stays marked.
  const current = $derived(route.name === 'server' || route.name === 'enroll' ? 'overview' : route.name);
  const themeLabel = $derived({ system: 'Theme: auto', light: 'Theme: light', dark: 'Theme: dark' }[theme.pref]);
  const liveLabel = $derived({ off: 'Live: off', connecting: 'Live: connecting…', on: 'Live: on' }[live.state]);
</script>

{#if view === 'loading'}
  <div class="login"><p class="muted">Loading…</p></div>
{:else if view === 'gate'}
  <ProxyGate />
{:else if view === 'refused'}
  <Refused />
{:else if view === 'login'}
  <Login />
{:else if view === 'change-password'}
  <ChangePassword />
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
        <button class="btn small" type="button" onclick={logout}>Sign out</button>
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
    {:else if route.name === 'settings'}
      <Settings />
    {:else if route.name === 'help'}
      <Help />
    {:else}
      <Overview />
    {/if}
  </main>

  <footer class="site">
    <div class="container row between">
      <span>
        Hub {auth.hub?.version ?? ''}
        {#if auth.user}· {auth.user}{/if}
        · {auth.admin ? 'admin access' : 'read-only access'}
      </span>
      <span>
        {#if live.state === 'on'}Live{:else if status.updatedAt}Updated {ago(status.updatedAt, now)}{/if}
      </span>
    </div>
  </footer>
{/if}

<Toasts />
