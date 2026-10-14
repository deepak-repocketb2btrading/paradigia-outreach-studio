/*
 * Marketing review.
 *
 * buildPack()       the content of one or more sequences, plus what's needed to draw the emails (a sample lead,
 *                   settings, team, signature) and the images. Saved as "content .json" without the images.
 * buildReviewPage() one self-contained .html page: reviewers read each email as a lead sees it, edit the wording
 *                   on the email itself, approve or ask for changes, and save a small review .json file.
 *                   It carries its own copy of the renderer and images, so it works offline from any folder.
 * compare()/apply() used by the app to show what a review (or an edited content .json) would change and to apply
 *                   the changes the user picks.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./render'));
  else root.PReview = factory(root.PRender);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';
  const esc = R.esc;
  const APP = 'paradigia-outreach-studio';

  /* ------------------------------------------------------------- field keys */
  // A key names one piece of text: "subjects.0", "preheader", "whatsapp", "linkedin",
  // or "b|<blockId>|<path>" for text inside a block (path as used by the renderer's data-edit attributes).
  const BLOCK_FIELDS = ['eyebrow', 'headline', 'dateLine', 'title', 'heading', 'text', 'html', 'note', 'caption', 'badge', 'ticketText'];
  const PATH_OK = /^(eyebrow|headline|dateLine|title|heading|text|html|note|caption|badge|ticketText|items\.\d{1,2}(\.(title|text))?)$/;
  const FIELD_NAMES = { eyebrow: 'small label', headline: 'headline', dateLine: 'date line', title: 'title', heading: 'heading', text: 'text', html: 'text', note: 'note', caption: 'caption', badge: 'badge', ticketText: 'ticket button' };
  const MAX = 6000;

  const getPath = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function setPath(o, p, v) {
    const ks = String(p).split('.');
    let a = o;
    for (let i = 0; i < ks.length - 1; i++) {
      if (a[ks[i]] == null || typeof a[ks[i]] !== 'object') a[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      a = a[ks[i]];
    }
    a[ks[ks.length - 1]] = v;
  }
  const norm = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const splitKey = (key) => { const p = String(key).split('|'); return { bid: p[1], path: p.slice(2).join('|') }; };
  const blockOf = (step, bid) => ((step && step.blocks) || []).find((b) => b.id === bid);

  /** The text a key currently shows (block defaults included, as the renderer does). */
  function valueOf(step, key) {
    if (!step) return '';
    if (String(key).startsWith('b|')) {
      const { bid, path } = splitKey(key);
      const b = blockOf(step, bid);
      if (!b) return '';
      let v = getPath(b, path);
      if (v == null) v = getPath((R.BLOCKS[b.type] || {}).defaults || {}, path);
      return v == null ? '' : v;
    }
    const v = getPath(step, key);
    return v == null ? '' : v;
  }

  /** Whether a key may be changed on this email (text only: never links, code, ids or settings). */
  function validKey(step, key) {
    if (!step) return false;
    if (/^subjects\.[0-2]$/.test(key) || key === 'preheader' || key === 'whatsapp' || key === 'linkedin') return true;
    if (!String(key).startsWith('b|') || step.rawHtml) return false;
    const { bid, path } = splitKey(key);
    const b = blockOf(step, bid);
    if (!b || !PATH_OK.test(path)) return false;
    const m = /^items\.(\d+)(?:\.(title|text))?$/.exec(path);
    if (m) {
      const it = Array.isArray(b.items) ? b.items[+m[1]] : undefined;
      return m[2] ? !!it && typeof it === 'object' : typeof it === 'string';
    }
    return true;
  }

  function setValue(step, key, value) {
    if (String(key).startsWith('b|')) {
      const { bid, path } = splitKey(key);
      setPath(blockOf(step, bid), path, value);
    } else if (/^subjects\.\d$/.test(key)) {
      step.subjects = Array.isArray(step.subjects) ? step.subjects : [];
      step.subjects[+key.split('.')[1]] = value;
    } else step[key] = value;
  }

  /** Every editable text key of an email (used to compare an edited content .json with the app). */
  function editableKeys(step) {
    const keys = [];
    (step.subjects || []).forEach((s, i) => { if (i < 3 && typeof s === 'string') keys.push('subjects.' + i); });
    keys.push('preheader', 'whatsapp', 'linkedin');
    if (!step.rawHtml) (step.blocks || []).forEach((b) => {
      BLOCK_FIELDS.forEach((f) => { if (typeof b[f] === 'string') keys.push(`b|${b.id}|${f}`); });
      (Array.isArray(b.items) ? b.items : []).forEach((it, i) => {
        if (typeof it === 'string') keys.push(`b|${b.id}|items.${i}`);
        else if (it && typeof it === 'object') ['title', 'text'].forEach((f) => { if (typeof it[f] === 'string') keys.push(`b|${b.id}|items.${i}.${f}`); });
      });
    });
    return keys;
  }

  function labelFor(step, key) {
    const sm = /^subjects\.(\d)$/.exec(key);
    if (sm) return `Subject line ${'ABC'[+sm[1]] || +sm[1] + 1}`;
    if (key === 'preheader') return 'Preview text';
    if (key === 'whatsapp') return 'WhatsApp version';
    if (key === 'linkedin') return 'LinkedIn version';
    const { bid, path } = splitKey(key);
    const b = blockOf(step, bid);
    const block = b ? ((R.BLOCKS[b.type] || {}).label || b.type) : 'Section';
    const m = /^items\.(\d+)(?:\.(title|text))?$/.exec(path);
    return `${block} · ${m ? `item ${+m[1] + 1}${m[2] ? ' ' + m[2] : ''}` : (FIELD_NAMES[path] || path)}`;
  }

  /** Rich text from an edited paragraph: keep paragraphs, line breaks, bold, italic, underline, lists and links only. */
  const RICH_TAGS = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li']);
  function cleanRich(html) {
    let s = String(html || '')
      .replace(/<!-{2}[\s\S]*?-{2}>/g, '')
      .replace(/<(script|style|iframe|object|embed|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<(\/?)div\b[^>]*>/gi, '<$1p>');
    s = s.replace(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi, (m, close, tag, attrs) => {
      const t = tag.toLowerCase();
      if (!RICH_TAGS.has(t)) return '';
      if (close) return t === 'br' ? '' : `</${t}>`;
      if (t === 'a') {
        const h = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
        const href = h ? (h[2] || h[3] || h[4] || '') : '';
        return !href || /^\s*(javascript|data|vbscript):/i.test(href) ? '<a>' : `<a href="${href.replace(/"/g, '&quot;')}">`;
      }
      return t === 'br' ? '<br>' : `<${t}>`;
    });
    s = s.replace(/<p>\s*(<br>)?\s*<\/p>/g, '').trim();
    if (s && !/^<(p|ul|ol)\b/i.test(s)) s = `<p>${s}</p>`;
    return s;
  }
  const cleanValue = (key, v) => {
    const s = String(v == null ? '' : v).slice(0, MAX);
    return /\|html$/.test(key) ? cleanRich(s) : s.replace(/[<>]/g, '');
  };

  /** Plain text for showing a value in a list of changes. */
  const toPlain = (v) => String(v == null ? '' : v)
    .replace(/<\/(p|li)>/gi, ' ').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();

  /** A copy of an email with a reviewer's edits applied. */
  function withEdits(step, edits) {
    const w = JSON.parse(JSON.stringify(step));
    Object.keys(edits || {}).forEach((k) => { if (validKey(w, k)) setValue(w, k, edits[k]); });
    return w;
  }

  /* ------------------------------------------------------------------ pack */
  function whenLabel(seq, i) {
    const st = seq.steps[i];
    if (st.fixedDate) return `On ${new Date(st.fixedDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${st.sendTime || '10:00'}`;
    const day = seq.steps.slice(1, i + 1).reduce((n, x) => n + (x.fixedDate ? 0 : Number(x.delayDays) || 0), 0);
    return `Day ${day} · ${st.sendTime || '10:00'}${i > 0 && st.threadReply ? ' · reply in the same thread' : ''}`;
  }

  function buildPack({ sequences, settings, team, signature, account, lead, assetUri, preparedBy }) {
    const s = settings || {};
    const context = {
      settings: { event: s.event, tiers: s.tiers, comparison: s.comparison, brands: s.brands, unsubscribe: s.unsubscribe, deck: { hostedUrl: (s.deck || {}).hostedUrl || '', fileName: (s.deck || {}).fileName || '' }, talkFormUrl: s.talkFormUrl || '' },
      team: (team || []).map((m) => ({ id: m.id, name: m.name, role: m.role, group: m.group, photo: m.photo, linkedin: m.linkedin, linkTo: m.linkTo, whatsapp: m.linkTo === 'whatsapp' ? m.whatsapp : '', email: m.linkTo === 'email' ? m.email : '', show: m.show })),
      signature: signature || {},
      account: account ? { email: account.email, displayName: account.displayName || '' } : null,
      lead,
    };
    const used = new Set();
    const collect = (ref) => { used.add(ref); return ref; };
    const seqs = sequences.map((seq) => ({
      id: seq.id,
      name: seq.name,
      audience: seq.audience || '',
      steps: seq.steps.map((st, i) => {
        const deckMode = st.deck && st.deck !== 'inherit' ? st.deck : seq.deckChoice || 'off';
        const doc = { subject: (st.subjects || [])[st.subjectIndex || 0] || '', preheader: st.preheader || '', blocks: st.blocks || [], rawHtml: st.rawHtml || '' };
        const ctx = { ...context, deckMode, asset: collect };
        R.renderEmail(doc, ctx);
        let plainText = '';
        try { plainText = R.renderText(doc, ctx); } catch (e) { plainText = ''; }
        return {
          id: st.id, name: st.name, when: whenLabel(seq, i),
          subjects: (st.subjects || []).slice(0, 3), subjectIndex: st.subjectIndex || 0, abTest: !!st.abTest,
          preheader: st.preheader || '', whatsapp: st.whatsapp || '', linkedin: st.linkedin || '',
          deckMode, blocks: st.blocks || [], rawHtml: st.rawHtml || '',
          plainText,
        };
      }),
    }));
    const assets = {};
    used.forEach((ref) => { const uri = assetUri ? assetUri(ref) : ''; if (uri) assets[ref] = uri; });
    const names = seqs.map((x) => x.name);
    return {
      app: APP, kind: 'review-pack', version: 1,
      id: 'rv' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: names.length <= 3 ? names.join(' & ') : `${names.length} sequences`,
      preparedBy: preparedBy || (signature && signature.name) || (account && account.displayName) || '',
      createdAt: new Date().toISOString(),
      howTo: 'Edit only the text: subjects, preheader, whatsapp, linkedin and the text fields inside "blocks" (headline, title, text, html, note, items...). Keep every "id" and anything in {{double braces}}. plainText is for reading only and is ignored. Send the edited file back to be imported in Paradigia Outreach Studio (Sequences → Marketing review → Import review).',
      sequences: seqs,
      context,
      assets,
    };
  }

  /* ------------------------------------------------------- compare & apply */
  /** An edited content .json, turned into the same shape as a review (every text that differs from the app). */
  function packAsReview(pack, sequences) {
    const out = [];
    (pack.sequences || []).forEach((ps) => {
      const seq = sequences.find((x) => x.id === ps.id);
      (ps.steps || []).forEach((pst) => {
        const st = seq && seq.steps.find((x) => x.id === pst.id);
        const changes = st ? editableKeys(pst).filter((k) => validKey(st, k) && norm(valueOf(pst, k)) !== norm(valueOf(st, k)))
          .map((k) => ({ key: k, before: valueOf(st, k), after: valueOf(pst, k) })) : [];
        out.push({ sequenceId: ps.id, stepId: pst.id, name: pst.name, status: 'pending', comment: '', changes });
      });
    });
    return out;
  }

  function compare(file, sequences) {
    if (!file || typeof file !== 'object' || file.app !== APP) throw new Error('This file wasn’t made by Paradigia Outreach Studio.');
    let emails;
    if (file.kind === 'review') emails = Array.isArray(file.emails) ? file.emails : [];
    else if (file.kind === 'review-pack') emails = packAsReview(file, sequences);
    else throw new Error('This isn’t a review file. Use the .json saved from the review page, or an edited content .json.');
    const list = emails.map((em) => {
      const seq = sequences.find((x) => x.id === em.sequenceId);
      const st = seq && seq.steps.find((x) => x.id === em.stepId);
      const changes = (Array.isArray(em.changes) ? em.changes : []).filter((c) => c && typeof c.key === 'string').map((c) => {
        const ok = validKey(st, c.key);
        const current = ok ? valueOf(st, c.key) : '';
        const after = ok ? cleanValue(c.key, c.after) : String(c.after || '');
        return {
          id: `${em.sequenceId}/${em.stepId}/${c.key}`,
          key: c.key,
          label: st ? labelFor(st, c.key) : String(c.label || c.key),
          before: c.before == null ? current : c.before,
          after,
          current,
          missing: !ok,
          done: ok && norm(current) === norm(after),
          conflict: ok && c.before != null && norm(current) !== norm(c.before) && norm(current) !== norm(after),
        };
      });
      return {
        sequenceId: em.sequenceId, stepId: em.stepId,
        sequenceName: seq ? seq.name : '', name: st ? st.name : String(em.name || 'Email'), found: !!st,
        status: em.status === 'approved' || em.status === 'changes' ? em.status : 'pending',
        comment: String(em.comment || '').slice(0, 2000),
        changes,
      };
    });
    return { kind: file.kind, title: String(file.title || ''), reviewer: String(file.reviewer || '').slice(0, 80), savedAt: file.savedAt || file.createdAt || '', emails: list };
  }

  /** Apply the accepted changes (ids from compare) to the sequences in place. */
  function apply(file, sequences, accept, record) {
    const cmp = compare(file, sequences);
    const want = new Set(accept || []);
    const touched = new Set();
    let changed = 0;
    cmp.emails.forEach((em) => {
      const seq = sequences.find((x) => x.id === em.sequenceId);
      const st = seq && seq.steps.find((x) => x.id === em.stepId);
      if (!st) return;
      em.changes.forEach((c) => {
        if (c.missing || c.done || !want.has(c.id)) return;
        setValue(st, c.key, c.after);
        changed++; touched.add(seq);
      });
      if (record && cmp.kind === 'review' && em.status !== 'pending') {
        st.review = { status: em.status, by: cmp.reviewer || 'Marketing', comment: em.comment, at: cmp.savedAt || new Date().toISOString() };
        touched.add(seq);
      }
    });
    return { changed, sequences: Array.from(touched).map((x) => x.id), reviewer: cmp.reviewer };
  }

  /* ------------------------------------------------------------ the page */
  const CSS = `
    :root{--pink:#FF0055;--ink:#1C1C1C;--muted:#6B6A78;--line:#DDD9D2;--bg:#ECEAE6;--ok:#13A150;--warn:#D97706;--indigo:#3B1FA8}
    *{box-sizing:border-box}
    html,body{margin:0;background:var(--bg);color:var(--ink);font-family:'Poppins',Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased}
    button,input,textarea{font:inherit}
    .rv-bar{position:sticky;top:0;z-index:30;background:#000;color:#fff;border-bottom:3px solid var(--pink);display:flex;align-items:center;gap:10px;padding:10px 18px;flex-wrap:wrap}
    .rv-brand{display:flex;flex-direction:column;line-height:1.2;margin-right:auto;min-width:0}
    .rv-brand b{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--pink)}
    .rv-brand span{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px}
    .rv-who input{height:34px;border-radius:8px;border:1px solid #393842;background:#121218;color:#fff;padding:0 11px;font-size:13px;width:170px}
    .rv-who input::placeholder{color:#8A889A}
    .rv-who input.need{border-color:var(--pink);box-shadow:0 0 0 3px rgba(255,0,85,.3)}
    .rv-seg{display:inline-flex;background:#17171E;border:1px solid #2C2B35;border-radius:9px;padding:3px}
    .rv-seg button{border:0;background:transparent;color:#BDBBCB;font-size:12.5px;font-weight:600;padding:6px 12px;border-radius:7px;cursor:pointer}
    .rv-seg button.on{background:#fff;color:#000}
    .rv-btn{height:34px;border-radius:8px;border:1px solid #3A3944;background:transparent;color:#fff;font-size:13px;font-weight:600;padding:0 14px;cursor:pointer;white-space:nowrap}
    .rv-btn:hover{border-color:#77758A}
    .rv-btn.pink{background:var(--pink);border-color:var(--pink)}
    .rv-btn.pink:hover{filter:brightness(1.08)}
    .rv-prog{font-size:12px;color:#BDBBCB;white-space:nowrap}
    .rv-prog b{color:#fff}
    .rv-wrap{max-width:900px;margin:0 auto;padding:26px 16px 90px}
    .rv-top{background:#000;color:#fff;border-left:6px solid var(--pink);padding:24px 28px}
    .rv-kick{font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--pink)}
    .rv-top h1{margin:6px 0 6px;font-size:27px;line-height:1.15;font-weight:800;text-transform:uppercase}
    .rv-top p{margin:0;color:#CFCDE0;font-size:13px}
    .rv-how{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0 18px}
    .rv-how div{background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.55;color:#3D3C46}
    .rv-how b{display:block;color:var(--ink);font-size:13.5px;margin-bottom:2px}
    .rv-how i{font-style:normal;display:inline-flex;width:22px;height:22px;border-radius:50%;background:var(--pink);color:#fff;font-size:12px;font-weight:700;align-items:center;justify-content:center;margin-right:6px}
    .rv-nav{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 24px}
    .rv-nav a{display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:6px 12px 6px 9px;font-size:12.5px;color:var(--ink);text-decoration:none}
    .rv-nav a:hover{border-color:#B9B5AD}
    .dot{width:9px;height:9px;border-radius:50%;background:#C9C6BF;flex:none}
    .dot.approved{background:var(--ok)}.dot.changes{background:var(--warn)}
    .rv-seqh{margin:30px 0 12px;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--muted)}
    .rv-email{background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:26px;scroll-margin-top:80px}
    .rv-meta{padding:20px 24px;border-bottom:1px solid #E6E3DE}
    .rv-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:4px 0 14px}
    .rv-row h2{margin:0;font-size:19px;font-weight:700;margin-right:auto}
    .chip{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-radius:999px;padding:4px 10px;background:#EEECE8;color:#6B6A78}
    .chip.approved{background:#13A1501A;color:var(--ok)}.chip.changes{background:#D977061F;color:var(--warn)}.chip.edits{background:#F5B4002B;color:#8A6400}
    .rv-grid{display:grid;grid-template-columns:1.3fr 1fr;gap:18px}
    .rv-label{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8A8894;margin:0 0 6px}
    .rv-meta p{margin:0 0 12px;font-size:13px;line-height:1.55}
    .rv-subj{list-style:none;margin:0;padding:0}
    .rv-subj li{display:flex;gap:8px;align-items:center;font-size:13.5px;margin:0 0 7px}
    .rv-subj .k{flex:none;width:18px;height:18px;border-radius:4px;background:#EEE;color:#777;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center}
    .rv-subj li.on .k{background:var(--pink);color:#fff}
    .rv-subj em{font-style:normal;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--pink);white-space:nowrap}
    .rv-in{width:100%;border:1px solid #D5D2CB;border-radius:7px;padding:7px 10px;font-size:13.5px;background:#FCFBF9;color:var(--ink)}
    textarea.rv-in{min-height:80px;resize:vertical;line-height:1.5}
    .rv-in:focus{outline:none;border-color:var(--pink);box-shadow:0 0 0 3px rgba(255,0,85,.15);background:#fff}
    .changed>.rv-in,.rv-in.changed{border-color:#E0A800;background:#FFF8E1}
    .rv-meta details{margin-top:4px;font-size:13px}
    .rv-meta summary{cursor:pointer;font-weight:600;color:var(--indigo);margin-bottom:8px}
    .rv-frame{background:#0B0B10;padding:22px 0;display:flex;justify-content:center}
    .rv-frame iframe{display:block;width:100%;max-width:680px;border:0;height:600px;background:#0B0B10}
    .rv-frame.phone iframe{width:390px;max-width:calc(100% - 24px);border:9px solid #23232B;border-radius:30px;background:#fff}
    .rv-tip{background:#1A1A22;color:#CFCDE0;font-size:12.5px;padding:9px 24px;border-bottom:1px solid #000}
    .rv-tip b{color:#fff}
    .rv-decide{padding:18px 24px 22px;border-top:1px solid #E6E3DE}
    .rv-changes{margin:0 0 14px}
    .rv-chg{display:grid;grid-template-columns:1fr auto;gap:4px 12px;align-items:start;border:1px solid #F0D98A;background:#FFFBEB;border-radius:9px;padding:9px 12px;margin-bottom:8px;font-size:13px}
    .rv-chg .l{font-size:10.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#8A6400}
    .rv-chg .was{color:#8A8894;text-decoration:line-through}
    .rv-chg .now{color:var(--ink)}
    .rv-chg button{grid-row:1/span 3;grid-column:2;border:1px solid #D9C27A;background:#fff;border-radius:7px;font-size:12px;padding:4px 10px;cursor:pointer}
    .rv-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
    .rv-actions button{height:40px;border-radius:9px;border:1.5px solid #CFCBC3;background:#fff;font-size:13.5px;font-weight:700;padding:0 18px;cursor:pointer;color:var(--ink)}
    .rv-actions button[data-st=approved].on{background:var(--ok);border-color:var(--ok);color:#fff}
    .rv-actions button[data-st=changes].on{background:var(--warn);border-color:var(--warn);color:#fff}
    .rv-actions button:hover{border-color:#9C988F}
    .rv-finish{background:#000;color:#fff;border-radius:12px;padding:24px 26px;margin-top:10px}
    .rv-finish h3{margin:0 0 6px;font-size:16px;letter-spacing:2px;text-transform:uppercase}
    .rv-finish p{margin:0 0 14px;color:#CFCDE0;font-size:13px;line-height:1.6}
    .rv-finish .rv-btn{height:42px;font-size:14px;padding:0 20px}
    .rv-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);background:#000;color:#fff;border:1px solid #33323C;border-left:4px solid var(--pink);border-radius:10px;padding:12px 18px;font-size:13.5px;opacity:0;pointer-events:none;transition:.2s;z-index:50;max-width:90vw}
    .rv-toast.on{opacity:1;transform:translateX(-50%)}
    @media (max-width:1240px){.rv-brand span{max-width:220px}}
    @media (max-width:760px){.rv-grid,.rv-how{grid-template-columns:1fr}.rv-brand span{max-width:200px}.rv-who input{width:150px}}
    @media print{.rv-bar,.rv-how,.rv-nav,.rv-actions,.rv-finish,.rv-tip{display:none}.rv-email{break-inside:avoid}}`;

  function buildReviewPage(pack, sources) {
    const data = Object.assign({}, pack);
    const assets = data.assets || {};
    delete data.assets;
    // Everything travels as JSON, so no HTML in the code or content can end the script blocks early.
    const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16));
    const code = [sources.render, sources.review, `(${clientApp.toString()})();`];
    const n = data.sequences.reduce((a, s) => a + s.steps.length, 0);
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Review: ${esc(data.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<header class="rv-bar">
  <div class="rv-brand"><b>For review</b><span>${esc(data.title)}</span></div>
  <label class="rv-who"><input id="rv-name" placeholder="Your name" autocomplete="name"></label>
  <div class="rv-seg" id="rv-mode" title="Read the emails, or change their wording"><button data-m="read">Read</button><button data-m="edit">Edit text</button></div>
  <div class="rv-seg" id="rv-device" title="Desktop or phone width"><button data-d="desktop">Desktop</button><button data-d="phone">Phone</button></div>
  <span class="rv-prog" id="rv-prog"></span>
  <button class="rv-btn" id="rv-open" title="Continue a review you saved earlier">Open saved</button>
  <button class="rv-btn pink" id="rv-save">Save review</button>
</header>
<main class="rv-wrap">
  <section class="rv-top"><div class="rv-kick">For approval · An Evening on the Water</div><h1>${esc(data.title)}</h1>
    <p>${n} email${n === 1 ? '' : 's'}${data.preparedBy ? ` · prepared by ${esc(data.preparedBy)}` : ''} · ${esc(new Date(data.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))}</p></section>
  <div class="rv-how">
    <div><b><i>1</i>Read</b>Each email is shown as a lead receives it, with a sample lead (Sarah at Acme Ventures). Switch to <b style="display:inline">Phone</b> to check the mobile layout.</div>
    <div><b><i>2</i>Edit text</b>Click any text on the email, or a subject line, and type. Changes are highlighted. Keep anything in {{double braces}}: it’s filled in for each lead.</div>
    <div><b><i>3</i>Approve and save</b>Approve each email or mark it “Needs changes” with a comment, then click <b style="display:inline">Save review</b> and send the .json file back${data.preparedBy ? ` to ${esc(data.preparedBy)}` : ''}.</div>
  </div>
  <nav class="rv-nav" id="rv-nav"></nav>
  <div id="rv-list"></div>
  <section class="rv-finish"><h3>Finished?</h3><p id="rv-sum"></p><button class="rv-btn pink" id="rv-save2">Save review (.json)</button></section>
</main>
<div class="rv-toast" id="rv-toast"></div>
<script type="application/json" id="rv-pack">${json(data)}</script>
<script type="application/json" id="rv-assets">${json(assets)}</script>
<script type="application/json" id="rv-code">${json(code)}</script>
<script>(function(){var c=JSON.parse(document.getElementById('rv-code').textContent);for(var i=0;i<c.length;i++)(0,eval)(c[i]);})();</script>
</body></html>`;
  }

  /* Runs inside the review page (its source is embedded in the page, so it can only use globals). */
  function clientApp() {
    const R = window.PRender;
    const V = window.PReview;
    const $ = (s, el) => (el || document).querySelector(s);
    const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
    const esc = R.esc;
    const PACK = JSON.parse($('#rv-pack').textContent);
    const RAW = JSON.parse($('#rv-assets').textContent);

    // Images: turn the embedded data into blob URLs once, so each email stays light.
    const URLS = {};
    Object.keys(RAW).forEach((ref) => {
      try {
        const m = /^data:([^;,]+);base64,(.*)$/.exec(RAW[ref]);
        const bin = atob(m[2]);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        URLS[ref] = URL.createObjectURL(new Blob([u8], { type: m[1] }));
      } catch (e) { URLS[ref] = RAW[ref]; }
    });
    const asset = (ref) => URLS[ref] || RAW[ref] || '';

    const KEY = 'pos-review:' + PACK.id;
    let S = { reviewer: '', mode: 'read', device: 'desktop', emails: {} };
    try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch (e) { /* storage unavailable: work without it */ }
    const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };

    const EMAILS = [];
    PACK.sequences.forEach((seq) => seq.steps.forEach((st, i) => EMAILS.push({ key: seq.id + '/' + st.id, seq, st, index: i, n: EMAILS.length })));
    const rec = (em) => (S.emails[em.key] = S.emails[em.key] || { status: 'pending', comment: '', edits: {} });
    const edits = (em) => rec(em).edits;
    const cid = (em) => 'e' + (em.n + 1);
    const DATA = R.mergeData(PACK.context.lead, PACK.context);
    const M = (s) => R.merge(s || '', DATA, 'text');

    function setEdit(em, key, val) {
      if (V.norm(val) === V.norm(V.valueOf(em.st, key))) delete edits(em)[key];
      else edits(em)[key] = val;
      persist();
    }

    const EDIT_CSS = '[data-edit]{cursor:text;border-radius:2px;transition:box-shadow .15s}[data-edit]:hover{box-shadow:0 0 0 1px rgba(255,0,85,.55)}[data-edit]:focus{outline:none;box-shadow:0 0 0 2px #FF0055;background:rgba(255,0,85,.06)}.rv-changed{box-shadow:0 0 0 2px #E0A800!important;background:rgba(245,180,0,.14)!important}';

    function drawFrame(em) {
      const card = $('#' + cid(em));
      const wrap = $('.rv-frame', card);
      wrap.classList.toggle('phone', S.device === 'phone');
      const iframe = document.createElement('iframe');
      iframe.title = 'Email: ' + em.st.name;
      wrap.innerHTML = '';
      wrap.appendChild(iframe);
      const w = V.withEdits(em.st, edits(em));
      const edit = S.mode === 'edit' && !w.rawHtml;
      const c = PACK.context;
      const ctx = { settings: c.settings, team: c.team, signature: c.signature, account: c.account, lead: c.lead, deckMode: em.st.deckMode, asset, editable: edit, resolve: edit ? false : undefined, extraCss: edit ? EDIT_CSS : '', mobile: S.device === 'phone' };
      const html = R.renderEmail({ subject: (w.subjects || [])[w.subjectIndex || 0] || '', preheader: w.preheader, blocks: w.blocks, rawHtml: w.rawHtml }, ctx).html;
      const d = iframe.contentDocument;
      d.open(); d.write(html); d.close();
      const fit = () => { try { iframe.style.height = (d.documentElement.scrollHeight + 2) + 'px'; } catch (e) { /* ignore */ } };
      fit(); setTimeout(fit, 150); setTimeout(fit, 800);
      $$('img', d).forEach((im) => im.addEventListener('load', fit));
      try { if (d.fonts) d.fonts.ready.then(fit); } catch (e) { /* ignore */ }
      d.addEventListener('click', (e) => {
        const a = e.target.closest && e.target.closest('a');
        if (!a) return;
        if (edit) { e.preventDefault(); return; }
        a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener');
      }, true);
      if (!edit) return;
      $$('[data-edit]', d).forEach((el) => {
        const blk = el.closest('[data-block]');
        if (!blk) return;
        const key = 'b|' + blk.getAttribute('data-block') + '|' + el.getAttribute('data-edit');
        const rich = !!el.getAttribute('data-rich');
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'true');
        if (key in edits(em)) el.classList.add('rv-changed');
        const read = () => (rich ? V.cleanRich(el.innerHTML) : el.innerText.replace(/\s+/g, ' ').trim());
        // Compare with the text as first shown, so clicking into a field without typing changes nothing.
        let start = read();
        let timer = null;
        const commit = () => {
          clearTimeout(timer);
          const val = read();
          if (V.norm(val) === V.norm(start)) return;
          start = val;
          setEdit(em, key, val);
          el.classList.toggle('rv-changed', key in edits(em));
          drawDecide(em); drawHead(em); progress();
        };
        el.addEventListener('input', () => { fit(); clearTimeout(timer); timer = setTimeout(commit, 700); });
        el.addEventListener('blur', commit);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !rich) { e.preventDefault(); el.blur(); } });
        el.addEventListener('paste', (e) => {
          e.preventDefault();
          const t = (e.clipboardData || window.clipboardData).getData('text/plain');
          d.execCommand('insertText', false, rich ? t : t.replace(/\s*\n\s*/g, ' '));
        });
      });
    }

    function drawHead(em) {
      const r = rec(em);
      const n = Object.keys(r.edits).length;
      $('#' + cid(em) + ' [data-chips]').innerHTML = (n ? `<span class="chip edits">${n} edit${n === 1 ? '' : 's'}</span>` : '') +
        `<span class="chip ${r.status}">${r.status === 'approved' ? '✓ Approved' : r.status === 'changes' ? 'Needs changes' : 'Not reviewed'}</span>`;
      const a = $('#rv-nav a[href="#' + cid(em) + '"] .dot');
      if (a) a.className = 'dot ' + r.status;
    }

    function drawMeta(em) {
      const w = V.withEdits(em.st, edits(em));
      const ed = edits(em);
      const edit = S.mode === 'edit';
      const inUse = (i) => w.abTest || i === (w.subjectIndex || 0);
      const subjects = (em.st.subjects || []).map((orig, i) => {
        if (!orig) return '';
        const k = 'subjects.' + i;
        const v = (w.subjects || [])[i] || '';
        return `<li class="${inUse(i) ? 'on' : ''}${k in ed ? ' changed' : ''}"><span class="k">${'ABC'[i]}</span>${edit ? `<input class="rv-in" data-k="${k}" value="${esc(v)}">` : `<span>${esc(M(v))}</span>`}${!w.abTest && inUse(i) ? '<em>in use</em>' : ''}</li>`;
      }).join('');
      const field = (k, area) => {
        const v = w[k] || '';
        if (!edit) return `<p>${esc(M(v)) || '—'}</p>`;
        return area ? `<textarea class="rv-in${k in ed ? ' changed' : ''}" data-k="${k}">${esc(v)}</textarea>` : `<input class="rv-in${k in ed ? ' changed' : ''}" data-k="${k}" value="${esc(v)}">`;
      };
      $('#' + cid(em) + ' .rv-meta').innerHTML = `
        <div class="rv-kick">${esc(em.seq.name)} · Email ${em.index + 1} of ${em.seq.steps.length} · ${esc(em.st.when || '')}</div>
        <div class="rv-row"><h2>${esc(em.st.name)}</h2><span data-chips></span></div>
        <div class="rv-grid">
          <div><div class="rv-label">Subject line${w.abTest ? 's (A/B test, rotated)' : (em.st.subjects || []).filter(Boolean).length > 1 ? ' options' : ''}</div><ul class="rv-subj">${subjects}</ul></div>
          <div><div class="rv-label">Preview text (shown after the subject)</div>${field('preheader')}</div>
        </div>
        ${em.st.whatsapp || em.st.linkedin ? `<details${edit ? ' open' : ''}><summary>WhatsApp and LinkedIn versions</summary>${em.st.whatsapp ? `<div class="rv-label">WhatsApp</div>${field('whatsapp', true)}` : ''}${em.st.linkedin ? `<div class="rv-label" style="margin-top:10px">LinkedIn</div>${field('linkedin', true)}` : ''}</details>` : ''}`;
      drawHead(em);
    }

    function drawDecide(em) {
      const r = rec(em);
      const list = Object.keys(r.edits).map((k) => `<div class="rv-chg"><div class="l">${esc(V.labelFor(em.st, k))}</div><div class="was">${esc(V.toPlain(M(V.valueOf(em.st, k)))) || '(empty)'}</div><div class="now">${esc(V.toPlain(M(r.edits[k]))) || '(empty)'}</div><button data-undo="${esc(k)}">Undo</button></div>`).join('');
      $('#' + cid(em) + ' .rv-decide').innerHTML = `
        ${list ? `<div class="rv-label">Your changes</div><div class="rv-changes">${list}</div>` : ''}
        <div class="rv-label">Comments${r.status === 'changes' ? '' : ' (optional)'}</div>
        <textarea class="rv-in" data-comment placeholder="What should change, or anything the team should know">${esc(r.comment)}</textarea>
        <div class="rv-actions"><button data-st="approved" class="${r.status === 'approved' ? 'on' : ''}">✓ Approve</button><button data-st="changes" class="${r.status === 'changes' ? 'on' : ''}">Needs changes</button></div>`;
    }

    function drawAll() {
      $('#rv-name').value = S.reviewer || '';
      $$('#rv-mode button').forEach((b) => b.classList.toggle('on', b.dataset.m === S.mode));
      $$('#rv-device button').forEach((b) => b.classList.toggle('on', b.dataset.d === S.device));
      $('#rv-nav').innerHTML = EMAILS.map((em) => `<a href="#${cid(em)}"><span class="dot ${rec(em).status}"></span>${esc(em.st.name)}</a>`).join('');
      let html = '';
      PACK.sequences.forEach((seq) => {
        if (PACK.sequences.length > 1) html += `<div class="rv-seqh">${esc(seq.name)}${seq.audience ? ' · ' + esc(seq.audience) : ''}</div>`;
        EMAILS.filter((em) => em.seq === seq).forEach((em) => {
          html += `<article class="rv-email" id="${cid(em)}"><div class="rv-meta"></div>${S.mode === 'edit' && !em.st.rawHtml ? '<div class="rv-tip"><b>Editing:</b> click any text on the email and type. Press Tab or click outside to keep a change.</div>' : ''}<div class="rv-frame"></div><div class="rv-decide"></div></article>`;
        });
      });
      $('#rv-list').innerHTML = html;
      EMAILS.forEach((em) => { drawMeta(em); drawFrame(em); drawDecide(em); });
      progress();
    }

    function progress() {
      const all = EMAILS.map(rec);
      const ap = all.filter((r) => r.status === 'approved').length;
      const ch = all.filter((r) => r.status === 'changes').length;
      const ed = all.reduce((n, r) => n + Object.keys(r.edits).length, 0);
      $('#rv-prog').innerHTML = `<b>${ap}</b>/${EMAILS.length} approved${ch ? ` · <b>${ch}</b> need changes` : ''}${ed ? ` · <b>${ed}</b> edit${ed === 1 ? '' : 's'}` : ''}`;
      const left = EMAILS.length - ap - ch;
      $('#rv-sum').textContent = `${ap} approved, ${ch} need changes, ${ed} text edit${ed === 1 ? '' : 's'}${left ? `, ${left} not reviewed yet` : ''}. Save your review and send the .json file back${PACK.preparedBy ? ' to ' + PACK.preparedBy : ''} by email, Slack or WhatsApp. It’s a small file with only your edits and comments. Your work is also kept in this browser, so you can close the page and come back.`;
    }

    let toastTimer;
    function toast(msg) {
      const t = $('#rv-toast');
      t.textContent = msg; t.classList.add('on');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 4200);
    }

    function commitFocused() {
      $$('iframe').forEach((f) => { try { const a = f.contentDocument.activeElement; if (a && a !== f.contentDocument.body) a.blur(); } catch (e) { /* ignore */ } });
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }

    function save() {
      commitFocused();
      const who = $('#rv-name');
      if (!S.reviewer.trim()) { who.classList.add('need'); who.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); toast('Add your name first, so the team knows who reviewed it.'); return; }
      const out = {
        app: PACK.app, kind: 'review', version: 1, packId: PACK.id, title: PACK.title, preparedBy: PACK.preparedBy,
        reviewer: S.reviewer.trim(), savedAt: new Date().toISOString(),
        emails: EMAILS.map((em) => {
          const r = rec(em);
          return {
            sequenceId: em.seq.id, sequenceName: em.seq.name, stepId: em.st.id, name: em.st.name, status: r.status, comment: (r.comment || '').trim(),
            changes: Object.keys(r.edits).map((k) => ({ key: k, label: V.labelFor(em.st, k), before: V.valueOf(em.st, k), after: r.edits[k] })),
          };
        }),
      };
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
      a.download = `Review - ${PACK.title} - ${S.reviewer.trim()}`.replace(/[\\/:*?"<>|]+/g, '-') + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      toast(`Saved. Send the .json file to ${PACK.preparedBy || 'the sender'}.`);
    }

    function openSaved() {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = async () => {
        const f = inp.files[0];
        if (!f) return;
        let data;
        try { data = JSON.parse(await f.text()); } catch (e) { toast('That file isn’t valid JSON.'); return; }
        if (!data || data.kind !== 'review' || !Array.isArray(data.emails)) { toast('That isn’t a review saved from this page.'); return; }
        if (data.packId !== PACK.id && !window.confirm('This review was saved from a different copy of the review page. Load it anyway? Edits are matched by email.')) return;
        S.reviewer = data.reviewer || S.reviewer;
        let n = 0;
        data.emails.forEach((x) => {
          const em = EMAILS.find((e) => e.seq.id === x.sequenceId && e.st.id === x.stepId);
          if (!em) return;
          const r = rec(em);
          r.status = x.status === 'approved' || x.status === 'changes' ? x.status : 'pending';
          r.comment = x.comment || '';
          r.edits = {};
          (x.changes || []).forEach((c) => { if (c && typeof c.key === 'string' && V.validKey(em.st, c.key)) r.edits[c.key] = c.after; });
          n++;
        });
        persist(); drawAll(); toast(`Loaded the review of ${n} email${n === 1 ? '' : 's'}.`);
      };
      inp.click();
    }

    /* events */
    $('#rv-name').addEventListener('input', (e) => { S.reviewer = e.target.value; e.target.classList.remove('need'); persist(); });
    $('#rv-mode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || b.dataset.m === S.mode) return; commitFocused(); S.mode = b.dataset.m; persist(); drawAll(); });
    $('#rv-device').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || b.dataset.d === S.device) return; commitFocused(); S.device = b.dataset.d; persist(); drawAll(); });
    $('#rv-save').addEventListener('click', save);
    $('#rv-save2').addEventListener('click', save);
    $('#rv-open').addEventListener('click', openSaved);
    const emOf = (el) => { const c = el.closest('.rv-email'); return c && EMAILS.find((em) => cid(em) === c.id); };
    $('#rv-list').addEventListener('input', (e) => {
      const t = e.target;
      const em = emOf(t);
      if (!em) return;
      if (t.dataset.k) {
        setEdit(em, t.dataset.k, t.value);
        const on = t.dataset.k in edits(em);
        (t.closest('li') || t).classList.toggle('changed', on);
        if (!t.closest('li')) t.classList.toggle('changed', on);
        drawHead(em); progress();
      }
      if ('comment' in t.dataset) { rec(em).comment = t.value; persist(); }
    });
    $('#rv-list').addEventListener('change', (e) => { const em = emOf(e.target); if (em && e.target.dataset.k) drawDecide(em); });
    $('#rv-list').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      const em = b && emOf(b);
      if (!em) return;
      const r = rec(em);
      if (b.dataset.st) {
        r.status = r.status === b.dataset.st ? 'pending' : b.dataset.st;
        persist(); drawDecide(em); drawHead(em); progress();
        if (r.status === 'changes' && !r.comment) { const c = $('#' + cid(em) + ' [data-comment]'); if (c) c.focus(); }
      } else if (b.dataset.undo) {
        delete r.edits[b.dataset.undo];
        persist(); drawMeta(em); drawFrame(em); drawDecide(em); progress();
      }
    });
    window.addEventListener('beforeprint', commitFocused);
    drawAll();
  }

  return { APP, buildPack, buildReviewPage, compare, apply, valueOf, validKey, setValue, editableKeys, labelFor, withEdits, cleanRich, toPlain, norm, whenLabel };
});
