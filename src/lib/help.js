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
      'Create a one-time token here. Use "This server" if the machine is the one the hub runs on, otherwise fill in the second form.',
      'Copy the command and run it on the server, from the folder that holds `svcmon`: in an elevated PowerShell on Windows, with `sudo` on Linux or macOS.',
      'The server shows up on the Overview as soon as it connects.',
      'Nothing is monitored until you add checks for it: open the server and choose Add check.',
    ],
    notes: [
      'The token works once and then expires (after 1 hour unless you choose another time, 1 day at most). It lets a machine join your hub, so it should not stay valid if it is lost or forgotten. It is shown only when created; if you lose it or it is used, create another. Unused tokens can be revoked on the Tokens page.',
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

/** Splits "a `b` c" into text and code pieces, for rendering without injecting HTML. */
export function parts(text) {
  return text.split('`').map((piece, i) => ({ text: piece, code: i % 2 === 1 })).filter((p) => p.text !== '');
}
