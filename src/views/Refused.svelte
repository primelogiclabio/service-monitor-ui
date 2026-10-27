<script>
  import { auth, restore } from '../lib/auth.svelte.js';
  import { refusalText } from '../lib/access.js';
  import { theme, cycleTheme } from '../lib/theme.svelte.js';

  let busy = $state(false);
  const text = $derived(refusalText(auth.access));

  // The hub decides from the address it sees; after joining the VPN, say, asking again is all it takes.
  async function checkAgain() {
    busy = true;
    try {
      await restore();
    } finally {
      busy = false;
    }
  }
</script>

<div class="login">
  <div class="card stack">
    <div>
      <h1>Service Monitor</h1>
    </div>

    <div class="banner warn stack" role="alert">
      <strong>{text.title}</strong>
      <span>{text.detail}</span>
    </div>
    {#if text.where}<p class="secondary">{text.where}</p>{/if}
    {#if auth.error}<p class="form-error" role="status">{auth.error}</p>{/if}

    <button class="btn primary" type="button" onclick={checkAgain} disabled={busy}>{busy ? 'Checking…' : 'Check again'}</button>

    <div class="row between small muted">
      <span>This browser keeps no password or token.</span>
      <button class="btn small ghost" type="button" onclick={cycleTheme}>Theme: {theme.pref}</button>
    </div>
  </div>
</div>
