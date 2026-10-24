<script>
  import uPlot from 'uplot';
  import 'uplot/dist/uPlot.min.css';
  import { onDestroy, untrack } from 'svelte';
  import { theme } from '../lib/theme.svelte.js';
  import { fmtAxis, fmtClock, fmtDateTime, fmtValue, hexToRgba } from '../lib/format.js';

  // One series on one axis. Thresholds are drawn as solid hairlines with a text label.
  let { points = [], unit = '%', warn = null, crit = null, title = '', height = 170 } = $props();

  let host = $state();
  let showTable = $state(false);
  let plot = null;
  let tip = null;
  let observer = null;

  const enough = $derived(points.length >= 2);
  const latest = $derived(points.length ? points[points.length - 1] : null);

  function cssVar(name) {
    return getComputedStyle(host).getPropertyValue(name).trim();
  }

  function dataset() {
    return [points.map((p) => p.ts / 1000), points.map((p) => p.value)];
  }

  function destroy() {
    observer?.disconnect();
    observer = null;
    plot?.destroy();
    plot = null;
    tip = null;
  }

  function drawOverlays(u) {
    const ctx = u.ctx;
    const px = uPlot.pxRatio;
    const left = u.bbox.left;
    const right = u.bbox.left + u.bbox.width;
    const colors = u._svc;

    ctx.save();
    ctx.font = `${11 * px}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const lines = [
      [warn, colors.warning, 'warn'],
      [crit, colors.critical, 'crit'],
    ];
    // Labels sit in the right margin so they never cover the data; nudge one up if two are close.
    let lastLabelY = Infinity;
    for (const [value, color, name] of lines) {
      if (value == null || value < u.scales.y.min || value > u.scales.y.max) continue;
      const y = Math.round(u.valToPos(value, 'y', true));
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, Math.round(px));
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      const labelY = Math.min(y, lastLabelY - 13 * px);
      lastLabelY = labelY;
      ctx.fillStyle = colors.ink2;
      ctx.fillText(`${name} ${value}${unit === '%' ? '%' : ''}`, right + 6 * px, labelY);
    }

    // End marker: 8px dot with a 2px surface ring.
    const n = u.data[0].length;
    if (n > 0) {
      const x = u.valToPos(u.data[0][n - 1], 'x', true);
      const y = u.valToPos(u.data[1][n - 1], 'y', true);
      ctx.fillStyle = colors.surface;
      ctx.beginPath();
      ctx.arc(x, y, 6 * px, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.series;
      ctx.beginPath();
      ctx.arc(x, y, 4 * px, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function onCursor(u) {
    const i = u.cursor.idx;
    if (!tip) return;
    if (i == null || u.cursor.left < 0) {
      tip.hidden = true;
      return;
    }
    const ts = u.data[0][i] * 1000;
    const v = u.data[1][i];
    // Values from the hub are text-safe numbers, but the DOM is still built with textContent.
    const first = document.createElement('div');
    const key = document.createElement('span');
    key.className = 'key';
    const strong = document.createElement('strong');
    strong.textContent = fmtValue(v, unit);
    first.append(key, strong);
    const when = document.createElement('span');
    when.textContent = fmtDateTime(ts);
    tip.replaceChildren(first, when);
    tip.hidden = false;

    const over = u.over;
    const w = tip.offsetWidth;
    const x = Math.min(Math.max(u.cursor.left + 14, 0), Math.max(over.clientWidth - w, 0));
    const y = Math.max(u.valToPos(v, 'y') - tip.offsetHeight - 10, 0);
    tip.style.transform = `translate(${x}px, ${y}px)`;
  }

  function create() {
    destroy();
    if (!host || !enough) return;
    const series = cssVar('--series-1');
    const grid = cssVar('--grid');
    const muted = cssVar('--muted');
    const surface = cssVar('--surface');
    const data = untrack(dataset);

    const axisBase = {
      stroke: muted,
      grid: { stroke: grid, width: 1 },
      ticks: { show: false },
      font: '12px system-ui, sans-serif',
    };
    const opts = {
      width: Math.max(host.clientWidth, 120),
      height,
      padding: [10, 58, 0, 0],
      legend: { show: false },
      cursor: {
        x: true,
        y: false,
        drag: { x: false, y: false, setScale: false },
        points: { size: 8, width: 2, fill: series, stroke: surface },
      },
      scales: {
        x: { time: true },
        y: {
          range: (u, min, max) => (unit === '%' ? [0, 100] : [0, Math.max(max * 1.2, 1)]),
        },
      },
      axes: [
        { ...axisBase, size: 44 },
        { ...axisBase, size: 46, values: (u, vals) => vals.map((v) => fmtAxis(v, unit)) },
      ],
      series: [
        {},
        { stroke: series, width: 2, fill: hexToRgba(series, 0.1), points: { show: false } },
      ],
      hooks: {
        draw: [drawOverlays],
        setCursor: [onCursor],
      },
    };
    plot = new uPlot(opts, data, host);
    plot._svc = {
      series,
      surface,
      ink2: cssVar('--ink-2'),
      warning: cssVar('--warning'),
      critical: cssVar('--critical'),
    };
    tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.hidden = true;
    plot.over.appendChild(tip);

    observer = new ResizeObserver(() => {
      if (plot && host && Math.abs(host.clientWidth - plot.width) > 1) {
        plot.setSize({ width: Math.max(host.clientWidth, 120), height });
      }
    });
    observer.observe(host);
  }

  // Rebuild when the frame changes (theme, size, thresholds, enough data to draw).
  $effect(() => {
    host;
    enough;
    height;
    unit;
    warn;
    crit;
    theme.version;
    create();
    return destroy;
  });

  // Update in place when only the data changes.
  $effect(() => {
    const data = dataset();
    if (plot) plot.setData(data);
  });

  onDestroy(destroy);

  const rows = $derived(points.slice(-200).reverse());
</script>

<div class="chart-card">
  <div class="chart-head">
    <span class="title">{title}</span>
    <span class="row" style="gap: 10px">
      {#if latest}<span class="latest">{fmtValue(latest.value, unit)}</span>{/if}
      <button class="btn small ghost" type="button" aria-pressed={showTable} onclick={() => (showTable = !showTable)}>
        {showTable ? 'Hide table' : 'Table'}
      </button>
    </span>
  </div>

  {#if enough}
    <div class="chart-host" bind:this={host} role="img" aria-label="{title} over time, latest {latest ? fmtValue(latest.value, unit) : ''}"></div>
  {:else}
    <div class="chart-empty">Not enough data yet</div>
  {/if}

  {#if showTable}
    <div class="chart-table table-wrap">
      <table class="data">
        <thead><tr><th>Time</th><th class="num">{unit === '%' ? 'Used' : 'Latency'}</th></tr></thead>
        <tbody>
          {#each rows as p (p.ts)}
            <tr><td>{fmtClock(p.ts)}</td><td class="num">{fmtValue(p.value, unit)}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
