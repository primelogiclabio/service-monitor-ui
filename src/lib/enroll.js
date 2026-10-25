// Building the agent install commands shown on the Add server page.

/** Choices for how long an enrollment token stays valid. The hub allows 1 minute to 24 hours. */
export const TTL_CHOICES = [
  { minutes: 15, label: '15 minutes' },
  { minutes: 60, label: '1 hour (default)' },
  { minutes: 1440, label: '1 day (longest)' },
];

/** When a join key stops working. The hub allows 1 to 3650 days, or none (until revoked). */
export const JOIN_EXPIRY_CHOICES = [
  { days: null, label: 'When revoked (no expiry)' },
  { days: 30, label: 'After 30 days' },
  { days: 90, label: 'After 90 days' },
  { days: 365, label: 'After 1 year' },
];

export const quote = (s) => (/[\s"']/.test(s) ? `"${s}"` : s);

export function isLoopbackHost(hostname) {
  const h = (hostname ?? '').toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h === '::1' || /^127(\.\d{1,3}){3}$/.test(h);
}

/**
 * The address the agent on the hub's own machine should use. When the dashboard was opened on a loopback
 * address the hub is on this machine, so the agent talks to it directly (127.0.0.1, same port). Any other
 * address (a host name, a load balancer) is kept as it is; the form lets it be changed.
 */
export function thisServerHub(origin) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    return origin ?? '';
  }
  if (!isLoopbackHost(url.hostname)) return url.origin;
  return `${url.protocol}//127.0.0.1${url.port ? `:${url.port}` : ''}`;
}

/** True when the page was opened on this machine's loopback address, so the browser and hub share a machine. */
export function pageIsOnTheHub(origin) {
  try {
    return isLoopbackHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/** 'windows' or 'unix' from a browser user agent; used only to show the likelier command first. */
export function guessPlatform(userAgent) {
  return /windows/i.test(userAgent ?? '') ? 'windows' : 'unix';
}

/** The install arguments; `placeholder` stands in for a token or join key not chosen yet. */
export function installArgs({ hub, token, cluster, placeholder = '<token>' }) {
  const c = (cluster ?? '').trim();
  return `--hub ${(hub ?? '').trim() || '<hub address>'} --token ${(token ?? '').trim() || placeholder}${c ? ` --cluster ${quote(c)}` : ''}`;
}

export function installCommands(opts) {
  const args = installArgs(opts);
  return { windows: `.\\svcmon.exe agent install ${args}`, unix: `sudo ./svcmon agent install ${args}` };
}

/** The agent's service on each system, as `svcmon agent install` registers it. */
export const AGENT_SERVICE = {
  windows: 'svcmon-agent',
  linux: 'svcmon-agent',
  macos: 'io.primelogiclab.svcmon.agent',
};

/**
 * For an agent that is already installed: register it with this hub (replacing whatever it was registered with)
 * and restart its service so it picks that up. `agent install` would refuse, since the service already exists.
 * The restart differs between Linux and macOS, so each gets its own lines.
 */
export function reconnectCommands(opts) {
  const args = installArgs(opts);
  return {
    windows: `.\\svcmon.exe agent enroll ${args}\nRestart-Service ${AGENT_SERVICE.windows}`,
    linux: `sudo ./svcmon agent enroll ${args}\nsudo systemctl restart ${AGENT_SERVICE.linux}`,
    macos: `sudo ./svcmon agent enroll ${args}\nsudo launchctl kickstart -k system/${AGENT_SERVICE.macos}`,
  };
}
