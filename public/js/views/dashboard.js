import { D, R, esc, icon, ago, fmtDate, fullName, statusBadge, seqById, stepStats, avatar } from '../core.js';

let el;

export function render(container) {
  el = container;
  refresh();
}

export function refresh() {
  const d = D();
  const leads = d.leads;
  const count = (k) => leads.filter((l) => l.status === k).length;
  const contacted = leads.filter((l) => l.lastContactedAt).length;
  const replied = leads.filter((l) => l.lastReplyAt).length;
  const won = count('won');
  const queued = d.queue.filter((q) => q.state === 'queued');
  const rt = d.runtime.accounts || [];
  const sentToday = rt.reduce((n, a) => n + a.sentToday, 0);
  const limit = rt.reduce((n, a) => n + a.limit, 0);
  const evDate = new Date((d.settings.event.date || '2026-12-09') + 'T19:00:00+04:00');
  const days = Math.max(0, Math.ceil((evDate - Date.now()) / 86400e3));
  const conn = d.google.connected.length > 0;
  const placeholders = d.team.filter((m) => m.placeholder && m.show !== false).length;
  const testDone = d.messages.some((m) => m.test);

  const steps = [
    { done: d.google.configured, t: 'Add your Google Cloud OAuth client', go: '#/settings' },
    { done: conn, t: 'Connect your Gmail account', go: '#/settings' },
    { done: placeholders === 0, t: placeholders ? `Replace ${placeholders} placeholder team member${placeholders > 1 ? 's' : ''}` : 'Team members set up', go: '#/team' },
    { done: leads.length > 0, t: 'Import your leads from CSV', go: '#/leads?import=1' },
    { done: testDone, t: 'Send yourself a test email', go: '#/sequences/seq-bronze' },
  ];
  const setupLeft = steps.filter((s) => !s.done).length;

  const funnel = R.STATUSES.map((s) => ({ ...s, n: count(s.key) }));
  const maxN = Math.max(1, ...funnel.map((f) => f.n));

  const replies = d.messages.filter((m) => m.direction === 'in' && m.kind === 'reply').sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 6);
  const upcoming = queued.slice().sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)).slice(0, 6);

  el.innerHTML = `<div class="page">
    <div class="page-head"><div><div class="eyebrow">Paradigia · mobi hub events · Sunstrike</div><h1>Overview</h1></div>
      <div class="actions"><a class="btn" href="#/leads?import=1">${icon('upload')} Import CSV</a><a class="btn primary" href="#/leads">${icon('send')} Send to leads</a></div></div>

    <div class="card night countdown">
      <div><div class="big">${days}</div><div class="label" style="color:#CFC8F5">days to go</div></div>
      <div style="position:relative;z-index:1"><div class="eyebrow">Sponsorship & tickets</div><h2>${esc(d.settings.event.name)}</h2><div class="small" style="color:#D9D6EE">${esc(d.settings.event.footerLine1 || '')}</div></div>
    </div>
    <div class="sp16"></div>

    <div class="grid g4">
      ${kpi('Leads', leads.length, `${count('new')} not contacted yet`)}
      ${kpi('Contacted', contacted, `${leads.length ? Math.round(contacted / leads.length * 100) : 0}% of all leads`)}
      ${kpi('Replied', replied, `${contacted ? Math.round(replied / contacted * 100) : 0}% reply rate`, true)}
      ${kpi('Sent today', limit ? `${sentToday}<span class="muted" style="font-size:16px"> / ${limit}</span>` : sentToday, `${queued.length} scheduled · ${won} won`)}
    </div>
    <div class="sp16"></div>

    <div class="grid" style="grid-template-columns: minmax(0,1.25fr) minmax(0,1fr)">
      <div class="col" style="gap:16px">
        ${setupLeft ? `<div class="card accent"><div class="card-head"><h3>Get set up</h3><span class="right small muted">${steps.length - setupLeft}/${steps.length} done</span></div>
          <div class="checklist">${steps.map((s, i) => `<div class="it ${s.done ? 'done' : ''}"><span class="n">${s.done ? '✓' : i + 1}</span><span class="t grow">${esc(s.t)}</span>${s.done ? '' : `<a class="btn xs" href="${s.go}">Open</a>`}</div>`).join('')}</div></div>` : ''}
        <div class="card"><div class="card-head"><h3>Pipeline</h3><a class="right small" href="#/leads">Open leads →</a></div>
          ${funnel.map((f) => `<a class="funnel-row" href="#/leads?status=${f.key}" style="text-decoration:none;color:inherit"><span class="small">${esc(f.label)}</span><span class="bar"><i style="width:${(f.n / maxN) * 100}%;background:${f.color}"></i></span><b class="small" style="text-align:right">${f.n}</b></a>`).join('')}
        </div>
        <div class="card"><div class="card-head"><h3>Sequences</h3><a class="right small" href="#/sequences">All sequences →</a></div>
          <table class="t"><thead><tr><th>Sequence</th><th>Enrolled</th><th>Sent</th><th>Replied</th><th>Scheduled</th></tr></thead><tbody>
          ${d.sequences.map((s) => {
            const enr = d.enrollments.filter((e) => e.sequenceId === s.id);
            const st = s.steps.map((x) => stepStats(s, x));
            const sent = st.reduce((n, x) => n + x.sent, 0);
            const rep = enr.filter((e) => e.repliedAt).length;
            return `<tr onclick="location.hash='#/sequences/${s.id}'"><td><span class="row"><span class="sq" style="background:${s.color}"></span><b style="font-weight:600">${esc(s.name)}</b></span></td><td>${enr.length}</td><td>${sent}</td><td>${rep}</td><td>${st.reduce((n, x) => n + x.queued, 0)}</td></tr>`;
          }).join('')}</tbody></table>
        </div>
      </div>
      <div class="col" style="gap:16px">
        <div class="card"><div class="card-head"><h3>Latest replies</h3><a class="right small" href="#/inbox">Inbox →</a></div>
          ${replies.length ? `<div class="feed">${replies.map((m) => { const l = d.leads.find((x) => x.id === m.leadId) || {}; return `<a class="it" href="#/inbox/${m.leadId}" style="color:inherit;text-decoration:none">${avatar(fullName(l))}<div class="grow"><div class="row"><b style="font-weight:600">${esc(fullName(l))}</b><span class="muted small">${esc(l.company || '')}</span><span class="right tiny faint">${ago(m.date)}</span></div><div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.snippet || m.subject || '')}</div></div></a>`; }).join('')}</div>`
            : `<div class="small muted">No replies yet. When a lead replies, their sequence pauses automatically and the reply shows up here and in the Inbox.</div>`}
        </div>
        <div class="card"><div class="card-head"><h3>Up next</h3><a class="right small" href="#/outbox">Outbox →</a></div>
          ${upcoming.length ? `<div class="feed">${upcoming.map((q) => { const l = d.leads.find((x) => x.id === q.leadId) || {}; const s = seqById(q.sequenceId); const st = s && s.steps.find((x) => x.id === q.stepId); return `<div class="it">${icon('clock', 'faint')}<div class="grow"><b style="font-weight:600">${esc(fullName(l))}</b> <span class="muted">· ${esc(st ? st.name : '')}</span><div class="tiny faint">${esc(s ? s.name : '')}</div></div><span class="tiny muted">${Date.parse(q.scheduledAt) <= Date.now() ? 'due now' : fmtDate(q.scheduledAt)}</span></div>`; }).join('')}</div>`
            : '<div class="small muted">Nothing scheduled.</div>'}
        </div>
        <div class="card"><div class="card-head"><h3>Activity</h3></div>
          <div class="feed">${d.activity.slice(-8).reverse().map((a) => `<div class="it"><span class="sq" style="margin-top:6px;background:${a.type === 'reply' ? '#FF0055' : a.type === 'error' || a.type === 'bounce' ? '#EF4444' : '#3B1FA8'}"></span><div class="grow small">${esc(a.text)}</div><span class="tiny faint">${ago(a.at)}</span></div>`).join('') || '<div class="small muted">Nothing yet.</div>'}</div>
        </div>
      </div>
    </div>
  </div>`;
}

function kpi(label, v, sub, hl) {
  return `<div class="card kpi" ${hl ? 'style="border-color:rgba(255,0,85,.35)"' : ''}><div class="label">${label}</div><div class="v">${v}</div><div class="s">${sub}</div></div>`;
}
