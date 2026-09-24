import assert from 'node:assert/strict';
import { ESSENCE, essenceFor } from '../essence.js';
import { BASICS, COMBOS } from '../rules.js';
import { lineUrl } from '../service.js';
const ids=[...Object.values(BASICS),...COMBOS].map(x=>x.id);
assert.equal(Object.keys(ESSENCE).length,ids.length);
for(const id of ids){const e=essenceFor(id);assert.equal(e.sections.length,5);const text=e.intro+e.sections.map(x=>x.text).join('');assert.ok(text.length>=650&&text.length<=1000);assert.equal(new Set(e.sections.map(x=>x.text)).size,5);assert.ok(!/[<>]|β|四柱推命|必ず当たる|的中率\d/.test(text));}
assert.equal(essenceFor('unknown'),null);
assert.equal(lineUrl(),null);
for(const v of ['javascript:alert(1)','https://example.com/a','http://line.me/a','https://line.me@evil.example/a','https://line.me/'])assert.equal(lineUrl(v),null);
assert.equal(lineUrl('https://lin.ee/example'),'https://lin.ee/example');
assert.equal(lineUrl('https://line.me/R/ti/p/@example'),'https://line.me/R/ti/p/@example');
console.log(JSON.stringify({result:'ok',essenceTypes:ids.length,sectionsPerType:5,line:'unconfigured-safe-and-valid-url-checks'}));
