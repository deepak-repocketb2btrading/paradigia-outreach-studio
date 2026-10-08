'use strict';
/* Builds RFC 5322 / MIME messages for the Gmail API (raw upload). */
const crypto = require('crypto');

const isAscii = (s) => /^[\x20-\x7E]*$/.test(s);

function encodeHeader(value) {
  const s = String(value || '');
  if (isAscii(s)) return s;
  // Split into chunks so each encoded-word stays under the 75-char limit.
  const words = [];
  let chunk = '';
  for (const ch of s) {
    if (Buffer.byteLength(chunk + ch) > 42) { words.push(chunk); chunk = ''; }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w).toString('base64')}?=`).join('\r\n ');
}

function address(name, email) {
  if (!name) return `<${email}>`;
  if (isAscii(name)) return `"${name.replace(/["\\]/g, '\\$&')}" <${email}>`;
  return `${encodeHeader(name)} <${email}>`;
}

const wrap76 = (b64) => b64.replace(/.{1,76}/g, '$&\r\n');
const boundary = (tag) => `----=_${tag}_${crypto.randomBytes(10).toString('hex')}`;

/**
 * opts: { from:{name,email}, to:{name,email}, subject, html, text, inReplyTo, references,
 *         listUnsubscribe, inline:[{cid, filename, contentType, data:Buffer}], attachments:[{filename, contentType, data}] }
 */
function buildMessage(opts) {
  const domain = (opts.from.email.split('@')[1] || 'localhost').toLowerCase();
  const messageId = `<${crypto.randomUUID()}@${domain}>`;
  const headers = [
    `From: ${address(opts.from.name, opts.from.email)}`,
    `To: ${address(opts.to.name, opts.to.email)}`,
    `Subject: ${encodeHeader(opts.subject)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
  ];
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) headers.push(`References: ${opts.references}`);
  if (opts.listUnsubscribe) headers.push(`List-Unsubscribe: ${opts.listUnsubscribe}`);

  const altB = boundary('alt');
  const alt = [
    `Content-Type: multipart/alternative; boundary="${altB}"`, '',
    `--${altB}`, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '',
    wrap76(Buffer.from(opts.text || '').toString('base64')),
    `--${altB}`, 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '',
    wrap76(Buffer.from(opts.html || '').toString('base64')),
    `--${altB}--`, '',
  ].join('\r\n');

  let body = alt;
  if (opts.inline && opts.inline.length) {
    const relB = boundary('rel');
    body = [
      `Content-Type: multipart/related; boundary="${relB}"`, '',
      `--${relB}`, alt,
      ...opts.inline.map((f) => [
        `--${relB}`,
        `Content-Type: ${f.contentType}; name="${f.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-ID: <${f.cid}>`,
        `X-Attachment-Id: ${f.cid}`,
        `Content-Disposition: inline; filename="${f.filename}"`, '',
        wrap76(f.data.toString('base64')),
      ].join('\r\n')),
      `--${relB}--`, '',
    ].join('\r\n');
  }
  if (opts.attachments && opts.attachments.length) {
    const mixB = boundary('mix');
    body = [
      `Content-Type: multipart/mixed; boundary="${mixB}"`, '',
      `--${mixB}`, body,
      ...opts.attachments.map((f) => [
        `--${mixB}`,
        `Content-Type: ${f.contentType}; name="${encodeHeader(f.filename)}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${encodeHeader(f.filename)}"`, '',
        wrap76(f.data.toString('base64')),
      ].join('\r\n')),
      `--${mixB}--`, '',
    ].join('\r\n');
  }
  return { raw: headers.join('\r\n') + '\r\n' + body, messageId };
}

module.exports = { buildMessage, encodeHeader, address };
