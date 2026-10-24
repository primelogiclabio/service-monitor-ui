<script>
  import { HELP, loadHelpOpen, saveHelpOpen } from '../lib/help.js';
  import HelpBody from './HelpBody.svelte';

  /**
   * Puts a help topic in a panel on the right of its content. A Help button at the top right opens it and its own
   * close button, also on the right, shuts it again; the choice is remembered per topic. With `bar` the button gets
   * a row of its own (for dialogs, where a floating button would cover the first field). On a narrow screen the
   * panel stacks above the content instead.
   */
  let { topic, bar = false, children } = $props();

  const title = $derived(HELP[topic]?.title ?? 'Help');
  const panelId = `help-panel-${topic}`;

  function store() {
    try {
      return localStorage;
    } catch {
      return null;
    }
  }

  let open = $state(loadHelpOpen(topic, store()));

  function toggle() {
    open = !open;
    saveHelpOpen(topic, open, store());
  }
</script>

<div class="with-help" class:open class:bar>
  {#if !open}
    <button class="btn small help-toggle" type="button" aria-expanded="false" aria-controls={panelId} onclick={toggle}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
        <path d="M6 6.2a2 2 0 1 1 3.1 1.7c-.7.5-1.1.8-1.1 1.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <circle cx="8" cy="11.8" r="0.9" fill="currentColor" />
      </svg>
      Help
    </button>
  {/if}
  <div class="with-help-main">{@render children?.()}</div>
  {#if open}
    <aside id={panelId} class="help-panel" aria-label="Help: {title.toLowerCase()}">
      <div class="help-panel-head">
        <h2>{title}</h2>
        <button class="btn small ghost" type="button" aria-expanded="true" aria-controls={panelId} aria-label="Close help" onclick={toggle}>
          Close ✕
        </button>
      </div>
      <HelpBody {topic} />
    </aside>
  {/if}
</div>
