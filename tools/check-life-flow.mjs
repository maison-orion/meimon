import assert from 'node:assert/strict';
import { buildLifeFlow, renderLifeFlow, renderLifeYear } from '../life-flow.js';
import { setsuInCalendarMonth, tenGod, yearMonthPillar } from '../engine.js';

const input = { y: 1990, m: 6, d: 15, country: 'JP', timeMode: 'exact', time: '12:00' };
const options = { now: new Date('2026-09-24T03:00:00Z') };
const flow = buildLifeFlow(input, options);
assert.equal(flow.status, 'ok');
assert.equal(flow.entries.length, 19);
assert.equal(flow.entries[0].start, '2008-06-15');
assert.equal(flow.entries[0].ageStart, 18);
assert.equal(flow.entries[0].segments.length, 1);
assert.equal(flow.entries.at(-1).end, '2026-09-24');
assert.deepEqual([flow.entries.at(-1).ageStart, flow.entries.at(-1).ageEnd], [35, 36]);
assert.equal(buildLifeFlow(input, {now: new Date('2008-06-14T14:59:59Z')}).status, 'uncertain');
const birthday = buildLifeFlow(input, {now: new Date('2008-06-14T15:00:00Z')});
assert.equal(birthday.status, 'ok'); assert.equal(birthday.entries.length, 1);
assert.equal(birthday.entries[0].ageStart, 18);
const early = buildLifeFlow({...input, m: 1, d: 15}, options);
assert.equal(early.entries[0].segments.length, 2);
for (const entry of early.entries) {
  for (const segment of entry.segments) {
    const sample = (segment.startMs + segment.endMs) / 2;
    assert.equal(segment.pillar, yearMonthPillar(sample).year.label);
    assert.equal(segment.star, tenGod(early.dayStem, yearMonthPillar(sample).year.stem));
    assert.ok(segment.startMs <= segment.endMs);
  }
  for (let i = 1; i < entry.segments.length; i++) assert.ok(Math.abs(entry.segments[i].startMs - entry.segments[i-1].endMs - 1) < .01);
}
const boundary = setsuInCalendarMonth(2026, 2).ms;
const before = buildLifeFlow(input, {now: new Date(boundary - 1000)}).entries.at(-1);
const after = buildLifeFlow(input, {now: new Date(boundary + 1000)}).entries.at(-1);
assert.equal(before.segments.length, 1); assert.equal(after.segments.length, 2);
assert.equal(before.segments[0].pillar, '乙巳'); assert.equal(after.segments[1].pillar, '丙午');
const older = buildLifeFlow({...input, y: 1900}, options);
assert.equal(older.entries.length, 109);
assert.ok(renderLifeFlow(older).includes('overflow-x:auto'));
const leap = {...input, y: 2008, m: 2, d: 29};
assert.equal(buildLifeFlow(leap, {now: '2026-02-28T14:59:59Z'}).status, 'uncertain');
assert.equal(buildLifeFlow(leap, {now: '2026-02-28T15:00:00Z'}).entries[0].ageStart, 18);
const uncertain = buildLifeFlow({...input, timeMode:'range', from:'23:30', to:'00:30', toNextDay:true}, options);
assert.equal(uncertain.status, 'uncertain'); assert.equal(uncertain.entries.length, 0);
assert.equal(buildLifeFlow({...input, timeMode:'unknown'}, options).status, 'ok');
assert.equal(buildLifeFlow({...input, d:32}, options).status, 'uncertain');
assert.equal(buildLifeFlow({...input, time:'oops'}, options).status, 'uncertain');
assert.equal(buildLifeFlow({...input, timeMode:'range', from:'13:00', to:'12:00'}, options).status, 'uncertain');
const html = renderLifeFlow(flow, 2025);
assert.equal((html.match(/aria-pressed="true"/g)||[]).length, 1);
assert.ok(html.includes('data-year="2025" aria-pressed="true"'));
assert.ok(html.includes('上下は運の良し悪しではありません'));
assert.ok(renderLifeYear(flow, 2026).includes('切り替わりの前後'));
assert.ok(!renderLifeFlow({status:'uncertain',reason:'<img src=x onerror=alert(1)>'}).includes('<img'));
const tampered = structuredClone(flow); tampered.entries[0].segments[0].description='<script>alert(1)</script>';
assert.ok(!renderLifeYear(tampered, 2008).includes('<script>'));
console.log(JSON.stringify({result:'ok',checks:'age 18, inclusive birthday, calendar ages, 109 years, leap birthdays, solar-year boundary, uncertain birth dates, accessibility, escaping'}));
