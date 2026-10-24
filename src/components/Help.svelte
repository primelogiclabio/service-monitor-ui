<script>
  import { HELP, parts } from '../lib/help.js';

  /** A collapsible explanation of a page or form. `topic` is a key of HELP; `open` expands it at first. */
  let { topic, open = false, heading = false } = $props();

  const t = $derived(HELP[topic]);
</script>

{#snippet text(s)}{#each parts(s) as p}{#if p.code}<code>{p.text}</code>{:else}{p.text}{/if}{/each}{/snippet}

{#if t}
  <details class="help" {open}>
    <summary>
      {#if heading}<h2>{t.title}</h2>{:else}<span>Help: {t.title.toLowerCase()}</span>{/if}
    </summary>
    <div class="help-body stack">
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
  </details>
{/if}
