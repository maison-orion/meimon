// 言葉だけを更新する。保存済みの判定ID、対象期間、命式、出生情報は再計算しない。
import { BASICS, COMBOS, FOCUS, focusGroup, RULES_VERSION } from './rules.js?v=1.8.1';
const lookup = (id) => COMBOS.find(x=>x.id===id) || Object.values(BASICS).find(x=>x.id===id);
export function refreshReadingCopy(r) {
  if (!r || r.versions?.presentation === 'copy-1.7') return r;
  const rewrite = x => { const t=lookup(x.source || x.id); return t ? {...x, move:t.move, env:t.env, burden:t.burden, ...(x.id ? {hypothesis:t.hypothesis,detail:t.detail,ask:t.ask} : {})} : x; };
  const f=FOCUS[r.focus] || FOCUS.unsure;
  const summary=r.summary ? rewrite(r.summary) : null;
  const months=r.months?.map(m=>{
    const g=focusGroup(m.star,r.focus), b=focusGroup(m.before.star,r.focus), y=focusGroup(m.year.star,r.focus);
    return {...m,theme:g.theme,conclusion:g.conclusion,description:g.description,example:g.example,action:g.action,before:{...m.before,theme:b.theme},year:{...m.year,theme:y.theme}};
  });
  const years=r.years?.map(y=>({...y,theme:focusGroup(y.star,r.focus).theme}));
  const mainYearIndex=r.years?.findIndex(y=>y.theme===r.yearTheme) ?? -1;
  const yearTheme=years?.[Math.max(0,mainYearIndex)]?.theme || '';
  return {...r,summary,uniq:r.uniq?.map(rewrite),basics:r.basics?.map(rewrite),combos:r.combos?.map(rewrite),conditional:r.conditional?.map(rewrite),months,years,yearTheme,
    consult:f.label,headline:summary ? f.headline : r.headline,answer:summary && months ? f.answer(summary,yearTheme) : r.answer,
    versions:{...r.versions,rules:RULES_VERSION,presentation:'copy-1.7'}};
}

// 月初から節入りまでは前の月柱の読みを使う。日付は表示と同じ日本時間。
export function monthAdvice(month, focus, now = Date.now()) {
  const start = Date.UTC(month.y, month.m - 1, 1, -9);
  const boundary = Date.UTC(month.y, month.m - 1, month.boundary.day, month.boundary.hour - 9, month.boundary.minute || 0);
  const isBefore = now >= start && now < boundary;
  if (!isBefore) return { ...month, isBefore: false };
  const g = focusGroup(month.before.star, focus);
  return { ...month, theme: g.theme, conclusion: g.conclusion, description: g.description, example: g.example, action: g.action, isBefore: true };
}
