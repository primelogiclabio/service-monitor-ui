# Service Monitor UI

The web dashboard for [service-monitor](https://github.com/primelogiclabio/service-monitor). It is a static single-page app (Svelte 5 + Vite) that talks to the hub's REST API with a bearer token. It has no server of its own.

## What it shows

- **Overview:** one headline ("All systems operational" / "1 check down, 1 server offline"), summary tiles, and servers grouped by cluster with their problems. Filter by cluster, text, or problems only.
- **Server:** status, OS, agent version, last seen, and every check. Open a check to see its history as a chart (CPU, memory and disk with warning and critical lines; response time for HTTP, TCP and ping) or a status strip for services. Each chart has a table view and a 1h / 6h / 24h / 7d range.
- **Checks:** every check across servers and the hub, with filters. Admins can add, edit, enable, disable, run and delete checks.
- **Add server:** "This server" makes a 10-minute token in one click and fills in the install command for the machine the hub runs on; other servers get a one-time token (1 hour by default, 1 day at most) and the command for Windows and for Linux/macOS. It also says what to do when the agent is already installed, the server was deleted, or a token is lost.
- **Tokens:** create and revoke API tokens.
- **Help:** a Help button at the top right of Add server and of the Add check dialog opens a panel on the right that explains what to fill in (it closes from the right too, and remembers whether you left it open). The small **i** beside a field explains that field: hover over it, focus it with the keyboard, or click or tap it to keep it open, and press Escape to close it. Buttons and column headings have hover text, and the Help page in the top bar collects the topics.

**Live switch** (top right): by default the page asks the hub for the status every 5 seconds. Switch Live on and the hub pushes changes over a WebSocket as they happen instead, with no refresh delay. It needs a hub that has the live view (see its README) and a load balancer that passes WebSocket upgrades. It switches itself off after 5 minutes without activity (mouse, keyboard, touch or scroll while the tab is shown), and goes back to normal refreshing on its own if the connection drops, the hub refuses it or is full, or the hub is too old to have it, so the dashboard never depends on it. The token is sent in the connection's first message, never in its address.

Status is always shown with a shape and a word as well as a colour. Light and dark themes follow the system setting and can be overridden. The layout works on a phone.

## Sign-in

Paste an API token from the hub (the hub prints an admin token on first start; `svcmon token create` makes more). An ADMIN token can change things; a READ token only views. The token is kept in `sessionStorage` (cleared when the tab closes), or in `localStorage` if you tick "Remember this browser". It is only ever sent to the hub, in an `Authorization` header.

## Develop

Needs Node 20 or newer. Run a hub (see the main repo), then:

```bash
npm install
npm run dev          # http://localhost:5173, proxies /api to http://127.0.0.1:8080
npm test             # unit tests
```

To use a different hub, set `VITE_HUB_URL`:

```bash
VITE_HUB_URL=http://hub.internal:8080 npm run dev
```

### Demo data

To see the dashboard with something in it, start a **throwaway** hub and seed it. The seed script registers fake agents and posts six hours of synthetic history through the normal agent protocol:

```bash
java -jar service-monitor/hub/target/svcmon-hub-0.1.0-SNAPSHOT.jar --svcmon.data-dir=./demo-data --svcmon.agent-stale-seconds=25
node scripts/seed-demo.mjs --token <admin token printed by the hub> --live
```

Never run it against a hub that monitors real systems.

## Build and host

```bash
npm run build        # writes dist/
```

`dist/` is plain static files with relative paths, so it works from any folder or sub-path. Three ways to host it:

1. **Let the hub serve it** (simplest, one address for everything). Start the hub with `--svcmon.ui-dir=/path/to/service-monitor-ui/dist` (or `svcmon.ui-dir` in its `application.yml`), open the hub's address, and leave "Hub address" empty at sign-in.
2. **Behind the same address as the hub** through a load balancer that routes `/api` to the hub and everything else to a static file server. No hub setting is needed; leave "Hub address" empty at sign-in.
3. **On its own host.** Enter the hub's address under "Hub address" at sign-in, and list this site's address in the hub's `svcmon.cors-allowed-origins` setting. It takes exact origins such as `https://dashboard.example.com` (no path, no trailing slash; `*` is refused and stops the hub from starting). CORS is off until you set it.

The hub's setting names are described in its [README](https://github.com/primelogiclabio/service-monitor#host-the-web-ui).

## Layout

```text
src/lib/         api client, formatting, routing, auth/status/theme state
src/components/  status badge, charts, check table, forms, dialogs
src/views/       overview, server, checks, add server, tokens, sign-in
scripts/         demo data seeder
test/            unit tests
```

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
