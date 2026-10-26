# Service Monitor UI

The web dashboard for [service-monitor](https://github.com/primelogiclabio/service-monitor): a static single-page app with no server of its own. It talks to the hub's REST API with a bearer token, or with none behind a sign-in proxy. A hub release carries a build of it inside its jar, so most people never run this repository.

## Stack

| | |
|---|---|
| Framework | Svelte 5, plain JavaScript |
| Build | Vite 6 on Node 20 or newer; static files with relative paths |
| Charts | uPlot |
| Tests | Vitest (logic and source checks in Node, no browser) |
| Talks to | the hub's `/api/v1`, and its optional WebSocket at `/api/v1/live` |
| CI | GitHub Actions: tests and build on Node 20 and 22, Ubuntu and Windows |

## What it shows

- **Dashboard:** one headline ("All systems operational" or "1 check down, 1 server offline"), summary tiles, and servers grouped by cluster with their problems. Filter by cluster, text or problems only.
- **Server:** status, OS, agent version, last seen and every check. A check opens to its history: a chart (CPU, memory and disk with warning and critical lines; response time for HTTP, TCP and ping) or a status strip, with a table view and 1h / 6h / 24h / 7d ranges.
- **Monitors:** every check on one page with filters. Admins add, edit, enable, disable, run and delete checks. A check that an agent declares in its own `checks.json` carries an "Agent file" tag and is changed there; the dashboard only lets you switch it off.
- **Add server:** gives the command for the agent side. Choose *Install a new agent* or *Enroll an installed agent*; a join key is made for you (24 hours, any number of servers), and one-time tokens and longer keys are under "Other ways".
- **Tokens:** create and revoke API tokens.
- **Help:** the panel beside Add server and Add check, the **i** beside each field, hover text, and a Help page.

**Live** (top right): the page asks the hub for the status every 5 seconds; switch Live on and the hub pushes changes over a WebSocket instead. It needs a hub with the live view and a load balancer that passes WebSocket upgrades, turns itself off after 5 minutes without activity, and falls back to normal refreshing if the connection drops, so nothing depends on it.

Status always has a shape and a word as well as a colour. Light and dark themes follow the system and can be overridden. The layout works on a phone.

## Sign-in

- **API token:** paste one from the hub (it prints an admin token on first start; `svcmon token create` makes more). ADMIN tokens change things, READ tokens only view. It is kept in `sessionStorage`, or `localStorage` if you tick "Remember this browser", and only ever sent to the hub in an `Authorization` header.
- **User name and password:** for the hub's own administrator account, on by default (the hub prints its password once at first start). The hub answers with an ordinary ADMIN token that ends after a few hours; the password is never kept. Repeated wrong attempts make the hub ask you to wait, and the page shows how long.
- **Behind a sign-in proxy:** where nginx and a gateway sign people in, the page never holds a token and shows no form while the proxy answers. It calls `<apiBase>/v1/...` on its own site, sending only the marker `headers` your proxy must require, and asks `GET <apiBase>/v1/me` who is signed in. No session (401) goes to `signInUrl` once; an account the proxy refuses (403) gets a page that says so. If nothing answers as the proxy, the page falls back to the token and password forms and says why. The hub's [reference](https://github.com/primelogiclabio/service-monitor/blob/main/docs/service-monitor-reference.md#sign-in-with-keycloak-or-another-openid-connect-provider) covers the proxy side.

Switch the proxy mode on where the page's settings live. In the hub jar that is `svcmon.ui.proxy` in the hub's `application.yml` (`enabled: true` uses the defaults below). For a copy of `dist/` hosted elsewhere it is `config.json` beside `index.html`, which needs no rebuild:

```json
{ "proxy": { "apiBase": "/web-api", "headers": { "X-Web-Client": "1" }, "signInUrl": "/oauth2/start", "signOutUrl": "/oauth2/sign_out" } }
```

`"proxy": true` means exactly those values and `"proxy": false` (the shipped file) means token sign-in. A wrong setting (an unknown key, an `Authorization` header, a `javascript:` address) is reported instead of being ignored. The file is public and holds no secrets.

## Develop

Needs Node 20 or newer and a running hub (see the main repository).

```bash
npm install
npm run dev          # http://localhost:5173, proxies /api to http://127.0.0.1:8080 (VITE_HUB_URL changes the hub)
npm test             # unit tests
```

To see it with something in it, start a **throwaway** hub and seed it with fake agents and six hours of history (never against a hub that monitors real systems):

```bash
java -jar service-monitor/hub/target/svcmon-hub-0.1.0-SNAPSHOT.jar --svcmon.data-dir=./demo-data --svcmon.agent-stale-seconds=25
node scripts/seed-demo.mjs --token <admin token printed by the hub> --live
```

## Build and host

```bash
npm run build        # writes dist/
```

`dist/` is plain static files, so it works from any folder or sub-path. Three ways to host it:

1. **Inside the hub jar** (what a release does): copy `dist/` to `hub/src/main/resources/ui` in the main repository before `mvn package`. One address for everything.
2. **From a folder the hub serves:** start the hub with `--svcmon.ui-dir=/path/to/dist`. Leave "Hub address" empty at sign-in.
3. **On its own host:** enter the hub's address under "Hub address" at sign-in and list this site's exact origin (for example `https://dashboard.example.com`, no path, no `*`) in the hub's `svcmon.cors-allowed-origins`. CORS is off until you set it. A load balancer that routes `/api` to the hub and everything else to a static server needs no setting at all.

The hub's settings are in its [reference](https://github.com/primelogiclabio/service-monitor/blob/main/docs/service-monitor-reference.md#host-the-web-ui).

## Layout

```text
src/lib/         api client, formatting, routing, auth/status/theme state, config.json reader
src/components/  status badge, charts, check table, forms, dialogs
src/views/       dashboard, server, monitors, add server, tokens, sign-in, proxy gate
public/          config.json (copied into dist/ as is)
scripts/         demo data seeder
test/            unit tests
```

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
