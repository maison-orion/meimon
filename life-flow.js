// 命紋独自の五行バランス指標。統計的な予測値や古典の確定判定ではない。
import * as E from './engine.js?v=1.7.0';
import { groupOf } from './rules.js?v=1.7.0';

const HOUR = 3600000, JST = 9 * HOUR;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const at = (y, m, d) => Date.UTC(y, m - 1, d) - JST;
const local = (ms) => new Date(ms + JST);
const stamp = (ms) => local(ms).toISOString().slice(0, 10);
const dateLabel = (ms) => { const d = local(ms); return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`; };
const clockLabel = (ms) => { const d = local(ms); return `${dateLabel(ms)} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const ageAt = (input, ms) => { const d = local(ms), y = d.getUTCFullYear(); return y - input.y - (ms < at(y, input.m, input.d) ? 1 : 0); };

export const LIFE_THEMES = Object.freeze({
  G1: { theme: '自分の意思', description: '周りの期待と、自分が望むことを分けて考える時期です。人に合わせて選ぶことより、自分で納得できる選び方に目を向ける年です。', example: '進路や働き方を選ぶ場面なら、「周りがどう思うか」と「自分が続けたいか」の間で迷うことが、このテーマに重なります。', meaning: '人と違う選択をする勇気だけでなく、断ることや自分のペースを守ることも、この年の読みどころです。' },
  G2: { theme: '表現と工夫', description: '考えや好みを、自分なりの形で表す時期です。決められた通りに進めるだけでなく、「もっとこうしたい」と感じる部分に目を向ける年です。', example: '趣味に夢中になったり、仕事の進め方を工夫したり、自分の意見を伝えようとする場面が、このテーマに重なります。', meaning: 'うまく見せることより、自分の感じたことを言葉や形にする過程を大切にします。' },
  G3: { theme: '人との交流', description: '人と関わる中で、自分の大切にしたいことを確かめる時期です。出会いの多さだけでなく、付き合い方や約束の守り方にも目を向ける年です。', example: '誰かのために時間を使う、誘いを受ける、生活の中でお金の使い道を考える。こうした「自分の持つものを誰とどう分けるか」が、このテーマに重なります。', meaning: '相手に合わせるだけでなく、無理なく付き合える距離や、自分にも残しておきたい時間を考えることが大切です。' },
  G4: { theme: '役割と責任', description: '自分が引き受けることを、はっきりさせる時期です。周りから求められることと、自分にできることの両方に目を向ける年です。', example: '仕事や家庭で担当が決まる、締め切りを意識する、人との約束を優先する。こうした場面が、このテーマに重なります。', meaning: '頑張り続けることだけを指しません。引き受ける範囲を決め、必要なときに助けを求めることも大切です。' },
  G5: { theme: '学びと準備', description: '答えを急がず、知ることや理解することを大切にする時期です。外に向かって動くことだけでなく、自分の中に知識や安心を蓄える年です。', example: '勉強を始める、詳しい人に相談する、次に進むための準備をする。表からは変化が小さく見える時間も、このテーマに重なります。', meaning: 'まだ成果が見えていない時間を、遅れと決めつけなくて大丈夫です。考えを整理し、納得できる理由を見つける過程に目を向けます。' },
});

// 五行の順序：木・火・土・金・水。地支は主となる五行のみを用いる。
const BRANCH_ELEMENTS = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
const ELEMENT_NAMES = ['木', '火', '土', '金', '水'];
const elementOfStem = stem => Math.floor(stem / 2);
// 同じ五行 +1、生む側 +2、生まれる側 -1、日干が抑える側 -1、日干を抑える側 -2。
const support = (day, other) => [1, -1, -1, -2, 2][(other - day + 5) % 5];
const natalBalance = candidate => {
  const day = elementOfStem(candidate.day.stem);
  return 2 * support(day, BRANCH_ELEMENTS[candidate.month.branch])
    + support(day, elementOfStem(candidate.year.stem))
    + support(day, elementOfStem(candidate.month.stem));
};
export const LIFE_LEVELS = Object.freeze({
  5: { label: '動きやすい', advice: '自分から一歩踏み出すことを大切にしたい時期。考えていたことを、小さく形にする姿勢が合います。' },
  4: { label: '進める', advice: '取り組んでいることを少しずつ進めたい時期。広げすぎず、続けたいことに力を向けるのがポイントです。' },
  3: { label: '見極める', advice: '進めることと、いったん待つことを選ぶ時期。勢いだけで決めず、自分に必要かを確かめてください。' },
  2: { label: '備える', advice: '急いで広げるより、準備を丁寧にしたい時期。予定や約束を確かめ、無理のない進め方を選ぶことが大切です。' },
  1: { label: '整える', advice: '抱えていることを整理し、自分のペースを取り戻したい時期。休むことや、人に頼ることも選択肢に入れてください。' },
});

/** 編集規則の透明性のため公開。評価値は内部の比較用で、成功確率ではない。 */
export function lifeWaveLevel(candidate, annualPillar) {
  const day = elementOfStem(candidate.day.stem), balance = natalBalance(candidate);
  const annual = 2 * support(day, elementOfStem(annualPillar.stem)) + support(day, BRANCH_ELEMENTS[annualPillar.branch]);
  const adjustment = Math.abs(balance) - Math.abs(balance + annual);
  const level = adjustment >= 4 ? 5 : adjustment >= 1 ? 4 : adjustment >= -1 ? 3 : adjustment >= -4 ? 2 : 1;
  return { level, label: LIFE_LEVELS[level].label, advice: LIFE_LEVELS[level].advice, balance, annual, adjustment };
}

/** now は実際の時刻。年齢・年の区切りの表示は日本時間、2/29生まれの平年の誕生日は3/1。 */
export function buildLifeFlow(input, { now = new Date() } = {}) {
  const current = new Date(now).getTime();
  const uncertain = (reason) => ({ status: 'uncertain', reason, entries: [] });
  if (!input || !E.validDate(input.y, input.m, input.d) || input.y < 1900 || !Number.isFinite(current)) return uncertain('生年月日を確認すると、年ごとの流れを表示できます。');
  const validTime = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  if ((input.timeMode === 'exact' && !validTime(input.time)) || (input.timeMode === 'range' && (!validTime(input.from) || !validTime(input.to) || (!input.toNextDay && input.from > input.to)))) return uncertain('出生時刻の入力を確認してください。');
  const start18 = at(input.y + 18, input.m, input.d);
  if (current < start18) return uncertain('18歳の誕生日からの流れを表示します。');
  let chart;
  try { chart = E.calcChart(input); } catch { return uncertain('出生時刻の入力を確認してください。'); }
  const stems = [...new Set(chart.candidates.map(c => c.day.stem))];
  if (stems.length !== 1 || !Number.isInteger(stems[0])) return uncertain('出生時刻の幅が日付をまたぐため、年ごとの読みが分かれます。出生時刻を絞ると、流れを表示できます。');
  const endYear = local(current).getUTCFullYear(), entries = [];
  let waveUncertain = false;
  for (let year = input.y + 18; year <= endYear; year++) {
    const startMs = Math.max(start18, at(year, 1, 1));
    // 18歳の誕生日当日 0:00 も1件として扱う。未来の時刻は加えない。
    const endMs = Math.min(current, at(year + 1, 1, 1) - 1);
    if (startMs > endMs) continue;
    const boundaryMs = E.setsuInCalendarMonth(year, 2).ms;
    const cuts = [startMs, ...(boundaryMs > startMs && boundaryMs <= endMs ? [boundaryMs] : []), endMs + 1];
    const segments = cuts.slice(0, -1).map((start, i) => {
      const end = cuts[i + 1] - 1;
      // 判定点は区間の内側。立春を解く浮動小数点の丸めに影響されないようにする。
      const sample = start >= boundaryMs ? Math.max(start, boundaryMs + 1000) : Math.min(end, boundaryMs - 1000);
      const pillar = E.yearMonthPillar(sample).year;
      const star = E.tenGod(stems[0], pillar.stem), group = groupOf(star);
      const waves = chart.candidates.map(candidate => lifeWaveLevel(candidate, pillar));
      if (new Set(waves.map(w => w.level)).size !== 1) waveUncertain = true;
      const wave = waves[0];
      return { wave, start: stamp(start), end: stamp(end), startMs: start, endMs: end, pillar: pillar.label, star, groupId: group.id, ...LIFE_THEMES[group.id] };
    });
    const primary = segments.reduce((a, b) => b.endMs - b.startMs > a.endMs - a.startMs ? b : a);
    entries.push({ year, ageStart: ageAt(input, startMs), ageEnd: ageAt(input, endMs), start: stamp(startMs), end: stamp(endMs), startMs, endMs, boundaryMs, boundary: clockLabel(boundaryMs), groupId: primary.groupId, wave: primary.wave, ...LIFE_THEMES[primary.groupId], segments });
  }
  if (waveUncertain) return uncertain('出生時刻が暦の切り替わりに近く、運気の波が二つに分かれます。生まれた時刻や場所を確かめると、表示できる場合があります。');
  return { status: 'ok', version: 'life-2.0', timezone: 'Asia/Tokyo', dayStem: stems[0], dayElement: ELEMENT_NAMES[elementOfStem(stems[0])], asOf: stamp(current), entries };
}

const ageLabel = (entry) => entry.ageStart === entry.ageEnd ? `${entry.ageStart}歳` : `${entry.ageStart}〜${entry.ageEnd}歳`;

export function renderLifeFlow(flow, selectedYear) {
  if (flow?.status !== 'ok' || !flow.entries?.length) return `<p class="note">${esc(flow?.reason || '年ごとの流れを表示できませんでした。')}</p>`;
  const entries = flow.entries, selected = entries.some(e => e.year === Number(selectedYear)) ? Number(selectedYear) : entries.at(-1).year;
  const width = Math.max(380, entries.length * 78), height = 270, gap = width / entries.length;
  const y = level => 38 + (5 - level) * 43;
  const points = entries.flatMap((entry, i) => entry.segments.map((segment, j) => ({ entry, segment, x: gap * (i + (j + 1) / (entry.segments.length + 1)), y: y(segment.wave.level) })));
  const axis = Object.entries(LIFE_LEVELS).map(([level, row]) => `<text x="4" y="${y(Number(level)) + 4}" fill="currentColor" font-size="12">${esc(row.label)}</text>`).join('');
  const lines = Object.keys(LIFE_LEVELS).map(level => `<line x1="0" y1="${y(Number(level))}" x2="${width}" y2="${y(Number(level))}" stroke="currentColor" opacity=".22"/>`).join('');
  const dots = points.map(p => `<circle cx="${p.x.toFixed(2)}" cy="${p.y}" r="${p.entry.year === selected ? 6 : 4}" fill="currentColor"/>`).join('');
  const ticks = entries.map((e, i) => `<text x="${gap * (i + .5)}" y="246" text-anchor="middle" font-size="12" fill="currentColor">${e.year}</text>`).join('');
  const selectedBands = entries.map((e, i) => e.year === selected ? `<rect x="${i * gap}" y="12" width="${gap}" height="246" fill="currentColor" opacity=".07"/>` : '').join('');
  return `<div class="life-flow"><p class="note">18歳から今までの運気の波。上は「動きやすい」、下は「整える」を表します。命紋独自の占いの目安で、実際の出来事や成功する確率を示すものではありません。</p><div class="life-chart" style="display:grid;grid-template-columns:78px minmax(0,1fr);max-width:100%;color:var(--gold-soft,#e8cc8d)"><div class="life-fixed-axis" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="78" height="${height}" viewBox="0 0 78 ${height}" style="display:block">${axis}</svg></div><div class="life-chart-scroll" tabindex="0" role="region" aria-label="運気の波の図。横にスクロールできます。下の年選択から文字でも確認できます。" style="overflow-x:auto;min-width:0;max-width:100%"><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true" style="display:block;max-width:none">${selectedBands}${lines}<polyline points="${points.map(p => `${p.x.toFixed(2)},${p.y}`).join(' ')}" fill="none" stroke="currentColor" stroke-width="2.5"/>${dots}${ticks}</svg></div></div><p class="note">図は横に動かせます。年を選ぶと、その頃の過ごし方まで読めます。年の途中で暦が切り替わるため、点が二つある年もあります。</p><label for="life-year-select">詳しく見る年</label><select class="select" id="life-year-select" style="width:100%;max-width:100%;margin-top:8px">${entries.map(e => `<option value="${e.year}"${e.year === selected ? ' selected' : ''}>${e.year}年・${ageLabel(e)}：${esc(e.segments.map(s => s.wave.label).filter((v,i,a) => !i || v!==a[i-1]).join(' → '))}</option>`).join('')}</select><details class="why"><summary>運気の波は、どう計算している？</summary><p>生まれた日の五行に対して、生まれた月の季節と、生まれた年・月の干がどう関わるかを比べます。その年の干支を加えたときに偏りが緩む組み合わせを「動きやすい」側、強まる組み合わせを「整える」側に置く、命紋独自の編集規則です。年のテーマを単に高さへ置き換えたものではありません。</p><p>五行の関係は、同じ五行を+1、生む側を+2、生まれる側と自分が抑える側を−1、自分を抑える側を−2とします。出生月の地支を2倍、出生年・月の干を各1倍で合計。その年は干を2倍、地支を1倍で加えます。地支は主となる五行だけを使います。</p><p>加える前後の偏りの絶対値の差が、4以上なら「動きやすい」、1〜3なら「進める」、−1〜0なら「見極める」、−4〜−2なら「備える」、−5以下なら「整える」です。この重みと区切りは命紋の独自設定で、従来占術の確定した判定や、検証済みの予測式ではありません。</p></details></div>`;
}

export function renderLifeYear(flow, year) {
  if (flow?.status !== 'ok') return '';
  const entry = flow.entries.find(e => e.year === Number(year)) || flow.entries.at(-1);
  if (!entry) return '';
  const sections = entry.segments.map((s, i) => `<section><p class="eyebrow">運気の目安：${esc(s.wave.label)}</p><h3>${esc(s.theme)}</h3><p class="note">${dateLabel(s.startMs)}${i > 0 ? ` ${esc(entry.boundary.split(' ')[1])}ごろから` : 'から'}${dateLabel(s.endMs)}まで${i === 0 && entry.segments.length > 1 ? '（年の切り替わり前）' : ''}</p><p><strong>${esc(s.wave.advice)}</strong></p><p>${esc(s.description)}</p><p>${esc(s.example)}</p><p>${esc(s.meaning)}</p></section>`).join('');
  return `<article class="card life-year-detail" id="life-year-detail" tabindex="-1"><p class="eyebrow">${entry.year}年・${ageLabel(entry)}</p><h2>この頃のあなたを読み解く</h2><p class="note">表示期間：${esc(entry.start)}〜${esc(entry.end)}（日本時間）</p>${sections}<details class="why"><summary>この年の読みについて</summary><p>生まれた日の性質と、その年の暦から年のテーマを示しています。運気の波は、出生月も含めた五行の偏りを比べた命紋独自の目安です。実際に起きた出来事を判定したものではありません。</p><p>暦の年は1月1日ではなく立春（${esc(entry.boundary)}ごろ・日本時間）に切り替わります。${entry.segments.length > 1 ? 'この年は切り替わりの前後を分けて表示しています。' : '表示期間に含まれる区間だけを表示しています。'}境界時刻は概算です。</p><p>各年の区間は暦年です。最初の年は18歳の誕生日から、今年は現在までを含みます。2月29日生まれの方は、平年では3月1日に年齢を切り替えて表示します。</p></details></article>`;
}
