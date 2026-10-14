/*
 * Approval sheet: one page with each email's subject lines, timing and the email itself.
 * Built on the server (served at /preview/approval) so it opens as a normal page in the browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./render'));
  else root.PApproval = factory(root.PRender);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';
  const esc = R.esc;

  function timingLabel(step, i) {
    if (step.fixedDate) return `On ${new Date(step.fixedDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${step.sendTime || '10:00'}`;
    if (i === 0) return `Day 0 · ${step.sendTime || '10:00'}`;
    return `+${step.delayDays || 0} day${Number(step.delayDays) === 1 ? '' : 's'} · ${step.sendTime || '10:00'}`;
  }

  function buildApprovalPage({ title, subtitle, seq, parts, keepTags, preparedBy, mergeData }) {
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const styles = new Set();
    // Day number of an email = sum of the waits before it (fixed-date emails show their date instead).
    const dayOf = (idx) => seq.steps.slice(1, idx + 1).reduce((n, x) => n + (x.fixedDate ? 0 : Number(x.delayDays) || 0), 0);
    // Subject lines and short versions use the same sample lead as the emails below them.
    const M = (x) => (mergeData ? R.merge(x || '', mergeData, 'text') : (x || ''));
  
    const sections = parts.map((p, n) => {
      const st = p.step;
      const head = (p.html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [])[1] || '';
      (head.match(/<style[\s\S]*?<\/style>/gi) || []).forEach((x) => styles.add(x));
      const body = (p.html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [null, p.html])[1];
      const inSeq = !!seq;
      const when = inSeq ? `${st.fixedDate ? timingLabel(st, p.index) : `${p.index === 0 ? 'Day 0' : `Day ${dayOf(p.index)}`} · ${st.sendTime || '10:00'}`}${p.index > 0 && st.threadReply ? ' · sent as a reply in the same thread' : ''}` : 'Template';
      const deck = st.deck && st.deck !== 'inherit' ? st.deck : (seq && seq.deckChoice) || 'off';
      const subjects = (st.subjects || []).map((s, i) => (s ? `<li class="${st.abTest || i === (st.subjectIndex || 0) ? 'on' : ''}"><span class="k">${'ABC'[i]}</span>${esc(M(s))}${!st.abTest && i === (st.subjectIndex || 0) ? '<em>in use</em>' : ''}</li>` : '')).join('');
      return `<section class="ap-email">
        <div class="ap-meta">
          <div class="ap-kicker">${inSeq ? `Email ${p.index + 1} of ${p.total}` : 'Template'} · ${esc(when)}</div>
          <h2>${esc(st.name)}</h2>
          <div class="ap-grid">
            <div><div class="ap-label">Subject line${st.abTest ? 's (A/B test, rotated)' : ' options'}</div><ul class="ap-subj">${subjects}</ul></div>
            <div><div class="ap-label">Preview text</div><p>${esc(M(st.preheader) || '—')}</p>
              <div class="ap-label">Sponsorship deck</div><p>${deck === 'attach' ? 'PDF attached' : deck === 'link' ? 'Link to the deck' : 'Not included'}</p></div>
          </div>
          ${st.whatsapp || st.linkedin ? `<details><summary>WhatsApp and LinkedIn versions</summary>${st.whatsapp ? `<div class="ap-label">WhatsApp</div><p>${esc(M(st.whatsapp))}</p>` : ''}${st.linkedin ? `<div class="ap-label">LinkedIn</div><p>${esc(M(st.linkedin))}</p>` : ''}</details>` : ''}
        </div>
        <div class="ap-frame">${body}</div>
      </section>${n < parts.length - 1 ? '<div class="ap-gap"></div>' : ''}`;
    }).join('');
  
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>For approval: ${esc(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet">
  ${Array.from(styles).join('\n')}
  <style>
    html,body{margin:0;background:#E9E7E3;}
    .ap-wrap{max-width:860px;margin:0 auto;padding:28px 18px 60px;font-family:'Poppins',Arial,Helvetica,sans-serif;color:#1C1C1C;}
    .ap-top{background:#000;color:#fff;border-left:6px solid #FF0055;padding:24px 28px;}
    .ap-top .ap-kicker{color:#FF0055;}
    .ap-top h1{margin:6px 0 4px;font-size:26px;line-height:1.15;font-weight:800;text-transform:uppercase;letter-spacing:.3px;}
    .ap-top p{margin:0;color:#CFCDE0;font-size:13px;}
    .ap-kicker{font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#FF0055;}
    .ap-note{margin:14px 0 26px;font-size:13px;color:#55545E;line-height:1.6;}
    .ap-email{background:#fff;border:1px solid #D9D6D0;border-radius:10px;overflow:hidden;}
    .ap-meta{padding:20px 24px;border-bottom:1px solid #E6E3DE;}
    .ap-meta h2{margin:4px 0 14px;font-size:19px;font-weight:700;}
    .ap-grid{display:grid;grid-template-columns:1.3fr 1fr;gap:18px;}
    .ap-label{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8A8894;margin:0 0 6px;}
    .ap-meta p{margin:0 0 12px;font-size:13px;line-height:1.55;}
    .ap-subj{list-style:none;margin:0;padding:0;}
    .ap-subj li{display:flex;gap:8px;align-items:baseline;font-size:13.5px;margin:0 0 7px;}
    .ap-subj .k{flex:none;width:18px;height:18px;border-radius:4px;background:#EEE;color:#777;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;}
    .ap-subj li.on .k{background:#FF0055;color:#fff;}
    .ap-subj em{font-style:normal;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#FF0055;margin-left:6px;}
    .ap-meta details{margin-top:6px;font-size:13px;}
    .ap-meta summary{cursor:pointer;font-weight:600;color:#3B1FA8;margin-bottom:8px;}
    .ap-frame{background:#0B0B10;padding:24px 0;}
    .ap-gap{height:26px;}
    .ap-sign{margin-top:28px;background:#fff;border:1px solid #D9D6D0;border-radius:10px;padding:20px 24px;font-size:13px;}
    .ap-sign h3{margin:0 0 14px;font-size:14px;letter-spacing:2px;text-transform:uppercase;}
    .ap-sign .row{display:flex;gap:28px;flex-wrap:wrap;margin-bottom:14px;}
    .ap-sign .line{flex:1;min-width:180px;border-bottom:1px solid #BBB;height:24px;}
    .ap-box{display:inline-block;width:13px;height:13px;border:1.5px solid #555;margin-right:6px;vertical-align:-2px;}
    @media (max-width:640px){.ap-grid{grid-template-columns:1fr;}}
    @media print{html,body{background:#fff;}.ap-email{break-inside:avoid;border:0;}.ap-frame{padding:0;}details{display:none;}}
  </style></head><body>
  <div class="ap-wrap">
    <div class="ap-top"><div class="ap-kicker">For approval · An Evening on the Water</div><h1>${esc(title)}</h1>
      <p>${esc(subtitle || '')}${subtitle ? ' · ' : ''}${parts.length} email${parts.length === 1 ? '' : 's'} · prepared ${preparedBy ? `by ${esc(preparedBy)} ` : ''}on ${esc(date)}</p></div>
    <div class="ap-note">${keepTags ? 'Merge fields are shown as <b>{{first_name}}</b>, <b>{{company}}</b> and so on; they’re filled in for each lead when sent.' : 'Shown with a sample lead (Sarah, Acme Ventures). Names and companies are filled in for each lead when sent.'} Links in this preview are live. Reply with “approved” or your comments.</div>
    ${sections}
    <div class="ap-sign"><h3>Approval</h3>
      <div class="row"><span><span class="ap-box"></span>Approved</span><span><span class="ap-box"></span>Approved with changes</span><span><span class="ap-box"></span>Needs another round</span></div>
      <div class="row"><span>Name</span><span class="line"></span><span>Date</span><span class="line"></span></div>
      <div>Comments</div><div class="line" style="height:70px;border:1px solid #BBB;border-radius:6px;margin-top:6px"></div></div>
  </div></body></html>`;
  }

  return { buildApprovalPage };
});
