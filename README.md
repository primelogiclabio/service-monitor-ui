# Service Monitor UI

The web dashboard for [service-monitor](https://github.com/primelogiclabio/service-monitor). It is a static single-page app (Svelte 5 + Vite) that talks to the hub's REST API with a bearer token, or, behind a sign-in proxy, with no token at all. It has no server of its own.

## What it shows

- **Dashboard:** one headline ("All systems operational" / "1 check down, 1 server offline"), summary tiles, and servers grouped by cluster with their problems. Filter by cluster, text, or problems only. Admins get an **Add server** button here.
- **Server:** status, OS, agent version, last seen, and every check. Open a check to see its history as a chart (CPU, memory and disk with warning and critical lines; response time for HTTP, TCP and ping) or a status strip for services. Each chart has a table view and a 1h / 6h / 24h / 7d range.
- **Monitors:** every check across servers and the hub, with filters for cluster, type, state (problems or disabled) and text. Admins can add, edit, enable, disable, run and delete checks. A check that is down also gets a light red row, besides its red X.
- **Add server** (from the Dashboard): servers register themselves, so the page just gives you the command for the agent side. Choose **Install a new agent** (copy `svcmon` there and run the install command) or **Enroll an installed agent** (register an agent that is already installed with this hub and restart its service; the enroll and restart lines are given for Windows, Linux and macOS). The hub address and a join key are already in the command: the dashboard makes a join key for an admin when the page opens (it works for 24 hours and any number of servers, and "Make a new one" replaces it). The hub address can be changed (with a link to the local address for the hub's own machine) and a cluster can be set, which is optional. Then the server appears on the Dashboard; add checks. Under "Other ways": paste a join key you already have, create one that lasts longer (shown once; optionally only into one cluster and with an expiry; the hub's join keys are listed with how many servers each registered, and can be revoked), or make a one-time token for a single server (1 hour by default, 1 day at most).
- **Tokens:** create and revoke API tokens.
- **Help:** a Help button at the top right of Add server and of the Add check dialog opens a panel on the right that explains what to fill in (it closes from the right too, and remembers whether you left it open). The small **i** beside a field explains that field: hover over it, focus it with the keyboard, or click or tap it to keep it open, and press Escape to close it. Buttons and column headings have hover text, and the Help page in the top bar collects the topics, with a menu on the left that jumps between them and marks the one being read.

**Live switch** (top right): by default the page asks the hub for the status every 5 seconds. Switch Live on and the hub pushes changes over a WebSocket as they happen instead, with no refresh delay. It needs a hub that has the live view (see its README) and a load balancer that passes WebSocket upgrades. It switches itself off after 5 minutes without activity (mouse, keyboard, touch or scroll while the tab is shown), and goes back to normal refreshing on its own if the connection drops, the hub refuses it or is full, or the hub is too old to have it, so the dashboard never depends on it. The token is sent in the connection's first message, never in its address. Behind a sign-in proxy there is no token to send: the proxy adds the credential to the connection itself.

Status is always shown with a shape and a word as well as a colour. Light and dark themes follow the system setting and can be overridden. The layout works on a phone.

## Sign-in

Paste an API token from the hub (the hub prints an admin token on first start; `svcmon token create` makes more). An ADMIN token can change things; a READ token only views. The token is kept in `sessionStorage` (cleared when the tab closes), or in `localStorage` if you tick "Remember this browser". It is only ever sent to the hub, in an `Authorization` header.

The sign-in page also has **User name and password** for the hub's own administrator account (on by default in the hub; it prints the password once at first start, see its [README](https://github.com/primelogiclabio/service-monitor#local-admin-account)). The password goes to the hub once, which answers with an ordinary ADMIN token that ends after a few hours (12 by default); from then on it is a normal token session, and only that token is kept, never the password. After several wrong attempts the hub makes you wait, and the page shows how long. The last choice (password or token) is remembered in this browser. Where the hub has turned the account off, the page says so and the token form still works.

### Behind a sign-in proxy

For a deployment where nginx signs the user in (a gateway checks the session and the hub accepts the OpenID Connect token the proxy adds; see the hub's [README](https://github.com/primelogiclabio/service-monitor#sign-in-with-keycloak-or-another-openid-connect-provider)), the page never holds a token and shows no sign-in form while the proxy answers. Switch it on in `config.json`, which sits next to `index.html` in `dist/` and can be edited without rebuilding:

```json
{
  "proxy": {
    "apiBase": "/web-api",
    "headers": { "X-Web-Client": "1" },
    "signInUrl": "/oauth2/start",
    "signOutUrl": "/oauth2/sign_out"
  }
}
```

`"proxy": true` uses the values above; `"proxy": false` (the shipped file) or no file keeps the token sign-in. The page then:

- calls `<apiBase>/v1/...` on its own site (the hub's `/api/v1/...` with the proxy rewriting the path), sending only the `headers`, which your proxy must require before it turns the session into a token; it never sends `Authorization`;
- asks `GET <apiBase>/v1/me` who is signed in, and shows the name in the footer. No session (401) sends the visitor to `signInUrl?rd=<this page>` once (a second automatic redirect within 30 seconds shows a Sign in button instead, so a sign-in that does not take effect cannot loop); an account the proxy or hub refuses (403) gets a page that says so with a Sign out button. When nothing answers as the proxy (the hub opened on its own address, for instance through an SSH tunnel, a 404 or a page that is not JSON; a network error; or the proxy answering 5xx because its sign-in service is down), the page falls back to the token and password sign-in described above, says why, and offers Try single sign-in again. A token session started that way is kept in this browser as usual, and a reload resumes it while the proxy is still down. The password form only works where the hub is reached directly, since a public proxy normally hides `/api/v1/login`; the token form works anywhere `/api/` is open to hub tokens;
- shows the sign-in page again, without leaving the current page, when the session ends while it is open;
- leaves through `signOutUrl` on Sign out;
- opens the Live view's WebSocket at `/api/v1/live` on its own site with no first message; your proxy must add the credential to that upgrade request and pass `X-Forwarded-Host` and `X-Forwarded-Proto`, as the hub's README shows.

A wrong `config.json` (an unknown setting, an `Authorization` header, a `javascript:` address) is reported on the sign-in page instead of being ignored. The file is public and holds no secrets.

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

`dist/` is plain static files with relative paths, so it works from any folder or sub-path. Its `config.json` is the only file meant to be edited (see "Behind a sign-in proxy"). Three ways to host it:

1. **Let the hub serve it** (simplest, one address for everything). Start the hub with `--svcmon.ui-dir=/path/to/service-monitor-ui/dist` (or `svcmon.ui-dir` in its `application.yml`), open the hub's address, and leave "Hub address" empty at sign-in.
2. **Behind the same address as the hub** through a load balancer that routes `/api` to the hub and everything else to a static file server. No hub setting is needed; leave "Hub address" empty at sign-in.
3. **On its own host.** Enter the hub's address under "Hub address" at sign-in, and list this site's address in the hub's `svcmon.cors-allowed-origins` setting. It takes exact origins such as `https://dashboard.example.com` (no path, no trailing slash; `*` is refused and stops the hub from starting). CORS is off until you set it.

The hub's setting names are described in its [README](https://github.com/primelogiclabio/service-monitor#host-the-web-ui).

## Layout

```text
src/lib/         api client, formatting, routing, auth/status/theme state, config.json reader
src/components/  status badge, charts, check table, forms, dialogs
src/views/       dashboard (overview.svelte), server, monitors (checks.svelte), add server, tokens, sign-in, proxy gate
public/          config.json (copied into dist/ as is)
scripts/         demo data seeder
test/            unit tests
```

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
