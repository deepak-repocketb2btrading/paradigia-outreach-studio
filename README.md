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

Five ready-made sequences with 3 subject lines per email, WhatsApp and LinkedIn versions:

| Sequence | Emails |
|---|---|
| Bronze Sponsor Push (warm clients) | Day 0 intro · Day 4 benefits · Day 9 last call · Day 14 meet me on the yacht |
| Premium and Gold Pitch (decision makers) | Intro · ROI and visibility · Tier comparison |
| Ticket Sales | Announcement · Spots left · Final week (Dec 2) · Day before (Dec 8) |
| Sponsor Onboarding | Thank you · Logo and asset request · Event-day details (Dec 7) |
| Post-event | Thank you (Dec 10) · Follow-up |

**Sequences → Edit design** opens the editor:
- Click any text in the email to edit it. A toolbar adds bold, links, bullets and merge fields
  (`{{first_name}}`, `{{company}}`, `{{sender_name}}`, `{{tier}}`, `{{price}}`, `{{ticket_link}}`, …).
- Block library: header, hero, text, tier card, comparison table, benefits list, "why partner" box,
  CTA buttons, image, divider, Meet the Team, signature, footer. Save any block as reusable.
- Desktop / mobile / dark-mode preview, preview with a real lead's data, **Send test**, **Export HTML**.
- Per email: A/B subject testing, preheader, timing (days after previous, or a fixed date),
  same-thread follow-ups, and the **sponsorship deck toggle** (attach PDF / link / off, remembered per sequence).

Placeholders in square brackets (e.g. `[BOARDING POINT]`, `[DRESS CODE]`, `[ASSET DEADLINE]`) are flagged before sending. Fill them in first.

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
