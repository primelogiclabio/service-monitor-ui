<script>
  import HelpBody from '../components/HelpBody.svelte';
</script>

<div class="stack-lg" style="max-width: 820px">
  <div>
    <h1 style="font-size: 1.75rem">Help</h1>
    <p class="secondary" style="margin-top: 4px">
      How the dashboard's main tasks work. The same explanations open in a panel on the right of the forms they belong to,
      from the Help button.
    </p>
  </div>

  <section class="card"><HelpBody topic="addServer" heading /></section>
  <section class="card"><HelpBody topic="addCheck" heading /></section>

  <section class="card stack">
    <h2>Live view</h2>
    <p>
      The page normally asks the hub for the status every 5 seconds. Switch <strong>Live</strong> on (top right) and the hub
      pushes changes as they happen instead. It switches itself off after 5 minutes without activity and falls back to normal
      refreshing if the connection cannot be kept.
    </p>
  </section>

  <section class="card stack">
    <h2>Info icons</h2>
    <p>
      The small <strong>i</strong> beside a field explains it. Hover over it, focus it with the keyboard, or click or tap it to
      keep the note open; press Escape or click elsewhere to close it.
    </p>
  </section>
</div>
