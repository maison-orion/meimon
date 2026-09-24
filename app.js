// 命紋診断（β版）。生年月日から「得意な動き・力が出やすい環境・負担になりやすい条件」と、これから12か月の読みを出す。
// 実行時にAIは呼ばない。暦は engine.js、読みの選び方は method.js、文言は rules.js の表から選ぶだけ。
// 入力は端末の外へ送らない（sessionStorage のみ。タブを閉じると消える）。シェアには生年月日や呼び名を入れない。
import * as E from "./engine.js?v=1.0.0";
import * as R from "./rules.js?v=1.0.0";
import * as M from "./method.js?v=1.0.0";

const APP_VERSION = "app-1.0-beta";

// ── 状態（版が変わったら古い保存内容は使わない） ──
const blank = () => ({ focus: null, draft: {}, input: null, reading: null, reflections: {}, fits: {}, feeling: null, gridView: false, fresh: false });
let S = load();
function load() {
  try {
    const s = JSON.parse(sessionStorage.getItem("meimon") || "{}");
    return s.v === APP_VERSION ? { ...blank(), ...s } : blank();
  } catch { return blank(); }
}
function save() { try { sessionStorage.setItem("meimon", JSON.stringify({ ...S, v: APP_VERSION })); } catch { /* 保存できなくても画面は動く */ } }

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const nick = () => esc(S.input?.nick || "あなた");
const main = document.getElementById("main");
const topbar = document.getElementById("topbar");
const resultnav = document.getElementById("resultnav");
const ymKey = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
const today = () => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }; };
const crescent = `<svg class="crescent" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 3.2A9 9 0 1 0 20.8 16 7.5 7.5 0 0 1 15.5 3.2Z"/></svg>`;
const kind = (k) => ({ read: `<span class="kind read">占いからの読み</span>`, told: `<span class="kind told">教えてもらったこと</span>`, hint: `<span class="kind hint">試すヒント</span>` })[k];
const radio = (name, val, label, cur) => `<label class="choice"><input type="radio" name="${name}" value="${val}" ${cur === val ? "checked" : ""}><span class="mark" aria-hidden="true"></span><span>${label}</span></label>`;

let chartCache = null;
function chart() {
  if (!S.input) return null;
  const key = JSON.stringify(S.input);
  if (chartCache?.key !== key) chartCache = { key, value: E.calcChart(S.input) };
  return chartCache.value;
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove("show"), 2600);
}

// ── 上部 ──
function bar(kindOf, opts = {}) {
  const brand = `<a class="brand" href="#/"><img src="assets/owl-96.png" alt="" width="34" height="34"><span>命紋</span></a>`;
  if (kindOf === "home") return `<a class="brand" href="#/">命紋<span class="beta">β</span></a><span class="spacer"></span><a class="iconlink" href="#/how">この診断について</a>`;
  if (kindOf === "flow") return `<button class="iconlink" type="button" data-act="back">← 戻る</button><span class="spacer"></span><span class="context">${esc(opts.label || "")}</span>`;
  if (kindOf === "result") return `${brand}<span class="context">${esc(S.reading?.period?.label || "")}</span><span class="spacer"></span><a class="iconlink" href="#/r/settings">設定</a>`;
  return `${brand}<span class="spacer"></span><span class="context">${esc(opts.label || "")}</span>`;
}

// ═════════ 入口 ═════════
function sHome() {
  return {
    bar: bar("home"),
    html: `<div class="hero-wrap">
  <section class="hero" aria-labelledby="h">
    <div class="halo"><img class="owl" src="assets/owl-256.png" alt="" width="84" height="84"></div>
    <p class="eyebrow" style="margin-top:16px">${crescent} 命紋診断（めいもんしんだん）</p>
    <h1 class="display" id="h" tabindex="-1">今の仕事を<br>続けるか、<br>変えるか。</h1>
    <p class="lead" style="margin-top:12px">生年月日から、あなたの得意な動き、力が出やすい環境、負担になりやすい条件と、これから12か月の読みを出します。</p>
    <ul class="promise" aria-label="この診断の特徴"><li>無料</li><li>登録なし</li><li>質問は2つ</li><li>入力は端末の中だけで計算</li></ul>
    <div class="actions" style="margin-top:28px">
      <a class="btn" href="#/focus">無料で診断する</a>
      ${S.reading ? `<a class="btn secondary" href="#/r">さっきの結果を見る</a>` : ""}
      <a class="textlink" href="#/sample">結果の見本を見る →</a>
    </div>
  </section>
  <aside class="mini-sample card" aria-label="結果の見本">
    <p class="eyebrow">結果の見本（編集見本）</p>
    <div class="thread" style="margin-top:16px">
      <div class="knot"><p class="note">相談</p><p>今の仕事を続けるか迷っています。</p></div>
      <div class="knot answer"><p class="note">あなたの命紋</p><p class="answer-text">決まっている仕事の進め方に、改善の余地を見つける</p></div>
      <div class="knot step"><p class="note">今月試すこと</p><p>小さな成果物を一つ作り、反応を確かめる</p></div>
    </div>
  </aside>
</div>`,
  };
}

// ═════════ 結果の見本 ═════════
const SAMPLE_GROUPS = ["make", "make", "deal", "deal", "duty", "duty", "learn", "learn", "self", "self", "make", "make"];
function sSample() {
  const c02 = R.COMBOS.find((c) => c.id === "C02");
  const months = SAMPLE_GROUPS.map((k, i) => ({ m: ((9 + i) % 12) + 1, y: 2026 + Math.floor((9 + i) / 12), g: R.GROUPS[k] }));
  return {
    bar: bar("plain", { label: "結果の見本" }),
    html: `<p class="sample-flag">結果の見本｜編集見本。特定の人を計算した結果ではありません</p>
<div class="stack" style="margin-top:20px">
  <section class="cover stack-s" aria-labelledby="h">
    <p class="eyebrow">${crescent} あおいさんの命紋（見本）</p>
    <h1 class="display cover-title" id="h" tabindex="-1">${c02.move}</h1>
    <p>${c02.hypothesis}</p>
  </section>
  <section class="card stack-s">${kind("read")}${threeLines(c02)}</section>
  <div class="thread">
    <div class="knot"><p class="note">今回の相談</p><p class="quote">${R.FOCUS.stay.label}</p></div>
    <div class="knot answer"><p class="note">相談への回答</p><p class="answer-text">${R.FOCUS.stay.headline}</p><p style="margin-top:8px">${R.FOCUS.stay.answer(c02, R.GROUPS.duty.theme)}</p></div>
    <div class="knot step"><p class="note">今月の一歩（見本）</p><p>${R.GROUPS.make.action}</p></div>
  </div>
  <section class="section stack-s" aria-labelledby="s-year"><h2 class="h2" id="s-year">これから12か月（見本）</h2>
    <p class="note">2026年10月〜2027年9月。月のテーマは見本の並びで、この年月の運勢を示すものではありません。</p>
    <ol class="cal">${months.map(({ m, y, g }) => `<li><div class="cal-row"><span class="mon">${m}月<small>${y}年</small></span><span class="theme">${g.theme}</span><span></span><span class="act">${g.action}</span></div></li>`).join("")}</ol>
  </section>
  <div class="actions section"><a class="btn" href="#/focus">自分の命紋を診断する</a></div>
</div>`,
  };
}

// ═════════ 質問1：相談テーマ ═════════
function sFocus() {
  return {
    bar: bar("flow", { label: "質問 1 / 2" }),
    html: `<form class="stack form-narrow" data-form="focus" novalidate>
  <h1 class="h1" tabindex="-1">いま、仕事で考えたいことは？</h1>
  <p>選んだ内容に合わせて、回答と試すことの例を変えます。生まれた日の計算には使いません。</p>
  <fieldset><legend class="visually-hidden">仕事で考えたいこと</legend>
    <div class="choices" id="f-focus">${Object.entries(R.FOCUS).map(([k, f]) => radio("focus", k, f.label, S.focus)).join("")}</div>
    <p class="error" id="e-focus" hidden>考えたいことに近いものを一つ選んでください。</p>
  </fieldset>
  <button class="btn" type="submit">次へ</button>
</form>`,
  };
}

// ═════════ 質問2：生まれたとき ═════════
const OFFSETS = [-12, -11, -10, -9, -8, -7, -6, -5, -4, -3.5, -3, -2, -1, 0, 1, 2, 3, 3.5, 4, 4.5, 5, 5.5, 5.75, 6, 6.5, 7, 8, 8.75, 9, 9.5, 10, 10.5, 11, 12, 13, 14];
const offLabel = (o) => `UTC${o >= 0 ? "+" : "−"}${Math.floor(Math.abs(o))}${Math.abs(o) % 1 ? ":" + String(Math.round((Math.abs(o) % 1) * 60)).padStart(2, "0") : ""}`;
function sBirth() {
  const d = { country: "JP", timeMode: "", ...S.draft };
  const v = (k) => esc(d[k] ?? "");
  return {
    bar: bar("flow", { label: "質問 2 / 2" }),
    html: `<form class="stack form-narrow" data-form="birth" novalidate>
  <h1 class="h1" tabindex="-1">生まれたときの情報を教えてください</h1>
  <div class="errsummary" id="errsum" tabindex="-1" hidden></div>
  <fieldset id="f-date"><legend>生年月日（西暦）</legend><span class="why note" style="display:block;margin:-4px 0 8px">生まれた日の干支を計算するために使います。</span>
    <div class="row">
      <label class="field"><span class="label visually-hidden">年</span><input class="input" id="by" name="by" inputmode="numeric" maxlength="4" placeholder="1990" value="${v("by")}"></label><span class="unit">年</span>
      <label class="field"><span class="label visually-hidden">月</span><input class="input" id="bm" name="bm" inputmode="numeric" maxlength="2" value="${v("bm")}"></label><span class="unit">月</span>
      <label class="field"><span class="label visually-hidden">日</span><input class="input" id="bd" name="bd" inputmode="numeric" maxlength="2" value="${v("bd")}"></label><span class="unit">日</span>
    </div>
    <label class="note" style="display:flex;gap:8px;align-items:center;margin-top:8px">カレンダーから選ぶ <input class="input" style="width:auto;min-height:44px" type="date" id="bcal" min="1900-01-01"></label>
    <p class="error" id="e-date" hidden></p>
  </fieldset>

  <fieldset id="f-time"><legend>生まれた時刻</legend><span class="why note" style="display:block;margin:-4px 0 8px">わからなくても診断できます。時刻によって変わる部分は、確定した読みとして表示しません。</span>
    <div class="choices">${radio("timeMode", "unknown", "わからない", d.timeMode)}${radio("timeMode", "exact", "記録がある", d.timeMode)}${radio("timeMode", "range", "だいたいわかる", d.timeMode)}</div>
    <p class="error" id="e-timeMode" hidden></p>
  </fieldset>
  <label class="field" for="time" id="w-exact" ${d.timeMode === "exact" ? "" : "hidden"}><span class="label">記録の時刻（24時間表示）</span>
    <input class="input" type="time" id="time" name="time" value="${v("time")}"><p class="error" id="e-time" hidden></p></label>
  <fieldset id="w-range" ${d.timeMode === "range" ? "" : "hidden"}><legend>いちばん早い時刻 〜 いちばん遅い時刻</legend>
    <div class="row"><label class="field"><span class="label visually-hidden">いちばん早い時刻</span><input class="input" type="time" id="from" name="from" value="${v("from")}"></label><span class="unit">〜</span>
    <label class="field"><span class="label visually-hidden">いちばん遅い時刻</span><input class="input" type="time" id="to" name="to" value="${v("to")}"></label></div>
    <label class="note" style="display:flex;gap:8px;align-items:center;min-height:48px"><input type="checkbox" name="toNextDay" ${d.toNextDay ? "checked" : ""}> 遅い方の時刻は翌日（日付をまたぐ）</label>
    <p class="note">幅の真ん中の時刻に置き換えず、幅全体で読みます。</p>
    <p class="error" id="e-range" hidden></p>
  </fieldset>

  <details class="why" ${d.country !== "JP" || d.nick || d.city ? "open" : ""}><summary>生まれた国・呼び名（任意）</summary><div class="stack-s">
    <label class="field" for="country"><span class="label">出生国</span><span class="why">その土地の標準時で計算するために使います。今いる場所からは判断しません。</span>
      <select class="select" id="country" name="country">
        <option value="JP" ${d.country === "JP" ? "selected" : ""}>日本</option>
        <option value="other" ${d.country === "other" ? "selected" : ""}>日本以外（時差を選ぶ）</option>
        <option value="unknown" ${d.country === "unknown" ? "selected" : ""}>わからない</option>
      </select></label>
    <label class="field" for="offset" id="w-offset" ${d.country === "other" ? "" : "hidden"}><span class="label">生まれた土地の標準時</span><span class="why">生まれたときの、その土地の時計と世界標準時の差です。夏時間だった場合は、その差を選んでください。</span>
      <select class="select" id="offset" name="offset"><option value="">選んでください</option>${OFFSETS.map((o) => `<option value="${o}" ${String(d.offset) === String(o) ? "selected" : ""}>${offLabel(o)}</option>`).join("")}</select>
      <p class="error" id="e-offset" hidden></p></label>
    <label class="field" for="city"><span class="label">出生市区町村</span><span class="why">今の住所ではなく、生まれた場所です。この版の計算では標準時を使うため、市区町村で結果は変わりません。</span>
      <input class="input" id="city" name="city" maxlength="40" value="${v("city")}"></label>
    <label class="field" for="nick"><span class="label">呼び名</span><span class="why">結果の見出しに使います。空欄なら「あなた」と表示します。シェアする文や画像には入りません。</span>
      <input class="input" id="nick" name="nick" maxlength="20" autocomplete="nickname" value="${v("nick")}"></label>
  </div></details>

  <p class="status note" id="calcstatus" role="status" aria-live="polite"></p>
  <button class="btn" type="submit">診断する</button>
  <p class="note">入力は、この端末の中だけで計算します。どこにも送りません。<a href="#/how">入力情報の扱い</a></p>
</form>`,
  };
}

function readBirth(form) {
  const f = new FormData(form);
  const d = Object.fromEntries(f.entries());
  d.toNextDay = f.get("toNextDay") === "on";
  return d;
}

function validateBirth(d) {
  const errs = [];
  const y = Number(d.by), m = Number(d.bm), day = Number(d.bd);
  const t = today();
  if (!d.by || !d.bm || !d.bd) errs.push(["date", "生年月日を、年・月・日すべて数字で入力してください。", "by"]);
  else if (!E.validDate(y, m, day)) errs.push(["date", "存在しない日付です。年・月・日を確かめてください。", "by"]);
  else if (y < 1900) errs.push(["date", "この版は1900年以降の生年月日に対応しています。", "by"]);
  else if (ymKey(y, m) + String(day).padStart(2, "0") > ymKey(t.y, t.m) + String(t.d).padStart(2, "0")) errs.push(["date", "未来の日付になっています。生年月日を確かめてください。", "by"]);
  else {
    const age = t.y - y - (t.m < m || (t.m === m && t.d < day) ? 1 : 0);
    if (age < 18) errs.push(["date", "命紋診断は、仕事の相談を想定して18歳以上の方を対象にしています。入力した生年月日は保存していません。結果の見本は見られます。", "by", true]);
  }
  if (d.country === "other" && !d.offset) errs.push(["offset", "生まれた土地の標準時を選んでください。わからない場合は、出生国で「わからない」を選べます。", "offset"]);
  if (!d.timeMode) errs.push(["timeMode", "生まれた時刻について、わからない・記録がある・だいたいわかる のどれかを選んでください。", "f-time"]);
  if (d.timeMode === "exact" && !d.time) errs.push(["time", "記録の時刻を入力してください。わからない場合は「わからない」を選べます。", "time"]);
  if (d.timeMode === "range") {
    if (!d.from || !d.to) errs.push(["range", "いちばん早い時刻といちばん遅い時刻の両方を入力してください。", "from"]);
    else if (!d.toNextDay && d.to < d.from) errs.push(["range", "遅い方の時刻が早い方より前になっています。日付をまたぐ場合は「翌日」にチェックしてください。", "from"]);
    else if (d.toNextDay && d.to > d.from) errs.push(["range", "時刻の幅が24時間を超えています。日付をまたがない場合は「翌日」のチェックを外してください。", "from"]);
  }
  return errs;
}

function timeText(i) {
  if (i.timeMode === "exact") return `${i.time}（記録あり）`;
  if (i.timeMode === "range") return `${i.from}〜${i.toNextDay ? "翌日" : ""}${i.to}（だいたい）`;
  return "わからない";
}
function placeText(i) {
  const c = i.country === "JP" ? "日本" : i.country === "other" ? `日本以外（${offLabel(i.offset)}）` : "わからない";
  return i.city ? `${c}・${esc(i.city)}` : c;
}

// ═════════ 本質の読み（method.js が表から選ぶ） ═════════
const POS = { year: "年", month: "月", hour: "時" };
function essenceOf(c) { return M.readCandidates(c.candidates.map(E.starsOf)); }
function dayStems(c) { return [...new Set(c.candidates.map((x) => x.day.stem))]; }
function starLine(c) {
  const k = c.candidates[0], st = E.starsOf(k);
  return ["year", "month", "hour"].map((p) => (k[p] ? `${POS[p]}の干「${E.STEMS[k[p].stem]}」は${st[p]}` : `${POS[p]}の干は時刻がわからないため読みません`)).join("、");
}
function reasonText(c, s) {
  const how = s.source.startsWith("C")
    ? `${s.stars.join("と")}が別の位置にそろうため、命紋の組み合わせの読みを使っています。`
    : `月の干の星（${s.stars[0]}）を第一の手がかりとして使っています。`;
  return `四柱推命の一部を使う限定モデルで読んでいます。生まれた日の干（日干「${E.STEMS[c.candidates[0].day.stem]}」）を自分側とし、${starLine(c)}です。${how}${c.candidates.length > 1 ? "時刻の候補によって変わる読みは、条件付きの候補として分けています。" : ""}`;
}
function threeLines(s, extra = "", withMove = true) {
  return `<dl class="three">
    ${withMove ? `<div><dt>得意な動き</dt><dd>${s.move}</dd></div>` : ""}
    <div><dt>力が出やすい環境</dt><dd>${s.env}</dd></div>
    <div><dt>負担になりやすい条件</dt><dd>${s.burden}</dd></div>${extra}
  </dl>`;
}
function candidatesHtml(r) {
  return `<section class="stack-s"><p class="quiet">生まれた時刻の幅の中で、手がかりにする星が変わります。どちらか一つに決めず、候補を並べます。時刻の幅を狭められる場合は、<a href="#/birth">入力を直す</a>と一つに絞れることがあります。</p>
    ${r.uniq.map((x, i) => `<section class="card stack-s"><h2 class="h2">候補${i + 1}：${x.move}</h2>${kind("read")}${threeLines(x, "", false)}</section>`).join("")}</section>`;
}

// ═════════ 結果の組み立て（確定した本文を保存し、再表示で作り直さない） ═════════
function periodFrom(t) {
  const e = t.m === 1 ? { y: t.y, m: 12 } : { y: t.y + 1, m: t.m - 1 };
  return { start: { y: t.y, m: t.m }, end: e, label: `${t.y}年${t.m}月〜${e.y}年${e.m}月` };
}
function buildReading() {
  const c = chart();
  const ess = essenceOf(c);
  const focus = S.focus || "unsure";
  const uniq = [...new Map(ess.summaries.filter(Boolean).map((x) => [x.source, x])).values()];
  const base = {
    createdAt: new Date().toISOString(), versions: { calc: E.CALC_VERSION, rules: R.RULES_VERSION, app: APP_VERSION },
    focus, consult: R.FOCUS[focus].label, summary: ess.summary, uniq, starLine: starLine(c),
    candidates: c.candidates.map((k) => ["year", "month", "day", "hour"].map((q) => k[q]?.label ?? "―").join("・")),
  };
  S.reflections = {}; S.fits = {}; S.feeling = null;
  if (dayStems(c).length > 1) { S.reading = { ...base, split: "day" }; return; }
  const ds = c.candidates[0].day.stem;
  const natal = new Set(c.candidates.flatMap((k) => Object.values(E.starsOf(k)).filter(Boolean)));
  const period = periodFrom(today());
  const months = E.yearPlan(period.start.y, period.start.m, ds).map((x) => {
    const star = E.TEN_GODS[x.after.god], bstar = E.TEN_GODS[x.before.god], ystar = E.TEN_GODS[x.after.yearGod];
    const g = R.groupOf(star), bg = R.groupOf(bstar), yg = R.groupOf(ystar);
    return { key: ymKey(x.y, x.m), y: x.y, m: x.m, last: new Date(x.y, x.m, 0).getDate(), boundary: x.boundary,
      star, theme: g.theme, action: g.action, pillar: x.after.month.label, same: natal.has(star),
      before: { star: bstar, theme: bg.theme, pillar: x.before.month.label },
      year: { star: ystar, theme: yg.theme, pillar: x.after.year.label } };
  });
  const years = [];
  months.forEach((mm, i) => { if (!i || mm.year.pillar !== months[i - 1].year.pillar) years.push({ ...mm.year, from: i ? { y: mm.y, m: mm.m, d: mm.boundary.day } : null }); });
  const count = {};
  months.forEach((mm) => { count[mm.year.pillar] = (count[mm.year.pillar] || 0) + 1; });
  const mainYear = years.slice().sort((a, b) => count[b.pillar] - count[a.pillar])[0];
  const s = ess.summary;
  S.reading = {
    ...base, split: s ? null : "time", dayStem: E.STEMS[ds], reason: s ? reasonText(c, s) : "",
    basics: ess.basics, combos: ess.combos, conditional: ess.conditional,
    period, years, yearTheme: mainYear.theme, months,
    headline: s ? R.FOCUS[focus].headline : "生まれた時刻によって、読みが分かれます",
    answer: s ? R.FOCUS[focus].answer(s, mainYear.theme) : "入力された時刻の幅の中で、手がかりにする星が変わります。相談への回答は一つに決めず、候補を並べています。近いと感じるほうを確かめてみてください。",
  };
}

// ═════════ 結果 ═════════
function periodState(r = S.reading) {
  const t = today(), now = ymKey(t.y, t.m);
  const s = ymKey(r.period.start.y, r.period.start.m), e = ymKey(r.period.end.y, r.period.end.m);
  return now < s ? "before" : now > e ? "after" : "in";
}
function monthState(mm) { const t = today(), now = ymKey(t.y, t.m); return mm.key < now ? "past" : mm.key === now ? "now" : "future"; }
const monthName = (mm, full) => (full || mm.m === 1 ? `${mm.y}年${mm.m}月` : `${mm.m}月`);
function currentMonth(r) { return periodState(r) === "in" ? r.months.find((mm) => monthState(mm) === "now") : r.months[0]; }
function yearsText(r) {
  return r.years.map((y) => `${y.from ? `${y.from.y}年${y.from.m}月${y.from.d}日ごろ（立春）から` : "期間のはじめ"}：「${y.theme}」（${y.pillar}の年・${y.star}）`).join("<br>");
}
function needReading(allowSplit = false) {
  if (!S.reading) return redirect("#/focus");
  if (!allowSplit && S.reading.split === "day") return redirect("#/r");
  return null;
}

// シェア：読みの内容と、その読みを紹介するページへのリンクだけ（生年月日・呼び名は入れない）
const typeOf = (id) => R.COMBOS.find((c) => c.id === id) || Object.entries(R.BASICS).map(([star, b]) => ({ star, ...b })).find((b) => b.id === id);
const shareUrl = (r) => `${location.origin}${location.pathname}#/t/${r.summary.source}`;
const shareText = (r) => R.SHARE_TEXT(r.summary.move);
function shareBlock(r) {
  const u = encodeURIComponent(shareUrl(r)), tx = encodeURIComponent(shareText(r));
  return `<section class="card stack-s noprint" aria-labelledby="sh"><h2 class="h2" id="sh">結果をシェアする</h2>
    <p class="note">シェアされるのは命紋の読みと、この診断へのリンクだけです。生年月日や呼び名は入りません。</p>
    <div class="sharebtns">
      <button class="btn" type="button" data-act="card">画像で保存・シェア</button>
      ${"share" in navigator ? `<button class="btn secondary" type="button" data-act="share">ほかのアプリで</button>` : ""}
      <a class="btn secondary" href="https://twitter.com/intent/tweet?text=${tx}&amp;url=${u}" target="_blank" rel="noopener">Xに投稿</a>
      <a class="btn secondary" href="https://www.threads.net/intent/post?text=${tx}%0A${u}" target="_blank" rel="noopener">Threadsに投稿</a>
      <a class="btn secondary" href="https://social-plugins.line.me/lineit/share?url=${u}" target="_blank" rel="noopener">LINEで送る</a>
      <button class="btn secondary" type="button" data-act="copy">リンクをコピー</button>
    </div></section>`;
}

function sResult() {
  const r = S.reading; if (!r) return needReading();
  const fresh = S.fresh; if (fresh) { S.fresh = false; save(); }
  if (r.split === "day") {
    return {
      bar: bar("plain", { label: "診断結果" }),
      html: `<div class="stack">
  <section class="cover stack-s ${fresh ? "reveal" : ""}" aria-labelledby="h"><p class="eyebrow">${crescent} ${nick()}の命紋</p>
    <h1 class="h1" id="h" tabindex="-1">生まれた日の読みが、候補によって分かれます</h1>
    <p>入力された時刻の幅が日付をまたいでいるため、生まれた日の干が一つに決まりません。12か月の読みは、生まれた日の干が決まってから出します。</p></section>
  <section class="stack-s">${r.uniq.map((x, i) => `<section class="card stack-s"><h2 class="h2">候補${i + 1}：${x.move}</h2>${kind("read")}${threeLines(x, "", false)}</section>`).join("")}</section>
  <a class="btn" href="#/birth">時刻の幅を直す</a>
</div>`,
    };
  }
  const s = r.summary;
  const cur = currentMonth(r);
  const ps = periodState(r);
  const idx = r.months.indexOf(cur);
  const preview = r.months.slice(idx, idx + 3);
  return {
    bar: bar("result"), nav: "sum",
    html: `<div class="stack">
  <section class="cover stack-s ${fresh ? "reveal" : ""}" aria-labelledby="h">
    <img class="owl" src="assets/owl-96.png" alt="" width="56" height="56">
    <p class="eyebrow">${crescent} ${nick()}の命紋</p>
    <h1 class="display cover-title" id="h" tabindex="-1">${s ? s.move : "読みが二つ以上に分かれました"}</h1>
    <p class="note">${r.period.label}の読み・β版</p>
  </section>
  ${s ? `<section class="card stack-s">${kind("read")}${threeLines(s)}
    <details class="why"><summary>この読みの理由</summary><p>${r.reason}</p><p class="note">${R.LIMITED}</p></details></section>` : candidatesHtml(r)}
  ${s ? shareBlock(r) : ""}
  <div class="thread section">
    <section class="knot" aria-labelledby="k1"><h2 class="note" id="k1">今回の相談</h2><p class="quote">${esc(r.consult)}</p></section>
    <section class="knot answer" aria-labelledby="k2"><h2 class="note" id="k2">相談への回答</h2>
      <p class="answer-text">${r.headline}</p><p style="margin-top:8px">${r.answer}</p>
      <p class="note" style="margin-top:8px">選んだ相談は、回答の例と試すことにだけ使っています。本質の読みには使っていません。</p></section>
    <section class="knot step" aria-labelledby="k3"><h2 class="note" id="k3">${ps === "in" ? "今月の一歩" : "開始月の一歩"}（${monthName(cur, true)}）</h2>
      ${kind("hint")}<p>${cur.action}</p>
      <a class="btn secondary" href="#/r/now" style="margin-top:12px">今月の一歩を選ぶ</a></section>
  </div>
  <fieldset class="section"><legend>この結果は、今の自分に当てはまりますか（任意）</legend>
    <div class="choices inline">${Object.entries(R.FIT).map(([k, l]) => radio("feeling", k, l, S.feeling)).join("")}</div>
    <div id="offhelp" class="quiet stack-s" style="margin-top:12px" ${["no", "part"].includes(S.feeling) ? "" : "hidden"}>
      <p>回答はそのまま記録します。読みの本文は書き換えません。時刻がわかる場合は、入れ直すと読みが変わることがあります。</p>
      <div class="linkrow"><a class="textlink" href="#/birth">入力を直す</a><a class="textlink" href="#/r/essence">ほかの読みも見る</a></div>
    </div>
  </fieldset>
  <section class="section stack-s" aria-labelledby="yt"><h2 class="h2" id="yt">これから12か月</h2>
    <p class="note">通年の背景：${r.years.map((y) => `「${y.theme}」`).join("→")}</p>
    <ol class="cal">${calList(r, preview)}</ol>
    <a class="btn secondary" href="#/r/year">12か月すべて見る</a></section>
  <div class="linkrow noprint"><a class="textlink" href="#/r/essence">本質を詳しく読む</a><a class="textlink" href="#/birth">入力を直す</a><a class="textlink" href="#/r/settings">計算条件とPDF保存</a></div>
</div>`,
  };
}

// 一致の記録（当てはまる／一部だけ／当てはまらない／まだ分からない＋具体例）。本文は書き換えない
function fitForm(id, question) {
  const f = (S.fits || {})[id] || {};
  return `<form class="fit stack-s" data-form="fit" data-id="${id}" novalidate>
    ${question ? `<p class="note">確かめる問い：${question}</p>` : ""}
    <fieldset><legend class="visually-hidden">当てはまるか</legend><div class="choices inline">${Object.entries(R.FIT).map(([k, l]) => radio("fit", k, l, f.fit)).join("")}</div></fieldset>
    <label class="field"><span class="label">具体例（任意）</span><textarea class="textarea" name="example" maxlength="200" style="min-height:80px">${esc(f.example || "")}</textarea></label>
    <button class="btn secondary" type="submit">記録する</button></form>`;
}

function sEssence() {
  const stop = needReading(); if (stop) return stop;
  const r = S.reading, s = r.summary;
  const cur = currentMonth(r);
  const card = (x, cond) => x.id.startsWith("C")
    ? `<section class="card stack-s">${cond ? `<p class="eyebrow">条件付きの候補・組み合わせの読み</p>` : ""}<h3 class="h2" style="font-size:18px">${x.hypothesis}</h3>${kind("read")}<p>${x.detail}</p>
       <details class="why"><summary>読みの理由</summary><p>${x.stars.join("と")}が、年・月・時のうち別の位置にそれぞれあるときに使う、命紋の組み合わせの読みです。特別な才能を示すものではありません。</p></details>${cond ? "" : fitForm("E:" + x.id)}</section>`
    : `<section class="card stack-s">${cond ? `<p class="eyebrow">条件付きの候補・基本の読み</p>` : ""}<p class="note">得意な動き</p><h3 class="h2" style="font-size:18px;margin-top:0">${x.move}</h3>${kind("read")}
       ${threeLines(x, "", false)}<details class="why"><summary>読みの理由</summary><p>手がかりの星は${x.star}です。星があるだけで性格を決めるものではなく、仕事の条件に置き換えた仮説です。</p></details>${cond ? "" : fitForm("E:" + x.id, x.ask)}</section>`;
  return {
    bar: bar("result"), nav: "ess",
    html: `<div class="stack">
  <p class="eyebrow">${crescent} 本質</p><h1 class="h1" tabindex="-1">${nick()}の動き方</h1>
  ${s ? `<section class="card stack-s">${kind("read")}${threeLines(s, `<div><dt>今月試すこと</dt><dd>${cur.action}</dd></div>`)}</section>
  <details class="why"><summary>読みの理由を見る</summary><div class="stack-s">
    ${kind("read")}<p>${r.reason}</p>
    ${kind("told")}<p>相談：${esc(r.consult)}。相談の内容は本質の読みには使っていません。</p>
    ${kind("hint")}<p>「今月試すこと」は、今月の読み（${cur.theme}）からの提案です。</p>
    <p class="note">${R.LIMITED}</p></div></details>` : candidatesHtml(r)}
  ${r.combos.length ? `<h2 class="h2 section">組み合わせの読み</h2>${r.combos.map((x) => card(x)).join("")}` : ""}
  ${r.basics.length ? `<h2 class="h2 section">基本の読み</h2>
  <p class="note">手がかりにした星ごとの読みです。当てはまるかを記録しても、この結果の本文は書き換えません。</p>
  ${r.basics.map((x) => card(x)).join("")}` : ""}
  ${r.conditional.length ? `<h2 class="h2 section">時刻によっては当てはまる読み</h2><p class="note">入力された時刻の幅のうち、一部でだけ成り立つ読みです。共通の本質としては扱いません。</p>${r.conditional.map((x) => card(x, true)).join("")}` : ""}
</div>`,
  };
}

function calList(r, list = r.months) {
  return list.map((mm) => {
    const st = monthState(mm);
    const tag = st === "now" ? "今月" : st === "past" ? "過去" : "";
    return `<li class="${st}"><a class="cal-row" href="#/r/m/${mm.key}" ${st === "now" ? 'aria-current="date"' : ""}><span class="mon">${mm.m}月<small>${mm.y}年</small></span><span class="theme">${mm.theme}</span>${tag ? `<span class="tag">${tag}</span>` : "<span></span>"}<span class="act">${mm.action}<br><small>${mm.boundary.day}日ごろまでは「${mm.before.theme}」</small></span></a></li>`;
  }).join("");
}
function sYear() {
  const stop = needReading(); if (stop) return stop;
  const r = S.reading;
  return {
    bar: bar("result"), nav: "year",
    html: `<div class="stack">
  <p class="eyebrow">${crescent} ${r.period.label}</p>
  <h1 class="h1" tabindex="-1">12か月の読み</h1>
  <section class="quiet stack-s"><p><strong>通年の背景</strong></p><p>${yearsText(r)}</p></section>
  <p class="note">月の読みは、その期間を振り返るテーマです。暦の月は節入りの日で切り替わるため、各月の初めの数日は前の月の読みが続きます。色や点数で良し悪しは表しません。</p>
  <div class="linkrow"><button class="iconlink viewtoggle" type="button" data-act="grid" aria-pressed="${S.gridView}">${S.gridView ? "縦の一覧で見る" : "3列の見取り図で見る"}</button></div>
  <ol class="cal ${S.gridView ? "grid" : ""}">${calList(r)}</ol>
</div>`,
  };
}

function sMonth(key) {
  const stop = needReading(); if (stop) return stop;
  const r = S.reading;
  const i = r.months.findIndex((mm) => mm.key === key);
  if (i < 0) return redirect("#/r/year");
  const mm = r.months[i], prev = r.months[i - 1], next = r.months[i + 1];
  const f = R.FOCUS[r.focus];
  const ref = S.reflections[key] || {};
  const st = monthState(mm);
  const hm = `${mm.boundary.day}日${mm.boundary.hour}時ごろ`;
  return {
    bar: `<a class="iconlink" href="#/r/year">← 12か月へ</a><span class="spacer"></span><span class="context">${monthName(mm, true)}</span>`, nav: "year",
    html: `<div class="stack">
  <p class="eyebrow">${monthName(mm, true)}${st === "past" ? "（過去の月）" : st === "now" ? "（今月）" : ""}</p>
  <h1 class="h1" tabindex="-1">${mm.theme}</h1>
  ${st === "now" && i === 0 ? `<p class="note">今日（${today().d}日）より前の日は、過去として扱います。</p>` : ""}
  <table class="table"><caption class="visually-hidden">この月の区切り</caption><tbody>
    <tr><th scope="row">${mm.m}月1日〜${hm}</th><td>前の月の読み「${mm.before.theme}」</td></tr>
    <tr><th scope="row">${hm}〜${mm.m}月${mm.last}日</th><td><strong>「${mm.theme}」</strong></td></tr></tbody></table>
  <section class="stack-s">${kind("read")}<p class="prose">${R.MONTH_READ({ theme: mm.theme })}</p>${mm.same ? `<p class="note">${R.SAME_STAR_NOTE}</p>` : ""}
    <p class="note">通年の背景は「${mm.year.theme}」です。月の読みとは別のものとして並べています。</p></section>
  <section class="stack-s" aria-labelledby="link"><h2 class="h2" id="link" style="font-size:18px">相談との接点</h2>${kind("told")}<p>相談：${esc(r.consult)}</p><p class="prose">${f.link(mm.theme)}</p></section>
  <section class="card stack-s">${kind("hint")}<p style="font-weight:600">${mm.action}</p>
    <button class="btn" type="button" data-act="adopt" data-key="${key}">${ref.choice === "adopt" ? "この月の一歩にしました" : "この月の一歩にする"}</button></section>
  <details class="why"><summary>読みの理由</summary><p>この期間の月の干支は「${mm.pillar}」です。日干「${r.dayStem}」から見た月の干の星は${mm.star}で、命紋では「${mm.theme}」の群として読みます。出来事の予測ではなく、振り返りのテーマです。</p></details>
  <section class="section stack-s" aria-labelledby="fit"><h2 class="h2" id="fit" style="font-size:18px">この月の読みは当てはまりましたか</h2>${fitForm("M:" + key)}</section>
  <nav class="pager" aria-label="前後の月">${prev ? `<a href="#/r/m/${prev.key}">← ${monthName(prev)}</a>` : "<span></span>"}${next ? `<a href="#/r/m/${next.key}">${monthName(next)} →</a>` : "<span></span>"}</nav>
</div>`,
  };
}

function sNow() {
  const stop = needReading(); if (stop) return stop;
  const r = S.reading;
  const ps = periodState(r);
  if (ps !== "in") {
    return { bar: bar("result"), nav: "now", html: `<div class="stack"><h1 class="h1" tabindex="-1">${ps === "before" ? "まだ対象期間が始まっていません" : "対象期間は終わりました"}</h1>
      <p>今日の日付は、この結果の対象期間（${r.period.label}）の${ps === "before" ? "前" : "後"}です。もう一度診断すると、今月からの12か月を読めます。</p>
      <a class="btn" href="#/focus">もう一度診断する</a><a class="btn secondary" href="#/r/year">月を選ぶ</a></div>` };
  }
  const mm = r.months.find((x) => monthState(x) === "now");
  const ref = S.reflections[mm.key] || {};
  return {
    bar: bar("result"), nav: "now",
    html: `<form class="stack" data-form="reflect" data-key="${mm.key}" novalidate>
  <p class="eyebrow">${monthName(mm, true)}</p><h1 class="h1" tabindex="-1">今月の一歩</h1>
  <p>今月の読み：<strong>${mm.theme}</strong></p>
  <fieldset><legend>今月、試すこと</legend><div class="choices">
    ${radio("choice", "adopt", `提案を採用する：${mm.action}`, ref.choice)}${radio("choice", "custom", "自分の言葉に書き換える", ref.choice)}${radio("choice", "skip", "この月は選ばない", ref.choice)}</div></fieldset>
  <label class="field" for="custom" id="w-custom" ${ref.choice === "custom" ? "" : "hidden"}><span class="label">自分で決めた一歩</span><span class="why">書き換えた一歩は、占いの読みとしては表示しません。</span>
    <input class="input" id="custom" name="custom" maxlength="60" value="${esc(ref.custom || "")}"></label>
  <fieldset class="section"><legend>振り返り（任意）</legend>
    <p class="note" style="margin-bottom:8px">試してみて、どう感じましたか。まだ試していなくても大丈夫です。</p>
    <div class="choices inline">${radio("did", "done", "試した", ref.did)}${radio("did", "notyet", "まだ", ref.did)}${radio("did", "pass", "今回は見送った", ref.did)}</div></fieldset>
  <label class="field" for="memo"><span class="label">わかったことを一言（任意）</span><textarea class="textarea" id="memo" name="memo" maxlength="200" style="min-height:96px">${esc(ref.memo || "")}</textarea></label>
  <button class="btn" type="submit">振り返りを保存する</button>
  <p class="note">読みが当てはまったかは、<a href="#/r/m/${mm.key}">今月の読み</a>の下で記録できます。保存は、このタブを閉じるまでです。手元に残す場合はPDFで保存してください。</p>
</form>`,
  };
}

function sSettings() {
  const stop = needReading(true); if (stop) return stop;
  const r = S.reading, i = S.input;
  return {
    bar: bar("result"), nav: null,
    html: `<div class="stack">
  <h1 class="h1" tabindex="-1">計算条件と保存</h1>
  <section class="card stack-s" aria-labelledby="pdf"><h2 class="h2" id="pdf">PDFで保存</h2>
    <p>ブラウザーの印刷画面から「PDFに保存」を選んでください。</p>
    <label class="choice"><input type="checkbox" id="printbirth"><span class="mark" aria-hidden="true"></span><span>生年月日、出生地、生まれた時刻もPDFに入れる</span></label>
    <button class="btn secondary" type="button" data-act="print">PDFで保存する</button></section>
  <section class="stack-s" aria-labelledby="cond"><h2 class="h2" id="cond">計算条件</h2>
    <dl class="kv card">
      ${r.period ? `<div><dt>対象期間</dt><dd>${r.period.label}</dd><span></span></div>` : ""}
      <div class="birthonly"><dt>生年月日</dt><dd>${i ? `${i.y}年${i.m}月${i.d}日` : "消去済み"}</dd><a class="edit" href="#/birth">直す</a></div>
      <div class="birthonly"><dt>出生地</dt><dd>${i ? placeText(i) : "消去済み"}</dd><span></span></div>
      <div class="birthonly"><dt>時刻</dt><dd>${i ? timeText(i) : "消去済み"}</dd><span></span></div>
      <div class="birthonly"><dt>命式（年・月・日・時）</dt><dd>${r.candidates.map((k, n) => `${r.candidates.length > 1 ? `候補${n + 1}：` : ""}${k}`).join("<br>")}</dd><span></span></div>
      <div><dt>手がかりの星</dt><dd>${r.starLine}</dd><span></span></div>
      <div><dt>規約</dt><dd>年の境目＝立春、月の境目＝節入り、生まれた土地の標準時（真太陽時の補正なし）、日付の境目＝0時、23時台の時の干はその日の日干から数える</dd><span></span></div>
      <div><dt>読みの範囲</dt><dd>${R.LIMITED}</dd><span></span></div>
      ${r.basics ? `<div><dt>使った読み</dt><dd>${[...r.combos, ...r.basics].map((x) => x.id).join("・")}${r.conditional.length ? `（条件付き：${r.conditional.map((x) => x.id).join("・")}）` : ""}</dd><span></span></div>` : ""}
      <div><dt>版</dt><dd>${r.versions.calc}／${r.versions.rules}／${r.versions.app}</dd><span></span></div>
    </dl>
    <p class="note">節入りの時刻は計算値です。国立天文台の2026年の値と比べた差は最大14分で、境目の前後30分に生まれた場合は候補を並べます。</p></section>
  <section class="card stack-s" aria-labelledby="del"><h2 class="h2" id="del">入力と結果の削除</h2>
    <p>生年月日、結果、振り返りを、この端末のブラウザーから削除します。タブを閉じても消えます。</p>
    <div id="delconfirm" class="errsummary stack-s" hidden><p>削除すると元に戻せません。削除しますか。</p><button class="btn" type="button" data-act="delete">削除する</button><button class="btn secondary" type="button" data-act="delcancel">やめる</button></div>
    <button class="btn secondary" type="button" data-act="delask" id="delbtn">すべて削除する</button></section>
</div>`,
  };
}

// 設定画面ではなく、保存済みの鑑定と記録を印刷する。入力情報は明示的に選んだ場合だけ含める。
function printReadingHtml(state, withBirth) {
  const r = state.reading, input = state.input;
  const three = (s) => `<dl class="three"><div><dt>得意な動き</dt><dd>${esc(s.move)}</dd></div><div><dt>力が出やすい環境</dt><dd>${esc(s.env)}</dd></div><div><dt>負担になりやすい条件</dt><dd>${esc(s.burden)}</dd></div></dl>`;
  const item = (x) => `<section class="print-block"><h3>${esc(x.id)}：${esc(x.move)}</h3>${three(x)}${x.detail ? `<p>${esc(x.detail)}</p>` : ""}</section>`;
  const sections = (title, xs) => xs?.length ? `<section><h2>${title}</h2>${xs.map(item).join("")}</section>` : "";
  const fitLabel = (id) => {
    if (id.startsWith("M:")) return `${id.slice(2)}の読み`;
    const rule = typeOf(id.replace(/^E:/, ""));
    return rule ? `${rule.id}：${rule.move}` : id;
  };
  const fitRows = Object.entries(state.fits || {}).map(([id, f]) => `<section class="print-block"><h3>${esc(fitLabel(id))}</h3><p>${esc(R.FIT[f.fit] || "未回答")}</p>${f.example ? `<p class="print-note">具体例：${esc(f.example)}</p>` : ""}</section>`).join("");
  const reflections = Object.entries(state.reflections || {}).map(([key, ref]) => {
    const month = r.months?.find((m) => m.key === key);
    const choice = ref.choice === "adopt" ? `提案を採用：${month?.action || ""}` : ref.choice === "custom" ? `自分で決めた一歩：${ref.custom || ""}` : ref.choice === "skip" ? "この月は選ばない" : "一歩は未選択";
    const did = { done: "試した", notyet: "まだ", pass: "今回は見送った" }[ref.did];
    return `<section class="print-block"><h3>${esc(key)}</h3><p class="print-note">${esc(choice)}</p>${did ? `<p>振り返り：${esc(did)}</p>` : ""}${ref.memo ? `<p class="print-note">わかったこと：${esc(ref.memo)}</p>` : ""}</section>`;
  }).join("");
  const months = (r.months || []).map((m) => `<section class="print-block"><h3>${esc(m.y)}年${esc(m.m)}月：${esc(m.theme)}</h3>
    <p>1日〜${esc(m.boundary.day)}日${esc(m.boundary.hour)}時ごろ：「${esc(m.before.theme)}」<br>${esc(m.boundary.day)}日${esc(m.boundary.hour)}時ごろ〜${esc(m.last)}日：「${esc(m.theme)}」（日本時間）</p>
    <p>試すヒント：${esc(m.action)}</p><p>通年の背景：${esc(m.year.theme)}</p></section>`).join("");
  const birth = withBirth && input ? `<section class="print-block"><h2>入力情報</h2>
    ${input.nick ? `<p>呼び名：${esc(input.nick)}</p>` : ""}<p>生年月日：${esc(input.y)}年${esc(input.m)}月${esc(input.d)}日<br>出生地：${placeText(input)}<br>時刻：${esc(timeText(input))}</p>
    <p>命式（年・月・日・時）：${(r.candidates || []).map(esc).join("／")}</p></section>` : "";
  return `<h1>命紋診断・鑑定結果</h1><p>${esc(r.period?.label || "生まれた日が分かれるため、12か月の読みは保留")}</p>
    <p class="print-note">${esc(R.DISCLAIMER)}</p>
    <section><h2>本質のまとめ</h2>${r.summary ? three(r.summary) : `<p>出生情報の幅によって読みが分かれています。</p>${(r.uniq || []).map((s, i) => `<section class="print-block"><h3>候補${i + 1}</h3>${three(s)}</section>`).join("")}`}</section>
    <section class="print-block"><h2>今回の相談</h2><p>${esc(r.consult)}</p>${r.headline ? `<h3>${esc(r.headline)}</h3><p>${esc(r.answer)}</p>` : ""}<p>相談内容は、本質の計算には使っていません。</p></section>
    ${sections("組み合わせの読み", r.combos)}${sections("基本の読み", r.basics)}${sections("条件付きの候補", r.conditional)}
    ${months ? `<section><h2>12か月の読み</h2><p>月の読みは振り返りのテーマです。出来事の予測ではありません。</p>${months}</section>` : ""}
    <section><h2>一致の記録</h2><p>結果全体：${esc(R.FIT[state.feeling] || "未回答")}</p>${fitRows || "<p>個別の記録はありません。</p>"}</section>
    <section><h2>一歩と振り返りの記録</h2>${reflections || "<p>記録はありません。</p>"}</section>
    ${birth}<section class="print-block"><h2>計算と読みの条件</h2><p>${esc(R.LIMITED)}</p><p>年の境目は立春、月の境目は節入り、日付の境目は現地0時です。真太陽時の補正はしません。</p>
    <p>版：${esc(r.versions.calc)}／${esc(r.versions.rules)}／${esc(r.versions.app)}</p></section>`;
}

function clearPrintReading() {
  document.getElementById("print-reading")?.remove();
  document.body.classList.remove("printing-reading");
}
window.addEventListener("afterprint", clearPrintReading);

function sHow() {
  return {
    bar: bar("plain", { label: "この診断について" }),
    html: `<div class="stack prose">
  <h1 class="h1" tabindex="-1">命紋診断について</h1>
  <p>命紋診断は、四柱推命の一部を使う占いです。生まれた日の干と、年・月・時の干の関係を手がかりに、得意な動き、力が出やすい環境、負担になりやすい条件と、これから12か月のテーマを読みます。</p>
  <p class="quiet">${R.DISCLAIMER}</p>
  <section class="stack-s"><h2 class="h2">三つの種類を分けて書きます</h2>
    <p>${kind("read")}　生まれた日時から計算した干支を、命紋の規則に沿って読んだものです。</p>
    <p>${kind("told")}　相談として、あなたが選んだ内容です。占いで当てたものではありません。</p>
    <p>${kind("hint")}　読みと相談をもとにした、小さな行動の提案です。出来事の予測ではありません。</p></section>
  <section class="stack-s"><h2 class="h2">約束しないこと</h2><p>転職の成功、収入の増加、出来事の的中は約束しません。わからない項目は、悪い運勢ではなく入力不足として説明します。</p><p class="note">${R.LIMITED}</p></section>
  <section class="stack-s" id="data"><h2 class="h2">入力情報の扱い</h2>
    <p>生年月日などの入力は、このページの中（あなたの端末のブラウザー）だけで計算します。どこにも送らず、このタブを閉じると消えます。</p>
    <p>結果をシェアするときも、送られるのは命紋の読みと、この診断へのリンクだけです。生年月日や呼び名は含みません。</p>
    <p class="note">文字の表示のために、Google Fonts から書体を読み込みます。アクセス解析のための計測は入れていません。</p></section>
  <section class="stack-s"><h2 class="h2">対象</h2><p>仕事の相談を想定して、18歳以上の方を対象にしています。</p></section>
  <a class="btn" href="#/focus">診断する</a>
</div>`,
  };
}

// シェアされた読みの紹介ページ（個人の結果ではなく、読みの一つとして見せる）
function sType(id) {
  const x = typeOf(id);
  if (!x) return redirect("#/");
  return {
    bar: bar("plain", { label: "シェアされた命紋" }),
    html: `<div class="stack">
  <section class="cover stack-s" aria-labelledby="h">
    <img class="owl" src="assets/owl-96.png" alt="" width="56" height="56">
    <p class="eyebrow">${crescent} シェアされた命紋</p>
    <h1 class="display cover-title" id="h" tabindex="-1">${x.move}</h1>
  </section>
  <section class="card stack-s">${kind("read")}${x.detail ? `<p>${x.detail}</p>` : ""}${threeLines(x, "", false)}</section>
  <p>これは命紋診断の読みの一つです。生年月日から、あなたの命紋と、これから12か月の読みを無料で出せます。</p>
  <a class="btn" href="#/focus">自分の命紋を診断する</a>
  <p class="note">${R.DISCLAIMER}</p>
</div>`,
  };
}

// ── 結果の画像（1080×1350）。シェア用なので生年月日と呼び名は描かない ──
const loadImg = (src) => new Promise((ok, ng) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ng; im.src = src; });
function wrapText(ctx, text, max) {
  const lines = [];
  let line = "";
  for (const ch of text) {
    if (line && ctx.measureText(line + ch).width > max) { lines.push(line); line = ch; } else line += ch;
  }
  if (line) lines.push(line);
  for (let i = 1; i < lines.length; i++) {
    while (/^[、。」』）]/.test(lines[i])) { lines[i - 1] += lines[i][0]; lines[i] = lines[i].slice(1); }
  }
  return lines.filter(Boolean);
}
async function makeCard(r) {
  const W = 1080, H = 1350, s = r.summary;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1a2a66"); bg.addColorStop(0.45, "#0b1530"); bg.addColorStop(1, "#060c22");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = (x, y, rad, color) => { const g = ctx.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
  glow(W * 0.18, H * 0.14, 560, "rgba(107,91,214,.45)"); glow(W * 0.92, H * 0.45, 480, "rgba(47,111,208,.30)"); glow(W * 0.5, H * 1.02, 620, "rgba(232,112,94,.16)");
  let seed = 20260924;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 280; i++) {
    const a = 0.25 + rnd() * 0.7;
    ctx.fillStyle = rnd() < 0.15 ? `rgba(240,217,155,${a})` : `rgba(226,232,255,${a})`;
    ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, rnd() ** 3 * 2.4 + 0.5, 0, Math.PI * 2); ctx.fill();
  }
  const serif = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif', sans = '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif';
  const all = `命紋診断私の命紋は「」${s.move}${s.env}${s.burden}力が出やすい環境負担になりやすい条件#生年月日から、あなたの動き方を読む占い${location.host}`;
  try { await Promise.all([document.fonts.load(`600 72px "Noto Serif JP"`, all), document.fonts.load(`600 36px "Noto Sans JP"`, all), document.fonts.load(`400 26px "Noto Sans JP"`, all)]); } catch { /* 端末の書体で描く */ }
  const cx = 160, cy = 180;
  glow(cx, cy, 190, "rgba(240,217,155,.35)");
  try {
    const owl = await loadImg("assets/owl-256.png");
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 74, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(owl, cx - 74, cy - 74, 148, 148); ctx.restore();
  } catch { /* フクロウなしで描く */ }
  ctx.strokeStyle = "rgba(240,217,155,.55)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 94, 0, Math.PI * 2); ctx.stroke();
  ctx.textBaseline = "top";
  ctx.fillStyle = "#d9b56a"; ctx.font = `600 34px ${sans}`; ctx.fillText("命紋診断", 300, 138);
  ctx.fillStyle = "#aab4cd"; ctx.font = `400 30px ${sans}`; ctx.fillText("私の命紋は", 300, 192);
  let y = 340;
  ctx.fillStyle = "#f0d99b"; ctx.font = `600 74px ${serif}`;
  ctx.shadowColor = "rgba(217,181,106,.45)"; ctx.shadowBlur = 24;
  for (const line of wrapText(ctx, `「${s.move}」`, W - 170)) { ctx.fillText(line, 80, y); y += 106; }
  ctx.shadowBlur = 0;
  y += 36;
  for (const [label, text] of [["力が出やすい環境", s.env], ["負担になりやすい条件", s.burden]]) {
    const top = y;
    ctx.fillStyle = "#d9b56a"; ctx.font = `600 28px ${sans}`; ctx.fillText(label, 108, y); y += 50;
    ctx.fillStyle = "#ede8dc"; ctx.font = `600 38px ${sans}`;
    for (const line of wrapText(ctx, text, W - 200)) { ctx.fillText(line, 108, y); y += 58; }
    ctx.fillStyle = "rgba(217,181,106,.55)"; ctx.fillRect(80, top + 4, 3, y - top - 14);
    y += 40;
  }
  ctx.fillStyle = "rgba(217,181,106,.35)"; ctx.fillRect(80, H - 190, W - 160, 1);
  ctx.fillStyle = "#ede8dc"; ctx.font = `600 36px ${serif}`; ctx.fillText("#命紋診断", 80, H - 160);
  ctx.fillStyle = "#aab4cd"; ctx.font = `400 26px ${sans}`;
  ctx.fillText("生年月日から、あなたの動き方を読む占い", 80, H - 104);
  ctx.fillText(location.host + location.pathname.replace(/index\.html$/, ""), 80, H - 64);
  return cv;
}
async function shareCard() {
  const r = S.reading; if (!r?.summary) return;
  toast("画像を作っています");
  try {
    const cv = await makeCard(r);
    const blob = await new Promise((ok) => cv.toBlob(ok, "image/png"));
    const file = new File([blob], "meimon.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: `${shareText(r)}\n${shareUrl(r)}` }); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "meimon.png";
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("画像を保存しました");
  } catch (e) { if (e?.name !== "AbortError") toast("画像を作れませんでした。もう一度お試しください"); }
}

// ── ルーター ──
function redirect(hash) { queueMicrotask(() => { location.replace(hash); }); return { bar: "", html: "" }; }
const ROUTES = { "": sHome, sample: sSample, focus: sFocus, birth: sBirth, r: sResult, "r/essence": sEssence, "r/year": sYear, "r/now": sNow, "r/settings": sSettings, how: sHow };
const TITLES = { sample: "結果の見本", focus: "質問 1", birth: "質問 2", r: "診断結果", "r/essence": "本質", "r/year": "12か月", "r/now": "今月の一歩", "r/settings": "計算条件と保存", how: "この診断について" };

function render() {
  clearPrintReading();
  const path = location.hash.replace(/^#\/?/, "").split("?")[0];
  const mo = path.match(/^r\/m\/(\d{4}-\d{2})$/), ty = path.match(/^t\/([CT]\d{2})$/);
  const view = mo ? sMonth(mo[1]) : ty ? sType(ty[1]) : (ROUTES[path] || sHome)();
  topbar.innerHTML = view.bar;
  main.innerHTML = view.html;
  const showNav = "nav" in view && S.reading && S.reading.split !== "day";
  document.body.classList.toggle("has-resultnav", Boolean(showNav));
  resultnav.innerHTML = showNav ? [["sum", "#/r", "結果"], ["ess", "#/r/essence", "本質"], ["year", "#/r/year", "12か月"], ["now", "#/r/now", "今月"]]
    .map(([k, h, l]) => `<a href="${h}" ${view.nav === k ? 'aria-current="page"' : ""}>${l}</a>`).join("") : "";
  const title = mo ? "月の詳細" : ty ? "シェアされた命紋" : TITLES[path];
  document.title = title ? `${title}｜命紋診断` : "命紋診断";
  window.scrollTo(0, 0);
  const h = main.querySelector("[tabindex='-1']");
  if (h && render.count++) h.focus({ preventScroll: true });
  bindDynamic();
}
render.count = 0;

// ── 画面内の表示切替 ──
function bindDynamic() {
  const on = (sel, ev, fn) => main.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn));
  on("#country", "change", (e) => { main.querySelector("#w-offset").hidden = e.target.value !== "other"; });
  on("input[name=timeMode]", "change", (e) => {
    main.querySelector("#w-exact").hidden = e.target.value !== "exact";
    main.querySelector("#w-range").hidden = e.target.value !== "range";
  });
  on("#bcal", "change", (e) => {
    const [y, mo, d] = e.target.value.split("-");
    if (y) { main.querySelector("#by").value = Number(y); main.querySelector("#bm").value = Number(mo); main.querySelector("#bd").value = Number(d); }
  });
  on("form[data-form=birth]", "input", (e) => { S.draft = readBirth(e.currentTarget); save(); });
  on("input[name=feeling]", "change", (e) => { S.feeling = e.target.value; save(); main.querySelector("#offhelp").hidden = !["no", "part"].includes(S.feeling); toast("回答を記録しました"); });
  on("input[name=choice]", "change", (e) => { main.querySelector("#w-custom").hidden = e.target.value !== "custom"; });
}

function showErrors(errs) {
  main.querySelectorAll(".error").forEach((el) => { el.hidden = true; });
  main.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
  const sum = main.querySelector("#errsum");
  if (!errs.length) { if (sum) sum.hidden = true; return; }
  for (const [k, msg, target] of errs) {
    const el = main.querySelector(`#e-${k}`);
    if (el) { el.textContent = msg; el.hidden = false; }
    const t = main.querySelector(`#${target}`);
    if (t && t.matches("input,select,textarea")) { t.setAttribute("aria-invalid", "true"); if (el) t.setAttribute("aria-describedby", el.id); }
    if (k === "offset") main.querySelector("details.why")?.setAttribute("open", "");
  }
  if (sum) {
    sum.innerHTML = `<p><strong>${errs.length}件、確認が必要な項目があります</strong></p><ul>${errs.map(([, msg, t]) => `<li><a href="#${t}" data-jump="${t}">${esc(msg)}</a></li>`).join("")}</ul>`;
    sum.hidden = false; sum.focus();
  }
}

// ── 送信 ──
document.addEventListener("submit", (e) => {
  const form = e.target.closest("form[data-form]");
  if (!form) return;
  e.preventDefault();
  const kindOf = form.dataset.form;
  if (kindOf === "focus") {
    const v = new FormData(form).get("focus");
    if (!v) { main.querySelector("#e-focus").hidden = false; main.querySelector("#f-focus input")?.focus(); return; }
    S.focus = v; save(); location.hash = "#/birth";
  }
  if (kindOf === "birth") {
    const d = readBirth(form);
    const errs = validateBirth(d);
    if (errs.some((x) => x[3])) { // 対象外：生年月日を保持しない
      S.draft = { ...d, by: "", bm: "", bd: "" }; S.input = null; save();
      ["by", "bm", "bd"].forEach((id) => { main.querySelector(`#${id}`).value = ""; });
      showErrors(errs);
      main.querySelector("#e-date").insertAdjacentHTML("beforeend", ` <a href="#/sample">結果の見本を見る</a>`);
      return;
    }
    if (errs.length) { S.draft = d; save(); showErrors(errs); return; }
    S.draft = d;
    S.input = { nick: (d.nick || "").trim(), y: Number(d.by), m: Number(d.bm), d: Number(d.bd), country: d.country || "JP", offset: d.country === "other" ? Number(d.offset) : null,
      city: (d.city || "").trim(), timeMode: d.timeMode, time: d.time, from: d.from, to: d.to, toNextDay: d.toNextDay };
    const status = main.querySelector("#calcstatus");
    status.textContent = "生まれた日の干支を計算しています";
    try { buildReading(); }
    catch { status.textContent = "計算できませんでした。入力を確かめて、もう一度お試しください。入力は残っています。"; return; }
    S.fresh = true; save(); location.hash = "#/r";
  }
  if (kindOf === "fit") {
    const f = new FormData(form);
    if (!f.get("fit")) { toast("当てはまるかを一つ選んでください"); return; }
    S.fits = { ...(S.fits || {}), [form.dataset.id]: { fit: f.get("fit"), example: String(f.get("example") || "").trim(), at: new Date().toISOString() } };
    save(); toast("記録しました。結果の本文は変わりません");
  }
  if (kindOf === "reflect") {
    const f = new FormData(form);
    S.reflections[form.dataset.key] = { choice: f.get("choice"), custom: String(f.get("custom") || ""), did: f.get("did"), memo: String(f.get("memo") || "") };
    save(); toast("振り返りを保存しました");
  }
});

// ── 押す操作 ──
document.addEventListener("click", async (e) => {
  if (e.target.closest(".skip")) { e.preventDefault(); main.focus(); return; }
  const jump = e.target.closest("[data-jump]");
  if (jump) { e.preventDefault(); const t = main.querySelector(`#${jump.dataset.jump}`); (t?.matches("fieldset") ? t.querySelector("input") : t)?.focus(); return; }
  const a = e.target.closest("[data-act]");
  if (!a) return;
  const act = a.dataset.act;
  if (act === "back") { if (history.length > 1) history.back(); else location.hash = "#/"; }
  if (act === "grid") { S.gridView = !S.gridView; save(); render(); }
  if (act === "adopt") { const k = a.dataset.key; S.reflections[k] = { ...(S.reflections[k] || {}), choice: "adopt" }; save(); a.textContent = "この月の一歩にしました"; toast("一歩として記録しました"); }
  if (act === "card") shareCard();
  if (act === "share") {
    try { await navigator.share({ title: "命紋診断", text: shareText(S.reading), url: shareUrl(S.reading) }); }
    catch (err) { if (err?.name !== "AbortError") toast("シェアできませんでした"); }
  }
  if (act === "copy") {
    try { await navigator.clipboard.writeText(`${shareText(S.reading)}\n${shareUrl(S.reading)}`); toast("シェア用の文とリンクをコピーしました"); }
    catch { toast("コピーできませんでした"); }
  }
  if (act === "print") {
    if (!S.reading) return;
    const withBirth = Boolean(main.querySelector("#printbirth")?.checked);
    clearPrintReading();
    const article = document.createElement("article");
    article.id = "print-reading"; article.className = "print-reading";
    article.innerHTML = printReadingHtml(S, withBirth);
    document.body.append(article);
    document.body.classList.add("printing-reading");
    try { window.print(); }
    catch { clearPrintReading(); toast("印刷画面を開けませんでした"); }
  }
  if (act === "delask") { main.querySelector("#delconfirm").hidden = false; a.hidden = true; main.querySelector("#delconfirm button").focus(); }
  if (act === "delcancel") { main.querySelector("#delconfirm").hidden = true; const b = main.querySelector("#delbtn"); b.hidden = false; b.focus(); }
  if (act === "delete") { S = blank(); chartCache = null; try { sessionStorage.removeItem("meimon"); } catch { /* なし */ } location.hash = "#/"; toast("削除しました"); }
});

// ── 夜空：決めた乱数で星を置く（毎回同じ空）。瞬く星は少数だけCSSで動かす ──
function drawSky() {
  const cv = document.getElementById("sky");
  if (!cv?.getContext) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2), w = innerWidth, h = innerHeight;
  cv.width = w * dpr; cv.height = h * dpr;
  const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
  let seed = 20260924;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const n = Math.round((w * h) / 2600);
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h, r = rnd() ** 3 * 1.4 + 0.25, a = 0.25 + rnd() * 0.65;
    ctx.fillStyle = rnd() < 0.12 ? `rgba(240,217,155,${a})` : `rgba(226,232,255,${a})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = "rgba(217,181,106,.22)"; ctx.lineWidth = 1; ctx.beginPath();
  [[0.72, 0.10], [0.80, 0.16], [0.86, 0.12], [0.92, 0.21], [0.88, 0.29]].forEach(([px, py], i) => (i ? ctx.lineTo(px * w, py * h) : ctx.moveTo(px * w, py * h)));
  ctx.stroke();
  const tw = document.getElementById("twinkles");
  if (tw && !tw.childElementCount) {
    tw.innerHTML = Array.from({ length: 14 }, () => `<span class="twinkle" style="left:${(rnd() * 100).toFixed(1)}%;top:${(rnd() * 100).toFixed(1)}%;animation-delay:${(rnd() * 5).toFixed(2)}s;animation-duration:${(4 + rnd() * 4).toFixed(2)}s"></span>`).join("");
  }
}
let skyTimer;
window.addEventListener("resize", () => { clearTimeout(skyTimer); skyTimer = setTimeout(drawSky, 200); });
drawSky();

window.addEventListener("hashchange", render);
render();
