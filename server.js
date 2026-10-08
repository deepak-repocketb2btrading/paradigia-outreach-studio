#!/usr/bin/env node
'use strict';
/*
 * Paradigia Outreach Studio: local server.
 * Runs only on this computer (127.0.0.1). No npm packages required (Node 18+).
 *   node server.js        then open http://localhost:5050
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const PORT = Number(process.env.PORT) || 5050;
const HOST = '127.0.0.1';
const ROOT = __dirname;
const DATA = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');

const bus = new EventEmitter();
bus.setMaxListeners(50);
const store = require('./lib/store')(DATA, ROOT);
const google = require('./lib/google')(store, PORT);
const engine = require('./lib/engine')(store, google, bus);
const sync = require('./lib/sync')(store, google, engine, bus);
engine.setSync(sync);

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.ico': 'image/x-icon', '.csv': 'text/csv' };
const COLLECTIONS = new Set(['leads', 'team', 'signatures', 'sequences', 'customBlocks']);

/* ----------------------------------------------------------------- helpers */
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const NEXT = Symbol('next-route');

function send(res, status, body, headers) {
  const isBuf = Buffer.isBuffer(body);
  const payload = isBuf || typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': isBuf || typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json', 'Cache-Control': 'no-store', ...(headers || {}) });
  res.end(payload);
}

function readBody(req, limit = 80 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Upload is too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) {
  const buf = await readBody(req);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); } catch { throw new HttpError(400, 'Invalid JSON'); }
}

function serveFile(res, file, extraHeaders) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache', ...(extraHeaders || {}) });
    fs.createReadStream(file).pipe(res);
  });
}

function safeJoin(base, rel) {
  const p = path.normalize(path.join(base, rel));
  if (!p.startsWith(base)) throw new HttpError(403, 'Forbidden');
  return p;
}

/** App state for the UI: no secrets, no heavy message bodies. */
function publicState() {
  const db = store.db;
  return {
    ...db,
    messages: db.messages.map((m) => ({ ...m, html: undefined, text: undefined, hasHtml: !!m.html })),
    google: {
      configured: google.configured(),
      redirectUri: google.redirectUri(),
      clientId: store.secrets.google.clientId ? store.secrets.google.clientId.replace(/^(.{8}).*(.{24})$/, '$1…$2') : '',
      connected: Object.keys(store.secrets.tokens || {}),
    },
    runtime: engine.runtime(),
    paths: { data: DATA },
  };
}

function cleanLead(input, existing) {
  const l = { ...(existing || {}), ...input };
  l.email = String(l.email || '').trim().toLowerCase();
  for (const k of ['firstName', 'lastName', 'company', 'phone', 'linkedin', 'title', 'tierInterest']) l[k] = String(l[k] == null ? '' : l[k]).trim();
  l.tags = Array.isArray(l.tags) ? Array.from(new Set(l.tags.map((t) => String(t).trim()).filter(Boolean))) : [];
  l.notes = Array.isArray(l.notes) ? l.notes : [];
  l.status = l.status || 'new';
  l.updatedAt = new Date().toISOString();
  if (!l.createdAt) l.createdAt = l.updatedAt;
  return l;
}

const STATUS_KEYS = new Set(['new', 'contacted', 'followup', 'replied', 'interested', 'meeting', 'won', 'lost', 'unsubscribed', 'bounced']);
function normaliseStatus(s) {
  const k = String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  const alias = { followup: 'followup', followedup: 'followup', notinterested: 'lost', closed: 'won', closedwon: 'won', closedlost: 'lost', meetingbooked: 'meeting', unsubscribe: 'unsubscribed', bounce: 'bounced', open: 'new', lead: 'new', '': 'new' };
  if (STATUS_KEYS.has(k)) return k;
  return alias[k] || 'new';
}

/* ------------------------------------------------------------------ routes */
const routes = [];
const route = (method, pattern, fn) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), fn });

route('GET', '/api/state', (req, res) => send(res, 200, publicState()));

route('GET', '/api/events', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
  res.write('retry: 3000\n\n');
  const fn = (e) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  bus.on('event', fn);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { bus.off('event', fn); clearInterval(ping); });
});

route('PUT', '/api/settings', async (req, res) => {
  const body = await readJson(req);
  const s = store.db.settings;
  for (const [k, v] of Object.entries(body)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) s[k] = { ...s[k], ...v };
    else s[k] = v;
  }
  engine.changed('settings');
  send(res, 200, { ok: true });
});

route('GET', '/api/messages', (req, res, { query }) => {
  const list = store.db.messages.filter((m) => m.leadId === query.get('leadId')).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  send(res, 200, list);
});

route('POST', '/api/leads/import', async (req, res) => {
  const { rows = [], mode = 'update', list = '' } = await readJson(req);
  const byEmail = new Map(store.db.leads.map((l) => [l.email, l]));
  let added = 0; let updated = 0; let skipped = 0; let invalid = 0;
  const tag = String(list || '').trim();
  for (const raw of rows) {
    const email = String(raw.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { invalid++; continue; }
    const existing = byEmail.get(email);
    const fields = { ...raw, email };
    if (fields.status) fields.status = normaliseStatus(fields.status); else delete fields.status;
    if (fields.notes && typeof fields.notes === 'string') {
      const text = fields.notes.trim();
      fields.notes = text ? [{ id: store.id('n'), at: new Date().toISOString(), text: `Imported note: ${text}` }] : [];
    }
    if (existing) {
      if (mode === 'skip') { if (tag && !existing.tags.includes(tag)) existing.tags.push(tag); skipped++; continue; }
      const merged = { ...existing };
      for (const [k, v] of Object.entries(fields)) {
        if (k === 'notes') merged.notes = [...(existing.notes || []), ...(v || []).filter((nn) => !(existing.notes || []).some((x) => x.text === nn.text))];
        else if (k === 'status') { if (existing.status === 'new') merged.status = v; }
        else if (v !== '' && v != null) merged[k] = v;
      }
      if (tag) merged.tags = [...(existing.tags || []), tag];
      Object.assign(existing, cleanLead(merged, existing));
      updated++;
    } else {
      const lead = cleanLead({ ...fields, id: store.id('l'), tags: tag ? [tag] : [], source: tag || 'CSV import' });
      if (store.db.suppression.some((x) => x.email === email)) lead.status = store.db.suppression.find((x) => x.email === email).reason === 'bounced' ? 'bounced' : 'unsubscribed';
      store.db.leads.push(lead);
      byEmail.set(email, lead);
      added++;
    }
  }
  store.log('import', `CSV import${tag ? ` “${tag}”` : ''}: ${added} added, ${updated} updated, ${skipped} skipped, ${invalid} invalid`);
  engine.changed('leads');
  send(res, 200, { added, updated, skipped, invalid });
});

route('POST', '/api/leads/bulk', async (req, res) => {
  const { ids = [], action, value } = await readJson(req);
  const set = new Set(ids);
  const leads = store.db.leads.filter((l) => set.has(l.id));
  if (action === 'delete') {
    store.db.leads = store.db.leads.filter((l) => !set.has(l.id));
    store.db.enrollments = store.db.enrollments.filter((e) => !set.has(e.leadId));
    engine.cancelQueued((q) => set.has(q.leadId), 'Lead deleted');
  } else if (action === 'status') {
    for (const l of leads) {
      l.status = normaliseStatus(value);
      if (l.status === 'unsubscribed' || l.status === 'bounced') engine.suppress(l.email, l.status);
      l.updatedAt = new Date().toISOString();
    }
  } else if (action === 'tag') {
    for (const l of leads) if (value && !l.tags.includes(value)) l.tags.push(value);
  } else if (action === 'untag') {
    for (const l of leads) l.tags = l.tags.filter((t) => t !== value);
  } else if (action === 'tier') {
    for (const l of leads) l.tierInterest = value;
  } else if (action === 'read') {
    for (const l of leads) l.unread = false;
  } else throw new HttpError(400, 'Unknown action');
  engine.changed('leads');
  send(res, 200, { ok: true, count: leads.length });
});

route('POST', '/api/leads/:id/notes', async (req, res, { params }) => {
  const lead = store.db.leads.find((l) => l.id === params.id);
  if (!lead) throw new HttpError(404, 'Lead not found');
  const { text } = await readJson(req);
  if (!String(text || '').trim()) throw new HttpError(400, 'Empty note');
  lead.notes = lead.notes || [];
  lead.notes.push({ id: store.id('n'), at: new Date().toISOString(), text: String(text).trim() });
  engine.changed('leads');
  send(res, 200, lead);
});

route('DELETE', '/api/leads/:id/notes/:nid', (req, res, { params }) => {
  const lead = store.db.leads.find((l) => l.id === params.id);
  if (!lead) throw new HttpError(404, 'Lead not found');
  lead.notes = (lead.notes || []).filter((n) => n.id !== params.nid);
  engine.changed('leads');
  send(res, 200, lead);
});

route('POST', '/api/:col', async (req, res, { params }) => {
  if (!COLLECTIONS.has(params.col)) return NEXT;
  const body = await readJson(req);
  const col = store.db[params.col];
  let item = { ...body, id: body.id && !col.some((x) => x.id === body.id) ? body.id : store.id(params.col[0]) };
  if (params.col === 'leads') {
    item = cleanLead(item);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item.email)) throw new HttpError(400, 'Please enter a valid email address.');
    if (col.some((l) => l.email === item.email)) throw new HttpError(409, 'A lead with this email already exists.');
    item.source = item.source || 'Manual';
  }
  col.push(item);
  engine.changed(params.col);
  send(res, 200, item);
});

route('PUT', '/api/:col/:id', async (req, res, { params }) => {
  if (!COLLECTIONS.has(params.col)) return NEXT;
  const body = await readJson(req);
  const col = store.db[params.col];
  const i = col.findIndex((x) => x.id === params.id);
  if (i < 0) throw new HttpError(404, 'Not found');
  let item = { ...col[i], ...body, id: params.id };
  if (params.col === 'leads') {
    item = cleanLead(item, col[i]);
    if (col.some((l) => l.email === item.email && l.id !== params.id)) throw new HttpError(409, 'Another lead already uses this email.');
    if (item.status === 'unsubscribed' || item.status === 'bounced') engine.suppress(item.email, item.status);
  }
  if (params.col === 'team' && body.name && col[i].placeholder && body.name !== col[i].name) item.placeholder = false;
  col[i] = item;
  engine.changed(params.col);
  send(res, 200, item);
});

route('DELETE', '/api/:col/:id', (req, res, { params }) => {
  if (!COLLECTIONS.has(params.col)) return NEXT;
  const col = store.db[params.col];
  const i = col.findIndex((x) => x.id === params.id);
  if (i < 0) throw new HttpError(404, 'Not found');
  if (params.col === 'sequences' && store.db.queue.some((q) => q.state === 'queued' && q.sequenceId === params.id)) {
    engine.cancelQueued((q) => q.sequenceId === params.id, 'Sequence deleted');
  }
  if (params.col === 'leads') {
    store.db.enrollments = store.db.enrollments.filter((e) => e.leadId !== params.id);
    engine.cancelQueued((q) => q.leadId === params.id, 'Lead deleted');
  }
  col.splice(i, 1);
  engine.changed(params.col);
  send(res, 200, { ok: true });
});

// Reorder team members or signatures (the first signature is the default).
route('POST', '/api/order/:col', async (req, res, { params }) => {
  if (!['team', 'signatures'].includes(params.col)) throw new HttpError(404, 'Unknown collection');
  const { ids = [] } = await readJson(req);
  const rank = new Map(ids.map((id, i) => [id, i]));
  store.db[params.col].sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 1e9) - (rank.has(b.id) ? rank.get(b.id) : 1e9));
  engine.changed(params.col);
  send(res, 200, { ok: true });
});

route('POST', '/api/send', async (req, res) => send(res, 200, engine.queueSend(await readJson(req))));
route('POST', '/api/enroll', async (req, res) => send(res, 200, engine.enroll(await readJson(req))));
route('POST', '/api/enrollments/:id/:action', (req, res, { params }) => send(res, 200, engine.setEnrollmentState(params.id, params.action)));

route('POST', '/api/queue/:id/:action', (req, res, { params }) => {
  const q = store.db.queue.find((x) => x.id === params.id);
  if (!q) throw new HttpError(404, 'Not found');
  if (params.action === 'cancel' && q.state === 'queued') {
    q.state = 'cancelled'; q.error = 'Cancelled by you';
    const e = q.auto && store.db.enrollments.find((x) => x.id === q.enrollmentId);
    if (e && e.state === 'active') { e.state = 'paused'; e.pausedReason = 'manual'; }
  }
  else if (params.action === 'retry' && (q.state === 'failed' || q.state === 'cancelled')) { q.state = 'queued'; q.attempts = 0; q.error = ''; q.scheduledAt = new Date().toISOString(); }
  else if (params.action === 'now' && q.state === 'queued') { q.scheduledAt = new Date().toISOString(); q.respectWindow = false; }
  engine.changed('queue');
  setTimeout(engine.tick, 100);
  send(res, 200, q);
});

route('POST', '/api/queue-clear', (req, res) => {
  store.db.queue = store.db.queue.filter((q) => q.state === 'queued' || q.state === 'sending');
  engine.changed('queue');
  send(res, 200, { ok: true });
});

route('POST', '/api/test-send', async (req, res) => send(res, 200, await engine.sendTest(await readJson(req))));
route('POST', '/api/reply', async (req, res) => send(res, 200, await engine.sendReply(await readJson(req))));
route('POST', '/api/sync', async (req, res) => send(res, 200, await sync.syncAll()));

route('GET', '/api/export', (req, res, { query }) => {
  const out = engine.exportHtml({ sequenceId: query.get('sequenceId'), stepId: query.get('stepId'), leadId: query.get('leadId') || '', keepTags: query.get('keepTags') === '1' });
  send(res, 200, out);
});

route('GET', '/api/backup', (req, res, { query }) => {
  const payload = store.exportBackup({ files: query.get('files') !== '0', includeSecrets: query.get('secrets') === '1' });
  const name = `paradigia-outreach-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
  send(res, 200, JSON.stringify(payload), { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${name}"` });
});

route('POST', '/api/restore', async (req, res) => {
  const payload = await readJson(req);
  store.restoreBackup(payload);
  engine.changed('all');
  send(res, 200, { ok: true });
});

route('POST', '/api/reset', (req, res) => { store.resetAll(); engine.changed('all'); send(res, 200, { ok: true }); });

route('POST', '/api/upload', async (req, res, { query }) => {
  const kind = query.get('kind') || 'image';
  const original = path.basename(decodeURIComponent(String(req.headers['x-filename'] || 'file')));
  const ext = (path.extname(original) || '').toLowerCase();
  const allowed = kind === 'deck' ? ['.pdf'] : ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  if (!allowed.includes(ext)) throw new HttpError(400, kind === 'deck' ? 'Please upload a PDF.' : 'Please upload a PNG, JPG, GIF or WebP image.');
  const buf = await readBody(req, 40 * 1024 * 1024);
  const name = kind === 'deck' ? `deck-${Date.now()}${ext}` : `${kind}-${store.id()}${ext}`;
  fs.writeFileSync(path.join(store.uploadsDir, name), buf);
  if (kind === 'deck') {
    store.db.settings.deck = { ...store.db.settings.deck, upload: `upload:${name}`, fileName: original, size: buf.length, uploadedAt: new Date().toISOString() };
    store.log('deck', `Sponsorship deck replaced: ${original} (${(buf.length / 1048576).toFixed(1)} MB)`);
    engine.changed('settings');
  }
  send(res, 200, { ref: `upload:${name}`, url: `/uploads/${name}`, size: buf.length, warn: buf.length > 10 * 1024 * 1024 });
});

route('PUT', '/api/google/credentials', async (req, res) => {
  const body = await readJson(req);
  let clientId = String(body.clientId || '').trim();
  let clientSecret = String(body.clientSecret || '').trim();
  if (body.json) {
    let j;
    try { j = typeof body.json === 'string' ? JSON.parse(body.json) : body.json; } catch { throw new HttpError(400, 'That file is not valid JSON.'); }
    const c = j.installed || j.web || j;
    clientId = c.client_id || clientId;
    clientSecret = c.client_secret || clientSecret;
  }
  if (!/\.apps\.googleusercontent\.com$/.test(clientId)) throw new HttpError(400, 'The Client ID should end with .apps.googleusercontent.com');
  if (!clientSecret) throw new HttpError(400, 'Client secret is missing.');
  store.secrets.google = { clientId, clientSecret };
  store.saveSecrets();
  engine.changed('google');
  send(res, 200, { ok: true });
});

route('GET', '/oauth/start', (req, res, { query }) => {
  try {
    res.writeHead(302, { Location: google.authUrl(query.get('hint') || '') });
    res.end();
  } catch (e) {
    res.writeHead(302, { Location: `/#/settings?oauthError=${encodeURIComponent(e.message)}` });
    res.end();
  }
});

route('GET', '/oauth2callback', async (req, res, { query }) => {
  try {
    const email = await google.handleCallback(Object.fromEntries(query));
    engine.changed('accounts');
    sync.syncAccount(email).catch((e) => console.error('[sync] first sync failed', e.message));
    res.writeHead(302, { Location: `/#/settings?connected=${encodeURIComponent(email)}` });
  } catch (e) {
    res.writeHead(302, { Location: `/#/settings?oauthError=${encodeURIComponent(e.message)}` });
  }
  res.end();
});

route('PUT', '/api/accounts/:email', async (req, res, { params }) => {
  const email = decodeURIComponent(params.email);
  const a = store.db.accounts.find((x) => x.email === email);
  if (!a) throw new HttpError(404, 'Account not found');
  const body = await readJson(req);
  for (const k of ['displayName', 'signatureId', 'paused']) if (k in body) a[k] = body[k];
  if ('dailyLimit' in body) a.dailyLimit = Math.max(1, Math.min(500, Number(body.dailyLimit) || 60));
  engine.changed('accounts');
  send(res, 200, a);
});

route('POST', '/api/accounts/:email/disconnect', (req, res, { params }) => {
  const email = decodeURIComponent(params.email);
  google.disconnect(email);
  store.db.accounts = store.db.accounts.filter((a) => a.email !== email);
  store.log('account', `Disconnected ${email}`);
  engine.changed('accounts');
  send(res, 200, { ok: true });
});

route('POST', '/api/suppression', async (req, res) => {
  const { email, reason } = await readJson(req);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || '').trim())) throw new HttpError(400, 'Enter a valid email.');
  engine.suppress(email, reason || 'manual');
  const lead = store.db.leads.find((l) => l.email === String(email).trim().toLowerCase());
  if (lead) { lead.status = reason === 'bounced' ? 'bounced' : 'unsubscribed'; engine.cancelQueued((q) => q.leadId === lead.id, 'Suppressed'); }
  engine.changed('suppression');
  send(res, 200, { ok: true });
});

route('DELETE', '/api/suppression/:email', (req, res, { params }) => {
  const email = decodeURIComponent(params.email).toLowerCase();
  store.db.suppression = store.db.suppression.filter((x) => x.email !== email);
  const lead = store.db.leads.find((l) => l.email === email);
  if (lead && (lead.status === 'unsubscribed' || lead.status === 'bounced')) lead.status = 'contacted';
  engine.changed('suppression');
  send(res, 200, { ok: true });
});

/* ------------------------------------------------------------------ server */
const allowedHosts = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);

const server = http.createServer(async (req, res) => {
  try {
    if (!allowedHosts.has(String(req.headers.host || ''))) return send(res, 403, 'Forbidden host');
    const u = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = decodeURIComponent(u.pathname);

    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = pathname.match(r.re);
      if (!m) continue;
      if (req.method !== 'GET' && pathname.startsWith('/api/')) {
        const origin = req.headers.origin;
        if (origin && !allowedHosts.has(origin.replace(/^https?:\/\//, ''))) return send(res, 403, { error: 'Cross-origin request blocked' });
      }
      const out = await r.fn(req, res, { params: m.groups || {}, query: u.searchParams });
      if (out === NEXT) continue;
      return;
    }

    if (req.method !== 'GET') return send(res, 404, { error: 'Not found' });
    if (pathname.startsWith('/uploads/')) return serveFile(res, safeJoin(store.uploadsDir, pathname.slice(9)));
    if (pathname.startsWith('/shared/')) return serveFile(res, safeJoin(path.join(ROOT, 'shared'), pathname.slice(8)));
    if (pathname === '/' || pathname === '/index.html') return serveFile(res, path.join(ROOT, 'public', 'index.html'));
    return serveFile(res, safeJoin(path.join(ROOT, 'public'), pathname));
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error('[server]', e);
    if (!res.headersSent) send(res, status, { error: e.message || 'Server error' });
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`\nPort ${PORT} is already in use. Is Outreach Studio already running? Open http://localhost:${PORT}\n`);
  else console.error(e);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Paradigia Outreach Studio is running.\n  Open  http://localhost:${PORT}\n  Data  ${DATA}\n  (Keep this window open while you send. Press Ctrl+C to stop.)\n`);
  store.dailyBackup();
});

/* ---------------------------------------------------------------- schedule */
setInterval(() => engine.tick(), 15000);
setTimeout(() => engine.tick(), 3000);
(function syncLoop() {
  const mins = Math.max(1, Number(store.db.settings.sending.syncMinutes) || 3);
  setTimeout(async () => {
    try { await sync.syncAll(); } catch (e) { console.error('[sync]', e.message); }
    syncLoop();
  }, mins * 60e3);
})();
setTimeout(() => sync.syncAll().catch(() => {}), 8000);
setInterval(() => store.dailyBackup(), 6 * 3600e3);

function shutdown() { try { store.saveNow(); } catch { /* ignore */ } process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
