import { describe, expect, it } from 'vitest';
import { HELP, parts } from '../src/lib/help.js';
import { CHECK_TYPES } from '../src/lib/format.js';
import { defaultThresholds } from '../src/lib/checks.js';
import {
  THIS_SERVER_TTL_MINUTES,
  TTL_CHOICES,
  guessPlatform,
  installArgs,
  installCommands,
  isLoopbackHost,
  pageIsOnTheHub,
  thisServerHub,
} from '../src/lib/enroll.js';

const allText = (topic) =>
  [topic.summary, ...(topic.steps ?? []), ...(topic.notes ?? []), ...(topic.fields ?? []).flatMap((f) => [f.name, f.text])];

describe('help topics', () => {
  it('are complete and mark code in pairs', () => {
    for (const [key, topic] of Object.entries(HELP)) {
      expect(topic.title, key).toBeTruthy();
      expect(topic.summary, key).toBeTruthy();
      for (const text of allText(topic)) {
        expect((text.match(/`/g) ?? []).length % 2, `${key}: ${text}`).toBe(0);
      }
    }
    expect(HELP.addServer.steps.length).toBeGreaterThan(2);
    expect(HELP.addCheck.steps.length).toBeGreaterThan(2);
  });

  it('explain every check type the form offers', () => {
    const names = HELP.addCheck.fields.map((f) => f.name).join(' ');
    for (const type of CHECK_TYPES) expect(names, type).toContain(type);
  });

  it('quote the same default thresholds the agent applies', () => {
    const text = HELP.addCheck.fields.map((f) => f.text).join(' ');
    const cpu = defaultThresholds('CPU');
    const disk = defaultThresholds('DISK');
    expect(text).toContain(`${cpu.warn} and ${cpu.crit} for CPU and memory`);
    expect(text).toContain(`${disk.warn} and ${disk.crit} for disk`);
  });

  it('say how long a token lives and why', () => {
    const notes = HELP.addServer.notes.join(' ');
    expect(notes).toContain('1 hour');
    expect(notes).toContain('1 day');
    expect(notes).toContain('Tokens page');
  });

  it('split text into plain and code pieces without keeping markup', () => {
    expect(parts('run `svcmon agent install` now')).toEqual([
      { text: 'run ', code: false },
      { text: 'svcmon agent install', code: true },
      { text: ' now', code: false },
    ]);
    expect(parts('plain')).toEqual([{ text: 'plain', code: false }]);
    expect(parts('<b>x</b>')[0].text).toBe('<b>x</b>');
  });
});

describe('token lifetime choices', () => {
  it('stay within what the hub accepts and include the 1 hour default', () => {
    for (const c of TTL_CHOICES) {
      expect(c.minutes).toBeGreaterThanOrEqual(1);
      expect(c.minutes).toBeLessThanOrEqual(1440);
    }
    expect(TTL_CHOICES.map((c) => c.minutes)).toContain(60);
    expect(THIS_SERVER_TTL_MINUTES).toBeLessThan(60);
  });
});

describe('this server', () => {
  it('knows loopback addresses', () => {
    for (const h of ['localhost', 'LOCALHOST', '127.0.0.1', '127.1.2.3', '::1', '[::1]']) expect(isLoopbackHost(h), h).toBe(true);
    for (const h of ['hub.example.com', '10.0.0.5', '1270.0.0.1', '', undefined]) expect(isLoopbackHost(h), String(h)).toBe(false);
  });

  it('points the agent at the hub directly when the page was opened on this machine', () => {
    expect(thisServerHub('http://localhost:8080')).toBe('http://127.0.0.1:8080');
    expect(thisServerHub('http://127.0.0.1:9090')).toBe('http://127.0.0.1:9090');
    expect(thisServerHub('https://localhost')).toBe('https://127.0.0.1');
  });

  it('keeps any other address as it is', () => {
    expect(thisServerHub('http://primelegion:8080')).toBe('http://primelegion:8080');
    expect(thisServerHub('https://monitor.example.com')).toBe('https://monitor.example.com');
    expect(thisServerHub('not a url')).toBe('not a url');
  });

  it('only treats a loopback page as being on the hub machine', () => {
    expect(pageIsOnTheHub('http://localhost:8080')).toBe(true);
    expect(pageIsOnTheHub('http://primelegion:8080')).toBe(false);
    expect(pageIsOnTheHub('')).toBe(false);
  });

  it('guesses the platform from the user agent', () => {
    expect(guessPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows');
    expect(guessPlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe('unix');
    expect(guessPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('unix');
    expect(guessPlatform(undefined)).toBe('unix');
  });
});

describe('install commands', () => {
  it('fill in the hub, token and cluster, and quote what needs it', () => {
    expect(installArgs({ hub: ' http://hub:8080 ', token: 'svm_e_abc', cluster: 'prod' })).toBe(
      '--hub http://hub:8080 --token svm_e_abc --cluster prod',
    );
    expect(installArgs({ hub: 'http://hub:8080', token: 'svm_e_abc', cluster: 'east coast' })).toContain('--cluster "east coast"');
    expect(installArgs({ hub: 'http://hub:8080', token: 'svm_e_abc', cluster: '  ' })).not.toContain('--cluster');
  });

  it('show placeholders until there is something to fill in', () => {
    expect(installArgs({ hub: '', token: '' })).toBe('--hub <hub address> --token <token>');
  });

  it('differ only by how each system runs a program', () => {
    const c = installCommands({ hub: 'http://hub:8080', token: 'svm_e_abc' });
    expect(c.windows).toBe(String.raw`.\svcmon.exe agent install --hub http://hub:8080 --token svm_e_abc`);
    expect(c.unix).toBe('sudo ./svcmon agent install --hub http://hub:8080 --token svm_e_abc');
  });
});
