<script>
  import { auth } from '../lib/auth.svelte.js';
  import { route, navigate } from '../lib/route.svelte.js';
  import { SETTINGS_SECTIONS, pickSection, sectionsFor } from '../lib/settings.js';
  import WithHelp from '../components/WithHelp.svelte';
  import AccountSettings from '../components/AccountSettings.svelte';
  import UserList from '../components/UserList.svelte';
  import AgentTokens from '../components/AgentTokens.svelte';
  import ApiTokens from '../components/ApiTokens.svelte';
  import AccessSettings from '../components/AccessSettings.svelte';
  import ActivityLog from '../components/ActivityLog.svelte';
  import ProviderSettings from '../components/ProviderSettings.svelte';

  const sections = $derived(sectionsFor(auth.admin));
  const section = $derived(pickSection(route.params.section, auth.admin));
  const helpTopic = $derived(SETTINGS_SECTIONS.find((s) => s.key === section).help);
</script>

<!-- Keyed so the Help button and panel follow the section. -->
{#key helpTopic}
<WithHelp topic={helpTopic}>
<div class="stack-lg">
  <div class="stack">
    <div>
      <h1 style="font-size: 1.75rem">Settings</h1>
      <p class="secondary" style="margin-top: 4px">
        {auth.admin
          ? 'Your account, the people who may sign in, the credentials of agents and scripts, who did what, how people sign in, and where the hub may be used from.'
          : 'Your account, where you are signed in, and where the hub may be used from.'}
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
  {:else if section === 'activity'}
    <ActivityLog />
  {:else if section === 'signin'}
    <ProviderSettings />
  {:else if section === 'access'}
    <AccessSettings />
  {:else}
    <AccountSettings />
  {/if}
</div>
</WithHelp>
{/key}
