/* Marketing review: send an editable review page (or the content .json), then import what comes back
   and choose which changes to keep. The page and the import logic live in shared/review.js. */
import { D, $, $$, esc, icon, api, modal, ok, fail, loadState, plural, fmtDate } from '../core.js';

const qs = (ids, extra) => new URLSearchParams({ sequenceId: ids.join(','), ...(extra || {}) }).toString();

/** Follow a link the way a normal click would: a new tab, or a download. */
function go(url, download) {
  const a = document.createElement('a');
  a.href = url;
  if (download) a.download = '';
  else { a.target = '_blank'; a.rel = 'noopener'; }
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Choose sequences and send them out for review, or import a review that came back. */
export function openReviewDialog(preselect) {
  const d = D();
  const pre = new Set(preselect && preselect.length ? preselect : d.sequences.map((s) => s.id));
  const m = modal({
    title: 'Marketing review',
    body: `<p class="small muted" style="margin-top:0;line-height:1.6">Send marketing one review page with every email. They read each email as a lead sees it, change the wording right on the email, approve each one or ask for changes, and save a small review file (.json) to send back. Import that file here to see every change and pick which to keep.</p>
      <div class="label">Emails to include</div><div class="sp8"></div>
      ${d.sequences.map((s) => `<label class="check" style="display:flex;margin-bottom:9px"><input type="checkbox" data-rseq="${s.id}" ${pre.has(s.id) ? 'checked' : ''}><b>${esc(s.name)}</b><span class="small muted">${plural(s.steps.length, 'email')}${s.steps.some((st) => st.review && st.review.status === 'approved') ? ` · ${s.steps.filter((st) => st.review && st.review.status === 'approved').length} approved` : ''}</span></label>`).join('')}
      <div class="sp8"></div>
      <div class="row wrap" style="gap:8px">
        <button class="btn primary" data-ropen>${icon('ext')} Open review page</button>
        <button class="btn" data-rdl>${icon('download')} Download review page (.html)</button>
        <button class="btn" data-rjson>${icon('code')} Download content (.json)</button>
      </div>
      <div class="tiny faint" style="margin-top:10px;line-height:1.6">Send the <b>.html</b> file by email, Slack, WhatsApp or a shared drive: it opens in any browser on a computer, with the images inside, and needs no login. It contains no leads, only a sample lead (Sarah at Acme Ventures). The <b>.json</b> has the same text for anyone who prefers to edit the content directly; send it back edited and import it below.</div>
      <div style="border-top:1px solid var(--line);margin:18px 0"></div>
      <div class="row"><div class="grow"><b>Got a review back?</b><div class="small muted">Import the .json file the reviewer saved (or an edited content .json).</div></div><button class="btn" data-rimport>${icon('upload')} Import review…</button></div>`,
  });
  m.el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.matches('[data-rimport]')) { m.close(); importReview(); return; }
    const ids = $$('[data-rseq]', m.el).filter((x) => x.checked).map((x) => x.dataset.rseq);
    if (!b.matches('[data-ropen], [data-rdl], [data-rjson]')) return;
    if (!ids.length) { fail('Pick at least one sequence.'); return; }
    if (b.matches('[data-ropen]')) go(`/preview/review?${qs(ids)}`);
    else if (b.matches('[data-rdl]')) { go(`/preview/review?${qs(ids, { download: '1' })}`, true); ok('Review page downloading'); }
    else { go(`/api/review-pack?${qs(ids, { download: '1' })}`, true); ok('Content file downloading'); }
  });
}

/** Pick a review .json, show what it changes, and apply the changes the user keeps. */
export async function importReview() {
  const file = await new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = () => res(i.files[0]); i.click(); });
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { fail('That file isn’t valid JSON.'); return; }
  let cmp;
  try { cmp = await api('POST', '/api/review/check', data); } catch (e) { fail(e); return; }
  showReview(data, cmp);
}

const STATUS = {
  approved: ['✓ Approved', '#22C55E'],
  changes: ['Needs changes', '#F59E0B'],
  pending: ['Not reviewed', '#8A8894'],
};
const plain = (v) => String(v == null ? '' : v).replace(/<\/(p|li)>/gi, ' ').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export function showReview(data, cmp) {
  const isReview = cmp.kind === 'review';
  const emails = cmp.emails.filter((e) => e.changes.length || e.status !== 'pending' || e.comment);
  const all = emails.flatMap((e) => e.changes);
  const usable = all.filter((c) => !c.missing && !c.done);
  const count = (k) => emails.filter((e) => e.status === k).length;
  const changeRow = (c) => {
    const off = c.missing || c.done;
    const note = c.missing ? '<span class="badge outline">this text no longer exists in the email</span>'
      : c.done ? '<span class="badge outline">already in the email</span>'
        : c.conflict ? '<span class="badge" style="background:#F59E0B22;color:#F59E0B">you edited this after sending it for review</span>' : '';
    return `<label class="rv-imp-chg${off ? ' off' : ''}"><input type="checkbox" data-cid="${esc(c.id)}" ${off ? 'disabled' : 'checked'}>
      <div class="grow" style="min-width:0"><div class="row wrap" style="gap:6px"><b class="small">${esc(c.label)}</b>${note}</div>
        <div class="was">${esc(plain(c.current)) || '<i>(empty)</i>'}</div>
        <div class="now">${esc(plain(c.after)) || '<i>(empty)</i>'}</div></div></label>`;
  };
  const m = modal({
    title: isReview ? `Review from ${esc(cmp.reviewer || 'marketing')}` : 'Edited content file',
    cls: 'wide',
    body: `<div class="row wrap" style="gap:8px;margin-bottom:14px">
        ${isReview ? `<span class="badge" style="background:#22C55E22;color:#22C55E">${count('approved')} approved</span><span class="badge" style="background:#F59E0B22;color:#F59E0B">${count('changes')} need changes</span>` : ''}
        <span class="badge outline">${plural(usable.length, 'text change')}</span>
        <span class="small muted">${esc(cmp.title || '')}${cmp.savedAt ? ` · ${isReview ? 'saved' : 'created'} ${fmtDate(cmp.savedAt)}` : ''}</span></div>
      ${emails.length ? '' : '<div class="notice">Nothing to import: no changes, approvals or comments in this file.</div>'}
      ${emails.map((e) => {
        const [label, color] = STATUS[e.status] || STATUS.pending;
        return `<div class="card tight" style="background:var(--panel-2);margin-bottom:12px">
          <div class="row wrap" style="gap:8px"><b>${esc(e.name)}</b><span class="small muted">${esc(e.sequenceName || '')}</span>${isReview ? `<span class="badge right" style="background:${color}22;color:${color}">${label}</span>` : ''}</div>
          ${e.found ? '' : '<div class="notice warn" style="margin-top:8px">This email is no longer in the app, so its changes can’t be applied.</div>'}
          ${e.comment ? `<div class="rv-imp-comment">“${esc(e.comment)}”</div>` : ''}
          ${e.changes.length ? `<div class="sp8"></div>${e.changes.map(changeRow).join('')}` : ''}
        </div>`;
      }).join('')}`,
    foot: `${isReview ? '<label class="check" style="margin-right:auto"><input type="checkbox" data-rrec checked> Mark the emails as approved / changes requested</label>' : '<span style="margin-right:auto"></span>'}
      <button class="btn ghost" data-no>Cancel</button><button class="btn primary" data-apply>${icon('check')} Apply</button>`,
  });
  const btn = $('[data-apply]', m.el);
  const sync = () => {
    const n = $$('[data-cid]:checked', m.el).length;
    btn.innerHTML = `${icon('check')} ${n ? `Apply ${plural(n, 'change')}` : isReview ? 'Save approvals only' : 'Apply'}`;
    btn.disabled = !n && !isReview;
  };
  m.el.addEventListener('change', sync);
  sync();
  $('[data-no]', m.el).onclick = () => m.close();
  btn.onclick = async () => {
    const accept = $$('[data-cid]:checked', m.el).map((x) => x.dataset.cid);
    const rec = $('[data-rrec]', m.el);
    btn.disabled = true;
    try {
      const r = await api('POST', '/api/review/apply', { file: data, accept, record: rec ? rec.checked : false });
      await loadState();
      m.close();
      ok(r.changed ? `${plural(r.changed, 'change')} applied` : 'Review saved on the emails');
    } catch (e) { btn.disabled = false; fail(e); }
  };
}
