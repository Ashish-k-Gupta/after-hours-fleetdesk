import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
let stored = '500';
let requests = [];
let response = Array.from({ length: 250 }, (_, i) => ({ dot_number: String(i + 1) }));
const context = vm.createContext({ console,
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => stored }) }
});
vm.runInContext(source, context);
context.testRules();
assert.equal(context.autoCapacity_(100, 0), 99);
assert.equal(context.autoCapacity_(1, 0), 0, 'Reserve quota for the summary');
assert.equal(context.autoCapacity_(100, 99), 0, 'Enforce daily cap');
assert.doesNotMatch(context.censusFilter_(), /add_date|registrationDays/);
context.publicJson_ = url => { requests.push(url); return response; };
const page = context.censusScanPage_();
const query = new URL(requests[0]).searchParams;
assert.equal(requests.length, 1);
assert.equal(query.get('$limit'), '250');
assert.equal(query.get('$offset'), '500');
assert.equal(query.get('$where'), context.censusFilter_());
assert.equal(query.get('$order'), 'dot_number DESC');
assert.equal(context.censusScanNext_(page, 12, 20, true), 750);
assert.equal(context.censusScanNext_(page, 99, 105, true), 500);
assert.equal(context.censusScanNext_(page, 0, 20, false), 500);
assert.equal(context.censusScanNext_(page, 12, 500, true), 500);
assert.equal(context.censusScanNext_({ rows: [], size: 250, offset: 500 }, 0, 0, true), 0);
for (const bad of ['-1', 'NaN', '1.5', 'Infinity', null]) {
  stored = bad;
  assert.equal(context.censusScanPage_().offset, 0);
}
response = { error: 'upstream error' };
assert.throws(() => context.censusScanPage_(), /Unexpected census scan response/);
response = Array(251);
assert.throws(() => context.censusScanPage_(), /Unexpected census scan response/);
const fresh = { fresh: true, snapshots: Array.from({length:5}, () => ({fresh:true, updated:new Date().toISOString()})) };
const candidate = { section:'ready', baseReady:true, authorized:true, insured:true,
  lastInspection:'20261020', specialty:false, mx:true, units:5, dot:'123456', email:'fleet@example.com' };
assert.equal(context.autoEligible_(candidate, fresh), true);
assert.equal(context.autoEligible_({...candidate, units:16}, fresh), false);
assert.equal(context.autoEligible_({...candidate, section:'hold'}, fresh), false);
assert.equal(context.autoEligible_(candidate, {...fresh, fresh:false}), false);
assert.throws(() => context.sendApprovedResearchBatch01(), /Historic recipient list excluded/);
const manifest = JSON.parse(fs.readFileSync(new URL('./appsscript.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
assert.equal(manifest.runtimeVersion, 'V8');
console.log('Passed: source parses, eligibility rules, quota cap, bounded scan, cursor retention, and disabled historic batch. No email or network calls.');
