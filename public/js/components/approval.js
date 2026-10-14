/* Approval sheet and email previews. They are real pages served by the app (/preview/...),
   so "Open in browser" is a normal link that opens in a new browser tab, and "Download" saves the same page. */
import { menu } from '../core.js';
import { openReviewDialog } from './review.js';

function query(o) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v != null && v !== '' && v !== false) q.set(k, v === true ? '1' : String(v));
  return q.toString();
}
export const approvalUrl = ({ seqId, stepId, templateId, keepTags, download }) =>
  `/preview/approval?${query({ sequenceId: seqId, stepId, templateId, tags: keepTags, download })}`;
export const emailUrl = ({ seqId, stepId, templateId, keepTags, download, name }) =>
  `/preview/email?${query({ sequenceId: seqId, stepId, templateId, tags: keepTags, download, name })}`;

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

/** Menu for one email (from the editor, a sequence step or a template card). */
export function downloadMenu(anchor, { seq, step, templateId, name }) {
  const inSeq = !!(seq && seq.id);
  const one = { seqId: inSeq ? seq.id : '', stepId: inSeq ? step.id : '', templateId: inSeq ? '' : templateId };
  const items = [
    { header: 'Approval sheet' },
    { label: 'Open in browser', icon: 'ext', onClick: () => go(approvalUrl(one)) },
    { label: 'Open in browser, showing {{merge fields}}', icon: 'ext', onClick: () => go(approvalUrl({ ...one, keepTags: true })) },
    { label: 'Download file (.html)', icon: 'download', onClick: () => go(approvalUrl({ ...one, download: true }), true) },
  ];
  if (inSeq && seq.steps.length > 1) {
    items.push('-', { header: `Whole sequence (${seq.steps.length} emails)` },
      { label: 'Open in browser', icon: 'ext', onClick: () => go(approvalUrl({ seqId: seq.id })) },
      { label: 'Download file (.html)', icon: 'download', onClick: () => go(approvalUrl({ seqId: seq.id, download: true }), true) });
  }
  items.push('-', { header: 'Email only' },
    { label: 'Open email in browser', icon: 'ext', onClick: () => go(emailUrl(one)) },
    { label: 'Download email HTML', icon: 'code', onClick: () => go(emailUrl({ ...one, download: true, name: name || step.name }), true) },
    { label: 'Download email HTML with {{merge fields}}', icon: 'code', onClick: () => go(emailUrl({ ...one, keepTags: true, download: true, name: `${name || step.name} (merge fields)` }), true) });
  menu(anchor, items);
}

/** Menu for a whole sequence. */
export function sequenceMenu(anchor, seq) {
  menu(anchor, [
    { header: `${seq.name}: all ${seq.steps.length} emails` },
    { label: 'Open approval sheet in browser', icon: 'ext', onClick: () => go(approvalUrl({ seqId: seq.id })) },
    { label: 'Open, showing {{merge fields}}', icon: 'ext', onClick: () => go(approvalUrl({ seqId: seq.id, keepTags: true })) },
    { label: 'Download file (.html)', icon: 'download', onClick: () => go(approvalUrl({ seqId: seq.id, download: true }), true) },
    '-', { header: 'Editable by marketing' },
    { label: 'Marketing review (edit & approve)…', icon: 'pen', onClick: () => openReviewDialog([seq.id]) },
  ]);
}
