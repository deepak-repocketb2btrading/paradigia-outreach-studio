import { $, D, esc, icon, loadState, onState, startEvents, fail, api, ok, ago } from './core.js';
import * as dashboard from './views/dashboard.js';
import * as leads from './views/leads.js';
import * as sequences from './views/sequences.js';
import * as editor from './views/editor.js';
import * as inbox from './views/inbox.js';
import * as outbox from './views/outbox.js';
import * as team from './views/team.js';
import * as signatures from './views/signatures.js';
import * as settings from './views/settings.js';

const NAV = [
  { key: 'dashboard', label: 'Overview', icon: 'home', view: dashboard },
  { key: 'leads', label: 'Leads', icon: 'users', view: leads },
  { key: 'sequences', label: 'Sequences', icon: 'layers', view: sequences },
  { key: 'inbox', label: 'Inbox', icon: 'inbox', view: inbox },
  { key: 'outbox', label: 'Outbox', icon: 'send', view: outbox },
  '-',
  { key: 'team', label: 'Team', icon: 'team', view: team },
  { key: 'signatures', label: 'Signatures', icon: 'pen', view: signatures },
  { key: 'settings', label: 'Settings', icon: 'settings', view: settings },
];
const VIEWS = { dashboard, leads, sequences, editor, inbox, outbox, team, signatures, settings };

let current = null;
let pendingRefresh = false;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '').split('#')[0];
  const [p, qs] = raw.split('?');
  const parts = p.split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || 'dashboard', params: parts.slice(1), query: new URLSearchParams(qs || '') };
}

function renderNav() {
  const { name } = parseHash();
  const d = D();
  const unread = d ? d.leads.filter((l) => l.unread).length : 0;
  const queued = d ? d.queue.filter((q) => q.state === 'queued').length : 0;
  $('#nav').innerHTML = NAV.map((n) => n === '-' ? '<div class="nav-sep"></div>' :
    `<a href="#/${n.key}" class="${name === n.key || (name === 'editor' && n.key === 'sequences') ? 'active' : ''}">${icon(n.icon)}<span>${n.label}</span>${n.key === 'inbox' && unread ? `<span class="count">${unread}</span>` : ''}${n.key === 'outbox' && queued ? `<span class="count" style="background:#2A2A36">${queued}</span>` : ''}</a>`).join('');
  const accts = d ? d.accounts : [];
  const conn = d ? d.google.connected : [];
  $('#side-foot').innerHTML = (accts.length ? accts.map((a) => {
    const rt = (d.runtime.accounts || []).find((x) => x.email === a.email) || {};
    const st = a.needsReconnect || !conn.includes(a.email) ? 'bad' : a.paused ? 'warn' : 'ok';
    return `<div class="acct-chip" data-go="settings">${'<span class="dot ' + st + '"></span>'}<div class="grow"><b>${esc(a.email)}</b>${st === 'bad' ? 'Reconnect needed' : a.paused ? 'Sending paused' : `${rt.sentToday || 0}/${rt.limit || a.dailyLimit} today · synced ${a.lastSyncAt ? ago(a.lastSyncAt) : 'never'}`}</div></div>`;
  }).join('') : `<div class="acct-chip" data-go="settings"><span class="dot warn"></span><div class="grow"><b>Gmail not connected</b>Connect in Settings</div></div>`) +
    `<button class="btn sm" id="sync-now">${icon('refresh')} Sync inbox now</button>`;
  $('#side-foot').querySelectorAll('[data-go]').forEach((el) => el.addEventListener('click', () => { location.hash = '#/settings'; }));
  $('#sync-now').onclick = async (e) => {
    const b = e.currentTarget;
    b.disabled = true; b.innerHTML = `${icon('refresh')} Syncing…`;
    try {
      const r = await api('POST', '/api/sync');
      const vals = Object.values(r);
      if (!vals.length) ok('Connect a Gmail account first to sync replies.');
      else {
        const errs = vals.filter((v) => v.error);
        if (errs.length) fail(errs[0].error);
        else ok(`Synced: ${vals.reduce((n, v) => n + (v.replies || 0), 0)} new replies, ${vals.reduce((n, v) => n + (v.bounces || 0), 0)} bounces`);
      }
      loadState();
    } catch (err) { fail(err); }
    b.disabled = false; b.innerHTML = `${icon('refresh')} Sync inbox now`;
  };
}

async function route() {
  const { name, params, query } = parseHash();
  const view = VIEWS[name] || dashboard;
  if (current && current !== view && current.leave) {
    const okToLeave = await current.leave();
    if (okToLeave === false) return;
  }
  current = view;
  renderNav();
  const el = $('#view');
  el.scrollTop = 0;
  try { view.render(el, params, query); } catch (e) { console.error(e); el.innerHTML = `<div class="page"><div class="notice err">${icon('alert')}<div>${esc(e.message)}</div></div></div>`; }
}

function isTyping() {
  const a = document.activeElement;
  return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable || a.tagName === 'IFRAME');
}

function refreshCurrent() {
  renderNav();
  if (!current) return;
  if (isTyping() || document.querySelector('.overlay, .drawer-wrap')) { pendingRefresh = true; return; }
  pendingRefresh = false;
  if (current.refresh) current.refresh();
}

document.addEventListener('focusout', () => setTimeout(() => { if (pendingRefresh && !isTyping() && !document.querySelector('.overlay, .drawer-wrap')) refreshCurrent(); }, 50));
document.addEventListener('ui:closed', () => { if (pendingRefresh) refreshCurrent(); });

window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', (e) => { if (current && current.dirty && current.dirty()) { e.preventDefault(); e.returnValue = ''; } });

(async function boot() {
  try {
    await loadState();
  } catch (e) {
    $('#view').innerHTML = `<div class="page"><div class="notice err">${icon('alert')}<div>Could not reach the local server. Is <b>node server.js</b> still running?<br>${esc(e.message)}</div></div></div>`;
    return;
  }
  onState(refreshCurrent);
  startEvents();
  route();
  setInterval(() => renderNav(), 30000);
})();
