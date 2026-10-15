# Paradigia Outreach Studio

Email composer, sequence manager and lightweight CRM for **An Evening on the Water**
(Dec 9 2026 · Dubai Marina · 7 PM – 1 AM). It sends from **your own Gmail / Google Workspace
address** through the Gmail API, reads replies, and updates every lead's pipeline status automatically.

Everything runs and is stored **on your computer**. Nothing needs to be installed except Node.js.

---

## 1. Start it

1. Install Node.js 18 or newer from https://nodejs.org (already installed on this PC: v26).
2. Double-click **`START.bat`** (or run `node server.js` in this folder).
3. Your browser opens **http://localhost:5050**. Keep the black window open while you work.

> Scheduled emails, automatic follow-ups and reply checking only run **while the app is running**.
> If you schedule a sequence, leave the window open (and the computer awake) during your sending window.

## 2. Connect Gmail (Google Cloud Console, about 5 minutes)

The same steps are shown inside the app under **Settings → Gmail connection**.

1. **Create a project**: https://console.cloud.google.com/projectcreate (e.g. "Paradigia Outreach").
2. **Enable the Gmail API**: https://console.cloud.google.com/apis/library/gmail.googleapis.com → Enable.
3. **Consent screen** (Google Auth Platform → Branding / Audience):
   - App name `Paradigia Outreach Studio`, your email as support and developer contact.
   - **Audience**
     - Google Workspace address (e.g. `@mobi-hub.com`): choose **Internal**. No Google review, and you stay connected.
     - Personal `@gmail.com`: choose **External**, leave it in **Testing**, and add your address under **Test users**.
       Google expires Testing-mode access after 7 days, so you click **Reconnect** in Settings once a week.
4. **Data access → Add scopes**: `https://www.googleapis.com/auth/gmail.send` and `https://www.googleapis.com/auth/gmail.readonly`.
5. **Credentials → Create credentials → OAuth client ID**
   - Application type **Desktop app** (simplest), or
   - **Web application** with the authorized redirect URI `http://localhost:5050/oauth2callback`.
6. Download the JSON (or copy Client ID + Client secret) → in the app: **Settings → Upload client_secret JSON** (or paste and Save).
7. Click **Connect Gmail**, choose your account, allow both permissions.
   If Google says "Google hasn't verified this app", click **Advanced → Continue**. It is your own app.

You can connect several Gmail accounts; each has its own daily limit and default signature.

**Permissions used:** `gmail.send` (send as you) and `gmail.readonly` (find replies, bounces and unsubscribe requests).
Tokens are stored only in `data/secrets.json` on this computer.

## 3. Daily workflow

1. **Leads → Import CSV.** Columns like name / first / last name, email, company, title, phone, LinkedIn,
   tier interest, status, notes. Each import is tagged with a list name.
   Re-importing the same file **updates** leads by email; nothing is duplicated, and pipeline status and history are kept.
2. **Pick who gets the next email.** Filter by pipeline status (New, Contacted, Follow-up, Replied …),
   by **Sequence progress** (e.g. "Bronze Sponsor Push: last sent 1. Day 0 · Warm intro"), or tick **Next email due**.
   Select the leads → **Send email**. The dialog suggests the right next step automatically.
   - **Batch (recommended)**: sends inside your sending window, one email every ~75 seconds, up to the daily limit (50–80/day). Extra emails roll over to the next day.
   - **Send now** or **Schedule** for a specific time.
3. **Or automate it:** select leads → **Automate** to run the whole sequence (Day 0 → +4 → +5 → +5 days).
4. **Replies:** the app checks Gmail every 3 minutes (and again right before each follow-up).
   When a lead replies, they move to **Replied**, their sequence **pauses**, and the reply appears in **Inbox**.
   Reply from the Inbox with the same signature and templates; it stays in the same Gmail thread.
5. Move leads along the pipeline yourself: Interested → Meeting → Won / Lost. Automation never overrides those.
6. **WhatsApp / LinkedIn:** every email has a short version. Open a lead → WhatsApp or LinkedIn → copy the
   message with their name filled in, or open their WhatsApp chat.

**Unsubscribes and bounces** are detected automatically and added to the suppression list. Those addresses never get email again.
Out-of-office replies are noted but don't pause the sequence (you can change that in Settings).

## 4. Templates and the editor

Ready-made sequences with 3 subject lines per email, WhatsApp and LinkedIn versions:

| Sequence | Emails |
|---|---|
| **Sponsorship** (every tier, one sequence) | Day 0 intro · Day 4 what partners get · Day 9 compare the packages · Day 14 last call · Day 19 meet me on the yacht |
| **Tickets** | Announcement · Spots left · Final week (Dec 2) · Day before (Dec 8) |
| Sponsor Onboarding (after someone signs) | Thank you · Logo and asset request · Event-day details (Dec 7) |
| Post-event | Thank you (Dec 10) · Follow-up |

The Sponsorship sequence adapts to each lead’s **tier interest** (Bronze, Silver, Gold or Premium): `{{tier}}`, `{{price}}`,
the tier card and the highlighted column of the comparison table follow it. Leads without a tier get Bronze, the entry point.
Product categories from your CSV are kept separately under **Interests**.

**Sequences → Edit design** opens the editor:
- Click any text in the email to edit it. A toolbar adds bold, links, bullets and merge fields
  (`{{first_name}}`, `{{company}}`, `{{sender_name}}`, `{{tier}}`, `{{price}}`, `{{ticket_link}}`, …).
  `{{company}}` reads naturally: legal endings (Ltd, GmbH, LLC, B.V., Sp. z o.o., …), event labels like
  "Sponsor EBM" and "formerly known as" notes are dropped, so "Ecoele GmbH" becomes "Ecoele". The lead keeps
  the full name, and `{{company_full}}` inserts it where you need the legal name.
- Block library: header, hero, text, tier card, comparison table, benefits list, "why partner" box,
  CTA buttons, image, divider, Meet the Team, signature, footer. Save any block as reusable.
- Desktop / mobile / dark-mode preview, preview with a real lead's data, **Send test**, **Export HTML**.
- **HTML tab**: see and edit the email’s full HTML with a live preview. Once you edit it, the email is sent exactly as your HTML
  (merge fields still work; **Back to design** returns to the blocks). **Edit as HTML** on a single block turns just that part into code.
- **Download** (editor, an email's ⋯ menu, template cards) and **Approval sheet** (sequence page): an *approval sheet* with the subject lines,
  preview text, timing, deck setting and the email itself, plus a sign-off box. **Open in browser** opens it as a page in a new tab on this PC
  (save, print or share it from there); **Download file** saves it as a self-contained .html with images included. The plain email HTML is there too.
- Per email: A/B subject testing, preheader, timing (days after previous, or a fixed date),
  same-thread follow-ups, and the **sponsorship deck toggle** (attach PDF / link / off, remembered per sequence).

Placeholders in square brackets (e.g. `[BOARDING POINT]`, `[DRESS CODE]`, `[ASSET DEADLINE]`) are flagged before sending. Fill them in first.

### Templates

**Templates** (left menu) holds 24 ready-made email designs: 8 layouts (personal note, branded blank, big announcement,
event invitation, why sponsor, package comparison, meet the team, photo story) plus every email from the sequences, and the original Bronze and Premium/Gold emails under **Sponsorship extras**.

- **Build a sequence**: click templates to add them, drag or use the arrows to put them in order, set the days between them, then **Create sequence**.
- **Add to sequence**: add any template as the last email of an existing sequence (or **Add email from template** on a sequence page), then drag it into place.
- **Replace design with a template…** (an email's ⋯ menu) swaps the content but keeps its name and timing.
- **Save as template** (editor toolbar or the ⋯ menu) stores your own designs under **My templates**. **Customise** copies a built-in template so you can edit it.
- **New from HTML**: paste an HTML email; it becomes a template inside the branded frame with your unsubscribe footer. The **Custom HTML** block does the same inside any email.

Templates are copied when used, so editing an email in a sequence never changes the template (and vice versa).

**Marketing review** (Sequences, or a sequence page → **Marketing review**): pick the sequences and download one
**review page (.html)** to send by email, Slack or WhatsApp. It opens in any browser on a computer, with the images
inside. Reviewers read each email as a lead sees it (desktop or phone width), switch to **Edit text** to change the
wording on the email itself (subject lines, preview text and WhatsApp/LinkedIn versions too), approve each email or
mark it "Needs changes" with a comment, then click **Save review** and send back the small .json file. Their work is
kept in their browser if they close the page, and **Open saved** continues a saved review. Back in the app,
**Import review…** lists every change (old text struck through, new text below) so you can tick which to keep;
approvals show on each email in the sequence. **Download content (.json)** gives the same text as a plain file for
anyone who prefers to edit it directly; an edited content file can be imported the same way. Only text changes are
accepted on import (no links, code or layout), and no leads are included, only the sample lead.

**Hosts & sponsors**: the header shows the host logos (mobi hub | events, Paradigia), and the footer shows **Sponsored by** with a white tile for each sponsor (Sago, Sunstrike, Repocket). Replace, add, remove or reorder logos in **Settings → Hosts & sponsors**; every email updates. In the editor, the Header block can also show the sponsors, and the Footer block can hide them.

## 5. Your data, backups

- Everything lives in the **`data`** folder: `db.json` (leads, sequences, history), `uploads/` (photos, deck), `secrets.json` (Gmail tokens).
- A snapshot is saved automatically every day in `data/backups` (last 14 kept).
- **Settings → Backup & restore** downloads one `.json` file with everything (optionally including photos/deck and the Gmail connection) and restores it on any computer.

## 6. Deliverability tips

- Stay at 50–80 emails per account per day. New mailboxes should start at 30–40 and increase weekly.
- The deck PDF is about 4.5 MB. For cold first emails, consider **Link** instead of **Attach**:
  upload the PDF to Google Drive ("Anyone with the link") and paste the link in **Settings → Sponsorship deck**.
- Send yourself a test first (Editor → Send test) and check it on your phone.
- Images are embedded automatically when sending. For **Export HTML → paste into Gmail**, host the files from
  `public/brand` and `data/uploads` on your website and set **Settings → Images & hosting**.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Port 5050 is already in use" | The app is already running. Open http://localhost:5050. |
| Account shows "Reconnect needed" | Settings → Reconnect (weekly if your Google app is External + Testing). |
| "Access blocked: app not verified" | Add your address as a Test user (External), or use Internal for Workspace. |
| `redirect_uri_mismatch` | Use a Desktop app client, or add `http://localhost:5050/oauth2callback` to the Web client. |
| Follow-ups didn't go out | The app must be running during your sending window (Settings → Sending rules). Check Outbox. |

Not included in this version: Outlook / Microsoft 365 sending.
