import { describe, expect, it } from 'vitest';
import { AGENT_ONLY_TYPES, CHECK_TYPES, chartKind } from '../src/lib/format.js';
import { TARGET_HELP, defToRequest } from '../src/lib/checks.js';
import { FIELD_HELP, typeHelp } from '../src/lib/help.js';

describe('container checks', () => {
  it('is a check type that only an agent can run', () => {
    expect(CHECK_TYPES).toContain('CONTAINER');
    expect(AGENT_ONLY_TYPES).toContain('CONTAINER');
    for (const type of AGENT_ONLY_TYPES) expect(CHECK_TYPES, type).toContain(type);
  });

  it('shows a status strip, not a chart', () => {
    expect(chartKind('CONTAINER')).toBeNull();
  });

  it('asks for the container name and points to the lister', () => {
    expect(TARGET_HELP.CONTAINER.label).toBe('Container name');
    expect(TARGET_HELP.CONTAINER.hint).toContain('svcmon agent containers');
    expect(typeHelp('CONTAINER')).toContain('svcmon agent containers');
  });

  it('explains the optional socket', () => {
    expect(FIELD_HELP['check.socket'].text).toContain('/var/run/docker.sock');
  });

  it('keeps the socket when a stored check is sent back to the hub', () => {
    const def = {
      name: 'web',
      type: 'CONTAINER',
      target: 'web',
      config: { socket: '/run/podman/podman.sock' },
      intervalSeconds: 30,
      timeoutMs: 5000,
      failuresBeforeDown: 2,
      runFrom: 'AGENT',
      serverId: 's1',
      enabled: true,
    };
    expect(defToRequest(def)).toMatchObject({ type: 'CONTAINER', target: 'web', config: { socket: '/run/podman/podman.sock' }, serverId: 's1' });
  });
});
