// The text behind the Help panels and the Help page. Plain data, so one place holds every explanation.
// Backticks mark `code`; see parts().

/**
 * @typedef {{ title: string, summary: string, steps?: string[], fields?: { name: string, text: string }[], notes?: string[] }} Topic
 * @type {Record<string, Topic>}
 */
export const HELP = {
  addServer: {
    title: 'Adding a server',
    summary:
      'A server is a machine running the small `svcmon` agent. The agent connects out to the hub, so the server needs no open ports. Enrolling it takes one command.',
    steps: [
      'Create a token here. Use "This server" for the machine the hub runs on, a join key for many servers (one command for all of them), or a one-time token for a single server.',
      'Copy the command and run it on the server, from the folder that holds `svcmon`: in an elevated PowerShell on Windows, with `sudo` on Linux or macOS.',
      'The server shows up on the Overview as soon as it connects.',
      'Nothing is monitored until you add checks for it: open the server and choose Add check.',
    ],
    notes: [
      'The token works once and then expires (after 1 hour unless you choose another time, 1 day at most). It lets a machine join your hub, so it should not stay valid if it is lost or forgotten. It is shown only when created; if you lose it or it is used, create another. Unused tokens can be revoked on the Tokens page.',
      'A join key is reusable: the same command registers any number of servers until you revoke it, and it can put them all in one cluster. Anyone holding it can add servers, so keep it like a password. Revoking it does not affect servers it already registered.',
      'Enrolling gives the server its own permanent credential, kept in `agent.json` on that server. You never handle it, and the one-time token is no longer needed afterwards.',
      'If this page is reached through a load balancer, give the server the hub\'s internal address instead.',
      'The `svcmon` program is one file. Build it as described in the README ("Build the agent and CLI") and copy it to the server.',
      'Agent already installed? See "Agent already installed?" below.',
    ],
  },
  addCheck: {
    title: 'Adding a check',
    summary:
      'A check is one thing that is tested on a schedule: a web address that answers, a port that is open, a host that replies, a service that is running, or CPU, memory or disk staying under a limit. Nothing is monitored until you add it.',
    steps: [
      'Choose the Type. The field under the name changes to match.',
      'Give it a name you will recognise in an alert.',
      'Say what to test (the address, host and port, service name or drive).',
      'CPU, memory, disk and service checks belong to a server and run on its agent, so choose the server. HTTP, TCP and ping run from the hub unless you choose "The server\'s agent".',
      'The timing defaults suit most checks. Press Add check; its status appears within one interval.',
    ],
    fields: [
      { name: 'HTTP', text: 'Opens a URL. UP when the answer is in the accepted status codes (200-299 unless you change it) and the body contains the text you set, if any. Warns before the certificate expires. "Accept any TLS certificate" is for internal sites with a self-signed one.' },
      { name: 'TCP', text: 'Opens a connection to `host:port`, for example `db01:5432`. UP when it connects.' },
      { name: 'PING', text: 'Sends a ping to a host name or address. UP when it answers.' },
      { name: 'SERVICE', text: 'A Windows service, systemd unit or launchd label, by its service name. List what exists on the server with `svcmon agent services`.' },
      { name: 'CPU, MEMORY, DISK', text: 'Percent used. Warning and Down thresholds default to 85 and 95 for CPU and memory, 80 and 90 for disk. Disk needs the drive or mount point, such as `C:\\` or `/var`.' },
      { name: 'Runs from', text: 'Where the test starts. The hub tests from its own network; the server\'s agent tests from that server\'s side, which shows whether the server itself can reach something.' },
      { name: 'Every (seconds)', text: 'How often the check runs, from 5 seconds up.' },
      { name: 'Timeout (ms)', text: 'How long to wait for an answer before the attempt counts as failed.' },
      { name: 'Failures before down', text: 'How many failed attempts in a row it takes to report DOWN. 1 reports at once; 2 or 3 avoids an alert for a single dropped packet.' },
      { name: 'Enabled', text: 'A disabled check keeps its history but does not run and does not count in the status.' },
    ],
    notes: [
      'A server is shown offline when its agent has not reported for 90 seconds (the hub\'s `agent-stale-seconds`).',
      'To test a check straight away, use Run on its row (hub checks).',
    ],
  },
};

/**
 * One short explanation per form field, shown by the info icon (see Tip.svelte) next to the field's label.
 * The key is used as <Tip field="..." />; a test keeps every key used and every use defined.
 * @type {Record<string, { label: string, text: string }>}
 */
export const FIELD_HELP = {
  'check.type': {
    label: 'Type',
    text: "What to test. HTTP, TCP and PING can run from the hub; SERVICE, CPU, MEMORY and DISK always run on a server's agent.",
  },
  'check.name': { label: 'Name', text: 'How the check is listed on the dashboard and named in alerts.' },
  'check.server': {
    label: 'Server',
    text: 'The server this check belongs to. Required for SERVICE, CPU, MEMORY and DISK checks and whenever the check runs from an agent. Leave it empty for a check the hub runs on its own, such as a website.',
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
    text: 'A note on the token, shown on the Tokens page. It does not name the server: the server uses its own host name unless you add `--name` to the command.',
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
    text: 'A group name such as prod or staging; the Overview groups servers by it. Optional, and it can be changed later with Rename or move.',
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
  'token.name': {
    label: 'What it is for',
    text: 'A note to help you decide later which token to revoke, for example the person, script or screen that uses it.',
  },
  'token.scope': {
    label: 'Access',
    text: 'Read only can look at everything but change nothing. Admin can also add and change checks and servers, manage alert channels and create tokens.',
  },
  'login.token': {
    label: 'API token',
    text: 'The hub prints an admin token once, when its database is first created. An admin can make more on the Tokens page or with `svcmon token create`.',
  },
  'login.hub': {
    label: 'Hub address',
    text: "Leave empty when the hub serves this page. Otherwise enter the hub's address; the hub must list this site in its `cors-allowed-origins` setting.",
  },
  'server.cluster': {
    label: 'Cluster',
    text: 'A group name such as prod or staging; the Overview groups servers by it. Leave empty for none.',
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
