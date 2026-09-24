// 年ごとのテーマを表示する。点の高さは運気の強弱・出来事の発生確率ではない。
import * as E from './engine.js?v=1.4.0';
import { groupOf } from './rules.js?v=1.4.0';

const HOUR = 3600000, DAY = 24 * HOUR, JST = 9 * HOUR;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const at = (y, m, d) => Date.UTC(y, m - 1, d) - JST;
const local = (ms) => new Date(ms + JST);
const stamp = (ms) => local(ms).toISOString().slice(0, 10);
const dateLabel = (ms) => { const d = local(ms); return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`; };
const clockLabel = (ms) => { const d = local(ms); return `${dateLabel(ms)} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const ageAt = (input, ms) => { const d = local(ms), y = d.getUTCFullYear(); return y - input.y - (ms < at(y, input.m, input.d) ? 1 : 0); };

export const LIFE_THEMES = Object.freeze({
  G1: { theme: '自分の意思', description: '周りの期待と、自分が望むことを分けて考える時期として読みます。人に合わせて選ぶことより、自分で納得できる選び方に目を向ける年です。', example: '進路や働き方を選ぶ場面なら、「周りがどう思うか」と「自分が続けたいか」の間で迷うことが、このテーマに重なります。', meaning: '人と違う選択をする勇気だけでなく、断ることや自分のペースを守ることも、この年の読みどころです。' },
  G2: { theme: '表現と工夫', description: '考えや好みを、自分なりの形で表す時期として読みます。決められた通りに進めるだけでなく、「もっとこうしたい」と感じる部分に目を向ける年です。', example: '趣味に夢中になったり、仕事の進め方を工夫したり、自分の意見を伝えようとする場面が、このテーマに重なります。', meaning: 'うまく見せることより、自分の感じたことを言葉や形にする過程を大切にする読みです。' },
  G3: { theme: '人との交流', description: '人と関わる中で、自分の大切にしたいことを確かめる時期として読みます。出会いの多さだけでなく、付き合い方や約束の守り方にも目を向ける年です。', example: '誰かのために時間を使う、誘いを受ける、生活の中でお金の使い道を考える。こうした「自分の持つものを誰とどう分けるか」が、このテーマに重なります。', meaning: '相手に合わせるだけでなく、無理なく付き合える距離や、自分にも残しておきたい時間を考える読みです。' },
  G4: { theme: '役割と責任', description: '自分が引き受けることを、はっきりさせる時期として読みます。周りから求められることと、自分にできることの両方に目を向ける年です。', example: '仕事や家庭で担当が決まる、締め切りを意識する、人との約束を優先する。こうした場面が、このテーマに重なります。', meaning: '頑張り続けることだけを指しません。引き受ける範囲を決め、必要なときに助けを求めることも含めた読みです。' },
  G5: { theme: '学びと準備', description: '答えを急がず、知ることや理解することを大切にする時期として読みます。外に向かって動くことだけでなく、自分の中に知識や安心を蓄える年です。', example: '勉強を始める、詳しい人に相談する、次に進むための準備をする。表からは変化が小さく見える時間も、このテーマに重なります。', meaning: 'まだ成果が見えていない時間を、遅れと決めつけない読みです。考えを整理し、納得できる理由を見つける過程に目を向けます。' },
});

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
      return { start: stamp(start), end: stamp(end), startMs: start, endMs: end, pillar: pillar.label, star, groupId: group.id, ...LIFE_THEMES[group.id] };
    });
    const primary = segments.reduce((a, b) => b.endMs - b.startMs > a.endMs - a.startMs ? b : a);
    entries.push({ year, ageStart: ageAt(input, startMs), ageEnd: ageAt(input, endMs), start: stamp(startMs), end: stamp(endMs), startMs, endMs, boundaryMs, boundary: clockLabel(boundaryMs), groupId: primary.groupId, ...LIFE_THEMES[primary.groupId], segments });
  }
  return { status: 'ok', version: 'life-1.0', timezone: 'Asia/Tokyo', dayStem: stems[0], asOf: stamp(current), entries };
}

const ageLabel = (entry) => entry.ageStart === entry.ageEnd ? `${entry.ageStart}歳` : `${entry.ageStart}〜${entry.ageEnd}歳`;

export function renderLifeFlow(flow, selectedYear) {
  if (flow?.status !== 'ok' || !flow.entries?.length) return `<p class="note">${esc(flow?.reason || '年ごとの流れを表示できませんでした。')}</p>`;
  const entries = flow.entries, selected = entries.some(e => e.year === Number(selectedYear)) ? Number(selectedYear) : entries.at(-1).year;
  const width = Math.max(480, entries.length * 88 + 140), height = 270, left = 128, gap = (width - left - 28) / entries.length;
  const y = id => 38 + (Number(id.slice(1)) - 1) * 43;
  const points = entries.flatMap((entry, i) => entry.segments.map((segment, j) => ({ entry, segment, x: left + gap * (i + (j + 1) / (entry.segments.length + 1)), y: y(segment.groupId) })));
  const lines = Object.entries(LIFE_THEMES).map(([id, row]) => `<line x1="120" y1="${y(id)}" x2="${width - 12}" y2="${y(id)}" stroke="currentColor" opacity=".22"/><text x="4" y="${y(id) + 4}" fill="currentColor" font-size="13">${row.theme}</text>`).join('');
  const dots = points.map(p => `<circle cx="${p.x.toFixed(2)}" cy="${p.y}" r="${p.entry.year === selected ? 6 : 4}" fill="currentColor"/>`).join('');
  const ticks = entries.map((e, i) => `<text x="${left + gap * (i + .5)}" y="246" text-anchor="middle" font-size="12" fill="currentColor">${e.year}</text>`).join('');
  return `<div class="life-flow"><p class="note">18歳の誕生日から現在まで。点の高さは、その時期のテーマを表します。上下は運の良し悪しではありません。</p><div class="life-chart-scroll" tabindex="0" role="region" aria-label="年ごとのテーマの図。横にスクロールできます。各年の内容は下のボタンでも確認できます。" style="overflow-x:auto;max-width:100%"><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true" style="display:block;max-width:none;color:var(--gold-soft,#e8cc8d)">${lines}<polyline points="${points.map(p => `${p.x.toFixed(2)},${p.y}`).join(' ')}" fill="none" stroke="currentColor" stroke-width="2" opacity=".6"/>${dots}${ticks}</svg></div><p class="note">図を横に動かすと、ほかの年も見られます。下の年を選ぶと、その頃の読みを詳しく見られます。年齢はその年に含まれる範囲です。年の途中でテーマが切り替わるため、1年に点が二つあることがあります。</p><div class="life-year-buttons" role="group" aria-label="詳しく見る年を選択" >${entries.map(e => `<button type="button" class="btn secondary" data-act="life-year" data-year="${e.year}" aria-pressed="${e.year === selected}" ><span>${e.year}年・${ageLabel(e)}</span><span class="life-year-theme">${esc([...new Set(e.segments.map(s => s.theme))].join(' → '))}</span></button>`).join('')}</div></div>`;
}

export function renderLifeYear(flow, year) {
  if (flow?.status !== 'ok') return '';
  const entry = flow.entries.find(e => e.year === Number(year)) || flow.entries.at(-1);
  if (!entry) return '';
  const sections = entry.segments.map((s, i) => `<section><h3>${esc(s.theme)}</h3><p class="note">${dateLabel(s.startMs)}${i > 0 ? ` ${esc(entry.boundary.split(' ')[1])}ごろから` : 'から'}${dateLabel(s.endMs)}まで${i === 0 && entry.segments.length > 1 ? '（年の切り替わり前）' : ''}</p><p>${esc(s.description)}</p><p>${esc(s.example)}</p><p>${esc(s.meaning)}</p></section>`).join('');
  return `<article class="card life-year-detail" id="life-year-detail" tabindex="-1"><p class="eyebrow">${entry.year}年・${ageLabel(entry)}</p><h2>この頃のあなたを読み解く</h2><p class="note">表示期間：${esc(entry.start)}〜${esc(entry.end)}（日本時間）</p>${sections}<details class="why"><summary>この年の読みについて</summary><p>生まれた日の性質と、その年の暦の組み合わせからテーマを読みます。実際に起きた出来事を判定したものではありません。</p><p>暦の年は1月1日ではなく立春（${esc(entry.boundary)}ごろ・日本時間）に切り替わります。${entry.segments.length > 1 ? 'この年は切り替わりの前後を分けて表示しています。' : '表示期間に含まれる区間だけを表示しています。'}境界時刻は概算です。</p><p>各年の区間は暦年です。最初の年は18歳の誕生日から、今年は現在までを含みます。2月29日生まれの方は、平年では3月1日に年齢を切り替えて表示します。</p></details></article>`;
}
