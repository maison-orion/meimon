// 研究仕様の「設計上の確認例」を固定の判定テストにする（AIなし）。node apps/meimon/tools/check-method.mjs
import { readOne, readCandidates, summaryOf } from "../method.js";
import { groupOf } from "../rules.js";
import { tenGod } from "../engine.js";
let fail = 0;
const check = (ok, label) => { if (!ok) { fail++; console.log("NG", label); } };
const ids = (xs) => xs.map((x) => x.id).join(",");

// 月干が傷官、年干が正官、時干が正財 → 基本 T04・T08・T06、組み合わせ C02
const r1 = readOne({ month: "傷官", year: "正官", hour: "正財" });
check(ids(r1.basics) === "T04,T08,T06", `例1 基本 ${ids(r1.basics)}`);
check(ids(r1.combos) === "C02", `例1 組み合わせ ${ids(r1.combos)}`);
check(summaryOf(r1).source === "C02", "例1 3点の出どころはC02");
// 年干と月干が比肩、時干不明 → T01を一件に統合。時干を補わない
const r2 = readOne({ month: "比肩", year: "比肩", hour: null });
check(ids(r2.basics) === "T01" && r2.order.length === 1, `例2 ${ids(r2.basics)}`);
// 時刻候補AだけC03が成立 → 共通の本質として断定しない
const r3 = readCandidates([{ month: "偏財", year: "印綬", hour: "比肩" }, { month: "偏財", year: "正官", hour: "比肩" }]);
check(!r3.combos.some((c) => c.id === "C03") && r3.conditional.some((c) => c.id === "C03"), "例3 C03は条件付き");
// 日干自身が甲 → 自身との比較をT01の根拠に加えない（starsOf は日柱を数えない。年月時に比肩がなければT01は出ない）
check(tenGod(0, 0) === "比肩" && !ids(readOne({ month: "食神", year: "偏財", hour: null }).basics).includes("T01"), "例4 日干自身を数えない");
// 年運が印綬、月運が傷官 → 別表示（群が別）
check(groupOf("印綬").theme === "学習と整理" && groupOf("傷官").theme === "制作と改善", "例5 年と月を別の群で表示");
// 組み合わせの並び：第一候補（月の星）を含むものが先、最大2件
const r6 = readOne({ month: "傷官", year: "劫財", hour: "正官" });
check(ids(r6.combos) === "C02,C06", `並び順 ${ids(r6.combos)}`);
const r7 = readOne({ month: "印綬", year: "偏財", hour: "比肩" });
check(ids(r7.combos) === "C03", `C03のみ ${ids(r7.combos)}`);
// 例6（利用者が「接客が得意」と入力）は画面側：相談文は method.js に渡さない＝入力経路が無いことで担保

console.log(JSON.stringify({ result: fail ? "NG" : "ok", failures: fail }));
process.exitCode = fail ? 1 : 0;
