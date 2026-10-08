/*
 * Paradigia Outreach Studio: email renderer.
 * Shared by the browser (live preview / editor canvas) and Node (sending, export),
 * so the preview is byte-for-byte what goes out.
 *
 * Output rules: table layout, 600px, inline CSS, bulletproof buttons, alt text on
 * every image, no JavaScript, Poppins with Arial fallback.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const C = {
    pink: '#FF0055', black: '#000000', off: '#F2F1EF', ink: '#1C1C1C', body: '#2B2B33',
    grey: '#6E7385', line: '#DEDCD8', indigo: '#1A1040', violet: '#3B1FA8', white: '#FFFFFF',
    night: '#0B0B10', soft: '#E8E6F0',
  };
  const TIER_COLORS = { premium: '#FF0055', gold: '#D4AF37', silver: '#C0C0C0', bronze: '#B78B63' };
  const TIER_TINTS = { premium: '#FCE3EC', gold: '#F6EED3', silver: '#ECECEC', bronze: '#F1E6DB' };
  const TIER_ORDER = ['premium', 'gold', 'silver', 'bronze'];
  const FONT = "'Poppins', Arial, Helvetica, sans-serif";

  const STATUSES = [
    { key: 'new', label: 'New', color: '#8E8EA0' },
    { key: 'contacted', label: 'Contacted', color: '#7C6CF0' },
    { key: 'followup', label: 'Follow-up', color: '#3B82F6' },
    { key: 'replied', label: 'Replied', color: '#FF0055' },
    { key: 'interested', label: 'Interested', color: '#F59E0B' },
    { key: 'meeting', label: 'Meeting', color: '#D4AF37' },
    { key: 'won', label: 'Won', color: '#22C55E' },
    { key: 'lost', label: 'Lost', color: '#6B7280' },
    { key: 'unsubscribed', label: 'Unsubscribed', color: '#9CA3AF' },
    { key: 'bounced', label: 'Bounced', color: '#EF4444' },
  ];

  const MERGE_FIELDS = [
    { key: 'first_name', label: 'First name', fallback: 'there' },
    { key: 'last_name', label: 'Last name', fallback: '' },
    { key: 'company', label: 'Company', fallback: 'your company' },
    { key: 'sender_name', label: 'Sender name' },
    { key: 'tier', label: 'Tier' },
    { key: 'price', label: 'Tier price' },
    { key: 'ticket_link', label: 'Ticket link' },
    { key: 'sender_first_name', label: 'Sender first name' },
    { key: 'sender_title', label: 'Sender title' },
    { key: 'sender_email', label: 'Sender email' },
    { key: 'sender_phone', label: 'Sender phone' },
    { key: 'spots_left', label: 'Spots left' },
    { key: 'deck_link', label: 'Deck link' },
    { key: 'event_name', label: 'Event name' },
    { key: 'event_date', label: 'Event date' },
  ];

  /* ---------------------------------------------------------------- helpers */

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const digits = (s) => String(s || '').replace(/[^\d]/g, '');
  const money = (n) => '$' + Number(n || 0).toLocaleString('en-US');
  const tierKey = (t) => {
    const k = String(t || '').toLowerCase().trim();
    return TIER_ORDER.includes(k) ? k : 'bronze';
  };

  function senderFrom(ctx) {
    const sig = ctx.signature || {};
    const name = sig.name || (ctx.account && ctx.account.displayName) || 'The Paradigia Team';
    return {
      name,
      first: name.split(/\s+/)[0],
      title: sig.title || '',
      email: sig.email || (ctx.account && ctx.account.email) || '',
      phone: sig.phone || '',
      whatsapp: sig.whatsapp || sig.phone || '',
    };
  }

  function mergeData(lead, ctx) {
    const s = ctx.settings || {};
    const ev = s.event || {};
    const tiers = s.tiers || {};
    const l = lead || {};
    const tk = tierKey(l.tierInterest);
    const snd = senderFrom(ctx);
    const first = l.firstName || String(l.name || '').trim().split(/\s+/)[0] || '';
    return {
      first_name: first,
      last_name: l.lastName || '',
      company: l.company || '',
      tier: (tiers[tk] && tiers[tk].name) || 'Bronze',
      price: money((tiers[tk] && tiers[tk].price) || 3000),
      ticket_link: ev.ticketLink || '',
      sender_name: snd.name,
      sender_first_name: snd.first,
      sender_title: snd.title,
      sender_email: snd.email,
      sender_phone: snd.phone,
      spots_left: ev.spotsLeft != null ? String(ev.spotsLeft) : '',
      deck_link: (s.deck && s.deck.hostedUrl) || '',
      event_name: ev.name || 'An Evening on the Water',
      event_date: ev.dateLabel || 'December 9, 2026',
    };
  }

  const TOKEN = /\{\{\s*([a-z_]+)\s*(?:\|\s*([^}]*?)\s*)?\}\}/gi;
  const fallbackFor = (key) => {
    const f = MERGE_FIELDS.find((m) => m.key === key);
    return f && f.fallback != null ? f.fallback : '';
  };

  /** Replace {{tokens}}. mode: 'html' (escape values), 'text' (raw), 'url' (encode unless token is the whole URL). */
  function merge(str, data, mode) {
    if (!data) return String(str == null ? '' : str);
    return String(str == null ? '' : str).replace(TOKEN, (m, key, fb, offset) => {
      const k = key.toLowerCase();
      if (!(k in data)) return m;
      let v = data[k];
      if (v == null || v === '') v = fb != null ? fb : fallbackFor(k);
      v = String(v);
      if (mode === 'html') return esc(v);
      if (mode === 'url') return offset === 0 ? v : encodeURIComponent(v);
      return v;
    });
  }

  /* -------------------------------------------------------------- rich text */

  function styleRich(html, o) {
    const p = `margin:0 0 14px 0;font-family:${FONT};font-size:${o.size}px;line-height:${o.lh}px;color:${o.color};`;
    return String(html || '')
      .replace(/<p(\s[^>]*)?>/gi, `<p style="${p}">`)
      .replace(/<a\s+(?![^>]*style=)/gi, `<a style="color:${o.link};text-decoration:underline;font-weight:600;" `)
      .replace(/<ul(\s[^>]*)?>/gi, '<ul style="margin:0 0 14px 0;padding:0 0 0 20px;">')
      .replace(/<ol(\s[^>]*)?>/gi, '<ol style="margin:0 0 14px 0;padding:0 0 0 20px;">')
      .replace(/<li(\s[^>]*)?>/gi, `<li style="margin:0 0 6px 0;font-family:${FONT};font-size:${o.size}px;line-height:${o.lh}px;color:${o.color};">`)
      .replace(/<(strong|b)(\s[^>]*)?>/gi, `<strong style="font-weight:700;color:${o.strong || o.color};">`)
      .replace(/<\/b>/gi, '</strong>');
  }

  function htmlToText(html) {
    return String(html || '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<\/(p|div|h\d|tr|ul|ol)>/gi, '\n\n')
      .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, txt) => {
        const t = txt.replace(/<[^>]+>/g, '').trim();
        return href.startsWith('mailto:') || t === href ? t : `${t} (${href})`;
      })
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&rarr;/g, '→').replace(/&bull;/g, '•')
      .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  const wordCount = (s) => (String(s || '').replace(/<[^>]+>/g, ' ').match(/[\p{L}\p{N}$][\p{L}\p{N}$'’,.\-]*/gu) || []).length;

  /* ----------------------------------------------------------- block registry */

  const BLOCKS = {
    header: { label: 'Header (logos)', icon: '▤', hint: 'Dark band with the three logos', defaults: { showParadigia: true, showMobihub: true, showSunstrike: true } },
    hero: { label: 'Hero', icon: '◐', hint: 'Yacht photo, eyebrow, headline, date line', defaults: { image: 'brand:hero-yacht.jpg', eyebrow: 'SPONSORSHIP OPPORTUNITIES', headline: 'AN EVENING ON THE WATER', dateLine: 'DECEMBER 9 2026 • DUBAI MARINA • 7:00 PM – 1:00 AM', alt: 'A private yacht lit up at night in Dubai Marina', link: '' } },
    heading: { label: 'Section heading', icon: 'H', hint: 'Pink label + bold uppercase title', defaults: { eyebrow: 'THE EVENT', title: 'A CURATED NETWORKING EXPERIENCE', align: 'left', underline: false, bg: 'light' } },
    text: { label: 'Text', icon: '¶', hint: 'Greeting and body copy', defaults: { html: '<p>Hi {{first_name}},</p><p>Write your message here.</p>', bg: 'light', align: 'left', pad: 'm' } },
    benefits: { label: 'Benefits list', icon: '■', hint: 'Pink square bullets', defaults: { eyebrow: 'WHY IT WORKS', title: '', items: [{ title: 'LOCATION', text: 'Dubai Marina, aboard a private yacht (400-guest capacity).' }], bullet: 'pink', bg: 'light' } },
    tierCard: { label: 'Tier card', icon: '◆', hint: 'Bronze / Silver / Gold / Premium package', defaults: { tier: 'bronze', badge: 'BEST ENTRY POINT', showBenefits: true, maxBenefits: 0, showUpgrades: true } },
    comparison: { label: 'Comparison table', icon: '▦', hint: 'All four tiers side by side', defaults: { title: 'SPONSORSHIP PACKAGES OVERVIEW', highlight: 'bronze', badge: 'BEST ENTRY POINT', caption: '' } },
    callout: { label: 'Why partner (black box)', icon: '▌', hint: 'Black block with pink left border', defaults: { eyebrow: 'WHY PARTNER WITH US', text: 'Curated audience, direct introductions, multi-channel visibility, and a memorable setting people talk about long after the night ends.', items: [] } },
    cta: { label: 'CTA button', icon: '▭', hint: 'Pink bulletproof button', defaults: { text: 'Reserve My Spot', action: 'reply', replySubject: 'Reserve my spot – {{company}}', url: '', note: '' } },
    secondaryCta: { label: 'Secondary CTA', icon: '→', hint: '“Meet me on the yacht, let’s talk”', defaults: { text: 'Meet me on the yacht, let’s talk', action: 'whatsapp', waText: 'Hi {{sender_first_name}}, let’s talk about An Evening on the Water.', replySubject: '', url: '' } },
    image: { label: 'Image', icon: '▣', hint: 'Photo from the deck or your upload', defaults: { src: 'brand:yacht-1.jpg', alt: 'The yacht at night in Dubai Marina', link: '', caption: '', full: true } },
    divider: { label: 'Divider', icon: '〰', hint: 'Line, pink bar or wave art', defaults: { style: 'wave', bg: 'light' } },
    spacer: { label: 'Spacer', icon: '↕', hint: 'Vertical space', defaults: { height: 24, bg: 'light' } },
    team: { label: 'Meet the Team', icon: '◎', hint: 'Management + sales circles', defaults: { heading: 'MEET THE TEAM AT THE EVENT', showManagement: true, showSales: true, members: null, size: 'small', labels: 'hover', perRow: 5 } },
    signature: { label: 'Signature', icon: '✎', hint: 'Premium sender signature', defaults: {} },
    footer: { label: 'Footer', icon: '▁', hint: 'Event details + unsubscribe', defaults: { note: 'You’re receiving this because we believe An Evening on the Water is relevant to {{company}}.' } },
  };

  /* --------------------------------------------------------- render context */

  function makeR(ctx) {
    const editable = !!ctx.editable;
    const data = ctx.resolve === false ? null : mergeData(ctx.lead, ctx);
    const used = new Set();
    const asset = (ref) => {
      if (!ref) return '';
      if (/^(https?:|data:|cid:)/i.test(ref)) return ref;
      used.add(ref);
      return ctx.asset ? ctx.asset(ref) : ref.replace(/^brand:/, '/brand/').replace(/^upload:/, '/uploads/');
    };
    const T = (s) => (data ? merge(esc(s), data, 'html') : esc(s));
    const RICH = (s) => (data ? merge(s, data, 'html') : String(s || ''));
    const U = (s) => esc(data ? merge(s, data, 'url') : s);
    const E = (field) => (editable ? ` data-edit="${field}"` : '');
    const ER = (field) => (editable ? ` data-edit="${field}" data-rich="1"` : '');
    return { ctx, editable, data, used, asset, T, RICH, U, E, ER };
  }

  function actionHref(r, o, fallbackSubject) {
    const snd = senderFrom(r.ctx);
    const s = r.ctx.settings || {};
    switch (o.action) {
      case 'tickets': return esc((s.event && s.event.ticketLink) || '#');
      case 'deck': return esc((s.deck && s.deck.hostedUrl) || `mailto:${snd.email}?subject=${encodeURIComponent('Please send the sponsorship deck')}`);
      case 'whatsapp': {
        // No number on the signature: fall back to a pre-filled reply email.
        if (!digits(snd.whatsapp)) return actionHref(r, { action: 'reply', replySubject: fallbackSubject || 'Let’s talk: An Evening on the Water' });
        const text = r.data ? merge(o.waText || '', r.data, 'text') : (o.waText || '');
        return esc(`https://wa.me/${digits(snd.whatsapp)}${text ? '?text=' + encodeURIComponent(text) : ''}`);
      }
      case 'url': return r.U(o.url || '#');
      case 'reply':
      default: {
        const subj = r.data ? merge(o.replySubject || fallbackSubject || '', r.data, 'text') : (o.replySubject || fallbackSubject || '');
        return esc(`mailto:${snd.email}${subj ? '?subject=' + encodeURIComponent(subj) : ''}`);
      }
    }
  }

  const bgOf = (bg) => (bg === 'dark' ? C.black : C.off);
  const inkOf = (bg) => (bg === 'dark' ? C.white : C.ink);
  const bodyOf = (bg) => (bg === 'dark' ? C.soft : C.body);
  const dmClass = (bg) => (bg === 'dark' ? '' : ' dm-off');

  function sec(b, r, o, inner) {
    const attrs = r.editable ? ` data-block="${b.id}" data-type="${b.type}"` : '';
    return `<tr><td${attrs} class="${o.cls || ''}" bgcolor="${o.bg}" align="${o.align || 'left'}" style="background-color:${o.bg};padding:${o.pad || '0'};${o.style || ''}">${inner}</td></tr>`;
  }

  const eyebrowP = (r, text, field, color, align) => text ? `<p${r.E(field)} style="margin:0 0 10px 0;font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:${color || C.pink};${align ? 'text-align:' + align + ';' : ''}">${r.T(text)}</p>` : '';

  function squareBullet(color, size) {
    const s = size || 10;
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="${s}" height="${s}" bgcolor="${color}" style="width:${s}px;height:${s}px;background-color:${color};font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr></table>`;
  }

  function button(href, text, o) {
    const w = o.width || 280, h = o.height || 54, bg = o.bg || C.pink, color = o.color || C.white;
    const label = esc(text);
    return `<div style="margin:0;">` +
      `<!--[if mso]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:${h}px;v-text-anchor:middle;width:${w}px;" stroke="f" fillcolor="${bg}"><w:anchorlock/><center style="color:${color};font-family:Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:2px;">${label.toUpperCase()}</center></v:rect><![endif]-->` +
      `<!--[if !mso]><!-- --><a href="${href}" target="_blank" style="background-color:${bg};border-radius:2px;color:${color};display:inline-block;font-family:${FONT};font-size:14px;font-weight:700;letter-spacing:2px;line-height:${h}px;text-align:center;text-decoration:none;text-transform:uppercase;width:${w}px;max-width:100%;-webkit-text-size-adjust:none;mso-hide:all;"${o.editField ? ` data-edit="${o.editField}"` : ''}>${label}</a><!--<![endif]-->` +
      `</div>`;
  }

  function circle(r, o) {
    // Photo (56/72px, pink ring) or initials fallback. o: {photo, name, size, href}
    const size = o.size || 56;
    const ring = o.ring || 2;
    const inner = size;
    const initials = String(o.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
    const tip = o.title ? ` title="${esc(o.title)}"` : '';
    const open = o.href ? `<a href="${o.href}" target="_blank"${tip} style="text-decoration:none;color:${C.white};display:block;">` : '';
    const close = o.href ? '</a>' : '';
    if (o.photo) {
      return `${open}<img src="${esc(r.asset(o.photo))}" width="${inner}" height="${inner}" alt="${esc(o.title || 'Photo of ' + (o.name || 'team member'))}"${tip} style="display:block;margin:0 auto;width:${inner}px;height:${inner}px;border-radius:50%;border:${ring}px solid ${C.pink};object-fit:cover;outline:none;text-decoration:none;">${close}`;
    }
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;border-collapse:separate;"><tr><td width="${inner}" height="${inner}" align="center" valign="middle" bgcolor="${C.indigo}" style="width:${inner}px;height:${inner}px;border-radius:50%;border:${ring}px solid ${C.pink};background-color:${C.indigo};background-image:linear-gradient(135deg,${C.indigo},${C.violet});font-family:${FONT};font-size:${Math.round(size / 3.2)}px;line-height:${inner}px;font-weight:700;letter-spacing:1px;color:${C.white};text-align:center;">${open}${esc(initials)}${close}</td></tr></table>`;
  }

  /* ------------------------------------------------------------------ blocks */

  const R = {};

  R.header = (b, r) => {
    const logos = [];
    if (b.showMobihub !== false) logos.push(`<td valign="middle" style="padding:0 0 0 16px;"><img class="logo-m" src="${esc(r.asset('brand:logo-mobihub-white.png'))}" width="104" height="20" alt="mobi hub | events" style="display:block;width:104px;height:auto;border:0;"></td>`);
    if (b.showSunstrike !== false) logos.push(`<td valign="middle" style="padding:0 0 0 16px;"><img class="logo-s" src="${esc(r.asset('brand:logo-sunstrike.png'))}" width="62" height="32" alt="Sunstrike" style="display:block;width:62px;height:auto;border:0;"></td>`);
    const left = b.showParadigia !== false ? `<img class="logo-p" src="${esc(r.asset('brand:logo-paradigia-white.png'))}" width="128" height="30" alt="Paradigia" style="display:block;width:128px;height:auto;border:0;">` : '&nbsp;';
    return sec(b, r, { bg: C.black, pad: '24px 36px', cls: 'px' },
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td align="left" valign="middle">${left}</td>` +
      `<td align="right" valign="middle"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr>${logos.join('')}</tr></table></td>` +
      `</tr></table>`);
  };

  R.hero = (b, r) => {
    const img = `<img class="fluid" src="${esc(r.asset(b.image || 'brand:hero-yacht.jpg'))}" width="600" alt="${esc(b.alt || '')}" style="display:block;width:100%;max-width:600px;height:auto;border:0;">`;
    const pic = b.link ? `<a href="${r.U(b.link)}" target="_blank">${img}</a>` : img;
    return sec(b, r, { bg: C.indigo },
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
      `<tr><td bgcolor="${C.indigo}" style="background-color:${C.indigo};line-height:0;font-size:0;">${pic}</td></tr>` +
      `<tr><td class="px" bgcolor="${C.indigo}" style="background-color:${C.indigo};background-image:linear-gradient(180deg,${C.indigo} 0%,#21125A 100%);padding:0 40px 40px 40px;">` +
      eyebrowP(r, b.eyebrow, 'eyebrow') +
      `<h1 class="h1"${r.E('headline')} style="margin:0 0 12px 0;font-family:${FONT};font-size:36px;line-height:42px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;color:${C.white};">${r.T(b.headline)}</h1>` +
      (b.dateLine ? `<p${r.E('dateLine')} style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;letter-spacing:1px;color:#D9D6EE;">${r.T(b.dateLine)}</p>` : '') +
      `</td></tr></table>`);
  };

  R.heading = (b, r) => {
    const bg = bgOf(b.bg), align = b.align || 'left';
    const bar = b.underline ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align}" style="margin-top:12px;"><tr><td width="56" height="3" bgcolor="${C.pink}" style="width:56px;height:3px;background-color:${C.pink};font-size:0;line-height:0;">&nbsp;</td></tr></table>` : '';
    return sec(b, r, { bg, pad: '32px 40px 8px 40px', cls: 'px' + dmClass(b.bg), align },
      eyebrowP(r, b.eyebrow, 'eyebrow', null, align) +
      `<h2${r.E('title')} class="dm-ink" style="margin:0;font-family:${FONT};font-size:24px;line-height:30px;font-weight:800;text-transform:uppercase;color:${inkOf(b.bg)};text-align:${align};">${r.T(b.title)}</h2>${bar}`);
  };

  R.text = (b, r) => {
    const bg = bgOf(b.bg);
    const pads = { s: '12px 40px 2px 40px', m: '28px 40px 6px 40px', l: '40px 40px 16px 40px' };
    const html = styleRich(r.RICH(b.html), { size: 15, lh: 25, color: bodyOf(b.bg), link: C.pink, strong: inkOf(b.bg) });
    return sec(b, r, { bg, pad: pads[b.pad || 'm'], cls: 'px' + dmClass(b.bg), align: b.align || 'left' },
      `<div${r.ER('html')} class="dm-ink" style="font-family:${FONT};font-size:15px;line-height:25px;color:${bodyOf(b.bg)};text-align:${b.align || 'left'};">${html}</div>`);
  };

  R.benefits = (b, r) => {
    const bg = bgOf(b.bg);
    const color = b.bullet && b.bullet !== 'pink' ? (TIER_COLORS[b.bullet] || C.pink) : C.pink;
    const items = (b.items || []).map((it, i) => {
      const item = typeof it === 'string' ? { title: '', text: it } : it;
      return `<tr><td width="24" valign="top" style="padding:${item.title ? 4 : 7}px 0 0 0;">${squareBullet(color, 11)}</td>` +
        `<td valign="top" style="padding:0 0 16px 0;">` +
        (item.title ? `<p${r.E(`items.${i}.title`)} class="dm-ink" style="margin:0;font-family:${FONT};font-size:13px;line-height:19px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${inkOf(b.bg)};">${r.T(item.title)}</p>` : '') +
        (item.text ? `<p${r.E(`items.${i}.text`)} class="dm-muted" style="margin:${item.title ? '2px' : '0'} 0 0 0;font-family:${FONT};font-size:14px;line-height:22px;color:${b.bg === 'dark' ? '#B9B7C8' : C.grey};">${r.T(item.text)}</p>` : '') +
        `</td></tr>`;
    }).join('');
    return sec(b, r, { bg, pad: '20px 40px 10px 40px', cls: 'px' + dmClass(b.bg) },
      eyebrowP(r, b.eyebrow, 'eyebrow') +
      (b.title ? `<h3${r.E('title')} class="dm-ink" style="margin:0 0 18px 0;font-family:${FONT};font-size:20px;line-height:26px;font-weight:800;text-transform:uppercase;color:${inkOf(b.bg)};">${r.T(b.title)}</h3>` : '<div style="height:6px;line-height:6px;font-size:0;">&nbsp;</div>') +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table>`);
  };

  function tierCardHtml(b, r, tk) {
    const s = r.ctx.settings || {};
    const t = (s.tiers || {})[tk] || {};
    const color = TIER_COLORS[tk];
    const all = t.benefits || [];
    const max = Number(b.maxBenefits) || 0;
    const list = max > 0 ? all.slice(0, max) : all;
    const more = all.length - list.length;
    const bullets = list.map((x) => `<tr><td width="20" valign="top" style="padding:5px 0 0 0;">${squareBullet(color, 9)}</td><td valign="top" class="dm-ink" style="padding:0 0 9px 0;font-family:${FONT};font-size:12px;line-height:18px;letter-spacing:0.3px;text-transform:uppercase;color:${C.ink};">${esc(x)}</td></tr>`).join('');
    const badge = b.badge ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${C.pink}"${r.E('badge')} style="background-color:${C.pink};padding:7px 14px;font-family:${FONT};font-size:10px;line-height:12px;font-weight:700;letter-spacing:3px;color:${C.white};text-transform:uppercase;">${r.T(b.badge)}</td></tr></table>` : '';
    return badge +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid ${color};"><tr>` +
      `<td class="stack" width="200" valign="top" bgcolor="${C.black}" style="width:200px;background-color:${C.black};padding:26px 22px 24px 22px;">` +
      `<p style="margin:0 0 8px 0;font-family:${FONT};font-size:15px;line-height:18px;font-weight:700;letter-spacing:5px;text-transform:uppercase;color:${color};">${esc(t.name || tk)}</p>` +
      `<p style="margin:0;font-family:${FONT};font-size:36px;line-height:42px;font-weight:800;color:${C.white};">${esc(money(t.price))}</p>` +
      `<p style="margin:2px 0 0 0;font-family:${FONT};font-size:11px;line-height:16px;letter-spacing:0.5px;color:#BDBBC8;">USD / PER SPONSOR</p>` +
      `<p style="margin:16px 0 0 0;font-family:${FONT};font-size:11px;line-height:16px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:${color};">${esc(t.passes || '')} complimentary guest pass${String(t.passes) === '1' ? '' : 'es'}</p>` +
      `</td>` +
      `<td class="stack dm-card" valign="top" bgcolor="${C.white}" style="background-color:${C.white};padding:24px 24px 14px 24px;">` +
      `<p class="dm-ink" style="margin:0;font-family:${FONT};font-size:16px;line-height:21px;font-weight:800;text-transform:uppercase;color:${C.ink};">The ${esc(t.name || tk)} Sponsorship Package</p>` +
      `<p style="margin:4px 0 0 0;font-family:${FONT};font-size:11px;line-height:16px;letter-spacing:0.5px;text-transform:uppercase;color:${C.grey};">${esc(t.tagline || '')}</p>` +
      (b.showBenefits !== false ? `<p style="margin:16px 0 10px 0;font-family:${FONT};font-size:10px;line-height:12px;font-weight:700;letter-spacing:3px;color:${tk === 'silver' ? '#9A9A9A' : color};">PACKAGE INCLUDES:</p>` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${bullets}</table>` +
        (more > 0 ? `<p style="margin:2px 0 8px 0;font-family:${FONT};font-size:11px;line-height:16px;color:${C.grey};">+ ${more} more benefits in the sponsorship deck</p>` : '') : '') +
      `</td></tr></table>`;
  }

  R.tierCard = (b, r) => {
    const s = r.ctx.settings || {};
    const tk = b.tier === 'lead' ? tierKey(r.ctx.lead && r.ctx.lead.tierInterest) : tierKey(b.tier);
    let upgrades = '';
    if (b.showUpgrades) {
      const others = TIER_ORDER.filter((k) => k !== tk && (s.tiers || {})[k] && TIER_ORDER.indexOf(k) < TIER_ORDER.indexOf(tk)).reverse();
      if (others.length) {
        upgrades = `<p class="dm-muted" style="margin:14px 0 0 0;font-family:${FONT};font-size:12px;line-height:19px;color:${C.grey};">Want more visibility? ` +
          others.map((k) => `<span style="font-weight:700;color:${k === 'silver' ? '#8C8C8C' : TIER_COLORS[k]};">${esc(s.tiers[k].name)}</span> ${esc(money(s.tiers[k].price))}`).join(' &nbsp;·&nbsp; ') + '</p>';
      }
    }
    return sec(b, r, { bg: C.off, pad: '14px 40px 26px 40px', cls: 'px dm-off' }, tierCardHtml(b, r, tk) + upgrades);
  };

  R.comparison = (b, r) => {
    const s = r.ctx.settings || {};
    const rows = s.comparison || [];
    const hl = b.highlight || 'none';
    const head = TIER_ORDER.map((k) => {
      const on = k === hl;
      return `<td align="center" bgcolor="${C.black}" style="background-color:${C.black};padding:12px 4px;font-family:${FONT};font-size:11px;line-height:14px;font-weight:800;letter-spacing:1px;color:${TIER_COLORS[k]};${on ? `border-top:3px solid ${C.pink};` : ''}">${esc(((s.tiers || {})[k] || {}).name || k).toUpperCase()}</td>`;
    }).join('');
    const badgeRow = hl !== 'none' && b.badge ? `<tr><td class="cmp-label">&nbsp;</td>${TIER_ORDER.map((k) => `<td align="center" valign="bottom" style="padding:0 2px 6px 2px;font-family:${FONT};font-size:9px;line-height:12px;font-weight:700;letter-spacing:1.5px;color:${C.pink};text-transform:uppercase;">${k === hl ? r.T(b.badge) : '&nbsp;'}</td>`).join('')}</tr>` : '';
    const body = rows.map((row, i) => {
      const base = i % 2 ? C.off : '#E6E4E0';
      return `<tr><td class="cmp-label dm-row dm-ink" bgcolor="${base}" style="background-color:${base};padding:10px 8px 10px 10px;font-family:${FONT};font-size:10.5px;line-height:14px;font-weight:700;text-transform:uppercase;color:${C.ink};">${esc(row[0])}</td>` +
        TIER_ORDER.map((k, j) => {
          const on = k === hl;
          const bgc = on ? TIER_TINTS[k] : base;
          return `<td align="center" class="${on ? '' : 'dm-row dm-ink'}" bgcolor="${bgc}" style="background-color:${bgc};padding:10px 3px;font-family:${FONT};font-size:11px;line-height:14px;color:${C.ink};${on ? 'font-weight:700;' : ''}">${esc(row[j + 1] == null ? '—' : row[j + 1])}</td>`;
        }).join('') + '</tr>';
    }).join('');
    return sec(b, r, { bg: C.off, pad: '20px 32px 22px 32px', cls: 'px dm-off' },
      (b.title ? `<p${r.E('title')} class="dm-ink" style="margin:0 0 14px 0;font-family:${FONT};font-size:16px;line-height:20px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;color:${C.ink};">${r.T(b.title)}</p>` : '') +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${badgeRow}<tr><td class="cmp-label" bgcolor="${C.black}" style="background-color:${C.black};padding:12px 8px 12px 10px;font-family:${FONT};font-size:10px;line-height:14px;font-weight:700;letter-spacing:1px;color:${C.white};">PACKAGE</td>${head}</tr>${body}</table>` +
      (b.caption ? `<p${r.E('caption')} class="dm-muted" style="margin:12px 0 0 0;font-family:${FONT};font-size:12px;line-height:19px;color:${C.grey};">${r.T(b.caption)}</p>` : ''));
  };

  R.callout = (b, r) => {
    const items = (b.items || []).filter(Boolean).map((it, i) => `<tr><td width="20" valign="top" style="padding:7px 0 0 0;">${squareBullet(C.pink, 8)}</td><td${r.E(`items.${i}`)} style="padding:0 0 8px 0;font-family:${FONT};font-size:14px;line-height:22px;color:${C.soft};">${r.T(it)}</td></tr>`).join('');
    return sec(b, r, { bg: C.off, pad: '10px 40px 26px 40px', cls: 'px dm-off' },
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td width="6" bgcolor="${C.pink}" style="width:6px;background-color:${C.pink};font-size:0;line-height:0;">&nbsp;</td>` +
      `<td bgcolor="${C.black}" style="background-color:${C.black};padding:26px 28px 24px 26px;">` +
      eyebrowP(r, b.eyebrow, 'eyebrow') +
      (b.text ? `<p${r.E('text')} style="margin:0 0 ${items ? 12 : 0}px 0;font-family:${FONT};font-size:15px;line-height:24px;color:${C.white};">${r.T(b.text)}</p>` : '') +
      (items ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table>` : '') +
      `</td></tr></table>`);
  };

  R.cta = (b, r) => {
    const href = actionHref(r, b, 'An Evening on the Water');
    const deck = r.ctx.deckMode === 'link' && !r.deckLinkShown && (r.deckLinkShown = true)
      ? `<p style="margin:14px 0 0 0;font-family:${FONT};font-size:12px;line-height:18px;letter-spacing:1px;text-transform:uppercase;"><a href="${actionHref(r, { action: 'deck' })}" target="_blank" style="color:${C.ink};font-weight:700;text-decoration:none;border-bottom:2px solid ${C.pink};" class="dm-ink">View the sponsorship deck &rarr;</a></p>` : '';
    return sec(b, r, { bg: C.off, pad: '14px 40px 26px 40px', cls: 'px dm-off', align: 'center' },
      button(href, r.data ? merge(b.text, r.data, 'text') : b.text, { width: 280, editField: r.editable ? 'text' : '' }) +
      (b.note ? `<p${r.E('note')} class="dm-muted" style="margin:12px 0 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.grey};">${r.T(b.note)}</p>` : '') + deck);
  };

  R.secondaryCta = (b, r) => {
    const href = actionHref(r, b, 'Let’s meet on the yacht');
    return sec(b, r, { bg: C.off, pad: '0 40px 30px 40px', cls: 'px dm-off', align: 'center' },
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td class="dm-border" style="border:2px solid ${C.ink};padding:13px 24px;">` +
      `<a href="${href}" target="_blank" class="dm-ink" style="font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${C.ink};text-decoration:none;"><span${r.E('text')}>${r.T(b.text)}</span> &rarr;</a>` +
      `</td></tr></table>`);
  };

  R.image = (b, r) => {
    const full = b.full !== false;
    const w = full ? 600 : 520;
    const img = `<img class="fluid" src="${esc(r.asset(b.src))}" width="${w}" alt="${esc(b.alt || '')}" style="display:block;width:100%;max-width:${w}px;height:auto;border:0;">`;
    return sec(b, r, { bg: full ? C.black : C.off, pad: full ? '0' : '12px 40px 18px 40px', cls: full ? '' : 'px dm-off' },
      (b.link ? `<a href="${r.U(b.link)}" target="_blank">${img}</a>` : img) +
      (b.caption ? `<p${r.E('caption')} class="${full ? '' : 'dm-muted'}" style="margin:0;padding:${full ? '10px 40px 12px 40px' : '8px 0 0 0'};font-family:${FONT};font-size:11px;line-height:16px;letter-spacing:1px;text-transform:uppercase;color:${C.grey};background-color:${full ? C.black : 'transparent'};">${r.T(b.caption)}</p>` : ''));
  };

  R.divider = (b, r) => {
    const bg = bgOf(b.bg);
    if (b.style === 'wave') {
      return sec(b, r, { bg, pad: '6px 0', cls: dmClass(b.bg).trim(), style: 'line-height:0;font-size:0;' },
        `<img class="fluid" src="${esc(r.asset('brand:wave-strip.png'))}" width="600" alt="" role="presentation" style="display:block;width:100%;max-width:600px;height:auto;border:0;opacity:0.9;">`);
    }
    if (b.style === 'pink') {
      return sec(b, r, { bg, pad: '18px 40px', cls: 'px' + dmClass(b.bg), align: 'center' },
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="64" height="3" bgcolor="${C.pink}" style="width:64px;height:3px;background-color:${C.pink};font-size:0;line-height:0;">&nbsp;</td></tr></table>`);
    }
    return sec(b, r, { bg, pad: '14px 40px', cls: 'px' + dmClass(b.bg) },
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="${b.bg === 'dark' ? '#26262F' : C.line}" style="height:1px;background-color:${b.bg === 'dark' ? '#26262F' : C.line};font-size:0;line-height:0;">&nbsp;</td></tr></table>`);
  };

  R.spacer = (b, r) => sec(b, r, { bg: bgOf(b.bg), cls: dmClass(b.bg).trim(), style: `height:${Number(b.height) || 24}px;line-height:${Number(b.height) || 24}px;font-size:0;` }, '&nbsp;');

  function memberHref(m) {
    const pref = m.linkTo || 'linkedin';
    const wa = m.whatsapp ? (/^https?:/i.test(m.whatsapp) ? m.whatsapp : `https://wa.me/${digits(m.whatsapp)}`) : '';
    const li = m.linkedin || '';
    if (pref === 'whatsapp' && wa) return wa;
    if (pref === 'linkedin' && li) return li;
    return li || wa || (m.email ? `mailto:${m.email}` : '');
  }

  /** Split into rows of at most `max`, keeping rows balanced (9 with max 5 -> 4 + 5). */
  function balancedRows(list, max) {
    const rows = Math.ceil(list.length / max);
    const base = Math.floor(list.length / rows);
    const extra = list.length % rows;
    const out = [];
    let i = 0;
    for (let k = 0; k < rows; k++) { const n = base + (k >= rows - extra ? 1 : 0); out.push(list.slice(i, i + n)); i += n; }
    return out;
  }

  R.team = (b, r) => {
    const all = (r.ctx.team || []).filter((m) => m.show !== false && (!b.members || b.members.includes(m.id)));
    const small = b.size !== 'medium';
    const hover = b.labels === 'hover';
    const px = small ? 44 : 56;
    const cellW = small ? 84 : 124;
    const perRow = Math.max(2, Math.min(6, Number(b.perRow) || (small ? 5 : 4)));
    const groups = [];
    if (b.showManagement !== false) groups.push(['MANAGEMENT', all.filter((m) => (m.group || 'management') === 'management')]);
    if (b.showSales !== false) groups.push(['SALES TEAM', all.filter((m) => m.group === 'sales')]);
    const cell = (m) => {
      const href = memberHref(m);
      const via = /wa\.me|whatsapp/i.test(href) ? 'WhatsApp' : /linkedin/i.test(href) ? 'LinkedIn' : href.startsWith('mailto:') ? 'Email' : '';
      const title = [m.name, m.role].filter(Boolean).join(' · ');
      const pic = circle(r, { photo: m.photo, name: m.name, size: px, href: href ? esc(href) : '', title });
      if (!hover) {
        return `<td class="team-cell${small ? ' team-cell-s' : ''}" align="center" valign="top" width="${cellW}" style="width:${cellW}px;padding:0 4px 14px 4px;">` + pic +
          `<p class="dm-ink" style="margin:8px 0 1px 0;font-family:${FONT};font-size:${small ? 11 : 13}px;line-height:${small ? 14 : 17}px;font-weight:700;color:${C.ink};text-align:center;">${esc(m.name)}</p>` +
          `<p style="margin:0;font-family:${FONT};font-size:${small ? 8.5 : 10}px;line-height:${small ? 12 : 14}px;letter-spacing:1px;text-transform:uppercase;color:${C.grey};text-align:center;">${esc(m.role || '')}</p></td>`;
      }
      // Hover card, absolutely positioned where supported. Clients without hover keep the photo and its native tooltip.
      return `<td class="team-cell tm${small ? ' team-cell-s' : ''}" align="center" valign="top" width="${cellW}" style="width:${cellW}px;padding:0 4px 12px 4px;position:relative;">` + pic +
        `<div class="tt" style="display:none;position:absolute;left:-34px;right:-34px;top:${px + 10}px;z-index:20;background-color:#111118;border:1px solid ${C.pink};border-radius:6px;padding:8px 8px 9px 8px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,0.35);">` +
        `<p class="tt-name" style="margin:0;font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;color:${C.white};text-align:center;">${esc(m.name)}</p>` +
        (m.role ? `<p class="tt-role" style="margin:2px 0 0 0;font-family:${FONT};font-size:9px;line-height:13px;letter-spacing:1px;text-transform:uppercase;color:#B9B7C8;text-align:center;">${esc(m.role)}</p>` : '') +
        (via ? `<p class="tt-link" style="margin:5px 0 0 0;font-family:${FONT};font-size:9px;line-height:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.pink};text-align:center;">${via} &rarr;</p>` : '') +
        `</div></td>`;
    };
    const rows = groups.filter(([, list]) => list.length).map(([label, list]) =>
      `<p class="dm-muted" style="margin:${small ? 20 : 24}px 0 ${small ? 12 : 14}px 0;font-family:${FONT};font-size:10px;line-height:12px;font-weight:700;letter-spacing:4px;color:${C.grey};text-align:center;">${label}</p>` +
      balancedRows(list, perRow).map((row) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>${row.map(cell).join('')}</tr></table>`).join('')
    ).join('');
    return sec(b, r, { bg: C.off, pad: '34px 30px 18px 30px', cls: 'px dm-off', align: 'center' },
      `<p${r.E('heading')} class="dm-ink" style="margin:0;font-family:${FONT};font-size:18px;line-height:24px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${C.ink};text-align:center;">${r.T(b.heading)}</p>` +
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:12px auto 0 auto;"><tr><td width="56" height="3" bgcolor="${C.pink}" style="width:56px;height:3px;background-color:${C.pink};font-size:0;line-height:0;">&nbsp;</td></tr></table>` +
      (rows || `<p class="dm-muted" style="margin:18px 0 0 0;font-family:${FONT};font-size:12px;color:${C.grey};text-align:center;">Add team members in the Team tab.</p>`));
  };

  function sigLine(r, icon, href, text) {
    if (!text) return '';
    return `<tr><td width="26" valign="middle" style="padding:0 0 9px 0;"><img src="${esc(r.asset(icon))}" width="20" height="20" alt="" role="presentation" style="display:block;width:20px;height:20px;border:0;"></td>` +
      `<td valign="middle" style="padding:0 0 9px 6px;font-family:${FONT};font-size:13px;line-height:18px;"><a href="${href}" target="_blank" style="color:${C.soft};text-decoration:none;word-break:break-all;">${esc(text)}</a></td></tr>`;
  }

  R.signature = (b, r) => {
    const sig = r.ctx.signature || {};
    const s = r.ctx.settings || {};
    const snd = senderFrom(r.ctx);
    const ticket = sig.ticketLink || (s.event && s.event.ticketLink) || '';
    const deckHref = actionHref(r, { action: 'deck' });
    const lines =
      sigLine(r, 'brand:icon-phone.png', esc('tel:+' + digits(snd.phone)), snd.phone) +
      sigLine(r, 'brand:icon-email.png', esc('mailto:' + snd.email), snd.email) +
      sigLine(r, 'brand:icon-web.png', esc(sig.website || ''), (sig.website || '').replace(/^https?:\/\//, '').replace(/\/$/, '')) +
      sigLine(r, 'brand:icon-ticket.png', esc(ticket), ticket ? (sig.ticketLabel || 'Get your event ticket') : '');
    const logos = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td valign="middle" style="padding:0 18px 0 0;"><img src="${esc(r.asset('brand:logo-paradigia-white.png'))}" width="96" height="22" alt="Paradigia" style="display:block;width:96px;height:auto;border:0;"></td>` +
      `<td valign="middle" style="padding:0 18px 0 0;border-left:1px solid #2E2E38;padding-left:18px;"><img src="${esc(r.asset('brand:logo-mobihub-white.png'))}" width="86" height="16" alt="mobi hub | events" style="display:block;width:86px;height:auto;border:0;"></td>` +
      `<td valign="middle" style="border-left:1px solid #2E2E38;padding-left:18px;"><img src="${esc(r.asset('brand:logo-sunstrike.png'))}" width="50" height="26" alt="Sunstrike" style="display:block;width:50px;height:auto;border:0;"></td>` +
      `</tr></table>`;
    return sec(b, r, { bg: C.black, pad: '36px 40px 30px 40px', cls: 'px' },
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td class="sig-photo" width="96" valign="top" style="width:96px;padding:2px 0 0 0;">${circle(r, { photo: sig.photo, name: snd.name, size: 72 })}</td>` +
      `<td valign="top" style="padding:0 0 0 4px;">` +
      `<p style="margin:0;font-family:${FONT};font-size:19px;line-height:24px;font-weight:700;color:${C.white};">${esc(snd.name)}</p>` +
      `<p style="margin:3px 0 0 0;font-family:${FONT};font-size:11px;line-height:16px;letter-spacing:2.5px;text-transform:uppercase;color:#9A98AC;">${esc(snd.title)}</p>` +
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 14px 0;"><tr><td width="44" height="2" bgcolor="${C.pink}" style="width:44px;height:2px;background-color:${C.pink};font-size:0;line-height:0;">&nbsp;</td></tr></table>` +
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0">${lines}</table>` +
      `</td></tr></table>` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 18px 0;"><tr><td height="1" bgcolor="#24242C" style="height:1px;background-color:#24242C;font-size:0;line-height:0;">&nbsp;</td></tr></table>` +
      logos +
      `<p style="margin:16px 0 6px 0;font-family:${FONT};font-size:10.5px;line-height:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${C.white};">${esc(sig.tagline || 'AN EVENING ON THE WATER — DUBAI MARINA YACHT NETWORKING PARTY')}</p>` +
      (sig.showDeckLink !== false ? `<p style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;"><a href="${deckHref}" target="_blank" style="color:${C.pink};font-weight:600;text-decoration:underline;">Download Sponsorship Deck</a></p>` : '') +
      (sig.confidentiality ? `<p style="margin:18px 0 0 0;font-family:${FONT};font-size:10px;line-height:15px;color:#6B6A78;">${esc(sig.confidentiality)}</p>` : ''));
  };

  R.footer = (b, r) => {
    const s = r.ctx.settings || {};
    const ev = s.event || {};
    const snd = senderFrom(r.ctx);
    const u = s.unsubscribe || {};
    const unsub = u.mode === 'url' && u.url ? esc(u.url) : esc(`mailto:${snd.email}?subject=${encodeURIComponent('Unsubscribe')}&body=${encodeURIComponent('Please remove me from future emails about this event.')}`);
    return sec(b, r, { bg: C.night, pad: '28px 40px 34px 40px', cls: 'px', align: 'center' },
      `<p style="margin:0 0 8px 0;font-family:${FONT};font-size:10px;line-height:14px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#A4A2B6;text-align:center;">${esc(ev.name || 'An Evening on the Water')}</p>` +
      `<p style="margin:0 0 14px 0;font-family:${FONT};font-size:11px;line-height:18px;color:#8C8A9C;text-align:center;">${esc(ev.footerLine1 || 'December 9, 2026 · Gathering from 7:00 PM · Event 9:00 PM – 1:00 AM')}<br>${esc(ev.footerLine2 || 'Aboard a private yacht, Dubai Marina · 400-guest capacity')}</p>` +
      `<p style="margin:0;font-family:${FONT};font-size:10.5px;line-height:17px;color:#6B6A78;text-align:center;"><span${r.E('note')}>${r.T(b.note || '')}</span> <a href="${unsub}" target="_blank" style="color:#A4A2B6;text-decoration:underline;">${esc(u.text || 'Unsubscribe')}</a></p>`);
  };

  /* ------------------------------------------------------------ document */

  const DM_RULES = `
    .dm-body,.dm-outer{background-color:#07070B!important;}
    .dm-off{background-color:#121218!important;background-image:none!important;}
    .dm-card{background-color:#1B1B24!important;}
    .dm-row{background-color:#1A1A22!important;}
    .dm-ink,.dm-ink p,.dm-ink li,.dm-ink strong,.dm-ink a{color:#ECEBE8!important;}
    .dm-muted{color:#A7A6B5!important;}
    .dm-border{border-color:#ECEBE8!important;}
    .tm .tt .tt-name{color:#ECEBE8!important;}`;

  function docShell(inner, o) {
    const pre = o.preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:${C.night};">${esc(o.preheader)}${'&#8199;&#847; '.repeat(70)}</div>` : '';
    const ogsc = DM_RULES.replace(/\.dm-/g, '[data-ogsc] .dm-').replace(/\[data-ogsc\] \.dm-(off|card|row|body|outer)/g, '[data-ogsb] .dm-$1');
    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(o.title || '')}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><style>table,td,p,a,h1,h2,h3{font-family:Arial,Helvetica,sans-serif!important;}</style><![endif]-->
<!--[if !mso]><!--><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet"><!--<![endif]-->
<style type="text/css">
  :root{color-scheme:light dark;supported-color-schemes:light dark;}
  body{margin:0!important;padding:0!important;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table,td{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}
  img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;}
  a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;}
  .tm:hover .tt{display:block!important;}
  u + #body a{color:inherit;text-decoration:none;}
  @media screen and (max-width:620px){
    .container{width:100%!important;max-width:100%!important;}
    .px{padding-left:20px!important;padding-right:20px!important;}
    .stack{display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box;}
    .fluid{width:100%!important;height:auto!important;}
    .h1{font-size:28px!important;line-height:34px!important;}
    .logo-p{width:104px!important;}
    .logo-m{width:84px!important;}
    .logo-s{width:48px!important;}
    .team-cell{width:110px!important;}
    .team-cell-s{width:62px!important;padding-left:2px!important;padding-right:2px!important;}
    .tm .tt{display:block!important;position:static!important;background-color:transparent!important;border:0!important;box-shadow:none!important;padding:5px 0 0 0!important;}
    .tm .tt .tt-name{color:#1C1C1C!important;font-size:10px!important;line-height:13px!important;}
    .tm .tt .tt-role,.tm .tt .tt-link{display:none!important;}
    .sig-photo{width:84px!important;}
    .cmp-label{font-size:9px!important;padding-left:6px!important;}
  }
  @media (prefers-color-scheme: dark){${DM_RULES}}
  ${ogsc}
  ${o.forceDark ? DM_RULES : ''}
  ${o.extraCss || ''}
</style>
</head>
<body id="body" class="dm-body" style="margin:0;padding:0;background-color:${C.night};word-spacing:normal;">
${pre}
<div role="article" aria-roledescription="email" aria-label="${esc(o.title || '')}" lang="en" style="background-color:${C.night};" class="dm-outer">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.night}" class="dm-outer" style="background-color:${C.night};">
<tr><td align="center" style="padding:${o.mobile ? '0' : '24px 0'};">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" align="center" style="width:600px;max-width:600px;margin:0 auto;background-color:${C.off};">
${inner}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</div>
</body>
</html>`;
  }

  /**
   * Render a full email.
   * doc: { subject, preheader, blocks }
   * ctx: { settings, team, signature, account, lead, deckMode, asset(ref), editable, resolve, forceDark, extraCss }
   */
  function renderEmail(doc, ctx) {
    const r = makeR(ctx);
    const blocks = (doc && doc.blocks) || [];
    // In "link" mode the first CTA gets a "View the sponsorship deck" line; the signature always carries one too.
    const inner = blocks.map((b) => (R[b.type] ? R[b.type]({ ...BLOCKS[b.type].defaults, ...b }, r) : '')).join('\n');
    const subject = r.data ? merge(doc.subject || '', r.data, 'text') : (doc.subject || '');
    const preheader = r.data ? merge(doc.preheader || '', r.data, 'text') : (doc.preheader || '');
    const html = docShell(inner, { title: subject, preheader, forceDark: ctx.forceDark, extraCss: ctx.extraCss, mobile: ctx.mobile });
    return { html, subject, preheader, assets: Array.from(r.used) };
  }

  /** Plain-text alternative built from blocks (better than scraping HTML). */
  function renderText(doc, ctx) {
    const r = makeR({ ...ctx, editable: false });
    const d = r.data;
    const M = (s) => (d ? merge(s || '', d, 'text') : (s || ''));
    const s = ctx.settings || {};
    const snd = senderFrom(ctx);
    const out = [];
    for (const raw of (doc.blocks || [])) {
      const b = { ...(BLOCKS[raw.type] || {}).defaults, ...raw };
      switch (b.type) {
        case 'hero': out.push(`${M(b.eyebrow)}\n${M(b.headline)}\n${M(b.dateLine)}`); break;
        case 'heading': out.push(`${M(b.eyebrow)}\n${M(b.title)}`.trim()); break;
        case 'text': out.push(htmlToText(M(b.html))); break;
        case 'benefits': out.push([M(b.eyebrow), M(b.title)].filter(Boolean).join('\n') + '\n' + (b.items || []).map((it) => typeof it === 'string' ? `- ${M(it)}` : `- ${[M(it.title), M(it.text)].filter(Boolean).join(': ')}`).join('\n')); break;
        case 'tierCard': {
          const tk = b.tier === 'lead' ? tierKey(ctx.lead && ctx.lead.tierInterest) : tierKey(b.tier);
          const t = (s.tiers || {})[tk] || {};
          out.push(`${(t.name || tk).toUpperCase()} — ${money(t.price)} USD (${t.passes} guest passes)\n` + (t.benefits || []).map((x) => `- ${x}`).join('\n'));
          break;
        }
        case 'comparison': out.push(TIER_ORDER.map((k) => { const t = (s.tiers || {})[k] || {}; return `${t.name}: ${money(t.price)} · ${t.passes} passes`; }).join('\n')); break;
        case 'callout': out.push(`${M(b.eyebrow)}\n${M(b.text)}`); break;
        case 'cta': case 'secondaryCta': {
          const href = actionHref(r, b, '').replace(/&amp;/g, '&');
          out.push(`${M(b.text)}: ${href}`);
          break;
        }
        case 'team': out.push('MEET THE TEAM\n' + (ctx.team || []).filter((m) => m.show !== false).map((m) => `${m.name}, ${m.role}`).join('\n')); break;
        case 'signature': {
          const sig = ctx.signature || {};
          out.push(['--', snd.name, snd.title, snd.phone, snd.email, sig.website, sig.ticketLink || (s.event && s.event.ticketLink)].filter(Boolean).join('\n'));
          break;
        }
        case 'footer': out.push(`${M(b.note)}\nUnsubscribe: reply with "unsubscribe".`); break;
        default: break;
      }
    }
    return out.filter((x) => x && x.trim()).join('\n\n');
  }

  /** Words in the personal body copy (text blocks only), as per the copy guidelines. */
  function bodyWords(doc) {
    return (doc.blocks || []).filter((b) => b.type === 'text').reduce((n, b) => n + wordCount(htmlToText(b.html || '')), 0);
  }

  /** Pre-send checks. Returns [{level:'warn'|'block', msg}] */
  function preflight(doc, ctx) {
    const out = [];
    const blocks = doc.blocks || [];
    const s = ctx.settings || {};
    const text = renderText(doc, ctx) + ' ' + (doc.subject || '');
    const ph = text.match(/\[[A-Z][A-Z0-9 /&-]{2,}\]/g);
    if (ph) out.push({ level: 'warn', msg: `Unfilled placeholder${ph.length > 1 ? 's' : ''}: ${Array.from(new Set(ph)).join(', ')}` });
    if (blocks.some((b) => b.type === 'team') && (ctx.team || []).some((m) => m.show !== false && m.placeholder)) out.push({ level: 'warn', msg: 'Meet the Team shows placeholder members. Edit or hide them in the Team tab.' });
    if (!doc.subject) out.push({ level: 'block', msg: 'Subject line is empty.' });
    const noRole = (ctx.team || []).filter((m) => m.show !== false && !m.role).map((m) => m.name);
    if (blocks.some((b) => b.type === 'team') && noRole.length) out.push({ level: 'info', msg: `No role yet for ${noRole.join(', ')} (Team tab).` });
    const sigEmail = String((ctx.signature || {}).email || '').toLowerCase();
    if (ctx.account && ctx.account.email && blocks.some((b) => b.type === 'signature') && sigEmail && sigEmail !== ctx.account.email.toLowerCase()) out.push({ level: 'warn', msg: `The signature shows ${sigEmail} but you are sending from ${ctx.account.email}. Pick or create a matching signature (Signatures tab).` });
    if (!blocks.some((b) => b.type === 'footer')) out.push({ level: 'warn', msg: 'No footer block, so there is no unsubscribe link.' });
    const words = bodyWords(doc);
    if (words > 130) out.push({ level: 'warn', msg: `Body copy is ${words} words (guideline: under 130).` });
    if (blocks.some((b) => b.type === 'signature') && (!s.deck || !s.deck.hostedUrl)) out.push({ level: 'info', msg: '“Download Sponsorship Deck” falls back to a reply-by-email link until you add a hosted deck URL in Settings.' });
    if (/\{\{\s*spots_left/.test(JSON.stringify(doc)) && !(s.event && s.event.spotsLeft)) out.push({ level: 'warn', msg: 'Uses {{spots_left}} but “Spots left” is empty in Settings.' });
    return out;
  }

  /** Short message versions (WhatsApp / LinkedIn) with merge fields filled. */
  function shortText(str, lead, ctx) { return merge(str || '', mergeData(lead, ctx), 'text'); }

  return {
    C, TIER_COLORS, TIER_ORDER, STATUSES, MERGE_FIELDS, BLOCKS, FONT,
    esc, merge, mergeData, htmlToText, wordCount, bodyWords, renderEmail, renderText, preflight, shortText, tierKey, money,
  };
});
