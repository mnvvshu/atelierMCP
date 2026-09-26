import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { readGitBranch, readStateRecords } from '../src/state.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const entry = join(root, 'packages/monitor/src/index.ts');
const fixtures: string[] = [];
const children: ChildProcess[] = [];
const sockets: WebSocket[] = [];

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'atelier-monitor-test-'));
  fixtures.push(directory);
  return directory;
}

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP port');
  await new Promise<void>(done => server.close(() => done()));
  return address.port;
}

function run(args: string[]) {
  const child = spawn(process.execPath, ['--import', 'tsx', entry, ...args], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
  children.push(child);
  let output = '';
  child.stderr!.on('data', data => { output += data.toString(); });
  return { child, output: () => output };
}

async function waitUntil(check: () => boolean | Promise<boolean>, timeout = 7000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise(done => setTimeout(done, 50));
  }
  throw new Error('Timed out waiting for monitor state');
}

async function start(directory: string) {
  const port = await freePort();
  const process = run(['--project', directory, '--port', String(port)]);
  await waitUntil(() => {
    if (process.child.exitCode !== null) throw new Error(process.output());
    return process.output().includes('Dashboard:');
  });
  return { port, base: `http://127.0.0.1:${port}` };
}

function connect(port: number) {
  const messages: Array<Record<string, any>> = [];
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  sockets.push(socket);
  socket.on('message', raw => messages.push(JSON.parse(raw.toString())));
  return { socket, messages };
}

afterAll(async () => {
  sockets.forEach(socket => socket.terminate());
  await Promise.all(children.map(async child => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
  }));
  for (const directory of fixtures) {
    // Only remove the temporary directories created by this test file.
    if (dirname(directory) !== resolve(tmpdir()) || !basename(directory).startsWith('atelier-monitor-test-')) {
      throw new Error('Unexpected temporary directory');
    }
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('monitor project state', () => {
  it('reads worktree Git metadata and skips incomplete or non-object JSON', () => {
    const directory = fixture();
    mkdirSync(join(directory, 'metadata'));
    writeFileSync(join(directory, '.git'), 'gitdir: metadata\n');
    writeFileSync(join(directory, 'metadata/HEAD'), 'ref: refs/heads/codex/dashboard\n');
    expect(readGitBranch(directory)).toBe('codex/dashboard');
    writeFileSync(join(directory, 'old.json'), JSON.stringify({ id: 'old', createdAt: '2026-01-01' }));
    writeFileSync(join(directory, 'new.json'), JSON.stringify({ id: 'new', createdAt: '2026-01-02' }));
    writeFileSync(join(directory, 'partial.json'), '{');
    writeFileSync(join(directory, 'array.json'), '[]');
    writeFileSync(join(directory, 'null.json'), 'null');
    expect(readStateRecords(directory, 'createdAt').map(record => record.id)).toEqual(['new', 'old']);
  });

  it('rejects invalid CLI input with a useful error', async () => {
    const invalid = run(['--port', '4510oops']);
    const [code] = await once(invalid.child, 'exit');
    expect(code).toBe(1);
    expect(invalid.output()).toContain('between 1 and 65535');
    expect(invalid.output()).not.toContain('RangeError');
  });
});

describe('monitor live API', () => {
  let directory: string;
  let monitor: Awaited<ReturnType<typeof start>>;

  beforeAll(async () => {
    directory = fixture();
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'dashboard-fixture', dependencies: { react: '^19', invalid: 3 } }));
    writeFileSync(join(directory, 'bun.lock'), '{}');
    monitor = await start(directory);
  });

  it('scans valid package metadata and handles unsupported HTTP methods', async () => {
    const response = await fetch(`${monitor.base}/api/project`);
    const project = await response.json();
    expect(project.projectName).toBe('dashboard-fixture');
    expect(project.framework).toBe('React');
    expect(project.dependencies).toEqual({ react: '^19' });
    expect(project.packageManager).toBe('bun');
    expect((await fetch(`${monitor.base}/api/status`, { method: 'POST' })).status).toBe(405);
    expect((await fetch(`${monitor.base}/favicon.ico`)).status).toBe(204);
    expect((await fetch(`${monitor.base}/api/status`, { headers: { Host: '[' } })).status).toBe(200);
  });

  it('detects late-created state, streams tool events once, and survives state recreation', async () => {
    const { messages } = connect(monitor.port);
    await waitUntil(() => messages.some(message => message.type === 'init'));
    const state = join(directory, '.atelier');
    mkdirSync(join(state, 'plans'), { recursive: true });
    mkdirSync(join(state, 'events'));
    const event = { id: 'tool-once', type: 'tool_call', tool: 'prepare_design', timestamp: new Date().toISOString(), data: { brief: 'Dashboard' } };
    writeFileSync(join(state, 'events/tool.json'), JSON.stringify(event));
    writeFileSync(join(state, 'plans/plan.json'), JSON.stringify({ id: 'plan', createdAt: event.timestamp }));
    await waitUntil(() => messages.some(message => message.type === 'event' && message.payload.id === event.id));
    await waitUntil(() => messages.some(message => message.type === 'refresh'));
    expect(await (await fetch(`${monitor.base}/api/plans`)).json()).toHaveLength(1);
    expect((await (await fetch(`${monitor.base}/api/project`)).json()).atelierPlans).toBe(1);
    // Rewriting the same event can generate multiple platform filesystem notifications.
    writeFileSync(join(state, 'events/tool.json'), readFileSync(join(state, 'events/tool.json')));
    renameSync(state, join(directory, 'previous-state'));
    await waitUntil(async () => !(await (await fetch(`${monitor.base}/api/project`)).json()).hasAtelier);
    mkdirSync(join(state, 'events'), { recursive: true });
    const next = { ...event, id: 'after-recreation', timestamp: new Date().toISOString() };
    writeFileSync(join(state, 'events/next.json'), JSON.stringify(next));
    await waitUntil(() => messages.some(message => message.type === 'event' && message.payload.id === next.id));
    expect(messages.filter(message => message.type === 'event' && message.payload.id === event.id)).toHaveLength(1);
  });

  it('reports a port conflict without an unhandled exception', async () => {
    const conflict = run(['--project', directory, '--port', String(monitor.port)]);
    const [code] = await once(conflict.child, 'exit');
    expect(code).toBe(1);
    expect(conflict.output()).toContain('already in use');
    expect(conflict.output()).not.toContain('Unhandled');
  });
});

it('restores bounded tool history and sends the same full history on WebSocket reconnect', async () => {
  const directory = fixture();
  const eventsDirectory = join(directory, '.atelier/events');
  mkdirSync(eventsDirectory, { recursive: true });
  for (let index = 0; index < 220; index++) {
    const event = { id: `saved-${index}`, type: 'tool_call', tool: 'inspect_project', timestamp: new Date(Date.now() - index * 1000).toISOString(), data: {} };
    writeFileSync(join(eventsDirectory, `${index}.json`), JSON.stringify(event));
  }
  const monitor = await start(directory);
  const { messages } = connect(monitor.port);
  await waitUntil(() => messages.some(message => message.type === 'init'));
  const init = messages.find(message => message.type === 'init')!;
  expect(init.events).toHaveLength(200);
  expect(init.events.some((event: { id: string }) => event.id === 'saved-0')).toBe(true);
  expect(init.events.some((event: { id: string }) => event.id === 'saved-219')).toBe(false);
  expect(await (await fetch(`${monitor.base}/api/events`)).json()).toHaveLength(200);
});
