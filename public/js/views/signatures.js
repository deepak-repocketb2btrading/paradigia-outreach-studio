/* Premium signature editor, selectable per sender account. */
import { D, R, $, $$, esc, icon, api, ok, fail, loadState, avatar, previewCtx, fillFrame, squarePhoto, upload, confirmBox, debounce, clone } from '../core.js';

let wrap;
let selId = null;
let pending = {};

export function render(container) {
  container.innerHTML = '';
  wrap = document.createElement('div');
  wrap.className = 'page';
  container.appendChild(wrap);
  wrap.addEventListener('click', onClick);
  wrap.addEventListener('input', onInput);
  wrap.addEventListener('change', onChange);
  draw();
}
export function refresh() { drawPreview(); }

const sig = () => D().signatures.find((s) => s.id === selId) || D().signatures[0];

function draw() {
  const d = D();
  if (!selId || !d.signatures.some((s) => s.id === selId)) selId = (d.signatures[0] || {}).id;
  const s = sig();
  const f = (k, label, ph, span) => `<label class="field ${span ? 'span2' : ''}"><span>${label}</span><input class="input" data-k="${k}" value="${esc((s && s[k]) || '')}" placeholder="${esc(ph || '')}"></label>`;
  wrap.innerHTML = `<div class="page-head"><div><div class="eyebrow">Sender identity</div><h1>Signatures</h1></div>
      <div class="actions"><button class="btn primary" data-new>${icon('plus')} New signature</button></div></div>
    <div class="chips" style="margin-bottom:16px">${d.signatures.map((x, i) => `<button class="chip ${x.id === selId ? 'on' : ''}" data-pick="${x.id}">${esc(x.label || x.name)}${i === 0 ? ' <span class="n">default</span>' : ''}</button>`).join('')}</div>
    ${s ? `<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start">
      <div class="card">
        <div class="row" style="gap:16px;margin-bottom:16px"><div class="photo-up" data-photo title="Upload photo">${avatar(s.name, s.photo, 'xl')}</div><div class="grow">${f('label', 'Signature name (internal)', 'Deepak')}</div></div>
        <div class="form-grid">
          ${f('name', 'Full name', 'Roxy Khan')}${f('title', 'Title', 'Head of Events')}
          ${f('phone', 'Phone', '+971 56 798 1463')}${f('whatsapp', 'WhatsApp number', '+971567981463')}
          <label class="field"><span>Email</span><input class="input" data-k="email" value="${esc(s.email || '')}" placeholder="Blank = the Gmail you send from"></label>${f('website', 'Website', 'https://www.mobi-hub.com')}
          ${f('ticketLink', 'Event ticket link', 'https://www.tickettailor.com/…')}${f('ticketLabel', 'Ticket link text', 'Get your event ticket')}
          ${f('tagline', 'Tagline under the logos', '', true)}
          <label class="field span2"><span>Confidentiality note</span><textarea class="input" data-k="confidentiality" rows="3">${esc(s.confidentiality || '')}</textarea></label>
          <label class="field"><span>Default for Gmail account</span><select class="input" data-k="accountEmail"><option value="">Any account</option>${d.accounts.map((a) => `<option ${a.email === s.accountEmail ? 'selected' : ''}>${esc(a.email)}</option>`).join('')}</select></label>
          <div class="field"><span>&nbsp;</span><label class="switch"><input type="checkbox" data-k="showDeckLink" ${s.showDeckLink !== false ? 'checked' : ''}><span class="tr"></span>“Download Sponsorship Deck” link</label></div>
        </div>
        <div class="sp16"></div>
        <div class="row">${s.photo ? '<button class="btn xs ghost" data-nophoto>Use initials instead of photo</button>' : ''}<span class="right row" style="gap:6px">${d.signatures[0] && d.signatures[0].id === s.id ? '<span class="badge" style="background:#22C55E22;color:#22C55E">Default signature</span>' : `<button class="btn sm" data-default>${icon('star')} Make default</button>`}<button class="btn sm danger" data-del ${d.signatures.length < 2 ? 'disabled' : ''}>${icon('trash')} Delete signature</button></span></div>
      </div>
      <div style="position:sticky;top:20px"><div class="label" style="margin-bottom:10px">Live preview</div><iframe class="preview-frame" data-prev style="height:420px"></iframe>
        <div class="small muted" style="margin-top:10px">Photo 72px with a pink ring, contact lines with pink icons, the three logos and the deck link. The phone/WhatsApp here also powers “Meet me on the yacht, let’s talk”.</div></div>
    </div>` : ''}`;
  drawPreview();
}

function drawPreview() {
  const fr = wrap && $('[data-prev]', wrap);
  if (!fr) return;
  const s = { ...sig(), ...(pending[selId] || {}) };
  fillFrame(fr, R.renderEmail({ subject: 'Signature', blocks: [{ id: 's', type: 'signature' }] }, previewCtx(null, { signature: s, mobile: true })).html, {});
}

const save = debounce(async () => {
  const id = selId;
  const patch = pending[id];
  if (!patch) return;
  delete pending[id];
  try { await api('PUT', `/api/signatures/${id}`, patch); await loadState(); } catch (e) { fail(e); }
}, 600);

function onInput(e) {
  const t = e.target;
  if (!t.dataset.k || t.type === 'checkbox' || t.tagName === 'SELECT') return;
  pending[selId] = { ...(pending[selId] || {}), [t.dataset.k]: t.value };
  drawPreview();
  save();
}
async function onChange(e) {
  const t = e.target;
  if (!t.dataset.k || (t.type !== 'checkbox' && t.tagName !== 'SELECT')) return;
  try { await api('PUT', `/api/signatures/${selId}`, { [t.dataset.k]: t.type === 'checkbox' ? t.checked : t.value }); await loadState(); drawPreview(); } catch (err) { fail(err); }
}
async function onClick(e) {
  const b = e.target.closest('button, [data-photo]');
  if (!b) return;
  try {
    if (b.dataset.pick) { selId = b.dataset.pick; draw(); }
    else if (b.matches('[data-new]')) {
      const base = clone(sig() || {});
      delete base.id;
      const r = await api('POST', '/api/signatures', { ...base, label: 'New signature', name: '', title: '', photo: '', phone: '', whatsapp: '', email: '', accountEmail: '' });
      await loadState(); selId = r.id; draw();
    } else if (b.matches('[data-photo]')) {
      const file = await new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => res(i.files[0]); i.click(); });
      if (!file) return;
      const r = await upload(await squarePhoto(file, 400), 'photo');
      await api('PUT', `/api/signatures/${selId}`, { photo: r.ref }); await loadState(); draw(); ok('Photo updated');
    } else if (b.matches('[data-default]')) {
      await api('POST', '/api/order/signatures', { ids: [selId, ...D().signatures.filter((x) => x.id !== selId).map((x) => x.id)] });
      await loadState(); draw(); ok('Default signature updated');
    } else if (b.matches('[data-nophoto]')) { await api('PUT', `/api/signatures/${selId}`, { photo: '' }); await loadState(); draw(); }
    else if (b.matches('[data-del]')) {
      if (await confirmBox('Delete this signature?', { okText: 'Delete', danger: true })) { await api('DELETE', `/api/signatures/${selId}`); selId = null; await loadState(); draw(); }
    }
  } catch (err) { fail(err); }
}
export { $$ };
