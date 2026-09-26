/** Self-contained browser runtime. String.raw preserves regexes in the served script. */
export const dashboardScript = String.raw`
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const tools = [
    { id:'inspect_project', label:'inspect_project', category:'inspection', description:'Understand your framework, components, design tokens, and project conventions.' },
    { id:'monitor_project', label:'monitor_project', category:'inspection', description:'Read recent events, session status, and the project dependency graph.' },
    { id:'search_recipes', label:'search_recipes', category:'recipes', description:'Find design and motion patterns that fit your project and performance budget.' },
    { id:'get_recipe', label:'get_recipe', category:'recipes', description:'Get implementation code, configuration, accessibility notes, and licensing.' },
    { id:'prepare_design', label:'prepare_design', category:'planning', description:'Turn a design brief into a structured plan with tokens and exact file changes.' },
    { id:'preview_changes', label:'preview_changes', category:'planning', description:'Review a plan, inspect dependencies, and find conflicts before applying changes.' },
    { id:'apply_changes', label:'apply', category:'execution', description:'Apply a validated design plan and save backups of changed files.' },
    { id:'rollback_changes', label:'rollback', category:'execution', description:'Restore a previous change while checking for subsequent edits.' },
    { id:'capture_preview', label:'capture', category:'execution', description:'Capture the running project at mobile, tablet, and desktop sizes.' },
    { id:'audit_ui', label:'audit', category:'execution', description:'Inspect accessibility, performance, and visual quality of a running page.' }
  ];
  const categories = { inspection:'Inspection', recipes:'Recipes', planning:'Planning', execution:'Execution' };
  const views = {
    overview:['Overview','Your project, in focus.','A live view of your tools, activity, and design workflow.'],
    activity:['Activity','Every signal, in one place.','Search, filter, and explore your recent workspace activity.'],
    project:['Project','Know your workspace.','The framework, files, and foundations behind your project.'],
    plans:['Design plans','From idea to implementation.','Explore your design plans and the changes they create.'],
    tools:['Tool library','A toolkit for thoughtful design.','Explore the ten tools that power your design workflow.']
  };
  const state = { events:[], project:null, plans:[], changes:[], view:'overview', filter:'all', search:'', paused:false, frozen:[], connected:false, startedAt:null, refreshing:false, failures:new Set(), received:false };
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const num = value => (Number.isFinite(Number(value)) ? Number(value) : 0).toLocaleString();
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const list = value => Array.isArray(value) ? value : [];
  const date = value => Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : '—';
  const time = value => Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleTimeString(undefined,{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '—';
  const category = ev => ev.type === 'error' ? 'error' : (tools.find(t => t.id === ev.tool) || {}).category || 'system';
  const calls = () => state.events.filter(e => e.type === 'tool_call' && tools.some(t => t.id === e.tool));
  const rows = values => '<dl class="data-list">' + values.map(([key,value]) => '<div class="data-row"><dt>' + esc(key) + '</dt><dd>' + esc(value) + '</dd></div>').join('') + '</dl>';
  function empty(title, description) { return '<div class="empty-state"><span class="empty-icon" aria-hidden="true">⌁</span><h3>' + esc(title) + '</h3><p>' + esc(description) + '</p></div>'; }
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { $('toast').hidden = true; }, 3500); }
  function dialog(title, html) { $('dialog-title').textContent = title; $('dialog-content').innerHTML = html; if (!$('detail-dialog').open) $('detail-dialog').showModal(); }
  function guide() {
    dialog('Make yourself at home.', '<p>Atelier gives your coding assistant a shared understanding of your project. This monitor brings its activity into view.</p><h3>Your first workflow</h3><ol><li>Connect the Atelier MCP server to your coding assistant.</li><li>Ask it to inspect the same project this monitor is watching.</li><li>Prepare and preview a design plan, then apply it when ready.</li></ol><p>Tool calls and saved plans appear here automatically. You can browse the tool library to learn what each tool does.</p><h3>Keyboard shortcuts</h3>' + rows([['/','Search activity'],['?','Open this guide'],['Esc','Close a dialog']]) + '<h3>About the feed</h3><p>The monitor keeps the latest 200 events. Pause freezes the activity list while new events continue to arrive. Export snapshot saves the current project scan, events, plans, and change records as JSON.</p>');
  }
  function toolDetails(id) {
    const tool = tools.find(t => t.id === id); if (!tool) return;
    const recent = calls().filter(e => e.tool === id);
    dialog(tool.id, '<span class="tag">' + categories[tool.category] + '</span><p style="margin-top:15px">' + tool.description + '</p>' + rows([['Recent calls',num(recent.length)],['Last called',recent.length ? date(recent[0].timestamp) + ' at ' + time(recent[0].timestamp) : 'No calls recorded']]) + '<h3>Recent activity</h3>' + (recent.length ? recent.slice(0,5).map(e => '<pre>' + esc(JSON.stringify(e.data,null,2)) + '</pre>').join('') : '<p>Ask your connected coding assistant to use this tool. Its activity will appear here.</p>'));
  }
  function renderTools() {
    Object.keys(categories).forEach(cat => {
      $('nodes-' + cat).innerHTML = tools.filter(t => t.category === cat).map(t => '<button class="tool-node" data-tool="' + t.id + '" aria-label="Explore ' + t.id + '"><span>' + t.label + '</span><span class="node-dot"></span></button>').join('');
    });
    $('tool-library').innerHTML = tools.map(t => '<button class="tool-card ' + t.category + '" data-tool="' + t.id + '"><span class="tool-card-name">' + t.id + '</span><span class="tool-card-description">' + t.description + '</span><span class="tool-card-footer"><span>' + categories[t.category] + '</span><span>Explore tool ↗</span></span></button>').join('');
  }
  function renderUsage() {
    const recent = calls();
    $('metric-calls').textContent = num(recent.length);
    $('note-calls').textContent = new Set(recent.map(e => e.tool)).size + ' of 10 tools used';
    $('usage').innerHTML = Object.entries(categories).map(([cat,label]) => {
      const count = recent.filter(e => category(e) === cat).length;
      const percent = recent.length ? count / recent.length * 100 : 0;
      return '<div class="usage-row ' + cat + '"><div class="usage-label"><span><span class="event-dot"></span>' + label + '</span><span class="usage-value">' + num(count) + ' calls</span></div><div class="usage-track"><div class="usage-fill" style="width:' + percent + '%"></div></div></div>';
    }).join('');
  }
  function renderFilters() {
    const filters = [['all','All events'],['tools','Tools'],['planning','Plans'],['system','System'],['error','Errors']];
    $('filters').innerHTML = filters.map(([id,label]) => '<button class="filter' + (state.filter === id ? ' active' : '') + '" data-filter="' + id + '" aria-pressed="' + (state.filter === id) + '">' + label + '</button>').join('');
  }
  function summary(ev) {
    const data = object(ev.data);
    if (data.message) return String(data.message);
    if (data.filename) return (data.eventType === 'rename' ? 'Updated ' : 'Changed ') + data.filename;
    if (data.brief) return String(data.brief);
    if (data.projectDir) return 'Project: ' + data.projectDir;
    return JSON.stringify(ev.data || {});
  }
  function renderEvents() {
    const focusedEvent = document.activeElement && document.activeElement.dataset.event;
    const source = state.paused ? state.frozen : state.events;
    const filtered = source.filter(ev => {
      const cat = category(ev);
      const matches = state.filter === 'all' || (state.filter === 'tools' ? tools.some(t => t.id === ev.tool) : cat === state.filter);
      return matches && (!state.search || ((ev.tool || ev.type || '') + ' ' + JSON.stringify(ev.data)).toLowerCase().includes(state.search));
    });
    const limit = state.view === 'overview' ? 5 : 200;
    const shown = filtered.slice(0,limit);
    $('event-count').textContent = num(source.length);
    $('nav-events').textContent = num(state.events.length);
    $('clear-search').hidden = state.filter === 'all' && !state.search;
    $('all-activity').hidden = state.view === 'activity' || !$('clear-search').hidden;
    $('feed-status').textContent = (state.paused ? 'Feed paused · ' : '') + (source.length ? 'Showing ' + shown.length + ' of ' + filtered.length + ' events' : 'Listening for workspace activity');
    if (!shown.length) {
      $('events').innerHTML = empty(source.length ? 'No matching events' : 'Ready when you are.',source.length ? 'Try another filter or search term.' : 'Tool calls and project updates will appear here as you work.');
      return;
    }
    $('events').innerHTML = shown.map(ev => '<div class="event-row ' + category(ev) + '"><div class="event-name"><span class="event-dot"></span><button data-event="' + esc(ev.id) + '" title="View event details">' + esc(ev.tool || ev.type || 'Event') + '</button></div><span class="event-summary" title="' + esc(summary(ev)) + '">' + esc(summary(ev)) + '</span><time class="event-time" datetime="' + esc(ev.timestamp) + '">' + time(ev.timestamp) + '</time></div>').join('');
    if (focusedEvent) {
      const target = Array.from($('events').querySelectorAll('[data-event]')).find(button => button.dataset.event === focusedEvent);
      if (target) target.focus({preventScroll:true});
      else { $('events').tabIndex = -1; $('events').focus({preventScroll:true}); }
    }
  }
  function renderProject() {
    const p = state.project; if (!p) return;
    $('workspace-name').textContent = p.projectName || 'Local project';
    $('metric-files').textContent = num(p.totalFiles);
    $('note-files').textContent = num(p.totalLines) + ' lines of source';
    const deps = Object.entries(object(p.dependencies));
    const devDeps = Object.entries(object(p.devDependencies));
    const framework = !p.framework || p.framework === 'unknown' ? 'Not detected' : p.framework;
    const branch = p.hasGit ? (p.gitBranch || 'No commits yet') : 'Not initialized';
    $('project-summary').innerHTML = '<h3 class="project-name">' + esc(p.projectName || 'Local project') + '</h3><p class="project-path" title="' + esc(p.projectDir) + '">' + esc(p.projectDir) + '</p><div class="project-tags"><span class="tag green">' + esc(p.language || 'JavaScript') + '</span><span class="tag">' + esc(p.packageManager || 'npm') + '</span></div>' + rows([['Framework',framework],['Git branch',branch],['Components',num(list(p.components).length)],['Design tokens',num(Object.keys(object(p.tokens)).length)],['Dependencies',num(deps.length + devDeps.length) + ' packages']]);
    const tags = values => values.length ? '<div class="file-list">' + values.map(x => '<span class="tag">' + esc(x) + '</span>').join('') + '</div>' : '<p class="project-path">None detected</p>';
    $('project-details').innerHTML = '<div class="detail-grid"><div><h3>Environment</h3>' + rows([['Project',p.projectName],['Directory',p.projectDir],['Framework',framework + ' ' + (p.frameworkVersion || '')],['Language',p.language],['Node.js',p.nodeVersion],['Package manager',p.packageManager],['Source directory',p.srcDir],['Git branch',branch],['Atelier state',p.hasAtelier ? 'Available' : 'Not created yet']]) + '<h3>Configuration files</h3>' + tags(list(p.configFiles)) + '<h3>File types</h3>' + rows(Object.entries(object(p.filesByExtension))) + '</div><div><h3>Production dependencies</h3>' + (deps.length ? rows(deps) : '<p>No production dependencies.</p>') + '<h3>Development dependencies</h3>' + (devDeps.length ? rows(devDeps) : '<p>No development dependencies.</p>') + '<h3>Scripts</h3>' + rows(Object.entries(object(p.scripts))) + '<h3>Components</h3>' + tags(list(p.components).map(c => object(c).file || object(c).name || 'Unnamed')) + '<h3>Design tokens</h3>' + rows(Object.entries(object(p.tokens))) + '</div></div>';
  }
  function renderPlans() {
    $('metric-plans').textContent = num(state.plans.length);
    $('plan-count').textContent = num(state.plans.length);
    $('note-plans').textContent = state.plans.filter(p => p.status === 'applied').length + ' applied · ' + state.plans.filter(p => p.status !== 'applied' && p.status !== 'rolled_back').length + ' in progress';
    if (!state.plans.length) {
      $('plans').innerHTML = '<div class="empty-state empty-plans"><span class="empty-icon" aria-hidden="true">◇</span><div><h3>A little planning goes a long way.</h3><p>Your design plans will appear here. Ask your assistant to prepare a design to get started.</p></div><button class="text-button" data-guide>Explore the workflow ↗</button></div>';
      return;
    }
    const visible = state.view === 'overview' ? state.plans.slice(0,3) : state.plans;
    $('plans').innerHTML = '<div class="plans-list">' + visible.map(p => '<button class="plan-row" data-plan="' + esc(p.id) + '"><span class="plan-symbol">◇</span><span><span class="plan-name">' + esc(p.brief || object(p.direction).name || p.id || 'Untitled plan') + '</span><span class="plan-meta">' + esc(p.id) + ' · ' + list(p.changes).length + ' file changes</span></span><span class="plan-status">' + esc(String(p.status || 'draft').replace(/_/g,' ')) + '</span><span class="plan-date">' + date(p.createdAt) + '</span></button>').join('') + '</div>';
  }
  function route(event) {
    const next = location.hash.slice(1);
    state.view = Object.hasOwn(views,next) ? next : 'overview';
    const [label,title,description] = views[state.view];
    $('breadcrumb').textContent = label; $('page-title').textContent = title; $('page-description').textContent = description;
    document.title = label + ' · Atelier Monitor';
    document.querySelectorAll('[data-nav]').forEach(a => { const active = a.dataset.nav === state.view; a.classList.toggle('active',active); if (active) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
    const visibility = { 'topology-panel':['overview','tools'], 'project-panel':['overview','project'], 'activity-panel':['overview','activity'], 'usage-panel':['overview','activity'], 'plans-panel':['overview','plans'], 'project-detail':['project'], 'tools-panel':['tools'] };
    Object.entries(visibility).forEach(([id,pages]) => { $(id).hidden = !pages.includes(state.view); });
    $('metrics').hidden = state.view === 'tools';
    $('dashboard-grid').classList.toggle('focused',state.view !== 'overview');
    $('all-plans').hidden = state.view === 'plans';
    renderEvents(); renderPlans();
    if (event && document.activeElement !== $('event-search')) { window.scrollTo(0,0); $('main').focus({preventScroll:true}); }
  }
  function renderConnection() {
    $('connection').classList.toggle('offline',!state.connected);
    $('connection-text').textContent = state.connected ? 'Live connection' : 'Reconnecting';
    $('footer-status').textContent = state.connected ? 'Connected to your local workspace' : 'Connection interrupted · retrying automatically';
    $('notice').hidden = !state.failures.size;
    $('notice').textContent = state.failures.size ? 'Could not load ' + [...state.failures].join(', ') + '. Showing the last available data. Use Refresh to try again.' : '';
  }
  function renderClock() {
    if (state.startedAt === null) return;
    const seconds = Math.max(0,Math.floor((Date.now() - state.startedAt) / 1000));
    const h = Math.floor(seconds/3600), m = Math.floor(seconds%3600/60), s = seconds%60;
    $('metric-uptime').textContent = h ? h + 'h ' + String(m).padStart(2,'0') + 'm' : String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    $('note-uptime').textContent = state.connected ? 'Current server session' : 'Last known server session';
  }
  function normalizeEvents(values) {
    const seen = new Set();
    return list(values).filter(e => e && typeof e === 'object' && typeof e.id === 'string' && typeof e.timestamp === 'string' && !seen.has(e.id) && seen.add(e.id)).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0,200);
  }
  async function request(path) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(),8000);
    try { const response = await fetch('/api/' + path,{signal:controller.signal}); if (!response.ok) throw new Error('HTTP ' + response.status); return await response.json(); } finally { clearTimeout(timeout); }
  }
  async function refresh(manual = false) {
    if (state.refreshing) return;
    state.refreshing = true; $('refresh').disabled = true;
    const endpoints = ['project','plans','changes','status'];
    try {
      await Promise.all(endpoints.map(async path => {
        try {
          const data = await request(path);
          if ((path === 'plans' || path === 'changes') ? !Array.isArray(data) : !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Unexpected response');
          if (path === 'project') { state.project = data; renderProject(); }
          if (path === 'plans') { state.plans = data.filter(p => p && typeof p === 'object'); renderPlans(); }
          if (path === 'changes') state.changes = data;
          if (path === 'status' && Number.isFinite(Number(data.uptime))) { state.startedAt = Date.now() - Number(data.uptime)*1000; renderClock(); }
          state.failures.delete(path);
        } catch { state.failures.add(path); }
      }));
      renderConnection();
      if (manual) toast(state.failures.size ? 'Some data could not be refreshed.' : 'Workspace is up to date.');
    } finally { state.refreshing = false; $('refresh').disabled = false; }
  }
  let socket, reconnectTimer, refreshTimer, retry = 1000, stopped = false;
  function scheduleRefresh() { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => refresh(),300); }
  function connect() {
    if (stopped) return;
    clearTimeout(reconnectTimer);
    try { socket = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host); } catch { reconnectTimer = setTimeout(connect,retry); retry = Math.min(retry*2,30000); return; }
    socket.onopen = () => { state.connected = true; retry = 1000; renderConnection(); refresh(); };
    socket.onclose = () => { state.connected = false; renderConnection(); if (!stopped) { reconnectTimer = setTimeout(connect,retry); retry = Math.min(retry*2,30000); } };
    socket.onerror = () => { socket.close(); };
    socket.onmessage = message => {
      let data; try { data = JSON.parse(message.data); } catch { return; }
      if (!data || typeof data !== 'object') return;
      if (data.type === 'init') {
        state.events = normalizeEvents(data.events); state.received = true;
        if (Number.isFinite(data.uptime)) state.startedAt = Date.now() - data.uptime*1000;
        renderUsage(); renderEvents(); renderClock();
      } else if (data.type === 'event' && data.payload && typeof data.payload === 'object') {
        state.events = normalizeEvents([data.payload,...state.events]);
        renderUsage(); renderEvents();
        const tool = tools.find(t => t.id === data.payload.tool);
        if (tool) { const node = document.querySelector('.tool-node[data-tool="' + tool.id + '"]'); if (node) { node.classList.remove('flashed'); void node.offsetWidth; node.classList.add('flashed'); } }
        if (['file_change','change_applied'].includes(data.payload.type) || ['prepare_design','apply_changes','rollback_changes'].includes(data.payload.tool)) scheduleRefresh();
      } else if (data.type === 'refresh') scheduleRefresh();
    };
  }
  document.addEventListener('click',event => {
    if (event.target.closest('.skip-link')) { event.preventDefault(); $('main').focus(); return; }
    const tool = event.target.closest('[data-tool]'); if (tool) { toolDetails(tool.dataset.tool); return; }
    const filter = event.target.closest('[data-filter]'); if (filter) { state.filter = filter.dataset.filter; renderFilters(); renderEvents(); document.querySelector('[data-filter="' + state.filter + '"]').focus(); return; }
    const evButton = event.target.closest('[data-event]'); if (evButton) { const ev = [...state.events,...state.frozen].find(e => e.id === evButton.dataset.event); if (ev) dialog(ev.tool || ev.type || 'Event',rows([['Category',category(ev)],['Recorded',date(ev.timestamp) + ' at ' + time(ev.timestamp)]]) + '<h3>Event details</h3><pre>' + esc(JSON.stringify(ev.data,null,2)) + '</pre>'); return; }
    const planButton = event.target.closest('[data-plan]'); if (planButton) { const p = state.plans.find(p => String(p.id) === planButton.dataset.plan); if (p) dialog(p.brief || 'Design plan',rows([['Plan ID',p.id],['Status',p.status || 'draft'],['Created',date(p.createdAt)],['Change records',state.changes.filter(c => c && c.planId === p.id).length]]) + '<h3>Plan details</h3><pre>' + esc(JSON.stringify(p,null,2)) + '</pre>'); return; }
    if (event.target.closest('[data-guide]')) guide();
  });
  $('event-search').addEventListener('input',event => { state.search = event.target.value.trim().toLowerCase(); renderEvents(); });
  $('clear-search').addEventListener('click',() => { state.search = ''; state.filter = 'all'; $('event-search').value = ''; renderFilters(); renderEvents(); $('event-search').focus(); });
  $('pause').addEventListener('click',() => { state.paused = !state.paused; if (state.paused) state.frozen = state.events.slice(); else state.frozen = []; $('pause').setAttribute('aria-pressed',String(state.paused)); $('pause').innerHTML = state.paused ? '▷ <span>Resume feed</span>' : 'Ⅱ <span>Pause feed</span>'; renderEvents(); });
  $('refresh').addEventListener('click',() => refresh(true));
  $('export').addEventListener('click',() => {
    if (!state.project) { toast('Wait for your project to load before exporting.'); return; }
    const snapshot = { exportedAt:new Date().toISOString(),project:state.project,events:state.events,plans:state.plans,changes:state.changes };
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = 'atelier-snapshot-' + new Date().toISOString().slice(0,10) + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),1000); toast('Snapshot exported.');
  });
  $('guide-open').addEventListener('click',guide); $('help-open').addEventListener('click',guide);
  $('dialog-close').addEventListener('click',() => $('detail-dialog').close());
  $('detail-dialog').addEventListener('click',e => { if (e.target === $('detail-dialog')) { const rect = e.target.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) e.target.close(); } });
  document.addEventListener('keydown',event => {
    if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable || $('detail-dialog').open) return;
    if (event.key === '/') { event.preventDefault(); if (!['overview','activity'].includes(state.view)) { location.hash = 'activity'; route(); } $('event-search').focus(); }
    if (event.key === '?') { event.preventDefault(); guide(); }
  });
  window.addEventListener('hashchange',route);
  const heartbeat = setInterval(() => { if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({type:'ping'})); },25000);
  const polling = setInterval(() => { if (!document.hidden) refresh(); },30000);
  const clock = setInterval(() => { if (state.connected) renderClock(); },1000);
  window.addEventListener('pagehide',() => { stopped = true; clearTimeout(reconnectTimer); clearTimeout(refreshTimer); clearInterval(heartbeat); clearInterval(polling); clearInterval(clock); if (socket) socket.close(); });
  window.addEventListener('pageshow',event => { if (event.persisted) location.reload(); });
  renderTools(); renderFilters(); renderUsage(); route(); refresh(); connect();
})();
`;
