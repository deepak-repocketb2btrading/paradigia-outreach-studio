/* Core: API, state, live events, router and UI primitives. */
export const R = window.PRender;
export const Seed = window.PSeed;

/* ------------------------------------------------------------------ icons */
const P = {
  home: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7l10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4 20-7z"/><path d="M22 2 11 13"/>',
  team: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  wa: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  li: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  play: '<path d="m6 3 14 9-14 9V3z"/>',
  pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="1"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  ext: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/>',
  bold: '<path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z"/>',
  italic: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  dup: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16V4a2 2 0 0 1 2-2h12"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/>',
  filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>',
  tag: '<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><path d="M7 7h.01"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
};
export const icon = (n, cls) => `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[n] || ''}</svg>`;

/* --------------------------------------------------------------- helpers */
export const esc = R.esc;
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const uid = (p = '') => p + Math.random().toString(36).slice(2, 10);
export function on(root, event, selector, fn) {
  root.addEventListener(event, (e) => {
    const t = e.target.closest(selector);
    if (t && root.contains(t)) fn(e, t);
  });
}
export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
export const fullName = (l) => [l.firstName, l.lastName].filter(Boolean).join(' ') || l.email || 'Unnamed';
export function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
}
export function assetUrl(ref) {
  if (!ref) return '';
  if (/^(https?:|data:|\/)/.test(ref)) return ref;
  return ref.replace(/^brand:/, '/brand/').replace(/^upload:/, '/uploads/').replace(/^seed:/, '/uploads/');
}
export function avatar(name, photo, cls = '') {
  return photo ? `<img class="av ${cls}" src="${esc(assetUrl(photo))}" alt="">` : `<span class="av ${cls}">${esc(initials(name))}</span>`;
}
export function fmtDate(iso, opts) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, opts || { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export function fmtDay(iso) { return iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }
export function ago(iso) {
  if (!iso) return '—';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  const fut = s < 0;
  const a = Math.abs(s);
  const v = a < 60 ? 'just now' : a < 3600 ? `${Math.round(a / 60)}m` : a < 86400 ? `${Math.round(a / 3600)}h` : a < 86400 * 30 ? `${Math.round(a / 86400)}d` : fmtDay(iso);
  if (v === 'just now') return v;
  return /\d$/.test(v) || /[mhd]$/.test(v) ? (fut ? `in ${v}` : `${v} ago`) : v;
}
export const plural = (n, w, pl) => `${n} ${n === 1 ? w : (pl || w + 's')}`;
export const statusOf = (k) => R.STATUSES.find((s) => s.key === k) || R.STATUSES[0];
export const statusBadge = (k) => { const s = statusOf(k); return `<span class="badge" style="background:${s.color}22;color:${s.color}"><span class="dot" style="background:${s.color}"></span>${esc(s.label)}</span>`; };
export const tierChip = (t) => t ? `<span class="tier ${esc(R.tierKey(t))}">${esc(t)}</span>` : '<span class="faint">—</span>';

/* ------------------------------------------------------------------- api */
export async function api(method, url, body, opts = {}) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined && !opts.raw ? { 'Content-Type': 'application/json' } : (opts.headers || {}),
    body: body === undefined ? undefined : opts.raw ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
export async function upload(file, kind) {
  return api('POST', `/api/upload?kind=${kind}`, file, { raw: true, headers: { 'x-filename': encodeURIComponent(file.name), 'Content-Type': 'application/octet-stream' } });
}

/* ----------------------------------------------------------------- state */
export const S = { data: null };
const listeners = new Set();
export const onState = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export async function loadState() {
  S.data = await api('GET', '/api/state');
  for (const fn of listeners) { try { fn(S.data); } catch (e) { console.error(e); } }
  return S.data;
}
export const reload = debounce(loadState, 250);
export const D = () => S.data;

export function startEvents() {
  const es = new EventSource('/api/events');
  es.onmessage = (ev) => {
    const e = JSON.parse(ev.data);
    if (e.type === 'changed') reload();
    if (e.type === 'reply') {
      toast(`<b>New reply from ${esc(e.name)}</b>${esc(e.company || '')}${e.subject ? ` · ${esc(e.subject)}` : ''}<div class="tiny muted">Sequence paused automatically</div>`, 'reply', 9000, () => { location.hash = `#/inbox/${e.leadId}`; });
      reload();
    }
    if (e.type === 'notice') toast(esc(e.text), 'info', 6000);
  };
}

/* ------------------------------------------------------------- UI pieces */
export function toast(html, kind = 'ok', ms = 3800, onClick) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<div>${html}</div>`;
  if (onClick) el.addEventListener('click', () => { onClick(); el.remove(); });
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), ms);
}
export const ok = (m) => toast(esc(m), 'ok');
export const fail = (e) => toast(esc(e && e.message ? e.message : String(e)), 'err', 7000);

export function modal({ title, body, foot, cls = '', onClose }) {
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true"><div class="modal-h"><h2>${title}</h2><button class="btn ghost icon sm right" data-x aria-label="Close">${icon('x')}</button></div><div class="modal-b">${body || ''}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div>`;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', key); if (onClose) onClose(); document.dispatchEvent(new Event('ui:closed')); };
  const key = (e) => { if (e.key === 'Escape') close(); };
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  $('[data-x]', wrap).addEventListener('click', close);
  document.addEventListener('keydown', key);
  document.body.appendChild(wrap);
  return { el: $('.modal', wrap), body: $('.modal-b', wrap), close };
}

export function confirmBox(text, { title = 'Are you sure?', okText = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    const m = modal({ title, body: `<div style="line-height:1.6">${text}</div>`, foot: `<button class="btn ghost" data-no>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(okText)}</button>`, onClose: () => resolve(false) });
    $('[data-no]', m.el).onclick = () => { m.close(); };
    $('[data-yes]', m.el).onclick = () => { resolve(true); m.close(); };
  });
}

export function prompt1(label, value = '', { title = 'Enter a value', okText = 'Save' } = {}) {
  return new Promise((resolve) => {
    const m = modal({ title, body: `<label class="field"><span>${esc(label)}</span><input class="input" data-v value="${esc(value)}"></label>`, foot: `<button class="btn ghost" data-no>Cancel</button><button class="btn primary" data-yes>${esc(okText)}</button>`, onClose: () => resolve(null) });
    const inp = $('[data-v]', m.el);
    inp.focus(); inp.select();
    const done = () => { const v = inp.value.trim(); resolve(v); m.close(); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
    $('[data-no]', m.el).onclick = () => m.close();
    $('[data-yes]', m.el).onclick = done;
  });
}

export function drawer(html) {
  const wrap = document.createElement('div');
  wrap.className = 'drawer-wrap';
  wrap.innerHTML = `<div class="drawer">${html}</div>`;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', key); document.dispatchEvent(new Event('ui:closed')); };
  const key = (e) => { if (e.key === 'Escape' && !document.querySelector('.overlay')) close(); };
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  document.addEventListener('keydown', key);
  document.body.appendChild(wrap);
  return { el: $('.drawer', wrap), close, wrap };
}

let openMenu = null;
export function menu(anchor, items) {
  if (openMenu) openMenu.remove();
  const m = document.createElement('div');
  m.className = 'menu';
  m.innerHTML = items.map((it, i) => it === '-' ? '<div class="sep"></div>' : it.header ? `<div class="hd">${esc(it.header)}</div>` : `<button data-i="${i}">${it.icon ? icon(it.icon) : ''}<span>${it.html || esc(it.label)}</span></button>`).join('');
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = `${Math.min(r.left, innerWidth - w - 10)}px`;
  m.style.top = `${r.bottom + h + 6 > innerHeight ? Math.max(10, r.top - h - 6) : r.bottom + 6}px`;
  m.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    const it = items[Number(b.dataset.i)];
    m.remove(); openMenu = null;
    if (it.onClick) it.onClick();
  });
  setTimeout(() => {
    const off = (e) => { if (!m.contains(e.target)) { m.remove(); openMenu = null; document.removeEventListener('mousedown', off); } };
    document.addEventListener('mousedown', off);
  });
  openMenu = m;
  return m;
}

export async function copyText(text, label = 'Copied to clipboard') {
  try { await navigator.clipboard.writeText(text); ok(label); }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove(); ok(label);
  }
}
export async function copyRich(html, text) {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text || html], { type: 'text/plain' }) })]);
    ok('Copied. Paste it into a Gmail or Outlook compose window.');
  } catch (e) { fail('Your browser blocked rich copy. Use “Copy HTML” instead.'); }
}
export function download(name, content, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function pickFile(accept) {
  return new Promise((resolve) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept || '';
    i.onchange = () => resolve(i.files[0] || null);
    i.click();
  });
}
/** Square-crop + resize a photo in the browser before upload (keeps emails light). */
export async function squarePhoto(file, size = 400) {
  const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
  const s = Math.min(img.width, img.height);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}
export async function fitImage(file, maxW = 1200) {
  const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
  if (img.width <= maxW && file.size < 600 * 1024) return file;
  const k = Math.min(1, maxW / img.width);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.84));
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}

/* ------------------------------------------------------------------- CSV */
export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : (first.includes('\t') && !first.includes(',') ? '\t' : ',');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}
export function toCSV(rows) {
  return rows.map((r) => r.map((v) => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n');
}

/* --------------------------------------------------------- domain helpers */
export const seqById = (id) => (D().sequences || []).find((s) => s.id === id);
export const leadById = (id) => (D().leads || []).find((l) => l.id === id);
export const connectedAccounts = () => (D().accounts || []).filter((a) => (D().google.connected || []).includes(a.email));

/** Progress of a lead across sequences. */
export function leadEnrollments(leadId) {
  return (D().enrollments || []).filter((e) => e.leadId === leadId).map((e) => {
    const seq = seqById(e.sequenceId);
    const steps = seq ? seq.steps : [];
    const sentIds = new Set((e.history || []).map((h) => h.stepId));
    const next = steps[e.nextStepIndex || 0];
    const last = (e.history || [])[(e.history || []).length - 1];
    const queued = (D().queue || []).find((q) => q.state === 'queued' && q.enrollmentId === e.id);
    return { e, seq, steps, sentIds, next, nextIndex: e.nextStepIndex || 0, last, queued, due: next ? dueAt(next, e.lastSentAt) : null };
  });
}
export function dueAt(step, lastSentAt) {
  if (!step) return null;
  if (step.fixedDate) return new Date(`${step.fixedDate}T${step.sendTime || '10:00'}:00`).toISOString();
  if (!lastSentAt) return new Date().toISOString();
  return new Date(Date.parse(lastSentAt) + (Number(step.delayDays) || 0) * 86400e3).toISOString();
}
export function stepStats(seq, step) {
  const q = (D().queue || []).filter((x) => x.stepId === step.id && x.state === 'queued').length;
  const sentMsgs = (D().messages || []).filter((m) => m.stepId === step.id && m.direction === 'out' && !m.test);
  const sentLeads = new Set(sentMsgs.map((m) => m.leadId));
  let replied = 0;
  for (const e of (D().enrollments || [])) {
    if (e.sequenceId !== seq.id || !e.repliedAt) continue;
    const hist = (e.history || []).filter((h) => h.sentAt <= e.repliedAt);
    if (hist.length && hist[hist.length - 1].stepId === step.id) replied++;
  }
  const variants = (step.subjects || []).map((_, i) => {
    const s = sentMsgs.filter((m) => m.variant === i);
    let r = 0;
    for (const m of s) { const e = (D().enrollments || []).find((x) => x.leadId === m.leadId && x.sequenceId === seq.id); if (e && e.repliedAt && e.repliedAt > m.date) r++; }
    return { sent: s.length, replied: r };
  });
  return { queued: q, sent: sentLeads.size, replied, variants };
}
export function stepStatus(stats) {
  if (stats.replied) return { key: 'replied', label: `Replied ${stats.replied}`, color: '#FF0055' };
  if (stats.sent) return { key: 'sent', label: `Sent ${stats.sent}`, color: '#22C55E' };
  if (stats.queued) return { key: 'scheduled', label: `Scheduled ${stats.queued}`, color: '#3B82F6' };
  return { key: 'draft', label: 'Draft', color: '#8E8EA0' };
}
export function timingLabel(step, i) {
  if (step.fixedDate) return `On ${new Date(step.fixedDate + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${step.sendTime || '10:00'}`;
  if (i === 0) return `Day 0 · ${step.sendTime || '10:00'}`;
  return `+${step.delayDays || 0} day${Number(step.delayDays) === 1 ? '' : 's'} · ${step.sendTime || '10:00'}`;
}
export function dayNumbers(seq) {
  let d = 0;
  return seq.steps.map((s, i) => { if (s.fixedDate) return s.fixedDate.slice(5).replace('-', '/'); if (i > 0) d += Number(s.delayDays) || 0; return `Day ${d}`; });
}

/** Context for rendering previews in the browser. */
export function previewCtx(lead, extra = {}) {
  const d = D();
  const acct = d.accounts[0];
  const sig = (extra.signatureId && d.signatures.find((s) => s.id === extra.signatureId)) || (acct && d.signatures.find((s) => s.accountEmail === acct.email)) || d.signatures[0] || {};
  return { settings: d.settings, team: d.team, signature: sig, account: acct, lead: lead || Seed.sampleLead(), ...extra };
}

/** Write a full HTML document into an iframe and size it to its content. */
export function fillFrame(iframe, html, { autoHeight = true, onLoad } = {}) {
  iframe.onload = () => {
    if (autoHeight) {
      const fit = () => { try { iframe.style.height = iframe.contentDocument.documentElement.scrollHeight + 'px'; } catch { /* ignore */ } };
      fit();
      setTimeout(fit, 120); setTimeout(fit, 600);
      try { iframe.contentDocument.fonts && iframe.contentDocument.fonts.ready.then(fit); } catch { /* ignore */ }
    }
    if (onLoad) onLoad(iframe.contentDocument);
  };
  iframe.srcdoc = html;
}

export function sanitizeRich(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const ALLOWED = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'A', 'UL', 'OL', 'LI']);
  (function walk(node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 1) {
        walk(child);
        if (child.tagName === 'DIV') {
          const p = doc.createElement('p');
          while (child.firstChild) p.appendChild(child.firstChild);
          child.replaceWith(p);
          continue;
        }
        if (!ALLOWED.has(child.tagName)) {
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          child.remove();
          continue;
        }
        for (const a of Array.from(child.attributes)) if (!(child.tagName === 'A' && a.name === 'href')) child.removeAttribute(a.name);
        if (child.tagName === 'A' && /^\s*javascript:/i.test(child.getAttribute('href') || '')) child.removeAttribute('href');
      } else if (child.nodeType !== 3) child.remove();
    }
  })(doc.body.firstChild);
  let out = doc.body.firstChild.innerHTML.replace(/<p><br><\/p>/g, '').trim();
  if (out && !/^<(p|ul|ol)/i.test(out)) out = `<p>${out}</p>`;
  return out;
}
