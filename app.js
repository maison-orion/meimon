// ハリーの命紋診断。生年月日から「性格の特徴・あなたに合う環境・苦手になりやすいこと」と、これから3か月のアドバイスを出す。
// 実行時にAIは呼ばない。暦は engine.js、読みの選び方は method.js、文言は rules.js の表から選ぶだけ。
// 入力は端末の外へ送らない（ブラウザーに保存。設定から削除できる）。シェアには生年月日や呼び名を入れない。
import * as E from "./engine.js?v=1.5.0";
import * as R from "./rules.js?v=1.5.0";
import * as M from "./method.js?v=1.5.0";
import { refreshReadingCopy, monthAdvice } from "./presentation.js?v=1.5.0";

import { essenceFor } from "./essence.js?v=1.5.0";
import { buildLifeFlow, renderLifeFlow, renderLifeYear } from "./life-flow.js?v=1.5.0";
import { lineUrl } from "./service.js?v=1.5.0";

import { loadState, saveState, clearState, STORAGE_KEY } from "./storage.js?v=1.5.0";

const APP_VERSION = "app-1.5";

// ── 同じブラウザーに出生情報と診断結果を保存する ──
const blank = () => ({ focus: null, draft: {}, input: null, reading: null, readings: {}, gridView: false, fresh: false });
const birthKey = (i) => i ? JSON.stringify([i.y, i.m, i.d, i.country, i.country === "other" ? i.offset : null,
  i.timeMode, i.timeMode === "exact" ? i.time : null, i.timeMode === "range" ? [i.from, i.to, Boolean(i.toNextDay)] : null]) : null;
const birthDraft = (i) => i ? { ...i, by: String(i.y), bm: String(i.m), bd: String(i.d), offset: i.offset ?? "" } : {};
function load() {
  const saved = loadState();
  if (!saved) return blank();
  const state = { ...blank(), ...saved, draft: birthDraft(saved.input) };
  state.readings = Object.fromEntries(Object.entries(state.readings).map(([key, value]) => [key, refreshReadingCopy(value)]));
  state.reading = refreshReadingCopy(state.reading);
  if (state.reading) state.readings[state.reading.focus] = state.reading;
  return state;
}
let S = load();
let persistent = true;
function save() {
  const result = saveState(S);
  if (result.conflict) {
    S = load(); chartCache = null; persistent = true;
    queueMicrotask(() => { render(); toast("別のタブで保存情報が変更されました。最新の状態を表示します。"); });
    return false;
  }
  persistent = result.persistent;
  return true;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const nick = () => esc(S.input?.nick || "あなた");
const main = document.getElementById("main");
const topbar = document.getElementById("topbar");
const resultnav = document.getElementById("resultnav");
const ymKey = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
const today = () => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }; };
const crescent = `<svg class="crescent" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 3.2A9 9 0 1 0 20.8 16 7.5 7.5 0 0 1 15.5 3.2Z"/></svg>`;
const kind = (k) => ({ read: `<span class="kind read">占いの結果</span>`, told: `<span class="kind told">選んだ悩み</span>`, hint: `<span class="kind hint">アドバイス</span>` })[k];
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
  const brand = `<a class="brand" href="#/"><img src="assets/harry.png" alt="" width="34" height="34"><span>ハリー<small>命紋診断</small></span></a>`;
  if (kindOf === "home") return `${brand}<span class="spacer"></span><a class="iconlink" href="#/how">この診断について</a>`;
  if (kindOf === "flow") return `<button class="iconlink" type="button" data-act="back">← 戻る</button><span class="spacer"></span><span class="context">${esc(opts.label || "")}</span>`;
  if (kindOf === "result") return `${brand}<span class="spacer"></span><a class="iconlink" href="#/r/settings">設定</a>`;
  return `${brand}<span class="spacer"></span><span class="context">${esc(opts.label || "")}</span>`;
}

// ═════════ 入口 ═════════
function sHome() {
  return {
    bar: bar("home"),
    html: `<div class="hero-wrap">
  <section class="hero" aria-labelledby="h">
    <div class="halo"><img class="harry" src="assets/harry.png" alt="月を背に帽子に手を添える案内役、ハリー" width="220" height="220"></div>
    <p class="eyebrow" style="margin-top:16px">ハリーの命紋診断</p>
    <h1 class="display" id="h" tabindex="-1">自分のことを、<br>少し深く知る。</h1>
    <p class="lead" style="margin-top:12px">人には見せない気持ち。つい繰り返す行動。あなたらしさと人生の流れを、生まれた日時から読み解きます。</p>
    <p class="concern-intro">本質と性格 ／ 18歳からの流れ ／ これから3か月</p>
    <ul class="promise" aria-label="この診断の特徴"><li>無料</li><li>登録なし</li><li>質問は2つ</li><li>入力は端末の中だけで計算</li></ul>
    <div class="actions" style="margin-top:28px">
      <a class="btn" href="#/focus">${S.input ? "保存した生年月日で診断する" : "無料で診断する"}</a>
      ${S.reading ? `<a class="btn secondary" href="#/r">保存した結果を見る</a>` : ""}
      <a class="textlink" href="#/sample">結果の見本を見る →</a>
    </div>
  </section>
  <aside class="mini-sample card" aria-label="診断で読めること">
    <p class="eyebrow">この鑑定でわかること</p>
    <ol class="reading-chapters">
      <li><span>01</span><div><h2>本質と性格</h2><p>表に出る自分と、心の内側。人との関わり方や、力を発揮しやすい場面。</p></div></li>
      <li><span>02</span><div><h2>18歳から、今まで</h2><p>年ごとのテーマを図でたどり、自分の歩みと照らし合わせる。</p></div></li>
      <li><span>03</span><div><h2>これから3か月</h2><p>仕事、恋愛、人間関係、お金。気になる悩みに合わせた過ごし方。</p></div></li>
    </ol>
    <p class="guide-sign">あなたを知る時間をご一緒に。<br><span>案内役 ハリー</span></p>
  </aside>
</div>`,
  };
}

// ═════════ 結果の見本 ═════════
const SAMPLE_GROUPS = ["make", "deal", "learn"];
function sSample() {
  const c02 = R.COMBOS.find((c) => c.id === "C03");
  const months = SAMPLE_GROUPS.map((k, i) => ({ m: ((9 + i) % 12) + 1, y: 2026 + Math.floor((9 + i) / 12), g: R.focusGroup(R.GROUPS[k].stars[0], "self") }));
  return {
    bar: bar("plain", { label: "結果の見本" }),
    html: `<p class="sample-flag">診断結果の一例です。あなたの結果は、生まれた日時に合わせて表示します。</p>
<div class="stack" style="margin-top:20px">
  <section class="cover stack-s" aria-labelledby="h">
    <p class="eyebrow">${crescent} あおいさんの命紋（見本）</p>
    <h1 class="display cover-title" id="h" tabindex="-1">${c02.move}</h1>
    <p>${c02.hypothesis}</p>${essenceHtml(c02)}
  </section>
  <section class="card stack-s">${kind("read")}${threeLines(c02)}</section>
  <div class="thread">
    <div class="knot"><p class="note">今回の相談</p><p class="quote">${R.FOCUS.self.label}</p></div>
    <div class="knot answer"><p class="note">相談への回答</p><p class="answer-text">${R.FOCUS.self.headline}</p><p style="margin-top:8px">${R.FOCUS.self.answer(c02, R.focusGroup("正官", "self").theme)}</p></div>
    <div class="knot step"><p class="note">今月の結果（見本）</p><p>${R.focusGroup("食神", "self").action}</p></div>
  </div>
  <section class="section stack-s" aria-labelledby="s-year"><h2 class="h2" id="s-year">これから3か月（見本）</h2>
    <p class="note">3か月の読みを並べた表示例です。あなたの結果は、生まれた日時に合わせて計算します。</p>
    <ol class="cal">${months.map(({ m, y, g }) => `<li><div class="cal-row"><span class="mon">${m}月<small>${y}年</small></span><span class="theme">${g.theme}</span><span></span><span class="act">${g.action}</span></div></li>`).join("")}</ol>
  </section>
  <div class="actions section"><a class="btn" href="#/focus">自分の命紋を診断する</a></div>
</div>`,
  };
}

// ═════════ 質問1：相談テーマ ═════════
function sFocus() {
  const categories = ["仕事", "恋愛・パートナー", "家族・人間関係", "お金・暮らし", "自分自身"];
  return {
    bar: bar("flow", { label: S.input ? "診断を選ぶ" : "質問 1 / 2" }),
    html: `<form class="stack form-narrow" data-form="focus" novalidate>
  <h1 class="h1" tabindex="-1">いま、気になっていることは？</h1>
  <p>本質とこれまでの流れは、どれを選んでも読めます。気になるテーマを選ぶと、その悩みについての読みもお伝えします。</p>
  ${S.input ? `<p class="quiet">保存した生年月日：${S.input.y}年${S.input.m}月${S.input.d}日<br><a href="#/birth">生年月日を変更する</a></p>` : ""}
  <div class="concern-groups" id="f-focus">${categories.map((category) => `<fieldset class="concern-group"><legend>${esc(category)}</legend><div class="choices">${Object.entries(R.FOCUS).filter(([, f]) => f.category === category).map(([k, f]) => radio("focus", k, f.label, S.focus)).join("")}</div></fieldset>`).join("")}</div>
  <p class="error" id="e-focus" hidden>考えたいことに近いものを一つ選んでください。</p>
  <button class="btn" type="submit">${S.input ? "診断結果を見る" : "次へ"}</button>
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
    bar: bar("flow", { label: S.input ? "生年月日の変更" : "質問 2 / 2" }),
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
  <p class="note">生年月日と結果はこのブラウザーに保存します。次回は入力し直さずに使えます。設定から削除できます。<a href="#/how">入力情報の扱い</a></p>
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
    if (age < 18) errs.push(["date", "ハリーの命紋診断は、18歳以上の方を対象にしています。入力した生年月日は保存していません。結果の見本は見られます。", "by", true]);
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
    ? `${s.stars.join("と")}が別の位置にそろうため、命紋の特徴の組み合わせを使っています。`
    : `月の干の星（${s.stars[0]}）を第一の手がかりとして使っています。`;
  return `東洋の暦を参考にした、命紋独自の規則で読んでいます。生まれた日の干（日干「${E.STEMS[c.candidates[0].day.stem]}」）を自分側とし、${starLine(c)}です。${how}${c.candidates.length > 1 ? "時刻の候補によって変わる読みは、条件付きの候補として分けています。" : ""}`;
}
function threeLines(s, extra = "", withMove = true) {
  return `<dl class="three">
    ${withMove ? `<div><dt>性格の特徴</dt><dd>${s.move}</dd></div>` : ""}
    <div><dt>あなたに合う環境</dt><dd>${s.env}</dd></div>
    <div><dt>苦手になりやすいこと</dt><dd>${s.burden}</dd></div>${extra}
  </dl>`;
}
function candidatesHtml(r) {
  return `<section class="stack-s"><p class="quiet">生まれた時刻の幅の中で、手がかりにする星が変わります。どちらか一つに決めず、候補を並べます。時刻の幅を狭められる場合は、<a href="#/birth">入力を直す</a>と一つに絞れることがあります。</p>
    ${r.uniq.map((x, i) => `<section class="card stack-s"><h2 class="h2">候補${i + 1}：${x.move}</h2>${kind("read")}${threeLines(x, "", false)}${essenceHtml(x)}</section>`).join("")}</section>`;
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
  if (dayStems(c).length > 1) { S.reading = { ...base, split: "day" }; return; }
  const ds = c.candidates[0].day.stem;
  const natal = new Set(c.candidates.flatMap((k) => Object.values(E.starsOf(k)).filter(Boolean)));
  const period = periodFrom(today());
  const months = E.yearPlan(period.start.y, period.start.m, ds).map((x) => {
    const star = E.TEN_GODS[x.after.god], bstar = E.TEN_GODS[x.before.god], ystar = E.TEN_GODS[x.after.yearGod];
    const g = R.focusGroup(star, focus), bg = R.focusGroup(bstar, focus), yg = R.focusGroup(ystar, focus);
    return { key: ymKey(x.y, x.m), y: x.y, m: x.m, last: new Date(x.y, x.m, 0).getDate(), boundary: x.boundary,
      star, theme: g.theme, conclusion: g.conclusion, description: g.description, example: g.example, action: g.action, pillar: x.after.month.label, same: natal.has(star),
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

// 同じ出生情報で悩みを切り替える。過去の結果は、期間を過ぎたときだけ更新する。
function selectFocus(focus) {
  if (!R.FOCUS[focus] || !S.input) return false;
  const previous = { focus: S.focus, reading: S.reading };
  S.focus = focus;
  try {
    const cached = S.readings[focus];
    if (cached && (cached.split === "day" || periodState(cached) === "in")) S.reading = refreshReadingCopy(cached);
    else buildReading();
    S.readings[focus] = S.reading;
    return save();
  } catch {
    S.focus = previous.focus; S.reading = previous.reading;
    toast("結果を表示できませんでした。生年月日を確認してください。");
    return false;
  }
}
function topicSwitcher() {
  const category = R.FOCUS[S.reading.focus]?.category;
  return `<nav class="topics" aria-label="診断の種類">${[["fit","仕事"],["love","恋愛"],["relations","人間関係"],["money","お金"],["self","自分"]].map(([key,label]) => `<button type="button" data-act="topic" data-focus="${key}" aria-pressed="${R.FOCUS[key].category === category}">${label}</button>`).join("")}</nav><p class="topic-note note">知りたいテーマをタップしてください。<a href="#/focus">悩みを詳しく選ぶ</a></p>`;
}

// ═════════ 結果 ═════════
function periodState(r = S.reading) {
  const t = today(), now = ymKey(t.y, t.m);
  const s = ymKey(r.period.start.y, r.period.start.m), e = ymKey(r.period.end.y, r.period.end.m);
  return now < s ? "before" : now > e ? "after" : "in";
}
function monthState(mm) { const t = today(), now = ymKey(t.y, t.m); return mm.key < now ? "past" : mm.key === now ? "now" : "future"; }
const monthConclusion = (m) => (m.conclusion || m.theme).replace(/^今月は、/, monthState(m) === "now" ? "今月は、" : `${m.m}月は、`);
const monthName = (mm, full) => (full || mm.m === 1 ? `${mm.y}年${mm.m}月` : `${mm.m}月`);
function currentMonth(r) { return periodState(r) === "in" ? r.months.find((mm) => monthState(mm) === "now") : r.months[0]; }
function yearsText(r) {
  return r.years.map((y) => `${y.from ? `${y.from.y}年${y.from.m}月${y.from.d}日ごろから` : "この期間は"}：「${y.theme}」`).join("<br>");
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

function essenceHtml(summary, options = {}) {
  const text = summary && essenceFor(summary.source || summary.id);
  if (!text) return "";
  return `<div class="essence-reading"><p class="essence-intro">${esc(text.intro)}</p>${text.sections.map(part => `<section class="essence-section"><h2 class="h2">${esc(part.title)}</h2><p class="prose">${esc(part.text)}</p></section>`).join("")}</div>`;
}
function lineCard() {
  return `<section class="line-card stack-s"><p class="eyebrow">ハリーの詳しい鑑定</p><h2 class="h2">この先の流れを、<br>もっと詳しく。</h2><p>動き出す時期、人との関わり方、自分に合う選び方。気になるテーマを深く読む鑑定は、LINEでご案内します。</p><a class="btn secondary" href="#/line">詳しい鑑定について</a><p class="note">有料鑑定の内容と料金は、受付時にご案内します。</p></section>`;
}
function sResult() {
  const r=S.reading; if (!r) return needReading();
  if (r.split === "day") return {bar:bar("result"),nav:"sum",html:`<div class="stack"><h1 class="h1" tabindex="-1">あなたの本質には、複数の読みがあります</h1><p>生まれた時刻の範囲が日付をまたぐため、ひとつに絞れませんでした。候補ごとの特徴を読めます。</p>${candidatesHtml(r)}<a class="btn" href="#/birth">生まれた時刻を確認する</a></div>`};
  const summary=r.summary;
  return {bar:bar("result"),nav:"sum",html:`<div class="stack">
    <section class="cover stack-s"><img class="harry" src="assets/harry.png" alt="" width="56" height="56"><p class="eyebrow">${nick()}の本質</p><h1 class="display cover-title" tabindex="-1">${summary ? esc(summary.move) : "いくつかの顔を持つ、あなたの本質"}</h1><p class="note">命紋独自の読み方で、内面と日常の姿をひもときます。</p></section>
    <nav class="reading-index" aria-label="鑑定の読み順"><a href="#/r/essence">本質と性格</a><a href="#/r/history">18歳からの流れ</a><a href="#/r/future">これから3か月</a></nav>
    ${summary ? essenceHtml(summary) : candidatesHtml(r)}
    <section class="card stack-s"><h2 class="h2">あなたを支える条件</h2>${summary ? threeLines(summary,"",false) : '<p>生まれた時刻によって、合う環境の読みが分かれます。</p>'}<a class="textlink" href="#/r/essence">ほかの一面も読む</a></section>
    <section class="section stack-s"><p class="eyebrow">これまでのあなた</p><h2 class="h2">18歳から今まで、どんな流れを歩んだ？</h2><p>人との関わりがテーマの年、自分の意思を大切にする年。年ごとの流れを図でたどり、その頃の自分と照らし合わせられます。</p><a class="btn secondary" href="#/r/history">これまでの流れを見る</a></section>
    <section class="section stack-s"><h2 class="h2">悩みに合わせて、あなたを読む</h2>${topicSwitcher()}</section>
    <a class="btn" href="#/r/future">これから3か月を読む</a>
    ${lineCard()}${summary ? shareBlock(r) : ''}
  </div>`};
}

function sEssence() {
  const stop=needReading();if(stop)return stop;
  const r=S.reading;
  const extra=[...(r.combos||[]),...(r.basics||[])].filter(x=>x.id!==r.summary?.source);
  return {bar:bar("result"),nav:"sum",html:`<div class="stack"><p class="eyebrow">性格と本質</p><h1 class="h1" tabindex="-1">${nick()}の、内側にあるもの。</h1>
    ${r.summary ? essenceHtml(r.summary) : candidatesHtml(r)}
    ${extra.length ? `<section class="stack-s"><h2 class="h2">あわせて持っている一面</h2>${extra.map(x=>`<details class="why"><summary>${esc(x.move)}</summary>${essenceHtml(x)}</details>`).join('')}</section>` : ''}
    ${r.conditional.length ? `<details class="why"><summary>生まれた時刻で変わる一面</summary>${r.conditional.map(x=>`<section><h3>${esc(x.move)}</h3><p>${esc(essenceFor(x.id)?.intro || x.detail || x.env)}</p></section>`).join('')}</details>` : ''}
    <a class="btn" href="#/r/history">18歳から今までの流れを見る</a></div>`};
}

let lifeCache=null, selectedLifeYear=null;
function lifeFlow() {
  const key=birthKey(S.input)+JSON.stringify(today());
  if(lifeCache?.key!==key) lifeCache={key,value:buildLifeFlow(S.input)};
  return lifeCache.value;
}
function sHistory() {
  const stop=needReading();if(stop)return stop;
  const flow=lifeFlow();
  return {bar:bar("result"),nav:"history",html:`<div class="stack"><p class="eyebrow">18歳から、今まで</p><h1 class="h1" tabindex="-1">あなたの人生の流れ</h1><p>年ごとのテーマをたどると、当時大切にしていたことや、迷った理由を見つめ直せます。</p>${renderLifeFlow(flow,selectedLifeYear)}<div id="life-detail" tabindex="-1">${renderLifeYear(flow,selectedLifeYear)}</div><a class="btn" href="#/r/future">この先の3か月を読む</a></div>`};
}
function freeMonths(r=S.reading) {
  if(!r || r.split==='day')return [];
  const t=today(), ds=E.STEMS.indexOf(r.dayStem);
  if(ds<0)return [];
  return E.yearPlan(t.y,t.m,ds).slice(0,3).map(x=>{
    const star=E.TEN_GODS[x.after.god], g=R.focusGroup(star,r.focus), before=R.focusGroup(E.TEN_GODS[x.before.god],r.focus);
    return {key:ymKey(x.y,x.m),y:x.y,m:x.m,last:new Date(x.y,x.m,0).getDate(),star,boundary:x.boundary,
      theme:g.theme,conclusion:g.conclusion,description:g.description,example:g.example,action:g.action,
      before:{theme:before.theme,star:E.TEN_GODS[x.before.god]}};
  });
}
function sFuture() {
  const stop=needReading();if(stop)return stop;
  const r=S.reading, months=freeMonths(r);
  return {bar:bar("result"),nav:"future",html:`<div class="stack"><p class="eyebrow">ここからのあなた</p><h1 class="h1" tabindex="-1">これから3か月の流れ</h1><p>${esc(R.FOCUS[r.focus].category)}をテーマに、月ごとの大切にしたいことを読みます。気になる月をタップすると具体例まで読めます。</p>
    ${topicSwitcher()}<ol class="future-flow" aria-label="3か月の流れ">${months.map(original=>{const m=monthAdvice(original,r.focus);return `<li><a href="#/r/m/${m.key}"><span class="flow-month">${m.m}月</span><strong>${esc(monthConclusion(m))}</strong><span>${esc(m.action)}</span><span class="textlink">詳しく読む →</span></a></li>`}).join('')}</ol>
    <div class="future-next"><span aria-hidden="true">↓</span><p>この先の時期ごとの流れや、悩みを深く読む鑑定へ。</p></div>${lineCard()}</div>`};
}
const TOPIC_TITLES={fit:'仕事と、あなたの持ち味',stay:'今の働き方と、あなたの本質',love:'恋愛で見える、あなたの素顔',relations:'人付き合いと、あなたの距離感',money:'お金と、あなたが大切にするもの',self:'あなたらしく過ごすために',start:'新しい一歩と、あなたの始め方',unsure:'まだ言葉にならない気持ちへ'};
function sTopic(key) {
  const stop=needReading();if(stop)return stop;
  if(!R.FOCUS[key])return redirect('#/r/topic/self');
  if(S.reading.focus!==key && !selectFocus(key))return sResult();
  const r=S.reading;
  if(r.split==='day')return sResult();
  const f=R.FOCUS[key], cur=monthAdvice(freeMonths(r)[0],key);
  return {bar:bar('result'),nav:'topic',html:`<div class="stack"><p class="eyebrow">${esc(f.category)}の診断</p><h1 class="h1" tabindex="-1">${TOPIC_TITLES[key]}</h1>${topicSwitcher()}<section class="essence-section"><h2 class="h2">${esc(r.headline)}</h2><p class="prose">${esc(r.answer)}</p></section>
    ${r.summary ? `<section class="card stack-s"><h2 class="h2">この悩みにつながる、あなたの本質</h2><p>${esc(essenceFor(r.summary.source)?.intro || r.summary.move)}</p><a class="textlink" href="#/r/essence">性格を深く読む</a></section>` : candidatesHtml(r)}
    <section class="stack-s"><p class="eyebrow">${cur.m}月に大切にしたいこと</p><h2 class="h2">${esc(monthConclusion(cur))}</h2><p>${esc(cur.description)}</p><p>${esc(cur.example)}</p></section><a class="btn secondary" href="#/r/future">${esc(f.category)}の3か月の流れを見る</a>${lineCard()}</div>`};
}
function sLine() {
  const url=lineUrl();
  return {bar:bar('plain',{label:'詳しい鑑定'}),html:`<div class="stack"><p class="eyebrow">ハリーの詳しい鑑定</p><h1 class="h1" tabindex="-1">自分を知った、その先へ。</h1><p class="lead">これからどう動くか。どんな関係を育てるか。今のあなたの悩みに合わせて、もう一歩深く読み解く鑑定をLINEでご案内します。</p>
    <section class="card stack-s"><h2 class="h2">詳しい鑑定でお届けしたいこと</h2><ul class="offer-list"><li>これからの時期ごとの流れと、動き方のヒント</li><li>仕事や恋愛など、気になるテーマを深く読む解説</li><li>あなたの本質に合わせた、迷ったときの選び方</li></ul><p class="note">鑑定の期間、提供内容、料金は受付時にご案内します。現在、このアプリで購入手続きは行いません。</p></section>
    <ol class="line-steps"><li>無料診断で、本質とこれまでの流れを知る</li><li>LINEで詳しい鑑定の案内を受け取る</li><li>内容と料金を確認してから申し込む</li></ol>
    ${url ? `<a class="btn line-button" href="${esc(url)}" target="_blank" rel="noopener noreferrer">LINEで鑑定の案内を受け取る</a><p class="note">この操作で生年月日や診断結果がLINEへ送信されることはありません。</p>` : `<p class="quiet">LINEでのご案内は、受付開始時にこのページでお知らせします。無料の診断結果は引き続きご覧いただけます。</p>`}
    <a class="textlink" href="${S.reading?'#/r':'#/focus'}">${S.reading?'無料の診断結果へ戻る':'無料で自分を診断する'}</a></div>`};
}

function calList(r, list = r.months) {
  return list.map((mm) => {
    mm = monthAdvice(mm, r.focus);
    const st = monthState(mm);
    const tag = st === "now" ? "今月" : st === "past" ? "過去" : "";
    return `<li class="${st}"><a class="cal-row" href="#/r/m/${mm.key}" ${st === "now" ? 'aria-current="date"' : ""}><span class="mon">${mm.m}月<small>${mm.y}年</small></span><span class="theme">${monthConclusion(mm)}</span>${tag ? `<span class="tag">${tag}</span>` : "<span></span>"}<span class="act">${mm.action}</span></a></li>`;
  }).join("");
}
function sYear() { return sFuture(); }

function sMonth(key) {
  const stop=needReading(); if(stop)return stop;
  const r=S.reading, months=freeMonths(r), i=months.findIndex(m=>m.key===key);
  if(i<0)return sLine();
  const original=months[i], m=monthAdvice(original,r.focus), f=R.FOCUS[r.focus], previous=months[i-1], next=months[i+1];
  return {bar:bar('result'),nav:'future',html:`<div class="stack"><p class="eyebrow">${monthName(m,true)}${monthState(m)==='past'?'（過去の月）':''}</p>
    <p class="note">${esc(f.category)}の${monthState(m) === "now" ? "今月" : "この月"}の結論</p>
    <p class="note">${m.isBefore ? `${m.m}月1日〜${m.boundary.day}日${m.boundary.hour}時ごろ` : `${m.m}月${m.boundary.day}日${m.boundary.hour}時ごろ〜月末`}の読み（日本時間）</p>
    <h1 class="h1" tabindex="-1">${monthConclusion(m)}</h1>
    <section class="stack-s"><h2 class="h2">この月の読み方</h2><p class="prose">${m.description}</p></section>
    <section class="card stack-s"><h2 class="h2">たとえば、こんな場面で</h2><p>${m.example}</p></section>
    <details class="why"><summary>月の切り替わりと占いの理由</summary><p>この占いでは、月の結果は毎月1日ではなく、季節の区切りの日に変わります。</p><p>${m.m}月${m.boundary.day}日${m.boundary.hour}時ごろまでは「${m.before.theme}」、それ以降は「${original.theme}」です（日本時間）。</p><p>生まれた日と、この月の干支の組み合わせから読んでいます。出来事の予測ではなく、占いからのアドバイスです。</p></details>
    <nav class="pager" aria-label="前後の月">${previous?`<a href="#/r/m/${previous.key}">← ${monthName(previous)}</a>`:'<span></span>'}${next?`<a href="#/r/m/${next.key}">${monthName(next)} →</a>`:'<span></span>'}</nav><a class="textlink" href="#/r/year">3か月の流れに戻る</a></div>`};
}
function sNow() {
  const stop=needReading();if(stop)return stop;
  return {...sMonth(freeMonths()[0].key),nav:'future'};
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
      ${r.period ? `<div><dt>月の鑑定</dt><dd>今月を含む3か月</dd><span></span></div>` : ""}
      <div class="birthonly"><dt>生年月日</dt><dd>${i ? `${i.y}年${i.m}月${i.d}日` : "消去済み"}</dd><a class="edit" href="#/birth">直す</a></div>
      <div class="birthonly"><dt>出生地</dt><dd>${i ? placeText(i) : "消去済み"}</dd><span></span></div>
      <div class="birthonly"><dt>時刻</dt><dd>${i ? timeText(i) : "消去済み"}</dd><span></span></div>
      <div class="birthonly"><dt>命式（年・月・日・時）</dt><dd>${r.candidates.map((k, n) => `${r.candidates.length > 1 ? `候補${n + 1}：` : ""}${k}`).join("<br>")}</dd><span></span></div>
      <div><dt>手がかりの星</dt><dd>${r.starLine}</dd><span></span></div>
      <div><dt>規約</dt><dd>年の境目＝立春、月の境目＝節入り、生まれた土地の標準時（真太陽時の補正なし）、日付の境目＝0時、23時台の時の干はその日の日干から数える</dd><span></span></div>
      <div><dt>読みの範囲</dt><dd>${R.LIMITED}</dd><span></span></div>
      ${r.basics ? `<div><dt>使った読み</dt><dd>${[...r.combos, ...r.basics].map((x) => x.id).join("・")}${r.conditional.length ? `（条件付き：${r.conditional.map((x) => x.id).join("・")}）` : ""}</dd><span></span></div>` : ""}

    </dl>
    <p class="note">節入りの時刻は計算値です。国立天文台の2026年の値と比べた差は最大14分で、境目の前後30分に生まれた場合は候補を並べます。</p></section>
  <section class="card stack-s" aria-labelledby="del"><h2 class="h2" id="del">入力と結果の削除</h2>
    <p>生年月日と、すべての悩みの診断結果をこのブラウザーから削除します。通常はタブを閉じても残ります。別の端末やブラウザーとは共有されません。</p>
    <div id="delconfirm" class="errsummary stack-s" hidden><p>削除すると元に戻せません。削除しますか。</p><button class="btn" type="button" data-act="delete">削除する</button><button class="btn secondary" type="button" data-act="delcancel">やめる</button></div>
    <button class="btn secondary" type="button" data-act="delask" id="delbtn">すべて削除する</button></section>
</div>`,
  };
}

// 設定画面ではなく、保存済みの鑑定と記録を印刷する。入力情報は明示的に選んだ場合だけ含める。
function printReadingHtml(state, withBirth) {
  const r = state.reading, input = state.input;
  const three = (s) => `<dl class="three"><div><dt>性格の特徴</dt><dd>${esc(s.move)}</dd></div><div><dt>あなたに合う環境</dt><dd>${esc(s.env)}</dd></div><div><dt>苦手になりやすいこと</dt><dd>${esc(s.burden)}</dd></div></dl>`;
  const item = (x) => `<section class="print-block"><h3>${esc(x.id)}：${esc(x.move)}</h3>${three(x)}${x.detail ? `<p>${esc(x.detail)}</p>` : ""}</section>`;
  const sections = (title, xs) => xs?.length ? `<section><h2>${title}</h2>${xs.map(item).join("")}</section>` : "";
  const months = freeMonths(r).map((original) => { const m=monthAdvice(original,r.focus); return `<section class="print-block"><h3>${esc(m.y)}年${esc(m.m)}月：${esc(monthConclusion(m))}</h3>
    <p>1日〜${esc(m.boundary.day)}日${esc(m.boundary.hour)}時ごろ：「${esc(m.before.theme)}」<br>${esc(m.boundary.day)}日${esc(m.boundary.hour)}時ごろ〜${esc(m.last)}日：「${esc(original.theme)}」（日本時間）</p>
    <p>${esc(m.description || "")}</p><p>たとえば：${esc(m.example || m.action)}</p></section>`; }).join("");
  const birth = withBirth && input ? `<section class="print-block"><h2>入力情報</h2>
    ${input.nick ? `<p>呼び名：${esc(input.nick)}</p>` : ""}<p>生年月日：${esc(input.y)}年${esc(input.m)}月${esc(input.d)}日<br>出生地：${placeText(input)}<br>時刻：${esc(timeText(input))}</p>
    <p>命式（年・月・日・時）：${(r.candidates || []).map(esc).join("／")}</p></section>` : "";
  return `<h1>ハリーの命紋診断・鑑定結果</h1><p>本質と性格、これから3か月の鑑定</p>
    <p class="print-note">${esc(R.DISCLAIMER)}</p>
    <section><h2>あなたの性格</h2>${r.summary ? essenceHtml(r.summary) + three(r.summary) : `<p>出生情報の幅によって読みが分かれています。</p>${(r.uniq || []).map((s, i) => `<section class="print-block"><h3>候補${i + 1}</h3>${three(s)}</section>`).join("")}`}</section>
    <section class="print-block"><h2>今回の相談</h2><p>${esc(r.consult)}</p>${r.headline ? `<h3>${esc(r.headline)}</h3><p>${esc(r.answer)}</p>` : ""}<p>相談内容は、本質の計算には使っていません。</p></section>
    ${sections("特徴の組み合わせ", r.combos)}${sections("性格の特徴", r.basics)}${sections("条件付きの候補", r.conditional)}
    ${months ? `<section><h2>3か月のアドバイス</h2><p>月ごとのアドバイスです。出来事を予測したものではありません。</p>${months}</section>` : ""}
    ${birth}<section class="print-block"><h2>計算と読みの条件</h2><p>${esc(R.LIMITED)}</p><p>年の境目は立春、月の境目は節入り、日付の境目は現地0時です。真太陽時の補正はしません。</p>
    </section>`;
}

function clearPrintReading() {
  document.getElementById("print-reading")?.remove();
  document.body.classList.remove("printing-reading");
}
window.addEventListener("afterprint", clearPrintReading);

function sHow() {
  return {bar:bar('plain',{label:'ハリーの命紋診断について'}),html:`<div class="stack prose"><h1 class="h1" tabindex="-1">命紋は、あなたらしさを読む独自の占いです。</h1><p>生まれた日時を手がかりに、内面の欲求、人との関わり方、力を出しやすい場面を読み解きます。性格とこれまでの流れ、これからの過ごし方を、一つの鑑定としてつなげることを大切にしています。</p>
    <section class="stack-s"><h2 class="h2">案内役のハリー</h2><p>ハリーは、自分を知る時間に寄り添う、このサービスのオリジナルキャラクターです。</p></section><section class="stack-s"><h2 class="h2">命紋独自の読み方</h2><p>東洋の暦や干支の考え方を参考に、複数の特徴の組み合わせと、日常の場面への読み替えを独自に設計しています。伝統的な暦そのものを新しく発明した占いではありません。</p><p>本質の10種類の読みと6種類の組み合わせをもとに、年や月ごとの5つのテーマを重ねています。本人が選ぶ悩みは、説明する場面に使います。</p></section>
    <section class="stack-s"><h2 class="h2">無料で読めること</h2><p>本質と性格、18歳から現在までの年ごとの流れ、これから3か月のアドバイスです。仕事、恋愛、人間関係、お金、自分のテーマで読むことができます。</p></section>
    <section class="stack-s"><h2 class="h2">占いの受け止め方</h2><p>${R.DISCLAIMER}</p><p>過去の図は、生まれた日時と各年の暦から読んだテーマです。実際に起きた出来事の記録や、運の良し悪しを測定した数値ではありません。ご自身の経験と照らし合わせてお読みください。</p><p>的中率や、出来事を予測する精度は確認されていません。</p></section>
    <section class="stack-s" id="data"><h2 class="h2">入力情報の扱い</h2><p>生年月日と結果はこのブラウザーに保存し、外部へ送信しません。通常は閉じても残り、設定から削除できます。ブラウザーのデータを消したときやプライベートモードでは残らない場合があります。別の端末とは共有されません。</p><p>シェアには生年月日や呼び名は含みません。LINEへの移動でも出生情報は自動送信しません。</p><p class="note">書体はGoogle Fontsから読み込みます。アクセス解析は入れていません。18歳以上の方が対象です。</p></section><a class="btn" href="#/focus">自分の命紋を読む</a></div>`};
}

// シェアされた読みの紹介ページ（個人の結果ではなく、読みの一つとして見せる）
function sType(id) {
  const x = typeOf(id);
  if (!x) return redirect("#/");
  return {
    bar: bar("plain", { label: "シェアされた命紋" }),
    html: `<div class="stack">
  <section class="cover stack-s" aria-labelledby="h">
    <img class="harry" src="assets/harry.png" alt="" width="56" height="56">
    <p class="eyebrow">${crescent} シェアされた命紋</p>
    <h1 class="display cover-title" id="h" tabindex="-1">${x.move}</h1>
  </section>
  <section class="card stack-s">${kind("read")}${x.detail ? `<p>${x.detail}</p>` : ""}${threeLines(x, "", false)}</section>
  <p>これはハリーの命紋診断の読みの一つです。生年月日から、あなたの命紋と、これから3か月のアドバイスを無料で出せます。</p>
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
  bg.addColorStop(0, "#21324a"); bg.addColorStop(0.45, "#101a30"); bg.addColorStop(1, "#0c1425");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = (x, y, rad, color) => { const g = ctx.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
  glow(W * 0.18, H * 0.14, 560, "rgba(101,122,142,.12)"); glow(W * 0.92, H * 0.45, 480, "rgba(101,122,142,.08)"); glow(W * 0.5, H * 1.02, 620, "rgba(184,155,98,.06)");
  let seed = 20260924;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 55; i++) {
    const a = 0.25 + rnd() * 0.7;
    ctx.fillStyle = rnd() < 0.15 ? `rgba(240,217,155,${a})` : `rgba(226,232,255,${a})`;
    ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, rnd() ** 3 * 2.4 + 0.5, 0, Math.PI * 2); ctx.fill();
  }
  const serif = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif', sans = '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif';
  const all = `ハリーの命紋診断私の命紋は「」${s.move}${s.env}${s.burden}あなたに合う環境苦手になりやすいこと#生年月日から、あなたの性格を読む占い${location.host}`;
  try { await Promise.all([document.fonts.load(`600 72px "Noto Serif JP"`, all), document.fonts.load(`600 36px "Noto Sans JP"`, all), document.fonts.load(`400 26px "Noto Sans JP"`, all)]); } catch { /* 端末の書体で描く */ }
  const cx = 160, cy = 180;
  glow(cx, cy, 190, "rgba(240,217,155,.35)");
  try {
    const harry = await loadImg("assets/harry.png");
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 74, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(harry, cx - 74, cy - 74, 148, 148); ctx.restore();
  } catch { /* 案内役の画像なしで描く */ }
  ctx.strokeStyle = "rgba(240,217,155,.55)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 94, 0, Math.PI * 2); ctx.stroke();
  ctx.textBaseline = "top";
  ctx.fillStyle = "#b89b62"; ctx.font = `600 34px ${sans}`; ctx.fillText("ハリーの命紋診断", 300, 138);
  ctx.fillStyle = "#b3bfcd"; ctx.font = `400 30px ${sans}`; ctx.fillText("私の命紋は", 300, 192);
  let y = 340;
  ctx.fillStyle = "#dfc995"; ctx.font = `600 74px ${serif}`;
  ctx.shadowColor = "rgba(217,181,106,.45)"; ctx.shadowBlur = 24;
  for (const line of wrapText(ctx, `「${s.move}」`, W - 170)) { ctx.fillText(line, 80, y); y += 106; }
  ctx.shadowBlur = 0;
  y += 36;
  for (const [label, text] of [["あなたに合う環境", s.env], ["苦手になりやすいこと", s.burden]]) {
    const top = y;
    ctx.fillStyle = "#b89b62"; ctx.font = `600 28px ${sans}`; ctx.fillText(label, 108, y); y += 50;
    ctx.fillStyle = "#e7edf0"; ctx.font = `600 38px ${sans}`;
    for (const line of wrapText(ctx, text, W - 200)) { ctx.fillText(line, 108, y); y += 58; }
    ctx.fillStyle = "rgba(217,181,106,.55)"; ctx.fillRect(80, top + 4, 3, y - top - 14);
    y += 40;
  }
  ctx.fillStyle = "rgba(217,181,106,.35)"; ctx.fillRect(80, H - 190, W - 160, 1);
  ctx.fillStyle = "#e7edf0"; ctx.font = `600 36px ${serif}`; ctx.fillText("#ハリーの命紋診断", 80, H - 160);
  ctx.fillStyle = "#b3bfcd"; ctx.font = `400 26px ${sans}`;
  ctx.fillText("生年月日から、あなたの性格を読む占い", 80, H - 104);
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
const ROUTES = { "": sHome, sample: sSample, focus: sFocus, birth: sBirth, r: sResult, "r/essence": sEssence, "r/history": sHistory, "r/future": sFuture, line:sLine, "r/year": sYear, "r/now": sNow, "r/settings": sSettings, how: sHow };
const TITLES = { sample: "結果の見本", focus: "質問 1", birth: "質問 2", r: "診断結果", "r/essence": "性格", "r/history":"これまでの流れ", "r/future":"これから3か月", line:"詳しい鑑定", "r/year": "これから3か月", "r/now": "今月の結果", "r/settings": "計算条件と保存", how: "この診断について" };

function render() {
  clearPrintReading();
  const path = location.hash.replace(/^#\/?/, "").split("?")[0];
  const mo = path.match(/^r\/m\/(\d{4}-\d{2})$/), ty = path.match(/^t\/([CT]\d{2})$/);
  const topic=path.match(/^r\/topic\/([a-z]+)$/);
  const view = topic ? sTopic(topic[1]) : mo ? sMonth(mo[1]) : ty ? sType(ty[1]) : (ROUTES[path] || sHome)();
  topbar.innerHTML = view.bar;
  const showTopics = S.input && S.reading && (path === "r/now" || mo);
  main.innerHTML = (showTopics ? topicSwitcher() : "") + (S.input && !persistent ? `<p class="quiet storage-warning" role="status">このブラウザーでは保存できませんでした。タブを閉じると、生年月日の再入力が必要になることがあります。</p>` : "") + view.html;
  const showNav = "nav" in view && S.reading && S.reading.split !== "day";
  document.body.classList.toggle("has-resultnav", Boolean(showNav));
  resultnav.innerHTML = showNav ? [["sum", "#/r", "本質"], ["history", "#/r/history", "これまで"], ["future", "#/r/future", "これから"], ["topic", `#/r/topic/${S.reading.focus}`, "悩み別"]]
    .map(([k, h, l]) => `<a href="${h}" ${view.nav === k ? 'aria-current="page"' : ""}>${l}</a>`).join("") : "";
  const title = topic ? R.FOCUS[topic[1]]?.category : mo ? "月の詳細" : ty ? "シェアされた命紋" : TITLES[path];
  document.title = title ? `${title}｜ハリーの命紋診断` : "ハリーの命紋診断";
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
  on("form[data-form=birth]", "input", (e) => { S.draft = readBirth(e.currentTarget); });
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
    if (S.input) { if (selectFocus(v)) location.hash = "#/r"; }
    else { S.focus = v; location.hash = "#/birth"; }
  }
  if (kindOf === "birth") {
    const d = readBirth(form);
    const errs = validateBirth(d);
    if (errs.some((x) => x[3])) { // 対象外：生年月日を保持しない
      S.draft = { ...d, by: "", bm: "", bd: "" };
      ["by", "bm", "bd"].forEach((id) => { main.querySelector(`#${id}`).value = ""; });
      showErrors(errs);
      main.querySelector("#e-date").insertAdjacentHTML("beforeend", ` <a href="#/sample">結果の見本を見る</a>`);
      return;
    }
    if (errs.length) { S.draft = d; showErrors(errs); return; }
    S.draft = d;
    const previous = { input: S.input, reading: S.reading, readings: S.readings };
    S.input = { nick: (d.nick || "").trim(), y: Number(d.by), m: Number(d.bm), d: Number(d.bd), country: d.country || "JP", offset: d.country === "other" ? Number(d.offset) : null,
      city: (d.city || "").trim(), timeMode: d.timeMode, time: d.time, from: d.from, to: d.to, toNextDay: d.toNextDay };
    const status = main.querySelector("#calcstatus");
    status.textContent = "生まれた日の干支を計算しています";
    const unchanged = birthKey(previous.input) === birthKey(S.input);
    try {
      if (unchanged && previous.reading && (previous.reading.split === "day" || periodState(previous.reading) === "in")) S.reading = previous.reading;
      else buildReading();
    }
    catch { S.input = previous.input; S.reading = previous.reading; S.readings = previous.readings; chartCache = null; status.textContent = "計算できませんでした。入力を確かめて、もう一度お試しください。入力は残っています。"; return; }
    S.readings = unchanged ? previous.readings : {};
    S.readings[S.reading.focus] = S.reading;
    S.fresh = true; if (save()) location.hash = "#/r";
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
  if (act === "topic") {
    if (selectFocus(a.dataset.focus)) {
      const target=`#/r/topic/${a.dataset.focus}`;
      if(location.hash===target)render();else location.hash=target;
    }
  }
  if (act === "life-year") {
    selectedLifeYear=Number(a.dataset.year);
    const flow=lifeFlow();
    const graph=main.querySelector('.life-flow');
    const scrollLeft=graph?.querySelector('.life-chart-scroll')?.scrollLeft || 0;
    if(graph){graph.outerHTML=renderLifeFlow(flow,selectedLifeYear);main.querySelector('.life-chart-scroll').scrollLeft=scrollLeft;}
    const detail=main.querySelector('#life-detail');
    if(detail){detail.innerHTML=renderLifeYear(flow,selectedLifeYear);detail.focus({preventScroll:true});detail.scrollIntoView({behavior:'instant',block:'start'});}
  }
  if (act === "grid") { S.gridView = !S.gridView; save(); render(); }
  if (act === "card") shareCard();
  if (act === "share") {
    try { await navigator.share({ title: "ハリーの命紋診断", text: shareText(S.reading), url: shareUrl(S.reading) }); }
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
  if (act === "delete") {
    const result = clearState();
    if (!result.cleared) { toast("保存情報を削除できませんでした。ブラウザーの設定から、このサイトのデータを削除してください。"); return; }
    S = blank(); chartCache = null; persistent = true; location.hash = "#/"; toast("削除しました");
  }
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
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  S = load(); chartCache = null; persistent = true;
  render();
});
if (S.input) save();
render();
