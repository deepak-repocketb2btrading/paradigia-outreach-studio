/* Send-email and enroll-in-sequence dialogs (used from Leads, Sequences and the lead drawer). */
import { D, R, $, $$, esc, icon, api, modal, ok, fail, loadState, leadById, seqById, connectedAccounts, previewCtx, fillFrame, plural, timingLabel, fullName } from '../core.js';

function suggest(leadIds, preset) {
  const d = D();
  if (preset.sequenceId) {
    const seq = seqById(preset.sequenceId);
    if (preset.stepId) return { seq, stepIdx: Math.max(0, seq.steps.findIndex((s) => s.id === preset.stepId)) };
    const counts = {};
    for (const id of leadIds) {
      const e = d.enrollments.find((x) => x.leadId === id && x.sequenceId === seq.id);
      const n = Math.min(seq.steps.length - 1, e ? e.nextStepIndex || 0 : 0);
      counts[n] = (counts[n] || 0) + 1;
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return { seq, stepIdx: best ? Number(best[0]) : 0 };
  }
  const tally = new Map();
  for (const id of leadIds) {
    const es = d.enrollments.filter((x) => x.leadId === id).sort((a, b) => String(b.lastSentAt || '').localeCompare(String(a.lastSentAt || '')));
    const e = es[0];
    if (!e) continue;
    const seq = seqById(e.sequenceId);
    if (!seq) continue;
    const key = `${seq.id}|${Math.min(seq.steps.length - 1, e.nextStepIndex || 0)}`;
    tally.set(key, (tally.get(key) || 0) + 1);
  }
  const top = Array.from(tally.entries()).sort((a, b) => b[1] - a[1])[0];
  if (top) { const [sid, i] = top[0].split('|'); return { seq: seqById(sid), stepIdx: Number(i) }; }
  return { seq: d.sequences[0], stepIdx: 0 };
}

function accountOptions(sel) {
  const accts = connectedAccounts();
  if (!accts.length) return '<option value="">No Gmail connected</option>';
  return accts.map((a) => `<option value="${esc(a.email)}" ${a.email === sel ? 'selected' : ''}>${esc(a.displayName ? `${a.displayName} <${a.email}>` : a.email)}</option>`).join('');
}
function signatureOptions(sel) {
  return D().signatures.map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.label || s.name)}</option>`).join('');
}
const deckSeg = (mode) => `<div class="seg" data-deck>${[['attach', 'Attach PDF'], ['link', 'Link to deck'], ['off', 'No deck']].map(([k, l]) => `<button type="button" data-v="${k}" class="${mode === k ? 'on pink' : ''}">${l}</button>`).join('')}</div>`;

function defaultSchedule() {
  const t = new Date(Date.now() + 86400e3);
  t.setHours(10, 0, 0, 0);
  const p = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T10:00`;
}

export function openSendDialog(leadIds, preset = {}) {
  const d = D();
  const sg = suggest(leadIds, preset);
  const st = { seqId: sg.seq.id, stepIdx: sg.stepIdx, account: (connectedAccounts()[0] || {}).email || '', signatureId: '', variant: '', deck: '', when: 'batch', at: defaultSchedule(), preview: false };
  const acct = d.accounts.find((a) => a.email === st.account);
  st.signatureId = (acct && acct.signatureId) || (d.signatures.find((s) => s.accountEmail === st.account) || d.signatures[0] || {}).id || '';

  const m = modal({ title: `Send email to ${plural(leadIds.length, 'lead')}`, cls: 'wide', body: '<div data-body></div>', foot: '<span class="small muted grow" data-sum></span><button class="btn ghost" data-cancel>Cancel</button><button class="btn primary upper" data-go>Queue emails</button>' });
  const body = $('[data-body]', m.el);

  function stepNow() { const seq = seqById(st.seqId); return { seq, step: seq.steps[st.stepIdx] || seq.steps[0] }; }

  function draw() {
    const { seq, step } = stepNow();
    if (!st.deck) st.deck = step.deck && step.deck !== 'inherit' ? step.deck : (seq.deckChoice || 'off');
    const nextFor = seq.steps.map((_, i) => leadIds.filter((id) => { const e = d.enrollments.find((x) => x.leadId === id && x.sequenceId === seq.id); return (e ? e.nextStepIndex || 0 : 0) === i; }).length);
    const firstLead = leadById(leadIds[0]);
    const ctx = previewCtx(firstLead, { signatureId: st.signatureId, deckMode: st.deck, account: d.accounts.find((a) => a.email === st.account) || d.accounts[0] });
    const data = R.mergeData(firstLead, ctx);
    const inThread = leadIds.filter((id) => { const e = d.enrollments.find((x) => x.leadId === id && x.sequenceId === seq.id); return e && e.threadId && e.firstSubject; }).length;
    const warnings = R.preflight({ subject: step.subjects[0], preheader: step.preheader, blocks: step.blocks }, ctx);
    const noAcct = !connectedAccounts().length;
    body.innerHTML = `
      ${noAcct ? `<div class="notice err" style="margin-bottom:14px">${icon('alert')}<div>No Gmail account is connected yet. <a href="#/settings">Connect Gmail in Settings</a> first.</div></div>` : ''}
      <div class="form-grid">
        <label class="field"><span>Sequence</span><select class="input" data-k="seq">${d.sequences.map((s) => `<option value="${s.id}" ${s.id === seq.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Email (step)</span><select class="input" data-k="step">${seq.steps.map((s, i) => `<option value="${i}" ${i === st.stepIdx ? 'selected' : ''}>${i + 1}. ${esc(s.name)}${nextFor[i] ? ` · next for ${nextFor[i]}` : ''}</option>`).join('')}</select></label>
        <label class="field"><span>Send from</span><select class="input" data-k="account">${accountOptions(st.account)}</select></label>
        <label class="field"><span>Signature</span><select class="input" data-k="sig">${signatureOptions(st.signatureId)}</select></label>
        <label class="field span2"><span>Subject line</span><select class="input" data-k="variant">
          ${step.abTest ? `<option value="" ${st.variant === '' ? 'selected' : ''}>A/B test: rotate between variants</option>` : ''}
          ${step.subjects.map((s, i) => s ? `<option value="${i}" ${String(st.variant) === String(i) || (!step.abTest && st.variant === '' && i === (step.subjectIndex || 0)) ? 'selected' : ''}>${'ABC'[i]}: ${esc(R.merge(s, data, 'text'))}</option>` : '').join('')}
        </select>${step.threadReply ? `<span class="hint">${inThread ? `${plural(inThread, 'lead')} already ha${inThread === 1 ? 's' : 've'} a thread from this sequence, so they get this as a reply (“Re: …”) in the same thread.` : 'Sent as a reply in the existing thread when the lead already got an email from this sequence.'}</span>` : ''}</label>
        <div class="field span2"><span>Sponsorship deck</span>${deckSeg(st.deck)}<span class="hint">Your choice is remembered for this sequence.${st.deck === 'attach' && d.settings.deck && d.settings.deck.size > 10 * 1048576 ? ' <b style="color:#F59E0B">The deck is over 10 MB, which can hurt deliverability.</b>' : ''}${st.deck === 'link' && !(d.settings.deck || {}).hostedUrl ? ' <b style="color:#F59E0B">No hosted deck URL is set (Settings → Deck), so the link asks the lead to reply for the deck.</b>' : ''}</span></div>
        <div class="field span2"><span>When</span>
          <div class="row wrap"><div class="seg" data-when>
            <button type="button" data-v="batch" class="${st.when === 'batch' ? 'on pink' : ''}">${icon('layers')} Batch (recommended)</button>
            <button type="button" data-v="now" class="${st.when === 'now' ? 'on pink' : ''}">${icon('send')} Send now</button>
            <button type="button" data-v="schedule" class="${st.when === 'schedule' ? 'on pink' : ''}">${icon('cal')} Schedule</button>
          </div>${st.when === 'schedule' ? `<input type="datetime-local" class="input" style="width:220px" data-k="at" value="${st.at}">` : ''}</div>
          <span class="hint">${st.when === 'batch' ? `Sends inside your sending window (${esc(d.settings.sending.windowStart)}–${esc(d.settings.sending.windowEnd)}, ${esc(d.settings.sending.timezone)}), one email every ~${d.settings.sending.gapSeconds}s, up to each account's daily limit. Extra emails roll over to the next day.` : st.when === 'now' ? 'Starts immediately (ignores the sending window) but still spaces emails out and respects the daily limit.' : 'Sends at the chosen time, then spaces emails out and respects the daily limit.'}</span>
        </div>
      </div>
      <div class="sp16"></div>
      ${warnings.length ? `<div class="col" style="gap:6px">${warnings.map((w) => `<div class="notice ${w.level === 'info' ? 'info' : 'warn'}">${icon(w.level === 'info' ? 'info' : 'alert')}<div>${esc(w.msg)}</div></div>`).join('')}</div><div class="sp16"></div>` : ''}
      <div class="row"><button class="btn sm" data-prev>${icon('eye')} ${st.preview ? 'Hide preview' : `Preview for ${esc(fullName(firstLead))}`}</button><span class="small muted">Step timing in the sequence: ${esc(timingLabel(step, st.stepIdx))}</span></div>
      ${st.preview ? '<div class="sp8"></div><iframe class="preview-frame" data-frame style="height:520px"></iframe>' : ''}`;

    const sum = $('[data-sum]', m.el);
    const eligible = leadIds.filter((id) => { const l = leadById(id); return l && l.email && !['unsubscribed', 'bounced'].includes(l.status); });
    const rt = (d.runtime.accounts || []).find((a) => a.email === st.account) || { sentToday: 0, limit: 60 };
    const left = Math.max(0, rt.limit - rt.sentToday);
    const mins = Math.ceil((eligible.length * d.settings.sending.gapSeconds) / 60);
    sum.innerHTML = `${eligible.length} will be queued${eligible.length < leadIds.length ? ` (${leadIds.length - eligible.length} skipped: unsubscribed, bounced or no email)` : ''} · about ${mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1)} h`}${eligible.length > left ? ` · <b style="color:#F59E0B">${eligible.length - left} roll over to tomorrow (limit ${rt.limit}/day)</b>` : ''}`;
    $('[data-go]', m.el).disabled = noAcct || !eligible.length;
    $('[data-go]', m.el).textContent = st.when === 'now' ? `Send ${eligible.length} now` : `Queue ${eligible.length} email${eligible.length === 1 ? '' : 's'}`;

    if (st.preview) {
      const doc = { subject: step.subjects[st.variant === '' ? (step.subjectIndex || 0) : Number(st.variant)], preheader: step.preheader, blocks: step.blocks };
      fillFrame($('[data-frame]', body), R.renderEmail(doc, ctx).html, { autoHeight: false });
    }
  }

  body.addEventListener('change', (e) => {
    const k = e.target.dataset.k;
    if (k === 'seq') { st.seqId = e.target.value; st.stepIdx = suggest(leadIds, { sequenceId: st.seqId }).stepIdx; st.deck = ''; st.variant = ''; }
    if (k === 'step') { st.stepIdx = Number(e.target.value); st.deck = ''; st.variant = ''; }
    if (k === 'account') st.account = e.target.value;
    if (k === 'sig') st.signatureId = e.target.value;
    if (k === 'variant') st.variant = e.target.value;
    if (k === 'at') st.at = e.target.value;
    draw();
  });
  body.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.closest('[data-deck]')) { st.deck = b.dataset.v; draw(); }
    if (b.closest('[data-when]')) { st.when = b.dataset.v; draw(); }
    if (b.hasAttribute('data-prev')) { st.preview = !st.preview; draw(); }
  });
  $('[data-cancel]', m.el).onclick = () => m.close();
  $('[data-go]', m.el).onclick = async (e) => {
    const { step } = stepNow();
    e.currentTarget.disabled = true;
    try {
      const r = await api('POST', '/api/send', { leadIds, sequenceId: st.seqId, stepId: step.id, accountEmail: st.account, signatureId: st.signatureId, when: st.when, scheduleAt: st.when === 'schedule' ? new Date(st.at).toISOString() : null, deckMode: st.deck, subjectIndex: st.variant === '' ? null : Number(st.variant) });
      ok(`${plural(r.queued, 'email')} queued${r.skipped.length ? ` · ${r.skipped.length} skipped` : ''}. Track them in Outbox.`);
      m.close();
      loadState();
    } catch (err) { fail(err); e.currentTarget.disabled = false; }
  };
  draw();
}

export function openEnrollDialog(leadIds, preset = {}) {
  const d = D();
  const st = { seqId: preset.sequenceId || d.sequences[0].id, account: (connectedAccounts()[0] || {}).email || '', signatureId: '', deck: '', start: 'now', at: defaultSchedule() };
  const acct = d.accounts.find((a) => a.email === st.account);
  st.signatureId = (acct && acct.signatureId) || (d.signatures.find((s) => s.accountEmail === st.account) || d.signatures[0] || {}).id || '';
  const m = modal({ title: `Automate: enroll ${plural(leadIds.length, 'lead')}`, cls: 'wide', body: '<div data-body></div>', foot: '<span class="small muted grow" data-sum></span><button class="btn ghost" data-cancel>Cancel</button><button class="btn primary upper" data-go>Start sequence</button>' });
  const body = $('[data-body]', m.el);
  function draw() {
    const seq = seqById(st.seqId);
    if (!st.deck) st.deck = seq.deckChoice || 'off';
    const already = leadIds.filter((id) => d.enrollments.some((e) => e.leadId === id && e.sequenceId === seq.id && (e.nextStepIndex || 0) > 0)).length;
    const noAcct = !connectedAccounts().length;
    body.innerHTML = `
      ${noAcct ? `<div class="notice err" style="margin-bottom:14px">${icon('alert')}<div>No Gmail account is connected yet. <a href="#/settings">Connect Gmail in Settings</a> first.</div></div>` : ''}
      <div class="notice info" style="margin-bottom:16px">${icon('info')}<div>Each lead gets the steps below automatically. <b>When a lead replies, their sequence pauses</b> and they move to “Replied”. Unsubscribes and bounces stop it for good.</div></div>
      <div class="form-grid">
        <label class="field"><span>Sequence</span><select class="input" data-k="seq">${d.sequences.map((s) => `<option value="${s.id}" ${s.id === seq.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Send from</span><select class="input" data-k="account">${accountOptions(st.account)}</select></label>
        <label class="field"><span>Signature</span><select class="input" data-k="sig">${signatureOptions(st.signatureId)}</select></label>
        <div class="field"><span>Sponsorship deck</span>${deckSeg(st.deck)}</div>
        <div class="field span2"><span>Start</span><div class="row"><div class="seg" data-start><button type="button" data-v="now" class="${st.start === 'now' ? 'on pink' : ''}">Next sending window</button><button type="button" data-v="at" class="${st.start === 'at' ? 'on pink' : ''}">Pick a date</button></div>${st.start === 'at' ? `<input type="datetime-local" class="input" style="width:220px" data-k="at" value="${st.at}">` : ''}</div></div>
      </div>
      <div class="sp16"></div>
      <div class="label">Schedule</div><div class="sp8"></div>
      <div class="col" style="gap:6px">${seq.steps.map((s, i) => `<div class="row" style="padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--panel-2)"><span class="sq"></span><b style="font-weight:600">${i + 1}. ${esc(s.name)}</b><span class="right small muted">${esc(timingLabel(s, i))}${s.threadReply && i ? ' · same thread' : ''}</span></div>`).join('')}</div>
      ${already ? `<div class="sp8"></div><div class="small muted">${plural(already, 'lead')} already started this sequence and will continue from their next step.</div>` : ''}`;
    $('[data-sum]', m.el).textContent = `${leadIds.length} selected`;
    $('[data-go]', m.el).disabled = noAcct;
  }
  body.addEventListener('change', (e) => {
    const k = e.target.dataset.k;
    if (k === 'seq') { st.seqId = e.target.value; st.deck = ''; }
    if (k === 'account') st.account = e.target.value;
    if (k === 'sig') st.signatureId = e.target.value;
    if (k === 'at') st.at = e.target.value;
    draw();
  });
  body.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.closest('[data-deck]')) { st.deck = b.dataset.v; draw(); }
    if (b.closest('[data-start]')) { st.start = b.dataset.v; draw(); }
  });
  $('[data-cancel]', m.el).onclick = () => m.close();
  $('[data-go]', m.el).onclick = async (e) => {
    e.currentTarget.disabled = true;
    try {
      const r = await api('POST', '/api/enroll', { leadIds, sequenceId: st.seqId, accountEmail: st.account, signatureId: st.signatureId, deckMode: st.deck, startAt: st.start === 'at' ? new Date(st.at).toISOString() : null });
      ok(`${plural(r.enrolled, 'lead')} enrolled${r.skipped.length ? ` · ${r.skipped.length} skipped` : ''}.`);
      m.close();
      loadState();
    } catch (err) { fail(err); e.currentTarget.disabled = false; }
  };
  draw();
}

/** Insert merge-field chips that copy a token. */
export function mergeChips() {
  return R.MERGE_FIELDS.slice(0, 7).map((f) => `<span class="pill-k" data-merge="{{${f.key}}}" title="${esc(f.label)}">{{${f.key}}}</span>`).join(' ');
}
export { $$ };
