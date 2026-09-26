import { dashboardStyles } from './dashboard-styles.js';
import { dashboardScript } from './dashboard-client.js';

const paths: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  activity: '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
  box: '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 9v10M3 8l9 4 9-4M7.5 5.5l9 5v5"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
  network: '<rect x="8" y="8" width="8" height="8" rx="2"/><path d="M12 2v6m0 8v6M2 12h6m8 0h6M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  branch: '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10m12-9a9 9 0 0 1-9 9H6"/>',
  code: '<path d="m8 5-7 7 7 7m8-14 7 7-7 7m-5 2 2-18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
export function icon(name: string): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
}

export function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark"><meta name="theme-color" content="#111412">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23c3edb1'/%3E%3Cpath d='m8 24 8-17 8 17M11 18h10' fill='none' stroke='%23111412' stroke-width='3'/%3E%3C/svg%3E">
<title>Overview · Atelier Monitor</title><style>${dashboardStyles}</style></head>
<body><a class="skip-link" href="#main">Skip to content</a>
<aside class="sidebar" aria-label="Main navigation">
  <a class="brand" href="#overview" aria-label="Atelier overview"><span class="brand-mark">a<span>↗</span></span><span>atelier<span class="brand-period">.</span></span><span class="edition">MCP</span></a>
  <div class="workspace"><span class="workspace-icon">${icon('box')}</span><div><span class="eyebrow">WORKSPACE</span><strong id="workspace-name">Local project</strong></div><span class="workspace-dot"></span></div>
  <div class="nav-label">WORKSPACE</div>
  <nav>${[['overview','grid','Overview'],['activity','activity','Activity'],['project','box','Project'],['plans','layers','Design plans'],['tools','network','Tool library']].map(([id,ic,label])=>`<a class="nav-item${id==='overview'?' active':''}" href="#${id}" data-nav="${id}"${id==='overview'?' aria-current="page"':''}>${icon(ic)}<span>${label}</span>${id==='activity'?'<span class="nav-count" id="nav-events">0</span>':''}</a>`).join('')}</nav>
  <div class="sidebar-bottom"><div class="local-card"><span class="local-title"><span class="status-dot"></span> Your local control room</span><p>Project context. Every tool call.<br>All in one place.</p><button class="text-button" id="guide-open">Getting started ${icon('arrow')}</button></div><button class="nav-item help-button" id="help-open">${icon('help')}<span>Help & shortcuts</span><kbd>?</kbd></button><div class="sidebar-footer"><span class="mini-brand">a.</span><span>Neurolink monitor</span><span class="version">v0.1</span></div></div>
</aside>
<div class="shell"><header class="topbar"><div class="breadcrumb">Workspace <span>/</span> <strong id="breadcrumb">Overview</strong></div><div class="topbar-right"><span class="local-label">${icon('code')} Local environment</span><span class="connection" id="connection" role="status"><span class="status-dot"></span><span id="connection-text">Connecting</span></span></div></header>
<main id="main" tabindex="-1"><div class="page-heading"><div><div class="eyebrow page-eyebrow">ATELIER NEUROLINK</div><h1 id="page-title">Your project, in focus.</h1><p id="page-description">A live view of your tools, activity, and design workflow.</p></div><div class="page-actions"><button class="button" id="refresh">${icon('refresh')}<span>Refresh</span></button><button class="button primary" id="export">${icon('download')}<span>Export snapshot</span></button></div></div>
<div id="notice" class="notice" role="status" hidden></div>
<section class="metrics" id="metrics" aria-label="Project at a glance">
${[['calls','Tool calls','activity','Across recent activity'],['files','Project files','code','Source & configuration'],['plans','Design plans','layers','Your design workflow'],['uptime','Monitor uptime','clock','Current server session']].map(([id,label,ic,note])=>`<article class="metric"><div class="metric-label">${label}${icon(ic)}</div><div class="metric-value" id="metric-${id}">—</div><div class="metric-note" id="note-${id}">${id==='uptime'?'<span class="status-dot"></span>':''}${note}</div></article>`).join('')}
</section>
<div class="dashboard-grid" id="dashboard-grid">
<section class="panel topology-panel" id="topology-panel"><div class="panel-header"><div><h2>Tool topology <span class="count-badge">10</span></h2><p>Your design workflow, connected.</p></div><span class="quiet-label"><span class="status-dot"></span> EVENT DRIVEN</span></div><div class="topology" id="topology"><svg class="connections" viewBox="0 0 800 310" preserveAspectRatio="none" aria-hidden="true"><path d="M140 68H310Q340 68 340 120V152H400M140 235H310Q340 235 340 190V152M400 152H460V100Q460 68 490 68H655M400 152H460V205Q460 235 490 235H655"/><path d="M400 112v-18m0 97v20" stroke-dasharray="3 5"/></svg><div class="topology-core"><span class="core-symbol">a<span>↗</span></span><strong>ATELIER</strong><small>DESIGN ENGINE</small></div><div class="tool-cluster inspection"><div class="cluster-label"><span></span>INSPECT</div><div id="nodes-inspection"></div></div><div class="tool-cluster recipes"><div class="cluster-label"><span></span>DISCOVER</div><div id="nodes-recipes"></div></div><div class="tool-cluster planning"><div class="cluster-label"><span></span>PLAN</div><div id="nodes-planning"></div></div><div class="tool-cluster execution"><div class="cluster-label"><span></span>EXECUTE</div><div id="nodes-execution"></div></div></div><div class="panel-footer"><span><span class="legend-dot"></span> Select a tool to explore its activity</span><a href="#tools">View all tools ${icon('arrow')}</a></div></section>
<section class="panel project-panel" id="project-panel"><div class="panel-header"><h2>Project at a glance</h2><span class="square-icon">${icon('box')}</span></div><div id="project-summary" class="project-summary"><div class="empty-state"><p>Reading your project…</p></div></div><a class="panel-link" href="#project">Explore project ${icon('arrow')}</a></section>
<section class="panel activity-panel" id="activity-panel"><div class="panel-header"><div><h2>Live activity <span class="count-badge" id="event-count">0</span></h2><p id="activity-subtitle">The latest signals from your workspace.</p></div><button class="button compact" id="pause" aria-pressed="false">Ⅱ <span>Pause feed</span></button></div><div class="activity-controls"><div class="filters" id="filters" role="group" aria-label="Filter activity"></div><label class="search">${icon('search')}<input type="search" id="event-search" aria-label="Search events" placeholder="Search events…"><kbd>/</kbd></label></div><div class="event-table"><div class="event-table-head"><span>EVENT</span><span>DETAILS</span><span>TIME</span></div><div id="events" class="events"></div></div><div class="panel-footer"><span id="feed-status">Waiting for activity</span><button class="text-button" id="clear-search" hidden>Clear filters ${icon('close')}</button><a href="#activity" id="all-activity">View all activity ${icon('arrow')}</a></div></section>
<section class="panel usage-panel" id="usage-panel"><div class="panel-header"><div><h2>Tool usage</h2><p>Calls by workflow stage.</p></div>${icon('activity')}</div><div id="usage" class="usage"></div><div class="usage-note"><span class="legend-dot"></span> Based on the latest 200 events</div></section>
<section class="panel plans-panel" id="plans-panel"><div class="panel-header"><div><h2>Design plans <span class="count-badge" id="plan-count">0</span></h2><p>From the first idea to the final change.</p></div><a href="#plans" class="text-link" id="all-plans">View all plans ${icon('arrow')}</a></div><div id="plans"></div></section>
<section class="panel detail-panel" id="project-detail" hidden><div class="panel-header"><h2>Project details</h2>${icon('box')}</div><div id="project-details" class="detail-content"></div></section>
<section class="panel tools-panel" id="tools-panel" hidden><div class="panel-header"><div><h2>The Atelier toolkit</h2><p>Ten tools. One considered design workflow.</p></div><span class="count-badge">10 tools</span></div><div id="tool-library" class="tool-library"></div></section>
</div><footer class="page-footer"><span><span class="status-dot"></span><span id="footer-status">Connecting to your workspace</span></span><span>Designed for a more thoughtful workflow. <span class="footer-mark">a.</span></span></footer></main></div>
<dialog id="detail-dialog" aria-labelledby="dialog-title"><div class="dialog-header"><h2 id="dialog-title">Details</h2><button class="icon-button" id="dialog-close" aria-label="Close details">${icon('close')}</button></div><div id="dialog-content"></div></dialog><div class="toast" id="toast" role="status" hidden></div>
<noscript><div class="noscript">Enable JavaScript to view live project activity.</div></noscript><script>${dashboardScript}</script></body></html>`;
}
