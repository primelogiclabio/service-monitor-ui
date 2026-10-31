// The text behind the Help panels and the Help page. Plain data, so one place holds every explanation.
// Backticks mark `code`; see parts().

/**
 * @typedef {{ title: string, summary: string, steps?: string[], fields?: { name: string, text: string }[], notes?: string[] }} Topic
 * @type {Record<string, Topic>}
 */
export const HELP = {
  dashboard: {
    title: 'The dashboard',
    summary:
      'How everything is doing at a glance. The headline gives the worst status anywhere, the tiles count servers and checks, and every server has a card under its cluster. Select a card to open the server.',
    fields: [
      { name: 'Up', text: 'The latest result is fine.' },
      { name: 'Warning', text: 'Over its warning threshold, a certificate about to expire, or a container that is starting or keeps restarting.' },
      { name: 'Down', text: 'Failed as many times in a row as the check allows (its "Failures before down").' },
      { name: 'Unknown', text: 'No result yet, or the check could not tell, for example when the agent may not read what it should test.' },
      { name: 'Disabled', text: 'Switched off: it keeps its history but does not run and does not count.' },
      { name: 'Offline', text: 'The server\'s agent has not reported for 90 seconds (the hub\'s `agent-stale-seconds`), so its checks are out of date.' },
    ],
    notes: [
      'A server shows the worst of its enabled checks, and Down when its agent is offline; a cluster shows its worst server.',
      'Cluster, Search and Problems only narrow the cards. A card lists the checks that are not up, or says how many pass.',
      '"Checks run by the hub" are checks that belong to no server, such as a website the hub tests from its own network.',
      'The page asks the hub for news every 5 seconds; the bottom of the page says when it last did. Live shows changes as they happen.',
      'Administrators see Add server, which registers a new server (see Adding a server).',
    ],
  },
  server: {
    title: 'A server\'s page',
    summary:
      'One server and its checks: its cluster, operating system, agent version, and when its agent last reported. Select a check\'s name to see its history and its buttons (see Monitors).',
    fields: [
      { name: 'Add check', text: 'A check for this server, with the server already chosen (see Adding a check).' },
      { name: 'Rename or move', text: 'Changes the name the hub shows and the cluster the server is grouped under. The agent and its checks carry on as before.' },
      { name: 'Remove', text: 'Deletes the server with its checks and history, and revokes its agent\'s credential. The agent stays installed on the machine until you uninstall it there with `svcmon agent uninstall`.' },
      { name: 'Time range for charts', text: 'How far back every chart on the page goes, from 1 hour to 7 days.' },
    ],
    notes: [
      'A red banner means the agent has gone quiet: check that the `svcmon-agent` service is running on the server and can reach the hub.',
      'Only the checks someone adds are run. On the server, `svcmon agent services` and `svcmon agent containers` list what could be checked.',
      'Read-only users see the same page without the buttons.',
    ],
  },
  monitors: {
    title: 'Monitors',
    summary:
      'Every check on the hub in one table, from every server and the hub itself. Narrow it down, then select a check\'s name to see its history and its buttons.',
    fields: [
      { name: 'Search, Cluster, Type, Show', text: 'Narrow the table. Show "Problems only" for checks that are not up, or "Disabled" for checks that are switched off.' },
      { name: 'Chart range', text: 'How far back the history of an opened check goes, from 1 hour to 7 days. CPU, memory and disk are drawn as percent used against their thresholds, HTTP, TCP and ping as response time, and service and container checks as a strip of results.' },
      { name: 'Reading', text: 'The latest measurement: response time, or percent used for CPU, memory and disk.' },
      { name: 'Agent file', text: 'The check comes from the server\'s own `checks.json`, so it is changed there (or with `svcmon agent check` on that server). Here you can view its settings and switch it off or on; to delete it, take it out of the file first. "Removed from agent file" means it was: it stays off, and Delete clears its history.' },
      { name: 'Run now', text: 'Runs a check that the hub runs straight away and records the result. Checks on an agent run on their own schedule.' },
      { name: 'Disable, Enable', text: 'Stops or restarts a check. Its history is kept, and it does not count while it is off.' },
      { name: 'Edit, Delete', text: 'Change the check\'s settings, or remove it with its history.' },
    ],
    notes: [
      'The hub keeps each result for 30 days (its `retention-days` setting).',
      'Administrators see Add check (see Adding a check) and the buttons; read-only users can look at everything.',
    ],
  },
  addServer: {
    title: 'Adding a server',
    summary:
      'Servers add themselves. Run one command on the server, with the small `svcmon` agent, and it registers with this hub on its own. The command is made for you here, with this hub\'s address and a join key already in it. The agent only connects out, so the server needs no open ports.',
    steps: [
      'Choose what the server needs: a new agent installed, or an agent that is already installed enrolled with this hub. The command is ready to copy, with the hub address and a join key filled in. Add a cluster if you want the server grouped (optional).',
      'A new agent: copy the `svcmon` program to the server (one file: the release file `svcmon-agent-<version>-<system>-<cpu>` for its system, renamed to `svcmon`, or one you built) and run the install command from its folder, in an elevated PowerShell on Windows or with `sudo` on Linux or macOS. It registers the server under its host name and starts the agent as a service.',
      'An agent that is already installed (registered with another hub, or removed from this one): run the enroll command, then restart the agent service; both lines are given for each system. It keeps its program and service and only changes which hub it reports to.',
      'The server shows up on the Dashboard within seconds. Nothing is monitored until you add checks: open the server and choose Add check.',
    ],
    notes: [
      'The join key in the command is made by the dashboard when you open the page. It works for 24 hours and registers any number of servers; "Make a new one" replaces it. Anyone holding it can add servers, so keep it like a password. If it leaks, revoke it under "Other ways"; servers it already registered keep working.',
      '"Other ways" has a join key that lasts longer (for a script or a team, optionally tied to one cluster) and a one-time token for a single server. A one-time token works once and expires after 1 hour unless you choose another time, 1 day at most. Unused tokens can be revoked under Settings, Agents.',
      'Registering gives the server its own permanent credential, kept in `agent.json` on that server; the join key or token is no longer needed afterwards.',
      'The command uses the address of this page for the hub. Choose Change beside it when that is not what the server should use: on the hub\'s own machine give the local address (a link fills it in), and if this page is reached through a load balancer give the hub\'s internal address.',
    ],
  },
  addCheck: {
    title: 'Adding a check',
    summary:
      'A check is one thing that is tested on a schedule: a web address that answers, a port that is open, a host that replies, a service or container that is running, or CPU, memory or disk staying under a limit. Nothing is monitored until someone adds it, here or in the server\'s own checks.json (a check from that file is tagged "Agent file" and is changed there, not here).',
    steps: [
      'Give it a name you will recognise in an alert.',
      'Choose the Type. The field beside it changes to match: fill in what to test (the address, host and port, service or container name, or drive).',
      'CPU, memory, disk, service and container checks belong to a server and run on its agent, so choose the server. HTTP, TCP and ping run from the hub unless you choose "The server\'s agent".',
      'The timing defaults suit most checks. Press Add check; its status appears within one interval.',
    ],
    fields: [
      { name: 'HTTP', text: 'Opens a URL. UP when the answer is in the accepted status codes (200-299 unless you change it) and the body contains the text you set, if any. Warns before the certificate expires. "Accept any TLS certificate" is for internal sites with a self-signed one.' },
      { name: 'TCP', text: 'Opens a connection to `host:port`, for example `db01:5432`. UP when it connects.' },
      { name: 'PING', text: 'Sends a ping to a host name or address. UP when it answers.' },
      { name: 'SERVICE', text: 'A Windows service, systemd unit or launchd label, by its service name. List what exists on the server with `svcmon agent services`.' },
      { name: 'CONTAINER', text: 'A Docker or Podman container, by its name. UP when it is running, and healthy if it has a health check; WARN while its health check is starting or it keeps restarting; DOWN when it is unhealthy, stopped or missing. List what exists on the server with `svcmon agent containers`. The agent reads the runtime\'s socket, so it needs root or the runtime\'s group (on Windows it uses Docker Desktop\'s pipe). Linux, macOS and Windows.' },
      { name: 'CPU, MEMORY, DISK', text: 'Percent used. Warning and Down thresholds default to 85 and 95 for CPU and memory, 80 and 90 for disk. Disk needs the drive or mount point, such as `C:\\` or `/var`.' },
      { name: 'Runs from', text: 'Where the test starts. The hub tests from its own network; the server\'s agent tests from that server\'s side, which shows whether the server itself can reach something.' },
      { name: 'Every (seconds)', text: 'How often the check runs, from 5 seconds up.' },
      { name: 'Timeout (ms)', text: 'How long to wait for an answer before the attempt counts as failed.' },
      { name: 'Failures before down', text: 'How many failed attempts in a row it takes to report DOWN. 1 reports at once; 2 or 3 avoids an alert for a single dropped packet.' },
      { name: 'Enabled', text: 'A disabled check keeps its history but does not run and does not count in the status.' },
    ],
    notes: [
      'A server is shown offline when its agent has not reported for 90 seconds (the hub\'s `agent-stale-seconds`).',
      'To test a check that the hub runs straight away, open it and choose Run now.',
    ],
  },
  account: {
    title: 'Your account',
    summary: 'Your password, and the browsers where you are signed in.',
    fields: [
      { name: 'Change your password', text: 'From 12 to 128 characters and not your user name. Changing it signs you out everywhere else.' },
      { name: 'Where you are signed in', text: 'Every browser signed in as you, with its address and when it was last used. End signs one out: use it for a browser you no longer use or do not recognise.' },
    ],
    notes: [
      'A sign-in ends after 60 minutes without use, and after 12 hours at most (the hub\'s `svcmon.sessions` settings). The dashboard refreshing itself does not count as use.',
      'Forgot your password? An administrator can give you a new temporary one under Users. If no administrator can sign in, someone on the hub\'s machine runs `java -jar svcmon-hub.jar users reset <name>`.',
    ],
  },
  users: {
    title: 'Users',
    summary: 'The people who may sign in to this dashboard, and what each may do. Only administrators see this page.',
    steps: [
      'Type a user name, choose a role and press Add user.',
      'The hub makes a temporary password and shows it once. Copy it and pass it on safely.',
      'The person signs in with it from the hub\'s internal network and chooses their own password straight away.',
    ],
    fields: [
      { name: 'Read only', text: 'Can look at the dashboard, servers, checks and Settings, Access, and change only their own password.' },
      { name: 'Administrator', text: 'Can also add and change servers and checks, manage users, and revoke tokens and agent credentials.' },
      { name: 'Status', text: 'Active; Must change password (still on a temporary one); or Disabled.' },
      { name: 'Reset password', text: 'Gives the user a new temporary password, shown once, and signs them out everywhere.' },
      { name: 'Disable, Enable', text: 'Disable signs the user out and stops them signing in, but keeps the account; Enable lets them back in.' },
      { name: 'Delete', text: 'Removes the account. What they did stays under Activity.' },
    ],
    notes: [
      'Changing someone\'s role signs them out, so the new role applies at once.',
      'Your own account is changed under Account, not here, and the hub always keeps at least one administrator.',
      'Agents, the `svcmon` command line and scripts do not use these accounts; they use tokens.',
    ],
  },
  agents: {
    title: 'Agent credentials',
    summary:
      'Every server\'s agent signs in to the hub with its own credential, made when it registered and kept in `agent.json` on that server. This page lists them, with when each server last reported. Only administrators see it.',
    fields: [
      { name: 'Revoke', text: 'Stops that agent reporting. The server stays, with its checks and history, but shows offline. To bring it back, remove the server on its page and enroll its agent again.' },
      { name: 'One-time tokens not used yet', text: 'Made under "Other ways" on the Add server page. Each can register one server until it expires; revoke one that is no longer needed.' },
    ],
    notes: [
      'Revoke a credential when the server, or its `agent.json`, may be in the wrong hands.',
      'Join keys, which register any number of servers, are kept on the Add server page.',
    ],
  },
  apiTokens: {
    title: 'API tokens',
    summary:
      'Tokens are for programs, not people: the `svcmon` command line and your own scripts use one to call the hub. People sign in with their own account instead. Only administrators see this page.',
    steps: [
      'On a computer that already has an admin token, run `svcmon token create --name "ops laptop" --scope read` (or `--scope admin`). It prints the new token once.',
      'Where the token will be used, run `svcmon login --hub <hub address> --token <token>`, which saves it for the `svcmon` commands; a script sends it as `Authorization: Bearer <token>`.',
    ],
    fields: [
      { name: 'Access', text: 'Read can look; Admin can also make changes.' },
      { name: 'Revoke', text: 'Anything using the token stops working at once. Only a hash is stored, so a lost token cannot be shown again: revoke it and make a new one.' },
      { name: 'The hub\'s own', text: '`bootstrap` and `initial-admin` are admin tokens the hub made when it was set up, `recovery-admin` one it made when started with `--svcmon.new-admin-token=true`. Revoke one that nothing uses any more.' },
    ],
    notes: [
      'A token works only from the hub\'s internal network (see Access).',
      'No admin token at hand? Start the hub once with `--svcmon.new-admin-token=true`: it prints a new one, once, in its console or service log.',
      '`svcmon` is one program with two jobs: the agent on a monitored server, and the command line anywhere (see The svcmon program).',
    ],
  },
  activity: {
    title: 'Activity',
    summary: 'The hub\'s record of who signed in and who changed what, newest first. Only administrators see it.',
    fields: [
      { name: 'Show', text: 'Everything; Sign-ins (signing in and out, refusals, password changes); or Changes (every add, change and delete).' },
      { name: 'Who, From', text: 'The user or token, and the address the request came from.' },
      { name: 'What, Outcome', text: 'What was done, and whether it worked or was refused. Hover over What to see the call the hub received.' },
    ],
    notes: [
      'Sign-ins are kept for 30 days and changes for a year, unless the hub\'s `svcmon.audit` settings say otherwise.',
      'It never holds a password, a token or what was sent. A user name nobody has is shown as unknown, because it may be a password typed in the wrong box.',
      'Agents reporting are not listed; only their registration is.',
    ],
  },
  access: {
    title: 'Access',
    summary:
      'Where this hub may be used from. Inside its internal network it always may. From outside, only people signed in over HTTPS, and only when the hub allows it.',
    fields: [
      { name: 'Internal network', text: 'The addresses that count as inside.' },
      { name: 'Public proxies', text: 'A proxy that people outside come through. A request from it counts as outside, so a proxy that forgets to pass on the visitor\'s address is refused rather than let in.' },
      { name: 'The banner', text: 'Whether this browser counts as inside or outside right now.' },
    ],
    notes: [
      'It is set in the hub\'s `application.yml` under `svcmon.access`, not here, and applies when the hub restarts.',
      'From outside, API tokens and first or temporary passwords never work.',
      'Agents are never refused for where they are.',
      'To check it, open this page from a phone on mobile data: it should say outside.',
    ],
  },
  svcmon: {
    title: 'The svcmon program',
    summary:
      '`svcmon` is one small program with two jobs. On a monitored server it runs as the agent; on any computer its other commands use the hub from a terminal, like this dashboard does.',
    fields: [
      { name: 'Agent commands', text: '`svcmon agent ...`, run on the server itself: `install`, `enroll`, `uninstall`, `services`, `containers`, and `check add|rm|list` for the server\'s own `checks.json`. The agent uses its own credential from `agent.json`.' },
      { name: 'Hub commands', text: '`svcmon status`, `svcmon check ...`, `svcmon alert ...`, `svcmon token ...` and more, from any computer that can reach the hub. They need an API token, saved once with `svcmon login`.' },
      { name: 'Alerts', text: 'Where the hub sends status changes (email, Slack, Discord or a webhook) is set up with `svcmon alert add`; `svcmon alert test` sends a test message. The dashboard has no alerts page yet.' },
    ],
    notes: ['`svcmon help` lists every command.'],
  },
  live: {
    title: 'Live view',
    summary:
      'The page normally asks the hub for the status every 5 seconds. Switch Live on (top right) and the hub pushes changes as they happen instead. It switches itself off after 5 minutes without activity, and falls back to normal refreshing if the connection cannot be kept.',
  },
  icons: {
    title: 'Info icons',
    summary:
      'The small i beside a field explains it. Hover over it, focus it with the keyboard, or click or tap it to keep the note open; press Escape or click elsewhere to close it.',
  },
};

/** The sections of the Help page, in page order: the jump menu lists them and each `id` is the section's element id. */
export const HELP_SECTIONS = [
  'dashboard',
  'server',
  'monitors',
  'addServer',
  'addCheck',
  'account',
  'users',
  'agents',
  'apiTokens',
  'activity',
  'access',
  'svcmon',
  'live',
  'icons',
].map((key) => ({ key, id: sectionId(HELP[key].title), label: HELP[key].title }));

/** "A server's page" -> "a-servers-page". */
function sectionId(title) {
  return title.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * One short explanation per form field, shown by the info icon (see Tip.svelte) next to the field's label.
 * The key is used as <Tip field="..." />; a test keeps every key used and every use defined.
 * @type {Record<string, { label: string, text: string }>}
 */
export const FIELD_HELP = {
  'check.type': {
    label: 'Type',
    text: "What to test. HTTP, TCP and PING can run from the hub; SERVICE, CONTAINER, CPU, MEMORY and DISK always run on a server's agent.",
  },
  'check.name': { label: 'Name', text: 'How the check is listed on the dashboard and named in alerts.' },
  'check.server': {
    label: 'Server',
    text: 'The server this check belongs to. Required for SERVICE, CONTAINER, CPU, MEMORY and DISK checks and whenever the check runs from an agent. Leave it empty for a check the hub runs on its own, such as a website.',
  },
  'check.runFrom': {
    label: 'Runs from',
    text: "Where the test starts. The hub tests from its own network; the server's agent tests from that server's side, which shows whether the server itself can reach something.",
  },
  'check.expectStatus': {
    label: 'Accepted status codes',
    text: 'The HTTP status codes that count as UP, for example `200-299` or `200,301-302`. Empty means 200-299.',
  },
  'check.keyword': {
    label: 'Body must contain',
    text: 'If set, the page must contain this text or the check is DOWN. Catches a page that answers 200 while showing an error.',
  },
  'check.certWarnDays': {
    label: 'Certificate warning',
    text: "Turns the check to WARN when the site's certificate expires within this many days. Empty means 14.",
  },
  'check.followRedirects': {
    label: 'Follow redirects',
    text: 'On: a redirect is followed and the final page is judged. Off: the redirect response itself is judged, so a 301 is only UP if you accept it above.',
  },
  'check.ignoreTls': {
    label: 'Accept any TLS certificate',
    text: 'Skips certificate and host name validation. Only for internal sites with a self-signed certificate; it also hides a genuine certificate problem.',
  },
  'check.socket': {
    label: 'Runtime socket',
    text: "Where Docker or Podman listens on the server, for example `/var/run/docker.sock`. Empty means the agent looks in the usual places (Docker's, and Podman's system and per-user sockets). Set it only when the runtime is somewhere unusual.",
  },
  'check.warn': {
    label: 'Warning at',
    text: 'Percent used at which the check turns WARN. Empty uses the default: 85 for CPU and memory, 80 for disk.',
  },
  'check.crit': {
    label: 'Down at',
    text: 'Percent used at which the check is DOWN. Empty uses the default: 95 for CPU and memory, 90 for disk.',
  },
  'check.interval': {
    label: 'Every',
    text: 'How often the check runs, in seconds (5 or more). Shorter means faster detection, more load and more history.',
  },
  'check.timeout': { label: 'Timeout', text: 'How long to wait for an answer, in milliseconds, before the attempt counts as failed.' },
  'check.failures': {
    label: 'Failures before down',
    text: 'How many failed attempts in a row it takes to report DOWN. 1 reports at once; 2 or 3 avoids an alert for a single dropped packet.',
  },
  'check.enabled': {
    label: 'Enabled',
    text: 'A disabled check keeps its history but does not run and does not count in the status.',
  },
  'enroll.label': {
    label: 'Label',
    text: 'A note on the token, shown under Settings, Agents until it is used. It does not name the server: the server uses its own host name unless you add `--name` to the command.',
  },
  'enroll.ttl': {
    label: 'Valid for',
    text: 'The token works once and then expires, so one that is lost or forgotten cannot be used later. Choose longer only if someone will run the command later.',
  },
  'enroll.hub': {
    label: 'Hub address',
    text: "How the server reaches the hub, from the server's side of the network. Use the hub's internal address if this page is reached through a load balancer. The server only connects out, so it needs no open ports.",
  },
  'enroll.cluster': {
    label: 'Cluster',
    text: 'A group name such as prod or staging; the Dashboard groups servers by it. Optional, and it can be changed later with Rename or move.',
  },
  'joinKey.paste': {
    label: 'Join key',
    text: 'A join key you saved when it was created. It only fills in the command on this page; it is not stored or sent anywhere.',
  },
  'joinKey.name': {
    label: 'Join key name',
    text: 'What the key is for, for example the group of servers it will add. Shown in the list so you know which one to revoke.',
  },
  'joinKey.cluster': {
    label: 'Join key cluster',
    text: 'If set, every server registered with this key goes in this cluster, and a server that asks for another one is refused. Leave empty to let each server choose.',
  },
  'joinKey.expiry': {
    label: 'Stops working',
    text: 'A join key works until you revoke it unless you pick a date here. Servers it registered keep working either way.',
  },
  'login.password': {
    label: 'Password',
    text: "Your password on this hub. A first or temporary password works only from the hub's internal network and has to be changed when you sign in with it. The password is sent to the hub and never stored in this browser.",
  },
  'password.new': {
    label: 'New password',
    text: 'From 12 to 128 characters and not your user name; any characters will do. A few unrelated words together are long and easy to remember. Your other sign-ins end when it changes.',
  },
  'user.name': {
    label: 'User name',
    text: 'What the person types to sign in: 1 to 64 letters, digits and . _ @ - (an email address works). Two users cannot share a name, whatever the case.',
  },
  'user.role': {
    label: 'Role',
    text: 'Read only can look at the dashboard, servers and checks but change nothing except their own password. Administrator can also change checks and servers, add servers, manage users and revoke tokens.',
  },
  'server.cluster': {
    label: 'Cluster',
    text: 'A group name such as prod or staging; the Dashboard groups servers by it. Leave empty for none.',
  },
};

/** The explanation of one check type from the Add check help, for the info icon beside the target field. */
export function typeHelp(type) {
  return HELP.addCheck.fields.find((f) => f.name.split(', ').includes(type))?.text ?? '';
}

const helpKey = (topic) => `sm-help-${topic}`;

/** Whether the help panel for a topic was left open. Storage can be missing or throw, so it just means closed. */
export function loadHelpOpen(topic, storage) {
  try {
    return storage?.getItem(helpKey(topic)) === '1';
  } catch {
    return false;
  }
}

export function saveHelpOpen(topic, open, storage) {
  try {
    storage?.setItem(helpKey(topic), open ? '1' : '0');
  } catch {
    // the panel still works; it just will not be remembered
  }
}

/** Splits "a `b` c" into text and code pieces, for rendering without injecting HTML. */
export function parts(text) {
  return text.split('`').map((piece, i) => ({ text: piece, code: i % 2 === 1 })).filter((p) => p.text !== '');
}
