# Service Monitor UI

The web dashboard for [service-monitor](https://github.com/primelogiclabio/service-monitor). It is a static single-page app (Svelte 5 + Vite) that talks to the hub's REST API with a bearer token. It has no server of its own.

## What it shows

- **Overview:** one headline ("All systems operational" / "1 check down, 1 server offline"), summary tiles, and servers grouped by cluster with their problems. Filter by cluster, text, or problems only.
- **Server:** status, OS, agent version, last seen, and every check. Open a check to see its history as a chart (CPU, memory and disk with warning and critical lines; response time for HTTP, TCP and ping) or a status strip for services. Each chart has a table view and a 1h / 6h / 24h / 7d range.
- **Checks:** every check across servers and the hub, with filters. Admins can add, edit, enable, disable, run and delete checks.
- **Add server:** creates a one-time enrollment token and shows the install command for Windows and for Linux/macOS.
- **Tokens:** create and revoke API tokens.

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

`dist/` is plain static files with relative paths, so it works from any folder or sub-path. Two ways to host it:

1. **Behind the same address as the hub** (for example a load balancer that routes `/api` to the hub and everything else to a static file server). No extra setup: leave "Hub URL" empty at sign-in.
2. **On its own host.** Enter the hub's address under "Hub address" at sign-in. The hub must then allow this site's origin (CORS); that setting is not in the hub yet.

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
