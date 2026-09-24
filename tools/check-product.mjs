import assert from 'node:assert/strict';
import { ESSENCE, essenceFor } from '../essence.js';
import { BASICS, COMBOS, TYPE_NAMES, typeName } from '../rules.js';
import { readOne, summaryOf } from '../method.js';
import { lineUrl } from '../service.js';
const ids=[...Object.values(BASICS),...COMBOS].map(x=>x.id);
assert.deepEqual(Object.keys(TYPE_NAMES).sort(),[...ids].sort());
assert.equal(new Set(Object.values(TYPE_NAMES)).size,ids.length);
for(const id of ids)assert.ok(typeName(id)?.endsWith('の紋'));
assert.equal(typeName('unknown'),null);
const reachable=new Set();
const stars=[...Object.keys(BASICS),null];
for(const month of stars)for(const year of stars)for(const hour of stars){
  const summary=summaryOf(readOne({month,year,hour}));
  if(summary)reachable.add(summary.source);
}
assert.deepEqual([...reachable].sort(),[...ids].sort());
assert.equal(Object.keys(ESSENCE).length,ids.length);
for(const id of ids){const e=essenceFor(id);assert.equal(e.sections.length,5);const text=e.intro+e.sections.map(x=>x.text).join('');assert.ok(text.length>=650&&text.length<=1000);assert.equal(new Set(e.sections.map(x=>x.text)).size,5);assert.ok(!/[<>]|β|四柱推命|必ず当たる|的中率\d/.test(text));}
assert.equal(essenceFor('unknown'),null);
assert.equal(lineUrl(),null);
for(const v of ['javascript:alert(1)','https://example.com/a','http://line.me/a','https://line.me@evil.example/a','https://line.me/'])assert.equal(lineUrl(v),null);
assert.equal(lineUrl('https://lin.ee/example'),'https://lin.ee/example');
assert.equal(lineUrl('https://line.me/R/ti/p/@example'),'https://line.me/R/ti/p/@example');
console.log(JSON.stringify({result:'ok',essenceTypes:ids.length,sectionsPerType:5,line:'unconfigured-safe-and-valid-url-checks'}));

const {careerFor,CAREERS}=await import('../careers.js');
for(const id of ids){const c=careerFor(id);assert.ok(c,`職種候補がない: ${id}`);assert.equal(c.jobs.length,3);assert.ok(c.reason.length>20);assert.ok(c.avoid.length>10);assert.ok(c.step.length>20);}
assert.equal(careerFor('unknown'),null);
assert.equal(new Set(Object.values(CAREERS).map(c=>c.title)).size,ids.length);
for(const e of Object.values(ESSENCE))assert.ok(!/読みです|として読みます/.test(e.intro+e.sections.map(x=>x.text).join('')));
console.log('ok all personality types have reasoned job examples and natural endings');

const {moneyFor,MONEY}=await import('../money.js');
const {ACTIVE_FOCUS,activeFocus}=await import('../rules.js');
assert.deepEqual(ACTIVE_FOCUS,['fit','stay','money']);
for(const key of ['love','relations','self','start','unsure',null])assert.equal(activeFocus(key),'fit');
for(const id of ids){const m=moneyFor(id);assert.ok(m,`金運の説明がない: ${id}`);for(const text of Object.values(m)){assert.ok(text.length>25);assert.ok(!/必ず儲かる|収入が上がる|的中|臨時収入が入る/.test(text));}}
assert.equal(moneyFor('unknown'),null);
assert.equal(new Set(Object.values(MONEY).map(x=>x.action)).size,ids.length);
console.log('ok 16 money profiles and legacy focus mapping');
