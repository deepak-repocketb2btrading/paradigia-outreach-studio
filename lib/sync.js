'use strict';
/*
 * Inbox sync: reads recent Gmail messages and matches them to leads.
 *  - reply from a lead (same thread or their address)  -> status "Replied", sequence paused
 *  - "unsubscribe" reply                                -> suppressed
 *  - out-of-office / auto-reply                         -> note only (configurable)
 *  - mailer-daemon bounce                               -> status "Bounced", suppressed
 *  - your own replies sent from Gmail directly          -> added to the thread view
 */
const HEADERS = ['From', 'To', 'Cc', 'Subject', 'Date', 'Message-ID', 'References', 'In-Reply-To', 'Auto-Submitted', 'X-Autoreply', 'X-Autorespond', 'Precedence', 'X-Failed-Recipients'];

function parseAddress(s) {
  const str = String(s || '').trim();
  const m = str.match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/);
  if (m) return { name: (m[1] || '').trim(), email: m[2].trim().toLowerCase() };
  return { name: '', email: str.toLowerCase() };
}
const parseList = (s) => String(s || '').split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(parseAddress).filter((a) => a.email.includes('@'));

function decode(data) {
  try { return Buffer.from(data, 'base64url').toString('utf8'); } catch { return ''; }
}
function extractBody(payload) {
  let text = '';
  let html = '';
  (function walk(p) {
    if (!p) return;
    if (p.mimeType === 'text/plain' && p.body && p.body.data && !text) text = decode(p.body.data);
    else if (p.mimeType === 'text/html' && p.body && p.body.data && !html) html = decode(p.body.data);
    (p.parts || []).forEach(walk);
  })(payload);
  if (!text && html) text = html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();
  return { text, html };
}
function stripQuoted(text) {
  const cut = String(text || '').search(/\n\s*(On .{5,200}wrote:|-{2,}\s*Original Message|From: .+\n(Sent|Date): )|\n>/i);
  return (cut > 0 ? text.slice(0, cut) : text).trim();
}
function isAutoReply(H) {
  const as = (H['auto-submitted'] || '').toLowerCase();
  if (as && as !== 'no') return true;
  if (H['x-autoreply'] || H['x-autorespond']) return true;
  if (/auto_reply/i.test(H.precedence || '')) return true;
  return /^(automatic reply|auto(matic)?[- ]?reply|autoreply|out of (the )?office|ooo\b|away from (the )?office|on leave)/i.test((H.subject || '').trim());
}
function isUnsubscribe(H, text) {
  if (/^\s*(re:\s*)?unsubscribe\b/i.test(H.subject || '')) return true;
  const top = stripQuoted(text).slice(0, 300);
  return /\b(unsubscribe|remove me|opt[\s-]?out|stop (emailing|sending|contacting))\b/i.test(top) && top.length < 300;
}

module.exports = function createSync(store, google, engine, bus) {
  const db = () => store.db;
  const running = new Set();

  function maps() {
    const email = new Map();
    for (const l of db().leads) if (l.email) email.set(l.email.toLowerCase(), l);
    const thread = new Map();
    for (const e of db().enrollments) if (e.threadId) thread.set(e.threadId, e.leadId);
    for (const m of db().messages) if (m.threadId && m.leadId) thread.set(m.threadId, m.leadId);
    return { email, thread };
  }
  const headerMap = (msg) => Object.fromEntries(((msg.payload && msg.payload.headers) || []).map((h) => [h.name.toLowerCase(), h.value]));
  const known = (id) => db().messages.some((m) => m.id === id);

  /** Returns 'reply' | 'auto' | 'unsub' | 'out' | 'bounce' | null */
  async function processMessage(account, ref, M) {
    if (known(ref.id)) return null;
    const meta = await google.api(account, 'GET', `/messages/${ref.id}`, { query: [['format', 'metadata'], ...HEADERS.map((h) => ['metadataHeaders', h])] });
    const H = headerMap(meta);
    const from = parseAddress(H.from);
    const threadLeadId = M.thread.get(meta.threadId);

    if (from.email === account) {
      const to = parseList(`${H.to || ''},${H.cc || ''}`);
      const lead = (threadLeadId && db().leads.find((l) => l.id === threadLeadId)) || to.map((a) => M.email.get(a.email)).find(Boolean);
      if (!lead) return null;
      const full = await google.api(account, 'GET', `/messages/${ref.id}`, { query: { format: 'full' } });
      const body = extractBody(full.payload);
      db().messages.push({ id: meta.id, threadId: meta.threadId, leadId: lead.id, accountEmail: account, direction: 'out', source: 'gmail', from: account, to: H.to, subject: H.subject || '', date: new Date(Number(full.internalDate)).toISOString(), rfcId: H['message-id'], text: body.text.slice(0, 12000), snippet: full.snippet || '' });
      M.thread.set(meta.threadId, lead.id);
      if (!lead.lastContactedAt || lead.lastContactedAt < new Date(Number(full.internalDate)).toISOString()) lead.lastContactedAt = new Date(Number(full.internalDate)).toISOString();
      return 'out';
    }

    if (/^(mailer-daemon|postmaster)@/i.test(from.email)) {
      const full = await google.api(account, 'GET', `/messages/${ref.id}`, { query: { format: 'full' } });
      const body = extractBody(full.payload);
      const failed = new Set(String(H['x-failed-recipients'] || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
      for (const m of `${body.text}`.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) failed.add(m[0].toLowerCase());
      let hit = false;
      for (const em of failed) {
        const lead = M.email.get(em);
        if (lead && lead.status !== 'bounced' && db().messages.some((x) => x.leadId === lead.id && x.direction === 'out')) {
          engine.markBounced(lead, (stripQuoted(body.text).split('\n').find((l) => l.trim()) || '').slice(0, 160));
          hit = true;
        }
      }
      return hit ? 'bounce' : null;
    }

    const lead = M.email.get(from.email) || (threadLeadId && db().leads.find((l) => l.id === threadLeadId));
    if (!lead) return null;
    const full = await google.api(account, 'GET', `/messages/${ref.id}`, { query: { format: 'full' } });
    const body = extractBody(full.payload);
    const msg = {
      id: meta.id, threadId: meta.threadId, leadId: lead.id, accountEmail: account, direction: 'in', source: 'gmail',
      from: from.email, fromName: from.name, to: H.to, subject: H.subject || '', date: new Date(Number(full.internalDate)).toISOString(),
      rfcId: H['message-id'], snippet: full.snippet || '', text: body.text.slice(0, 20000), html: body.html.slice(0, 200000),
    };
    if (known(msg.id)) return null;
    db().messages.push(msg);
    M.thread.set(meta.threadId, lead.id);
    if (isUnsubscribe(H, body.text)) { msg.kind = 'unsubscribe'; engine.markUnsubscribed(lead, 'replied “unsubscribe”'); return 'unsub'; }
    if (isAutoReply(H)) { msg.kind = 'auto'; engine.noteAutoReply(lead, msg); return 'auto'; }
    msg.kind = 'reply';
    engine.markReplied(lead, msg);
    return 'reply';
  }

  async function syncAccount(account, opts = {}) {
    if (running.has(account)) return { skipped: true };
    running.add(account);
    const acct = db().accounts.find((a) => a.email === account);
    const st = db().sync[account] || (db().sync[account] = { processed: [] });
    const processed = new Set(st.processed || []);
    const stats = { scanned: 0, replies: 0, bounces: 0, unsubscribes: 0 };
    try {
      const days = opts.days || (st.lastSyncAt ? 3 : 21);
      const refs = [];
      let pageToken;
      for (let page = 0; page < 6; page++) {
        const r = await google.api(account, 'GET', '/messages', { query: { q: `newer_than:${days}d -in:chats -in:drafts -in:spam -in:trash`, maxResults: '100', ...(pageToken ? { pageToken } : {}) } });
        refs.push(...(r.messages || []));
        pageToken = r.nextPageToken;
        if (!pageToken) break;
      }
      const fresh = refs.filter((r) => !processed.has(r.id));
      stats.scanned = fresh.length;
      const M = maps();
      for (let i = 0; i < fresh.length; i += 5) {
        const chunk = fresh.slice(i, i + 5);
        const results = await Promise.all(chunk.map((r) => processMessage(account, r, M).catch((e) => { console.error('[sync]', e.message); return 'err'; })));
        chunk.forEach((r, j) => { if (results[j] !== 'err') processed.add(r.id); });
        for (const res of results) {
          if (res === 'reply') stats.replies++;
          if (res === 'bounce') stats.bounces++;
          if (res === 'unsub') stats.unsubscribes++;
        }
      }
      st.processed = Array.from(processed).slice(-8000);
      st.lastSyncAt = new Date().toISOString();
      if (acct) { acct.lastSyncAt = st.lastSyncAt; acct.lastError = ''; }
      engine.changed('sync');
      return stats;
    } catch (e) {
      if (acct) acct.lastError = e.message;
      store.save();
      throw e;
    } finally {
      running.delete(account);
    }
  }

  /** Called right before a follow-up goes out: was there a reply in this thread? */
  async function checkThread(account, threadId, since) {
    try {
      const t = await google.api(account, 'GET', `/threads/${threadId}`, { query: [['format', 'metadata'], ['metadataHeaders', 'From']] });
      const M = maps();
      let replied = false;
      for (const m of t.messages || []) {
        if (known(m.id)) {
          const k = db().messages.find((x) => x.id === m.id);
          if (k && k.direction === 'in' && k.kind === 'reply' && (!since || k.date > since)) replied = true;
          continue;
        }
        const from = parseAddress((((m.payload || {}).headers || []).find((h) => h.name.toLowerCase() === 'from') || {}).value);
        if (from.email === account) continue;
        const res = await processMessage(account, m, M);
        if (res === 'reply' || res === 'unsub' || res === 'bounce') replied = true;
      }
      return replied;
    } catch (e) {
      console.error('[sync] thread check failed', e.message);
      return false;
    }
  }

  async function syncAll() {
    const out = {};
    for (const a of db().accounts) {
      if (a.needsReconnect || !store.secrets.tokens[a.email]) continue;
      try { out[a.email] = await syncAccount(a.email); } catch (e) { out[a.email] = { error: e.message }; }
    }
    return out;
  }

  return { syncAll, syncAccount, checkThread, stripQuoted };
};
