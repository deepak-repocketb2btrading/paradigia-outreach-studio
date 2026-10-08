/* WYSIWYG email editor: click-to-edit canvas, block library, layers, inspector. */
import { D, R, Seed, $, $$, esc, icon, api, modal, ok, fail, loadState, seqById, leadById, clone, uid, previewCtx, fillFrame, sanitizeRich, copyText, copyRich, download, confirmBox, prompt1, upload, fitImage, connectedAccounts, stepStats, fullName, assetUrl } from '../core.js';
import { shortMenu } from '../components/lead.js';

const BRAND_IMAGES = ['brand:hero-yacht.jpg', 'brand:yacht-1.jpg', 'brand:yacht-2.jpg', 'brand:yacht-3.jpg', 'brand:yacht-4.jpg', 'brand:yacht-5.jpg', 'brand:yacht-6.jpg', 'brand:yacht-7.jpg'];

const EDIT_CSS = `
  [data-block]{cursor:pointer;outline:1px dashed transparent;outline-offset:-1px;transition:outline-color .1s}
  [data-block]:hover{outline-color:rgba(255,0,85,.55)}
  [data-block].pb-sel{outline:2px solid #FF0055;outline-offset:-2px}
  [data-edit]{cursor:text;border-radius:2px}
  [data-edit]:hover{box-shadow:0 0 0 1px rgba(255,0,85,.45)}
  [data-edit]:focus{outline:none;box-shadow:0 0 0 2px #FF0055;background:rgba(255,0,85,.05)}
  #pb-tb{position:absolute;z-index:99;display:none;gap:2px;background:#16161F;border:1px solid #2E2E3B;border-radius:8px;padding:4px;box-shadow:0 10px 30px rgba(0,0,0,.5);font-family:Poppins,Arial,sans-serif}
  #pb-tb button{border:0;background:transparent;color:#F2F1EF;font:600 12px Poppins,Arial,sans-serif;height:26px;min-width:26px;padding:0 7px;border-radius:5px;cursor:pointer}
  #pb-tb button:hover{background:#2A2A36}
  #pb-mf{position:absolute;z-index:100;display:none;flex-direction:column;background:#16161F;border:1px solid #2E2E3B;border-radius:8px;padding:4px;box-shadow:0 10px 30px rgba(0,0,0,.5);max-height:260px;overflow:auto}
  #pb-mf button{border:0;background:transparent;color:#F2F1EF;font:500 12px ui-monospace,Consolas,monospace;text-align:left;padding:6px 10px;border-radius:5px;cursor:pointer;white-space:nowrap}
  #pb-mf button:hover{background:#2A2A36}
  .pb-tag{position:absolute;z-index:98;background:#FF0055;color:#fff;font:700 9px Poppins,Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;padding:3px 7px;border-radius:0 0 4px 0;pointer-events:none}`;

const st = {};
let root;
let frame;
let autosaveT;
let renderT;

export function render(container, params) {
  const seq = seqById(params[0]);
  const step = seq && seq.steps.find((s) => s.id === params[1]);
  if (!step) { container.innerHTML = `<div class="page"><div class="notice err">${icon('alert')}<div>Email not found. <a href="#/sequences">Back to sequences</a></div></div></div>`; return; }
  Object.assign(st, { seqId: seq.id, W: clone(step), sel: null, mode: 'edit', device: 'desktop', dark: false, leadId: '', left: 'blocks', right: 'email', dirty: false, saving: false, savedAt: null, hist: [], fut: [], sigId: '' });
  container.innerHTML = '';
  root = document.createElement('div');
  root.className = 'editor';
  root.dataset.view = 'editor';
  container.appendChild(root);
  root.innerHTML = `<div class="ed-top" data-top></div><div class="ed-left" data-left></div><div class="ed-canvas" data-canvas><iframe title="Email canvas"></iframe></div><div class="ed-right" data-right></div>`;
  frame = $('iframe', root);
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  root.addEventListener('focusin', (e) => { if (e.target.matches('input.input, textarea.input')) st.lastInput = e.target; });
  document.addEventListener('keydown', onKey);
  wireLayerDrag();
  drawTop(); drawLeft(); drawRight(); renderCanvas();
}

export async function leave() {
  document.removeEventListener('keydown', onKey);
  if (st.dirty) await save();
  return true;
}
export const dirty = () => !!st.dirty;
export function refresh() { if (!st.dirty) { drawRight(); } }

const seq = () => seqById(st.seqId);
const blocks = () => st.W.blocks;
const blockById = (id) => blocks().find((b) => b.id === id);
const stepIndex = () => seq().steps.findIndex((s) => s.id === st.W.id);
const deckMode = () => (st.W.deck && st.W.deck !== 'inherit' ? st.W.deck : seq().deckChoice || 'off');

/* --------------------------------------------------------------- history */
function snapshot() {
  st.hist.push(JSON.stringify(st.W));
  if (st.hist.length > 60) st.hist.shift();
  st.fut = [];
}
function changed({ canvas = true, right = false, left = false } = {}) {
  st.dirty = true;
  drawSaveState();
  clearTimeout(autosaveT);
  autosaveT = setTimeout(save, 1500);
  if (canvas) { clearTimeout(renderT); renderT = setTimeout(renderCanvas, 120); }
  if (right) drawRight();
  if (left) drawLeft();
}
function undo() {
  if (!st.hist.length) return;
  st.fut.push(JSON.stringify(st.W));
  st.W = JSON.parse(st.hist.pop());
  if (st.sel && !blockById(st.sel)) st.sel = null;
  changed({ right: true, left: true });
}
function redo() {
  if (!st.fut.length) return;
  st.hist.push(JSON.stringify(st.W));
  st.W = JSON.parse(st.fut.pop());
  changed({ right: true, left: true });
}

async function save() {
  clearTimeout(autosaveT);
  if (!st.dirty || st.saving) return;
  st.saving = true;
  drawSaveState();
  try {
    const s = clone(seq());
    const i = s.steps.findIndex((x) => x.id === st.W.id);
    s.steps[i] = clone(st.W);
    if (st.W.deck && st.W.deck !== 'inherit') s.deckChoice = st.W.deck;
    await api('PUT', `/api/sequences/${s.id}`, s);
    st.dirty = false;
    st.savedAt = new Date();
    await loadState();
  } catch (e) { fail(e); }
  st.saving = false;
  drawSaveState();
}

/* ------------------------------------------------------------------- top */
function drawTop() {
  const s = seq();
  const leads = D().leads.slice(0, 300);
  $('[data-top]', root).innerHTML = `
    <a class="btn ghost icon" href="#/sequences/${s.id}" title="Back to sequence">${icon('left')}</a>
    <div class="title"><input data-name value="${esc(st.W.name)}"><small>${esc(s.name)} · email ${stepIndex() + 1} of ${s.steps.length}</small></div>
    <span class="save-state" data-save-state></span>
    <div class="right row" style="gap:8px">
      <div class="seg" data-modeseg><button data-mode="edit" class="${st.mode === 'edit' ? 'on' : ''}">${icon('pen')} Edit</button><button data-mode="preview" class="${st.mode === 'preview' ? 'on' : ''}">${icon('eye')} Preview</button></div>
      <select class="input sm" data-lead style="width:190px" title="Fill merge fields with this lead">${['<option value="">Sample: Sarah · Acme Ventures</option>', ...leads.map((l) => `<option value="${l.id}" ${st.leadId === l.id ? 'selected' : ''}>${esc(fullName(l))}${l.company ? ' · ' + esc(l.company) : ''}</option>`)].join('')}</select>
      <div class="seg"><button data-device="desktop" class="${st.device === 'desktop' ? 'on' : ''}" title="Desktop">${icon('monitor')}</button><button data-device="mobile" class="${st.device === 'mobile' ? 'on' : ''}" title="Mobile">${icon('phone')}</button><button data-darkt class="${st.dark ? 'on' : ''}" title="Dark mode">${icon('moon')}</button></div>
      <button class="btn icon sm" data-undo title="Undo (Ctrl+Z)">${icon('undo')}</button>
      <button class="btn sm" data-test>${icon('mail')} Send test</button>
      <button class="btn sm" data-export>${icon('code')} Export HTML</button>
      <button class="btn primary sm" data-save>Save</button>
    </div>`;
  drawSaveState();
}
function drawSaveState() {
  const el = $('[data-save-state]', root);
  if (!el) return;
  el.innerHTML = st.saving ? 'Saving…' : st.dirty ? '<span class="dot warn"></span> Unsaved changes' : st.savedAt ? `<span class="dot ok"></span> Saved ${st.savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '<span class="dot ok"></span> All changes saved';
}

/* ------------------------------------------------------------------ left */
function drawLeft() {
  const custom = D().customBlocks || [];
  const tabs = `<div class="tabs">${[['blocks', 'Blocks'], ['layers', 'Layers'], ['saved', `Saved${custom.length ? ` (${custom.length})` : ''}`]].map(([k, l]) => `<button data-left="${k}" class="${st.left === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (st.left === 'blocks') {
    body = `<div class="small muted" style="margin-bottom:10px">Click to add ${st.sel ? 'below the selected block' : 'above the signature'}.</div><div class="blk-lib">${Object.entries(R.BLOCKS).map(([k, b]) => `<button class="blk" data-add="${k}"><span class="ic">${esc(b.icon)}</span><span><b>${esc(b.label)}</b><small>${esc(b.hint)}</small></span></button>`).join('')}</div>`;
  } else if (st.left === 'layers') {
    body = blocks().map((b, i) => `<div class="layer ${st.sel === b.id ? 'on' : ''}" draggable="true" data-layer="${b.id}"><span class="grip">${icon('grip')}</span><span class="ic">${esc((R.BLOCKS[b.type] || {}).icon || '?')}</span><span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(layerName(b))}</span><button class="btn ghost icon xs" data-lmove="${i}|-1" title="Up">${icon('up')}</button><button class="btn ghost icon xs" data-lmove="${i}|1" title="Down">${icon('down')}</button></div>`).join('');
  } else {
    body = custom.length ? custom.map((c) => `<div class="blk" style="cursor:default"><span class="ic">${esc((R.BLOCKS[c.block.type] || {}).icon || '?')}</span><span class="grow"><b>${esc(c.name)}</b><small>${esc((R.BLOCKS[c.block.type] || {}).label || c.block.type)}</small></span><button class="btn xs" data-use="${c.id}">Add</button><button class="btn ghost icon xs" data-delc="${c.id}">${icon('trash')}</button></div>`).join('<div class="sp8"></div>')
      : '<div class="small muted">Select any block and choose “Save as reusable block” in the right panel. Saved blocks appear here for every email.</div>';
  }
  $('[data-left]', root).innerHTML = tabs + `<div class="ed-pane">${body}</div>`;
}
function layerName(b) {
  const meta = R.BLOCKS[b.type] || {};
  const hint = b.type === 'text' ? R.htmlToText(b.html || '').slice(0, 40) : b.type === 'tierCard' ? `${b.tier === 'lead' ? "lead's tier" : b.tier}` : b.type === 'hero' ? b.eyebrow : b.type === 'cta' || b.type === 'secondaryCta' ? b.text : b.type === 'benefits' ? (b.eyebrow || b.title) : '';
  return `${meta.label || b.type}${hint ? ` · ${hint}` : ''}`;
}

/* ---------------------------------------------------------------- canvas */
function ctxFor() {
  const lead = st.leadId ? leadById(st.leadId) : Seed.sampleLead();
  return previewCtx(lead, { signatureId: st.sigId, deckMode: deckMode(), editable: st.mode === 'edit', resolve: st.mode === 'edit' ? false : undefined, forceDark: st.dark, extraCss: st.mode === 'edit' ? EDIT_CSS : '', mobile: st.device === 'mobile' });
}

function renderCanvas() {
  if (!frame) return;
  const canvas = $('[data-canvas]', root);
  canvas.classList.toggle('mobile', st.device === 'mobile');
  const scroll = canvas.scrollTop;
  const h = frame.offsetHeight;
  if (h) frame.style.minHeight = h + 'px';
  const doc = { subject: st.W.subjects[st.W.subjectIndex || 0], preheader: st.W.preheader, blocks: st.W.blocks };
  fillFrame(frame, R.renderEmail(doc, ctxFor()).html, {
    onLoad: (d) => {
      canvas.scrollTop = scroll;
      setTimeout(() => { frame.style.minHeight = ''; }, 300);
      if (st.mode === 'edit') wireCanvas(d);
      else d.addEventListener('click', (e) => { if (e.target.closest('a')) e.preventDefault(); });
    },
  });
}

function wireCanvas(d) {
  d.execCommand('defaultParagraphSeparator', false, 'p');
  const tb = d.createElement('div');
  tb.id = 'pb-tb';
  tb.innerHTML = '<button data-c="bold" title="Bold"><b>B</b></button><button data-c="italic" title="Italic"><i>I</i></button><button data-c="link" title="Link">Link</button><button data-c="list" title="Bullets">• List</button><button data-c="merge" title="Insert merge field">{{ }}</button>';
  const mf = d.createElement('div');
  mf.id = 'pb-mf';
  mf.innerHTML = R.MERGE_FIELDS.map((m) => `<button data-m="{{${m.key}}}">{{${m.key}}}</button>`).join('');
  const tag = d.createElement('div');
  tag.className = 'pb-tag';
  tag.style.display = 'none';
  d.body.append(tb, mf, tag);
  let focused = null;

  const place = (el) => {
    const r = el.getBoundingClientRect();
    const rich = !!el.dataset.rich;
    $$('[data-c="bold"],[data-c="italic"],[data-c="link"],[data-c="list"]', tb).forEach((b) => { b.style.display = rich ? '' : 'none'; });
    tb.style.display = 'flex';
    tb.style.left = Math.max(4, r.left + d.defaultView.scrollX) + 'px';
    tb.style.top = Math.max(4, r.top + d.defaultView.scrollY - 40) + 'px';
  };
  const commit = (el) => {
    const blk = el.closest('[data-block]');
    const b = blk && blockById(blk.dataset.block);
    if (!b) return;
    const path = el.dataset.edit;
    const val = el.dataset.rich ? sanitizeRich(el.innerHTML) : el.innerText.replace(/\s+/g, ' ').trim();
    if (getPath(b, path) === val) return;
    snapshot();
    setPath(b, path, val);
    changed({ canvas: false, right: st.right === 'email' || st.sel === b.id });
  };

  d.querySelectorAll('[data-edit]').forEach((el) => {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
    el.addEventListener('focus', () => { focused = el; place(el); });
    el.addEventListener('blur', () => { setTimeout(() => { if (d.activeElement !== el) { tb.style.display = 'none'; mf.style.display = 'none'; } }, 150); commit(el); });
    el.addEventListener('input', () => { st.dirty = true; drawSaveState(); });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !el.dataset.rich) { e.preventDefault(); el.blur(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); commit(el); save(); }
    });
    el.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      d.execCommand('insertText', false, el.dataset.rich ? text : text.replace(/\s*\n\s*/g, ' '));
    });
  });

  tb.addEventListener('mousedown', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    e.preventDefault();
    const c = b.dataset.c;
    if (c === 'bold') d.execCommand('bold');
    if (c === 'italic') d.execCommand('italic');
    if (c === 'list') d.execCommand('insertUnorderedList');
    if (c === 'link') {
      const url = window.prompt('Link URL (https://…, mailto:… or {{ticket_link}})', 'https://');
      if (url) d.execCommand('createLink', false, url);
    }
    if (c === 'merge') {
      const r = b.getBoundingClientRect();
      mf.style.display = mf.style.display === 'flex' ? 'none' : 'flex';
      mf.style.left = r.left + d.defaultView.scrollX + 'px';
      mf.style.top = r.bottom + d.defaultView.scrollY + 4 + 'px';
    }
  });
  mf.addEventListener('mousedown', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    e.preventDefault();
    d.execCommand('insertText', false, b.dataset.m);
    mf.style.display = 'none';
  });

  d.addEventListener('click', (e) => {
    if (e.target.closest('#pb-tb, #pb-mf')) return;
    const a = e.target.closest('a');
    if (a) e.preventDefault();
    const blk = e.target.closest('[data-block]');
    if (blk) select(blk.dataset.block, false);
  });
  d.addEventListener('mouseover', (e) => {
    const blk = e.target.closest('[data-block]');
    if (!blk) { tag.style.display = 'none'; return; }
    const r = blk.getBoundingClientRect();
    tag.textContent = (R.BLOCKS[blk.dataset.type] || {}).label || blk.dataset.type;
    tag.style.display = 'block';
    tag.style.left = r.left + d.defaultView.scrollX + 'px';
    tag.style.top = r.top + d.defaultView.scrollY + 'px';
  });
  if (st.sel) { const el = d.querySelector(`[data-block="${st.sel}"]`); if (el) el.classList.add('pb-sel'); }
}

function select(id, scroll) {
  st.sel = id;
  st.right = id ? 'block' : 'email';
  const d = frame.contentDocument;
  if (d) {
    d.querySelectorAll('.pb-sel').forEach((x) => x.classList.remove('pb-sel'));
    const el = id && d.querySelector(`[data-block="${id}"]`);
    if (el) {
      el.classList.add('pb-sel');
      if (scroll) { const canvas = $('[data-canvas]', root); canvas.scrollTo({ top: el.getBoundingClientRect().top + frame.offsetTop - 80, behavior: 'smooth' }); }
    }
  }
  drawRight();
  if (st.left === 'layers') drawLeft();
}

/* ----------------------------------------------------------------- right */
function drawRight() {
  if (!root) return;
  const b = st.sel && blockById(st.sel);
  const tabs = `<div class="tabs"><button data-right="email" class="${st.right === 'email' ? 'on' : ''}">Email settings</button><button data-right="block" class="${st.right === 'block' ? 'on' : ''}" ${b ? '' : 'disabled'}>${b ? esc((R.BLOCKS[b.type] || {}).label) : 'Block'}</button></div>`;
  $('[data-right]', root).innerHTML = tabs + (st.right === 'block' && b ? blockInspector(b) : emailInspector());
}

function emailInspector() {
  const W = st.W;
  const s = seq();
  const i = stepIndex();
  const stats = stepStats(s, W);
  const words = R.bodyWords(W);
  const ctx = ctxFor();
  const warns = R.preflight({ subject: W.subjects[W.subjectIndex || 0], preheader: W.preheader, blocks: W.blocks }, { ...ctx, editable: false, resolve: undefined });
  const deck = D().settings.deck || {};
  const dm = W.deck || 'inherit';
  return `
  <div class="insp-sec"><h5>Subject lines</h5>
    ${[0, 1, 2].map((k) => `<div class="ab-row"><span class="k ${W.abTest || (W.subjectIndex || 0) === k ? 'on' : ''}" data-pick="${k}" title="Use this subject">${'ABC'[k]}</span><div><input class="input sm" data-w="subjects.${k}" value="${esc(W.subjects[k] || '')}" placeholder="Subject option ${'ABC'[k]}">${stats.variants[k] && stats.variants[k].sent ? `<div class="tiny faint" style="margin-top:3px">${stats.variants[k].sent} sent · ${stats.variants[k].replied} replied (${Math.round(stats.variants[k].replied / stats.variants[k].sent * 100)}%)</div>` : ''}</div></div>`).join('')}
    <label class="switch"><input type="checkbox" data-w="abTest" ${W.abTest ? 'checked' : ''}><span class="tr"></span>A/B test: rotate filled subjects</label>
    ${W.threadReply && i > 0 ? '<div class="tiny faint">Sent as a reply in the lead’s existing thread, so recipients see “Re: [first subject]”. These subjects are used when a lead has no thread yet.</div>' : ''}
    <div class="tiny muted">Insert: ${R.MERGE_FIELDS.slice(0, 7).map((m) => `<span class="pill-k" data-merge="{{${m.key}}}">{{${m.key}}}</span>`).join(' ')}</div>
  </div>
  <div class="insp-sec"><h5>Preheader</h5>
    <input class="input sm" data-w="preheader" value="${esc(W.preheader || '')}" placeholder="Preview text shown after the subject">
    <div class="tiny faint">${(W.preheader || '').length} characters · aim for 40–100</div>
  </div>
  <div class="insp-sec"><h5>Timing</h5>
    <div class="seg" data-timing><button data-v="delay" class="${!W.fixedDate ? 'on' : ''}">After previous</button><button data-v="date" class="${W.fixedDate ? 'on' : ''}">Fixed date</button></div>
    <div class="row">${W.fixedDate ? `<input type="date" class="input sm" data-w="fixedDate" value="${esc(W.fixedDate)}">` : `<input type="number" min="0" class="input sm" style="width:90px" data-w="delayDays" value="${Number(W.delayDays) || 0}" ${i === 0 ? 'disabled' : ''}><span class="small muted">${i === 0 ? 'first email (day 0)' : 'days after previous'}</span>`}</div>
    <div class="row"><span class="small muted" style="width:90px">Send time</span><input type="time" class="input sm" style="width:120px" data-w="sendTime" value="${esc(W.sendTime || '10:00')}"><span class="tiny faint">${esc(D().settings.sending.timezone)}</span></div>
    ${i > 0 ? `<label class="switch"><input type="checkbox" data-w="threadReply" ${W.threadReply ? 'checked' : ''}><span class="tr"></span>Send as reply in the same thread</label>` : ''}
  </div>
  <div class="insp-sec"><h5>Sponsorship deck (PDF)</h5>
    <div class="seg" data-deck>${[['inherit', `Default (${s.deckChoice || 'off'})`], ['attach', 'Attach'], ['link', 'Link'], ['off', 'Off']].map(([k, l]) => `<button data-v="${k}" class="${dm === k ? 'on pink' : ''}">${l}</button>`).join('')}</div>
    <div class="tiny faint">Your choice here becomes this sequence’s remembered default. ${deck.fileName ? `File: ${esc(deck.fileName)} (${(deck.size / 1048576).toFixed(1)} MB)` : 'No deck uploaded.'}${deck.size > 10 * 1048576 ? ' <b style="color:#F59E0B">Over 10 MB, consider linking instead.</b>' : ''}${deckMode() === 'link' && !deck.hostedUrl ? ' <b style="color:#F59E0B">Add a hosted deck URL in Settings for the link option.</b>' : ''}</div>
  </div>
  <div class="insp-sec"><h5>Copy check</h5>
    <div class="wc"><div class="progress"><i style="width:${Math.min(100, words / 130 * 100)}%;${words > 130 ? 'background:#F59E0B' : ''}"></i></div><span class="small ${words > 130 ? '' : 'muted'}">${words}/130 words</span></div>
    ${warns.map((w) => `<div class="notice ${w.level === 'info' ? 'info' : 'warn'}">${icon(w.level === 'info' ? 'info' : 'alert')}<div class="small">${esc(w.msg)}</div></div>`).join('') || `<div class="notice ok">${icon('check')}<div class="small">Ready to send.</div></div>`}
  </div>
  <div class="insp-sec"><h5>WhatsApp version</h5>
    <textarea class="input" data-w="whatsapp" rows="4">${esc(W.whatsapp || '')}</textarea>
    <div class="row"><span class="tiny faint">${(W.whatsapp || '').length} chars</span><button class="btn xs right" data-copyshort="whatsapp">${icon('copy')} Copy</button></div>
  </div>
  <div class="insp-sec"><h5>LinkedIn version</h5>
    <textarea class="input" data-w="linkedin" rows="3">${esc(W.linkedin || '')}</textarea>
    <div class="row"><span class="tiny ${(W.linkedin || '').length > 300 ? '' : 'faint'}" ${(W.linkedin || '').length > 300 ? 'style="color:#F59E0B"' : ''}>${(W.linkedin || '').length}/300 (connection note limit)</span><button class="btn xs right" data-copyshort="linkedin">${icon('copy')} Copy</button></div>
  </div>`;
}

const fld = {
  text: (b, k, label, ph) => `<label class="field"><span>${label}</span><input class="input sm" data-b="${k}" value="${esc(getPath(b, k) || '')}" placeholder="${esc(ph || '')}"></label>`,
  area: (b, k, label, rows = 3) => `<label class="field"><span>${label}</span><textarea class="input" rows="${rows}" data-b="${k}">${esc(getPath(b, k) || '')}</textarea></label>`,
  sel: (b, k, label, opts) => `<label class="field"><span>${label}</span><select class="input sm" data-b="${k}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(getPath(b, k) ?? '') === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`,
  sw: (b, k, label) => `<label class="switch"><input type="checkbox" data-b="${k}" ${getPath(b, k) !== false && getPath(b, k) != null && getPath(b, k) !== '' ? 'checked' : ''}><span class="tr"></span>${label}</label>`,
  num: (b, k, label) => `<label class="field"><span>${label}</span><input type="number" class="input sm" data-b="${k}" value="${esc(getPath(b, k) ?? '')}"></label>`,
  bg: (b) => fld.sel(b, 'bg', 'Background', [['light', 'Off-white'], ['dark', 'Black']]),
};

function imagePicker(b, k) {
  const imgs = [...BRAND_IMAGES, ...((D().settings.images) || [])];
  return `<div class="field"><span>Image</span><div class="img-pick">${imgs.map((ref) => `<button data-img="${esc(ref)}" data-imgk="${k}" class="${getPath(b, k) === ref ? 'on' : ''}"><img src="${esc(assetUrl(ref))}" alt=""></button>`).join('')}</div>
    <div class="row"><button class="btn xs" data-upimg="${k}" data-hero="${b.type === 'hero' ? 1 : ''}">${icon('upload')} Upload image</button>${b.type === 'hero' ? '<span class="tiny faint">Uploads get the night-water gradient automatically.</span>' : ''}</div></div>`;
}

function itemsEditor(b, kind) {
  const items = b.items || [];
  return `<div class="field"><span>${kind === 'callout' ? 'Bullet points (optional)' : 'Items'}</span><div class="items-ed">${items.map((it, i) => `<div class="it">
      ${kind === 'callout' ? `<input class="input sm" data-b="items.${i}" value="${esc(it)}">` : `<input class="input sm" data-b="items.${i}.title" value="${esc(it.title || '')}" placeholder="Title (uppercase)"><textarea class="input" rows="2" data-b="items.${i}.text" placeholder="Description">${esc(it.text || '')}</textarea>`}
      <div class="row" style="gap:4px"><button class="btn ghost icon xs" data-item="${i}|up">${icon('up')}</button><button class="btn ghost icon xs" data-item="${i}|down">${icon('down')}</button><button class="btn ghost icon xs right" data-item="${i}|del">${icon('trash')}</button></div></div>`).join('')}</div>
    <button class="btn xs" data-item="-1|add">${icon('plus')} Add item</button></div>`;
}

function actionFields(b) {
  const a = b.action || 'reply';
  return fld.sel(b, 'action', 'When clicked', [['reply', 'Reply by email (pre-filled subject)'], ['tickets', 'Open ticket page'], ['whatsapp', 'Open WhatsApp chat with sender'], ['deck', 'Open sponsorship deck'], ['url', 'Custom link']]) +
    (a === 'reply' ? fld.text(b, 'replySubject', 'Reply subject', 'Reserve Bronze for {{company}}') : '') +
    (a === 'url' ? fld.text(b, 'url', 'Link URL', 'https://') : '') +
    (a === 'whatsapp' ? fld.area(b, 'waText', 'Pre-filled WhatsApp message', 2) : '');
}

function blockInspector(raw) {
  const b = { ...(R.BLOCKS[raw.type] || {}).defaults, ...raw };
  const T = R.BLOCKS[b.type] || {};
  let f = '';
  switch (b.type) {
    case 'header': f = fld.sw(b, 'showParadigia', 'Paradigia logo') + fld.sw(b, 'showMobihub', 'mobi hub | events logo') + fld.sw(b, 'showSunstrike', 'Sunstrike logo'); break;
    case 'hero': f = imagePicker(b, 'image') + fld.text(b, 'eyebrow', 'Pink small caps') + fld.text(b, 'headline', 'Headline') + fld.text(b, 'dateLine', 'Date line') + fld.text(b, 'alt', 'Image alt text') + fld.text(b, 'link', 'Image link (optional)', 'https://'); break;
    case 'heading': f = fld.text(b, 'eyebrow', 'Pink label') + fld.text(b, 'title', 'Title') + fld.sel(b, 'align', 'Align', [['left', 'Left'], ['center', 'Center']]) + fld.sw(b, 'underline', 'Pink underline') + fld.bg(b); break;
    case 'text': f = `<div class="notice info">${icon('info')}<div class="small">Click the text in the canvas to edit it. A toolbar appears for bold, links, bullets and merge fields.</div></div>` + fld.bg(b) + fld.sel(b, 'pad', 'Spacing', [['s', 'Tight'], ['m', 'Normal'], ['l', 'Roomy']]) + fld.sel(b, 'align', 'Align', [['left', 'Left'], ['center', 'Center']]); break;
    case 'benefits': f = fld.text(b, 'eyebrow', 'Pink label') + fld.text(b, 'title', 'Title (optional)') + fld.sel(b, 'bullet', 'Bullet colour', [['pink', 'Pink'], ['bronze', 'Bronze'], ['silver', 'Silver'], ['gold', 'Gold'], ['premium', 'Premium pink']]) + fld.bg(b) + itemsEditor(b, 'benefits'); break;
    case 'tierCard': f = fld.sel(b, 'tier', 'Tier', [['bronze', 'Bronze · $3,000'], ['silver', 'Silver · $6,000'], ['gold', 'Gold · $10,000'], ['premium', 'Premium · $18,000'], ['lead', "Lead's tier interest"]]) + fld.text(b, 'badge', 'Badge (empty = none)', 'BEST ENTRY POINT') + fld.sw(b, 'showBenefits', 'Show package benefits') + fld.num(b, 'maxBenefits', 'Max benefits shown (0 = all)') + fld.sw(b, 'showUpgrades', 'Show upgrade line (higher tiers)') + `<div class="tiny faint">Prices and benefits come from Settings → Event & tiers.</div>`; break;
    case 'comparison': f = fld.text(b, 'title', 'Title') + fld.sel(b, 'highlight', 'Highlight column', [['bronze', 'Bronze'], ['silver', 'Silver'], ['gold', 'Gold'], ['premium', 'Premium'], ['none', 'None']]) + fld.text(b, 'badge', 'Highlight label', 'BEST ENTRY POINT') + fld.area(b, 'caption', 'Caption (optional)', 2); break;
    case 'callout': f = fld.text(b, 'eyebrow', 'Pink label') + fld.area(b, 'text', 'Text', 3) + itemsEditor(b, 'callout'); break;
    case 'cta': f = fld.text(b, 'text', 'Button text') + actionFields(b) + fld.text(b, 'note', 'Small note under button (optional)'); break;
    case 'secondaryCta': f = fld.text(b, 'text', 'Text') + actionFields(b); break;
    case 'image': f = imagePicker(b, 'src') + fld.text(b, 'alt', 'Alt text (required)') + fld.text(b, 'link', 'Link (optional)') + fld.text(b, 'caption', 'Caption (optional)') + fld.sw(b, 'full', 'Full width'); break;
    case 'divider': f = fld.sel(b, 'style', 'Style', [['wave', 'Pink wave line art'], ['pink', 'Short pink bar'], ['line', 'Thin line']]) + fld.bg(b); break;
    case 'spacer': f = fld.num(b, 'height', 'Height (px)') + fld.bg(b); break;
    case 'team': {
      const team = D().team;
      const sel = b.members || team.map((m) => m.id);
      f = fld.text(b, 'heading', 'Heading') + fld.sw(b, 'showManagement', 'Show MANAGEMENT row') + fld.sw(b, 'showSales', 'Show SALES TEAM row') +
        `<div class="field"><span>People in this email</span>${team.map((m) => `<label class="check"><input type="checkbox" data-member="${m.id}" ${sel.includes(m.id) ? 'checked' : ''} ${m.show === false ? 'disabled' : ''}> ${esc(m.name)} <span class="tiny faint">${esc(m.group === 'sales' ? 'Sales' : 'Management')}${m.show === false ? ' · hidden in Team' : ''}${m.placeholder ? ' · placeholder' : ''}</span></label>`).join('')}</div>
        <a class="btn xs" href="#/team">${icon('team')} Manage team, photos and links</a>`;
      break;
    }
    case 'signature': f = `<div class="notice info">${icon('info')}<div class="small">Each email uses the signature of the account that sends it. Preview a different one here.</div></div>` +
      `<label class="field"><span>Preview signature</span><select class="input sm" data-sigprev>${D().signatures.map((s) => `<option value="${s.id}" ${st.sigId === s.id ? 'selected' : ''}>${esc(s.label || s.name)}</option>`).join('')}</select></label><a class="btn xs" href="#/signatures">${icon('pen')} Edit signatures</a>`; break;
    case 'footer': f = fld.area(b, 'note', 'Why they received this', 3) + `<div class="tiny faint">The unsubscribe link is added automatically (Settings → Unsubscribe).</div>`; break;
    default: f = '';
  }
  return `<div class="insp-sec"><div class="row"><span class="ic" style="color:#FF0055;font-weight:700">${esc(T.icon || '')}</span><b>${esc(T.label || b.type)}</b></div>${f}</div>
    <div class="insp-sec"><h5>Block</h5><div class="row wrap" style="gap:6px">
      <button class="btn xs" data-bact="up">${icon('up')} Up</button><button class="btn xs" data-bact="down">${icon('down')} Down</button>
      <button class="btn xs" data-bact="dup">${icon('dup')} Duplicate</button><button class="btn xs" data-bact="save">${icon('star')} Save as reusable</button>
      <button class="btn xs danger" data-bact="del">${icon('trash')} Delete</button></div></div>`;
}

/* -------------------------------------------------------------- mutation */
function getPath(o, path) { return String(path).split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
function setPath(o, path, v) {
  const ks = String(path).split('.');
  let cur = o;
  ks.slice(0, -1).forEach((k, i) => { if (cur[k] == null) cur[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; cur = cur[k]; });
  cur[ks[ks.length - 1]] = v;
}

function addBlock(type, preset) {
  snapshot();
  const b = preset ? { ...clone(preset), id: uid('b') } : { id: uid('b'), type, ...clone(R.BLOCKS[type].defaults) };
  const list = blocks();
  let at = list.length;
  if (st.sel) at = list.findIndex((x) => x.id === st.sel) + 1;
  else { const sig = list.findIndex((x) => x.type === 'signature'); if (sig >= 0) at = sig; }
  list.splice(at, 0, b);
  st.sel = b.id;
  st.right = 'block';
  changed({ right: true, left: true });
  setTimeout(() => select(b.id, true), 250);
}
function moveBlock(id, dir) {
  const list = blocks();
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  snapshot();
  [list[i], list[j]] = [list[j], list[i]];
  changed({ left: true });
}

/* ---------------------------------------------------------------- events */
function onKey(e) {
  if (!root || !root.isConnected) return;
  const a = document.activeElement;
  const typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable || a.tagName === 'IFRAME');
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  else if (!typing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
  else if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && st.sel) { e.preventDefault(); const id = st.sel; snapshot(); st.W.blocks = blocks().filter((b) => b.id !== id); st.sel = null; st.right = 'email'; changed({ right: true, left: true }); }
}

function onInput(e) {
  const t = e.target;
  if (t.matches('[data-name]')) { st.W.name = t.value; changed({ canvas: false }); return; }
  if (t.dataset.w) {
    if (t.type === 'checkbox') return;
    const k = t.dataset.w;
    if (!st.typingSnap) { snapshot(); st.typingSnap = true; setTimeout(() => { st.typingSnap = false; }, 800); }
    setPath(st.W, k, t.type === 'number' ? Number(t.value) : t.value);
    changed({ canvas: k === 'preheader' || k.startsWith('subjects') });
    return;
  }
  if (t.dataset.b) {
    if (t.type === 'checkbox' || t.tagName === 'SELECT') return;
    const b = blockById(st.sel);
    if (!b) return;
    if (!st.typingSnap) { snapshot(); st.typingSnap = true; setTimeout(() => { st.typingSnap = false; }, 800); }
    setPath(b, t.dataset.b, t.type === 'number' ? Number(t.value) : t.value);
    changed();
  }
}

function onChange(e) {
  const t = e.target;
  if (t.matches('[data-lead]')) { st.leadId = t.value; if (st.mode === 'edit') { st.mode = 'preview'; drawTop(); } renderCanvas(); return; }
  if (t.matches('[data-sigprev]')) { st.sigId = t.value; renderCanvas(); return; }
  if (t.dataset.w && t.type === 'checkbox') { snapshot(); setPath(st.W, t.dataset.w, t.checked); changed({ canvas: false, right: true }); return; }
  if (t.dataset.w && (t.type === 'date' || t.type === 'time' || t.type === 'number')) { drawRight(); return; }
  if (t.dataset.b && (t.type === 'checkbox' || t.tagName === 'SELECT')) {
    const b = blockById(st.sel);
    if (!b) return;
    snapshot();
    setPath(b, t.dataset.b, t.type === 'checkbox' ? t.checked : t.value);
    changed({ right: t.dataset.b === 'action' });
    return;
  }
  if (t.dataset.member) {
    const b = blockById(st.sel);
    snapshot();
    const team = D().team;
    const cur = new Set(b.members || team.map((m) => m.id));
    if (t.checked) cur.add(t.dataset.member); else cur.delete(t.dataset.member);
    b.members = team.filter((m) => cur.has(m.id)).map((m) => m.id);
    if (b.members.length === team.length) b.members = null;
    changed();
  }
}

async function onClick(e) {
  const b = e.target.closest('button, [data-pick], [data-merge]');
  if (!b) return;
  if (b.dataset.mode) { st.mode = b.dataset.mode; drawTop(); renderCanvas(); }
  else if (b.dataset.device) { st.device = b.dataset.device; drawTop(); renderCanvas(); }
  else if (b.matches('[data-darkt]')) { st.dark = !st.dark; drawTop(); renderCanvas(); }
  else if (b.matches('[data-undo]')) undo();
  else if (b.matches('[data-save]')) { st.dirty = true; await save(); ok('Saved'); }
  else if (b.matches('[data-test]')) { await save(); sendTest(seq(), st.W); }
  else if (b.matches('[data-export]')) { await save(); openExport(seq(), st.W); }
  else if (b.dataset.left) { st.left = b.dataset.left; drawLeft(); }
  else if (b.dataset.right) { st.right = b.dataset.right; drawRight(); }
  else if (b.dataset.add) addBlock(b.dataset.add);
  else if (b.dataset.use) { const c = (D().customBlocks || []).find((x) => x.id === b.dataset.use); if (c) addBlock(c.block.type, c.block); }
  else if (b.dataset.delc) { if (await confirmBox('Delete this saved block? Emails that already use it keep their copy.', { okText: 'Delete', danger: true })) { await api('DELETE', `/api/customBlocks/${b.dataset.delc}`); await loadState(); drawLeft(); } }
  else if (b.dataset.lmove) { const [i, dir] = b.dataset.lmove.split('|').map(Number); moveBlock(blocks()[i].id, dir); }
  else if (b.closest('[data-layer]') && !b.dataset.lmove) { select(b.closest('[data-layer]').dataset.layer, true); }
  else if (b.dataset.pick != null) { snapshot(); st.W.subjectIndex = Number(b.dataset.pick); if (st.W.abTest) st.W.abTest = false; changed({ canvas: false, right: true }); }
  else if (b.dataset.merge) {
    const inp = st.lastInput && root.contains(st.lastInput) ? st.lastInput : null;
    if (inp) {
      const p = inp.selectionStart ?? inp.value.length;
      inp.value = inp.value.slice(0, p) + b.dataset.merge + inp.value.slice(inp.selectionEnd ?? p);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.focus();
    } else copyText(b.dataset.merge, `${b.dataset.merge} copied`);
  } else if (b.closest('[data-timing]')) {
    snapshot();
    if (b.dataset.v === 'date') st.W.fixedDate = st.W.fixedDate || D().settings.event.date || '2026-12-09'; else st.W.fixedDate = '';
    changed({ canvas: false, right: true });
  } else if (b.closest('[data-deck]')) { snapshot(); st.W.deck = b.dataset.v; changed({ right: true }); }
  else if (b.dataset.copyshort) {
    const text = st.W[b.dataset.copyshort] || '';
    copyText(st.leadId ? R.shortText(text, leadById(st.leadId), previewCtx(leadById(st.leadId))) : text, `${b.dataset.copyshort === 'whatsapp' ? 'WhatsApp' : 'LinkedIn'} version copied`);
  } else if (b.dataset.img) {
    const blk = blockById(st.sel);
    snapshot(); setPath(blk, b.dataset.imgk, b.dataset.img); changed({ right: true });
  } else if (b.dataset.upimg) {
    const blk = blockById(st.sel);
    const k = b.dataset.upimg;
    const hero = !!b.dataset.hero;
    const file = await new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => res(i.files[0]); i.click(); });
    if (!file) return;
    try {
      const prepared = hero ? await heroize(file) : await fitImage(file, 1200);
      const r = await upload(prepared, 'image');
      await api('PUT', '/api/settings', { images: [...(D().settings.images || []), r.ref] });
      await loadState();
      snapshot(); setPath(blk, k, r.ref); changed({ right: true });
    } catch (err) { fail(err); }
  } else if (b.dataset.item) {
    const blk = blockById(st.sel);
    const [i, act] = b.dataset.item.split('|');
    const n = Number(i);
    snapshot();
    blk.items = blk.items || [];
    if (act === 'add') blk.items.push(blk.type === 'callout' ? 'New point' : { title: 'NEW ITEM', text: 'Description' });
    if (act === 'del') blk.items.splice(n, 1);
    if (act === 'up' && n > 0) [blk.items[n - 1], blk.items[n]] = [blk.items[n], blk.items[n - 1]];
    if (act === 'down' && n < blk.items.length - 1) [blk.items[n + 1], blk.items[n]] = [blk.items[n], blk.items[n + 1]];
    changed({ right: true });
  } else if (b.dataset.bact) {
    const id = st.sel;
    const blk = blockById(id);
    if (!blk) return;
    if (b.dataset.bact === 'up') moveBlock(id, -1);
    if (b.dataset.bact === 'down') moveBlock(id, 1);
    if (b.dataset.bact === 'dup') { snapshot(); const i = blocks().indexOf(blk); const c = { ...clone(blk), id: uid('b') }; blocks().splice(i + 1, 0, c); st.sel = c.id; changed({ right: true, left: true }); }
    if (b.dataset.bact === 'del') { snapshot(); st.W.blocks = blocks().filter((x) => x.id !== id); st.sel = null; st.right = 'email'; changed({ right: true, left: true }); }
    if (b.dataset.bact === 'save') {
      const name = await prompt1('Name for this reusable block', layerName(blk), { title: 'Save block' });
      if (!name) return;
      try { await api('POST', '/api/customBlocks', { name, block: { ...clone(blk), id: undefined } }); await loadState(); ok('Saved to your block library'); st.left = 'saved'; drawLeft(); } catch (err) { fail(err); }
    }
  }
}

function wireLayerDrag() {
  let dragId = null;
  root.addEventListener('dragstart', (e) => { const l = e.target.closest('[data-layer]'); if (!l) return; dragId = l.dataset.layer; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
  root.addEventListener('dragover', (e) => { const l = e.target.closest('[data-layer]'); if (!l || !dragId) return; e.preventDefault(); $$('.layer', root).forEach((x) => x.classList.toggle('drop-above', x === l && x.dataset.layer !== dragId)); });
  root.addEventListener('dragend', () => { $$('.layer', root).forEach((x) => x.classList.remove('drop-above')); dragId = null; });
  root.addEventListener('drop', (e) => {
    const l = e.target.closest('[data-layer]');
    if (!l || !dragId || l.dataset.layer === dragId) return;
    e.preventDefault();
    snapshot();
    const list = blocks();
    const [moved] = list.splice(list.findIndex((x) => x.id === dragId), 1);
    list.splice(list.findIndex((x) => x.id === l.dataset.layer), 0, moved);
    changed({ left: true });
  });
}

/** Darken an uploaded photo and fade it into the night-water indigo, like the deck cover. */
async function heroize(file) {
  const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
  const W = 1200, H = 620;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const k = Math.max(W / img.width, H / img.height);
  const w = img.width * k, h = img.height * k;
  g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 0, W, H);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, 'rgba(26,16,64,0.18)'); gr.addColorStop(0.35, 'rgba(26,16,64,0.18)'); gr.addColorStop(1, 'rgba(26,16,64,1)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
  return new File([blob], 'hero-' + file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}

/* ------------------------------------------------------- test & export */
export function sendTest(sq, step) {
  const d = D();
  const accts = connectedAccounts();
  if (!accts.length) { fail('Connect a Gmail account first (Settings → Gmail).'); return; }
  const def = d.settings.testEmail || accts[0].email;
  const dm = step.deck && step.deck !== 'inherit' ? step.deck : sq.deckChoice || 'off';
  const m = modal({ title: 'Send test to myself', body: `<div class="form-grid"><label class="field span2"><span>Send to</span><input class="input" data-to value="${esc(def)}"></label>
    <label class="field"><span>From</span><select class="input" data-from>${accts.map((a) => `<option>${esc(a.email)}</option>`).join('')}</select></label>
    <label class="field"><span>Fill merge fields with</span><select class="input" data-lead><option value="">Sample lead (Sarah · Acme Ventures)</option>${d.leads.slice(0, 200).map((l) => `<option value="${l.id}">${esc(fullName(l))}</option>`).join('')}</select></label>
    <div class="field span2"><span>Deck</span><div class="seg" data-deck>${[['attach', 'Attach PDF'], ['link', 'Link'], ['off', 'Off']].map(([k, l]) => `<button data-v="${k}" class="${dm === k ? 'on pink' : ''}">${l}</button>`).join('')}</div></div></div>
    <div class="sp8"></div><div class="small muted">The subject starts with [Test]. Test sends don't change any lead's status.</div>`,
  foot: '<button class="btn ghost" data-no>Cancel</button><button class="btn primary" data-yes>Send test</button>' });
  let deck = dm;
  $('[data-deck]', m.el).onclick = (e) => { const x = e.target.closest('button'); if (!x) return; deck = x.dataset.v; $$('[data-deck] button', m.el).forEach((y) => y.className = y === x ? 'on pink' : ''); };
  $('[data-no]', m.el).onclick = () => m.close();
  $('[data-yes]', m.el).onclick = async (e) => {
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = 'Sending…';
    try {
      const to = $('[data-to]', m.el).value.trim();
      const r = await api('POST', '/api/test-send', { sequenceId: sq.id, stepId: step.id, to, accountEmail: $('[data-from]', m.el).value, leadId: $('[data-lead]', m.el).value, deckMode: deck });
      if (to !== d.settings.testEmail) api('PUT', '/api/settings', { testEmail: to }).catch(() => {});
      m.close();
      ok(`Test sent to ${r.to}. Check your inbox (and Promotions/Spam the first time).`);
    } catch (err) { fail(err); e.currentTarget.disabled = false; e.currentTarget.textContent = 'Send test'; }
  };
}

export function openExport(sq, step) {
  const d = D();
  let keep = false;
  let leadId = '';
  let html = '';
  const m = modal({ title: 'Export HTML', cls: 'xwide', body: `<div class="row wrap" style="gap:10px">
      <div class="seg" data-tags><button data-v="fill" class="on">Fill merge fields</button><button data-v="keep">Keep {{merge tags}}</button></div>
      <select class="input sm" data-lead style="width:240px"><option value="">Sample lead</option>${d.leads.slice(0, 300).map((l) => `<option value="${l.id}">${esc(fullName(l))}</option>`).join('')}</select>
      <span class="grow"></span>
      <button class="btn sm" data-copy>${icon('copy')} Copy HTML</button>
      <button class="btn sm" data-rich>${icon('mail')} Copy for Gmail / Outlook</button>
      <button class="btn primary sm" data-dl>${icon('download')} Download .html</button></div>
    <div class="sp16"></div><div data-note></div>
    <div class="grid g2"><textarea class="code" data-code readonly spellcheck="false"></textarea><iframe class="preview-frame" data-prev style="height:340px"></iframe></div>`,
  });
  const load = async () => {
    try {
      const r = await api('GET', `/api/export?sequenceId=${encodeURIComponent(sq.id)}&stepId=${encodeURIComponent(step.id)}&leadId=${encodeURIComponent(leadId)}&keepTags=${keep ? 1 : 0}`);
      html = r.html;
      $('[data-code]', m.el).value = html;
      fillFrame($('[data-prev]', m.el), html, { autoHeight: false });
      $('[data-note]', m.el).innerHTML = r.hosted
        ? `<div class="notice ok">${icon('check')}<div class="small">Images point to your public image URL, so this HTML is ready to paste anywhere.</div></div><div class="sp8"></div>`
        : `<div class="notice warn">${icon('alert')}<div class="small">Images are embedded inside the HTML. That works for downloads and most desktop clients, but Gmail strips embedded images when you paste. For paste-ready HTML, upload the files in <span class="kbd">public/brand</span> to your website and set the public image URL in <a href="#/settings" data-close>Settings → Images</a>. Emails sent from this app embed images automatically.</div></div><div class="sp8"></div>`;
    } catch (e) { fail(e); }
  };
  m.el.addEventListener('click', (e) => {
    const b = e.target.closest('button, a');
    if (!b) return;
    if (b.closest('[data-tags]')) { keep = b.dataset.v === 'keep'; $$('[data-tags] button', m.el).forEach((x) => x.className = x === b ? 'on' : ''); load(); }
    if (b.matches('[data-copy]')) copyText(html, 'HTML copied');
    if (b.matches('[data-rich]')) copyRich(html, R.htmlToText(html));
    if (b.matches('[data-dl]')) download(`${sq.name} - ${step.name}.html`.replace(/[\\/:*?"<>|·]+/g, '-'), html, 'text/html');
    if (b.matches('[data-close]')) m.close();
  });
  $('[data-lead]', m.el).onchange = (e) => { leadId = e.target.value; load(); };
  load();
}

export { shortMenu };
