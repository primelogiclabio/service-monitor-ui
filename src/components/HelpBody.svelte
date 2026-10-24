<script>
  import { HELP, parts } from '../lib/help.js';

  /** The text of one help topic: summary, steps, fields and notes. `heading` adds the topic's title above it. */
  let { topic, heading = false } = $props();

  const t = $derived(HELP[topic]);
</script>

{#snippet text(s)}{#each parts(s) as p}{#if p.code}<code>{p.text}</code>{:else}{p.text}{/if}{/each}{/snippet}

{#if t}
  <div class="help-body stack">
    {#if heading}<h2>{t.title}</h2>{/if}
    <p>{@render text(t.summary)}</p>
    {#if t.steps?.length}
      <ol>
        {#each t.steps as s}<li>{@render text(s)}</li>{/each}
      </ol>
    {/if}
    {#if t.fields?.length}
      <dl>
        {#each t.fields as f}
          <dt>{f.name}</dt>
          <dd>{@render text(f.text)}</dd>
        {/each}
      </dl>
    {/if}
    {#if t.notes?.length}
      <ul>
        {#each t.notes as n}<li>{@render text(n)}</li>{/each}
      </ul>
    {/if}
  </div>
{/if}
