/* Outbox: daily limits per account, scheduled / sent / failed emails, running sequences. */
import { D, $, esc, icon, api, ok, fail, loadState, leadById, seqById, fullName, fmtDate, ago, plural, confirmBox } from '../core.js';
import { openLead } from '../components/lead.js';

const st = { tab: 'queued' };
let wrap;

export function render(container) {
  container.innerHTML = '';
  wrap = document.createElement('div');
  wrap.className = 'page';
  container.appendChild(wrap);
  wrap.addEventListener('click', onClick);
  wrap.addEventListener('change', onChange);
  draw();
}
export function refresh() { draw(); }

function stepName(q) {
  const s = seqById(q.sequenceId);
  const x = s && s.steps.find((y) => y.id === q.stepId);
  return { seq: s ? s.name : '—', step: x ? x.name : '(deleted step)' };
}

function draw() {
  const d = D();
  const rt = d.runtime;
  const qs = d.queue;
  const counts = { queued: qs.filter((q) => q.state === 'queued').length, sent: qs.filter((q) => q.state === 'sent').length, failed: qs.filter((q) => q.state === 'failed' || q.state === 'cancelled').length };
  const auto = d.enrollments.filter((e) => e.auto && (e.state === 'active' || e.state === 'paused'));
  let rows = [];
  if (st.tab === 'queued') rows = qs.filter((q) => q.state === 'queued').sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
  if (st.tab === 'sent') rows = qs.filter((q) => q.state === 'sent').sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt)).slice(0, 300);
  if (st.tab === 'failed') rows = qs.filter((q) => q.state === 'failed' || q.state === 'cancelled').sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 300);

  wrap.innerHTML = `<div class="page-head"><div><div class="eyebrow">Deliverability</div><h1>Outbox</h1></div>
    <div class="actions"><a class="btn" href="#/settings#sending">${icon('settings')} Sending rules</a></div></div>

    <div class="grid g3">${d.accounts.length ? d.accounts.map((a) => {
      const r = (rt.accounts || []).find((x) => x.email === a.email) || { sentToday: 0, limit: a.dailyLimit };
      const pct = Math.min(100, (r.sentToday / (r.limit || 1)) * 100);
      const state = !r.connected ? ['bad', 'Reconnect needed'] : a.paused ? ['warn', 'Paused'] : r.sentToday >= r.limit ? ['warn', 'Daily limit reached, continues tomorrow'] : !rt.inWindow ? ['warn', 'Outside sending window (batches wait)'] : ['ok', r.nextSendInSec ? `Next send in ~${r.nextSendInSec}s` : 'Ready'];
      return `<div class="card"><div class="row"><span class="dot ${state[0]}"></span><b style="font-weight:600;overflow:hidden;text-overflow:ellipsis">${esc(a.email)}</b>
          <label class="switch right" title="Pause sending from this account"><input type="checkbox" data-pause="${esc(a.email)}" ${a.paused ? '' : 'checked'}><span class="tr"></span></label></div>
        <div class="sp8"></div><div class="limit-meter"><div class="progress grow"><i style="width:${pct}%"></i></div><span><b>${r.sentToday}</b>/${r.limit} today</span></div>
        <div class="small muted" style="margin-top:8px">${esc(state[1])}</div></div>`;
    }).join('') : `<div class="card"><div class="notice warn">${icon('alert')}<div>No Gmail account connected. <a href="#/settings">Connect Gmail</a> to start sending.</div></div></div>`}
      <div class="card"><div class="label">Sending window</div><div style="font-size:18px;font-weight:700;margin-top:6px">${esc(d.settings.sending.windowStart)}–${esc(d.settings.sending.windowEnd)}</div><div class="small muted">${esc(d.settings.sending.timezone)}${d.settings.sending.skipWeekends ? ' · weekdays only' : ''} · now ${rt.inWindow ? '<span style="color:#22C55E">open</span>' : '<span style="color:#F59E0B">closed</span>'}</div><div class="small muted">1 email every ~${d.settings.sending.gapSeconds}s per account</div></div>
    </div>
    <div class="sp24"></div>

    <div class="tabs">${[['queued', `Scheduled (${counts.queued})`], ['sent', `Sent (${counts.sent})`], ['failed', `Failed & cancelled (${counts.failed})`], ['auto', `Running sequences (${auto.length})`]].map(([k, l]) => `<button data-tab="${k}" class="${st.tab === k ? 'on' : ''}">${l}</button>`).join('')}
      ${st.tab === 'queued' && counts.queued ? '<button class="right" data-cancelall style="color:#FF6B6B">Cancel all scheduled</button>' : ''}${st.tab === 'failed' && counts.failed ? '<button class="right" data-clear>Clear list</button>' : ''}</div>

    ${st.tab === 'auto' ? autoTable(auto) : rows.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>${st.tab === 'sent' ? 'Sent' : 'When'}</th><th>Lead</th><th>Email</th><th>From</th><th>${st.tab === 'failed' ? 'Reason' : 'Type'}</th><th></th></tr></thead><tbody>
      ${rows.map((q) => {
        const l = leadById(q.leadId) || { email: '(deleted)' };
        const n = stepName(q);
        const due = Date.parse(q.scheduledAt) <= Date.now();
        return `<tr data-lead="${q.leadId}">
          <td class="small" style="white-space:nowrap">${st.tab === 'sent' ? fmtDate(q.sentAt) : due ? `<span style="color:#F59E0B">due now</span>${q.respectWindow && !d.runtime.inWindow ? '<div class="tiny faint">waiting for window</div>' : ''}` : fmtDate(q.scheduledAt)}</td>
          <td><b style="font-weight:600">${esc(fullName(l))}</b><div class="tiny faint">${esc(l.email)}</div></td>
          <td>${esc(n.step)}<div class="tiny faint">${esc(n.seq)}</div></td>
          <td class="small muted">${esc(q.accountEmail)}</td>
          <td class="small">${st.tab === 'failed' ? `<span style="color:${q.state === 'failed' ? '#FF6B6B' : 'var(--muted)'}">${esc(q.error || q.state)}</span>` : q.auto ? '<span class="badge outline">automatic</span>' : q.respectWindow ? '<span class="badge outline">batch</span>' : '<span class="badge outline">manual</span>'}${q.error && st.tab === 'queued' ? `<div class="tiny" style="color:#F59E0B">${esc(q.error)}</div>` : ''}</td>
          <td style="white-space:nowrap;text-align:right">${st.tab === 'queued' ? `<button class="btn xs" data-q="${q.id}|now">${icon('send')} Send now</button> <button class="btn xs ghost" data-q="${q.id}|cancel">${icon('x')}</button>` : st.tab === 'failed' ? `<button class="btn xs" data-q="${q.id}|retry">${icon('refresh')} Retry</button>` : ''}</td></tr>`;
      }).join('')}</tbody></table></div>` : `<div class="card"><div class="empty"><h3>${st.tab === 'queued' ? 'Nothing scheduled' : st.tab === 'sent' ? 'Nothing sent yet' : 'No failures'}</h3><div class="small">${st.tab === 'queued' ? 'Pick leads in the Leads tab and choose “Send email” or “Automate”.' : ''}</div></div></div>`}`;
}

function autoTable(list) {
  if (!list.length) return '<div class="card"><div class="empty"><h3>No automatic sequences running</h3><div class="small">Use “Automate” on selected leads to run a sequence with automatic follow-ups.</div></div></div>';
  return `<div class="table-wrap"><table class="t"><thead><tr><th>Lead</th><th>Sequence</th><th>Progress</th><th>State</th><th>Next send</th><th></th></tr></thead><tbody>
    ${list.map((e) => {
      const l = leadById(e.leadId) || {};
      const s = seqById(e.sequenceId);
      const q = D().queue.find((x) => x.state === 'queued' && x.enrollmentId === e.id);
      return `<tr data-lead="${e.leadId}"><td><b style="font-weight:600">${esc(fullName(l))}</b><div class="tiny faint">${esc(l.company || l.email || '')}</div></td>
        <td>${esc(s ? s.name : '—')}</td>
        <td><span class="steps-dots">${(s ? s.steps : []).map((x, i) => `<i class="${i < (e.nextStepIndex || 0) ? 'done' : ''}"></i>`).join('')}</span> <span class="tiny muted">${e.nextStepIndex || 0}/${s ? s.steps.length : 0}</span></td>
        <td>${e.state === 'paused' ? `<span class="badge" style="background:#F59E0B22;color:#F59E0B">paused${e.pausedReason === 'replied' ? ' · replied' : ''}</span>` : '<span class="badge" style="background:#22C55E22;color:#22C55E">running</span>'}</td>
        <td class="small">${q ? (Date.parse(q.scheduledAt) <= Date.now() ? 'due now' : fmtDate(q.scheduledAt)) : '—'}</td>
        <td style="text-align:right;white-space:nowrap">${e.state === 'active' ? `<button class="btn xs" data-e="${e.id}|pause">${icon('pause')} Pause</button>` : `<button class="btn xs" data-e="${e.id}|resume">${icon('play')} Resume</button>`} <button class="btn xs ghost" data-e="${e.id}|stop" title="Stop">${icon('stop')}</button></td></tr>`;
    }).join('')}</tbody></table></div>`;
}

async function onChange(e) {
  if (e.target.dataset.pause) {
    try { await api('PUT', `/api/accounts/${encodeURIComponent(e.target.dataset.pause)}`, { paused: !e.target.checked }); await loadState(); ok(e.target.checked ? 'Sending resumed' : 'Sending paused for this account'); } catch (err) { fail(err); }
  }
}

async function onClick(e) {
  const b = e.target.closest('button');
  const tr = e.target.closest('tr[data-lead]');
  if (!b && tr) { openLead(tr.dataset.lead); return; }
  if (!b) return;
  try {
    if (b.dataset.tab) { st.tab = b.dataset.tab; draw(); }
    else if (b.dataset.q) { const [id, act] = b.dataset.q.split('|'); await api('POST', `/api/queue/${id}/${act}`); await loadState(); ok(act === 'now' ? 'Moved to the front of the queue' : act === 'cancel' ? 'Cancelled' : 'Queued again'); }
    else if (b.dataset.e) { const [id, act] = b.dataset.e.split('|'); await api('POST', `/api/enrollments/${id}/${act}`); await loadState(); ok(`Sequence ${act === 'resume' ? 'resumed' : act === 'pause' ? 'paused' : 'stopped'}`); }
    else if (b.matches('[data-clear]')) { await api('POST', '/api/queue-clear'); await loadState(); }
    else if (b.matches('[data-cancelall]')) {
      const ids = D().queue.filter((q) => q.state === 'queued').map((q) => q.id);
      if (await confirmBox(`Cancel all ${plural(ids.length, 'scheduled email')}? Automatic sequences stay paused at their current step until you resume them from the lead.`, { okText: 'Cancel all', danger: true })) {
        for (const id of ids) await api('POST', `/api/queue/${id}/cancel`);
        await loadState();
        ok('All scheduled emails cancelled');
      }
    }
  } catch (err) { fail(err); }
}

export { ago, $ };
