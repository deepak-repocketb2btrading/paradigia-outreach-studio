/* Lead drawer: details, pipeline status, sequence progress, conversation, notes, quick copy. */
import { D, R, $, esc, icon, api, drawer, ok, fail, loadState, leadById, fullName, avatar, statusBadge, leadEnrollments, ago, fmtDate, menu, copyText, confirmBox, previewCtx, dueAt } from '../core.js';
import { openSendDialog, openEnrollDialog } from './send.js';

const TIERS = ['', 'Bronze', 'Silver', 'Gold', 'Premium'];

export function shortMenu(anchor, lead, kind) {
  const d = D();
  const ctx = previewCtx(lead);
  const mine = new Set(d.enrollments.filter((e) => e.leadId === lead.id).map((e) => e.sequenceId));
  const seqs = d.sequences.slice().sort((a, b) => (mine.has(b.id) ? 1 : 0) - (mine.has(a.id) ? 1 : 0));
  const items = [];
  const phone = String(lead.phone || '').replace(/[^\d]/g, '');
  if (kind === 'wa' && phone) items.push({ label: 'Open WhatsApp chat', icon: 'ext', onClick: () => window.open(`https://wa.me/${phone}`, '_blank', 'noopener') });
  if (kind === 'li' && lead.linkedin) items.push({ label: 'Open LinkedIn profile', icon: 'ext', onClick: () => window.open(lead.linkedin, '_blank', 'noopener') });
  if (items.length) items.push('-');
  for (const s of seqs) {
    items.push({ header: s.name });
    s.steps.forEach((st) => {
      const text = kind === 'wa' ? st.whatsapp : st.linkedin;
      if (!text) return;
      items.push({ label: st.name, icon: 'copy', onClick: () => copyText(R.shortText(text, lead, ctx), `${kind === 'wa' ? 'WhatsApp' : 'LinkedIn'} message copied`) });
    });
  }
  menu(anchor, items);
}

export function openLead(id, opts = {}) {
  let tab = opts.tab || 'timeline';
  let msgs = [];
  const dr = drawer('<div data-root style="display:contents"></div>');
  const root = $('[data-root]', dr.el);

  async function loadMsgs() {
    try { msgs = await api('GET', `/api/messages?leadId=${encodeURIComponent(id)}`); } catch { msgs = []; }
  }

  function draw() {
    const lead = leadById(id);
    if (!lead) { dr.close(); return; }
    const d = D();
    const enr = leadEnrollments(id);
    root.innerHTML = `
      <div class="drawer-h">
        <div class="row" style="align-items:flex-start;gap:14px">
          ${avatar(fullName(lead), null, 'lg')}
          <div class="grow">
            <div class="row"><h2 style="margin:0;font-size:19px;font-weight:700">${esc(fullName(lead))}</h2>${lead.unread ? '<span class="unread-dot"></span>' : ''}</div>
            <div class="muted small">${esc([lead.title, lead.company].filter(Boolean).join(' · ') || 'No company')}</div>
            <div class="row small" style="margin-top:4px;gap:6px"><a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a><button class="btn ghost icon xs" data-copy-email title="Copy email">${icon('copy')}</button></div>
          </div>
          <button class="btn ghost icon sm" data-close>${icon('x')}</button>
        </div>
        <div class="row wrap" style="margin-top:14px;gap:8px">
          <select class="input sm" style="width:150px" data-status>${R.STATUSES.map((s) => `<option value="${s.key}" ${s.key === lead.status ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
          <select class="input sm" style="width:120px" data-tier>${TIERS.map((t) => `<option value="${t}" ${t === (lead.tierInterest || '') ? 'selected' : ''}>${t || 'Tier: none'}</option>`).join('')}</select>
          ${(lead.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
        </div>
        <div class="row wrap" style="margin-top:14px;gap:6px">
          <button class="btn primary sm" data-send>${icon('send')} Send email</button>
          <button class="btn sm" data-enroll>${icon('layers')} Automate</button>
          <a class="btn sm" href="#/inbox/${lead.id}" data-inbox>${icon('inbox')} Conversation</a>
          <button class="btn sm" data-wa>${icon('wa')} WhatsApp ${icon('down')}</button>
          <button class="btn sm" data-li>${icon('li')} LinkedIn ${icon('down')}</button>
          <button class="btn ghost icon sm right" data-more>${icon('more')}</button>
        </div>
        <div class="tabs" style="margin:16px 0 0">${[['timeline', 'Timeline'], ['details', 'Details'], ['notes', `Notes${(lead.notes || []).length ? ` (${lead.notes.length})` : ''}`]].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      </div>
      <div class="drawer-b">${tab === 'timeline' ? timeline(lead, enr) : tab === 'details' ? details(lead) : notes(lead)}</div>`;
  }

  function timeline(lead, enr) {
    const seqCards = enr.length ? enr.map(({ e, seq, steps, next, nextIndex, queued }) => {
      if (!seq) return '';
      const stateColor = { active: '#22C55E', paused: '#F59E0B', completed: '#8E8EA0', stopped: '#EF4444' }[e.state] || '#8E8EA0';
      const due = next && e.lastSentAt ? dueAt(next, e.lastSentAt) : null;
      return `<div class="card tight" style="margin-bottom:10px">
        <div class="row"><span class="sq" style="background:${seq.color}"></span><b style="font-weight:600">${esc(seq.name)}</b>
          <span class="badge" style="background:${stateColor}22;color:${stateColor}">${e.state === 'paused' && e.pausedReason === 'replied' ? 'Paused · replied' : e.state}${e.auto ? ' · auto' : ''}</span>
          <span class="right row" style="gap:4px">
            ${e.state === 'active' && e.auto ? `<button class="btn xs" data-enr="${e.id}" data-act="pause">${icon('pause')} Pause</button>` : ''}
            ${(e.state === 'paused' || (e.state === 'active' && !e.auto)) && nextIndex < steps.length ? `<button class="btn xs" data-enr="${e.id}" data-act="resume">${icon('play')} ${e.auto ? 'Resume' : 'Automate rest'}</button>` : ''}
            ${e.state !== 'stopped' && e.state !== 'completed' ? `<button class="btn xs ghost" data-enr="${e.id}" data-act="stop" title="Stop">${icon('stop')}</button>` : ''}
          </span></div>
        <div class="sp8"></div>
        <div class="row"><span class="steps-dots">${steps.map((s, i) => `<i class="${i < nextIndex ? 'done' : ''}" title="${esc(s.name)}"></i>`).join('')}</span><span class="small muted">${nextIndex}/${steps.length} sent</span>
          <span class="right small">${queued ? `Scheduled ${fmtDate(queued.scheduledAt)}` : next ? `Next: <b>${esc(next.name)}</b>${due ? ` · ${Date.parse(due) <= Date.now() ? '<span style="color:#FF0055">due now</span>' : `due ${ago(due)}`}` : ''}` : 'Finished'}</span></div>
        ${next && !queued && e.state !== 'stopped' ? `<div class="sp8"></div><button class="btn xs" data-send-next="${seq.id}|${next.id}">${icon('send')} Send “${esc(next.name)}” now</button>` : ''}
      </div>`;
    }).join('') : '<div class="small muted" style="margin-bottom:14px">Not in any sequence yet. Use <b>Send email</b> for a one-off step, or <b>Automate</b> to run the whole sequence.</div>';

    const conv = msgs.length ? msgs.map((m) => `<div class="row" style="align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #17171E">
        <span style="margin-top:3px;color:${m.direction === 'in' ? '#FF0055' : '#8C7CFF'}">${icon(m.direction === 'in' ? 'inbox' : 'send')}</span>
        <div class="grow" style="min-width:0"><div class="row"><b style="font-weight:600;font-size:12.5px">${m.direction === 'in' ? 'Reply' : m.stepName ? esc(m.stepName) : m.source === 'gmail' ? 'Sent from Gmail' : 'Sent'}</b>${m.kind === 'auto' ? '<span class="badge outline">auto-reply</span>' : ''}${m.kind === 'unsubscribe' ? '<span class="badge outline">unsubscribe</span>' : ''}${m.attached ? `<span class="badge outline">${icon('file')} deck</span>` : ''}<span class="right tiny faint">${fmtDate(m.date)}</span></div>
        <div class="small muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.subject || '')}</div>
        <div class="small" style="color:#CFCEDA;margin-top:2px">${esc((m.snippet || '').slice(0, 180))}</div></div></div>`).join('')
      : '<div class="small muted">No emails yet.</div>';

    return `<div class="label" style="margin-bottom:10px">Sequences</div>${seqCards}<div class="sp16"></div><div class="label">Conversation</div>${conv}
      <div class="sp16"></div><div class="small faint">Added ${fmtDate(lead.createdAt)} · source: ${esc(lead.source || '—')}${lead.lastContactedAt ? ` · last contacted ${ago(lead.lastContactedAt)}` : ''}</div>`;
  }

  function details(lead) {
    const f = (k, label, type = 'text') => `<label class="field"><span>${label}</span><input class="input" data-f="${k}" type="${type}" value="${esc(lead[k] || '')}"></label>`;
    return `<div class="form-grid">
      ${f('firstName', 'First name')}${f('lastName', 'Last name')}
      ${f('email', 'Email', 'email')}${f('company', 'Company')}
      ${f('title', 'Job title')}${f('phone', 'Phone / WhatsApp')}
      <label class="field span2"><span>LinkedIn URL</span><input class="input" data-f="linkedin" value="${esc(lead.linkedin || '')}"></label>
      <label class="field span2"><span>Lists / tags (comma separated)</span><input class="input" data-f="tags" value="${esc((lead.tags || []).join(', '))}"></label>
    </div><div class="sp16"></div><button class="btn primary" data-save>Save details</button>`;
  }

  function notes(lead) {
    return `<textarea class="input" data-note placeholder="Add a note: call outcome, budget, who decides…"></textarea><div class="sp8"></div><button class="btn primary sm" data-add-note>Add note</button>
      <div class="sp16"></div>${(lead.notes || []).slice().reverse().map((n) => `<div class="card tight" style="margin-bottom:8px"><div class="row"><span class="tiny faint">${fmtDate(n.at)}${n.auto ? ' · automatic' : ''}</span><button class="btn ghost icon xs right" data-del-note="${n.id}">${icon('trash')}</button></div><div style="white-space:pre-wrap;margin-top:4px">${esc(n.text)}</div></div>`).join('') || '<div class="small muted">No notes yet.</div>'}`;
  }

  async function update(patch) {
    try { await api('PUT', `/api/leads/${id}`, patch); await loadState(); draw(); } catch (e) { fail(e); }
  }

  root.addEventListener('change', (e) => {
    if (e.target.matches('[data-status]')) update({ status: e.target.value }).then(() => ok('Status updated'));
    if (e.target.matches('[data-tier]')) update({ tierInterest: e.target.value });
  });
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button, a');
    if (!b) return;
    const lead = leadById(id);
    if (b.matches('[data-close]')) dr.close();
    else if (b.matches('[data-copy-email]')) copyText(lead.email);
    else if (b.matches('[data-tab]')) { tab = b.dataset.tab; draw(); }
    else if (b.matches('[data-send]')) openSendDialog([id]);
    else if (b.matches('[data-enroll]')) openEnrollDialog([id]);
    else if (b.matches('[data-inbox]')) dr.close();
    else if (b.matches('[data-wa]')) shortMenu(b, lead, 'wa');
    else if (b.matches('[data-li]')) shortMenu(b, lead, 'li');
    else if (b.matches('[data-send-next]')) { const [sid, stid] = b.dataset.sendNext.split('|'); openSendDialog([id], { sequenceId: sid, stepId: stid }); }
    else if (b.matches('[data-more]')) {
      menu(b, [
        { label: lead.unread ? 'Mark as read' : 'Mark as unread', icon: 'eye', onClick: () => update({ unread: !lead.unread }) },
        { label: 'Delete lead', icon: 'trash', onClick: async () => { if (await confirmBox(`Delete <b>${esc(fullName(lead))}</b>? Their history is removed too.`, { okText: 'Delete', danger: true })) { try { await api('DELETE', `/api/leads/${id}`); dr.close(); loadState(); ok('Lead deleted'); } catch (err) { fail(err); } } } },
      ]);
    } else if (b.matches('[data-enr]')) {
      try { await api('POST', `/api/enrollments/${b.dataset.enr}/${b.dataset.act}`); await loadState(); draw(); ok(b.dataset.act === 'resume' ? 'Sequence running: next step scheduled' : `Sequence ${b.dataset.act === 'pause' ? 'paused' : 'stopped'}`); } catch (err) { fail(err); }
    } else if (b.matches('[data-save]')) {
      const patch = {};
      root.querySelectorAll('[data-f]').forEach((i) => { patch[i.dataset.f] = i.dataset.f === 'tags' ? i.value.split(',').map((t) => t.trim()).filter(Boolean) : i.value; });
      await update(patch);
      ok('Saved');
    } else if (b.matches('[data-add-note]')) {
      const t = $('[data-note]', root).value.trim();
      if (!t) return;
      try { await api('POST', `/api/leads/${id}/notes`, { text: t }); await loadState(); draw(); } catch (err) { fail(err); }
    } else if (b.matches('[data-del-note]')) {
      try { await api('DELETE', `/api/leads/${id}/notes/${b.dataset.delNote}`); await loadState(); draw(); } catch (err) { fail(err); }
    }
  });

  draw();
  loadMsgs().then(draw);
  return dr;
}
