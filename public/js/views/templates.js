/* Templates: browse, preview, customise, add to sequences, build sequences from templates. */
import { D, $, esc, icon, api, modal, ok, fail, loadState, allTemplates, templateById, stepFromTemplate, seqById, clone, menu, confirmBox, prompt1, plural } from '../core.js';
import { categories, cardHtml, wireThumbs, openPreview, openSequenceBuilder, saveAsTemplate, htmlToTemplateStep } from '../components/templates.js';
import { downloadMenu } from '../components/approval.js';

const st = { cat: 'All', q: '' };
let wrap;

export function render(container) {
  container.innerHTML = '';
  wrap = document.createElement('div');
  wrap.className = 'page';
  container.appendChild(wrap);
  wrap.addEventListener('click', onClick);
  wrap.addEventListener('input', (e) => {
    if (!e.target.matches('[data-q]')) return;
    st.q = e.target.value;
    const pos = e.target.selectionStart;
    draw();
    const i = $('[data-q]', wrap); i.focus(); i.setSelectionRange(pos, pos);
  });
  draw();
}
export function refresh() { draw(); }

function actions(t) {
  const common = `<button class="btn primary xs" data-addto="${esc(t.id)}">${icon('plus')} Add to sequence</button><button class="btn xs" data-peek="${esc(t.id)}" title="Preview">${icon('eye')}</button><button class="btn xs" data-dl="${esc(t.id)}" title="Download for approval">${icon('download')}</button>`;
  return t.builtIn
    ? `${common}<button class="btn xs" data-custom="${esc(t.id)}" title="Copy to My templates and edit">${icon('pen')} Customise</button>`
    : `${common}<a class="btn xs" href="#/editor/template/${esc(t.id)}">${icon('pen')} Edit</a><button class="btn ghost icon xs" data-more="${esc(t.id)}">${icon('more')}</button>`;
}

function draw() {
  const all = allTemplates();
  const list = all.filter((t) => (st.cat === 'All' || t.category === st.cat) && (!st.q || `${t.name} ${t.category} ${t.description || ''}`.toLowerCase().includes(st.q.toLowerCase())));
  const groups = st.cat === 'All' ? categories().map((c) => [c, list.filter((t) => t.category === c)]).filter(([, l]) => l.length) : [[st.cat, list]];
  const mine = (D().templates || []).length;
  wrap.innerHTML = `<div class="page-head"><div><div class="eyebrow">Email designs</div><h1>Templates <span class="muted" style="font-size:18px;font-weight:600">${all.length}</span></h1></div>
      <div class="actions"><button class="btn" data-fromhtml>${icon('code')} New from HTML</button><button class="btn primary" data-build>${icon('layers')} Build a sequence</button></div></div>
    <div class="notice info" style="margin-bottom:16px">${icon('info')}<div><b>Pick, arrange, send.</b> Use <b>Build a sequence</b> to choose templates and put them in order with the days between them, or add any template to an existing sequence. Templates are copied, so editing an email in a sequence never changes the template. ${mine ? '' : 'Save your own designs from the editor with <b>Save as template</b>.'}</div></div>
    <div class="row wrap" style="gap:10px;margin-bottom:6px"><div class="chips">${['All', ...categories()].map((c) => `<button class="chip ${st.cat === c ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}${c === 'My templates' ? ` <span class="n">${mine}</span>` : ''}</button>`).join('')}</div>
      <div class="search right">${icon('search')}<input class="input" data-q placeholder="Search templates" value="${esc(st.q)}" style="width:220px"></div></div>
    ${groups.map(([c, l]) => `<div class="label" style="margin:22px 0 12px">${esc(c)} <span class="faint">· ${l.length}</span></div><div class="tpl-grid">${l.map((t) => cardHtml(t, actions(t))).join('')}</div>`).join('') || '<div class="card"><div class="empty"><h3>No templates match</h3></div></div>'}`;
  wireThumbs(wrap);
}

/** Add a template as a new email at the end of a sequence (or a new sequence). */
function addToSequence(tpl, anchor) {
  const seqs = D().sequences;
  menu(anchor, [
    { header: 'Add as the last email of' },
    ...seqs.map((s) => ({ label: `${s.name} (${plural(s.steps.length, 'email')})`, icon: 'layers', onClick: () => appendTo(s.id, tpl) })),
    '-',
    { label: 'Start a new sequence with it…', icon: 'plus', onClick: () => openSequenceBuilder({ preset: [tpl.id] }) },
  ]);
}

export async function appendTo(seqId, tpl) {
  const s = clone(seqById(seqId));
  const first = s.steps.length === 0;
  s.steps.push(stepFromTemplate(tpl, { delayDays: first ? 0 : 4, fixedDate: '', threadReply: !first }));
  try {
    await api('PUT', `/api/sequences/${s.id}`, s);
    await loadState();
    ok(`“${tpl.name}” added as email ${s.steps.length} of ${s.name}. Drag it into place on the sequence page.`);
    location.hash = `#/sequences/${s.id}`;
  } catch (e) { fail(e); }
}

async function customise(tpl) {
  try {
    const r = await saveAsTemplate(tpl.step, { name: `${tpl.name} (my copy)`, description: `Based on ${tpl.category}` });
    ok('Copied to My templates');
    location.hash = `#/editor/template/${r.id}`;
  } catch (e) { fail(e); }
}

function fromHtml() {
  const m = modal({ title: 'New template from HTML', cls: 'wide', body: `<label class="field"><span>Template name</span><input class="input" data-name placeholder="e.g. Partner newsletter"></label><div class="sp16"></div>
    <label class="field"><span>Paste HTML</span><textarea class="code" data-html placeholder="&lt;html&gt;…&lt;/html&gt; or a snippet" style="height:260px"></textarea>
    <span class="hint">The body of your HTML becomes a Custom HTML block inside the branded 600px frame, with your footer and unsubscribe link added. Inline styles work best; scripts and forms are removed. Merge fields like {{first_name}} work.</span></label>`,
  foot: '<button class="btn ghost" data-no>Cancel</button><button class="btn primary" data-yes>Create template</button>' });
  $('[data-no]', m.el).onclick = () => m.close();
  $('[data-yes]', m.el).onclick = async () => {
    const html = $('[data-html]', m.el).value.trim();
    const name = $('[data-name]', m.el).value.trim() || 'Imported HTML';
    if (!html) { fail('Paste some HTML first.'); return; }
    try {
      const r = await api('POST', '/api/templates', { name, description: 'Imported HTML', step: htmlToTemplateStep(html, name), createdAt: new Date().toISOString() });
      await loadState();
      m.close();
      ok('Template created');
      location.hash = `#/editor/template/${r.id}`;
    } catch (e) { fail(e); }
  };
}

async function onClick(e) {
  const b = e.target.closest('button, .tpl-thumb');
  if (!b) return;
  if (b.classList.contains('tpl-thumb')) { openPreview(templateById(b.closest('[data-card]').dataset.card), { onUse: (t) => addToSequence(t, b), useLabel: 'Add to sequence' }); return; }
  if (b.dataset.cat) { st.cat = b.dataset.cat; draw(); }
  else if (b.matches('[data-build]')) openSequenceBuilder();
  else if (b.matches('[data-fromhtml]')) fromHtml();
  else if (b.dataset.addto) addToSequence(templateById(b.dataset.addto), b);
  else if (b.dataset.peek) { const t = templateById(b.dataset.peek); openPreview(t, { onUse: () => addToSequence(t, b), useLabel: 'Add to sequence' }); }
  else if (b.dataset.custom) customise(templateById(b.dataset.custom));
  else if (b.dataset.dl) { const t = templateById(b.dataset.dl); downloadMenu(b, { seq: null, step: { ...t.step, id: t.id }, index: 0, templateId: t.id, name: t.name }); }
  else if (b.dataset.more) {
    const t = templateById(b.dataset.more);
    menu(b, [
      { label: 'Rename', icon: 'pen', onClick: async () => { const n = await prompt1('Template name', t.name, { title: 'Rename template' }); if (n) { await api('PUT', `/api/templates/${t.id}`, { name: n }); await loadState(); } } },
      { label: 'Duplicate', icon: 'dup', onClick: async () => { await saveAsTemplate(t.step, { name: `${t.name} (copy)`, description: t.description }); ok('Duplicated'); } },
      '-',
      { label: 'Delete', icon: 'trash', onClick: async () => { if (await confirmBox(`Delete the template “${esc(t.name)}”? Sequences that already use it keep their copy.`, { okText: 'Delete', danger: true })) { await api('DELETE', `/api/templates/${t.id}`); await loadState(); ok('Template deleted'); } } },
    ]);
  }
}
