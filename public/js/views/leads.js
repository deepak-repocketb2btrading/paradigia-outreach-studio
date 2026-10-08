import { D, R, $, $$, esc, icon, api, modal, ok, fail, loadState, fullName, avatar, statusBadge, tierChip, ago, menu, confirmBox, prompt1, parseCSV, toCSV, download, seqById, dueAt, plural } from '../core.js';
import { openSendDialog, openEnrollDialog } from '../components/send.js';
import { openLead } from '../components/lead.js';

const PAGE = 100;
const f = { status: '', q: '', progress: '', due: false, tier: '', list: '', reply: '', sort: 'recent', page: 0 };
const selected = new Set();
let el;

export function render(container, params, query) {
  el = container;
  if (query.get('status') != null) { f.status = query.get('status'); f.page = 0; }
  draw();
  if (query.get('import')) { history.replaceState(null, '', '#/leads'); openImport(); }
  if (query.get('lead')) openLead(query.get('lead'));
}
export function refresh() { draw(); }

/* ------------------------------------------------------------- filtering */
function enrollmentFor(lead, seqId) {
  return D().enrollments.find((e) => e.leadId === lead.id && e.sequenceId === seqId);
}
function isDue(lead) {
  if (['unsubscribed', 'bounced', 'won', 'lost'].includes(lead.status)) return false;
  return D().enrollments.some((e) => {
    if (e.leadId !== lead.id || e.state === 'stopped' || e.state === 'completed') return false;
    if (e.state === 'paused') return false;
    const seq = seqById(e.sequenceId);
    if (!seq) return false;
    const next = seq.steps[e.nextStepIndex || 0];
    if (!next || !e.lastSentAt) return false;
    if (D().queue.some((q) => q.state === 'queued' && q.enrollmentId === e.id)) return false;
    return Date.parse(dueAt(next, e.lastSentAt)) <= Date.now();
  });
}
function matches(lead) {
  if (f.status && lead.status !== f.status) return false;
  if (f.tier && R.tierKey(lead.tierInterest) !== f.tier) return false;
  if (f.tier && !lead.tierInterest) return false;
  if (f.list && !(lead.tags || []).includes(f.list)) return false;
  if (f.reply === 'yes' && !lead.lastReplyAt) return false;
  if (f.reply === 'no' && lead.lastReplyAt) return false;
  if (f.reply === 'unread' && !lead.unread) return false;
  if (f.q) {
    const hay = `${lead.firstName} ${lead.lastName} ${lead.email} ${lead.company} ${lead.title} ${(lead.tags || []).join(' ')}`.toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  if (f.progress) {
    const [sid, kind, idx] = f.progress.split(':');
    const seq = seqById(sid);
    const e = enrollmentFor(lead, sid);
    const n = e ? e.nextStepIndex || 0 : 0;
    if (kind === 'none' && n !== 0) return false;
    if (kind === 'sent' && n !== Number(idx) + 1) return false;
    if (kind === 'done' && (!seq || n < seq.steps.length)) return false;
    if (kind === 'any' && !e) return false;
  }
  if (f.due && !isDue(lead)) return false;
  return true;
}
function sorted(list) {
  const by = {
    recent: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
    name: (a, b) => fullName(a).localeCompare(fullName(b)),
    company: (a, b) => String(a.company || '~').localeCompare(String(b.company || '~')),
    contacted: (a, b) => String(b.lastContactedAt || '').localeCompare(String(a.lastContactedAt || '')),
    replied: (a, b) => String(b.lastReplyAt || '').localeCompare(String(a.lastReplyAt || '')),
  }[f.sort];
  return list.slice().sort(by);
}

function progressCell(lead) {
  const es = D().enrollments.filter((e) => e.leadId === lead.id).sort((a, b) => String(b.lastSentAt || b.createdAt).localeCompare(String(a.lastSentAt || a.createdAt)));
  const e = es[0];
  if (!e) return '<span class="faint small">Not started</span>';
  const seq = seqById(e.sequenceId);
  if (!seq) return '';
  const n = e.nextStepIndex || 0;
  const next = seq.steps[n];
  const queued = D().queue.find((q) => q.state === 'queued' && q.enrollmentId === e.id);
  let sub;
  if (e.state === 'paused' && e.pausedReason === 'replied') sub = '<span style="color:#FF0055">replied · paused</span>';
  else if (e.state === 'stopped') sub = `stopped${e.pausedReason ? ` · ${esc(e.pausedReason)}` : ''}`;
  else if (!next) sub = 'finished';
  else if (queued) sub = `${icon('clock')} scheduled`;
  else if (e.lastSentAt && Date.parse(dueAt(next, e.lastSentAt)) <= Date.now()) sub = `<span style="color:#F59E0B">next due: ${esc(next.name)}</span>`;
  else if (e.lastSentAt) sub = `next ${ago(dueAt(next, e.lastSentAt))}`;
  else sub = 'not sent yet';
  return `<div style="min-width:170px"><div class="row" style="gap:7px"><span class="steps-dots">${seq.steps.map((s, i) => `<i class="${i < n ? 'done' : ''}"></i>`).join('')}</span><span class="tiny muted">${n}/${seq.steps.length}</span>${es.length > 1 ? `<span class="tiny faint">+${es.length - 1}</span>` : ''}</div><div class="tiny faint" style="white-space:nowrap">${esc(seq.name)} · ${sub}</div></div>`;
}

/* ------------------------------------------------------------------ draw */
function draw() {
  const d = D();
  const all = d.leads;
  const list = sorted(all.filter(matches));
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  if (f.page >= pages) f.page = 0;
  const rows = list.slice(f.page * PAGE, f.page * PAGE + PAGE);
  for (const id of Array.from(selected)) if (!all.some((l) => l.id === id)) selected.delete(id);
  const lists = Array.from(new Set(all.flatMap((l) => l.tags || []))).sort();
  const counts = Object.fromEntries(R.STATUSES.map((s) => [s.key, all.filter((l) => l.status === s.key).length]));
  const dueCount = all.filter(isDue).length;
  const allOnPageSel = rows.length && rows.every((l) => selected.has(l.id));

  el.innerHTML = `<div class="page" data-view="leads">
    <div class="page-head"><div><div class="eyebrow">CRM</div><h1>Leads <span class="muted" style="font-size:18px;font-weight:600">${all.length}</span></h1></div>
      <div class="actions">
        <button class="btn" data-export>${icon('download')} Export CSV</button>
        <button class="btn" data-add>${icon('plus')} Add lead</button>
        <button class="btn primary" data-import>${icon('upload')} Import CSV</button>
      </div></div>

    <div class="chips">
      <button class="chip ${f.status === '' ? 'on' : ''}" data-st="">All <span class="n">${all.length}</span></button>
      ${R.STATUSES.map((s) => `<button class="chip ${f.status === s.key ? 'on' : ''}" data-st="${s.key}"><span class="dot" style="background:${s.color}"></span>${s.label} <span class="n">${counts[s.key]}</span></button>`).join('')}
    </div>

    <div class="filters">
      <div class="search">${icon('search')}<input class="input" data-q placeholder="Search name, email, company, list…" value="${esc(f.q)}"></div>
      <select class="input" data-k="progress" style="max-width:310px">
        <option value="">Any sequence progress</option>
        ${d.sequences.map((s) => `<optgroup label="${esc(s.name)}">
          <option value="${s.id}:none:" ${f.progress === `${s.id}:none:` ? 'selected' : ''}>${esc(s.name)}: not started</option>
          ${s.steps.map((st, i) => `<option value="${s.id}:sent:${i}" ${f.progress === `${s.id}:sent:${i}` ? 'selected' : ''}>${esc(s.name)}: last sent ${i + 1}. ${esc(st.name)}</option>`).join('')}
          <option value="${s.id}:done:" ${f.progress === `${s.id}:done:` ? 'selected' : ''}>${esc(s.name)}: finished</option>
        </optgroup>`).join('')}
      </select>
      <button class="chip ${f.due ? 'on' : ''}" data-due title="Leads whose next sequence email is due and not yet scheduled">${icon('clock')} Next email due <span class="n">${dueCount}</span></button>
      <select class="input" data-k="tier"><option value="">Any tier</option>${['bronze', 'silver', 'gold', 'premium'].map((t) => `<option value="${t}" ${f.tier === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select>
      <select class="input" data-k="list"><option value="">All lists</option>${lists.map((t) => `<option ${f.list === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <select class="input" data-k="reply"><option value="">Replies: any</option><option value="yes" ${f.reply === 'yes' ? 'selected' : ''}>Has replied</option><option value="no" ${f.reply === 'no' ? 'selected' : ''}>No reply yet</option><option value="unread" ${f.reply === 'unread' ? 'selected' : ''}>Unread reply</option></select>
      <select class="input" data-k="sort"><option value="recent" ${f.sort === 'recent' ? 'selected' : ''}>Newest first</option><option value="name" ${f.sort === 'name' ? 'selected' : ''}>Name</option><option value="company" ${f.sort === 'company' ? 'selected' : ''}>Company</option><option value="contacted" ${f.sort === 'contacted' ? 'selected' : ''}>Last contacted</option><option value="replied" ${f.sort === 'replied' ? 'selected' : ''}>Last reply</option></select>
      ${f.status || f.q || f.progress || f.due || f.tier || f.list || f.reply ? '<button class="link-btn" data-clear>Clear filters</button>' : ''}
    </div>

    ${selected.size ? `<div class="bulkbar"><span class="count">${selected.size} selected</span>
      ${selected.size < list.length && list.every((l) => selected.has(l.id)) === false ? `<button class="link-btn" data-selall>Select all ${list.length} matching</button>` : ''}
      <span class="grow"></span>
      <button class="btn primary sm" data-bulk="send">${icon('send')} Send email</button>
      <button class="btn sm" data-bulk="enroll">${icon('layers')} Automate</button>
      <button class="btn sm" data-bulk="status">Status ${icon('down')}</button>
      <button class="btn sm" data-bulk="tier">Tier ${icon('down')}</button>
      <button class="btn sm" data-bulk="tag">${icon('tag')} List ${icon('down')}</button>
      <button class="btn sm" data-bulk="export">${icon('download')}</button>
      <button class="btn sm danger" data-bulk="delete">${icon('trash')}</button>
      <button class="btn ghost sm" data-bulk="clear">${icon('x')}</button></div>` : ''}

    ${all.length ? `<div class="table-wrap"><table class="t"><thead><tr>
      <th class="chk"><input type="checkbox" class="check" data-pageall ${allOnPageSel ? 'checked' : ''}></th>
      <th>Name</th><th>Company</th><th>Tier</th><th>Status</th><th>Sequence progress</th><th>Last contact</th><th>Lists</th></tr></thead><tbody>
      ${rows.map((l) => `<tr data-id="${l.id}" class="${selected.has(l.id) ? 'sel' : ''}">
        <td class="chk"><input type="checkbox" data-sel ${selected.has(l.id) ? 'checked' : ''}></td>
        <td><div class="cell-name">${avatar(fullName(l))}<div style="min-width:0"><b>${esc(fullName(l))} ${l.unread ? '<span class="unread-dot" title="Unread reply"></span>' : ''}</b><small>${esc(l.email)}</small></div></div></td>
        <td><div style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.company || '—')}</div><div class="tiny faint" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.title || '')}</div></td>
        <td>${tierChip(l.tierInterest)}</td>
        <td>${statusBadge(l.status)}</td>
        <td>${progressCell(l)}</td>
        <td class="small muted" style="white-space:nowrap">${l.lastReplyAt ? `<span style="color:#FF0055">replied ${ago(l.lastReplyAt)}</span>` : ago(l.lastContactedAt)}</td>
        <td>${(l.tags || []).slice(0, 2).map((t) => `<span class="tag">${esc(t)}</span>`).join(' ')}${(l.tags || []).length > 2 ? ` <span class="tiny faint">+${l.tags.length - 2}</span>` : ''}</td>
      </tr>`).join('') || `<tr><td colspan="8"><div class="empty"><h3>No leads match</h3>Try clearing a filter.</div></td></tr>`}
      </tbody></table></div>
      ${pages > 1 ? `<div class="row" style="margin-top:12px;justify-content:center"><button class="btn sm" data-page="-1" ${f.page === 0 ? 'disabled' : ''}>${icon('left')}</button><span class="small muted">Page ${f.page + 1} of ${pages} · ${list.length} leads</span><button class="btn sm" data-page="1" ${f.page >= pages - 1 ? 'disabled' : ''}>${icon('right')}</button></div>` : `<div class="small faint" style="margin-top:10px">${plural(list.length, 'lead')} shown</div>`}`
    : `<div class="card"><div class="empty"><img class="wave" src="/brand/wave-pink.png" alt=""><h3>No leads yet</h3><p>Import a CSV with name, email, company, phone, LinkedIn, tier interest and status.<br>Re-import the same file any time: leads are matched by email, so nothing is duplicated.</p><div class="sp8"></div><button class="btn primary" data-import>${icon('upload')} Import CSV</button> <button class="btn" data-sample>${icon('download')} Sample CSV</button></div></div>`}
  </div>`;
}

/* --------------------------------------------------------------- events */
let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  document.addEventListener('input', (e) => {
    if (!e.target.closest('[data-view="leads"]') || !e.target.matches('[data-q]')) return;
    f.q = e.target.value; f.page = 0;
    const pos = e.target.selectionStart;
    draw();
    const i = $('[data-q]', el); i.focus(); i.setSelectionRange(pos, pos);
  });
  document.addEventListener('change', (e) => {
    if (!e.target.closest('[data-view="leads"]')) return;
    const k = e.target.dataset.k;
    if (k) { f[k] = e.target.value; f.page = 0; draw(); return; }
    if (e.target.matches('[data-pageall]')) {
      const rows = $$('tr[data-id]', el).map((tr) => tr.dataset.id);
      if (e.target.checked) rows.forEach((id) => selected.add(id)); else rows.forEach((id) => selected.delete(id));
      draw();
    }
  });
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-view="leads"]')) return;
    const t = e.target;
    const b = t.closest('button');
    if (t.matches('[data-sel]')) {
      const id = t.closest('tr').dataset.id;
      if (t.checked) selected.add(id); else selected.delete(id);
      draw();
      return;
    }
    const tr = t.closest('tr[data-id]');
    if (tr && !b && !t.closest('input')) { openLead(tr.dataset.id); return; }
    if (!b) return;
    if (b.dataset.st != null) { f.status = b.dataset.st; f.page = 0; draw(); }
    else if (b.matches('[data-due]')) { f.due = !f.due; f.page = 0; draw(); }
    else if (b.matches('[data-clear]')) { Object.assign(f, { status: '', q: '', progress: '', due: false, tier: '', list: '', reply: '', page: 0 }); draw(); }
    else if (b.matches('[data-page]')) { f.page += Number(b.dataset.page); draw(); el.scrollTop = 0; }
    else if (b.matches('[data-import]')) openImport();
    else if (b.matches('[data-add]')) openAdd();
    else if (b.matches('[data-sample]')) download('paradigia-leads-sample.csv', toCSV([['First Name', 'Last Name', 'Email', 'Company', 'Title', 'Phone', 'LinkedIn', 'Tier Interest', 'Status', 'Notes'], ['Sarah', 'Haddad', 'sarah@example.com', 'Acme Ventures', 'Partner', '+971 50 000 0000', 'https://www.linkedin.com/in/example', 'Bronze', 'New', 'Met at GITEX']]), 'text/csv');
    else if (b.matches('[data-export]')) exportCsv(sorted(D().leads.filter(matches)));
    else if (b.matches('[data-selall]')) { D().leads.filter(matches).forEach((l) => selected.add(l.id)); draw(); }
    else if (b.dataset.bulk) bulk(b.dataset.bulk, b);
  });
}
wire();

async function bulk(action, btn) {
  const ids = Array.from(selected);
  const run = async (body, msg) => { try { await api('POST', '/api/leads/bulk', { ids, ...body }); await loadState(); ok(msg); } catch (e) { fail(e); } };
  if (action === 'send') openSendDialog(ids);
  else if (action === 'enroll') openEnrollDialog(ids);
  else if (action === 'clear') { selected.clear(); draw(); }
  else if (action === 'export') exportCsv(D().leads.filter((l) => selected.has(l.id)));
  else if (action === 'status') menu(btn, R.STATUSES.map((s) => ({ html: `<span class="dot" style="background:${s.color}"></span> ${s.label}`, onClick: () => run({ action: 'status', value: s.key }, `Status set to ${s.label}`) })));
  else if (action === 'tier') menu(btn, ['Bronze', 'Silver', 'Gold', 'Premium', ''].map((t) => ({ label: t || 'Clear tier', onClick: () => run({ action: 'tier', value: t }, 'Tier updated') })));
  else if (action === 'tag') {
    const lists = Array.from(new Set(D().leads.flatMap((l) => l.tags || []))).sort();
    menu(btn, [
      { label: 'Add to new list…', icon: 'plus', onClick: async () => { const v = await prompt1('List name', '', { title: 'Add to list' }); if (v) run({ action: 'tag', value: v }, `Added to “${v}”`); } },
      ...(lists.length ? ['-', { header: 'Add to' }, ...lists.map((t) => ({ label: t, onClick: () => run({ action: 'tag', value: t }, `Added to “${t}”`) })), '-', { header: 'Remove from' }, ...lists.map((t) => ({ label: t, onClick: () => run({ action: 'untag', value: t }, `Removed from “${t}”`) }))] : []),
    ]);
  } else if (action === 'delete') {
    if (await confirmBox(`Delete ${plural(ids.length, 'lead')}? Their sequence history is removed too. Tip: export a CSV first if you might need them.`, { okText: 'Delete', danger: true })) {
      await run({ action: 'delete' }, `${plural(ids.length, 'lead')} deleted`);
      selected.clear();
      draw();
    }
  }
}

function exportCsv(list) {
  const d = D();
  const rows = [['First Name', 'Last Name', 'Email', 'Company', 'Title', 'Phone', 'LinkedIn', 'Tier Interest', 'Status', 'Lists', 'Last Contacted', 'Last Reply', 'Sequences', 'Notes']];
  for (const l of list) {
    const seqs = d.enrollments.filter((e) => e.leadId === l.id).map((e) => { const s = seqById(e.sequenceId); return s ? `${s.name} ${e.nextStepIndex || 0}/${s.steps.length}` : ''; }).join('; ');
    rows.push([l.firstName, l.lastName, l.email, l.company, l.title, l.phone, l.linkedin, l.tierInterest, R.STATUSES.find((s) => s.key === l.status)?.label || l.status, (l.tags || []).join('; '), l.lastContactedAt || '', l.lastReplyAt || '', seqs, (l.notes || []).map((n) => n.text).join(' | ')]);
  }
  download(`paradigia-leads-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + toCSV(rows), 'text/csv');
}

/* -------------------------------------------------------------- add lead */
function openAdd() {
  const m = modal({ title: 'Add lead', body: `<div class="form-grid">
    <label class="field"><span>First name</span><input class="input" data-f="firstName"></label>
    <label class="field"><span>Last name</span><input class="input" data-f="lastName"></label>
    <label class="field span2"><span>Email *</span><input class="input" data-f="email" type="email"></label>
    <label class="field"><span>Company</span><input class="input" data-f="company"></label>
    <label class="field"><span>Job title</span><input class="input" data-f="title"></label>
    <label class="field"><span>Phone / WhatsApp</span><input class="input" data-f="phone"></label>
    <label class="field"><span>Tier interest</span><select class="input" data-f="tierInterest"><option></option><option>Bronze</option><option>Silver</option><option>Gold</option><option>Premium</option></select></label>
    <label class="field span2"><span>LinkedIn URL</span><input class="input" data-f="linkedin"></label>
    <label class="field span2"><span>List</span><input class="input" data-f="tags" placeholder="e.g. Warm clients"></label></div>`,
  foot: '<button class="btn ghost" data-no>Cancel</button><button class="btn primary" data-yes>Add lead</button>' });
  $('[data-no]', m.el).onclick = () => m.close();
  $('[data-yes]', m.el).onclick = async () => {
    const lead = {};
    $$('[data-f]', m.el).forEach((i) => { lead[i.dataset.f] = i.dataset.f === 'tags' ? i.value.split(',').map((x) => x.trim()).filter(Boolean) : i.value; });
    try { await api('POST', '/api/leads', lead); await loadState(); m.close(); ok('Lead added'); } catch (e) { fail(e); }
  };
}

/* ---------------------------------------------------------------- import */
const FIELDS = [
  ['', '— ignore —'], ['firstName', 'First name'], ['lastName', 'Last name'], ['fullName', 'Full name (split)'], ['email', 'Email'],
  ['company', 'Company'], ['title', 'Job title'], ['phone', 'Phone / WhatsApp'], ['linkedin', 'LinkedIn URL'], ['tierInterest', 'Tier interest'], ['status', 'Pipeline status'], ['notes', 'Notes'], ['tags', 'List / tag'],
];
function guess(header) {
  const h = header.toLowerCase().replace(/[^a-z]/g, '');
  if (/^(firstname|first|givenname|fname)$/.test(h)) return 'firstName';
  if (/^(lastname|last|surname|familyname|lname)$/.test(h)) return 'lastName';
  if (/^(name|fullname|contactname|contact)$/.test(h)) return 'fullName';
  if (h.includes('email') || h === 'mail') return 'email';
  if (/(company|organisation|organization|account|business|brand)/.test(h)) return 'company';
  if (/(title|position|role|designation|jobtitle)/.test(h)) return 'title';
  if (/(phone|mobile|whatsapp|tel|cell)/.test(h)) return 'phone';
  if (h.includes('linkedin')) return 'linkedin';
  if (/(tier|package|interest|sponsorship)/.test(h)) return 'tierInterest';
  if (/(status|stage|pipeline)/.test(h)) return 'status';
  if (/(note|comment|remark)/.test(h)) return 'notes';
  if (/(list|tag|segment|group)/.test(h)) return 'tags';
  return '';
}

function openImport() {
  let rows = null, header = [], map = [], fileName = '';
  const m = modal({ title: 'Import leads from CSV', cls: 'wide', body: '<div data-b></div>', foot: '<span class="small muted grow" data-sum></span><button class="btn ghost" data-no>Cancel</button><button class="btn primary" data-yes disabled>Import</button>' });
  const b = $('[data-b]', m.el);
  const step1 = () => {
    b.innerHTML = `<label class="drop" data-drop>${icon('upload')}<div style="margin-top:8px;font-weight:600;color:var(--text)">Drop your CSV here or click to choose</div><div class="small">Columns like name, email, company, phone, LinkedIn, tier interest, status. Excel: File → Save as → CSV UTF-8.</div><input type="file" accept=".csv,text/csv" hidden></label>
      <div class="sp16"></div><div class="notice info">${icon('info')}<div>Leads are matched by email. Importing the same file again <b>updates</b> those leads instead of duplicating them, so you can reuse and refresh your CSV as often as you like.</div></div>`;
    const drop = $('[data-drop]', b);
    const input = $('input', drop);
    input.onchange = () => input.files[0] && read(input.files[0]);
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) read(e.dataTransfer.files[0]); });
  };
  const read = async (file) => {
    fileName = file.name.replace(/\.[^.]+$/, '');
    const parsed = parseCSV(await file.text());
    if (parsed.length < 2) { fail('That file has no data rows.'); return; }
    header = parsed[0].map((h) => h.trim());
    rows = parsed.slice(1);
    map = header.map(guess);
    if (!map.includes('email')) { const i = rows[0].findIndex((c) => /@/.test(c)); if (i >= 0) map[i] = 'email'; }
    step2();
  };
  const step2 = () => {
    const sample = rows.slice(0, 3);
    b.innerHTML = `<div class="form-grid"><label class="field"><span>Add to list</span><input class="input" data-list value="${esc(fileName)}"><span class="hint">Lets you filter and reuse this group later.</span></label>
      <div class="field"><span>If a lead already exists</span><div class="seg" data-mode><button data-v="update" class="on pink">Update details</button><button data-v="skip">Skip it</button></div><span class="hint">Existing pipeline status and history are always kept.</span></div></div>
      <div class="sp16"></div><div class="label">Match columns</div><div class="sp8"></div>
      <div class="table-wrap"><table class="t map-table"><thead><tr><th>CSV column</th><th>Sample</th><th>Import as</th></tr></thead><tbody>
      ${header.map((h, i) => `<tr style="cursor:default"><td><b style="font-weight:600">${esc(h || `Column ${i + 1}`)}</b></td><td class="small muted" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(sample.map((r) => r[i]).filter(Boolean).join(' · '))}</td>
        <td><select class="input sm" data-map="${i}">${FIELDS.map(([k, l]) => `<option value="${k}" ${map[i] === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td></tr>`).join('')}
      </tbody></table></div>`;
    b.querySelectorAll('[data-map]').forEach((s) => s.onchange = () => { map[Number(s.dataset.map)] = s.value; summary(); });
    b.querySelector('[data-mode]').onclick = (e) => { const x = e.target.closest('button'); if (!x) return; b.querySelectorAll('[data-mode] button').forEach((y) => y.className = y === x ? 'on pink' : ''); };
    summary();
  };
  const build = () => rows.map((r) => {
    const o = {};
    map.forEach((k, i) => {
      if (!k) return;
      const v = String(r[i] == null ? '' : r[i]).trim();
      if (k === 'fullName') { const parts = v.split(/\s+/); o.firstName = o.firstName || parts.shift() || ''; o.lastName = o.lastName || parts.join(' '); }
      else if (k === 'tags') o.tags = v.split(/[;,|]/).map((t) => t.trim()).filter(Boolean);
      else if (k === 'tierInterest') { const t = v.toLowerCase(); o.tierInterest = ['bronze', 'silver', 'gold', 'premium'].find((x) => t.includes(x)) ? ['Bronze', 'Silver', 'Gold', 'Premium'].find((x) => t.includes(x.toLowerCase())) : v; }
      else o[k] = v;
    });
    return o;
  });
  const summary = () => {
    const sum = $('[data-sum]', m.el);
    const yes = $('[data-yes]', m.el);
    if (!map.includes('email')) { sum.innerHTML = '<span style="color:#F59E0B">Pick which column holds the email address.</span>'; yes.disabled = true; return; }
    const data = build();
    const valid = data.filter((r) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email || ''));
    const existing = new Set(D().leads.map((l) => l.email));
    const dup = valid.filter((r) => existing.has(r.email.toLowerCase())).length;
    sum.textContent = `${valid.length} valid rows · ${valid.length - dup} new · ${dup} already in your leads${data.length - valid.length ? ` · ${data.length - valid.length} without a valid email` : ''}`;
    yes.disabled = !valid.length;
  };
  $('[data-no]', m.el).onclick = () => m.close();
  $('[data-yes]', m.el).onclick = async (e) => {
    e.currentTarget.disabled = true;
    const mode = (b.querySelector('[data-mode] .on') || {}).dataset?.v || 'update';
    try {
      const r = await api('POST', '/api/leads/import', { rows: build(), mode, list: $('[data-list]', b).value.trim() });
      await loadState();
      m.close();
      ok(`Import done: ${r.added} added, ${r.updated} updated${r.skipped ? `, ${r.skipped} skipped` : ''}${r.invalid ? `, ${r.invalid} invalid` : ''}`);
    } catch (err) { fail(err); e.currentTarget.disabled = false; }
  };
  step1();
}
