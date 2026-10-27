<script>
  import { auth } from '../lib/auth.svelte.js';
  import { route, navigate } from '../lib/route.svelte.js';
  import { pickSection, sectionsFor } from '../lib/settings.js';
  import AccountSettings from '../components/AccountSettings.svelte';
  import UserList from '../components/UserList.svelte';
  import AgentTokens from '../components/AgentTokens.svelte';
  import ApiTokens from '../components/ApiTokens.svelte';

  const sections = $derived(sectionsFor(auth.admin));
  const section = $derived(pickSection(route.params.section, auth.admin));
</script>

<div class="stack-lg">
  <div class="stack">
    <div>
      <h1 style="font-size: 1.75rem">Settings</h1>
      <p class="secondary" style="margin-top: 4px">
        {auth.admin
          ? 'Your account, the people who may sign in, and the credentials of agents and scripts.'
          : 'Your account and where you are signed in.'}
      </p>
    </div>
    {#if sections.length > 1}
      <div class="segmented" role="group" aria-label="Settings section">
        {#each sections as s (s.key)}
          <button type="button" aria-pressed={section === s.key} onclick={() => navigate(`#/settings/${s.key}`)}>{s.label}</button>
        {/each}
      </div>
    {/if}
  </div>

  {#if section === 'users'}
    <UserList />
  {:else if section === 'agents'}
    <AgentTokens />
  {:else if section === 'api'}
    <ApiTokens />
  {:else}
    <AccountSettings />
  {/if}
</div>
