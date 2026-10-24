<script>
  import Help from '../components/Help.svelte';
</script>

<div class="stack-lg" style="max-width: 820px">
  <div>
    <h1 style="font-size: 1.75rem">Help</h1>
    <p class="secondary" style="margin-top: 4px">
      How the dashboard's main tasks work. The same explanations appear next to the forms they belong to.
    </p>
  </div>

  <Help topic="addServer" open heading />
  <Help topic="addCheck" open heading />

  <section class="card stack">
    <h2>Live view</h2>
    <p>
      The page normally asks the hub for the status every 5 seconds. Switch <strong>Live</strong> on (top right) and the hub
      pushes changes as they happen instead. It switches itself off after 5 minutes without activity and falls back to normal
      refreshing if the connection cannot be kept.
    </p>
  </section>
</div>
