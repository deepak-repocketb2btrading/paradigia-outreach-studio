/* Template gallery, picker, preview and the "build a sequence from templates" dialog. */
import { D, R, $, $$, esc, icon, api, modal, ok, fail, loadState, allTemplates, templateById, stepFromTemplate, previewCtx, fillFrame, plural, uid } from '../core.js';

/** Categories in display order. */
export function categories() {
  const seen = [];
  for (const t of allTemplates()) if (!seen.includes(t.category)) seen.push(t.category);
  return seen;
}

/* ------------------------------------------------------------- thumbnails */
let observer = null;
function lazyFill(frame) {
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const f = e.target;
        observer.unobserve(f);
        const tpl = templateById(f.dataset.tpl);
        if (tpl) f.srcdoc = renderTpl(tpl, { thumb: true });
      }
    }, { rootMargin: '300px' });
  }
  observer.observe(frame);
}
export function renderTpl(tpl, { thumb = false } = {}) {
  const st = tpl.step;
  const css = thumb ? 'html,body{overflow:hidden!important;} a{pointer-events:none;}' : '';
  return R.renderEmail({ subject: st.subjects[st.subjectIndex || 0], preheader: st.preheader, blocks: st.blocks, rawHtml: st.rawHtml }, previewCtx(null, { extraCss: css })).html;
}
/** Scaled, non-interactive preview of a template (filled when scrolled into view). */
export function thumbHtml(tpl) {
  return `<div class="tpl-thumb"><iframe data-tpl="${esc(tpl.id)}" tabindex="-1" scrolling="no" title="${esc(tpl.name)}"></iframe></div>`;
}
export function wireThumbs(root) {
  $$('iframe[data-tpl]', root).forEach(lazyFill);
}

export function cardHtml(tpl, actions) {
  return `<div class="tpl-card" data-card="${esc(tpl.id)}">${thumbHtml(tpl)}
    <div class="tpl-meta"><div class="row" style="gap:6px"><b>${esc(tpl.name)}</b>${tpl.builtIn ? '' : '<span class="badge" style="background:#3B1FA833;color:#B7A8FF">mine</span>'}</div>
      <div class="tiny faint">${esc(tpl.category)}${tpl.description ? ` · ${esc(tpl.description)}` : ''}</div>
      ${actions ? `<div class="row wrap" style="gap:4px;margin-top:8px">${actions}</div>` : ''}</div></div>`;
}

function chipsHtml(active) {
  return `<div class="chips">${['All', ...categories()].map((c) => `<button class="chip ${active === c ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
}
const filterList = (cat, q) => allTemplates().filter((t) => (cat === 'All' || t.category === cat) && (!q || `${t.name} ${t.category} ${t.description || ''}`.toLowerCase().includes(q.toLowerCase())));

/* ---------------------------------------------------------------- preview */
export function openPreview(tpl, { onUse, useLabel = 'Use this template' } = {}) {
  let device = 'desktop';
  const m = modal({ title: esc(tpl.name), cls: 'xwide', body: `<div class="row" style="margin-bottom:12px"><span class="small muted">${esc(tpl.category)}${tpl.description ? ` · ${esc(tpl.description)}` : ''}</span>
      <div class="seg right"><button data-dev="desktop" class="on">${icon('monitor')} Desktop</button><button data-dev="mobile">${icon('phone')} Mobile</button></div></div>
    <div style="display:flex;justify-content:center;background:#07070B;border-radius:12px;padding:16px"><iframe data-prev style="border:0;width:640px;height:68vh;border-radius:8px;background:#0B0B10"></iframe></div>
    <div class="sp8"></div><div class="small muted">Subject options: ${tpl.step.subjects.filter(Boolean).map((x) => `“${esc(x)}”`).join(' · ')}</div>`,
  foot: onUse ? `<button class="btn ghost" data-no>Close</button><button class="btn primary" data-yes>${esc(useLabel)}</button>` : '' });
  const fr = $('[data-prev]', m.el);
  fillFrame(fr, renderTpl(tpl), { autoHeight: false });
  m.el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.dev) { device = b.dataset.dev; fr.style.width = device === 'mobile' ? '390px' : '640px'; $$('[data-dev]', m.el).forEach((x) => x.classList.toggle('on', x === b)); }
    if (b.matches('[data-no]')) m.close();
    if (b.matches('[data-yes]')) { m.close(); onUse(tpl); }
  });
}

/* ----------------------------------------------------------------- picker */
/** Choose one template. onPick(tpl) is called with the chosen template. */
export function openTemplatePicker({ title = 'Choose a template', onPick, useLabel = 'Use' } = {}) {
  let cat = 'All';
  let q = '';
  const m = modal({ title, cls: 'xwide', body: '<div data-top></div><div class="sp16"></div><div class="tpl-grid" data-grid></div>' });
  const draw = () => {
    $('[data-top]', m.el).innerHTML = `<div class="row wrap" style="gap:10px">${chipsHtml(cat)}<div class="search right">${icon('search')}<input class="input" data-q placeholder="Search templates" value="${esc(q)}" style="width:220px"></div></div>`;
    $('[data-grid]', m.el).innerHTML = filterList(cat, q).map((t) => cardHtml(t, `<button class="btn primary xs" data-pick="${esc(t.id)}">${esc(useLabel)}</button><button class="btn xs" data-peek="${esc(t.id)}">${icon('eye')} Preview</button>`)).join('') || '<div class="small muted">No templates match.</div>';
    wireThumbs(m.el);
  };
  m.el.addEventListener('click', (e) => {
    const b = e.target.closest('button, .tpl-thumb');
    if (!b) return;
    if (b.dataset.cat) { cat = b.dataset.cat; draw(); return; }
    const id = b.dataset.pick || (b.classList.contains('tpl-thumb') && b.closest('[data-card]').dataset.card);
    if (id) { m.close(); onPick(templateById(id)); return; }
    if (b.dataset.peek) openPreview(templateById(b.dataset.peek), { onUse: (t) => { m.close(); onPick(t); }, useLabel });
  });
  m.el.addEventListener('input', (e) => {
    if (!e.target.matches('[data-q]')) return;
    q = e.target.value;
    const pos = e.target.selectionStart;
    draw();
    const i = $('[data-q]', m.el); i.focus(); i.setSelectionRange(pos, pos);
  });
  draw();
}

/* -------------------------------------------------------- sequence builder */
/** Pick templates, put them in order, set the wait between them, create the sequence. */
export function openSequenceBuilder({ preset = [] } = {}) {
  let cat = 'All';
  const st = { name: '', audience: '', deck: 'off', items: preset.map((id, i) => ({ key: uid('k'), id, delay: i ? 4 : 0 })) };
  const m = modal({ title: 'Build a sequence from templates', cls: 'xwide', body: `<div class="builder">
      <div><div data-chips></div><div class="sp16"></div><div class="tpl-grid compact" data-grid></div></div>
      <div class="builder-side">
        <label class="field"><span>Sequence name</span><input class="input" data-k="name" placeholder="e.g. Gold sponsor push"></label>
        <label class="field"><span>Audience (optional)</span><input class="input" data-k="audience" placeholder="e.g. Decision makers"></label>
        <div class="field"><span>Sponsorship deck default</span><div class="seg" data-deck><button data-v="attach">Attach PDF</button><button data-v="link">Link</button><button data-v="off" class="on pink">Off</button></div></div>
        <div class="label" style="margin-top:6px">Emails in order</div>
        <div class="builder-list" data-list></div>
      </div></div>`,
  foot: '<span class="small muted grow" data-sum></span><button class="btn ghost" data-no>Cancel</button><button class="btn primary upper" data-create>Create sequence</button>' });

  const drawGrid = () => {
    $('[data-chips]', m.el).innerHTML = `<div class="small muted" style="margin-bottom:8px">Click a template to add it to the end of the sequence.</div>${chipsHtml(cat)}`;
    $('[data-grid]', m.el).innerHTML = filterList(cat, '').map((t) => cardHtml(t, `<button class="btn primary xs" data-add="${esc(t.id)}">${icon('plus')} Add</button><button class="btn xs" data-peek="${esc(t.id)}">${icon('eye')}</button>`)).join('');
    wireThumbs(m.el);
  };
  const drawList = () => {
    const list = $('[data-list]', m.el);
    let day = 0;
    list.innerHTML = st.items.length ? st.items.map((it, i) => {
      const t = templateById(it.id);
      if (i) day += Number(it.delay) || 0;
      return `<div class="builder-item" draggable="true" data-item="${it.key}">
        <span class="grip">${icon('grip')}</span><span class="num">${i + 1}</span>
        <div class="grow" style="min-width:0"><b style="font-size:12.5px">${esc(t ? t.name : 'Missing template')}</b><div class="tiny faint">${esc(t ? t.category : '')}</div>
          <div class="row tiny" style="gap:6px;margin-top:4px">${i === 0 ? '<span class="muted">Day 0 (first email)</span>' : `<span class="muted">wait</span><input type="number" min="0" class="input sm" data-delay="${it.key}" value="${Number(it.delay) || 0}" style="width:58px;height:26px"><span class="muted">days · Day ${day}</span>`}</div></div>
        <div class="col" style="gap:2px"><button class="btn ghost icon xs" data-mv="${it.key}|-1">${icon('up')}</button><button class="btn ghost icon xs" data-mv="${it.key}|1">${icon('down')}</button></div>
        <button class="btn ghost icon xs" data-rm="${it.key}">${icon('x')}</button></div>`;
    }).join('') : '<div class="small muted" style="padding:14px;border:1px dashed var(--line-2);border-radius:8px;text-align:center">No emails yet. Add templates from the left.</div>';
    $('[data-sum]', m.el).textContent = st.items.length ? `${plural(st.items.length, 'email')} over ${day} days` : '';
    $('[data-create]', m.el).disabled = !st.items.length;
  };

  m.el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.cat) { cat = b.dataset.cat; drawGrid(); }
    else if (b.dataset.add) { st.items.push({ key: uid('k'), id: b.dataset.add, delay: st.items.length ? 4 : 0 }); drawList(); }
    else if (b.dataset.peek) openPreview(templateById(b.dataset.peek), { onUse: (t) => { st.items.push({ key: uid('k'), id: t.id, delay: st.items.length ? 4 : 0 }); drawList(); }, useLabel: 'Add to sequence' });
    else if (b.dataset.rm) { st.items = st.items.filter((x) => x.key !== b.dataset.rm); drawList(); }
    else if (b.dataset.mv) {
      const [key, dir] = b.dataset.mv.split('|');
      const i = st.items.findIndex((x) => x.key === key);
      const j = i + Number(dir);
      if (j < 0 || j >= st.items.length) return;
      [st.items[i], st.items[j]] = [st.items[j], st.items[i]];
      drawList();
    } else if (b.closest('[data-deck]')) { st.deck = b.dataset.v; $$('[data-deck] button', m.el).forEach((x) => x.className = x === b ? 'on pink' : ''); }
    else if (b.matches('[data-no]')) m.close();
    else if (b.matches('[data-create]')) create(b);
  });
  m.el.addEventListener('input', (e) => {
    if (e.target.dataset.k) st[e.target.dataset.k] = e.target.value;
    if (e.target.dataset.delay) { const it = st.items.find((x) => x.key === e.target.dataset.delay); it.delay = Number(e.target.value) || 0; const pos = e.target.selectionStart; const key = it.key; drawList(); const inp = $(`[data-delay="${key}"]`, m.el); if (inp) { inp.focus(); try { inp.setSelectionRange(pos, pos); } catch { /* number inputs */ } } }
  });
  // drag to reorder
  let dragKey = null;
  m.el.addEventListener('dragstart', (e) => { const it = e.target.closest('[data-item]'); if (!it) return; dragKey = it.dataset.item; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragKey); });
  m.el.addEventListener('dragover', (e) => { const it = e.target.closest('[data-item]'); if (!it || !dragKey) return; e.preventDefault(); $$('.builder-item', m.el).forEach((x) => x.classList.toggle('drop-above', x === it && x.dataset.item !== dragKey)); });
  m.el.addEventListener('dragend', () => { $$('.builder-item', m.el).forEach((x) => x.classList.remove('drop-above')); dragKey = null; });
  m.el.addEventListener('drop', (e) => {
    const it = e.target.closest('[data-item]');
    if (!it || !dragKey || it.dataset.item === dragKey) return;
    e.preventDefault();
    const [moved] = st.items.splice(st.items.findIndex((x) => x.key === dragKey), 1);
    st.items.splice(st.items.findIndex((x) => x.key === it.dataset.item), 0, moved);
    drawList();
  });

  async function create(btn) {
    const name = st.name.trim() || 'New sequence';
    const steps = st.items.map((it, i) => stepFromTemplate(templateById(it.id), { delayDays: i ? Number(it.delay) || 0 : 0, fixedDate: '', threadReply: i > 0 }));
    btn.disabled = true;
    try {
      const r = await api('POST', '/api/sequences', { name, audience: st.audience.trim(), description: `Built from templates: ${st.items.map((it) => templateById(it.id).name).join(' → ')}`, color: '#FF0055', deckChoice: st.deck, steps });
      await loadState();
      m.close();
      ok(`Sequence “${name}” created with ${plural(steps.length, 'email')}`);
      location.hash = `#/sequences/${r.id}`;
    } catch (err) { fail(err); btn.disabled = false; }
  }

  drawGrid();
  drawList();
}

/* ---------------------------------------------------------- save as template */
export async function saveAsTemplate(step, { name, description = '' } = {}) {
  const clean = JSON.parse(JSON.stringify(step));
  delete clean.id;
  const r = await api('POST', '/api/templates', { name: name || step.name, description, step: { ...clean, delayDays: 0, fixedDate: '' }, createdAt: new Date().toISOString() });
  await loadState();
  return r;
}

/** Turn a pasted HTML email into a template (body only, with your footer for unsubscribe). */
export function htmlToTemplateStep(html, name) {
  const body = (String(html).match(/<body[^>]*>([\s\S]*)<\/body>/i) || [null, html])[1];
  const styles = (String(html).match(/<style[\s\S]*?<\/style>/gi) || []).join('\n');
  return {
    name, subjects: [name, '', ''], subjectIndex: 0, abTest: false, preheader: '', delayDays: 0, fixedDate: '', sendTime: '10:00', threadReply: false, deck: 'inherit', whatsapp: '', linkedin: '',
    blocks: [{ id: uid('b'), type: 'html', code: `${styles}\n${body}`.trim(), bg: 'light', padded: false }, { id: uid('b'), type: 'footer', note: R.BLOCKS.footer.defaults.note }],
  };
}
export { D };
