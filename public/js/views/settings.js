/* Settings: Gmail (Google Cloud OAuth), sending rules, event & tiers, deck, images, unsubscribe, backup. */
import { D, R, $, $$, esc, icon, api, ok, fail, loadState, ago, fmtDate, confirmBox, copyText, upload, download, toast, clone, debounce } from '../core.js';

let wrap;
const TZ = ['Asia/Dubai', 'Asia/Riyadh', 'Asia/Qatar', 'Asia/Kolkata', 'Asia/Karachi', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'America/New_York', 'UTC'];

export function render(container, params, query) {
  container.innerHTML = '';
  wrap = document.createElement('div');
  wrap.className = 'page';
  container.appendChild(wrap);
  wrap.addEventListener('click', onClick);
  wrap.addEventListener('change', onChange);
  wrap.addEventListener('input', onInput);
  draw();
  if (query.get('connected')) { toast(`<b>Gmail connected</b>${esc(query.get('connected'))}. Syncing recent replies now.`, 'ok', 7000); history.replaceState(null, '', '#/settings'); }
  if (query.get('oauthError')) { toast(`<b>Google sign-in failed</b>${esc(query.get('oauthError'))}`, 'err', 12000); history.replaceState(null, '', '#/settings'); }
  const anchor = location.hash.split('#')[2];
  if (anchor) setTimeout(() => { const el = document.getElementById(anchor); if (el) el.scrollIntoView(); }, 50);
}
export function refresh() { const a = $('#accounts-box', wrap); if (a) a.innerHTML = accountsHtml(); }

function accountsHtml() {
  const d = D();
  if (!d.accounts.length) return '<div class="small muted">No account connected yet.</div>';
  return d.accounts.map((a) => {
    const rt = (d.runtime.accounts || []).find((x) => x.email === a.email) || {};
    const connected = d.google.connected.includes(a.email) && !a.needsReconnect;
    return `<div class="card tight" style="margin-bottom:10px;background:var(--panel-2)">
      <div class="row wrap"><span class="dot ${connected ? 'ok' : 'bad'}"></span><b>${esc(a.email)}</b><span class="small muted">${connected ? `connected ${ago(a.connectedAt)} · last sync ${a.lastSyncAt ? ago(a.lastSyncAt) : 'pending'}` : 'needs reconnect'}</span>
        <span class="right row" style="gap:6px"><a class="btn xs" href="/oauth/start?hint=${encodeURIComponent(a.email)}">${icon('refresh')} Reconnect</a><button class="btn xs danger" data-disconnect="${esc(a.email)}">Disconnect</button></span></div>
      ${a.lastError ? `<div class="notice err" style="margin-top:10px">${icon('alert')}<div class="small">${esc(a.lastError)}</div></div>` : ''}
      <div class="form-grid" style="margin-top:12px">
        <label class="field"><span>Sender name</span><input class="input sm" data-acct="${esc(a.email)}" data-k="displayName" value="${esc(a.displayName || '')}" placeholder="Shown if the signature has no name"></label>
        <label class="field"><span>Default signature</span><select class="input sm" data-acct="${esc(a.email)}" data-k="signatureId"><option value="">Automatic</option>${d.signatures.map((s) => `<option value="${s.id}" ${a.signatureId === s.id ? 'selected' : ''}>${esc(s.label || s.name)}</option>`).join('')}</select></label>
        <div class="field span2"><span>Daily sending limit: <b style="color:var(--text)" data-limv="${esc(a.email)}">${a.dailyLimit}</b> emails/day · sent today ${rt.sentToday || 0}</span>
          <input type="range" min="10" max="150" step="5" value="${a.dailyLimit}" data-acct="${esc(a.email)}" data-k="dailyLimit">
          <span class="hint">50–80 per day protects a regular Gmail/Workspace sender’s reputation. New mailboxes: start at 30–40 and increase weekly.</span></div>
      </div></div>`;
  }).join('');
}

function draw() {
  const d = D();
  const s = d.settings;
  const g = d.google;
  const ev = s.event;
  const deck = s.deck || {};
  wrap.innerHTML = `<div class="page-head"><div><div class="eyebrow">Configuration</div><h1>Settings</h1></div></div>
  <div class="settings">
    <nav class="set-nav">${[['gmail', 'Gmail connection'], ['sending', 'Sending rules'], ['event', 'Event & tiers'], ['deck', 'Sponsorship deck'], ['images', 'Images & hosting'], ['unsub', 'Unsubscribe & suppression'], ['backup', 'Backup & restore']].map(([k, l]) => `<a href="javascript:void 0" data-jump="${k}">${l}</a>`).join('')}</nav>
    <div>
      <section class="card set-sec" id="gmail"><div class="card-head"><h3>Gmail connection</h3><span class="right badge ${g.connected.length ? '' : 'outline'}" ${g.connected.length ? 'style="background:#22C55E22;color:#22C55E"' : ''}>${g.connected.length ? `${g.connected.length} connected` : 'not connected'}</span></div>
        <p class="small muted" style="margin-top:0">Emails go out from your own Gmail / Google Workspace address through the Gmail API, using your own Google Cloud project. Nothing passes through a bulk sender. Tokens stay on this computer in <span class="kbd">data/secrets.json</span>.</p>
        <details class="guide" ${g.configured ? '' : 'open'}><summary style="cursor:pointer;font-weight:600">${icon('info')} Step-by-step: create your Google Cloud OAuth client (about 5 minutes)</summary>
          <ol>
            <li>Open <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">Google Cloud Console → New project</a>. Name it e.g. <code>Paradigia Outreach</code> and create it.</li>
            <li>Enable the Gmail API: <a href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noopener">APIs &amp; Services → Library → Gmail API</a> → <b>Enable</b>.</li>
            <li>Set up the consent screen: <a href="https://console.cloud.google.com/auth/overview" target="_blank" rel="noopener">Google Auth Platform → Branding / Audience</a>. App name <code>Paradigia Outreach Studio</code>, your email as support and developer contact.
              <br><b>Audience:</b> if your address is on Google Workspace (e.g. @mobi-hub.com), choose <b>Internal</b>: no review and no weekly re-login. For a personal @gmail.com choose <b>External</b>, keep it in <b>Testing</b> and add your address under <b>Test users</b> (Google then asks you to reconnect every 7 days).</li>
            <li>Under <b>Data access</b>, add the scopes <code>…/auth/gmail.send</code> and <code>…/auth/gmail.readonly</code>.</li>
            <li>Create credentials: <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Credentials → Create credentials → OAuth client ID</a>. Application type <b>Desktop app</b> (simplest), or <b>Web application</b> with this Authorized redirect URI:<br>
              <span class="row" style="margin-top:6px"><code>${esc(g.redirectUri)}</code><button class="btn xs" data-copy="${esc(g.redirectUri)}">${icon('copy')} Copy</button></span></li>
            <li>Download the JSON (or copy the Client ID and Client secret) and add it below, then click <b>Connect Gmail</b>. If Google shows “app isn’t verified”, click <b>Advanced → Continue</b>: it’s your own app.</li>
          </ol></details>
        <div class="sp16"></div>
        <div class="form-grid">
          <label class="field"><span>Client ID</span><input class="input" data-g="clientId" placeholder="${g.clientId ? esc(g.clientId) + ' (saved)' : '1234…apps.googleusercontent.com'}"></label>
          <label class="field"><span>Client secret</span><input class="input" type="password" data-g="clientSecret" placeholder="${g.configured ? '•••••••• (saved)' : 'GOCSPX-…'}"></label>
        </div>
        <div class="row wrap" style="margin-top:12px"><button class="btn" data-savecred>${icon('check')} Save credentials</button><button class="btn" data-credjson>${icon('upload')} Upload client_secret JSON</button>
          <span class="grow"></span>${g.configured ? `<a class="btn primary upper" href="/oauth/start">${icon('mail')} Connect Gmail${g.connected.length ? ' account' : ''}</a>` : '<span class="small muted">Save credentials to enable Connect.</span>'}</div>
        <div class="sp16"></div><div class="label" style="margin-bottom:10px">Connected accounts</div><div id="accounts-box">${accountsHtml()}</div>
        <div class="small faint">Outlook / Microsoft 365 isn’t supported in this version.</div>
      </section>

      <section class="card set-sec" id="sending"><div class="card-head"><h3>Sending rules</h3></div>
        <div class="form-grid">
          <label class="field"><span>Time zone</span><select class="input" data-s="sending.timezone">${TZ.map((t) => `<option ${t === s.sending.timezone ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <div class="field"><span>Sending window</span><div class="row"><input type="time" class="input" data-s="sending.windowStart" value="${esc(s.sending.windowStart)}"><span class="muted">to</span><input type="time" class="input" data-s="sending.windowEnd" value="${esc(s.sending.windowEnd)}"></div><span class="hint">Batches and automatic follow-ups only go out inside this window.</span></div>
          <label class="field"><span>Gap between emails (seconds)</span><input type="number" min="15" class="input" data-s="sending.gapSeconds" value="${s.sending.gapSeconds}"><span class="hint">Randomised ±25% so sending looks human. 60–120s recommended.</span></label>
          <label class="field"><span>Check for replies every (minutes)</span><input type="number" min="1" class="input" data-s="sending.syncMinutes" value="${s.sending.syncMinutes}"><span class="hint">Follow-ups also re-check the thread right before sending.</span></label>
          <div class="field"><span>Weekends</span><label class="switch"><input type="checkbox" data-s="sending.skipWeekends" ${s.sending.skipWeekends ? 'checked' : ''}><span class="tr"></span>Don’t send on Saturday and Sunday</label></div>
          <div class="field"><span>Out-of-office replies</span><label class="switch"><input type="checkbox" data-s="sending.autoReplyPauses" ${s.sending.autoReplyPauses ? 'checked' : ''}><span class="tr"></span>Pause the sequence on auto-replies too</label></div>
          <label class="field"><span>Default daily limit for new accounts</span><input type="number" class="input" data-s="sending.defaultDailyLimit" value="${s.sending.defaultDailyLimit}"></label>
          <label class="field"><span>Test emails go to</span><input class="input" data-s="testEmail" value="${esc(s.testEmail || '')}" placeholder="Your connected address"></label>
        </div></section>

      <section class="card set-sec" id="event"><div class="card-head"><h3>Event & tiers</h3></div>
        <div class="form-grid">
          <label class="field"><span>Event name</span><input class="input" data-s="event.name" value="${esc(ev.name)}"></label>
          <label class="field"><span>Date label</span><input class="input" data-s="event.dateLabel" value="${esc(ev.dateLabel)}"></label>
          <label class="field"><span>Event date (for countdown and fixed-date emails)</span><input type="date" class="input" data-s="event.date" value="${esc(ev.date)}"></label>
          <label class="field"><span>Spots left ({{spots_left}})</span><input class="input" data-s="event.spotsLeft" value="${esc(ev.spotsLeft || '')}" placeholder="e.g. 40"></label>
          <label class="field span2"><span>Ticket link ({{ticket_link}})</span><input class="input" data-s="event.ticketLink" value="${esc(ev.ticketLink)}"></label>
          <label class="field span2"><span>Footer line 1</span><input class="input" data-s="event.footerLine1" value="${esc(ev.footerLine1 || '')}"></label>
          <label class="field span2"><span>Footer line 2</span><input class="input" data-s="event.footerLine2" value="${esc(ev.footerLine2 || '')}"></label>
        </div>
        <div class="sp16"></div><div class="label">Tiers (from the deck)</div><div class="sp8"></div>
        <div class="grid g2">${R.TIER_ORDER.map((k) => { const t = s.tiers[k]; return `<div class="card tight" style="background:var(--panel-2);border-left:4px solid ${R.TIER_COLORS[k]}">
          <div class="row"><span class="tier ${k}">${esc(t.name)}</span></div><div class="sp8"></div>
          <div class="form-grid"><label class="field"><span>Price (USD)</span><input type="number" class="input sm" data-tier="${k}" data-tk="price" value="${t.price}"></label><label class="field"><span>Guest passes</span><input class="input sm" data-tier="${k}" data-tk="passes" value="${esc(t.passes)}"></label>
          <label class="field span2"><span>Tagline</span><input class="input sm" data-tier="${k}" data-tk="tagline" value="${esc(t.tagline)}"></label>
          <label class="field span2"><span>Benefits (one per line)</span><textarea class="input" rows="4" data-tier="${k}" data-tk="benefits">${esc((t.benefits || []).join('\n'))}</textarea></label></div></div>`; }).join('')}</div>
        <div class="sp16"></div><div class="label">Comparison table</div><div class="sp8"></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Row</th>${R.TIER_ORDER.map((k) => `<th style="color:${R.TIER_COLORS[k]}">${esc(s.tiers[k].name)}</th>`).join('')}</tr></thead><tbody>
          ${s.comparison.map((row, i) => `<tr style="cursor:default">${row.map((c, j) => `<td><input class="input sm" data-cmp="${i}|${j}" value="${esc(c)}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>
      </section>

      <section class="card set-sec" id="deck"><div class="card-head"><h3>Sponsorship deck</h3></div>
        <div class="row wrap"><span class="av" style="border-radius:8px;width:44px;height:44px">${icon('file')}</span>
          <div class="grow"><b>${esc(deck.fileName || 'No deck uploaded')}</b><div class="small muted">${deck.size ? `${(deck.size / 1048576).toFixed(1)} MB` : ''}${deck.uploadedAt ? ` · uploaded ${fmtDate(deck.uploadedAt)}` : ''}</div></div>
          ${deck.upload ? `<a class="btn sm" href="${esc(deck.upload.replace(/^upload:/, '/uploads/'))}" target="_blank">${icon('eye')} Open</a>` : ''}
          <button class="btn primary sm" data-deckup>${icon('upload')} ${deck.upload ? 'Replace PDF' : 'Upload PDF'}</button></div>
        ${deck.size > 10 * 1048576 ? `<div class="sp8"></div><div class="notice warn">${icon('alert')}<div>This PDF is over 10 MB. Large attachments often land in spam or bounce (Gmail’s hard limit is 25 MB). Compress it, or use “Link to deck instead of attaching”.</div></div>` : ''}
        <div class="sp16"></div>
        <label class="field"><span>Hosted deck link (for “Link to deck instead of attaching” and the signature’s “Download Sponsorship Deck”)</span><input class="input" data-s="deck.hostedUrl" value="${esc(deck.hostedUrl || '')}" placeholder="https://drive.google.com/… or https://yoursite.com/deck.pdf"><span class="hint">Tip: upload the PDF to Google Drive, set sharing to “Anyone with the link can view”, and paste the link here. Without it, the link asks the lead to reply for the deck.</span></label>
        <div class="sp8"></div><div class="small muted">Whether the deck is attached, linked or left out is chosen per email and remembered per sequence.</div>
      </section>

      <section class="card set-sec" id="images"><div class="card-head"><h3>Images & hosting</h3></div>
        <p class="small muted" style="margin-top:0">When you send from this app, logos, photos and icons are embedded in the email automatically, so you don’t need any hosting. A public image URL is only needed for <b>Export HTML</b> when you paste into Gmail or another tool.</p>
        <label class="field"><span>Public image base URL (optional)</span><input class="input" data-s="publicAssetBase" value="${esc(s.publicAssetBase || '')}" placeholder="https://www.mobi-hub.com/email-assets"><span class="hint">Upload every file from the app’s <span class="kbd">public/brand</span> and <span class="kbd">data/uploads</span> folders to that address. When set, sent emails and exports reference those URLs instead of embedding images.</span></label>
      </section>

      <section class="card set-sec" id="unsub"><div class="card-head"><h3>Unsubscribe & suppression</h3></div>
        <div class="form-grid">
          <div class="field"><span>Unsubscribe link</span><div class="seg" data-unsub><button data-v="mailto" class="${s.unsubscribe.mode !== 'url' ? 'on pink' : ''}">Reply “unsubscribe” (automatic)</button><button data-v="url" class="${s.unsubscribe.mode === 'url' ? 'on pink' : ''}">My own unsubscribe page</button></div>
            <span class="hint">The default opens a pre-filled email. The app reads it, marks the lead Unsubscribed and adds them to the suppression list. Gmail’s one-click unsubscribe header is included too.</span></div>
          <label class="field"><span>Link text</span><input class="input" data-s="unsubscribe.text" value="${esc(s.unsubscribe.text || 'Unsubscribe')}"></label>
          ${s.unsubscribe.mode === 'url' ? `<label class="field span2"><span>Unsubscribe page URL</span><input class="input" data-s="unsubscribe.url" value="${esc(s.unsubscribe.url || '')}" placeholder="https://"></label>` : ''}
        </div>
        <div class="sp16"></div>
        <div class="row"><div class="label">Suppression list (${d.suppression.length})</div><span class="grow"></span><input class="input sm" style="width:240px" data-supp placeholder="email@company.com"><button class="btn sm" data-suppadd>${icon('plus')} Suppress</button></div>
        <div class="sp8"></div><div class="small muted">These addresses never receive email from this app (unsubscribes and bounces are added automatically).</div><div class="sp8"></div>
        ${d.suppression.length ? `<div class="table-wrap" style="max-height:280px"><table class="t"><thead><tr><th>Email</th><th>Reason</th><th>Added</th><th></th></tr></thead><tbody>${d.suppression.slice().reverse().map((x) => `<tr style="cursor:default"><td>${esc(x.email)}</td><td><span class="badge outline">${esc(x.reason)}</span></td><td class="small muted">${fmtDate(x.at)}</td><td style="text-align:right"><button class="btn xs ghost" data-unsupp="${esc(x.email)}">Remove</button></td></tr>`).join('')}</tbody></table></div>` : ''}
      </section>

      <section class="card set-sec" id="backup"><div class="card-head"><h3>Backup & restore</h3></div>
        <p class="small muted" style="margin-top:0">All data is saved locally in <span class="kbd">${esc(d.paths.data)}</span>. A snapshot is also saved automatically every day in <span class="kbd">data/backups</span> (last 14 kept).</p>
        <div class="row wrap"><label class="check"><input type="checkbox" data-bfiles checked> Include photos, images and the deck PDF</label><label class="check"><input type="checkbox" data-bsecrets> Include Gmail connection (sensitive: keep the file private)</label></div>
        <div class="sp8"></div>
        <div class="row wrap"><button class="btn primary" data-backup>${icon('download')} Download backup (.json)</button><button class="btn" data-restore>${icon('upload')} Restore from backup…</button><span class="grow"></span><button class="btn danger sm" data-reset>Reset templates & data</button></div>
      </section>
    </div>
  </div>`;
}

/* ----------------------------------------------------------------- saving */
const pendingSettings = {};
const flush = debounce(async () => {
  const patch = clone(pendingSettings);
  for (const k of Object.keys(pendingSettings)) delete pendingSettings[k];
  try { await api('PUT', '/api/settings', patch); await loadState(); ok('Settings saved'); } catch (e) { fail(e); }
}, 700);

function setSetting(path, value) {
  const [a, b] = path.split('.');
  if (b) pendingSettings[a] = { ...(pendingSettings[a] || {}), [b]: value };
  else pendingSettings[a] = value;
  flush();
}

function onInput(e) {
  const t = e.target;
  if (t.dataset.s && t.type !== 'checkbox' && t.tagName !== 'SELECT') setSetting(t.dataset.s, t.type === 'number' ? Number(t.value) : t.value);
  if (t.dataset.tier) {
    const tiers = clone(D().settings.tiers);
    const v = t.dataset.tk === 'benefits' ? t.value.split('\n').map((x) => x.trim()).filter(Boolean) : t.dataset.tk === 'price' ? Number(t.value) : t.value;
    pendingSettings.tiers = { ...(pendingSettings.tiers || tiers) };
    pendingSettings.tiers[t.dataset.tier] = { ...pendingSettings.tiers[t.dataset.tier], [t.dataset.tk]: v };
    flush();
  }
  if (t.dataset.cmp) {
    const [i, j] = t.dataset.cmp.split('|').map(Number);
    const cmp = pendingSettings.comparison || clone(D().settings.comparison);
    cmp[i][j] = t.value;
    pendingSettings.comparison = cmp;
    flush();
  }
  if (t.dataset.acct && t.dataset.k === 'dailyLimit') { const v = $(`[data-limv="${t.dataset.acct}"]`, wrap); if (v) v.textContent = t.value; }
}

const acctSave = debounce(async (email, patch) => { try { await api('PUT', `/api/accounts/${encodeURIComponent(email)}`, patch); await loadState(); ok('Account updated'); } catch (e) { fail(e); } }, 500);

function onChange(e) {
  const t = e.target;
  if (t.dataset.s && (t.type === 'checkbox' || t.tagName === 'SELECT')) setSetting(t.dataset.s, t.type === 'checkbox' ? t.checked : t.value);
  if (t.dataset.acct) acctSave(t.dataset.acct, { [t.dataset.k]: t.dataset.k === 'dailyLimit' ? Number(t.value) : t.value });
}

async function onClick(e) {
  const b = e.target.closest('button, a[data-jump]');
  if (!b) return;
  try {
    if (b.dataset.jump) { document.getElementById(b.dataset.jump).scrollIntoView({ behavior: 'smooth' }); return; }
    if (b.dataset.copy) copyText(b.dataset.copy);
    else if (b.matches('[data-savecred]')) {
      const clientId = $('[data-g="clientId"]', wrap).value.trim();
      const clientSecret = $('[data-g="clientSecret"]', wrap).value.trim();
      if (!clientId || !clientSecret) { fail('Enter both the Client ID and the Client secret.'); return; }
      await api('PUT', '/api/google/credentials', { clientId, clientSecret });
      await loadState(); draw(); ok('Credentials saved. Now click Connect Gmail.');
    } else if (b.matches('[data-credjson]')) {
      const file = await new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = () => res(i.files[0]); i.click(); });
      if (!file) return;
      await api('PUT', '/api/google/credentials', { json: await file.text() });
      await loadState(); draw(); ok('Credentials loaded from JSON. Now click Connect Gmail.');
    } else if (b.dataset.disconnect) {
      if (await confirmBox(`Disconnect <b>${esc(b.dataset.disconnect)}</b>? Scheduled emails from this account wait until it’s reconnected.`, { okText: 'Disconnect', danger: true })) {
        await api('POST', `/api/accounts/${encodeURIComponent(b.dataset.disconnect)}/disconnect`); await loadState(); draw();
      }
    } else if (b.matches('[data-deckup]')) {
      const file = await new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/pdf,.pdf'; i.onchange = () => res(i.files[0]); i.click(); });
      if (!file) return;
      if (file.size > 10 * 1048576 && !(await confirmBox(`This PDF is ${(file.size / 1048576).toFixed(1)} MB. Files over 10 MB often hurt deliverability, and Gmail rejects attachments over 25 MB. Upload anyway?`, { okText: 'Upload anyway' }))) return;
      b.disabled = true; b.textContent = 'Uploading…';
      const r = await upload(file, 'deck');
      await loadState(); draw();
      ok(r.warn ? 'Deck uploaded (over 10 MB: consider linking instead)' : 'Deck uploaded');
    } else if (b.closest('[data-unsub]')) { setSetting('unsubscribe.mode', b.dataset.v); setTimeout(draw, 900); }
    else if (b.matches('[data-suppadd]')) { const v = $('[data-supp]', wrap).value.trim(); if (!v) return; await api('POST', '/api/suppression', { email: v, reason: 'manual' }); await loadState(); draw(); ok('Suppressed'); }
    else if (b.dataset.unsupp) { if (await confirmBox(`Allow emails to <b>${esc(b.dataset.unsupp)}</b> again? Only do this if they asked to hear from you.`, { okText: 'Remove from list' })) { await api('DELETE', `/api/suppression/${encodeURIComponent(b.dataset.unsupp)}`); await loadState(); draw(); } }
    else if (b.matches('[data-backup]')) {
      const files = $('[data-bfiles]', wrap).checked ? 1 : 0;
      const secrets = $('[data-bsecrets]', wrap).checked ? 1 : 0;
      const a = document.createElement('a');
      a.href = `/api/backup?files=${files}&secrets=${secrets}`;
      document.body.appendChild(a); a.click(); a.remove();
      ok('Backup downloading');
    } else if (b.matches('[data-restore]')) {
      const file = await new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = () => res(i.files[0]); i.click(); });
      if (!file) return;
      let payload;
      try { payload = JSON.parse(await file.text()); } catch { fail('That file is not valid JSON.'); return; }
      if (payload.app !== 'paradigia-outreach-studio') { fail('That file is not a Paradigia Outreach Studio backup.'); return; }
      const n = (payload.db.leads || []).length;
      if (!(await confirmBox(`Restore the backup from <b>${fmtDate(payload.exportedAt)}</b> with ${n} leads and ${(payload.db.sequences || []).length} sequences? Your current data is replaced (a safety copy is saved in data/backups first).`, { okText: 'Restore', danger: true }))) return;
      await api('POST', '/api/restore', payload);
      await loadState(); draw(); ok('Backup restored');
    } else if (b.matches('[data-reset]')) {
      if (await confirmBox('Reset everything to the original templates? <b>All leads, sequences, team and history are erased</b> (a safety copy is saved in data/backups). Gmail stays connected.', { okText: 'Erase and reset', danger: true })) {
        await api('POST', '/api/reset'); await loadState(); draw(); ok('Reset to defaults');
      }
    }
  } catch (err) { fail(err); if (b.matches('[data-deckup]')) { b.disabled = false; } }
}
export { $$ };
