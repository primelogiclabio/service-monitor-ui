<script>
  import HelpBody from '../components/HelpBody.svelte';
  import PageNav from '../components/PageNav.svelte';
  import { HELP_SECTIONS } from '../lib/help.js';
</script>

<div class="stack-lg">
  <div>
    <h1 style="font-size: 1.75rem">Help</h1>
    <p class="secondary" style="margin-top: 4px">
      How each screen of the dashboard works. The same explanations open in a panel on the right of their screen, from its
      Help button.
    </p>
  </div>

  <div class="docs">
    <PageNav items={HELP_SECTIONS} />

    <div class="docs-main stack-lg">
      {#each HELP_SECTIONS as s (s.key)}
        <section class="card" id={s.id} tabindex="-1"><HelpBody topic={s.key} heading /></section>
      {/each}
    </div>
  </div>
</div>
