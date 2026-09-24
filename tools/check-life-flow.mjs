import assert from 'node:assert/strict';
import { buildLifeFlow, renderLifeFlow, renderLifeYear, lifeWaveLevel } from '../life-flow.js';
import { setsuInCalendarMonth, tenGod, yearMonthPillar, calcChart } from '../engine.js';

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
assert.equal((html.match(/ selected/g)||[]).length, 1);
assert.ok(html.includes('value="2025" selected'));
assert.ok(html.includes('id="life-year-select"'));
assert.ok(!html.includes('<button'));
assert.ok(html.includes('命紋独自の占いの目安'));
assert.ok(html.includes('life-fixed-axis'));
assert.ok(html.indexOf('life-fixed-axis') < html.indexOf('life-chart-scroll'));
assert.ok(html.includes('grid-template-columns:78px minmax(0,1fr)'));
assert.ok(!html.includes('y(segment.groupId)'));
assert.ok(html.includes('検証済みの予測式ではありません'));
assert.ok(renderLifeYear(flow, 2026).includes('切り替わりの前後'));
assert.ok(!renderLifeFlow({status:'uncertain',reason:'<img src=x onerror=alert(1)>'}).includes('<img'));
const tampered = structuredClone(flow); tampered.entries[0].segments[0].description='<script>alert(1)</script>';
assert.ok(!renderLifeYear(tampered, 2008).includes('<script>'));
const source = calcChart(input).candidates[0];
const annual = yearMonthPillar(Date.UTC(2026,5,1)).year;
assert.deepEqual(lifeWaveLevel(source, annual), lifeWaveLevel(source, annual), '同じ暦なら同じ段階');
assert.deepEqual(buildLifeFlow(input, options), flow, '同じ入力と現在日時なら同じ流れ');
const changedMonth = structuredClone(source); changedMonth.month.branch = (source.month.branch + 6) % 12;
assert.notEqual(lifeWaveLevel(source, annual).balance, lifeWaveLevel(changedMonth, annual).balance, '出生月の季節で基礎の偏りが変わる');
for (const entry of flow.entries) for (const segment of entry.segments) {
  assert.ok(segment.wave.level >= 1 && segment.wave.level <= 5);
  assert.equal(segment.wave.adjustment, Math.abs(segment.wave.balance) - Math.abs(segment.wave.balance + segment.wave.annual));
  assert.ok(renderLifeYear(flow,entry.year).includes(segment.wave.label));
}
const byGroup = new Map();
for (const e of flow.entries) for (const s of e.segments) {
  if (!byGroup.has(s.groupId)) byGroup.set(s.groupId, new Set());
  byGroup.get(s.groupId).add(s.wave.level);
}
assert.ok([...byGroup.values()].some(levels => levels.size > 1), '同じテーマ群でも年の地支によって波が変わる');
const boundaryBirth = new Date(setsuInCalendarMonth(1990, 6).ms + 9 * 3600000);
const boundaryInput = {...input, m:6, d:boundaryBirth.getUTCDate(), time:`${String(boundaryBirth.getUTCHours()).padStart(2,'0')}:${String(boundaryBirth.getUTCMinutes()).padStart(2,'0')}`};
assert.equal(buildLifeFlow(boundaryInput,options).status, 'uncertain', '出生月の切替候補で段階が分かれる場合は保留');
console.log(JSON.stringify({result:'ok',checks:'age 18, inclusive birthday, calendar ages, 109 years, leap birthdays, solar-year boundary, uncertain birth dates, accessibility, escaping'}));
