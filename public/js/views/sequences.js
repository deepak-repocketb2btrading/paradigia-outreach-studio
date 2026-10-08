import { D, R, Seed, $, $$, esc, icon, api, modal, ok, fail, loadState, seqById, stepStats, stepStatus, timingLabel, dayNumbers, clone, uid, confirmBox, prompt1, copyText, menu, connectedAccounts, plural } from '../core.js';
import { openEnrollDialog, openSendDialog } from '../components/send.js';
import { openExport, sendTest } from './editor.js';

let wrap;
let seqId = null;

export function render(container, params) {
  seqId = params[0] || null;
  wrap = document.createElement('div');
  wrap.className = 'page';
  container.innerHTML = '';
  container.appendChild(wrap);
  wrap.addEventListener('click', onClick);
  wrap.addEventListener('change', onChange);
  wireDrag();
  draw();
}
export function refresh() { draw(); }

function draw() {
  if (seqId) {
    const seq = seqById(seqId);
    if (!seq) { wrap.innerHTML = '<div class="notice err">Sequence not found. <a href="#/sequences">Back to sequences</a></div>'; return; }
    wrap.innerHTML = detail(seq);
  } else wrap.innerHTML = list();
}

/* ------------------------------------------------------------------ list */
function list() {
  const d = D();
  return `<div class="page-head"><div><div class="eyebrow">Template library</div><h1>Sequences</h1></div>
    <div class="actions"><button class="btn primary" data-new>${icon('plus')} New sequence</button></div></div>
    <div class="grid g2">${d.sequences.map((s) => {
      const enr = d.enrollments.filter((e) => e.sequenceId === s.id);
      const sent = s.steps.reduce((n, st) => n + stepStats(s, st).sent, 0);
      const rep = enr.filter((e) => e.repliedAt).length;
      const days = dayNumbers(s);
      return `<div class="card seq-card" data-open="${s.id}"><span class="bar" style="background:${s.color || '#FF0055'}"></span>
        <div class="row"><div><div class="label" style="color:${s.color || '#FF0055'}">${esc(s.audience || '')}</div><h3>${esc(s.name)}</h3></div>
          <div class="right row" style="gap:4px"><button class="btn ghost icon sm" data-dup="${s.id}" title="Duplicate">${icon('dup')}</button><button class="btn ghost icon sm" data-del="${s.id}" title="Delete">${icon('trash')}</button></div></div>
        <div class="small muted">${esc(s.description || '')}</div>
        <div class="timeline">${s.steps.map((st, i) => `${i ? '<span class="ln"></span>' : ''}<span class="node" title="${esc(st.name)}"><i></i>${esc(days[i])}</span>`).join('')}</div>
        <div class="stat-row"><div><b>${s.steps.length}</b>emails</div><div><b>${enr.length}</b>leads</div><div><b>${sent}</b>sent</div><div><b>${rep}</b>replied</div><div><b>${s.deckChoice === 'attach' ? 'PDF' : s.deckChoice === 'link' ? 'Link' : 'Off'}</b>deck</div></div>
      </div>`;
    }).join('')}</div>`;
}

/* ---------------------------------------------------------------- detail */
function detail(seq) {
  const d = D();
  const enr = d.enrollments.filter((e) => e.sequenceId === seq.id);
  const active = enr.filter((e) => e.state === 'active' && e.auto).length;
  return `<div class="page-head" style="align-items:flex-start">
      <div class="grow" style="max-width:720px"><a href="#/sequences" class="small muted">${icon('left')} All sequences</a>
        <div class="sp8"></div>
        <input class="input" data-meta="name" value="${esc(seq.name)}" style="font-size:22px;font-weight:800;height:46px;text-transform:uppercase;background:transparent;border-color:transparent;padding-left:0">
        <div class="row wrap" style="gap:8px"><input class="input sm" data-meta="audience" value="${esc(seq.audience || '')}" placeholder="Audience" style="width:200px"><input class="input sm grow" data-meta="description" value="${esc(seq.description || '')}" placeholder="Description"></div>
      </div>
      <div class="actions">
        <button class="btn" data-enroll>${icon('layers')} Enroll leads</button>
        <a class="btn" href="#/leads">${icon('users')} Leads</a>
      </div></div>

    <div class="grid g3" style="margin-bottom:20px">
      <div class="card tight"><div class="label">Leads in sequence</div><div style="font-size:22px;font-weight:800;margin-top:4px">${enr.length}</div><div class="small muted">${active} running automatically</div></div>
      <div class="card tight"><div class="label">Replied</div><div style="font-size:22px;font-weight:800;margin-top:4px">${enr.filter((e) => e.repliedAt).length}</div><div class="small muted">sequence paused on reply</div></div>
      <div class="card tight"><div class="label">Sponsorship deck (remembered)</div><div class="sp8"></div>
        <div class="seg" data-deckchoice>${[['attach', 'Attach PDF'], ['link', 'Link'], ['off', 'Off']].map(([k, l]) => `<button data-v="${k}" class="${(seq.deckChoice || 'off') === k ? 'on pink' : ''}">${l}</button>`).join('')}</div></div>
    </div>

    <div data-steps>${seq.steps.map((st, i) => stepCard(seq, st, i)).join('')}</div>
    <div class="row" style="margin-top:6px"><button class="btn" data-add-step>${icon('plus')} Add email</button><span class="small faint">Drag the handle to reorder. Delays count from the previous email.</span></div>`;
}

function stepCard(seq, st, i) {
  const stats = stepStats(seq, st);
  const status = stepStatus(stats);
  const deck = st.deck && st.deck !== 'inherit' ? st.deck : `${seq.deckChoice || 'off'} (sequence)`;
  return `${i ? `<div class="connector">${st.fixedDate ? `${icon('cal')} fixed date` : `wait ${st.delayDays || 0} day${Number(st.delayDays) === 1 ? '' : 's'}`}</div>` : ''}
  <div class="step-card" draggable="true" data-step="${st.id}">
    <span class="handle" title="Drag to reorder">${icon('grip')}</span>
    <span class="num">${i + 1}</span>
    <div style="min-width:0">
      <div class="row wrap"><h4>${esc(st.name)}</h4><span class="badge" style="background:${status.color}22;color:${status.color}">${status.label}</span>${stats.queued && status.key !== 'scheduled' ? `<span class="badge outline">${stats.queued} scheduled</span>` : ''}
        <span class="timing">${icon('clock')}<b>${esc(timingLabel(st, i))}</b></span>${st.threadReply && i ? '<span class="badge outline">same thread</span>' : ''}<span class="badge outline">${icon('file')} ${esc(deck)}</span>${st.abTest ? '<span class="badge" style="background:#3B1FA833;color:#B7A8FF">A/B test</span>' : ''}</div>
      <div class="subj-list">${(st.subjects || []).map((s, k) => s ? `<div class="subj ${(!st.abTest && k === (st.subjectIndex || 0)) || (st.abTest) ? 'on' : ''}"><span class="k">${'ABC'[k]}</span><span>${esc(s)}</span>${stats.variants[k] && stats.variants[k].sent ? `<span class="tiny faint">${stats.variants[k].sent} sent · ${stats.variants[k].replied} replied</span>` : ''}</div>` : '').join('')}</div>
      <div class="small faint" style="margin-top:6px">Preheader: ${esc(st.preheader || '—')} · ${R.bodyWords(st)} words</div>
    </div>
    <div class="col" style="gap:6px;align-items:flex-end">
      <a class="btn primary sm" href="#/editor/${seq.id}/${st.id}">${icon('pen')} Edit design</a>
      <div class="row" style="gap:4px">
        <button class="btn sm icon" data-act="send" title="Send this email to leads">${icon('send')}</button>
        <button class="btn sm icon" data-act="wa" title="Copy WhatsApp version">${icon('wa')}</button>
        <button class="btn sm icon" data-act="li" title="Copy LinkedIn version">${icon('li')}</button>
        <button class="btn sm icon" data-act="more" title="More">${icon('more')}</button>
      </div>
    </div>
  </div>`;
}

/* ---------------------------------------------------------------- events */
async function save(seq, msg) {
  try { await api('PUT', `/api/sequences/${seq.id}`, seq); await loadState(); if (msg) ok(msg); } catch (e) { fail(e); }
}

async function onChange(e) {
  const k = e.target.dataset.meta;
  if (k) { const seq = clone(seqById(seqId)); seq[k] = e.target.value; save(seq); }
}

async function onClick(e) {
  const b = e.target.closest('button, [data-open]');
  if (!b) return;
  const d = D();
  if (b.matches('[data-open]') && !e.target.closest('button')) { location.hash = `#/sequences/${b.dataset.open}`; return; }
  if (b.matches('[data-new]')) {
    const name = await prompt1('Sequence name', '', { title: 'New sequence', okText: 'Create' });
    if (!name) return;
    const base = Seed.sequences()[0].steps[0];
    const seq = { name, audience: '', description: '', color: '#FF0055', deckChoice: 'off', steps: [{ ...clone(base), id: uid('s'), name: 'Day 0 · Intro', subjects: ['', '', ''], blocks: base.blocks.map((x) => ({ ...clone(x), id: uid('b') })) }] };
    try { const r = await api('POST', '/api/sequences', seq); await loadState(); location.hash = `#/sequences/${r.id}`; } catch (err) { fail(err); }
  } else if (b.matches('[data-dup]')) {
    const src = clone(seqById(b.dataset.dup));
    delete src.id;
    src.name += ' (copy)';
    src.steps = src.steps.map((s) => ({ ...s, id: uid('s'), blocks: s.blocks.map((x) => ({ ...x, id: uid('b') })) }));
    try { await api('POST', '/api/sequences', src); await loadState(); ok('Sequence duplicated'); } catch (err) { fail(err); }
  } else if (b.matches('[data-del]')) {
    const s = seqById(b.dataset.del);
    const n = d.enrollments.filter((x) => x.sequenceId === s.id).length;
    if (await confirmBox(`Delete <b>${esc(s.name)}</b>?${n ? ` ${plural(n, 'lead')} are in it; their scheduled emails will be cancelled.` : ''}`, { okText: 'Delete', danger: true })) {
      try { await api('DELETE', `/api/sequences/${s.id}`); await loadState(); ok('Sequence deleted'); } catch (err) { fail(err); }
    }
  } else if (b.matches('[data-enroll]')) {
    pickLeads(seqId);
  } else if (b.closest('[data-deckchoice]')) {
    const seq = clone(seqById(seqId));
    seq.deckChoice = b.dataset.v;
    save(seq, `Deck default: ${b.textContent}`);
  } else if (b.matches('[data-add-step]')) {
    const seq = clone(seqById(seqId));
    const last = seq.steps[seq.steps.length - 1];
    const fresh = last ? clone(last) : clone(Seed.sequences()[0].steps[1]);
    fresh.id = uid('s');
    fresh.name = `Follow-up ${seq.steps.length + 1}`;
    fresh.delayDays = 4; fresh.fixedDate = ''; fresh.threadReply = seq.steps.length > 0;
    fresh.blocks = fresh.blocks.map((x) => ({ ...x, id: uid('b') }));
    seq.steps.push(fresh);
    save(seq, 'Email added');
  } else if (b.dataset.act) {
    const card = b.closest('[data-step]');
    const seq = seqById(seqId);
    const st = seq.steps.find((s) => s.id === card.dataset.step);
    const idx = seq.steps.indexOf(st);
    if (b.dataset.act === 'send') {
      location.hash = '#/leads';
      setTimeout(() => ok(`Select leads, then “Send email” and pick “${st.name}”. Tip: filter by “${seq.name}: last sent …”.`), 300);
    } else if (b.dataset.act === 'wa') copyText(st.whatsapp || '', 'WhatsApp version copied (merge fields like {{first_name}} included)');
    else if (b.dataset.act === 'li') copyText(st.linkedin || '', 'LinkedIn version copied');
    else if (b.dataset.act === 'more') {
      menu(b, [
        { label: 'Edit design', icon: 'pen', onClick: () => { location.hash = `#/editor/${seq.id}/${st.id}`; } },
        { label: 'Send test to myself', icon: 'mail', onClick: () => sendTest(seq, st) },
        { label: 'Export HTML', icon: 'code', onClick: () => openExport(seq, st) },
        { label: 'Duplicate', icon: 'dup', onClick: () => { const s2 = clone(seq); const c = clone(st); c.id = uid('s'); c.name += ' (copy)'; c.blocks = c.blocks.map((x) => ({ ...x, id: uid('b') })); s2.steps.splice(idx + 1, 0, c); save(s2, 'Email duplicated'); } },
        { label: 'Move up', icon: 'up', onClick: () => { if (!idx) return; const s2 = clone(seq); [s2.steps[idx - 1], s2.steps[idx]] = [s2.steps[idx], s2.steps[idx - 1]]; save(s2); } },
        { label: 'Move down', icon: 'down', onClick: () => { if (idx >= seq.steps.length - 1) return; const s2 = clone(seq); [s2.steps[idx + 1], s2.steps[idx]] = [s2.steps[idx], s2.steps[idx + 1]]; save(s2); } },
        '-',
        { label: 'Delete', icon: 'trash', onClick: async () => { if (seq.steps.length < 2) return fail('A sequence needs at least one email.'); if (await confirmBox(`Delete “${esc(st.name)}”? Scheduled sends of this email are skipped.`, { okText: 'Delete', danger: true })) { const s2 = clone(seq); s2.steps.splice(idx, 1); save(s2, 'Email deleted'); } } },
      ]);
    }
  }
}

/** Choose leads by status / list, then hand over to the enroll dialog. */
function pickLeads(sid) {
  const d = D();
  const lists = Array.from(new Set(d.leads.flatMap((l) => l.tags || []))).sort();
  const m = modal({ title: 'Which leads?', body: `<div class="form-grid">
      <label class="field"><span>Pipeline status</span><select class="input" data-p="status"><option value="">Any status</option>${R.STATUSES.filter((x) => !['unsubscribed', 'bounced'].includes(x.key)).map((x) => `<option value="${x.key}">${x.label}</option>`).join('')}</select></label>
      <label class="field"><span>List</span><select class="input" data-p="list"><option value="">All lists</option>${lists.map((t) => `<option>${esc(t)}</option>`).join('')}</select></label>
      <label class="check span2"><input type="checkbox" data-p="fresh" checked> Only leads not yet in this sequence</label></div>
      <div class="sp16"></div><div class="notice info">${icon('info')}<div data-count></div></div>`,
  foot: '<button class="btn ghost" data-no>Cancel</button><button class="btn primary" data-yes>Continue</button>' });
  const pick = () => {
    const st = $('[data-p="status"]', m.el).value, li = $('[data-p="list"]', m.el).value, fresh = $('[data-p="fresh"]', m.el).checked;
    return d.leads.filter((l) => !['unsubscribed', 'bounced'].includes(l.status) && (!st || l.status === st) && (!li || (l.tags || []).includes(li)) && (!fresh || !d.enrollments.some((e) => e.leadId === l.id && e.sequenceId === sid))).map((l) => l.id);
  };
  const upd = () => { const n = pick().length; $('[data-count]', m.el).innerHTML = `${n} lead${n === 1 ? '' : 's'} match. For hand-picking, use the Leads tab: tick leads, then “Automate”.`; $('[data-yes]', m.el).disabled = !n; };
  m.el.addEventListener('change', upd);
  $('[data-no]', m.el).onclick = () => m.close();
  $('[data-yes]', m.el).onclick = () => { const ids = pick(); m.close(); openEnrollDialog(ids, { sequenceId: sid }); };
  upd();
}

function wireDrag() {
  let dragId = null;
  wrap.addEventListener('dragstart', (e) => {
    const card = e.target.closest('[data-step]');
    if (!card) return;
    dragId = card.dataset.step;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });
  wrap.addEventListener('dragend', () => { $$('.step-card', wrap).forEach((c) => c.classList.remove('dragging', 'drop-above')); dragId = null; });
  wrap.addEventListener('dragover', (e) => {
    const card = e.target.closest('[data-step]');
    if (!card || !dragId) return;
    e.preventDefault();
    $$('.step-card', wrap).forEach((c) => c.classList.toggle('drop-above', c === card && c.dataset.step !== dragId));
  });
  wrap.addEventListener('drop', (e) => {
    const card = e.target.closest('[data-step]');
    if (!card || !dragId || card.dataset.step === dragId) return;
    e.preventDefault();
    const seq = clone(seqById(seqId));
    const from = seq.steps.findIndex((s) => s.id === dragId);
    const [moved] = seq.steps.splice(from, 1);
    const to = seq.steps.findIndex((s) => s.id === card.dataset.step);
    seq.steps.splice(to, 0, moved);
    save(seq, 'Order updated');
  });
}

export { connectedAccounts, openSendDialog };
