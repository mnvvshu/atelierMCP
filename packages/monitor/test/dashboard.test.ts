import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import axe from 'axe-core';
import { getDashboardHTML } from '../src/dashboard.js';

type ApiData = Record<string, unknown>;
type FeedEvent = { id: string; type: string; timestamp: string; tool?: string; data: unknown };

const event = (id: string, tool?: string, data: unknown = { message: id }, type = 'tool_call'): FeedEvent => ({
  id,
  type,
  timestamp: new Date(Date.UTC(2026, 8, 26, 12, 0, Number(id.replace(/\D/g, '')) || 0)).toISOString(),
  ...(tool ? { tool } : {}),
  data,
});

const defaults = (): ApiData => ({
  project: {
    projectName: 'Sample workspace', projectDir: 'C:/projects/sample', totalFiles: 42, totalLines: 1250,
    framework: 'React', language: 'TypeScript', packageManager: 'npm', hasGit: true, gitBranch: 'main',
    dependencies: { react: '^19' }, devDependencies: { typescript: '^5' }, components: [], tokens: {},
  },
  plans: [], changes: [], status: { uptime: 90 },
});

const activePages: Array<{ dom: JSDOM; errors: Error[] }> = [];

function createDashboard(overrides: ApiData = {}, hash = '') {
  const api = { ...defaults(), ...overrides };
  const failed = new Set<string>();
  const errors: Error[] = [];
  const sockets: MockSocket[] = [];
  class MockSocket {
    static OPEN = 1;
    readyState = 0;
    onopen?: () => void;
    onclose?: () => void;
    onmessage?: (event: { data: string }) => void;
    onerror?: () => void;
    send = vi.fn();
    constructor(public url: string) { sockets.push(this); }
    open() { this.readyState = MockSocket.OPEN; this.onopen?.(); }
    close() { this.readyState = 3; this.onclose?.(); }
    receive(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
  }
  const fetch = vi.fn(async (url: string) => {
    const path = url.replace('/api/', '');
    if (failed.has(path)) return { ok: false, status: 503, json: async () => ({ error: 'Unavailable' }) };
    return { ok: true, status: 200, json: async () => api[path] };
  });
  const intervals = vi.fn((callback: () => void, ms?: number) => setInterval(callback, ms));
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(getDashboardHTML(), {
    url: 'http://localhost:4242/' + hash,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      Object.assign(window, {
        fetch, WebSocket: MockSocket,
        setTimeout, clearTimeout, setInterval: intervals, clearInterval,
        scrollTo: vi.fn(),
      });
      window.Date.now = Date.now;
      window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
      window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
      window.addEventListener('error', e => errors.push(e.error || new Error(e.message)));
    },
  });
  activePages.push({ dom, errors });
  const element = (id: string) => {
    const el = dom.window.document.getElementById(id);
    if (!el) throw new Error('Missing dashboard element: ' + id);
    return el;
  };
  const navigate = (view: string) => {
    dom.window.location.hash = view;
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
  };
  const click = (selector: string) => {
    const el = dom.window.document.querySelector<HTMLElement>(selector);
    if (!el) throw new Error('Missing dashboard control: ' + selector);
    el.click();
  };
  const search = (value: string) => {
    (element('event-search') as HTMLInputElement).value = value;
    element('event-search').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };
  return { dom, api, failed, fetch, sockets, intervals, element, click, search, navigate };
}

const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  const errors = activePages.flatMap(page => page.errors);
  for (const { dom } of activePages.splice(0)) {
    dom.window.dispatchEvent(new dom.window.Event('pagehide'));
    dom.window.close();
  }
  vi.useRealTimers();
  expect(errors, 'The served dashboard script must run without browser errors').toEqual([]);
});

describe('served monitor dashboard', () => {
  it('has no automated accessibility violations in its populated overview and detail dialog', async () => {
    // Axe schedules its own asynchronous work; its DOM rules need real timers.
    vi.useRealTimers();
    const page = createDashboard({ plans: [{ id: 'accessible-plan', brief: 'Accessible workspace', status: 'prepared', changes: [] }] });
    await new Promise(resolve => setTimeout(resolve, 0));
    page.sockets[0].receive({ type: 'init', events: [event('1', 'inspect_project', { message: 'Workspace inspected' })] });
    page.dom.window.eval(axe.source);
    const browserAxe = (page.dom.window as unknown as { axe: typeof axe }).axe;
    // JSDOM has no layout engine, so contrast requires a separate real-browser check.
    const options = { rules: { 'color-contrast': { enabled: false } } };
    const overview = await browserAxe.run(page.dom.window.document, options);
    expect(overview.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
    page.click('[data-plan="accessible-plan"]');
    const details = await browserAxe.run(page.element('detail-dialog'), options);
    expect(details.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
  }, 15000);

  it('renders project, event, and plan text safely, including hostile identifiers and detail dialogs', async () => {
    const hostile = '<img src=x onerror="window.compromised=true"> & "quoted"';
    const planId = 'plan" data-malicious="true';
    const page = createDashboard({
      project: { ...(defaults().project as object), projectName: hostile, projectDir: hostile, dependencies: { [hostile]: hostile } },
      plans: [{ id: planId, brief: hostile, status: hostile, createdAt: 'bad date', changes: [] }],
    });
    await settle();
    page.sockets[0].receive({ type: 'init', events: [event('id" data-malicious="true', hostile, { message: hostile })] });

    expect(page.element('workspace-name').textContent).toBe(hostile);
    expect(page.element('project-summary').textContent).toContain(hostile);
    expect(page.element('events').textContent).toContain(hostile);
    expect(page.element('plans').textContent).toContain(hostile);
    expect(page.dom.window.document.querySelector('img, [data-malicious]')).toBeNull();
    page.click('[data-event]');
    expect(page.element('detail-dialog').hasAttribute('open')).toBe(true);
    expect(page.element('dialog-title').textContent).toBe(hostile);
    expect(page.element('dialog-content').textContent).toContain(hostile.replaceAll('"', '\\"'));
    page.click('#dialog-close');
    page.click('[data-plan]');
    expect(page.element('dialog-title').textContent).toBe(hostile);
    expect(page.element('dialog-content').textContent).toContain(planId);
    expect(page.dom.window.document.querySelector('img, [data-malicious]')).toBeNull();
  });

  it('counts only tool calls, deduplicates history and reconnects without multiplying timers', async () => {
    const page = createDashboard();
    await settle();
    const history = [event('1', 'inspect_project'), event('2', 'get_recipe'), event('3', undefined, {}, 'file_change'), event('4', 'inspect_project', {}, 'error')];
    page.sockets[0].open();
    page.sockets[0].receive({ type: 'init', events: [...history, history[0], null, { id: 'invalid' }], uptime: 90 });
    expect(page.element('metric-calls').textContent).toBe('2');
    expect(page.element('event-count').textContent).toBe('4');
    expect(page.element('metric-uptime').textContent).toBe('01:30');
    expect(page.element('connection-text').textContent).toBe('Live connection');
    page.sockets[0].receive({ type: 'event', payload: history[0] });
    expect(page.element('metric-calls').textContent).toBe('2');

    page.sockets[0].close();
    expect(page.element('connection-text').textContent).toBe('Reconnecting');
    await vi.advanceTimersByTimeAsync(1000);
    expect(page.sockets).toHaveLength(2);
    page.sockets[1].open();
    page.sockets[1].receive({ type: 'init', events: [...history, event('5', 'audit_ui')] });
    expect(page.element('metric-calls').textContent).toBe('3');
    expect(page.element('event-count').textContent).toBe('5');
    expect(page.intervals.mock.calls.map(call => call[1])).toEqual([25000, 30000, 1000]);
    await vi.advanceTimersByTimeAsync(24000);
    expect(page.sockets[0].send).not.toHaveBeenCalled();
    expect(page.sockets[1].send).toHaveBeenCalledExactlyOnceWith('{"type":"ping"}');
  });

  it('searches and filters activity while pause freezes the displayed feed only', async () => {
    const page = createDashboard({}, '#activity');
    await settle();
    page.sockets[0].receive({ type: 'init', events: [
      event('1', 'inspect_project', { message: 'Read workspace' }),
      event('2', 'prepare_design', { brief: 'Landing page' }),
      event('3', undefined, { message: 'File watcher ready' }, 'system'),
      event('4', 'audit_ui', { message: 'Preview failed' }, 'error'),
    ] });
    page.click('[data-filter="planning"]');
    expect(page.element('events').textContent).toContain('Landing page');
    expect(page.element('events').querySelectorAll('.event-row')).toHaveLength(1);
    page.click('[data-filter="error"]');
    expect(page.element('events').textContent).toContain('Preview failed');
    page.click('[data-filter="system"]');
    expect(page.element('events').textContent).toContain('File watcher ready');
    page.click('#clear-search');
    page.search('WORKSPACE');
    expect(page.element('events').querySelectorAll('.event-row')).toHaveLength(1);
    expect(page.element('events').textContent).toContain('Read workspace');
    page.search('does not exist');
    expect(page.element('events').textContent).toContain('No matching events');
    page.click('#clear-search');
    expect(page.element('clear-search').hidden).toBe(true);
    page.click('#pause');
    page.sockets[0].receive({ type: 'event', payload: event('5', 'get_recipe', { message: 'New recipe' }) });
    expect(page.element('pause').getAttribute('aria-pressed')).toBe('true');
    expect(page.element('events').textContent).not.toContain('New recipe');
    expect(page.element('event-count').textContent).toBe('4');
    expect(page.element('nav-events').textContent).toBe('5');
    page.click('#pause');
    expect(page.element('events').textContent).toContain('New recipe');
    expect(page.element('event-count').textContent).toBe('5');
    expect(page.element('pause').getAttribute('aria-pressed')).toBe('false');
  });

  it('routes every navigation view and supports keyboard search and tool details', async () => {
    const page = createDashboard();
    await settle();
    for (const [view, visible, hidden] of [
      ['activity', 'activity-panel', 'project-panel'], ['project', 'project-detail', 'activity-panel'],
      ['plans', 'plans-panel', 'topology-panel'], ['tools', 'tools-panel', 'plans-panel'],
    ]) {
      page.navigate(view);
      await settle();
      expect(page.element(visible).hidden).toBe(false);
      expect(page.element(hidden).hidden).toBe(true);
      expect(page.dom.window.document.querySelector('[aria-current="page"]')?.getAttribute('data-nav')).toBe(view);
      expect(page.dom.window.scrollTo).toHaveBeenLastCalledWith(0, 0);
      expect(page.dom.window.document.activeElement).toBe(page.element('main'));
    }
    expect(page.element('metrics').hidden).toBe(true);
    expect(page.element('tool-library').querySelectorAll('[data-tool]')).toHaveLength(10);
    page.click('#tool-library [data-tool="inspect_project"]');
    expect(page.element('dialog-title').textContent).toBe('inspect_project');
    expect(page.element('dialog-content').textContent).toContain('No calls recorded');
    page.click('#dialog-close');
    page.dom.window.document.dispatchEvent(new page.dom.window.KeyboardEvent('keydown', { key: '/', bubbles: true }));
    await settle();
    expect(page.dom.window.location.hash).toBe('#activity');
    expect(page.dom.window.document.activeElement?.id).toBe('event-search');
    page.navigate('unknown-route');
    expect(page.element('breadcrumb').textContent).toBe('Overview');
    expect(page.element('topology-panel').hidden).toBe(false);
  });

  it('moves skip-link focus to the main content without changing the current view', async () => {
    const page = createDashboard({}, '#project');
    await settle();
    for (const view of ['project', 'activity', 'plans', 'tools']) {
      page.navigate(view);
      page.dom.window.document.querySelector<HTMLElement>('.skip-link')!.focus();
      page.click('.skip-link');
      await settle();
      expect(page.dom.window.document.activeElement).toBe(page.element('main'));
      expect(page.dom.window.location.hash).toBe('#' + view);
      expect(page.dom.window.document.querySelector('[aria-current="page"]')?.getAttribute('data-nav')).toBe(view);
    }
  });

  it('preserves keyboard focus during feed updates and provides a fallback when a row leaves the visible window', async () => {
    const page = createDashboard();
    await settle();
    page.sockets[0].receive({ type: 'init', events: Array.from({ length: 5 }, (_, i) => event(String(i + 1), 'inspect_project')) });
    page.dom.window.document.querySelector<HTMLElement>('[data-event="2"]')!.focus();
    page.sockets[0].receive({ type: 'event', payload: event('6', 'inspect_project') });
    expect((page.dom.window.document.activeElement as HTMLElement).dataset.event).toBe('2');
    page.sockets[0].receive({ type: 'event', payload: event('7', 'inspect_project') });
    expect(page.element('events').querySelector('[data-event="2"]')).toBeNull();
    expect(page.dom.window.document.activeElement).toBe(page.element('events'));
    page.element('event-search').focus();
    page.sockets[0].receive({ type: 'event', payload: event('8', 'inspect_project') });
    expect(page.dom.window.document.activeElement).toBe(page.element('event-search'));
  });

  it('keeps the last valid data on failed or malformed responses and recovers on refresh', async () => {
    const page = createDashboard({ plans: [{ id: 'saved', brief: 'Saved plan' }] });
    await settle();
    expect(page.element('metric-files').textContent).toBe('42');
    page.failed.add('project');
    page.api.plans = { error: 'Not a plan list' };
    page.click('#refresh');
    expect((page.element('refresh') as HTMLButtonElement).disabled).toBe(true);
    await settle();
    expect(page.element('notice').hidden).toBe(false);
    expect(page.element('notice').textContent).toContain('project');
    expect(page.element('notice').textContent).toContain('plans');
    expect(page.element('metric-files').textContent).toBe('42');
    expect(page.element('plans').textContent).toContain('Saved plan');
    expect((page.element('refresh') as HTMLButtonElement).disabled).toBe(false);
    page.failed.clear();
    page.api.plans = [];
    page.api.project = { ...(defaults().project as object), totalFiles: 43 };
    page.click('#refresh');
    await settle();
    expect(page.element('notice').hidden).toBe(true);
    expect(page.element('metric-files').textContent).toBe('43');
    expect(page.element('metric-plans').textContent).toBe('0');
    expect(page.element('toast').textContent).toBe('Workspace is up to date.');
  });

  it('opens complete plan details with matching change records and expands the plans view', async () => {
    const page = createDashboard({
      plans: Array.from({ length: 4 }, (_, i) => ({ id: 'plan-' + i, brief: 'Design ' + i, status: i ? 'prepared' : 'applied', createdAt: '2026-09-26T12:00:00Z', changes: [{ path: 'src/app.tsx' }] })),
      changes: [{ id: 'change-1', planId: 'plan-0' }, { id: 'change-2', planId: 'plan-0' }, { id: 'unrelated', planId: 'plan-1' }],
    });
    await settle();
    expect(page.element('plans').querySelectorAll('[data-plan]')).toHaveLength(3);
    expect(page.element('plans').querySelector('.plan-meta')?.textContent).toContain('1 file changes');
    expect(page.element('note-plans').textContent).toBe('1 applied · 3 in progress');
    page.navigate('plans');
    expect(page.element('plans').querySelectorAll('[data-plan]')).toHaveLength(4);
    page.click('[data-plan="plan-0"]');
    expect(page.element('dialog-title').textContent).toBe('Design 0');
    expect(page.element('dialog-content').textContent).toContain('src/app.tsx');
    const changesRow = [...page.element('dialog-content').querySelectorAll('.data-row')].find(row => row.querySelector('dt')?.textContent === 'Change records');
    expect(changesRow?.querySelector('dd')?.textContent).toBe('2');
  });

  it('caps live history, tolerates malformed socket messages, and stops connections on page exit', async () => {
    const page = createDashboard({}, '#activity');
    await settle();
    page.sockets[0].open();
    page.sockets[0].receive({ type: 'init', events: Array.from({ length: 210 }, (_, i) => event(String(i), 'inspect_project')) });
    expect(page.element('event-count').textContent).toBe('200');
    expect(page.element('metric-calls').textContent).toBe('200');
    page.sockets[0].onmessage?.({ data: '{invalid json' });
    page.sockets[0].receive(null);
    page.sockets[0].receive({ type: 'event', payload: { id: 'incomplete' } });
    expect(page.element('event-count').textContent).toBe('200');
    const requests = page.fetch.mock.calls.length;
    page.dom.window.dispatchEvent(new page.dom.window.Event('pagehide'));
    await vi.advanceTimersByTimeAsync(60000);
    expect(page.sockets).toHaveLength(1);
    expect(page.sockets[0].send).not.toHaveBeenCalled();
    expect(page.fetch).toHaveBeenCalledTimes(requests);
  });
});
