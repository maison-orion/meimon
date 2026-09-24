// 命紋 計算エンジン（ブラウザとNodeの両方で動くESモジュール）
// 規約 v0.1：年柱の境界＝立春、月柱の境界＝12の節入り（太陽の視黄経315°から30°おき）、
// 現地標準時（真太陽時の補正なし）、日界＝現地0時、23時台の時干はその日の日干から出す。
// 太陽の黄経は節入りの計算だけに使う（西洋占星術の星座は結果に使わない）。
// 精度：Meeus 25章の略算（約0.01°）。
// 境界付近は余裕を持たせて「候補が分かれる」扱いにする。

export const CALC_VERSION = "calc-0.2";
export const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
export const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
export const TEN_GODS = ["比肩", "劫財", "食神", "傷官", "偏財", "正財", "偏官", "正官", "偏印", "印綬"];

const RAD = Math.PI / 180;
const norm = (x) => ((x % 360) + 360) % 360;
const sinD = (x) => Math.sin(x * RAD);

// 日本の夏時間（1948〜1951年）。境界の分単位は扱わず、期間中の出生は時差候補を+9/+10の両方にする。
const JP_DST = [[1948, "05-01", "09-12"], [1949, "04-02", "09-11"], [1950, "05-06", "09-10"], [1951, "05-05", "09-09"]];
export function jpDstPossible(y, m, d) {
  const md = `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return JP_DST.some(([yy, a, b]) => yy === y && md >= a && md <= b);
}

// ΔT（秒）のおおまかな表。数十秒の誤差は境界の余裕に吸収させる。
const DT = [[1900, -3], [1920, 21], [1940, 24], [1960, 33], [1980, 51], [2000, 64], [2020, 69], [2040, 75]];
function deltaT(year) {
  if (year <= DT[0][0]) return DT[0][1];
  for (let i = 1; i < DT.length; i++) {
    if (year <= DT[i][0]) {
      const [y0, v0] = DT[i - 1], [y1, v1] = DT[i];
      return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
    }
  }
  return DT[DT.length - 1][1];
}

const jdFromMs = (ms) => ms / 86400000 + 2440587.5;
function centuriesTT(ms) {
  const year = new Date(ms).getUTCFullYear();
  return (jdFromMs(ms) + deltaT(year) / 86400 - 2451545) / 36525;
}

export function sunLongitude(ms) {
  const T = centuriesTT(ms);
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sinD(M) + (0.019993 - 0.000101 * T) * sinD(2 * M) + 0.000289 * sinD(3 * M);
  const omega = 125.04 - 1934.136 * T;
  return norm(L0 + C - 0.00569 - 0.00478 * sinD(omega));
}

// 太陽が黄経 target に達する瞬間（UTCのミリ秒）。guessMs の近くを探す。
export function solarTermInstant(target, guessMs) {
  let t = guessMs;
  for (let i = 0; i < 20; i++) {
    const diff = ((target - sunLongitude(t) + 540) % 360) - 180;
    t += (diff / 360) * 365.2422 * 86400000;
    if (Math.abs(diff) < 1e-6) break;
  }
  return t;
}

// 暦月（yyyy, m）にある節入りの瞬間と、それが始める月の番号（0=寅月）。
export function setsuInCalendarMonth(y, m) {
  const k = (m + 10) % 12; // 2月→寅(0)、1月→丑(11)
  const target = norm(315 + 30 * k);
  return { ms: solarTermInstant(target, Date.UTC(y, m - 1, 6)), monthIndex: k };
}

const pillar = (s, b) => ({ stem: s, branch: b, label: STEMS[s] + BRANCHES[b] });

// UTCのある瞬間の年柱と月柱。jstYear/jstMonth は出生地の暦の年月（年の切替判定に使う）。
export function yearMonthPillar(ms) {
  const lam = sunLongitude(ms);
  const m = Math.floor(norm(lam - 315) / 30); // 0=寅
  const d = new Date(ms + 9 * 3600000); // 年の判定は立春の前後だけ見るので、日本時間の暦年で十分
  let y = d.getUTCFullYear();
  if (m >= 10 && d.getUTCMonth() <= 1) y -= 1; // 1月〜立春前（子月・丑月）は前年
  const ys = (((y - 4) % 10) + 10) % 10, yb = (((y - 4) % 12) + 12) % 12;
  return { year: pillar(ys, yb), month: pillar((ys * 2 + 2 + m) % 10, (m + 2) % 12), solarYear: y, monthIndex: m };
}

// 日柱（現地の暦日）：2000-01-01 が戊午（通し番号54）。
export function dayPillar(y, m, d) {
  const days = Math.round(Date.UTC(y, m - 1, d) / 86400000); // 1970-01-01 からの日数
  const n = (((days - 10957 + 54) % 60) + 60) % 60; // 10957 = 2000-01-01
  return pillar(n % 10, n % 12);
}

export function hourPillar(dayStem, hour) {
  const hb = Math.floor((hour + 1) / 2) % 12;
  return pillar((dayStem * 2 + hb) % 10, hb);
}

export function tenGod(dayStem, stem) {
  const de = Math.floor(dayStem / 2), te = Math.floor(stem / 2);
  const rel = (te - de + 5) % 5; // 0同じ 1日干が生む 2日干が剋す 3日干を剋す 4日干を生む
  const same = dayStem % 2 === stem % 2;
  return TEN_GODS[rel * 2 + (same ? 0 : 1)];
}
export const tenGodIndex = (dayStem, stem) => TEN_GODS.indexOf(tenGod(dayStem, stem));

export function validDate(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/**
 * 出生情報から命式を計算する。不確かな入力は範囲で受け、年・月・日・時の組をそのまま候補として返す
 * （項目ごとにばらして組み合わせ直さない。日干が候補によって異なれば別候補として扱う）。
 * input = { y, m, d, timeMode: "exact"|"range"|"unknown", time:"HH:MM", from:"HH:MM", to:"HH:MM", toNextDay:bool,
 *           country: "JP"|"other"|"unknown", offset: 数値（other のとき、時間） }
 */
export function calcChart(input) {
  const { y, m, d } = input;
  const localBase = Date.UTC(y, m - 1, d); // 現地の暦日0時を「UTCのふり」をした基準
  const toMin = (s) => { const [h, mi] = s.split(":").map(Number); return h * 60 + mi; };
  let a, b;
  if (input.timeMode === "exact") a = b = toMin(input.time);
  else if (input.timeMode === "range") { a = toMin(input.from); b = toMin(input.to) + (input.toNextDay ? 1440 : 0); }
  else { a = 0; b = 1439; }
  const timeKnown = input.timeMode !== "unknown";

  let offsets;
  if (input.country === "JP") offsets = jpDstPossible(y, m, d) ? [9, 10] : [9];
  else if (input.country === "other" && Number.isFinite(input.offset)) offsets = [input.offset];
  else offsets = Array.from({ length: 27 }, (_, i) => i - 12);

  // 境界の計算誤差の余裕（国立天文台2026年値との差は最大14分）
  const MARGIN = 30 * 60000;
  const found = new Map();
  for (let t = a; ; t = Math.min(t + 20, b)) {
    const local = new Date(localBase + t * 60000);
    const day = dayPillar(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate());
    const hour = timeKnown ? hourPillar(day.stem, local.getUTCHours()) : null;
    for (const o of offsets) {
      const inst = localBase + t * 60000 - o * 3600000;
      for (const e of [inst - MARGIN, inst, inst + MARGIN]) {
        const ym = yearMonthPillar(e);
        const key = [ym.year.label, ym.month.label, day.label, hour?.label ?? "-"].join("/");
        if (!found.has(key)) found.set(key, { year: ym.year, month: ym.month, day, hour });
      }
    }
    if (t >= b) break;
  }
  return { version: CALC_VERSION, timeKnown, offsets, candidates: [...found.values()] };
}

// 命式1組の通変（日干から見た年干・月干・時干）。日干自身は数えない。欠けた位置は null
export function starsOf(c) {
  const g = (p) => (p ? tenGod(c.day.stem, p.stem) : null);
  return { year: g(c.year), month: g(c.month), hour: g(c.hour) };
}

// 対象期間（開始の年月から12暦月）の月ごとの読み材料。境界は日本時間で表示する。
export function yearPlan(startY, startM, dayStem) {
  const months = [];
  for (let i = 0; i < 12; i++) {
    const y = startY + Math.floor((startM - 1 + i) / 12), m = ((startM - 1 + i) % 12) + 1;
    const setsu = setsuInCalendarMonth(y, m);
    const jst = new Date(setsu.ms + 9 * 3600000);
    const before = yearMonthPillar(setsu.ms - 3600000), after = yearMonthPillar(setsu.ms + 3600000);
    months.push({
      y, m,
      boundary: { day: jst.getUTCDate(), hour: jst.getUTCHours(), minute: jst.getUTCMinutes() },
      before: { ...before, god: tenGodIndex(dayStem, before.month.stem) },
      after: { ...after, god: tenGodIndex(dayStem, after.month.stem), yearGod: tenGodIndex(dayStem, after.year.stem) },
    });
  }
  return months;
}
