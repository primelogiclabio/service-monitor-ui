# Service Monitor UI

The web dashboard for [service-monitor](https://github.com/primelogiclabio/service-monitor): a static single-page app with no server of its own. It talks to the hub's REST API on its own address and holds no credential: people sign in with a user name and password and the hub keeps them signed in with a cookie the page cannot read, or a sign-in proxy adds the credential. A hub release carries a build of it inside its jar, so most people never run this repository.

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
- **Settings:** change your password and end your other sign-ins. Administrators also add users and change their role, reset their password, disable or delete them; revoke an agent's credential or an unused one-time token; and revoke the API tokens the CLI uses.
- **Help:** the panel beside Add server and Add check, the **i** beside each field, hover text, and a Help page.

**Live** (top right): the page asks the hub for the status every 5 seconds; switch Live on and the hub pushes changes over a WebSocket instead. It needs a hub with the live view and a load balancer that passes WebSocket upgrades, turns itself off after 5 minutes without activity, and falls back to normal refreshing if the connection drops, so nothing depends on it.

Status always has a shape and a word as well as a colour. Light and dark themes follow the system and can be overridden. The layout works on a phone.

## Sign-in

- **User name and password:** every person has an account on the hub, as an administrator (changes anything) or read-only (looks, and changes only their own password). A new hub has the account `admin` with the password `admin`; it works only from the hub's internal network, and the dashboard asks for a new password straight away. The same goes for the temporary password an administrator gets when adding a user or resetting a password under **Settings**. The hub signs you in with an `HttpOnly` cookie, so this page never sees a credential and keeps nothing in browser storage; it sends `X-Svcmon-Request: 1` with every call, which the hub requires so other sites cannot use the cookie. A sign-in ends after a while without use (the page's own refreshing does not count) and the page then returns to the sign-in form. Repeated wrong attempts make the hub ask you to wait, and the page says how long.
- **The CLI and scripts** keep using API tokens (`svcmon token create`); Settings lists them for revoking. An older dashboard kept a token in browser storage; this one deletes it when it loads.
- **Behind a sign-in proxy:** where nginx and a gateway sign people in, the page never holds a token and shows no form while the proxy answers. It calls `<apiBase>/v1/...` on its own site, sending only the marker `headers` your proxy must require, and asks `GET <apiBase>/v1/me` who is signed in. No session (401) goes to `signInUrl` once; an account the proxy refuses (403) gets a page that says so. If nothing answers as the proxy, the page falls back to the password form and says why. The hub's [reference](https://github.com/primelogiclabio/service-monitor/blob/main/docs/service-monitor-reference.md#sign-in-with-keycloak-or-another-openid-connect-provider) covers the proxy side.

Switch the proxy mode on where the page's settings live. In the hub jar that is `svcmon.ui.proxy` in the hub's `application.yml` (`enabled: true` uses the defaults below). For a copy of `dist/` hosted elsewhere it is `config.json` beside `index.html`, which needs no rebuild:

```json
{ "proxy": { "apiBase": "/web-api", "headers": { "X-Web-Client": "1" }, "signInUrl": "/oauth2/start", "signOutUrl": "/oauth2/sign_out" } }
```

`"proxy": true` means exactly those values and `"proxy": false` (the shipped file) means the password sign-in. A wrong setting (an unknown key, an `Authorization` header, a `javascript:` address) is reported instead of being ignored. The file is public and holds no secrets.

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

`dist/` is plain static files, so it works from any folder or sub-path. The page always calls the hub at `/api` on its own address, since the sign-in cookie belongs to that address. Three ways to host it:

1. **Inside the hub jar** (what a release does): copy `dist/` to `hub/src/main/resources/ui` in the main repository before `mvn package`. One address for everything.
2. **From a folder the hub serves:** start the hub with `--svcmon.ui-dir=/path/to/dist`.
3. **From a static server behind the same address:** a load balancer that routes `/api` (WebSocket upgrades included, for Live) to the hub and everything else to the static server. A dashboard on a different address than the hub cannot sign in.

The hub's settings are in its [reference](https://github.com/primelogiclabio/service-monitor/blob/main/docs/service-monitor-reference.md#host-the-web-ui).

## Layout

```text
src/lib/         api client, formatting, routing, auth/status/theme state, config.json reader
src/components/  status badge, charts, check table, forms, dialogs
src/views/       dashboard, server, monitors, add server, settings, sign-in, password change, proxy gate
public/          config.json (copied into dist/ as is)
scripts/         demo data seeder
test/            unit tests
```

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
