/* Unified inbox: one conversation per prospect (sequence emails + replies), reply composer. */
import { D, R, $, $$, esc, icon, api, modal, ok, fail, loadState, leadById, fullName, avatar, statusBadge, ago, fmtDate, menu, sanitizeRich, previewCtx, connectedAccounts, leadEnrollments, seqById } from '../core.js';
import { openLead, shortMenu } from '../components/lead.js';

const st = { leadId: null, filter: 'all', q: '', msgs: [], loading: false, deck: 'off', sig: true, from: '', draft: {} };
let root;

export function render(container, params) {
  st.leadId = params[0] || null;
  container.innerHTML = '';
  root = document.createElement('div');
  root.className = 'inbox';
  container.appendChild(root);
  root.innerHTML = '<div class="ib-list" data-list></div><div class="ib-thread" data-thread></div>';
  root.addEventListener('click', onClick);
  root.addEventListener('input', (e) => {
    if (e.target.matches('[data-q]')) { st.q = e.target.value; drawList(); const i = $('[data-q]', root); i.focus(); i.setSelectionRange(st.q.length, st.q.length); }
    if (e.target.matches('[data-rte]') && st.leadId) st.draft[st.leadId] = e.target.innerHTML;
  });
  root.addEventListener('change', onChange);
  drawList();
  openThread(st.leadId);
}

export function refresh() {
  drawList();
  if (st.leadId) loadThread(true);
}

function conversations() {
  const d = D();
  const by = new Map();
  for (const m of d.messages) {
    if (!m.leadId || m.test) continue;
    const c = by.get(m.leadId);
    if (!c || Date.parse(m.date) > Date.parse(c.date)) by.set(m.leadId, m);
  }
  return Array.from(by.entries()).map(([leadId, last]) => ({ lead: leadById(leadId), last, hasReply: d.messages.some((m) => m.leadId === leadId && m.direction === 'in' && m.kind === 'reply') }))
    .filter((c) => c.lead)
    .sort((a, b) => Date.parse(b.last.date) - Date.parse(a.last.date));
}

function drawList() {
  const all = conversations();
  const q = st.q.toLowerCase();
  const list = all.filter((c) => {
    if (st.filter === 'unread' && !c.lead.unread) return false;
    if (st.filter === 'replied' && !c.hasReply) return false;
    if (st.filter === 'needs' && !(c.last.direction === 'in' && c.last.kind === 'reply')) return false;
    if (q && !`${fullName(c.lead)} ${c.lead.email} ${c.lead.company}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const n = { unread: all.filter((c) => c.lead.unread).length, needs: all.filter((c) => c.last.direction === 'in' && c.last.kind === 'reply').length };
  $('[data-list]', root).innerHTML = `<div class="head"><div class="row"><div><div class="eyebrow">Unified inbox</div><h1 style="margin:2px 0 0;font-size:20px;font-weight:800;text-transform:uppercase">Inbox</h1></div><button class="btn sm right" data-sync>${icon('refresh')} Sync</button></div>
      <div class="search">${icon('search')}<input class="input" data-q placeholder="Search conversations" value="${esc(st.q)}" style="width:100%"></div>
      <div class="seg" style="width:100%">${[['all', 'All'], ['needs', `Needs reply${n.needs ? ` ${n.needs}` : ''}`], ['unread', `Unread${n.unread ? ` ${n.unread}` : ''}`], ['replied', 'Replied']].map(([k, l]) => `<button data-f="${k}" class="${st.filter === k ? 'on' : ''}" style="flex:1;justify-content:center">${l}</button>`).join('')}</div></div>
    <div class="ib-items">${list.map((c) => `<div class="ib-item ${c.lead.id === st.leadId ? 'on' : ''} ${c.lead.unread ? 'unread' : ''}" data-open="${c.lead.id}">
        ${avatar(fullName(c.lead))}
        <div style="min-width:0"><div class="row" style="gap:6px"><b>${esc(fullName(c.lead))}</b>${c.lead.unread ? '<span class="unread-dot"></span>' : ''}</div>
          <div class="tiny faint" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.lead.company || c.lead.email)}</div>
          <div class="sn">${c.last.direction === 'out' ? '<span class="faint">You: </span>' : ''}${esc(c.last.snippet || c.last.subject || '')}</div></div>
        <div class="col" style="gap:4px;align-items:flex-end"><span class="tiny faint">${ago(c.last.date)}</span>${statusBadge(c.lead.status)}</div>
      </div>`).join('') || `<div class="empty"><h3>${all.length ? 'Nothing here' : 'No conversations yet'}</h3><div class="small">${all.length ? 'Try another filter.' : 'Sent emails and replies appear here once you start sending.'}</div></div>`}</div>`;
}

async function openThread(leadId) {
  st.leadId = leadId;
  if (!leadId) {
    $('[data-thread]', root).innerHTML = `<div class="empty" style="margin:auto"><img class="wave" src="/brand/wave-pink.png" alt=""><h3>Pick a conversation</h3><div class="small">Every prospect has one thread with your sequence emails and their replies.<br>Replies pause the sequence automatically.</div></div>`;
    return;
  }
  const lead = leadById(leadId);
  if (lead && lead.unread) api('POST', '/api/leads/bulk', { ids: [leadId], action: 'read' }).then(loadState).catch(() => {});
  if (history.replaceState) history.replaceState(null, '', `#/inbox/${leadId}`);
  await loadThread(false);
}

async function loadThread(keepScroll) {
  const box = $('[data-thread]', root);
  const scroller = $('.th-msgs', box);
  const atBottom = !scroller || scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 40;
  try { st.msgs = await api('GET', `/api/messages?leadId=${encodeURIComponent(st.leadId)}`); } catch { st.msgs = []; }
  drawThread();
  const s2 = $('.th-msgs', box);
  if (s2 && (!keepScroll || atBottom)) s2.scrollTop = s2.scrollHeight;
  drawList();
}

function splitQuoted(text) {
  const t = String(text || '');
  const i = t.search(/\n\s*(On .{5,200}wrote:|-{2,}\s*Original Message|From: .+\n(Sent|Date): )|\n>/i);
  return i > 0 ? [t.slice(0, i).trim(), t.slice(i).trim()] : [t.trim(), ''];
}

function drawThread() {
  const lead = leadById(st.leadId);
  const box = $('[data-thread]', root);
  if (!lead) { box.innerHTML = '<div class="empty">Lead not found.</div>'; return; }
  const d = D();
  const accts = connectedAccounts();
  const lastOut = st.msgs.filter((m) => m.accountEmail).slice(-1)[0];
  if (!st.from || !accts.some((a) => a.email === st.from)) st.from = (lastOut && lastOut.accountEmail) || (accts[0] || {}).email || '';
  const enr = leadEnrollments(lead.id).filter((x) => x.seq);
  const lastSubject = (st.msgs[st.msgs.length - 1] || {}).subject || 'An Evening on the Water';
  box.innerHTML = `
    <div class="th-head">${avatar(fullName(lead), null, 'lg')}
      <div class="grow" style="min-width:0"><div class="row"><b style="font-size:16px">${esc(fullName(lead))}</b>${statusBadge(lead.status)}</div>
        <div class="small muted">${esc([lead.title, lead.company].filter(Boolean).join(' · '))} · ${esc(lead.email)}</div>
        ${enr.length ? `<div class="row wrap tiny" style="margin-top:6px;gap:6px">${enr.map(({ e, seq, nextIndex, steps }) => `<span class="badge outline"><span class="sq" style="background:${seq.color};width:6px;height:6px"></span>${esc(seq.name)} ${nextIndex}/${steps.length} · ${e.state === 'paused' && e.pausedReason === 'replied' ? 'paused (replied)' : esc(e.state)}</span>${e.state === 'paused' && nextIndex < steps.length ? `<button class="btn xs" data-resume="${e.id}">${icon('play')} Resume</button>` : ''}`).join('')}</div>` : ''}
      </div>
      <select class="input sm" style="width:140px" data-status>${R.STATUSES.map((s) => `<option value="${s.key}" ${s.key === lead.status ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
      <button class="btn sm" data-wa>${icon('wa')}</button>
      <button class="btn sm" data-li>${icon('li')}</button>
      <button class="btn sm" data-lead>${icon('user')} Lead</button>
      ${lastOut ? `<a class="btn sm" target="_blank" rel="noopener" href="https://mail.google.com/mail/u/?authuser=${encodeURIComponent(lastOut.accountEmail)}#all/${esc(lastOut.threadId)}">${icon('ext')} Gmail</a>` : ''}
    </div>
    <div class="th-msgs">${st.msgs.map(msgCard).join('') || '<div class="small muted">No messages yet.</div>'}</div>
    <div class="composer">
      <div class="rte-bar">
        <span class="small muted">Reply · <b style="color:var(--text)">${esc(/^re:/i.test(lastSubject) ? lastSubject : 'Re: ' + lastSubject)}</b></span>
        <span class="grow"></span>
        <button class="btn xs" data-cmd="bold" title="Bold">${icon('bold')}</button>
        <button class="btn xs" data-cmd="italic" title="Italic">${icon('italic')}</button>
        <button class="btn xs" data-cmd="insertUnorderedList" title="Bullets">${icon('list')}</button>
        <button class="btn xs" data-cmd="link" title="Link">${icon('link')}</button>
        <button class="btn xs" data-mergem>{{ }}</button>
        <button class="btn xs" data-tpl>${icon('layers')} Template ${icon('down')}</button>
      </div>
      <div class="rte" contenteditable="true" data-rte data-ph="Write your reply… (merge fields like {{first_name}} work here too)">${st.draft[lead.id] || ''}</div>
      <div class="row wrap" style="margin-top:10px;gap:10px">
        <select class="input sm" style="width:auto" data-from>${accts.map((a) => `<option ${a.email === st.from ? 'selected' : ''}>${esc(a.email)}</option>`).join('') || '<option value="">No Gmail connected</option>'}</select>
        <label class="switch"><input type="checkbox" data-sig ${st.sig ? 'checked' : ''}><span class="tr"></span>Premium signature</label>
        <div class="seg" data-deck>${[['off', 'No deck'], ['attach', 'Attach deck'], ['link', 'Deck link']].map(([k, l]) => `<button data-v="${k}" class="${st.deck === k ? 'on pink' : ''}">${l}</button>`).join('')}</div>
        <button class="btn primary right" data-send ${accts.length ? '' : 'disabled'}>${icon('send')} Send reply</button>
      </div>
    </div>`;
  const rte = $('[data-rte]', box);
  rte.addEventListener('paste', (e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); });
}

function msgCard(m) {
  if (m.direction === 'out') {
    return `<div class="msg out"><div class="mh">${icon('send', 'faint')}<b style="font-weight:600">${m.stepName ? esc(m.stepName) : m.source === 'reply' ? 'Your reply' : m.source === 'gmail' ? 'Sent from Gmail' : 'Sent'}</b>${m.attached ? `<span class="badge outline">${icon('file')} deck attached</span>` : ''}${m.variant != null && m.stepId ? `<span class="badge outline">subject ${'ABC'[m.variant]}</span>` : ''}<span class="tiny faint">${esc(m.accountEmail || '')}</span><span class="right tiny faint">${fmtDate(m.date)}</span></div>
      <div class="mb"><div class="small" style="color:#B9B7C8;margin-bottom:6px">${esc(m.subject || '')}</div>${esc((m.snippet || m.text || '').slice(0, 400))}${(m.text || '').length > 400 ? '<details style="margin-top:8px"><summary class="small muted" style="cursor:pointer">Show full text</summary><div style="margin-top:8px">' + esc(m.text) + '</div></details>' : ''}</div></div>`;
  }
  const [main, quoted] = splitQuoted(m.text);
  return `<div class="msg in ${m.kind === 'auto' ? 'auto' : ''}"><div class="mh">${icon('inbox')}<b style="font-weight:600">${esc(m.fromName || m.from)}</b><span class="tiny faint">${esc(m.from)}</span>${m.kind === 'auto' ? '<span class="badge" style="background:#F59E0B22;color:#F59E0B">auto-reply</span>' : ''}${m.kind === 'unsubscribe' ? '<span class="badge" style="background:#9CA3AF22;color:#C9C9D2">unsubscribe request</span>' : ''}<span class="right tiny faint">${fmtDate(m.date)}</span></div>
    <div class="mb"><div class="small" style="color:#B9B7C8;margin-bottom:6px">${esc(m.subject || '')}</div>${esc(main)}${quoted ? `<details><summary class="small muted" style="cursor:pointer;margin-top:8px">Show quoted text</summary><div class="quoted">${esc(quoted)}</div></details>` : ''}${m.html ? `<div style="margin-top:8px"><button class="btn xs" data-orig="${esc(m.id)}">${icon('eye')} View original</button></div>` : ''}</div></div>`;
}

function onChange(e) {
  const t = e.target;
  if (t.matches('[data-status]')) api('PUT', `/api/leads/${st.leadId}`, { status: t.value }).then(() => { loadState(); ok('Status updated'); }).catch(fail);
  if (t.matches('[data-from]')) st.from = t.value;
  if (t.matches('[data-sig]')) st.sig = t.checked;
}

async function onClick(e) {
  const b = e.target.closest('button, [data-open]');
  if (!b) return;
  const lead = leadById(st.leadId);
  if (b.dataset.open) { openThread(b.dataset.open); drawList(); return; }
  if (b.dataset.f) { st.filter = b.dataset.f; drawList(); return; }
  if (b.matches('[data-sync]')) {
    b.disabled = true;
    try { await api('POST', '/api/sync'); await loadState(); ok('Inbox synced'); } catch (err) { fail(err); }
    b.disabled = false;
    return;
  }
  if (b.matches('[data-lead]')) openLead(st.leadId);
  else if (b.matches('[data-wa]')) shortMenu(b, lead, 'wa');
  else if (b.matches('[data-li]')) shortMenu(b, lead, 'li');
  else if (b.dataset.resume) { try { await api('POST', `/api/enrollments/${b.dataset.resume}/resume`); await loadState(); ok('Sequence resumed: next email scheduled'); } catch (err) { fail(err); } }
  else if (b.dataset.cmd) {
    $('[data-rte]', root).focus();
    if (b.dataset.cmd === 'link') { const u = prompt('Link URL', 'https://'); if (u) document.execCommand('createLink', false, u); }
    else document.execCommand(b.dataset.cmd);
  } else if (b.matches('[data-mergem]')) {
    menu(b, R.MERGE_FIELDS.map((f) => ({ html: `<span class="mono">{{${f.key}}}</span> <span class="tiny faint">${esc(f.label)}</span>`, onClick: () => { const r = $('[data-rte]', root); r.focus(); document.execCommand('insertText', false, `{{${f.key}}}`); } })));
  } else if (b.matches('[data-tpl]')) {
    const items = [];
    for (const s of D().sequences) {
      items.push({ header: s.name });
      s.steps.forEach((x) => items.push({ label: x.name, onClick: () => insertTemplate(x) }));
    }
    menu(b, items);
  } else if (b.closest('[data-deck]')) { st.deck = b.dataset.v; $$('[data-deck] button', root).forEach((x) => x.className = x === b ? 'on pink' : ''); }
  else if (b.matches('[data-orig]')) {
    const m = st.msgs.find((x) => x.id === b.dataset.orig);
    modal({ title: esc(m.subject || 'Original email'), cls: 'wide', body: `<iframe sandbox="" class="preview-frame" style="height:70vh;background:#fff" srcdoc="${esc(m.html)}"></iframe>` });
  } else if (b.matches('[data-send]')) {
    const rte = $('[data-rte]', root);
    const raw = sanitizeRich(rte.innerHTML);
    if (!R.htmlToText(raw).trim()) { fail('Write a reply first.'); return; }
    const html = R.merge(raw, R.mergeData(lead, previewCtx(lead)), 'html');
    b.disabled = true; b.innerHTML = 'Sending…';
    try {
      await api('POST', '/api/reply', { leadId: st.leadId, accountEmail: st.from, html, includeSignature: st.sig, deckMode: st.deck });
      delete st.draft[st.leadId];
      ok('Reply sent');
      await loadState();
      await loadThread(false);
    } catch (err) { fail(err); b.disabled = false; b.innerHTML = `${icon('send')} Send reply`; }
  }
}

function insertTemplate(step) {
  const text = step.blocks.filter((x) => x.type === 'text').map((x) => x.html).join('');
  const rte = $('[data-rte]', root);
  rte.focus();
  if (!R.htmlToText(rte.innerHTML).trim()) rte.innerHTML = sanitizeRich(text);
  else document.execCommand('insertHTML', false, sanitizeRich(text));
  st.draft[st.leadId] = rte.innerHTML;
}

export { seqById };
