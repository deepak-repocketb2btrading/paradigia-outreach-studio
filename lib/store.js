'use strict';
/*
 * Local JSON storage. Everything lives in ./data:
 *   db.json        app data (leads, sequences, messages, ...)
 *   secrets.json   Google client secret + OAuth tokens (never included in backups unless asked)
 *   uploads/       photos, deck PDF, images
 *   backups/       automatic daily snapshots (last 14 kept)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PSeed = require('../shared/seed');

function writeAtomic(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

const COLLECTIONS = ['team', 'signatures', 'sequences', 'customBlocks', 'leads', 'enrollments', 'queue', 'messages', 'suppression', 'activity', 'accounts'];

module.exports = function createStore(dataDir, rootDir) {
  const uploadsDir = path.join(dataDir, 'uploads');
  const backupsDir = path.join(dataDir, 'backups');
  for (const d of [dataDir, uploadsDir, backupsDir]) fs.mkdirSync(d, { recursive: true });
  const dbFile = path.join(dataDir, 'db.json');
  const secretsFile = path.join(dataDir, 'secrets.json');

  let db = readJson(dbFile, null);
  if (!db) {
    db = PSeed.database();
    const deck = path.join(rootDir, 'seed', 'Paradigia-Sponsorship-Deck.pdf');
    if (fs.existsSync(deck)) {
      fs.copyFileSync(deck, path.join(uploadsDir, 'Paradigia-Sponsorship-Deck.pdf'));
      db.settings.deck = { ...db.settings.deck, upload: 'upload:Paradigia-Sponsorship-Deck.pdf', size: fs.statSync(deck).size };
    }
    writeAtomic(dbFile, JSON.stringify(db, null, 1));
  }
  migrate(db);

  let secrets = readJson(secretsFile, null) || { google: { clientId: '', clientSecret: '' }, tokens: {} };

  function migrate(d) {
    for (const c of COLLECTIONS) if (!Array.isArray(d[c])) d[c] = [];
    d.sync = d.sync || {};
    const def = PSeed.settings();
    d.settings = d.settings || def;
    for (const k of Object.keys(def)) {
      if (d.settings[k] == null) d.settings[k] = def[k];
      else if (typeof def[k] === 'object' && !Array.isArray(def[k])) d.settings[k] = { ...def[k], ...d.settings[k] };
    }
  }

  let timer = null;
  function save() {
    clearTimeout(timer);
    timer = setTimeout(saveNow, 250);
  }
  function saveNow() {
    clearTimeout(timer);
    trim();
    writeAtomic(dbFile, JSON.stringify(db, null, 1));
  }
  function saveSecrets() {
    writeAtomic(secretsFile, JSON.stringify(secrets, null, 2));
  }

  // Keep the file from growing forever: cap logs and finished queue items.
  function trim() {
    if (db.activity.length > 3000) db.activity = db.activity.slice(-3000);
    const done = db.queue.filter((q) => q.state !== 'queued' && q.state !== 'sending');
    if (done.length > 3000) {
      const drop = new Set(done.slice(0, done.length - 3000).map((q) => q.id));
      db.queue = db.queue.filter((q) => !drop.has(q.id));
    }
  }

  function dailyBackup() {
    const day = new Date().toISOString().slice(0, 10);
    const file = path.join(backupsDir, `db-${day}.json`);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(db));
      const all = fs.readdirSync(backupsDir).filter((f) => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
      for (const f of all.slice(0, Math.max(0, all.length - 14))) fs.unlinkSync(path.join(backupsDir, f));
    }
  }

  const id = (prefix) => (prefix || '') + crypto.randomBytes(5).toString('hex');

  function log(type, text, extra) {
    db.activity.push({ id: id('a'), at: new Date().toISOString(), type, text, ...(extra || {}) });
    save();
  }

  /** Full backup: db + uploaded files (base64) + optionally secrets. */
  function exportBackup({ files = true, includeSecrets = false } = {}) {
    const out = { app: 'paradigia-outreach-studio', format: 1, exportedAt: new Date().toISOString(), db, files: {} };
    if (files) {
      for (const f of fs.readdirSync(uploadsDir)) {
        const p = path.join(uploadsDir, f);
        if (fs.statSync(p).isFile()) out.files[f] = fs.readFileSync(p).toString('base64');
      }
    }
    if (includeSecrets) out.secrets = secrets;
    return out;
  }

  function restoreBackup(payload) {
    if (!payload || payload.app !== 'paradigia-outreach-studio' || !payload.db) throw new Error('This file is not a Paradigia Outreach Studio backup.');
    fs.writeFileSync(path.join(backupsDir, `pre-restore-${Date.now()}.json`), JSON.stringify(db));
    for (const [name, b64] of Object.entries(payload.files || {})) {
      const safe = path.basename(name);
      fs.writeFileSync(path.join(uploadsDir, safe), Buffer.from(b64, 'base64'));
    }
    db = payload.db;
    migrate(db);
    // Queued items in a restored file would fire immediately; park them for review.
    for (const q of db.queue) if (q.state === 'sending') q.state = 'queued';
    if (payload.secrets && payload.secrets.google) { secrets = payload.secrets; saveSecrets(); }
    saveNow();
  }

  function resetAll() {
    fs.writeFileSync(path.join(backupsDir, `pre-reset-${Date.now()}.json`), JSON.stringify(db));
    const accounts = db.accounts;
    db = PSeed.database();
    db.accounts = accounts;
    if (fs.existsSync(path.join(uploadsDir, 'Paradigia-Sponsorship-Deck.pdf'))) {
      db.settings.deck = { ...db.settings.deck, upload: 'upload:Paradigia-Sponsorship-Deck.pdf', size: fs.statSync(path.join(uploadsDir, 'Paradigia-Sponsorship-Deck.pdf')).size };
    }
    saveNow();
  }

  return {
    get db() { return db; },
    get secrets() { return secrets; },
    save, saveNow, saveSecrets, dailyBackup, id, log, exportBackup, restoreBackup, resetAll,
    uploadsDir, backupsDir, dataDir,
  };
};
