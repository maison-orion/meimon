// 暦の計算を一次資料と照合する（AIを使わない）。node apps/meimon/tools/check-calendar.mjs
// 節入り：国立天文台 暦要項 2026年 二十四節気（https://eco.mtk.nao.ac.jp/koyomi/yoko/2026/rekiyou262.html、2026-09-24取得）
import * as E from "../engine.js";

const NAOJ_2026 = { 2: "02-04 05:02", 3: "03-05 22:59", 4: "04-05 03:40", 5: "05-05 20:49", 6: "06-06 00:48", 7: "07-07 10:57",
  8: "08-07 20:43", 9: "09-07 23:41", 10: "10-08 15:29", 11: "11-07 18:52", 12: "12-07 11:53" };
const MARGIN_MIN = 30; // engine.js の境界の余裕と同じ値。差がこれを超えたら失敗
let fail = 0, maxDiff = 0;
const check = (ok, label) => { if (!ok) { fail++; console.log("NG", label); } };

for (const [m, s] of Object.entries(NAOJ_2026)) {
  const [md, hm] = s.split(" ");
  const [mo, d] = md.split("-").map(Number), [h, mi] = hm.split(":").map(Number);
  const ref = Date.UTC(2026, mo - 1, d, h - 9, mi);
  const diff = (E.setsuInCalendarMonth(2026, Number(m)).ms - ref) / 60000;
  maxDiff = Math.max(maxDiff, Math.abs(diff));
  check(Math.abs(diff) < MARGIN_MIN, `節入り 2026-${m} 差${diff.toFixed(1)}分`);
}

// 日柱：2000-01-01＝戊午、1900-01-01＝甲戌（六十干支の通し番号から）
check(E.dayPillar(2000, 1, 1).label === "戊午", "日柱 2000-01-01");
check(E.dayPillar(1900, 1, 1).label === "甲戌", "日柱 1900-01-01");
// 60日で一巡する
check(E.dayPillar(2026, 1, 1).label === E.dayPillar(2026, 3, 2).label, "日柱 60日周期");
// 年柱：2026年の立春後は丙午、立春前は乙巳。月柱：丙年の寅月は庚寅（五虎遁）
check(E.yearMonthPillar(Date.UTC(2026, 1, 10)).year.label === "丙午", "年柱 2026立春後");
check(E.yearMonthPillar(Date.UTC(2026, 0, 20)).year.label === "乙巳", "年柱 2026立春前");
check(E.yearMonthPillar(Date.UTC(2026, 1, 10)).month.label === "庚寅", "月柱 2026寅月");
// 時柱：甲日の子の刻は甲子（五鼠遁）。23時台はその日の干で数える規約
check(E.hourPillar(0, 0).label === "甲子", "時柱 甲日0時");
check(E.hourPillar(0, 23).label === "甲子", "時柱 甲日23時（その日の干）");
// 通変：甲から見て 甲=比肩 乙=劫財 丙=食神 庚=偏官 辛=正官 癸=印綬
[["甲", "比肩"], ["乙", "劫財"], ["丙", "食神"], ["庚", "偏官"], ["辛", "正官"], ["癸", "印綬"]].forEach(([s, g]) => check(E.tenGod(0, E.STEMS.indexOf(s)) === g, `通変 甲→${s}`));
// 不確かな入力：時刻不明なら時柱は空、日付をまたぐ幅なら日柱が二つ
const cands = (i) => E.calcChart(i).candidates;
const uniq = (xs, k) => new Set(xs.map((c) => c[k]?.label ?? "-")).size;
check(cands({ y: 1990, m: 6, d: 1, timeMode: "unknown", country: "JP" }).every((c) => c.hour === null), "時刻不明で時柱なし");
check(cands({ y: 1990, m: 6, d: 1, timeMode: "unknown", country: "JP" }).length === 1, "時刻不明でも節入りから遠い日は候補1つ");
check(uniq(cands({ y: 1990, m: 6, d: 1, timeMode: "range", from: "23:00", to: "01:00", toNextDay: true, country: "JP" }), "day") === 2, "日またぎで日柱2候補");
// 立春の瞬間ちょうどに生まれた場合は年柱が二つの候補、2時間離れれば一つ（立春の時刻は計算値から取る）
const rs = new Date(E.setsuInCalendarMonth(1990, 2).ms + 9 * 3600000);
const hhmm = (d) => `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
check(uniq(cands({ y: 1990, m: 2, d: 4, timeMode: "exact", time: hhmm(rs), country: "JP" }), "year") === 2, "立春の瞬間は年柱2候補");
check(uniq(cands({ y: 1990, m: 2, d: 4, timeMode: "exact", time: hhmm(new Date(rs.getTime() + 7200000)), country: "JP" }), "year") === 1, "立春2時間後は年柱1つ");
// 候補は年・月・日・時の組のまま返す（ばらして組み直さない）
check(cands({ y: 1990, m: 2, d: 4, timeMode: "exact", time: hhmm(rs), country: "JP" }).every((c) => c.year && c.month && c.day && c.hour), "候補は命式の組");

console.log(JSON.stringify({ result: fail ? "NG" : "ok", failures: fail, naoj2026MaxDiffMin: Number(maxDiff.toFixed(1)) }));
process.exitCode = fail ? 1 : 0;
