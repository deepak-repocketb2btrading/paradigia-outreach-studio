'use strict';
/*
 * Sending engine: queue, sequences (enrollments), lead pipeline status,
 * daily limits / throttling, sending window, replies, test sends and export.
 */
const fs = require('fs');
const path = require('path');
const PRender = require('../shared/render');
const PSeed = require('../shared/seed');
const { buildMessage } = require('./mime');

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf' };
const RANK = { new: 0, contacted: 1, followup: 2, replied: 3 };
const pad = (n) => String(n).padStart(2, '0');

/* ---------------------------------------------------------------- time zone */
function zonedParts(date, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}
function tzOffset(date, tz) {
  const p = zonedParts(date, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}
function zonedToUtc(y, m, d, h, mi, tz) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - tzOffset(new Date(guess), tz);
  const off2 = tzOffset(new Date(t), tz);
  t = guess - off2;
  return new Date(t);
}
const dayKey = (date, tz) => { const p = zonedParts(date, tz); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
const hm = (s, def) => { const [h, m] = String(s || def).split(':').map(Number); return (h || 0) * 60 + (m || 0); };

module.exports = function createEngine(store, google, bus) {
  const db = () => store.db;
  const S = () => db().settings;
  const tz = () => (S().sending && S().sending.timezone) || 'Asia/Dubai';
  const now = () => new Date();
  let sync = null; // set later (circular)
  const lastSendAt = {};
  const nextGap = {};

  const emit = (type, payload) => bus.emit('event', { type, ...(payload || {}) });
  const changed = (what) => { store.save(); emit('changed', { what }); };

  /* --------------------------------------------------------------- lookups */
  const leadById = (id) => db().leads.find((l) => l.id === id);
  const seqById = (id) => db().sequences.find((s) => s.id === id);
  const acctByEmail = (e) => db().accounts.find((a) => a.email === e);
  const isSuppressed = (email) => db().suppression.some((x) => x.email === String(email || '').toLowerCase());

  function pickSignature(signatureId, accountEmail) {
    const sigs = db().signatures;
    return sigs.find((s) => s.id === signatureId)
      || sigs.find((s) => s.accountEmail && s.accountEmail === accountEmail)
      || sigs.find((s) => s.id === (acctByEmail(accountEmail) || {}).signatureId)
      || sigs[0] || {};
  }

  function sentToday(email) {
    const today = dayKey(now(), tz());
    return db().messages.filter((m) => m.direction === 'out' && m.accountEmail === email && m.source !== 'gmail' && dayKey(new Date(m.date), tz()) === today).length;
  }

  function withinWindow(d) {
    const s = S().sending || {};
    const p = zonedParts(d, tz());
    if (s.skipWeekends && (s.weekendDays || [0, 6]).includes(p.wd)) return false;
    const mins = p.h * 60 + p.mi;
    return mins >= hm(s.windowStart, '09:00') && mins < hm(s.windowEnd, '19:00');
  }

  /** When should step `idx` go out, given the previous send time? */
  function computeDue(seq, idx, base) {
    const st = seq.steps[idx];
    if (!st) return null;
    const s = S().sending || {};
    const [hh, mm] = String(st.sendTime || '10:00').split(':').map(Number);
    let target;
    if (st.fixedDate) {
      const [y, m, d] = st.fixedDate.split('-').map(Number);
      target = zonedToUtc(y, m, d, hh || 0, mm || 0, tz());
    } else {
      const b = base ? new Date(base) : now();
      const p = zonedParts(b, tz());
      const day = new Date(Date.UTC(p.y, p.m - 1, p.d) + (Number(st.delayDays) || 0) * 86400e3);
      target = zonedToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hh || 0, mm || 0, tz());
      if (!(Number(st.delayDays) > 0) && target < b) target = b;
      let guard = 0;
      while (s.skipWeekends && (s.weekendDays || [0, 6]).includes(zonedParts(target, tz()).wd) && guard++ < 7) target = new Date(target.getTime() + 86400e3);
    }
    return target.toISOString();
  }

  /* ------------------------------------------------------------ statuses */
  function setAutoStatus(lead, to) {
    if (to === 'unsubscribed' || to === 'bounced') { lead.status = to; return; }
    const cur = lead.status || 'new';
    if (!(cur in RANK)) return; // manual stages (interested, meeting, won, lost) win over automation
    if (RANK[to] > RANK[cur]) lead.status = to;
  }

  function cancelQueued(filter, reason) {
    let n = 0;
    for (const q of db().queue) if (q.state === 'queued' && filter(q)) { q.state = 'cancelled'; q.error = reason; n++; }
    return n;
  }

  function markReplied(lead, msg) {
    setAutoStatus(lead, 'replied');
    lead.lastReplyAt = msg.date;
    lead.unread = true;
    lead.updatedAt = new Date().toISOString();
    for (const e of db().enrollments) {
      if (e.leadId === lead.id && e.state === 'active') { e.state = 'paused'; e.pausedReason = 'replied'; e.repliedAt = msg.date; }
      else if (e.leadId === lead.id && !e.repliedAt) e.repliedAt = msg.date;
    }
    const n = cancelQueued((q) => q.leadId === lead.id, 'Lead replied, sequence paused');
    store.log('reply', `${lead.firstName || lead.email} replied${n ? ` · ${n} scheduled email${n > 1 ? 's' : ''} cancelled` : ''}`, { leadId: lead.id });
    emit('reply', { leadId: lead.id, name: [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.email, company: lead.company, subject: msg.subject });
    changed('leads');
  }

  function noteAutoReply(lead, msg) {
    lead.notes = lead.notes || [];
    lead.notes.push({ id: store.id('n'), at: new Date().toISOString(), text: `Auto-reply received: “${msg.subject || ''}”`, auto: true });
    if (S().sending.autoReplyPauses) return markReplied(lead, msg);
    store.log('auto-reply', `Auto-reply from ${lead.email} (sequence keeps running)`, { leadId: lead.id });
    changed('leads');
  }

  function suppress(email, reason) {
    const e = String(email || '').toLowerCase();
    if (!e || isSuppressed(e)) return;
    db().suppression.push({ email: e, reason, at: new Date().toISOString() });
  }

  function stopLead(lead, reason) {
    for (const e of db().enrollments) if (e.leadId === lead.id && (e.state === 'active' || e.state === 'paused')) { e.state = 'stopped'; e.pausedReason = reason; }
    cancelQueued((q) => q.leadId === lead.id, reason);
  }

  function markUnsubscribed(lead, via) {
    lead.status = 'unsubscribed';
    lead.unread = true;
    suppress(lead.email, 'unsubscribed');
    stopLead(lead, 'unsubscribed');
    store.log('unsubscribe', `${lead.email} unsubscribed (${via})`, { leadId: lead.id });
    emit('notice', { text: `${lead.email} unsubscribed and was added to the suppression list.` });
    changed('leads');
  }

  function markBounced(lead, detail) {
    lead.status = 'bounced';
    suppress(lead.email, 'bounced');
    stopLead(lead, 'bounced');
    store.log('bounce', `${lead.email} bounced${detail ? `: ${detail}` : ''}`, { leadId: lead.id });
    emit('notice', { text: `${lead.email} bounced and was suppressed.` });
    changed('leads');
  }

  /* --------------------------------------------------------- rendering */
  function assetFile(ref) {
    if (ref.startsWith('brand:')) return path.join(__dirname, '..', 'public', 'brand', path.basename(ref.slice(6)));
    if (ref.startsWith('upload:')) return path.join(store.uploadsDir, path.basename(ref.slice(7)));
    if (ref.startsWith('seed:')) return path.join(__dirname, '..', 'seed', path.basename(ref.slice(5)));
    return null;
  }

  function baseCtx({ lead, signature, account, deckMode }) {
    return { settings: S(), team: db().team, signature, account, lead, deckMode };
  }

  /** Render for Gmail: images become inline CID parts (or public URLs if configured). */
  function renderForSend(doc, ctx) {
    const inline = new Map();
    const base = (S().publicAssetBase || '').replace(/\/+$/, '');
    const asset = (ref) => {
      if (base) return `${base}/${path.basename(ref.replace(/^\w+:/, ''))}`;
      const file = assetFile(ref);
      if (!file || !fs.existsSync(file)) return '';
      const name = path.basename(file);
      const cid = `${name.replace(/[^a-z0-9.]/gi, '')}@paradigia`;
      if (!inline.has(cid)) inline.set(cid, { cid, filename: name, contentType: MIME[path.extname(name).toLowerCase()] || 'application/octet-stream', data: fs.readFileSync(file) });
      return `cid:${cid}`;
    };
    const out = PRender.renderEmail(doc, { ...ctx, asset });
    const text = PRender.renderText(doc, ctx);
    return { ...out, text, inline: Array.from(inline.values()) };
  }

  /** Export: public URLs if configured, otherwise images embedded as data URIs. */
  function exportHtml({ sequenceId, stepId, leadId, keepTags }) {
    const seq = seqById(sequenceId);
    const st = seq && seq.steps.find((x) => x.id === stepId);
    if (!st) throw new Error('Step not found');
    const lead = leadId ? leadById(leadId) : PSeed.sampleLead();
    const base = (S().publicAssetBase || '').replace(/\/+$/, '');
    const asset = (ref) => {
      if (base) return `${base}/${path.basename(ref.replace(/^\w+:/, ''))}`;
      const file = assetFile(ref);
      if (!file || !fs.existsSync(file)) return '';
      return `data:${MIME[path.extname(file).toLowerCase()] || 'image/png'};base64,${fs.readFileSync(file).toString('base64')}`;
    };
    const sig = pickSignature('', (db().accounts[0] || {}).email);
    const ctx = { ...baseCtx({ lead, signature: sig, account: db().accounts[0], deckMode: deckModeFor(seq, st) }), asset, resolve: keepTags ? false : undefined };
    const subject = st.subjects[st.subjectIndex || 0] || st.subjects[0] || '';
    return { html: PRender.renderEmail({ subject, preheader: st.preheader, blocks: st.blocks }, ctx).html, hosted: !!base };
  }

  const deckModeFor = (seq, st, override) => override || (st && st.deck && st.deck !== 'inherit' ? st.deck : (seq && seq.deckChoice) || 'off');

  function deckAttachment() {
    const d = S().deck || {};
    const file = d.upload && assetFile(d.upload);
    if (!file || !fs.existsSync(file)) return null;
    return { filename: d.fileName || path.basename(file), contentType: 'application/pdf', data: fs.readFileSync(file) };
  }

  function listUnsubscribe(fromEmail) {
    const u = S().unsubscribe || {};
    const parts = [`<mailto:${fromEmail}?subject=unsubscribe>`];
    if (u.mode === 'url' && u.url) parts.unshift(`<${u.url}>`);
    return parts.join(', ');
  }

  /* ------------------------------------------------------- A/B subjects */
  function pickVariant(step, forced) {
    const subs = step.subjects || [];
    if (forced != null && subs[forced]) return forced;
    if (!step.abTest) return subs[step.subjectIndex || 0] ? (step.subjectIndex || 0) : 0;
    const candidates = subs.map((s, i) => (s && s.trim() ? i : -1)).filter((i) => i >= 0 && (!step.abVariants || step.abVariants.includes(i)));
    if (!candidates.length) return 0;
    const counts = Object.fromEntries(candidates.map((i) => [i, 0]));
    for (const m of db().messages) if (m.stepId === step.id && m.direction === 'out' && m.variant in counts) counts[m.variant]++;
    return candidates.sort((a, b) => counts[a] - counts[b])[0];
  }

  /* ----------------------------------------------------------- sending */
  function ensureEnrollment(lead, seq, o) {
    let e = db().enrollments.find((x) => x.leadId === lead.id && x.sequenceId === seq.id && x.state !== 'stopped');
    if (!e) {
      e = { id: store.id('e'), leadId: lead.id, sequenceId: seq.id, accountEmail: o.accountEmail, signatureId: o.signatureId || '', auto: false, state: 'active', nextStepIndex: 0, history: [], createdAt: new Date().toISOString() };
      db().enrollments.push(e);
    }
    return e;
  }

  async function sendStep({ lead, seq, stepIdx, enr, accountEmail, signatureId, deckMode, subjectIndex }) {
    const step = seq.steps[stepIdx];
    const acct = acctByEmail(accountEmail);
    if (!acct) throw new Error(`Gmail account ${accountEmail} is not connected.`);
    const signature = pickSignature(signatureId || (enr && enr.signatureId), accountEmail);
    const mode = deckModeFor(seq, step, deckMode);
    const threadIn = step.threadReply && enr && enr.threadId && enr.firstSubject && enr.accountEmail === accountEmail;
    const variant = pickVariant(step, subjectIndex);
    const ctx = baseCtx({ lead, signature, account: acct, deckMode: mode });
    const data = PRender.mergeData(lead, ctx);
    let subject = PRender.merge(step.subjects[variant] || step.subjects[0] || '', data, 'text');
    if (threadIn) subject = /^re:/i.test(enr.firstSubject) ? enr.firstSubject : `Re: ${enr.firstSubject}`;
    const r = renderForSend({ subject, preheader: step.preheader, blocks: step.blocks }, ctx);
    const attachments = [];
    if (mode === 'attach') { const a = deckAttachment(); if (a) attachments.push(a); }
    const fromName = acct.displayName || signature.name || '';
    const { raw, messageId } = buildMessage({
      from: { name: fromName, email: accountEmail },
      to: { name: [lead.firstName, lead.lastName].filter(Boolean).join(' '), email: lead.email },
      subject,
      html: r.html, text: r.text, inline: r.inline, attachments,
      inReplyTo: threadIn ? enr.lastMessageId : '', references: threadIn ? enr.references : '',
      listUnsubscribe: listUnsubscribe(accountEmail),
    });
    const res = await google.sendRaw(accountEmail, raw, threadIn ? enr.threadId : undefined);
    let rfcId = messageId;
    try {
      const meta = await google.api(accountEmail, 'GET', `/messages/${res.id}`, { query: [['format', 'metadata'], ['metadataHeaders', 'Message-ID']] });
      const h = (meta.payload && meta.payload.headers || []).find((x) => x.name.toLowerCase() === 'message-id');
      if (h) rfcId = h.value;
    } catch { /* keep generated id */ }

    const at = new Date().toISOString();
    const priorOut = db().messages.some((m) => m.leadId === lead.id && m.direction === 'out');
    db().messages.push({
      id: res.id, threadId: res.threadId, leadId: lead.id, accountEmail, direction: 'out', source: 'app',
      from: accountEmail, fromName, to: lead.email, subject, date: at, rfcId,
      text: r.text.slice(0, 12000), snippet: PRender.htmlToText(step.blocks.filter((b) => b.type === 'text').map((b) => PRender.merge(b.html, data, 'text')).join(' ')).slice(0, 300),
      sequenceId: seq.id, stepId: step.id, stepName: step.name, variant, deckMode: mode, attached: attachments.length > 0,
    });
    const st = db().sync[accountEmail] || (db().sync[accountEmail] = { processed: [] });
    st.processed.push(res.id);

    lead.lastContactedAt = at;
    lead.updatedAt = at;
    setAutoStatus(lead, priorOut ? 'followup' : 'contacted');

    const e = enr || ensureEnrollment(lead, seq, { accountEmail, signatureId });
    if (!threadIn) { e.firstSubject = subject; e.references = ''; }
    e.threadId = res.threadId;
    e.accountEmail = accountEmail;
    e.lastMessageId = rfcId;
    e.references = [e.references, rfcId].filter(Boolean).join(' ').split(' ').slice(-10).join(' ');
    e.lastSentAt = at;
    e.history = e.history || [];
    e.history.push({ stepId: step.id, stepIndex: stepIdx, sentAt: at, gmailId: res.id, subject, variant });
    e.nextStepIndex = Math.max(e.nextStepIndex || 0, stepIdx + 1);
    if (e.nextStepIndex >= seq.steps.length && e.state === 'active') e.state = 'completed';
    if (e.auto && e.state === 'active') scheduleNext(e);

    store.log('sent', `Sent “${step.name}” to ${lead.email}`, { leadId: lead.id, sequenceId: seq.id });
    return { gmailId: res.id, threadId: res.threadId, subject };
  }

  function scheduleNext(e) {
    const seq = seqById(e.sequenceId);
    if (!seq) return;
    const idx = e.nextStepIndex || 0;
    if (idx >= seq.steps.length) { e.state = 'completed'; return; }
    const step = seq.steps[idx];
    if (db().queue.some((q) => q.state === 'queued' && q.enrollmentId === e.id && q.stepId === step.id)) return;
    const due = computeDue(seq, idx, e.lastSentAt);
    db().queue.push({ id: store.id('q'), kind: 'step', leadId: e.leadId, enrollmentId: e.id, sequenceId: seq.id, stepId: step.id, accountEmail: e.accountEmail, signatureId: e.signatureId || '', deckMode: e.deckMode || '', scheduledAt: due, respectWindow: true, state: 'queued', attempts: 0, createdAt: new Date().toISOString(), auto: true });
  }

  async function sendQueueItem(item) {
    item.state = 'sending';
    const cancel = (why) => { item.state = 'cancelled'; item.error = why; };
    try {
      const lead = leadById(item.leadId);
      if (!lead) return cancel('Lead was deleted');
      if (isSuppressed(lead.email) || lead.status === 'unsubscribed' || lead.status === 'bounced') return cancel('Lead is suppressed (unsubscribed or bounced)');
      const seq = seqById(item.sequenceId);
      const idx = seq ? seq.steps.findIndex((s) => s.id === item.stepId) : -1;
      if (idx < 0) return cancel('Step no longer exists');
      const enr = item.enrollmentId ? db().enrollments.find((e) => e.id === item.enrollmentId) : null;
      if (enr && (enr.state === 'paused' || enr.state === 'stopped') && item.auto) return cancel(`Sequence ${enr.state}`);
      if (enr && enr.threadId && sync) {
        const replied = await sync.checkThread(enr.accountEmail || item.accountEmail, enr.threadId, enr.lastSentAt);
        if (replied && item.auto) return cancel('Lead replied, sequence paused');
      }
      const res = await sendStep({ lead, seq, stepIdx: idx, enr, accountEmail: item.accountEmail, signatureId: item.signatureId, deckMode: item.deckMode, subjectIndex: item.subjectIndex });
      item.state = 'sent';
      item.sentAt = new Date().toISOString();
      item.gmailId = res.gmailId;
      item.error = '';
    } catch (e) {
      if (e instanceof google.ReconnectError) { item.state = 'queued'; item.error = e.message; return; }
      item.attempts = (item.attempts || 0) + 1;
      item.error = e.message;
      if (item.attempts >= 3) { item.state = 'failed'; store.log('error', `Failed to send to ${(leadById(item.leadId) || {}).email}: ${e.message}`); }
      else { item.state = 'queued'; item.scheduledAt = new Date(Date.now() + 10 * 60e3).toISOString(); }
    } finally {
      changed('queue');
    }
  }

  let busy = false;
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const t = Date.now();
      const inWin = withinWindow(new Date(t));
      for (const acct of db().accounts) {
        if (acct.needsReconnect || acct.paused || !store.secrets.tokens[acct.email]) continue;
        const gap = nextGap[acct.email] || 0;
        if (t - (lastSendAt[acct.email] || 0) < gap) continue;
        if (sentToday(acct.email) >= (Number(acct.dailyLimit) || 60)) continue;
        const due = db().queue
          .filter((q) => q.state === 'queued' && q.accountEmail === acct.email && Date.parse(q.scheduledAt) <= t && (inWin || !q.respectWindow))
          .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
        if (!due.length) continue;
        await sendQueueItem(due[0]);
        lastSendAt[acct.email] = Date.now();
        const base = Math.max(15, Number(S().sending.gapSeconds) || 75) * 1000;
        nextGap[acct.email] = base * (0.75 + Math.random() * 0.5);
      }
    } catch (e) {
      console.error('[engine] tick error', e);
    } finally {
      busy = false;
    }
  }

  /* ------------------------------------------------------------- public */
  function queueSend({ leadIds, sequenceId, stepId, accountEmail, signatureId, when, scheduleAt, deckMode, subjectIndex }) {
    const seq = seqById(sequenceId);
    if (!seq) throw new Error('Sequence not found');
    const idx = seq.steps.findIndex((s) => s.id === stepId);
    if (idx < 0) throw new Error('Step not found');
    if (!acctByEmail(accountEmail)) throw new Error('Choose a connected Gmail account first (Settings → Gmail).');
    if (deckMode) seq.deckChoice = deckMode; // remember last choice per sequence
    const at = when === 'schedule' && scheduleAt ? new Date(scheduleAt).toISOString() : new Date().toISOString();
    const queued = [];
    const skipped = [];
    for (const id of leadIds) {
      const lead = leadById(id);
      if (!lead) continue;
      if (!lead.email) { skipped.push({ id, reason: 'No email address' }); continue; }
      if (isSuppressed(lead.email) || ['unsubscribed', 'bounced'].includes(lead.status)) { skipped.push({ id, reason: 'Suppressed' }); continue; }
      if (db().queue.some((q) => q.state === 'queued' && q.leadId === id && q.stepId === stepId)) { skipped.push({ id, reason: 'Already queued' }); continue; }
      const enr = ensureEnrollment(lead, seq, { accountEmail, signatureId });
      if (enr.state === 'completed') enr.state = 'active';
      db().queue.push({ id: store.id('q'), kind: 'step', leadId: id, enrollmentId: enr.id, sequenceId, stepId, accountEmail, signatureId: signatureId || '', deckMode: deckMode || '', subjectIndex: subjectIndex == null || subjectIndex === '' ? null : Number(subjectIndex), scheduledAt: at, respectWindow: when === 'batch', state: 'queued', attempts: 0, createdAt: new Date().toISOString(), auto: false });
      queued.push(id);
    }
    store.log('queue', `Queued “${seq.steps[idx].name}” for ${queued.length} lead${queued.length === 1 ? '' : 's'} (${when})`);
    changed('queue');
    setTimeout(tick, 200);
    return { queued: queued.length, skipped };
  }

  function enroll({ leadIds, sequenceId, accountEmail, signatureId, startAt, deckMode }) {
    const seq = seqById(sequenceId);
    if (!seq) throw new Error('Sequence not found');
    if (!acctByEmail(accountEmail)) throw new Error('Choose a connected Gmail account first (Settings → Gmail).');
    if (deckMode) seq.deckChoice = deckMode;
    let n = 0;
    const skipped = [];
    for (const id of leadIds) {
      const lead = leadById(id);
      if (!lead || !lead.email) continue;
      if (isSuppressed(lead.email) || ['unsubscribed', 'bounced'].includes(lead.status)) { skipped.push({ id, reason: 'Suppressed' }); continue; }
      const e = ensureEnrollment(lead, seq, { accountEmail, signatureId });
      if ((e.nextStepIndex || 0) >= seq.steps.length) { skipped.push({ id, reason: 'Already finished this sequence' }); continue; }
      e.auto = true;
      e.state = 'active';
      e.pausedReason = '';
      e.accountEmail = accountEmail;
      e.signatureId = signatureId || e.signatureId || '';
      e.deckMode = deckMode || '';
      cancelQueued((q) => q.enrollmentId === e.id, 'Rescheduled');
      if ((e.nextStepIndex || 0) === 0 && startAt) {
        db().queue.push({ id: store.id('q'), kind: 'step', leadId: id, enrollmentId: e.id, sequenceId, stepId: seq.steps[0].id, accountEmail, signatureId: e.signatureId, deckMode: e.deckMode, scheduledAt: new Date(startAt).toISOString(), respectWindow: true, state: 'queued', attempts: 0, createdAt: new Date().toISOString(), auto: true });
      } else scheduleNext(e);
      n++;
    }
    store.log('enroll', `Enrolled ${n} lead${n === 1 ? '' : 's'} in “${seq.name}” (automatic follow-ups)`);
    changed('enrollments');
    setTimeout(tick, 200);
    return { enrolled: n, skipped };
  }

  function setEnrollmentState(id, action) {
    const e = db().enrollments.find((x) => x.id === id);
    if (!e) throw new Error('Enrollment not found');
    if (action === 'pause') { e.state = 'paused'; e.pausedReason = 'manual'; cancelQueued((q) => q.enrollmentId === id, 'Paused'); }
    else if (action === 'stop') { e.state = 'stopped'; e.pausedReason = 'manual'; cancelQueued((q) => q.enrollmentId === id, 'Stopped'); }
    else if (action === 'resume') {
      const lead = leadById(e.leadId);
      if (lead && isSuppressed(lead.email)) throw new Error('This lead is suppressed (unsubscribed or bounced).');
      e.state = 'active'; e.pausedReason = ''; e.auto = true;
      scheduleNext(e);
    }
    changed('enrollments');
    return e;
  }

  async function sendTest({ sequenceId, stepId, leadId, to, accountEmail, deckMode, testName, testCompany }) {
    const seq = seqById(sequenceId);
    const step = seq && seq.steps.find((s) => s.id === stepId);
    if (!step) throw new Error('Step not found');
    const acct = acctByEmail(accountEmail) || db().accounts[0];
    if (!acct) throw new Error('Connect a Gmail account first (Settings → Gmail).');
    // Optional name / company typed in the test dialog override the chosen lead (test only, nothing is saved to a lead).
    const lead = { ...((leadId && leadById(leadId)) || PSeed.sampleLead()) };
    const nm = String(testName || '').trim();
    if (nm) { const parts = nm.split(/\s+/); lead.firstName = parts.shift(); lead.lastName = parts.join(' '); }
    if (String(testCompany || '').trim()) lead.company = String(testCompany).trim();
    const signature = pickSignature('', acct.email);
    const mode = deckModeFor(seq, step, deckMode);
    const ctx = baseCtx({ lead, signature, account: acct, deckMode: mode });
    const data = PRender.mergeData(lead, ctx);
    const subject = '[Test] ' + PRender.merge(step.subjects[step.subjectIndex || 0] || step.subjects[0] || '', data, 'text');
    const r = renderForSend({ subject, preheader: step.preheader, blocks: step.blocks }, ctx);
    const attachments = mode === 'attach' && deckAttachment() ? [deckAttachment()] : [];
    const target = to || S().testEmail || acct.email;
    const { raw } = buildMessage({ from: { name: acct.displayName || signature.name, email: acct.email }, to: { name: '', email: target }, subject, html: r.html, text: r.text, inline: r.inline, attachments, listUnsubscribe: listUnsubscribe(acct.email) });
    const res = await google.sendRaw(acct.email, raw);
    db().messages.push({ id: res.id, threadId: res.threadId, leadId: null, accountEmail: acct.email, direction: 'out', source: 'test', test: true, to: target, subject, date: new Date().toISOString() });
    (db().sync[acct.email] || (db().sync[acct.email] = { processed: [] })).processed.push(res.id);
    store.log('test', `Test of “${step.name}” sent to ${target}`);
    changed('messages');
    return { to: target, bytes: raw.length };
  }

  async function sendReply({ leadId, accountEmail, html, includeSignature, deckMode }) {
    const lead = leadById(leadId);
    if (!lead) throw new Error('Lead not found');
    if (isSuppressed(lead.email)) throw new Error('This lead unsubscribed or bounced. Remove them from the suppression list first if they asked to hear from you.');
    const convo = db().messages.filter((m) => m.leadId === leadId && m.threadId && !m.test).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const last = convo[convo.length - 1];
    const acctEmail = accountEmail || (last && last.accountEmail) || (db().accounts[0] || {}).email;
    const acct = acctByEmail(acctEmail);
    if (!acct) throw new Error('Connect a Gmail account first (Settings → Gmail).');
    const signature = pickSignature('', acct.email);
    const ctx = baseCtx({ lead, signature, account: acct, deckMode: deckMode || 'off' });
    const blocks = [{ id: 'r1', type: 'text', html, pad: 'm' }];
    if (deckMode === 'link') blocks.push({ id: 'r2', type: 'cta', text: 'View the Sponsorship Deck', action: 'deck' });
    if (includeSignature !== false) blocks.push({ id: 'r3', type: 'signature' });
    const lastSubject = (last && last.subject) || 'An Evening on the Water';
    const subject = /^re:/i.test(lastSubject) ? lastSubject : `Re: ${lastSubject}`;
    const r = renderForSend({ subject, preheader: '', blocks }, ctx);
    const refs = convo.map((m) => m.rfcId).filter(Boolean).slice(-10).join(' ');
    const attachments = deckMode === 'attach' && deckAttachment() ? [deckAttachment()] : [];
    const { raw, messageId } = buildMessage({
      from: { name: acct.displayName || signature.name, email: acct.email },
      to: { name: [lead.firstName, lead.lastName].filter(Boolean).join(' '), email: lead.email },
      subject, html: r.html, text: r.text, inline: r.inline, attachments,
      inReplyTo: last && last.rfcId ? last.rfcId : '', references: refs,
    });
    const sameAcct = last && last.accountEmail === acct.email;
    const res = await google.sendRaw(acct.email, raw, sameAcct ? last.threadId : undefined);
    const at = new Date().toISOString();
    db().messages.push({ id: res.id, threadId: res.threadId, leadId, accountEmail: acct.email, direction: 'out', source: 'reply', from: acct.email, fromName: signature.name, to: lead.email, subject, date: at, rfcId: messageId, text: r.text.slice(0, 12000), snippet: PRender.htmlToText(html).slice(0, 300), attached: attachments.length > 0 });
    (db().sync[acct.email] || (db().sync[acct.email] = { processed: [] })).processed.push(res.id);
    lead.lastContactedAt = at;
    lead.unread = false;
    store.log('sent', `Replied to ${lead.email}`, { leadId });
    changed('messages');
    return { ok: true };
  }

  /** Runtime info for the UI (limits, window, next send). */
  function runtime() {
    const t = new Date();
    return {
      now: t.toISOString(),
      inWindow: withinWindow(t),
      today: dayKey(t, tz()),
      accounts: db().accounts.map((a) => ({
        email: a.email, sentToday: sentToday(a.email), limit: Number(a.dailyLimit) || 60,
        nextSendInSec: Math.max(0, Math.round(((lastSendAt[a.email] || 0) + (nextGap[a.email] || 0) - t.getTime()) / 1000)),
        connected: !!store.secrets.tokens[a.email] && !a.needsReconnect,
      })),
    };
  }

  return {
    setSync: (s) => { sync = s; },
    resetThrottle: () => { for (const k of Object.keys(nextGap)) delete nextGap[k]; },
    tick, queueSend, enroll, setEnrollmentState, sendTest, sendReply, exportHtml, runtime, computeDue,
    markReplied, markUnsubscribed, markBounced, noteAutoReply, setAutoStatus, suppress, cancelQueued, isSuppressed, changed, emit,
  };
};

module.exports.zonedParts = zonedParts;
module.exports.zonedToUtc = zonedToUtc;
