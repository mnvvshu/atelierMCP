#!/usr/bin/env node
/**
 * Atelier Neurolink Monitor — Real-time project dashboard
 * 
 * Scans the target project, serves a web dashboard, and pushes
 * live events over WebSocket.
 * 
 * Usage: npx tsx src/index.ts --project /path/to/site [--port 4510]
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { parseArgs } from 'util';
import { randomUUID } from 'node:crypto';
import { join, resolve, relative, extname, basename } from 'path';
import {
  watch, readFileSync, readdirSync, existsSync, statSync, type FSWatcher
} from 'fs';
import { getDashboardHTML } from './dashboard.js';
import { readStateRecords, readGitBranch, stringRecord, snapshotState } from './state.js';

// ─── CLI Args ────────────────────────────────────────────────────

function readOptions() {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        port: { type: 'string', short: 'p', default: '4510' },
        project: { type: 'string', short: 'd' },
        help: { type: 'boolean', short: 'h' }
      }
    });
    if (values.help) {
      process.stdout.write('Usage: atelier-monitor [--project <directory>] [--port <1-65535>]\n');
      process.exit(0);
    }
    const port = Number(values.port);
    if (!/^\d+$/.test(values.port ?? '') || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('Port must be a whole number between 1 and 65535.');
    }
    const project = resolve(values.project ?? process.cwd());
    if (!existsSync(project) || !statSync(project).isDirectory()) {
      throw new Error(`Project directory does not exist or is not a directory: ${project}`);
    }
    return { port, project };
  } catch (error) {
    process.stderr.write(`[neurolink] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

const { port: PORT, project: PROJECT_DIR } = readOptions();
const ATELIER_DIR = join(PROJECT_DIR, '.atelier');
const START_TIME = Date.now();

function log(msg: string) {
  process.stderr.write(`[neurolink] ${msg}\n`);
}

// ─── Project Scanner ─────────────────────────────────────────────

interface ProjectScan {
  projectDir: string;
  projectName: string;
  framework: string;
  frameworkVersion: string;
  language: string;
  packageManager: string;
  nodeVersion: string;
  srcDir: string;
  typescript: boolean;
  components: Array<{ name: string; file: string }>;
  configFiles: string[];
  tokens: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  totalFiles: number;
  totalLines: number;
  filesByExtension: Record<string, number>;
  hasGit: boolean;
  gitBranch: string;
  hasAtelier: boolean;
  atelierPlans: number;
  atelierChanges: number;
}

function scanProject(): ProjectScan {
  const result: ProjectScan = {
    projectDir: PROJECT_DIR,
    projectName: basename(PROJECT_DIR),
    framework: 'unknown',
    frameworkVersion: '',
    language: 'JavaScript',
    packageManager: 'npm',
    nodeVersion: process.version,
    srcDir: '.',
    typescript: false,
    components: [],
    configFiles: [],
    tokens: {},
    dependencies: {},
    devDependencies: {},
    scripts: {},
    totalFiles: 0,
    totalLines: 0,
    filesByExtension: {},
    hasGit: false,
    gitBranch: '',
    hasAtelier: existsSync(ATELIER_DIR),
    atelierPlans: 0,
    atelierChanges: 0,
  };

  // Read package.json
  const pkgPath = join(PROJECT_DIR, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      result.projectName = typeof pkg.name === 'string' && pkg.name ? pkg.name : result.projectName;
      result.dependencies = stringRecord(pkg.dependencies);
      result.devDependencies = stringRecord(pkg.devDependencies);
      result.scripts = stringRecord(pkg.scripts);

      const allDeps = { ...result.dependencies, ...result.devDependencies };

      // Detect framework
      if (allDeps['next']) {
        result.framework = 'Next.js';
        result.frameworkVersion = allDeps['next'];
      } else if (allDeps['nuxt']) {
        result.framework = 'Nuxt';
        result.frameworkVersion = allDeps['nuxt'];
      } else if (allDeps['vite'] && (allDeps['react'] || allDeps['react-dom'])) {
        result.framework = 'React + Vite';
        result.frameworkVersion = allDeps['vite'];
      } else if (allDeps['react']) {
        result.framework = 'React';
        result.frameworkVersion = allDeps['react'];
      } else if (allDeps['vue']) {
        result.framework = 'Vue';
        result.frameworkVersion = allDeps['vue'];
      } else if (allDeps['svelte']) {
        result.framework = 'Svelte';
        result.frameworkVersion = allDeps['svelte'];
      } else if (allDeps['express']) {
        result.framework = 'Express';
        result.frameworkVersion = allDeps['express'];
      }
    } catch { /* skip */ }
  }

  // Detect TypeScript
  result.typescript = existsSync(join(PROJECT_DIR, 'tsconfig.json'));
  result.language = result.typescript ? 'TypeScript' : 'JavaScript';

  // Detect package manager
  const lockfiles: Array<[string, string]> = [
    ['bun.lock', 'bun'], ['bun.lockb', 'bun'], ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'], ['package-lock.json', 'npm']
  ];
  for (const [file, pm] of lockfiles) {
    if (existsSync(join(PROJECT_DIR, file))) {
      result.packageManager = pm;
      break;
    }
  }

  // Detect src directory
  if (existsSync(join(PROJECT_DIR, 'src'))) result.srcDir = 'src';
  else if (existsSync(join(PROJECT_DIR, 'app'))) result.srcDir = 'app';
  else if (existsSync(join(PROJECT_DIR, 'pages'))) result.srcDir = 'pages';

  // Detect config files
  const configPatterns = [
    'tsconfig.json', 'vite.config.ts', 'vite.config.js',
    'next.config.ts', 'next.config.js', 'next.config.mjs',
    'tailwind.config.ts', 'tailwind.config.js',
    'postcss.config.js', 'postcss.config.mjs',
    'eslint.config.js', '.eslintrc.json', '.eslintrc.js',
    '.prettierrc', '.prettierrc.json', 'prettier.config.js',
    'vitest.config.ts', 'jest.config.ts', 'jest.config.js',
    '.env', '.env.local', 'docker-compose.yml', 'Dockerfile',
    'CLAUDE.md', '.gitignore', 'README.md'
  ];
  for (const p of configPatterns) {
    if (existsSync(join(PROJECT_DIR, p))) result.configFiles.push(p);
  }

  // Detect git
  result.hasGit = existsSync(join(PROJECT_DIR, '.git'));
  if (result.hasGit) {
    result.gitBranch = readGitBranch(PROJECT_DIR);
  }

  // Walk source files — count files, lines, extensions, find components
  const skipDirs = new Set(['node_modules', '.git', '.atelier', 'dist', '.next', '.nuxt', 'build', 'coverage', '.svelte-kit']);

  function walk(dir: string, depth = 0) {
    if (depth > 8) return; // prevent deep recursion
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && !skipDirs.has(entry.name)) {
            walk(fullPath, depth + 1);
          }
        } else if (entry.isFile()) {
          result.totalFiles++;
          const ext = extname(entry.name).toLowerCase() || '(no ext)';
          result.filesByExtension[ext] = (result.filesByExtension[ext] || 0) + 1;

          // Count lines for source files
          if (/\.(ts|tsx|js|jsx|vue|svelte|css|scss|html|json|md)$/.test(entry.name)) {
            try {
              const content = readFileSync(fullPath, 'utf-8');
              result.totalLines += content ? content.split(/\r?\n/).length - (content.endsWith('\n') ? 1 : 0) : 0;

              // Detect React/Vue components
              if (/\.(tsx|jsx)$/.test(entry.name)) {
                const matches = content.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class)\s+([A-Z]\w*)/g);
                for (const m of matches) {
                  result.components.push({
                    name: m[1],
                    file: relative(PROJECT_DIR, fullPath).replace(/\\/g, '/')
                  });
                }
              }
              if (/\.(vue|svelte)$/.test(entry.name)) {
                result.components.push({
                  name: basename(entry.name, extname(entry.name)),
                  file: relative(PROJECT_DIR, fullPath).replace(/\\/g, '/')
                });
              }

              // Scan for CSS tokens
              if (/\.(css|scss)$/.test(entry.name)) {
                const tokenRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
                let match;
                while ((match = tokenRegex.exec(content)) !== null) {
                  result.tokens[`--${match[1]}`] = match[2].trim();
                }
              }
            } catch { /* skip unreadable files */ }
          }
        }
      }
    } catch { /* skip inaccessible dirs */ }
  }

  // Walk the project once, including source files and root configuration.
  walk(PROJECT_DIR);

  // Count Atelier plans and changes
  result.atelierPlans = readPlans().length;
  result.atelierChanges = readChanges().length;

  return result;
}

// ─── Read Atelier State ──────────────────────────────────────────

function readPlans() {
  return readStateRecords(join(ATELIER_DIR, 'plans'), 'createdAt');
}

function readChanges() {
  return readStateRecords(join(ATELIER_DIR, 'changes'), 'timestamp');
}

// ─── Event History ───────────────────────────────────────────────

interface MonitorEvent {
  id: string;
  type: string;
  tool?: string;
  data: unknown;
  timestamp: string;
}

const eventHistory: MonitorEvent[] = [];
const MAX_EVENTS = 200;
const seenPersistentEvents = new Set<string>();

function syncPersistentEvents(live = true) {
  const records = readStateRecords(join(ATELIER_DIR, 'events'), 'timestamp').slice(0, MAX_EVENTS);
  for (const record of records.reverse()) {
    if (typeof record.id !== 'string' || typeof record.type !== 'string' ||
        typeof record.timestamp !== 'string' || !Number.isFinite(Date.parse(record.timestamp)) ||
        seenPersistentEvents.has(record.id)) continue;
    seenPersistentEvents.add(record.id);
    const event: MonitorEvent = {
      id: record.id, type: record.type, timestamp: record.timestamp,
      ...(typeof record.tool === 'string' ? { tool: record.tool } : {}),
      data: record.data ?? {}
    };
    eventHistory.push(event);
    if (live) broadcast({ type: 'event', payload: event });
  }
  eventHistory.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  eventHistory.splice(MAX_EVENTS);
  // The server bounds its event files; keep deduplication memory bounded too.
  while (seenPersistentEvents.size > 5000) {
    const oldest = seenPersistentEvents.values().next().value;
    if (oldest) seenPersistentEvents.delete(oldest);
    else break;
  }
}

syncPersistentEvents(false);

function pushEvent(evt: Omit<MonitorEvent, 'id' | 'timestamp'>) {
  const full: MonitorEvent = {
    ...evt,
    id: randomUUID(),
    timestamp: new Date().toISOString()
  };
  eventHistory.unshift(full);
  if (eventHistory.length > MAX_EVENTS) eventHistory.pop();
  broadcast({ type: 'event', payload: full });
}

// ─── HTTP Server ─────────────────────────────────────────────────

function sendJSON(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-cache'
  });
  res.end(JSON.stringify(data, null, 2));
}

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  let url: URL;
  try {
    // Request paths do not need the untrusted Host header to be parsed.
    url = new URL(req.url || '/', 'http://localhost');
  } catch {
    sendJSON(res, { error: 'Invalid request URL' }, 400);
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD, OPTIONS');
    sendJSON(res, { error: 'Method not allowed' }, 405);
    return;
  }

  try {
    // Dashboard HTML
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getDashboardHTML());
      return;
    }
    if (url.pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }

    // API: Server status
    if (url.pathname === '/api/status') {
      sendJSON(res, {
        status: 'online',
        version: '0.1.0',
        port: PORT,
        project: PROJECT_DIR,
        uptime: Math.floor((Date.now() - START_TIME) / 1000),
        startedAt: new Date(START_TIME).toISOString(),
        connectedClients: wss.clients.size,
        eventCount: eventHistory.length
      });
      return;
    }

    // API: Full project scan
    if (url.pathname === '/api/project') {
      const scan = scanProject();
      sendJSON(res, scan);
      return;
    }

    // API: Events
    if (url.pathname === '/api/events') {
      sendJSON(res, eventHistory);
      return;
    }

    // API: Plans
    if (url.pathname === '/api/plans') {
      sendJSON(res, readPlans());
      return;
    }

    // API: Changes
    if (url.pathname === '/api/changes') {
      sendJSON(res, readChanges());
      return;
    }

    // 404
    sendJSON(res, { error: 'Not found', path: url.pathname }, 404);

  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    sendJSON(res, { error: 'Internal server error' }, 500);
  }
});

// ─── WebSocket ───────────────────────────────────────────────────

const wss = new WebSocketServer({ server: httpServer, maxPayload: 64 * 1024 });

function broadcast(message: unknown) {
  const data = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, error => { if (error) client.terminate(); });
    }
  });
}

wss.on('connection', (ws: WebSocket) => {
  ws.on('error', error => log(`WebSocket error: ${error.message}`));
  log(`Client connected (total: ${wss.clients.size})`);
  
  // Send initial state
  ws.send(JSON.stringify({
    type: 'init',
    project: PROJECT_DIR,
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    events: eventHistory
  }));

  pushEvent({ type: 'info', data: { message: 'Monitor client connected' } });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
    } catch { /* ignore */ }
  });

  ws.on('close', () => {
    log(`Client disconnected (total: ${wss.clients.size})`);
  });
});

// ─── File Watcher ────────────────────────────────────────────────

let watcher: FSWatcher | undefined;
let watchRetryAt = 0;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let stateSnapshot = snapshotState(ATELIER_DIR);
let hadAtelier = existsSync(ATELIER_DIR);

function refreshState() {
  const hasAtelier = existsSync(ATELIER_DIR);
  if (!hasAtelier && watcher) {
    watcher.close();
    watcher = undefined;
  }
  if (hasAtelier && !watcher && Date.now() >= watchRetryAt) {
    try {
      watcher = watch(ATELIER_DIR, { recursive: true }, () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refreshState, 120);
      });
      watcher.on('error', error => {
        log(`File watcher unavailable; using periodic refresh: ${error.message}`);
        watcher?.close();
        watcher = undefined;
        watchRetryAt = Date.now() + 30_000;
      });
    } catch {
      watchRetryAt = Date.now() + 30_000;
      log('File watcher unavailable; using periodic refresh.');
    }
  }

  const nextSnapshot = snapshotState(ATELIER_DIR);
  const changedFiles = new Set([...stateSnapshot.keys(), ...nextSnapshot.keys()]
    .filter(filename => stateSnapshot.get(filename) !== nextSnapshot.get(filename)));
  syncPersistentEvents();
  for (const filename of changedFiles) {
    // Tool events already have richer messages; do not duplicate them as filesystem events.
    if (filename.startsWith('events/')) continue;
    pushEvent({
      type: 'file_change', tool: 'filesystem',
      data: { eventType: nextSnapshot.has(filename) ? 'change' : 'delete', filename, dir: ATELIER_DIR }
    });
  }
  if (hasAtelier !== hadAtelier || changedFiles.size) broadcast({ type: 'refresh' });
  stateSnapshot = nextSnapshot;
  hadAtelier = hasAtelier;
}

// Polling also detects .atelier created after startup and retries partially written JSON.
const refreshInterval = setInterval(refreshState, 1000);
refreshInterval.unref();

function closeWatchers() {
  clearInterval(refreshInterval);
  if (refreshTimer) clearTimeout(refreshTimer);
  watcher?.close();
}

httpServer.on('error', (error: NodeJS.ErrnoException) => {
  log(error.code === 'EADDRINUSE'
    ? `Port ${PORT} is already in use. Choose another port with --port.`
    : `Could not start monitor: ${error.message}`);
  closeWatchers();
  process.exitCode = 1;
});

function shutdown() {
  closeWatchers();
  wss.clients.forEach(client => client.terminate());
  wss.close();
  httpServer.close();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

// ─── Start ───────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  refreshState();
  log('');
  log('╔══════════════════════════════════════════════╗');
  log('║        ATELIER NEUROLINK MONITOR             ║');
  log('╠══════════════════════════════════════════════╣');
  log(`║  Dashboard:  http://localhost:${PORT}            ║`);
  log(`║  Project:    ${PROJECT_DIR.slice(0, 30).padEnd(30)} ║`);
  log(`║  WebSocket:  ws://localhost:${PORT}              ║`);
  log('╚══════════════════════════════════════════════╝');
  log('');

  // Push startup event
  pushEvent({
    type: 'info',
    data: { message: 'Neurolink Monitor started', port: PORT, project: PROJECT_DIR }
  });
});
