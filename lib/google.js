'use strict';
/*
 * Google OAuth (your own Cloud Console client) + Gmail REST API, no SDK needed.
 * Scopes: gmail.send (send as you) and gmail.readonly (read replies / bounces).
 */
const crypto = require('crypto');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

class ReconnectError extends Error {}

module.exports = function createGoogle(store, port) {
  const redirectUri = () => `http://localhost:${port}/oauth2callback`;
  const pending = new Map(); // state -> created
  const refreshing = new Map(); // email -> Promise

  function configured() {
    const g = store.secrets.google || {};
    return !!(g.clientId && g.clientSecret);
  }

  function authUrl(loginHint) {
    if (!configured()) throw new Error('Add your Google OAuth Client ID and Secret first.');
    const state = crypto.randomBytes(16).toString('hex');
    pending.set(state, Date.now());
    for (const [k, t] of pending) if (Date.now() - t > 15 * 60e3) pending.delete(k);
    const q = new URLSearchParams({
      client_id: store.secrets.google.clientId,
      redirect_uri: redirectUri(),
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    if (loginHint) q.set('login_hint', loginHint);
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }

  async function tokenRequest(params) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: store.secrets.google.clientId, client_secret: store.secrets.google.clientSecret, ...params }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(json.error_description || json.error || `Token request failed (${res.status})`);
      err.code = json.error;
      throw err;
    }
    return json;
  }

  /** OAuth callback: exchange code, identify the mailbox, store tokens. Returns the account email. */
  async function handleCallback(query) {
    if (query.error) throw new Error(`Google returned: ${query.error}`);
    if (!query.state || !pending.has(query.state)) throw new Error('Sign-in session expired. Please click Connect again.');
    pending.delete(query.state);
    const tok = await tokenRequest({ code: query.code, redirect_uri: redirectUri(), grant_type: 'authorization_code' });
    const granted = String(tok.scope || '');
    if (!granted.includes('gmail.send') || !granted.includes('gmail.readonly')) {
      throw new Error('Gmail permissions were not granted. Please tick both checkboxes on the Google consent screen.');
    }
    const profile = await (await fetch(`${GMAIL}/profile`, { headers: { Authorization: `Bearer ${tok.access_token}` } })).json();
    const email = String(profile.emailAddress || '').toLowerCase();
    if (!email) throw new Error('Could not read the Gmail address for this account.');
    const prev = store.secrets.tokens[email] || {};
    store.secrets.tokens[email] = {
      access_token: tok.access_token,
      refresh_token: tok.refresh_token || prev.refresh_token,
      expiry: Date.now() + (tok.expires_in || 3600) * 1000,
    };
    store.saveSecrets();

    let displayName = '';
    try {
      const sa = await (await fetch(`${GMAIL}/settings/sendAs`, { headers: { Authorization: `Bearer ${tok.access_token}` } })).json();
      const primary = (sa.sendAs || []).find((x) => x.isPrimary) || (sa.sendAs || [])[0];
      displayName = (primary && primary.displayName) || '';
    } catch { /* optional */ }

    const db = store.db;
    let acct = db.accounts.find((a) => a.email === email);
    if (!acct) {
      acct = { email, displayName, dailyLimit: db.settings.sending.defaultDailyLimit || 60, connectedAt: new Date().toISOString(), signatureId: '' };
      db.accounts.push(acct);
    }
    if (!acct.displayName && displayName) acct.displayName = displayName;
    acct.needsReconnect = false;
    acct.lastError = '';
    store.log('account', `Connected Gmail ${email}`);
    store.save();
    return email;
  }

  async function accessToken(email, force) {
    const t = store.secrets.tokens[email];
    if (!t || !t.refresh_token) throw new ReconnectError(`${email} is not connected. Connect it in Settings.`);
    if (!force && t.access_token && t.expiry - Date.now() > 90e3) return t.access_token;
    if (refreshing.has(email)) return refreshing.get(email);
    const p = (async () => {
      try {
        const tok = await tokenRequest({ refresh_token: t.refresh_token, grant_type: 'refresh_token' });
        t.access_token = tok.access_token;
        t.expiry = Date.now() + (tok.expires_in || 3600) * 1000;
        if (tok.refresh_token) t.refresh_token = tok.refresh_token;
        store.saveSecrets();
        return t.access_token;
      } catch (e) {
        if (e.code === 'invalid_grant' || e.code === 'unauthorized_client') {
          const acct = store.db.accounts.find((a) => a.email === email);
          if (acct) { acct.needsReconnect = true; acct.lastError = 'Google access expired or was revoked. Click Reconnect.'; store.save(); }
          throw new ReconnectError(`${email}: Google access expired or was revoked. Reconnect it in Settings.`);
        }
        if (e.code === 'invalid_client') {
          const acct = store.db.accounts.find((a) => a.email === email);
          if (acct) { acct.needsReconnect = true; acct.lastError = 'Google rejected the OAuth client. Re-enter the Client ID and secret, then click Reconnect.'; store.save(); }
          throw new ReconnectError(`${email}: Google rejected the OAuth client ID/secret.`);
        }
        throw e;
      } finally {
        refreshing.delete(email);
      }
    })();
    refreshing.set(email, p);
    return p;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Authenticated Gmail API call with refresh + simple retry on 429/5xx. */
  async function api(email, method, url, { json, body, headers, query } = {}) {
    let full = url.startsWith('http') ? url : `${GMAIL}${url}`;
    if (query) full += (full.includes('?') ? '&' : '?') + new URLSearchParams(query);
    let forced = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      const token = await accessToken(email, forced);
      const res = await fetch(full, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(json ? { 'Content-Type': 'application/json' } : {}), ...(headers || {}) },
        body: json ? JSON.stringify(json) : body,
      });
      if (res.status === 401 && !forced) { forced = true; continue; }
      if (res.status === 429 || res.status >= 500) { await sleep(1000 * 2 ** attempt); continue; }
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      if (!res.ok) {
        const msg = (data.error && data.error.message) || text || res.statusText;
        const err = new Error(`Gmail API ${res.status}: ${msg}`);
        err.status = res.status;
        if (res.status === 403 && /insufficient/i.test(msg)) {
          const acct = store.db.accounts.find((a) => a.email === email);
          if (acct) { acct.needsReconnect = true; acct.lastError = 'Missing Gmail permissions. Click Reconnect and allow both.'; store.save(); }
        }
        throw err;
      }
      return data;
    }
    throw new Error('Gmail API is busy, will retry later.');
  }

  /** Send a raw MIME message (optionally inside an existing thread). */
  async function sendRaw(email, raw, threadId) {
    const bytes = Buffer.byteLength(raw);
    if (bytes < 4.5 * 1024 * 1024) {
      return api(email, 'POST', '/messages/send', { json: { raw: Buffer.from(raw).toString('base64url'), ...(threadId ? { threadId } : {}) } });
    }
    // Larger messages (big PDF): multipart upload endpoint, up to 35 MB.
    const b = `upload_${crypto.randomBytes(8).toString('hex')}`;
    const payload = Buffer.concat([
      Buffer.from(`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(threadId ? { threadId } : {})}\r\n--${b}\r\nContent-Type: message/rfc822\r\n\r\n`),
      Buffer.from(raw),
      Buffer.from(`\r\n--${b}--`),
    ]);
    return api(email, 'POST', 'https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=multipart', {
      body: payload, headers: { 'Content-Type': `multipart/related; boundary=${b}` },
    });
  }

  function disconnect(email) {
    const t = store.secrets.tokens[email];
    if (t && t.refresh_token) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t.refresh_token)}`, { method: 'POST' }).catch(() => {});
    }
    delete store.secrets.tokens[email];
    store.saveSecrets();
  }

  return { SCOPES, redirectUri, configured, authUrl, handleCallback, accessToken, api, sendRaw, disconnect, ReconnectError };
};
