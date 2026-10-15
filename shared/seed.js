/*
 * Paradigia Outreach Studio: default content.
 * Tier data and event facts come from "Paradigia Networking Night Sponsorships" (the deck).
 * Shared by server (first run) and browser ("reset step to default").
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PSeed = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let n = 0;
  const B = (type, props) => ({ id: 'b' + (++n).toString(36) + Math.random().toString(36).slice(2, 6), type, ...(props || {}) });

  const TICKET = 'https://www.tickettailor.com/events/paradigia/2440690';

  function settings() {
    return {
      event: {
        name: 'An Evening on the Water',
        dateLabel: 'December 9, 2026',
        date: '2026-12-09',
        location: 'Dubai Marina',
        ticketLink: TICKET,
        spotsLeft: '',
        promoCode: 'DeepakEB',
        footerLine1: 'December 9, 2026 · Begins 7:00 PM with networking · Until 1:00 AM',
        footerLine2: 'Aboard a private yacht, Dubai Marina · 400-guest capacity',
      },
      // Logos in the email header (hosts) and footer (sponsors). ratio = logo width / height.
      brands: {
        hosts: [
          { name: 'Mobi Hub Events', logo: 'brand:logo-mobihub-white.png', ratio: 5.306 },
          { name: 'Paradigia', logo: 'brand:logo-paradigia-white.png', ratio: 4.298 },
        ],
        sponsorsLabel: 'Sponsored by',
        sponsors: [
          { name: 'Sago', logo: 'brand:logo-sago.png', ratio: 2.459 },
          { name: 'Sunstrike', logo: 'brand:logo-sunstrike-tile.png', ratio: 1.912 },
          { name: 'Repocket', logo: 'brand:logo-repocket.png', ratio: 5.5 },
        ],
      },
      tiers: {
        premium: {
          name: 'Premium', price: 18000, passes: '7', tagline: 'Top-tier positioning and maximum visibility',
          benefits: [
            'Full marketing & advertising across all event materials',
            'Dedicated speaking slot during the event',
            'Logo on welcome banner (primary) with QR code',
            'Prominent signage at entrance & main reception area',
            'DJ shoutout during the night',
            'Post-event attendee contact list for lead follow-up',
            'Logo across all digital promo (event page, invites, social)',
            'Formal introductions between your company and other sponsors & attendees',
            'Branded leaflets & business cards on all tables',
            'Dedicated mention during welcome speech',
            'Reserved premium seating & lounge area',
            'Logo on main media wall',
          ],
        },
        gold: {
          name: 'Gold', price: 10000, passes: '5–6', tagline: 'High visibility and strong brand presence',
          benefits: [
            'Logo on welcome banner (secondary placement) with QR code',
            'Leaflets on tables (shared placement with other Gold sponsors)',
            'DJ shoutout during the night',
            'Logo on main media wall',
            'Mention during welcome speech',
            'Signage at one designated area (e.g. bar or lounge)',
            'Logo on digital promo materials',
          ],
        },
        silver: {
          name: 'Silver', price: 6000, passes: '3–4', tagline: 'Solid brand exposure',
          benefits: [
            'Logo on welcome banner (smaller placement)',
            'Company leaflets at a shared info table',
            'DJ shoutout during the night',
            'Logo included in social media event posts',
            'Logo on main media wall',
          ],
        },
        bronze: {
          name: 'Bronze', price: 3000, passes: '2', tagline: 'Entry-level event presence',
          benefits: [
            'Logo on main media wall',
            'Logo included in social media event posts',
            'DJ shoutout during the night',
          ],
        },
      },
      comparison: [
        ['Price (USD)', '$18,000', '$10,000', '$6,000', '$3,000'],
        ['Guest passes', '7', '5–6', '3–4', '2'],
        ['Welcome banner logo', 'Primary + QR', 'Secondary + QR', 'Small logo', '—'],
        ['Media wall logo', 'Included', 'Included', 'Included', 'Included'],
        ['Table leaflets / cards', 'All tables', 'Shared placement', 'Shared info table', '—'],
        ['Speech mention', 'Dedicated', 'Included', '—', '—'],
        ['Speaking slot', 'Yes', '—', '—', '—'],
        ['Company introductions', 'Yes', '—', '—', '—'],
        ['Post-event attendee list', 'Yes', '—', '—', '—'],
        ['Digital / social promo', 'Full', 'Included', 'Included', 'Included'],
      ],
      sending: {
        timezone: 'Asia/Dubai', windowStart: '09:00', windowEnd: '19:00', gapSeconds: 75,
        skipWeekends: true, weekendDays: [0, 6], syncMinutes: 3, defaultDailyLimit: 60, autoReplyPauses: false,
      },
      deck: { upload: 'seed:Paradigia-Sponsorship-Deck.pdf', fileName: 'Paradigia-Sponsorship-Deck.pdf', size: 0, hostedUrl: '' },
      unsubscribe: { mode: 'mailto', url: '', text: 'Unsubscribe' },
      publicAssetBase: '',
      talkFormUrl: '',
      testEmail: '',
    };
  }

  // Names, roles and links for the website team come from circulartechawards.com ("Meet the team").
  const CTA_IMG = 'https://www.circulartechawards.com/wp-content/uploads/';
  function team() {
    const m = (id, name, role, group, photo, extra) => ({ id, name, role, group, photo, email: '', phone: '', whatsapp: '', linkedin: '', linkTo: 'linkedin', show: true, ...(extra || {}) });
    return [
      m('tm-moheb', 'Moheb Pirzada', 'CEO', 'management', CTA_IMG + '2-2-150x150.png', { linkedin: 'https://www.linkedin.com/in/moheb-pirzada-b39a41143/' }),
      m('tm-naz', 'Naz Pirzada', 'Co-Founder', 'management', 'brand:team-naz.jpg', { linkedin: 'https://www.linkedin.com/in/naz-pirzada/' }),
      m('tm-roxy', 'Roxy Khan', 'Head of Events', 'management', 'brand:team-roxy-khan.jpg', { email: 'roxy@mobi-hub.com', phone: '+971 56 798 1463', whatsapp: '+971567981463', linkedin: 'https://www.linkedin.com/in/roxy-khan-029995131/', linkTo: 'whatsapp' }),
      m('tm-james', 'Josh Thompson', 'Head of Marketing', 'management', CTA_IMG + '4-1-150x150.png', { linkedin: 'https://www.linkedin.com/in/joshua-james-thompson/' }),
      // Sales: first row Yiannis, Dominic, Noura, Aniket; second row Adile, Sameer, Diana, Anastasia, Deepak.
      m('tm-yiannis', 'Yiannis Sumner', 'Marketing Executive', 'sales', CTA_IMG + '8-1-150x150.png', { linkedin: 'https://www.linkedin.com/in/yianni-sumner-585388202/' }),
      m('tm-dominic', 'Dominic Wesely', 'Circular Tech Hub, GITEX Berlin', 'sales', 'brand:team-dominic.jpg', { linkedin: 'https://www.linkedin.com/in/dominik-wesely-0b294a16a/' }),
      m('tm-noura', 'Noura Fazaz', 'Business Development Manager', 'sales', 'brand:team-noura.jpg', { whatsapp: '+447454573632', linkTo: 'whatsapp' }),
      m('tm-aniket', 'Aniket Kumar', 'Sales Manager (Asia)', 'sales', CTA_IMG + '6-1-150x150.png', { linkedin: 'https://www.linkedin.com/in/aniket-kumar-315648166/' }),
      m('tm-adile', 'Adile Gashi', 'Sales Executive', 'sales', 'brand:team-adile.jpg', { linkedin: 'https://www.linkedin.com/in/adilegashi/' }),
      m('tm-sameer', 'Sameer Khan', 'International B2B Sales & Events', 'sales', 'brand:team-sameer.jpg', { linkedin: 'https://www.linkedin.com/in/sameer-khan-69877525b/' }),
      m('tm-diana', 'Diana Zubovich', 'International Sales & Business Development', 'sales', 'brand:team-diana.jpg', { linkedin: 'https://www.linkedin.com/in/diana-zubovich-b99410418/' }),
      m('tm-anastasia', 'Anastasiya Zhur', 'International Sales & Business Development', 'sales', 'brand:team-anastasia.jpg', { linkedin: 'https://www.linkedin.com/in/anastasiya-zhur-8aa393426/' }),
      m('tm-deepak', 'Deepak Kumar', '', 'sales', 'brand:team-deepak.jpg', { linkedin: 'https://www.linkedin.com/in/deepak-kumar-mobi-hub/' }),
    ];
  }

  // The first signature is the default. An empty email means "use the Gmail address you send from".
  function signatures() {
    const common = {
      website: 'https://www.mobi-hub.com', ticketLink: TICKET, ticketLabel: 'Get your event ticket',
      tagline: 'AN EVENING ON THE WATER — DUBAI MARINA YACHT NETWORKING PARTY', showDeckLink: true,
      confidentiality: 'This email and any attachments are confidential and intended solely for the addressee. If you have received it in error, please notify the sender and delete it.',
      accountEmail: '',
    };
    return [
      { ...common, id: 'sig-deepak', label: 'Deepak', name: 'Deepak', title: '', photo: 'brand:team-deepak.jpg', phone: '', whatsapp: '', email: '' },
      { ...common, id: 'sig-roxy', label: 'Roxy Khan', name: 'Roxy Khan', title: 'Head of Events', photo: 'brand:team-roxy-khan.jpg', phone: '+971 56 798 1463', whatsapp: '+971567981463', email: 'roxy@mobi-hub.com' },
    ];
  }

  const why = () => B('callout', { eyebrow: 'WHY PARTNER WITH US', text: 'Curated audience, direct introductions, multi-channel visibility, and a memorable setting people talk about long after the night ends.', items: [] });
  const sig = () => B('signature', {});
  const foot = () => B('footer', { note: 'You’re receiving this because we believe An Evening on the Water is relevant to {{company}}.' });
  const head = () => B('header', {});
  const meet = (heading) => B('team', { heading: heading || 'MEET THE TEAM AT THE EVENT', showManagement: true, showSales: true });
  // "Let's talk" opens a pre-filled email (or your form link) so the lead sends you their details.
  const yachtTalk = (ticketButton) => B('secondaryCta', { text: 'Meet me on the yacht, let’s talk', action: 'talk', ticketButton: !!ticketButton, ticketText: 'Buy Ticket', waText: 'Hi {{sender_first_name}}, it’s {{first_name}} from {{company}}. Let’s talk about An Evening on the Water.' });
  const reserve = (subject, text) => B('cta', { text: text || 'Reserve My Spot', action: 'reply', replySubject: subject || 'Reserve Bronze for {{company}}', note: '' });
  const tickets = (text) => B('cta', { text: text || 'Get Tickets', action: 'tickets', note: '' });

  function step(o) {
    return {
      id: 's' + (++n).toString(36) + Math.random().toString(36).slice(2, 6),
      name: o.name, delayDays: o.delayDays || 0, fixedDate: o.fixedDate || '', sendTime: o.sendTime || '10:00',
      threadReply: !!o.threadReply, subjects: o.subjects, subjectIndex: 0, abTest: false,
      preheader: o.preheader, blocks: o.blocks, deck: o.deck || 'inherit',
      whatsapp: o.whatsapp || '', linkedin: o.linkedin || '',
    };
  }

  /** The original five sequences (Bronze and Premium/Gold were separate). Kept as templates. */
  function originalSequences() {
    return [
      {
        id: 'seq-bronze', name: 'Bronze Sponsor Push', audience: 'Warm clients', color: '#B78B63', deckChoice: 'attach',
        description: 'Four touches over two weeks that move warm contacts to a $3,000 Bronze partnership.',
        steps: [
          step({
            name: 'Day 0 · Warm intro', delayDays: 0, sendTime: '10:00',
            subjects: ['{{first_name}}, a spot for {{company}} on the yacht?', 'Dec 9, Dubai Marina: founders, investors, one yacht', 'A warm intro and a simple idea for {{company}}'],
            preheader: 'Bronze partnership: 2 guest passes, media-wall logo and a DJ shoutout during the night.',
            blocks: [
              head(),
              B('hero', { eyebrow: 'SPONSORSHIP OPPORTUNITIES', headline: 'AN EVENING ON THE WATER', dateLine: 'DECEMBER 9 2026 • DUBAI MARINA • 7:00 PM – 1:00 AM', image: 'brand:hero-yacht.jpg', alt: 'The yacht lit up at night in Dubai Marina' }),
              B('text', { html: '<p>Hi {{first_name}},</p><p>I’m {{sender_name}} from Paradigia. On December 9 we’re hosting <strong>An Evening on the Water</strong>, a private-yacht networking night in Dubai Marina for founders, investors and industry leaders.</p><p>I’d love to have {{company}} on board as a <strong>Bronze partner</strong>. For $3,000 you get 2 guest passes, your logo on the main media wall and across our social posts, and a DJ shoutout during the night. There’s also a mini stage where partner companies get their moment.</p><p>Above all, it’s a room where you meet the right people face to face. Shall I hold a Bronze spot for you?</p>' }),
              B('tierCard', { tier: 'bronze', badge: 'BEST ENTRY POINT', showBenefits: true, showUpgrades: true }),
              why(),
              reserve('Reserve Bronze for {{company}}'),
              yachtTalk(true),
              meet(),
              sig(),
              foot(),
            ],
            whatsapp: 'Hi {{first_name}}, it’s {{sender_first_name}} from Paradigia. On Dec 9 we’re hosting An Evening on the Water, a private-yacht networking night in Dubai Marina with founders, investors and industry leaders. Bronze partnership is $3,000: 2 guest passes, your logo on the media wall and socials, and a DJ shoutout during the night. Shall I hold a spot for {{company}}?',
            linkedin: 'Hi {{first_name}}, I’m hosting An Evening on the Water on Dec 9, a private-yacht networking night in Dubai Marina for founders, investors and industry leaders. I think {{company}} would be a great Bronze partner ($3,000, 2 guest passes, media wall + DJ shoutout). Open to a quick chat?',
          }),
          step({
            name: 'Day 4 · Benefits follow-up', delayDays: 4, sendTime: '10:30', threadReply: true,
            subjects: ['What Bronze gets {{company}} on Dec 9', 'Your logo, a DJ shoutout and 2 seats on the yacht', 'Quick follow-up, {{first_name}}'],
            preheader: 'Four simple benefits, one memorable night in Dubai Marina.',
            blocks: [
              head(),
              B('text', { html: '<p>Hi {{first_name}},</p><p>Following up on my note about An Evening on the Water. Here’s exactly what Bronze gives {{company}} for $3,000:</p>' }),
              B('benefits', { eyebrow: 'BRONZE INCLUDES', title: '', bullet: 'pink', items: [
                { title: '2 complimentary guest passes', text: 'Bring a colleague or a client you want to impress.' },
                { title: 'Logo on the main media wall', text: 'In the photos everyone takes and shares on the night.' },
                { title: 'Logo in our social media posts', text: 'Before, during and after the event.' },
                { title: 'DJ shoutout during the night', text: 'Your company name, heard across the yacht.' },
              ] }),
              B('text', { pad: 's', html: '<p>Founders and investors are looking for curated, high-trust rooms. This is one of them, and Bronze is the easiest way in. Would you like me to hold a spot?</p>' }),
              reserve('Reserve Bronze for {{company}}'),
              sig(),
              foot(),
            ],
            whatsapp: 'Hi {{first_name}}, quick follow-up on An Evening on the Water (Dec 9, Dubai Marina). Bronze is $3,000 and includes 2 guest passes, your logo on the media wall and our socials, and a DJ shoutout during the night. Want me to hold one for {{company}}?',
            linkedin: 'Hi {{first_name}}, following up on Dec 9. Bronze ($3,000) gives {{company}} 2 guest passes, media-wall and social logo placement, and DJ shoutouts during the night. Happy to hold a spot if useful.',
          }),
          step({
            name: 'Day 9 · Last call', delayDays: 5, sendTime: '11:00', threadReply: true,
            subjects: ['Last call for Bronze, {{first_name}}', 'Closing Bronze partner spots soon', 'Should I release {{company}}’s spot?'],
            preheader: 'Allocation is closing. Happy to hold one for you for a few more days.',
            blocks: [
              head(),
              B('text', { html: '<p>Hi {{first_name}},</p><p>We’re finalising partner allocation for December 9, so I wanted to check in once more before I offer the remaining Bronze spots to others.</p><p>For $3,000, {{company}} gets 2 guest passes, your logo on the media wall and socials, and a DJ shoutout during the night. If you’d like more presence, Silver ($6K), Gold ($10K) and Premium ($18K) are open too.</p><p>A simple “yes” is enough and I’ll handle the rest.</p>' }),
              B('tierCard', { tier: 'bronze', badge: 'BEST ENTRY POINT', showBenefits: true, showUpgrades: true }),
              reserve('Yes, reserve Bronze for {{company}}', 'Reserve My Spot'),
              sig(),
              foot(),
            ],
            whatsapp: 'Hi {{first_name}}, we’re closing Bronze partner spots for Dec 9. $3,000 for 2 guest passes, media wall + social logo and a DJ shoutout. Silver ($6K), Gold ($10K) and Premium ($18K) are open too. Shall I keep one for {{company}}?',
            linkedin: 'Hi {{first_name}}, last call on Bronze partner spots for An Evening on the Water (Dec 9). Happy to hold one for {{company}} for a few more days. Just say the word.',
          }),
          step({
            name: 'Day 14 · Meet me on the yacht', delayDays: 5, sendTime: '10:00', threadReply: true,
            subjects: ['Let’s meet on the yacht, {{first_name}}', 'Even without a partnership, come say hello', 'One more idea for December 9'],
            preheader: 'Grab a ticket and let’s talk in person in Dubai Marina.',
            blocks: [
              head(),
              B('text', { html: '<p>Hi {{first_name}},</p><p>I’ll keep this short. Whether or not a partnership is right for {{company}} this time, I’d genuinely like to meet you on December 9.</p><p>Gathering starts at 7:00 PM aboard the yacht in Dubai Marina, with champagne, food and live entertainment until 1:00 AM. Our whole team will be there, and I’m happy to introduce you to a few people worth knowing.</p>' }),
              meet(),
              tickets('Get Tickets'),
              yachtTalk(),
              sig(),
              foot(),
            ],
            whatsapp: 'Hi {{first_name}}, partnership or not, I’d love to meet you on Dec 9 at An Evening on the Water. Gathering from 7 PM on the yacht in Dubai Marina. Tickets: {{ticket_link}}',
            linkedin: 'Hi {{first_name}}, partnership or not, I’d love to meet in person on Dec 9 aboard the yacht in Dubai Marina. Happy to make a few introductions. Tickets: {{ticket_link}}',
          }),
        ],
      },
      {
        id: 'seq-premium', name: 'Premium and Gold Pitch', audience: 'Decision makers', color: '#D4AF37', deckChoice: 'attach',
        description: 'A three-step pitch for headline partners: intro, ROI and visibility, then the full tier comparison.',
        steps: [
          step({
            name: 'Intro', delayDays: 0, sendTime: '09:30',
            subjects: ['{{company}} at the centre of the room on Dec 9', 'A headline partnership idea for {{company}}', '{{first_name}}, the top spot on the yacht is open'],
            preheader: 'Premium and Gold partnerships for An Evening on the Water, Dubai Marina.',
            blocks: [
              head(),
              B('hero', { eyebrow: 'HEADLINE PARTNERSHIPS', headline: 'AN EVENING ON THE WATER', dateLine: 'DECEMBER 9 2026 • DUBAI MARINA • 7:00 PM – 1:00 AM', image: 'brand:hero-yacht.jpg', alt: 'The yacht lit up at night in Dubai Marina' }),
              B('text', { html: '<p>Hi {{first_name}},</p><p>I’m {{sender_name}} from Paradigia. On December 9 we’re bringing founders, investors and industry leaders together aboard a private yacht in Dubai Marina, and I’m looking for a small number of partners to lead the night.</p><p><strong>Premium ($18,000)</strong> gives {{company}} a dedicated speaking slot, primary welcome-banner placement with a QR code, formal introductions and the post-event attendee list. <strong>Gold ($10,000)</strong> brings strong presence with a welcome-speech mention and designated signage.</p><p>Would a 15-minute call this week make sense?</p>' }),
              B('tierCard', { tier: 'premium', badge: 'MAXIMUM VISIBILITY', showBenefits: true, maxBenefits: 6, showUpgrades: false }),
              B('tierCard', { tier: 'gold', badge: '', showBenefits: true, maxBenefits: 5, showUpgrades: false }),
              why(),
              B('cta', { text: 'Book a 15-min Call', action: 'reply', replySubject: 'Call about a Premium/Gold partnership – {{company}}', note: '' }),
              yachtTalk(true),
              meet(),
              sig(),
              foot(),
            ],
            whatsapp: 'Hi {{first_name}}, {{sender_first_name}} from Paradigia. For An Evening on the Water (Dec 9, private yacht, Dubai Marina) we’re selecting a few headline partners. Premium ($18K) includes a speaking slot, primary banner + QR, introductions and the attendee list. Gold ($10K) gives strong presence. Open to a 15-min call?',
            linkedin: 'Hi {{first_name}}, we’re selecting a few headline partners for An Evening on the Water (Dec 9, Dubai Marina). Premium includes a speaking slot, introductions and the post-event attendee list. Would {{company}} be open to a short call?',
          }),
          step({
            name: 'ROI and visibility', delayDays: 4, sendTime: '10:00', threadReply: true,
            subjects: ['Where {{company}} shows up on Dec 9', 'Visibility before, during and after the night', 'The return on a Premium partnership'],
            preheader: 'From the welcome banner to the post-event attendee list.',
            blocks: [
              head(),
              B('text', { html: '<p>Hi {{first_name}},</p><p>Here’s how a Premium or Gold partnership works for {{company}} across the whole campaign, not just the night:</p>' }),
              B('benefits', { eyebrow: 'VISIBILITY AND RETURN', title: '', bullet: 'pink', items: [
                { title: 'Before', text: 'Your logo across the event page, invites and social promotion.' },
                { title: 'On the night', text: 'Welcome banner with QR code, signage, table leaflets, a speech mention and DJ shoutouts.' },
                { title: 'Face time', text: 'A speaking slot and formal introductions to sponsors and attendees (Premium).' },
                { title: 'After', text: 'The post-event attendee contact list for your follow-up (Premium).' },
              ] }),
              B('text', { pad: 's', html: '<p>One room, one night, with people you’d otherwise spend months reaching. Shall I send a short proposal?</p>' }),
              B('cta', { text: 'Request the Proposal', action: 'reply', replySubject: 'Proposal for {{company}}', note: '' }),
              sig(),
              foot(),
            ],
            whatsapp: 'Hi {{first_name}}, a quick view of the return: Premium puts {{company}} on the event page, invites and socials before Dec 9, on the welcome banner with a QR code and on stage on the night, and gives you the attendee list after. Want a short proposal?',
            linkedin: 'Hi {{first_name}}, Premium partners at An Evening on the Water get visibility before, during and after the night, including a speaking slot and the attendee list. Happy to send a short proposal for {{company}}.',
          }),
          step({
            name: 'Tier comparison', delayDays: 5, sendTime: '10:00', threadReply: true,
            subjects: ['All four partnership tiers, side by side', '{{first_name}}, which tier fits {{company}}?', 'Premium, Gold, Silver or Bronze?'],
            preheader: 'One table to compare every package for December 9.',
            blocks: [
              head(),
              B('text', { html: '<p>Hi {{first_name}},</p><p>To make the decision easy, here are all four tiers side by side. Premium is built for maximum visibility, and Bronze at $3,000 is the simplest way in.</p>' }),
              B('comparison', { title: 'SPONSORSHIP PACKAGES OVERVIEW', highlight: 'premium', badge: 'MAX VISIBILITY', caption: '' }),
              B('text', { pad: 's', html: '<p>Tell me which column feels right and I’ll hold it for {{company}} while we finalise allocation.</p>' }),
              reserve('Reserving a partnership tier – {{company}}'),
              sig(),
              foot(),
            ],
            whatsapp: 'Hi {{first_name}}, all four tiers for Dec 9: Premium $18K (7 passes, speaking slot, attendee list), Gold $10K (5–6 passes), Silver $6K (3–4 passes), Bronze $3K (2 passes). Which one feels right for {{company}}?',
            linkedin: 'Hi {{first_name}}, I’ve put all four partnership tiers for Dec 9 side by side, from Bronze at $3K to Premium at $18K. Which would suit {{company}} best?',
          }),
        ],
      },
      {
        id: 'seq-tickets', name: 'Ticket Sales', audience: 'Attendees', color: '#FF0055', deckChoice: 'off',
        description: 'Announcement, scarcity, final week and day-before logistics for ticket buyers.',
        steps: [
          step({
            name: 'Announcement', delayDays: 0, sendTime: '10:00',
            subjects: ['You’re invited: An Evening on the Water, Dec 9', 'A private yacht, Dubai Marina, the right people', '{{first_name}}, join us on the water on December 9'],
            preheader: 'Champagne reception, food and live entertainment, 7 PM to 1 AM.',
            blocks: [
              head(),
              B('hero', { eyebrow: 'YOU’RE INVITED', headline: 'AN EVENING ON THE WATER', dateLine: 'DECEMBER 9 2026 • DUBAI MARINA • 7:00 PM – 1:00 AM', image: 'brand:hero-yacht.jpg', alt: 'The yacht lit up at night in Dubai Marina' }),
              B('text', { html: '<p>Hi {{first_name}},</p><p>On December 9, Paradigia is hosting <strong>An Evening on the Water</strong>: a curated networking night aboard a private yacht in Dubai Marina, with founders, investors and industry leaders.</p><p>Expect a champagne reception, great food, live entertainment and introductions that lead somewhere. Tickets are limited by the yacht’s capacity.</p>' }),
              B('benefits', { eyebrow: 'THE EVENT', title: 'A CURATED NETWORKING EXPERIENCE', bullet: 'pink', items: [
                { title: 'Location', text: 'Dubai Marina, aboard a private yacht (400-guest capacity).' },
                { title: 'Timing', text: 'Begins at 7:00 PM with networking. Runs until 1:00 AM.' },
                { title: 'Format', text: 'Champagne reception, food service, live entertainment.' },
                { title: 'Audience', text: 'Founders, investors and industry leaders.' },
              ] }),
              tickets('Get Tickets'),
              meet(),
              sig(),
              foot(),
            ],
            whatsapp: 'Hi {{first_name}}, you’re invited to An Evening on the Water on Dec 9: a networking night aboard a private yacht in Dubai Marina with founders, investors and industry leaders. Champagne, food and live entertainment, 7 PM to 1 AM. Tickets: {{ticket_link}}',
            linkedin: 'Hi {{first_name}}, I’d love you to join us on Dec 9 for An Evening on the Water, a curated networking night aboard a private yacht in Dubai Marina. Tickets: {{ticket_link}}',
          }),
          step({
            name: 'Scarcity · spots left', delayDays: 6, sendTime: '10:00', threadReply: true,
            subjects: ['Only {{spots_left}} spots left on the yacht', 'Tickets for Dec 9 are going', '{{first_name}}, shall I save you a spot?'],
            preheader: 'Capacity is fixed, and once the yacht is full, it’s full.',
            blocks: [
              head(),
              B('text', { html: '<p>Hi {{first_name}},</p><p>A quick update: there are only <strong>{{spots_left}} spots left</strong> for An Evening on the Water on December 9.</p><p>Once the yacht is full, it’s full. If you’ve been meaning to join founders, investors and industry leaders in Dubai Marina, now is the moment.</p>' }),
              tickets('Get Tickets'),
              sig(),
              foot(),
            ],
            whatsapp: 'Hi {{first_name}}, only {{spots_left}} spots left for An Evening on the Water on Dec 9. Once the yacht is full, it’s full: {{ticket_link}}',
            linkedin: 'Hi {{first_name}}, only {{spots_left}} spots left for our yacht networking night in Dubai Marina on Dec 9. Would love to see you there: {{ticket_link}}',
          }),
          step({
            name: 'Final week', delayDays: 0, fixedDate: '2026-12-02', sendTime: '10:00', threadReply: true,
            subjects: ['One week to go: An Evening on the Water', 'Dec 9 is next week. Are you in?', 'Final week for tickets, {{first_name}}'],
            preheader: 'Last chance to join us on the yacht in Dubai Marina.',
            blocks: [
              head(),
              B('image', { src: 'brand:yacht-1.jpg', alt: 'The yacht at night in Dubai Marina', full: true, caption: '' }),
              B('text', { html: '<p>Hi {{first_name}},</p><p>One week from today we’ll be on the water in Dubai Marina. Gathering starts at 7:00 PM, and the evening runs until 1:00 AM with champagne, food and live entertainment.</p><p>This is the final week to get your ticket. I’d love to see you there.</p>' }),
              tickets('Get Tickets'),
              sig(),
              foot(),
            ],
            whatsapp: 'Hi {{first_name}}, one week to go until An Evening on the Water (Dec 9, Dubai Marina). Final week for tickets: {{ticket_link}}',
            linkedin: 'Hi {{first_name}}, one week until our yacht networking night in Dubai Marina. Final week for tickets: {{ticket_link}}',
          }),
          step({
            name: 'Day before · logistics', delayDays: 0, fixedDate: '2026-12-08', sendTime: '12:00', threadReply: true,
            subjects: ['Tomorrow: everything you need for the yacht', 'See you on the water tomorrow, {{first_name}}', 'Your Dec 9 checklist'],
            preheader: 'Timings, location and what to bring.',
            blocks: [
              head(),
              B('text', { html: '<p>Hi {{first_name}},</p><p>We’re excited to welcome you aboard tomorrow. Here’s everything you need:</p>' }),
              B('benefits', { eyebrow: 'YOUR CHECKLIST', title: '', bullet: 'pink', items: [
                { title: 'Start time', text: 'The event begins at 7:00 PM with networking and runs until 1:00 AM.' },
                { title: 'Location', text: 'Dubai Marina, aboard a private yacht. Boarding point: [BOARDING POINT].' },
                { title: 'Bring', text: 'Your ticket (on your phone is fine) and plenty of business cards.' },
                { title: 'Dress code', text: '[DRESS CODE]' },
              ] }),
              B('text', { pad: 's', html: '<p>If anything changes on your side, just reply to this email.</p>' }),
              B('cta', { text: 'Event Details', action: 'tickets', note: '', showPromo: false }),
              sig(),
              foot(),
            ],
            whatsapp: 'Hi {{first_name}}, see you tomorrow at An Evening on the Water! The event starts at 7 PM with networking, Dubai Marina, boarding point: [BOARDING POINT]. Bring your ticket and business cards.',
            linkedin: 'Hi {{first_name}}, looking forward to seeing you tomorrow on the yacht in Dubai Marina. The event starts at 7 PM with networking.',
          }),
        ],
      },
      {
        id: 'seq-onboarding', name: 'Sponsor Onboarding', audience: 'Confirmed sponsors', color: '#3B1FA8', deckChoice: 'off',
        description: 'Thank-you, logo and asset request, then event-day details for confirmed partners.',
        steps: [
          step({
            name: 'Thank you', delayDays: 0, sendTime: '10:00',
            subjects: ['Welcome aboard, {{company}}', 'Thank you, {{first_name}}. Let’s make Dec 9 count', 'You’re officially a {{tier}} partner'],
            preheader: 'Here’s what happens next for your partnership.',
            blocks: [
              head(),
              B('hero', { eyebrow: 'WELCOME ABOARD', headline: 'THANK YOU FOR PARTNERING', dateLine: 'DECEMBER 9 2026 • DUBAI MARINA • 7:00 PM – 1:00 AM', image: 'brand:hero-yacht.jpg', alt: 'The yacht lit up at night in Dubai Marina' }),
              B('text', { html: '<p>Hi {{first_name}},</p><p>Thank you for joining An Evening on the Water as a <strong>{{tier}} partner</strong>. We’re genuinely glad to have {{company}} on board.</p><p>Over the next few days I’ll ask for your logo and a few details, then share everything for the night itself. Here’s a reminder of what your package includes.</p>' }),
              B('tierCard', { tier: 'lead', badge: 'YOUR PACKAGE', showBenefits: true, showUpgrades: false }),
              meet('YOUR TEAM FOR THE NIGHT'),
              B('secondaryCta', { text: 'Message me on WhatsApp', action: 'whatsapp', waText: 'Hi {{sender_first_name}}, it’s {{first_name}} from {{company}}.' }),
              sig(),
              foot(),
            ],
            whatsapp: 'Hi {{first_name}}, thank you for joining An Evening on the Water as a {{tier}} partner! I’ll send a short asset request shortly. Save my number for anything you need.',
            linkedin: 'Hi {{first_name}}, thank you for partnering with us for An Evening on the Water. Looking forward to welcoming {{company}} on board on Dec 9.',
          }),
          step({
            name: 'Logo and asset request', delayDays: 2, sendTime: '10:00', threadReply: true,
            subjects: ['Your logo and a few details for Dec 9', 'Quick asset request for {{company}}', 'What we need from you, {{first_name}}'],
            preheader: 'Logo files, guest names and your DJ shoutout line.',
            blocks: [
              head(),
              B('text', { html: '<p>Hi {{first_name}},</p><p>To get {{company}} onto the media wall, our social posts and the DJ’s script, could you reply with the following?</p>' }),
              B('benefits', { eyebrow: 'ASSET CHECKLIST', title: '', bullet: 'pink', items: [
                { title: 'Logo files', text: 'Vector (SVG, EPS or PDF) plus a high-res PNG, in light and dark versions.' },
                { title: 'Guest names', text: 'Full names and emails for your complimentary passes.' },
                { title: 'Social handles', text: 'So we can tag you in event posts.' },
                { title: 'Shoutout line', text: 'One sentence you’d like the DJ to say about {{company}}.' },
              ] }),
              B('text', { pad: 's', html: '<p>If it’s easier, send what you have now and the rest later. Our design deadline is [ASSET DEADLINE].</p>' }),
              B('cta', { text: 'Reply with Assets', action: 'reply', replySubject: 'Assets for {{company}}', note: '' }),
              sig(),
              foot(),
            ],
            whatsapp: 'Hi {{first_name}}, for Dec 9 we need: logo files (vector + PNG), guest names for your passes, your social handles and a one-line DJ shoutout for {{company}}. Email is easiest. Thank you!',
            linkedin: 'Hi {{first_name}}, I’ve emailed a short asset checklist for {{company}} (logo, guest names, social handles, shoutout line). Thanks in advance!',
          }),
          step({
            name: 'Event-day details', delayDays: 0, fixedDate: '2026-12-07', sendTime: '10:00', threadReply: true,
            subjects: ['Event-day details for {{company}}', 'Dec 9: your partner run-of-show', 'Everything you need for the night'],
            preheader: 'Arrival times, location and who to find on board.',
            blocks: [
              head(),
              B('text', { html: '<p>Hi {{first_name}},</p><p>Two days to go. Here’s what {{company}} needs to know for the night:</p>' }),
              B('benefits', { eyebrow: 'RUN OF SHOW', title: '', bullet: 'pink', items: [
                { title: 'Arrival', text: 'Partners from [PARTNER ARRIVAL TIME]. Guests gather from 7:00 PM.' },
                { title: 'Location', text: 'Dubai Marina, aboard the private yacht. Boarding point: [BOARDING POINT].' },
                { title: 'Programme', text: 'Champagne reception, then the main programme 9:00 PM – 1:00 AM, with DJ shoutouts for our partners.' },
                { title: 'On board', text: 'Find any of us below for introductions.' },
              ] }),
              meet('YOUR TEAM ON THE NIGHT'),
              B('secondaryCta', { text: 'Message me on the day', action: 'whatsapp', waText: 'Hi {{sender_first_name}}, it’s {{first_name}} from {{company}}.' }),
              sig(),
              foot(),
            ],
            whatsapp: 'Hi {{first_name}}, two days to go! Partners arrive from [PARTNER ARRIVAL TIME], guests from 7 PM. Boarding point: [BOARDING POINT]. Message me here on the day.',
            linkedin: 'Hi {{first_name}}, two days until An Evening on the Water. I’ve emailed the event-day details for {{company}}.',
          }),
        ],
      },
      {
        id: 'seq-post', name: 'Post-event Thank You and Follow-up', audience: 'Guests and partners', color: '#C0C0C0', deckChoice: 'off',
        description: 'A thank-you the morning after, then a follow-up that opens the next conversation.',
        steps: [
          step({
            name: 'Thank you', delayDays: 0, fixedDate: '2026-12-10', sendTime: '11:00',
            subjects: ['Thank you for an unforgettable night', '{{first_name}}, thank you for joining us on the water', 'What a night. Thank you.'],
            preheader: 'A few highlights, and what’s next.',
            blocks: [
              head(),
              B('image', { src: 'brand:yacht-6.jpg', alt: 'Inside the yacht in Dubai Marina', full: true, caption: '' }),
              B('text', { html: '<p>Hi {{first_name}},</p><p>Thank you for being part of An Evening on the Water. The energy on the yacht last night was exactly what we hoped for: real conversations between founders, investors and industry leaders.</p><p>If you met someone you’d like an introduction to, or want to follow up on a conversation, just reply and I’ll connect you.</p>' }),
              B('cta', { text: 'Ask for an Introduction', action: 'reply', replySubject: 'Introduction request', note: '' }),
              sig(),
              foot(),
            ],
            whatsapp: 'Hi {{first_name}}, thank you for joining us at An Evening on the Water last night! If you’d like an introduction to anyone you met, just let me know.',
            linkedin: 'Hi {{first_name}}, thank you for joining us on the yacht last night. Happy to make any introductions you need.',
          }),
          step({
            name: 'Follow-up', delayDays: 6, sendTime: '10:00', threadReply: true,
            subjects: ['Let’s keep the conversation going', '{{first_name}}, a quick follow-up from Dec 9', 'What’s next for {{company}} and Paradigia?'],
            preheader: 'Feedback, introductions and first access to our next event.',
            blocks: [
              head(),
              B('text', { html: '<p>Hi {{first_name}},</p><p>Now that the dust has settled, I’d love to hear how the night went for {{company}}. What worked, and what would make the next one even better?</p><p>We’re already planning our next networking evening, and this year’s partners and guests get first access. Shall I keep you in the loop?</p>' }),
              B('cta', { text: 'Keep Me in the Loop', action: 'reply', replySubject: 'Next event – {{company}}', note: '' }),
              sig(),
              foot(),
            ],
            whatsapp: 'Hi {{first_name}}, how did Dec 9 go for {{company}}? We’re planning the next evening already, and you’ll get first access. Shall I keep you posted?',
            linkedin: 'Hi {{first_name}}, would love your feedback on An Evening on the Water. We’re planning the next one and I’ll make sure {{company}} hears first.',
          }),
        ],
      },
    ];
  }

  const sampleLead = () => ({ id: 'sample', firstName: 'Sarah', lastName: 'Haddad', email: 'sarah@example.com', company: 'Acme Ventures', tierInterest: 'Bronze', status: 'new' });

  /* ------------------------------------------------------------ templates */
  // Reusable layouts. Text in [BRACKETS] is a placeholder the pre-send check flags.
  function layouts() {
    const L = (id, name, description, o) => ({ id: `tpl-layout-${id}`, name, category: 'Layouts', description, builtIn: true, step: step({ name, ...o }) });
    const hero = (eyebrow, headline) => B('hero', { eyebrow, headline, dateLine: 'DECEMBER 9 2026 • DUBAI MARINA • 7:00 PM – 1:00 AM', image: 'brand:hero-yacht.jpg', alt: 'The yacht lit up at night in Dubai Marina' });
    return [
      L('note', 'Personal note', 'Plain text and your signature. Feels like a real 1:1 email; best for follow-ups.', {
        subjects: ['Quick note, {{first_name}}', 'Following up, {{first_name}}', 'A quick question for {{company}}'],
        preheader: 'A short personal note from {{sender_name}}.',
        blocks: [B('text', { html: '<p>Hi {{first_name}},</p><p>[YOUR MESSAGE]</p>' }), sig(), foot()],
        whatsapp: 'Hi {{first_name}}, [YOUR MESSAGE]', linkedin: 'Hi {{first_name}}, [YOUR MESSAGE]',
      }),
      L('blank', 'Branded blank', 'Logo header, one text block, signature and footer. Start from scratch.', {
        subjects: ['[SUBJECT]', '', ''], preheader: '[PREVIEW TEXT]',
        blocks: [head(), B('text', { html: '<p>Hi {{first_name}},</p><p>[YOUR MESSAGE]</p>' }), sig(), foot()],
      }),
      L('announcement', 'Big announcement', 'Yacht hero with your headline, short copy, pink button, Buy Ticket and Let’s talk.', {
        subjects: ['[SUBJECT]', '', ''], preheader: '[PREVIEW TEXT]',
        blocks: [head(), hero('AN EVENING ON THE WATER', '[YOUR HEADLINE]'), B('text', { html: '<p>Hi {{first_name}},</p><p>[YOUR MESSAGE]</p>' }), reserve('Reserve my spot – {{company}}'), yachtTalk(true), sig(), foot()],
      }),
      L('invite', 'Event invitation', 'Invite with the event details list, Buy Ticket and Let’s talk, and the team.', {
        subjects: ['You’re invited: An Evening on the Water, Dec 9', '{{first_name}}, join us on the water on December 9', 'A private yacht, Dubai Marina, the right people'],
        preheader: 'Champagne reception, food and live entertainment, 7 PM to 1 AM.',
        blocks: [
          head(), hero('YOU’RE INVITED', 'AN EVENING ON THE WATER'),
          B('text', { html: '<p>Hi {{first_name}},</p><p>On December 9, Paradigia is hosting <strong>An Evening on the Water</strong>: a curated networking night aboard a private yacht in Dubai Marina, with founders, investors and industry leaders.</p><p>I’d love to see you there.</p>' }),
          B('benefits', { eyebrow: 'THE EVENT', title: 'A CURATED NETWORKING EXPERIENCE', bullet: 'pink', items: [
            { title: 'Location', text: 'Dubai Marina, aboard a private yacht (400-guest capacity).' },
            { title: 'Timing', text: 'Begins at 7:00 PM with networking. Runs until 1:00 AM.' },
            { title: 'Format', text: 'Champagne reception, food service, live entertainment.' },
            { title: 'Audience', text: 'Founders, investors and industry leaders.' },
          ] }),
          yachtTalk(true), meet(), sig(), foot(),
        ],
        whatsapp: 'Hi {{first_name}}, you’re invited to An Evening on the Water on Dec 9, a networking night aboard a private yacht in Dubai Marina. Tickets: {{ticket_link}}',
        linkedin: 'Hi {{first_name}}, I’d love you to join us on Dec 9 for An Evening on the Water in Dubai Marina. Tickets: {{ticket_link}}',
      }),
      L('why', 'Why sponsor', 'The deck’s “Why sponsor?” story: two black boxes and the four benefit pillars.', {
        subjects: ['Why {{company}} should be on the yacht on Dec 9', 'Elevate {{company}} at Paradigia’s flagship night', 'One room, one night, the right people'],
        preheader: 'Curated audience, direct introductions and visibility that lasts beyond the night.',
        blocks: [
          head(), B('heading', { eyebrow: 'WHY SPONSOR?', title: 'BECOME A SPONSOR OF AN EVENING ON THE WATER', align: 'left', underline: true }),
          B('text', { pad: 's', html: '<p>Hi {{first_name}},</p><p>Here’s why partnering with Paradigia on December 9 works for companies like {{company}}.</p>' }),
          B('callout', { eyebrow: 'A PROMINENT POSITION', text: 'Secure a prominent position at this exclusive networking evening, directly engaging with founders, investors and industry leaders aboard a private yacht in Dubai Marina.', items: [] }),
          B('callout', { eyebrow: 'BEYOND THE NIGHT', text: 'Benefit from event visibility and a marketing campaign that extends your brand’s impact beyond the night itself.', items: [] }),
          B('benefits', { eyebrow: 'SPONSORSHIP BENEFITS', title: '', bullet: 'pink', items: [
            { title: 'Enhance brand visibility', text: 'Exposure to founders, investors and industry leaders in one room, on one night.' },
            { title: 'Foster strategic partnerships', text: 'Connect with the companies and people driving the circular tech space.' },
            { title: 'Drive direct introductions', text: 'Personal, on-site introductions and face time with the room’s decision-makers.' },
            { title: 'Show your commitment to sustainability', text: 'Position your organisation alongside Paradigia’s growing network.' },
          ] }),
          reserve('Partnership for {{company}}', 'Become a Sponsor'), sig(), foot(),
        ],
        whatsapp: 'Hi {{first_name}}, partners at An Evening on the Water (Dec 9, Dubai Marina) get face time with founders, investors and industry leaders, plus visibility before and after the night. Open to a quick chat about {{company}}?',
        linkedin: 'Hi {{first_name}}, I think {{company}} would be a great partner for An Evening on the Water on Dec 9. Open to a quick chat?',
      }),
      L('comparison', 'Package comparison', 'All four tiers side by side with Bronze highlighted as the best entry point.', {
        subjects: ['All four partnership tiers, side by side', '{{first_name}}, which tier fits {{company}}?', 'From $3K to $18K: pick your spot on the yacht'],
        preheader: 'One table to compare every package for December 9.',
        blocks: [
          head(), B('text', { html: '<p>Hi {{first_name}},</p><p>Here are all four partnership tiers side by side. Bronze at $3,000 is the simplest way in; Premium is built for maximum visibility.</p>' }),
          B('comparison', { title: 'SPONSORSHIP PACKAGES OVERVIEW', highlight: 'bronze', badge: 'BEST ENTRY POINT', caption: '' }),
          reserve('Reserving a partnership tier – {{company}}'), yachtTalk(true), sig(), foot(),
        ],
        whatsapp: 'Hi {{first_name}}, our four tiers for Dec 9: Bronze $3K, Silver $6K, Gold $10K, Premium $18K. Which one feels right for {{company}}?',
        linkedin: 'Hi {{first_name}}, I’ve put our four partnership tiers for Dec 9 side by side. Happy to share them with {{company}}.',
      }),
      L('team', 'Meet the team', 'Short note, the whole team with hover cards, Buy Ticket and Let’s talk.', {
        subjects: ['Meet the team behind December 9', '{{first_name}}, here’s who you’ll meet on the yacht', 'Faces to names before Dec 9'],
        preheader: 'Our whole team will be on board. Here’s who to look for.',
        blocks: [
          head(), B('text', { html: '<p>Hi {{first_name}},</p><p>Our whole team will be on the yacht on December 9, and we’d love to introduce you to the people worth meeting. Here’s who to look for.</p>' }),
          meet(), yachtTalk(true), sig(), foot(),
        ],
      }),
      L('photos', 'Photo story', 'Two yacht photos around a short message and a ticket button.', {
        subjects: ['A look at the yacht for December 9', '{{first_name}}, this is where we’ll be on Dec 9', 'Picture this: Dubai Marina, Dec 9'],
        preheader: 'A private yacht in Dubai Marina, 7 PM to 1 AM.',
        blocks: [
          head(), B('image', { src: 'brand:yacht-1.jpg', alt: 'The yacht at night in Dubai Marina', full: true, caption: '' }),
          B('text', { html: '<p>Hi {{first_name}},</p><p>[YOUR MESSAGE]</p>' }),
          B('image', { src: 'brand:yacht-6.jpg', alt: 'Inside the yacht', full: false, caption: '' }),
          tickets('Get Tickets'), sig(), foot(),
        ],
      }),
    ];
  }

  /** One sponsorship sequence for every tier, personalised by the lead's tier interest ({{tier}}, {{price}}). */
  function sponsorshipSeq() {
    return {
      id: 'seq-sponsorship', name: 'Sponsorship', audience: 'All sponsor prospects (every tier)', color: '#FF0055', deckChoice: 'attach',
      description: 'One sequence for every tier: Bronze ($3K) to Premium ($18K), personalised to each lead’s tier interest (Bronze if none).',
      steps: [
        step({
          name: 'Day 0 · Intro', delayDays: 0, sendTime: '10:00',
          subjects: ['{{first_name}}, a spot for {{company}} on the yacht?', 'Dec 9, Dubai Marina: founders, investors, one yacht', 'A warm intro and a simple idea for {{company}}'],
          preheader: 'Partner packages from $3,000: guest passes, media-wall logo and DJ shoutouts during the night.',
          blocks: [
            head(),
            B('hero', { eyebrow: 'SPONSORSHIP OPPORTUNITIES', headline: 'AN EVENING ON THE WATER', dateLine: 'DECEMBER 9 2026 • DUBAI MARINA • 7:00 PM – 1:00 AM', image: 'brand:hero-yacht.jpg', alt: 'The yacht lit up at night in Dubai Marina' }),
            B('text', { html: '<p>Hi {{first_name}},</p><p>I’m {{sender_name}} from Paradigia. On December 9 we’re hosting <strong>An Evening on the Water</strong>, a private-yacht networking night in Dubai Marina for founders, investors and industry leaders.</p><p>I’d love to have {{company}} on board as a partner. Packages start at $3,000 with Bronze (2 guest passes, your logo on the media wall and across our social posts, and a DJ shoutout during the night) and go up to Premium with a speaking slot and the attendee list. There’s also a mini stage where partner companies get their moment.</p><p>I’d suggest <strong>{{tier}}</strong> as a starting point for {{company}}. Shall I hold a spot for you?</p>' }),
            B('tierCard', { tier: 'lead', badge: 'auto', showBenefits: true, showUpgrades: true }),
            why(),
            reserve('Reserve {{tier}} for {{company}}'),
            yachtTalk(true),
            meet(),
            sig(),
            foot(),
          ],
          whatsapp: 'Hi {{first_name}}, it’s {{sender_first_name}} from Paradigia. On Dec 9 we’re hosting An Evening on the Water, a private-yacht networking night in Dubai Marina with founders, investors and industry leaders. Partner packages run from $3,000 (Bronze: 2 guest passes, media wall + social logo, DJ shoutout during the night) to $18,000 (Premium). I’d suggest {{tier}} for {{company}}. Shall I hold a spot?',
          linkedin: 'Hi {{first_name}}, I’m hosting An Evening on the Water on Dec 9, a private-yacht networking night in Dubai Marina for founders, investors and industry leaders. Partner packages run from $3K to $18K. Open to a quick chat about {{company}} joining us?',
        }),
        step({
          name: 'Day 4 · What partners get', delayDays: 4, sendTime: '10:30', threadReply: true,
          subjects: ['What a partnership gets {{company}} on Dec 9', 'Visibility before, during and after the night', 'Quick follow-up, {{first_name}}'],
          preheader: 'Every package includes your logo on the media wall, social posts and DJ shoutouts.',
          blocks: [
            head(),
            B('text', { html: '<p>Hi {{first_name}},</p><p>Following up on An Evening on the Water. Here’s what a partnership gives {{company}}, from the entry package up:</p>' }),
            B('benefits', { eyebrow: 'WHAT PARTNERS GET', title: '', bullet: 'pink', items: [
              { title: 'Every package', text: 'Your logo on the main media wall and in our event promotion, a DJ shoutout during the night, and 2 to 7 guest passes.' },
              { title: 'Silver and up', text: 'Your logo on the welcome banner and your leaflets on the night.' },
              { title: 'Gold and up', text: 'A mention in the welcome speech and signage in a designated area.' },
              { title: 'Premium', text: 'A speaking slot, formal introductions and the post-event attendee list.' },
            ] }),
            B('text', { pad: 's', html: '<p>{{tier}} is {{price}}. Shall I send a short proposal, or simply hold a spot for you?</p>' }),
            B('cta', { text: 'Request the Proposal', action: 'reply', replySubject: 'Partnership proposal for {{company}}', note: '' }),
            sig(),
            foot(),
          ],
          whatsapp: 'Hi {{first_name}}, quick follow-up on Dec 9. Every partner package includes your logo on the media wall and in our promotion, a DJ shoutout during the night and guest passes. Higher tiers add banner placement, a speech mention, a speaking slot and the attendee list. {{tier}} is {{price}}. Want a short proposal for {{company}}?',
          linkedin: 'Hi {{first_name}}, following up on Dec 9: every partner package includes media-wall visibility and DJ shoutouts; higher tiers add a speaking slot and the attendee list. Happy to send a short proposal for {{company}}.',
        }),
        step({
          name: 'Day 9 · Compare the packages', delayDays: 5, sendTime: '10:00', threadReply: true,
          subjects: ['All four partnership tiers, side by side', '{{first_name}}, which tier fits {{company}}?', 'From $3K to $18K: pick your spot on the yacht'],
          preheader: 'One table to compare every package for December 9.',
          blocks: [
            head(),
            B('text', { html: '<p>Hi {{first_name}},</p><p>To make the decision easy, here are all four packages side by side. Bronze at $3,000 is the simplest way in; Premium at $18,000 puts {{company}} at the centre of the room.</p>' }),
            B('comparison', { title: 'SPONSORSHIP PACKAGES OVERVIEW', highlight: 'lead', badge: 'auto', caption: '' }),
            B('text', { pad: 's', html: '<p>Tell me which column feels right and I’ll hold it for {{company}} while we finalise allocation.</p>' }),
            reserve('Reserving a partnership tier – {{company}}'),
            sig(),
            foot(),
          ],
          whatsapp: 'Hi {{first_name}}, all four tiers for Dec 9: Bronze $3K (2 passes), Silver $6K (3–4 passes), Gold $10K (5–6 passes), Premium $18K (7 passes, speaking slot, attendee list). Which one feels right for {{company}}?',
          linkedin: 'Hi {{first_name}}, I’ve put all four partnership tiers for Dec 9 side by side, from Bronze at $3K to Premium at $18K. Which would suit {{company}} best?',
        }),
        step({
          name: 'Day 14 · Last call', delayDays: 5, sendTime: '11:00', threadReply: true,
          subjects: ['Last call for partner spots, {{first_name}}', 'Closing partner allocation for Dec 9', 'Should I release {{company}}’s spot?'],
          preheader: 'Allocation is closing. Happy to hold one for you for a few more days.',
          blocks: [
            head(),
            B('text', { html: '<p>Hi {{first_name}},</p><p>We’re finalising partner allocation for December 9, so I wanted to check in once more before I offer the remaining spots to others.</p><p>{{tier}} is {{price}}, and Bronze starts at $3,000. A simple “yes” is enough and I’ll handle the rest.</p>' }),
            B('tierCard', { tier: 'lead', badge: 'auto', showBenefits: true, showUpgrades: true }),
            reserve('Yes, reserve {{tier}} for {{company}}', 'Reserve My Spot'),
            sig(),
            foot(),
          ],
          whatsapp: 'Hi {{first_name}}, we’re closing partner spots for Dec 9. {{tier}} is {{price}}, and Bronze starts at $3,000 (2 guest passes, media wall + social logo, DJ shoutout). Shall I keep one for {{company}}?',
          linkedin: 'Hi {{first_name}}, last call on partner spots for An Evening on the Water (Dec 9). Happy to hold one for {{company}} for a few more days.',
        }),
        step({
          name: 'Day 19 · Meet me on the yacht', delayDays: 5, sendTime: '10:00', threadReply: true,
          subjects: ['Let’s meet on the yacht, {{first_name}}', 'Even without a partnership, come say hello', 'One more idea for December 9'],
          preheader: 'Grab a ticket and let’s talk in person in Dubai Marina.',
          blocks: [
            head(),
            B('text', { html: '<p>Hi {{first_name}},</p><p>I’ll keep this short. Whether or not a partnership is right for {{company}} this time, I’d genuinely like to meet you on December 9.</p><p>Gathering starts at 7:00 PM aboard the yacht in Dubai Marina, with champagne, food and live entertainment until 1:00 AM. Our whole team will be there, and I’m happy to introduce you to a few people worth knowing.</p>' }),
            meet(),
            tickets('Get Tickets'),
            yachtTalk(),
            sig(),
            foot(),
          ],
          whatsapp: 'Hi {{first_name}}, partnership or not, I’d love to meet you on Dec 9 at An Evening on the Water. Gathering from 7 PM on the yacht in Dubai Marina. Tickets: {{ticket_link}}',
          linkedin: 'Hi {{first_name}}, partnership or not, I’d love to meet in person on Dec 9 aboard the yacht in Dubai Marina. Happy to make a few introductions. Tickets: {{ticket_link}}',
        }),
      ],
    };
  }

  /** The default sequences: one for sponsorship (every tier) and one for tickets, plus after-sale onboarding and post-event. */
  function sequences() {
    const [, , tickets, onboarding, post] = originalSequences();
    return [
      sponsorshipSeq(),
      { ...tickets, name: 'Tickets', audience: 'Ticket buyers', description: 'Announcement, spots left, final week and day-before logistics for ticket buyers.' },
      onboarding,
      post,
    ];
  }

  /** Every built-in template: the layouts, each email of the default sequences, and the original per-tier sponsor emails. */
  function templates() {
    const out = [];
    const add = (s, category) => s.steps.forEach((st, i) => out.push({ id: `tpl-${s.id}-${i}`, name: st.name, category, description: `${s.name} · email ${i + 1} of ${s.steps.length}`, builtIn: true, step: st }));
    for (const s of sequences()) add(s, s.name);
    const [bronze, premium] = originalSequences();
    add(bronze, 'Sponsorship extras');
    add(premium, 'Sponsorship extras');
    return [...layouts(), ...out];
  }

  function database() {
    return {
      version: 1,
      createdAt: new Date().toISOString(),
      settings: settings(),
      team: team(),
      signatures: signatures(),
      sequences: sequences(),
      customBlocks: [],
      templates: [],
      leads: [],
      enrollments: [],
      queue: [],
      messages: [],
      suppression: [],
      activity: [],
      accounts: [],
      sync: {},
    };
  }

  return { settings, team, signatures, sequences, templates, sampleLead, database, newBlockId: () => B('x').id, newStepId: () => step({ subjects: [], blocks: [] }).id };
});
