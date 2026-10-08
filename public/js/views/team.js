/* Team members shown in the "Meet the Team" block. */
import { D, R, $, esc, icon, api, ok, fail, loadState, avatar, previewCtx, fillFrame, squarePhoto, upload, confirmBox, debounce } from '../core.js';

let wrap;
const pending = {};

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

function memberCard(m) {
  const f = (k, label, ph) => `<label class="field"><span>${label}</span><input class="input sm" data-m="${m.id}" data-k="${k}" value="${esc(m[k] || '')}" placeholder="${esc(ph || '')}"></label>`;
  return `<div class="card" style="margin-bottom:12px">
    <div class="member">
      <div class="photo-up" data-photo="${m.id}" title="Upload photo">${avatar(m.name, m.photo)}</div>
      <div class="col" style="gap:12px">
        <div class="row wrap">
          <input class="input" data-m="${m.id}" data-k="name" value="${esc(m.name)}" style="font-weight:700;max-width:240px">
          ${m.placeholder ? '<span class="badge" style="background:#F59E0B22;color:#F59E0B">placeholder</span>' : ''}${!m.role ? '<span class="badge" style="background:#F59E0B22;color:#F59E0B">add role</span>' : ''}
          <select class="input sm" data-m="${m.id}" data-k="group" style="width:150px"><option value="management" ${m.group !== 'sales' ? 'selected' : ''}>Management</option><option value="sales" ${m.group === 'sales' ? 'selected' : ''}>Sales team</option></select>
          <label class="switch right"><input type="checkbox" data-m="${m.id}" data-k="show" ${m.show !== false ? 'checked' : ''}><span class="tr"></span>Show in emails</label>
        </div>
        <div class="form-grid">
          ${f('role', 'Role', 'Head of Events')}${f('email', 'Email', 'name@mobi-hub.com')}
          ${f('phone', 'Phone', '+971 …')}${f('whatsapp', 'WhatsApp number or wa.me link', '+971…')}
          ${f('linkedin', 'LinkedIn URL', 'https://www.linkedin.com/in/…')}
          <label class="field"><span>Clicking the photo opens</span><select class="input sm" data-m="${m.id}" data-k="linkTo"><option value="linkedin" ${m.linkTo !== 'whatsapp' ? 'selected' : ''}>LinkedIn</option><option value="whatsapp" ${m.linkTo === 'whatsapp' ? 'selected' : ''}>WhatsApp</option></select></label>
        </div>
        <div class="row">${m.photo ? `<button class="btn xs ghost" data-nophoto="${m.id}">Remove photo (use initials)</button>` : '<span class="tiny faint">No photo: initials are shown in a circle.</span>'}<span class="right row" style="gap:4px"><button class="btn xs ghost icon" data-move="${m.id}|-1" title="Move up">${icon('up')}</button><button class="btn xs ghost icon" data-move="${m.id}|1" title="Move down">${icon('down')}</button><button class="btn xs danger" data-del="${m.id}">${icon('trash')} Remove</button></span></div>
      </div>
    </div></div>`;
}

function draw() {
  const team = D().team;
  const groups = [['management', 'Management'], ['sales', 'Sales team']];
  wrap.innerHTML = `<div class="page-head"><div><div class="eyebrow">Meet the team</div><h1>Team</h1></div>
      <div class="actions"><button class="btn" data-add="sales">${icon('plus')} Sales member</button><button class="btn primary" data-add="management">${icon('plus')} Management member</button></div></div>
    <div class="grid" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);align-items:start">
      <div>${groups.map(([g, label]) => `<div class="label" style="margin:4px 0 10px">${label}</div>${team.filter((m) => (m.group || 'management') === g).map(memberCard).join('') || '<div class="small muted" style="margin-bottom:16px">No one yet.</div>'}`).join('<div class="sp8"></div>')}</div>
      <div style="position:sticky;top:20px"><div class="label" style="margin-bottom:10px">Live preview</div><iframe class="preview-frame" data-prev style="height:360px"></iframe>
        <div class="small muted" style="margin-top:10px">Photos show as 56px circles with a pink ring. Each email’s Meet the Team block can also hide individual people.</div></div>
    </div>`;
  drawPreview();
}

function drawPreview() {
  const fr = $('[data-prev]', wrap);
  if (!fr) return;
  const html = R.renderEmail({ subject: 'Team', blocks: [{ id: 't', type: 'team', heading: 'MEET THE TEAM AT THE EVENT' }] }, previewCtx(null, { mobile: true })).html;
  fillFrame(fr, html, {});
}

const saveMember = debounce(async (id) => {
  const patch = pending[id];
  delete pending[id];
  try { await api('PUT', `/api/team/${id}`, patch); await loadState(); drawPreview(); } catch (e) { fail(e); }
}, 500);

function onInput(e) {
  const t = e.target;
  if (!t.dataset.m || t.type === 'checkbox' || t.tagName === 'SELECT') return;
  pending[t.dataset.m] = { ...(pending[t.dataset.m] || {}), [t.dataset.k]: t.value };
  saveMember(t.dataset.m);
}
async function onChange(e) {
  const t = e.target;
  if (!t.dataset.m || (t.type !== 'checkbox' && t.tagName !== 'SELECT')) return;
  try { await api('PUT', `/api/team/${t.dataset.m}`, { [t.dataset.k]: t.type === 'checkbox' ? t.checked : t.value }); await loadState(); if (t.dataset.k === 'group') draw(); else drawPreview(); } catch (err) { fail(err); }
}
async function onClick(e) {
  const b = e.target.closest('button, [data-photo]');
  if (!b) return;
  try {
    if (b.dataset.add) {
      await api('POST', '/api/team', { name: 'New member', role: b.dataset.add === 'sales' ? 'Partnerships' : 'Title', group: b.dataset.add, photo: '', email: '', phone: '', whatsapp: '', linkedin: '', linkTo: 'linkedin', show: true });
      await loadState(); draw(); ok('Member added: fill in their details');
    } else if (b.dataset.photo) {
      const file = await new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => res(i.files[0]); i.click(); });
      if (!file) return;
      const r = await upload(await squarePhoto(file, 400), 'photo');
      await api('PUT', `/api/team/${b.dataset.photo}`, { photo: r.ref });
      await loadState(); draw(); ok('Photo updated');
    } else if (b.dataset.move) {
      const [id, dir] = b.dataset.move.split('|');
      const team = D().team.slice();
      const me = team.find((x) => x.id === id);
      const same = team.filter((x) => (x.group || 'management') === (me.group || 'management'));
      const j = same.indexOf(me) + Number(dir);
      if (j < 0 || j >= same.length) return;
      const other = same[j];
      const a = team.indexOf(me), c = team.indexOf(other);
      [team[a], team[c]] = [team[c], team[a]];
      await api('POST', '/api/team-order', { ids: team.map((x) => x.id) });
      await loadState(); draw();
    } else if (b.dataset.nophoto) {
      await api('PUT', `/api/team/${b.dataset.nophoto}`, { photo: '' }); await loadState(); draw();
    } else if (b.dataset.del) {
      const m = D().team.find((x) => x.id === b.dataset.del);
      if (await confirmBox(`Remove <b>${esc(m.name)}</b> from the team?`, { okText: 'Remove', danger: true })) { await api('DELETE', `/api/team/${m.id}`); await loadState(); draw(); }
    }
  } catch (err) { fail(err); }
}
