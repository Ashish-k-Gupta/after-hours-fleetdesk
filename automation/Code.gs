/**
 * AFTER HOURS — DAILY FMCSA SHORTLIST
 * Daily discovery and initial outreach for afterhours.fleetdesk@gmail.com.
 * Sends at most 99 initial prospect emails daily. Replies and follow-ups stay manual.
 * Run installDailyCheck once after reviewing Google's permission request.
 */
const AH = Object.freeze({
  mailbox: 'afterhours.fleetdesk@gmail.com', timezone: 'Asia/Kolkata', hour: 23,
  census: 'az4n-8mr2', carrier: 'inys-ebih', history: 'yu5v-wbh6', delta: 'dm5j-zc6c',
  inspections: 'fx4q-ay7w', property: 'Motor Carrier of Property (Except Household Goods)',
  authorityDays: 7, activityDays: 90,
  mainLimit: 99, holdLimit: 5, checkLimit: 500, maximumRows: 12000,
  subject: 'FMCSA daily shortlist'
});

function installDailyCheck() {
  testRules();
  assertMailbox_();
  runDailyCheck(); // A successful first report is required before scheduling.
  const matches = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'runDailyCheck');
  if (!matches.length) {
    ScriptApp.newTrigger('runDailyCheck').timeBased().atHour(AH.hour).nearMinute(10)
      .everyDays(1).inTimezone(AH.timezone).create();
  }
  // Repair only duplicate triggers for this project's own handler.
  matches.slice(1).forEach(t => ScriptApp.deleteTrigger(t));
  console.log('Daily outreach installed around 11 PM India time. Initial emails only; cap 99 and a business-mailbox summary.');
}

function runResearchOnly_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    assertMailbox_();
    const today = Utilities.formatDate(new Date(), AH.timezone, 'yyyy-MM-dd');
    const properties = PropertiesService.getScriptProperties();
    const subject = AH.subject + ' — ' + today;
    if (properties.getProperty('lastReportDate') === today || ownReportExists_(subject)) {
      console.log('Today\'s report already exists; no duplicate sent.');
      return;
    }
    const state = properties.getProperties();
    const result = collectShortlist_(state);
    const text = renderReport_(result, today);
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error('No email quota available for the report.');
    sendSelf_(subject, text);
    const changes = { lastReportDate: today };
    result.main.concat(result.hold).forEach(c => {
      changes[listedKey_(c)] = today;
      changes[emailKey_(c)] = today;
    });
    properties.setProperties(changes, false);
    console.log('Report sent: ' + result.main.length + ' main; ' + result.hold.length + ' held for verification.');
  } catch (error) {
    // No cursor is advanced on failure, so a later run can retry the data window.
    console.error(String(error.message || error).slice(0, 250));
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function assertMailbox_() {
  const profile = Gmail.Users.getProfile('me');
  if (String(profile.emailAddress || '').toLowerCase() !== AH.mailbox) {
    throw new Error('Wrong Google account. Run this project only as ' + AH.mailbox + '.');
  }
}
function ownReportExists_(subject) {
  const found = Gmail.Users.Messages.list('me', {
    q: 'in:anywhere from:' + AH.mailbox + ' to:' + AH.mailbox + ' subject:"' + subject + '"',
    maxResults: 1, includeSpamTrash: true
  });
  return !!(found.messages && found.messages.length);
}
function sendSelf_(subject, body) {
  // Fixed recipient: no carrier address is ever supplied to MailApp.
  MailApp.sendEmail({ to: AH.mailbox, subject: subject, body: body,
    name: 'After Hours | Fleet Desk', replyTo: AH.mailbox });
}
function dayAgo_(days) {
  return Utilities.formatDate(new Date(Date.now() - days * 86400000), 'UTC', 'yyyyMMdd');
}
function clean_(value) { return String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').trim(); }
function dateText_(value) {
  const s = clean_(value);
  return /^\d{8}$/.test(s) ? s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6) : s || 'Not reported';
}
function email_(value) {
  const e = clean_(value).toLowerCase();
  return /^[a-z0-9][a-z0-9._%+\-]*@[a-z0-9](?:[a-z0-9.\-]*[a-z0-9])?\.[a-z]{2,63}$/.test(e) ? e : '';
}
function publicJson_(url) {
  if (outreachDeadline_ && Date.now() > outreachDeadline_) throw new Error('Discovery time budget reached. No outreach queue was sent.');
  const hosts = ['https://data.transportation.gov/', 'https://dns.google/'];
  if (!hosts.some(h => url.indexOf(h) === 0)) throw new Error('Unexpected public-data destination.');
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: false });
    const status = response.getResponseCode();
    if (status === 200) return JSON.parse(response.getContentText());
    if ((status === 429 || status >= 500) && attempt === 0) { Utilities.sleep(1000); continue; }
    throw new Error('Public data request failed with HTTP ' + status + '. No shortlist was sent.');
  }
  throw new Error('Public data unavailable.');
}
function rows_(id, parameters) {
  const output = [];
  for (let offset = 0; offset < AH.maximumRows; offset += 500) {
    const params = Object.assign({}, parameters, { '$limit': 500, '$offset': offset });
    const query = Object.keys(params).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
    const part = publicJson_('https://data.transportation.gov/resource/' + id + '.json?' + query);
    if (!Array.isArray(part)) throw new Error('Unexpected FMCSA response shape.');
    output.push.apply(output, part);
    if (part.length < 500) return output;
  }
  throw new Error('FMCSA result exceeds the configured page limit; review before continuing.');
}
function snapshot_(id) {
  const metadata = publicJson_('https://data.transportation.gov/api/views/' + id + '.json');
  const raw = Number(metadata.rowsUpdatedAt);
  const when = raw > 0 ? new Date(raw * 1000) : null;
  return { id: id, updated: when ? when.toISOString() : 'Unknown',
    fresh: !!when && Date.now() - when.getTime() < 72 * 3600000 };
}
function censusFilter_() {
  return "status_code='A' AND phy_country='US' AND carrier_operation='A' AND carship='C'" +
    " AND power_units in ('5','6','7','8','9','10','11','12','13','14','15')" +
    " AND classdef like '%AUTHORIZED FOR HIRE%' AND (crgo_genfreight='X' OR crgo_coldfood='X')" +
    " AND (crgo_passengers IS NULL OR crgo_passengers<>'X')" +
    " AND (crgo_household IS NULL OR crgo_household<>'X')";
}
function censusColumns_() {
  return 'dot_number,legal_name,add_date,status_code,phy_city,phy_state,phy_country,carrier_operation,' +
    'carship,classdef,power_units,total_drivers,email_address,phone,crgo_genfreight,crgo_coldfood,' +
    'crgo_liqgas,crgo_oilfield,crgo_garbage,crgo_household,crgo_passengers';
}
function batches_(dots, size, operation) {
  const result = [];
  for (let i = 0; i < dots.length; i += size) {
    const batch = dots.slice(i, i + size).map(String);
    if (!batch.every(d => /^\d+$/.test(d))) throw new Error('Invalid USDOT identifier in feed.');
    result.push.apply(result, operation(batch));
  }
  return result;
}
function activityEligible_(c, fresh) {
  return !!fresh && c.authorized && c.insured && !!c.lastInspection && !c.specialty;
}
function collectShortlist_(state) {
  const snapshots = [AH.census, AH.carrier, AH.history, AH.delta, AH.inspections].map(snapshot_);
  const fresh = snapshots.every(s => s.fresh);
  const censusPage = censusScanPage_();
  const recent = censusPage.rows;
  const grantFilter = "upper(reason)='GRANTED' AND upper(op_auth_status)='ACTIVE'" +
    " AND op_auth_type='" + AH.property + "' AND status_change_date>='" + dayAgo_(AH.authorityDays) + "'";
  const grantParams = { '$select': 'usdot_number,docket_number,status_change_date,reason,op_auth_status',
    '$where': grantFilter, '$order': 'status_change_date DESC,usdot_number DESC,docket_number' };
  const grants = rows_(AH.history, grantParams).concat(rows_(AH.delta, grantParams));
  const grantByDot = {};
  grants.forEach(g => {
    const dot = String(g.usdot_number || '');
    if (/^\d+$/.test(dot) && (!grantByDot[dot] || grantByDot[dot] < g.status_change_date)) {
      grantByDot[dot] = g.status_change_date;
    }
  });
  const grantedCensus = batches_(Object.keys(grantByDot), 50, dots => rows_(AH.census, {
    '$select': censusColumns_(), '$where': censusFilter_() + ' AND dot_number in (' + dots.join(',') + ')',
    '$order': 'dot_number' }));
  const byDot = {};
  recent.concat(grantedCensus).forEach(r => { if (/^\d+$/.test(String(r.dot_number))) byDot[r.dot_number] = r; });
  const dots = Object.keys(byDot);
  const authorities = batches_(dots, 50, group => rows_(AH.carrier, {
    '$select': 'usdot_number,docket_number,op_auth_type,op_auth_status,min_cov_amount,bipd_file',
    '$where': "op_auth_type='" + AH.property + "' AND usdot_number in ('" + group.join("','") + "')",
    '$order': 'usdot_number,docket_number' }));
  const inspections = batches_(dots, 50, group => rows_(AH.inspections, {
    '$select': 'dot_number,max(insp_date) as last_inspection', '$group': 'dot_number',
    '$where': 'dot_number in (' + group.join(',') + ") AND insp_date>='" + dayAgo_(AH.activityDays) +
      "' AND insp_date<='" + dayAgo_(0) + "' AND (transaction_code IS NULL OR transaction_code<>'D')",
    '$order': 'dot_number' }));
  const inspectionByDot = {};
  inspections.forEach(r => { inspectionByDot[r.dot_number] = r.last_inspection; });
  const authorityByDot = {};
  authorities.forEach(a => {
    const dot = String(a.usdot_number);
    if (!authorityByDot[dot]) authorityByDot[dot] = [];
    authorityByDot[dot].push(a);
  });
  let candidates = dots.map(dot => {
    const r = byDot[dot], a = authorityByDot[dot] || [];
    const active = a.filter(x => clean_(x.op_auth_status).toUpperCase() === 'ACTIVE');
    const insured = active.find(x => Number(x.min_cov_amount) > 0 && Number(x.bipd_file) >= Number(x.min_cov_amount));
    const specialty = r.crgo_oilfield === 'X' || r.crgo_garbage === 'X' || r.crgo_liqgas === 'X' ||
      /\b(TANK|OILFIELD|MOVERS|TOWING|SCHOOL|DISPOSAL|SEEDING)\b/i.test(clean_(r.legal_name));
    const c = { dot: dot, name: clean_(r.legal_name), city: clean_(r.phy_city), state: clean_(r.phy_state),
      units: Number(r.power_units), registered: r.add_date, grant: grantByDot[dot] || '',
      email: email_(r.email_address), phone: clean_(r.phone), authorized: active.length > 0,
      insured: !!insured, docket: active.map(x => clean_(x.docket_number)).join(', '),
      coverage: insured ? Number(insured.bipd_file) : 0,
      lastInspection: inspectionByDot[dot] || '', specialty: specialty };
    c.baseReady = activityEligible_(c, fresh);
    return c;
  });
  candidates.sort((a, b) => Number(b.baseReady) - Number(a.baseReady) ||
    String(b.grant || b.registered).localeCompare(String(a.grant || a.registered)) || a.dot.localeCompare(b.dot));
  const main = [], hold = [], domainCache = {}, usedEmails = new Set();
  let checked = 0, excludedHistory = 0, invalidEmail = 0, alreadyListed = 0;
  for (const c of candidates) {
    c.section = c.baseReady ? 'ready' : 'hold';
    if (!c.email) { invalidEmail++; continue; }
    if (usedEmails.has(c.email) || state['ready_dot_' + c.dot] || state[emailKeyFor_(c.email, 'ready')] ||
        state[listedKey_(c)] || state[emailKey_(c)]) { alreadyListed++; continue; }
    if ((c.baseReady && main.length >= AH.mainLimit) || (!c.baseReady && hold.length >= AH.holdLimit)) continue;
    if (checked >= AH.checkLimit) break;
    checked++;
    const history = Gmail.Users.Messages.list('me', { q: 'in:anywhere {from:' + c.email + ' to:' + c.email + '}',
      maxResults: 1, includeSpamTrash: true });
    // Any earlier direct conversation, including an opt-out, removes the address from discovery.
    if (history.messages && history.messages.length) { excludedHistory++; continue; }
    const domain = c.email.split('@')[1];
    if (!(domain in domainCache)) domainCache[domain] = mxCheck_(domain);
    c.mx = domainCache[domain];
    c.reasons = [];
    if (!fresh) c.reasons.push('One or more FMCSA snapshots are over 72 hours old or have an unknown update time.');
    if (!c.authorized) c.reasons.push('No current active property-carrier authority found in the Motus file.');
    if (c.authorized && !c.insured) c.reasons.push('Required insurance amount could not be confirmed in the Motus file.');
    if (!c.lastInspection) c.reasons.push('No inspection in the past 90 days was found; operating activity needs verification.');
    if (c.specialty) c.reasons.push('Specialty service indicated; verify fit for OTR tracking support.');
    if (!c.mx) { c.reasons.push('Email-domain MX check needs manual verification.'); c.section = 'hold'; }
    if (state[listedKey_(c)] || state[emailKey_(c)]) { alreadyListed++; continue; }
    if (c.section === 'hold' && hold.length >= AH.holdLimit) continue;
    usedEmails.add(c.email);
    (c.section === 'ready' ? main : hold).push(c);
    if (main.length >= AH.mainLimit && hold.length >= AH.holdLimit) break;
  }
  return { snapshots: snapshots, fresh: fresh, total: candidates.length, main: main, hold: hold,
    nextCensusOffset: censusScanNext_(censusPage, main.length, checked, fresh),
    checked: checked, excludedHistory: excludedHistory, invalidEmail: invalidEmail, alreadyListed: alreadyListed };
}
function mxCheck_(domain) {
  try {
    const dns = publicJson_('https://dns.google/resolve?name=' + encodeURIComponent(domain) + '&type=MX');
    return dns.Status === 0 && (dns.Answer || []).some(a => a.type === 15 && !/^\d+\s+\.$/.test(clean_(a.data)));
  } catch (error) { return false; }
}
function emailKeyFor_(email, section) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email, Utilities.Charset.UTF_8);
  return section + '_email_' + bytes.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function listedKey_(c) { return c.section + '_dot_' + c.dot; }
function emailKey_(c) { return emailKeyFor_(c.email, c.section); }
function renderReport_(r, today) {
  const lines = ['AFTER HOURS — DAILY FMCSA RESEARCH', today + ' | US fleets reporting 5–15 power units', '',
    'Research only. No prospect emails or follow-ups are sent by this automation.',
    'USDOT registration age: unrestricted. Recent authority grants: past ' + AH.authorityDays + ' days.',
    'A new FMCSA registration is not proof of a newly incorporated business.', '',
    'MAIN SHORTLIST — ' + r.main.length,
    'Requires active property authority, required BIPD on file, an inspection within 90 days, and an email-domain MX record.',
    'This is evidence of recent operations, not a guarantee the company is operating today. Confirm the business contact before outreach.', ''];
  function add(c, index) {
    lines.push((index + 1) + '. ' + c.name + ' — ' + c.city + ', ' + c.state,
      'USDOT: ' + c.dot + ' | Power units: ' + c.units,
      'FMCSA added: ' + dateText_(c.registered) + (c.grant ? ' | Recent grant: ' + dateText_(c.grant) : ''),
      'Email on file: ' + c.email, 'Phone on file: ' + (c.phone || 'Not reported'),
      'Active property authority: ' + (c.authorized ? 'Reported active: ' + c.docket : 'Not confirmed'),
      'Required insurance on file: ' + (c.insured ? 'Reported, $' + c.coverage.toLocaleString('en-US') : 'Not confirmed'),
      'Latest recorded inspection in 90-day window: ' + dateText_(c.lastInspection),
      'Email: format passed; MX ' + (c.mx ? 'found' : 'not confirmed') + '; individual mailbox and ownership NOT verified.',
      'Official record: https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=' + c.dot);
    if (c.reasons && c.reasons.length) lines.push('HOLD: ' + c.reasons.join(' '));
    lines.push('');
  }
  if (!r.main.length) lines.push('No new unreported companies met all main-shortlist checks in this run.', '');
  r.main.forEach(add);
  lines.push('HOLD / MANUAL VERIFICATION — ' + r.hold.length, 'These companies are NOT cleared for outreach.', '');
  if (!r.hold.length) lines.push('No new hold items included.', '');
  r.hold.forEach(add);
  lines.push('RUN SUMMARY', 'Matched census records: ' + r.total + '; evaluated this run: ' + r.checked + '.',
    'Excluded for earlier direct mailbox contact: ' + r.excludedHistory + '; already listed: ' + r.alreadyListed + '; invalid/missing email: ' + r.invalidEmail + '.',
    'Main/hold limits are ' + AH.mainLimit + '/' + AH.holdLimit + ' per day. Unreported matches remain eligible within the rolling windows.', '',
    'SOURCE SNAPSHOTS (UTC)');
  r.snapshots.forEach(s => lines.push(s.id + ': ' + s.updated + (s.fresh ? '' : ' — STALE OR UNKNOWN')));
  lines.push('', 'FMCSA data is reported snapshot data, not a live insurance certificate or confirmation of current business activity.',
    'Full website/contact verification and any outreach remain manual. Gmail history is checked for earlier direct conversations, including opt-outs.',
    'Records are kept in this Google account and email reports; no local spreadsheet or file is created.',
    'Source guide: https://www.fmcsa.dot.gov/registration/fmcsa-data-dissemination-program');
  return lines.join('\n');
}

function testRules() {
  const base = { authorized: true, insured: true, lastInspection: '20261020', specialty: false };
  const cases = [
    [activityEligible_(base, true), 'Complete operational evidence should pass.'],
    [!activityEligible_(Object.assign({}, base, { authorized: false }), true), 'No authority must be held.'],
    [!activityEligible_(Object.assign({}, base, { insured: false }), true), 'Unconfirmed insurance must be held.'],
    [!activityEligible_(Object.assign({}, base, { lastInspection: '' }), true), 'No recent activity must be held.'],
    [!activityEligible_(Object.assign({}, base, { specialty: true }), true), 'Specialty fit must be reviewed.'],
    [!activityEligible_(base, false), 'Stale data must never clear a company.'],
    [email_('FLEET.DESK+TEST@GMAIL.COM') === 'fleet.desk+test@gmail.com', 'Valid email normalization.'],
    [email_('not-an-email') === '', 'Malformed email must be rejected.'],
    [email_('a@example.com to:other@example.com') === '', 'Gmail-query injection must be rejected.']
  ];
  cases.forEach(c => { if (!c[0]) throw new Error('Policy check failed: ' + c[1]); });
  console.log(cases.length + ' policy checks passed.');
}
function stopDailyCheck() {
  pauseAutomaticOutreach();
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'runDailyCheck')
    .forEach(t => ScriptApp.deleteTrigger(t));
  console.log('Daily trigger removed. Existing mailbox records were preserved.');
}

/**
 * Daily initial outreach for After Hours. Reuses the existing FMCSA checks.
 * No follow-ups, CC/BCC, attachments, tracking pixels, or automated replies.
 * The original research-only handler is retained as runResearchOnly_.
 */
const AH_AUTO = Object.freeze({
  enabled: true, dailyLimit: 99, batchSize: 20, batchMilliseconds: 90000,
  subject: 'Weekend backup for your dispatch team',
  portfolio: 'https://route-atlas.afterhours-fleetdesk.workers.dev/',
  prefix: 'ah_auto_', ledgerDays: 14, storageLimit: 420000
});
var outreachDeadline_ = 0;

function runDailyCheck() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  let work = false;
  try {
    assertMailbox_();
    const store = PropertiesService.getScriptProperties();
    if (!AH_AUTO.enabled || autoPaused_(store)) { console.log('Automatic outreach is paused.'); return; }
    const today = autoToday_();
    const previous = autoPlan_(store);
    if (previous && previous.day === today) {
      if (previous.finished) { console.log("Today's outreach is complete; no duplicate run."); return; }
      work = true;
    } else {
      autoPrune_(store);
      autoStorageCheck_(store);
      outreachDeadline_ = Date.now() + 150000;
      const result = collectShortlist_(autoDiscoveryState_(store));
      const queue = result.main.filter(c => autoEligible_(c, result)).slice(0, AH_AUTO.dailyLimit);
      autoSaveQueue_(store, queue);
      const plan = { day: today, next: 0, attempts: 0, total: queue.length,
        matched: result.total, held: result.hold.length, excludedHistory: result.excludedHistory,
        nextCensusOffset: result.nextCensusOffset,
        snapshots: result.snapshots, finished: false, errors: [], created: new Date().toISOString() };
      autoSavePlan_(store, plan);
      console.log('Prepared ' + queue.length + ' eligible new prospects; daily ceiling 99.');
      work = true;
    }
  } finally {
    outreachDeadline_ = 0;
    lock.releaseLock();
  }
  if (work) runOutreachBatch();
}

function runOutreachBatch() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    assertMailbox_();
    const store = PropertiesService.getScriptProperties();
    const plan = autoPlan_(store);
    if (!AH_AUTO.enabled || autoPaused_(store) || !plan || plan.finished) return;
    autoRemoveBatchTriggers_();
    if (plan.day !== autoToday_()) {
      plan.errors.push('The queue expired at the India-time date boundary. No stale queue was sent.');
      autoFinish_(store, plan); return;
    }
    const queue = autoQueue_(store);
    if (queue.length !== plan.total) throw new Error('Outreach queue is incomplete; no further sends.');
    const deadline = Date.now() + AH_AUTO.batchMilliseconds;
    let processed = 0;
    let stop = false;
    while (plan.next < queue.length && processed < AH_AUTO.batchSize && Date.now() < deadline) {
      if (plan.day !== autoToday_()) { plan.errors.push('Date changed; remaining contacts deferred.'); stop = true; break; }
      if (plan.attempts >= AH_AUTO.dailyLimit || MailApp.getRemainingDailyQuota() <= 1) {
        plan.errors.push('Daily ceiling or available Google quota reached; one summary recipient reserved.');
        stop = true; break;
      }
      const c = queue[plan.next];
      processed++;
      const key = autoLedgerKey_(c.dot);
      if (!autoEligible_(c, { fresh: true, snapshots: plan.snapshots }) ||
          store.getProperty(key) || autoContactExists_(c.email) || autoCompanyArchived_(c.dot)) {
        plan.next++;
        autoSavePlan_(store, plan);
        continue;
      }
      autoStorageCheck_(store);
      // Reserve BEFORE MailApp. An ambiguous send outcome must never be retried.
      const entry = { day: plan.day, dot: c.dot, email: c.email, name: c.name, status: 'reserved' };
      store.setProperty(key, JSON.stringify(entry));
      plan.attempts++;
      plan.next++;
      autoSavePlan_(store, plan);
      try {
        MailApp.sendEmail({ to: c.email, subject: AH_AUTO.subject, body: autoBody_(c),
          name: 'After Hours | Fleet Desk', replyTo: AH.mailbox });
      } catch (error) {
        entry.status = 'uncertain';
        store.setProperty(key, JSON.stringify(entry));
        plan.errors.push('Sending stopped: outcome uncertain for USDOT ' + c.dot + '. Review Sent Mail before any manual retry.');
        stop = true; break;
      }
      // A failed write here leaves the reservation intact, preventing duplicate sends.
      entry.status = 'sent';
      store.setProperty(key, JSON.stringify(entry));
      console.log('Initial email accepted for USDOT ' + c.dot + '.');
    }
    autoSavePlan_(store, plan);
    if (stop || plan.next >= queue.length) autoFinish_(store, plan);
    else ScriptApp.newTrigger('runOutreachBatch').timeBased().after(60000).create();
  } finally {
    lock.releaseLock();
  }
}

function previewDailyOutreach() {
  // Read-only: no email, state change, or trigger creation.
  assertMailbox_();
  outreachDeadline_ = Date.now() + 150000;
  try {
    const store = PropertiesService.getScriptProperties();
    const result = collectShortlist_(autoDiscoveryState_(store));
    const eligible = result.main.filter(c => autoEligible_(c, result));
    const plan = autoPlan_(store);
    const attempts = plan && plan.day === autoToday_() ? plan.attempts : 0;
    const capacity = autoCapacity_(MailApp.getRemainingDailyQuota(), attempts);
    console.log(JSON.stringify({ mode: 'PREVIEW ONLY - NO EMAILS SENT',
      enabled: AH_AUTO.enabled && !autoPaused_(store), dailyLimit: AH_AUTO.dailyLimit,
      remainingCapacity: capacity, eligible: eligible.length,
      wouldSend: Math.min(eligible.length, capacity), held: result.hold.length,
      matched: result.total, excludedForMailboxHistory: result.excludedHistory,
      snapshots: result.snapshots,
      prospects: eligible.map(c => ({ dot: c.dot, company: c.name, email: c.email })),
      subject: AH_AUTO.subject,
      sampleBody: autoBody_(eligible[0] || { name: 'Example Fleet' })
    }, null, 2));
  } finally { outreachDeadline_ = 0; }
}

function pauseAutomaticOutreach() {
  PropertiesService.getScriptProperties().setProperty(AH_AUTO.prefix + 'paused', 'true');
  autoRemoveBatchTriggers_();
  console.log('Automatic outreach paused.');
}
function resumeAutomaticOutreach() {
  PropertiesService.getScriptProperties().deleteProperty(AH_AUTO.prefix + 'paused');
  console.log('Automatic outreach resumes at the next daily run. No emails sent by this function.');
}
function autoPaused_(store) { return store.getProperty(AH_AUTO.prefix + 'paused') === 'true'; }
function autoToday_() { return Utilities.formatDate(new Date(), AH.timezone, 'yyyy-MM-dd'); }
function autoPlan_(store) { const raw = store.getProperty(AH_AUTO.prefix + 'plan'); return raw ? JSON.parse(raw) : null; }
function autoSavePlan_(store, plan) { store.setProperty(AH_AUTO.prefix + 'plan', JSON.stringify(plan)); }
function autoLedgerKey_(dot) { return AH_AUTO.prefix + 'dot_' + dot; }
function autoMarker_(dot) { return 'AHCONTACTEDUSDOT' + dot; }
function autoSummarySubject_(day) { return 'After Hours outreach summary - ' + day; }
function autoCapacity_(quota, attempts) { return Math.max(0, Math.min(99 - attempts, quota - 1)); }
function autoEligible_(c, result) {
  const fresh = result.fresh && result.snapshots && result.snapshots.length === 5 &&
    result.snapshots.every(s => s.fresh && Date.now() - Date.parse(s.updated) < 72 * 3600000);
  return !!fresh && c.section === 'ready' && c.baseReady && c.authorized && c.insured &&
    !!c.lastInspection && !c.specialty && !!c.mx && c.units >= 5 && c.units <= 15 &&
    /^\d+$/.test(String(c.dot)) && !!email_(c.email) && c.email !== AH.mailbox;
}
function autoContactExists_(email) {
  const result = Gmail.Users.Messages.list('me', { q: 'in:anywhere {from:' + email + ' to:' + email + '}',
    maxResults: 1, includeSpamTrash: true });
  return !!(result.messages && result.messages.length);
}
function autoCompanyArchived_(dot) {
  const result = Gmail.Users.Messages.list('me', { q: 'in:anywhere from:' + AH.mailbox +
    ' to:' + AH.mailbox + ' subject:"After Hours outreach summary" "' + autoMarker_(dot) + '"',
    maxResults: 1, includeSpamTrash: true });
  return !!(result.messages && result.messages.length);
}
function autoDiscoveryState_(store) {
  const state = {};
  const all = store.getProperties();
  Object.keys(all).filter(k => k.indexOf(AH_AUTO.prefix + 'dot_') === 0).forEach(k => {
    const entry = JSON.parse(all[k]);
    state['ready_dot_' + entry.dot] = entry.day;
    state[emailKeyFor_(entry.email, 'ready')] = entry.day;
  });
  return state;
}
function autoSaveQueue_(store, queue) {
  const chunks = []; let current = [];
  queue.forEach(c => {
    const next = current.concat([c]);
    if (autoBytes_(JSON.stringify(next)) > 7500) {
      if (!current.length) throw new Error('A contact exceeds the safe property size.');
      chunks.push(current); current = [c];
    } else current = next;
  });
  if (current.length) chunks.push(current);
  const values = {};
  chunks.forEach((chunk, i) => { values[AH_AUTO.prefix + 'queue_' + i] = JSON.stringify(chunk); });
  values[AH_AUTO.prefix + 'queue_count'] = String(chunks.length);
  store.setProperties(values, false);
}
function autoQueue_(store) {
  const count = Number(store.getProperty(AH_AUTO.prefix + 'queue_count') || 0);
  let queue = [];
  for (let i = 0; i < count; i++) {
    const raw = store.getProperty(AH_AUTO.prefix + 'queue_' + i);
    if (!raw) throw new Error('A saved queue chunk is missing.');
    queue = queue.concat(JSON.parse(raw));
  }
  return queue;
}
function autoBody_(c) {
  return ['Hi ' + clean_(c.name) + ' team,', '',
    'I offer weekend and after-hours tracking support for small US OTR fleets.', '',
    "Here's where I can help:", '- Driver follow-ups', '- Location and ETA checks',
    '- Broker updates and escalation of reported delays', '',
    'I bring four years of experience in US logistics, with coverage agreed around your schedule.', '',
    'My experience and approach:', AH_AUTO.portfolio, '',
    'Would backup coverage for a weekend shift be useful?', '', 'Best,',
    'After Hours | Fleet Desk', AH.mailbox, '',
    'Business service offer. Reply "no thanks" if you\'d prefer no further contact.'
  ].join('\n');
}
function autoFinish_(store, plan) {
  const sent = [], uncertain = [];
  autoQueue_(store).forEach(c => {
    const raw = store.getProperty(autoLedgerKey_(c.dot));
    if (!raw) return;
    const entry = JSON.parse(raw);
    if (entry.day !== plan.day) return;
    (entry.status === 'sent' ? sent : uncertain).push(entry);
  });
  const subject = autoSummarySubject_(plan.day);
  if (!ownReportExists_(subject)) {
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error('No quota for the daily outreach summary. Check executions.');
    const body = ['AFTER HOURS - DAILY INITIAL OUTREACH', plan.day + ' | India time', '',
      'Initial emails accepted for sending: ' + sent.length + '. Delivery is not confirmed.',
      'Uncertain/reserved outcomes: ' + uncertain.length + '; daily maximum: 99.',
      'Eligible new prospects queued: ' + plan.total + '; matched census records: ' + plan.matched + '.',
      'All replies remain in your Gmail. No automatic follow-ups or replies are sent.', '', 'SENT CONTACTS'];
    sent.forEach(c => body.push(c.name + ' | ' + c.email + ' | USDOT ' + c.dot, autoMarker_(c.dot)));
    if (!sent.length) body.push('No prospect emails were sent.');
    if (uncertain.length) {
      body.push('', 'REVIEW SENT MAIL - DO NOT AUTOMATICALLY RETRY');
      uncertain.forEach(c => body.push(c.name + ' | ' + c.email + ' | USDOT ' + c.dot));
    }
    if (plan.errors.length) body.push('', 'RUN NOTES', plan.errors.join('\n'));
    body.push('', 'Only the existing main-shortlist criteria are eligible; hold items are excluded.',
      'SOURCE SNAPSHOTS (UTC)');
    plan.snapshots.forEach(s => body.push(s.id + ': ' + s.updated));
    sendSelf_(subject, body.join('\n'));
  }
  plan.finished = true;
  autoSavePlan_(store, plan);
  if (plan.next >= plan.total && Number.isSafeInteger(plan.nextCensusOffset) && plan.nextCensusOffset >= 0) {
    store.setProperty('ah_census_scan_offset', String(plan.nextCensusOffset));
  }
  autoRemoveBatchTriggers_();
  console.log('Daily outreach complete: ' + sent.length + ' sent; ' + uncertain.length + ' uncertain. Summary sent to business mailbox.');
}
function autoRemoveBatchTriggers_() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'runOutreachBatch')
    .forEach(t => ScriptApp.deleteTrigger(t));
}
function autoBytes_(text) { return Utilities.newBlob(text).getBytes().length; }
function autoStorageCheck_(store) {
  const all = store.getProperties();
  const used = Object.keys(all).reduce((sum, k) => sum + autoBytes_(k) + autoBytes_(all[k]), 0);
  if (used > AH_AUTO.storageLimit) throw new Error('Outreach journal storage is nearly full. Sending stopped before records could be lost.');
}
function autoPrune_(store) {
  // Prune only successes whose exact company marker is verified in the emailed archive.
  const all = store.getProperties(), archives = {};
  const cutoff = Date.now() - AH_AUTO.ledgerDays * 86400000;
  Object.keys(all).filter(k => k.indexOf(AH_AUTO.prefix + 'dot_') === 0).forEach(k => {
    const entry = JSON.parse(all[k]);
    if (entry.status !== 'sent' || Date.parse(entry.day + 'T23:59:59+05:30') > cutoff) return;
    if (!(entry.day in archives)) archives[entry.day] = autoArchiveText_(entry.day);
    if (archives[entry.day].indexOf(autoMarker_(entry.dot)) !== -1) store.deleteProperty(k);
  });
}
function autoArchiveText_(day) {
  const result = Gmail.Users.Messages.list('me', { q: 'in:anywhere from:' + AH.mailbox + ' to:' + AH.mailbox +
    ' subject:"' + autoSummarySubject_(day) + '"', maxResults: 10, includeSpamTrash: true });
  function plain(part) {
    let text = '';
    if (part.mimeType === 'text/plain' && part.body && part.body.data)
      text = Utilities.newBlob(Utilities.base64DecodeWebSafe(part.body.data)).getDataAsString('UTF-8');
    return text + (part.parts || []).map(plain).join('\n');
  }
  return (result.messages || []).map(m => plain(Gmail.Users.Messages.get('me', m.id, { format: 'full' }).payload)).join('\n');
}

// Historic manually approved recipient batch is excluded from this source backup.
// Daily discovery and outreach do not call this function.
function sendApprovedResearchBatch01() {
  throw new Error('Historic recipient list excluded from GitHub backup.');
}

// Scan established carriers in bounded pages. Preview runs never advance this cursor.
function censusScanPage_() {
  const size = 250;
  const stored = Number(PropertiesService.getScriptProperties().getProperty('ah_census_scan_offset') || 0);
  const offset = Number.isSafeInteger(stored) && stored >= 0 ? stored : 0;
  const params = { '$select': censusColumns_(), '$where': censusFilter_(),
    '$order': 'dot_number DESC', '$limit': size, '$offset': offset };
  const query = Object.keys(params).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
  const rows = publicJson_('https://data.transportation.gov/resource/' + AH.census + '.json?' + query);
  if (!Array.isArray(rows) || rows.length > size) throw new Error('Unexpected census scan response.');
  return { rows: rows, offset: offset, size: size };
}
function censusScanNext_(page, readyCount, checked, fresh) {
  if (!fresh || readyCount >= AH.mainLimit || checked >= AH.checkLimit) return page.offset;
  return page.rows.length < page.size ? 0 : page.offset + page.rows.length;
}

// Manual self-test requested by the mailbox owner; one copy per test token.
function sendSelfTestEmail() {
  assertMailbox_();
  const token = 'AH-SELFTEST-20261101-2254';
  const subject = 'After Hours - email self-test - ' + token;
  const existing = Gmail.Users.Messages.list('me', { q: 'in:sent to:' + AH.mailbox + ' subject:' + token, maxResults: 1 });
  if (existing.messages && existing.messages.length) { console.log('Self-test already exists in Sent: ' + token); return; }
  if (MailApp.getRemainingDailyQuota() < 1) throw new Error('No email quota available for the self-test.');
  MailApp.sendEmail({ to: AH.mailbox, subject: subject,
    body: 'Hello Fleet Desk,\n\nThis is the requested email self-test, sent through the After Hours Google Apps Script.\n\nReceiving this message confirms that the script can send email to this mailbox. This test does not fetch FMCSA data.\n\nTest ID: ' + token,
    name: 'After Hours | Fleet Desk', replyTo: AH.mailbox });
  console.log('SELF_TEST_ACCEPTED ' + token);
}

