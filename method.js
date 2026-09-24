// 命紋の読みの選び方（研究仕様0.2の固定手順）。文章は生成せず、rules.js の表から選ぶだけ。
import { BASICS, COMBOS } from "./rules.js?v=1.2.0";

const POSITIONS = ["month", "year", "hour"]; // 月干を第一候補、年干・時干を補助候補（命紋の仮置き）

/** 命式1組の星（{year, month, hour}、欠けた位置は null）から、基本読みと組み合わせを選ぶ */
export function readOne(stars) {
  // 1〜3. 月→年→時の順に並べ、同じ星は一つにまとめる。欠けた位置は欠測のまま
  const order = [];
  for (const p of POSITIONS) if (stars[p] && !order.includes(stars[p])) order.push(stars[p]);
  const primaryStar = stars.month ?? order[0] ?? null;
  // 4〜5. 異なる二つの星がそろう組み合わせ。第一候補を含むものを先に、同順位はID順。最大2件
  const combos = COMBOS.filter((c) => c.stars.every((s) => order.includes(s)))
    .sort((a, b) => (b.stars.includes(primaryStar) - a.stars.includes(primaryStar)) || a.id.localeCompare(b.id))
    .slice(0, 2);
  // 6. 基本読みは異なる星を最大3件
  const basics = order.slice(0, 3).map((s) => ({ star: s, ...BASICS[s] }));
  return { order, primaryStar, basics, combos };
}

/** 本質の3点（得意な動き・環境・負担）の出どころ。組み合わせがあればその先頭、なければ第一候補の基本読み */
export function summaryOf(one) {
  if (one.combos.length) { const c = one.combos[0]; return { source: c.id, move: c.move, env: c.env, burden: c.burden, stars: c.stars }; }
  const b = one.basics[0];
  return b ? { source: b.id, move: b.move, env: b.env, burden: b.burden, stars: [b.star] } : null;
}

/**
 * 候補（出生時刻の幅などで分かれた命式）ごとに読み、全候補で一致したものだけを共通結果にする。
 * 一部の候補だけで成立するものは conditional（条件付き候補）に分ける。
 */
export function readCandidates(starsList) {
  const each = starsList.map(readOne);
  const idsOf = (r) => ({ b: r.basics.map((x) => x.id), c: r.combos.map((x) => x.id) });
  const all = each.map(idsOf);
  const inAll = (kind, id) => all.every((x) => x[kind].includes(id));
  const first = each[0];
  const commonBasics = first.basics.filter((x) => inAll("b", x.id));
  const commonCombos = first.combos.filter((x) => inAll("c", x.id));
  const seen = new Set([...commonBasics.map((x) => x.id), ...commonCombos.map((x) => x.id)]);
  const conditional = [];
  each.forEach((r, i) => {
    for (const x of [...r.combos, ...r.basics]) if (!seen.has(x.id)) { seen.add(x.id); conditional.push({ ...x, candidate: i }); }
  });
  const sums = each.map(summaryOf);
  const sameSummary = sums.every((s) => s && s.source === sums[0]?.source);
  return {
    candidates: each.length,
    basics: commonBasics, combos: commonCombos, conditional,
    summary: sameSummary ? sums[0] : null, // 候補で3点の出どころが違えば断定しない
    summaries: sums,
  };
}
