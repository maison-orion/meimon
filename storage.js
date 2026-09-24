// 端末保存。保存形式はアプリの版と独立させ、診断期間や出生情報を再計算しない。
export const STORAGE_KEY = "meimon:state:v1";
const LEGACY_KEY = "meimon";
const SCHEMA = 1;
const FOCUSES = new Set(["fit", "stay", "start", "unsure", "love", "relations", "money", "self"]);
const STARS = new Set(["比肩", "劫財", "食神", "傷官", "偏財", "正財", "偏官", "正官", "偏印", "印綬"]);
const object = x => x !== null && typeof x === "object" && !Array.isArray(x);
const string = x => typeof x === "string";
// 診断本文はHTMLを持たない。任意フィールドも型を確かめ、不正な結果は表示へ渡さない。
// 呼び名・出生地は利用者の入力なので、この検証とは分けて画面側でエスケープする。
const plain = x => string(x) && x.length <= 10000 && !/[<>]/.test(x);
const optionalText = (x, keys) => keys.every(k => x[k] === undefined || plain(x[k]));
const pick = (x, keys) => Object.fromEntries(keys.filter(k => Object.hasOwn(x, k)).map(k => [k, x[k]]));
const dateValid = (y, m, d) => {
  if (![y, m, d].every(Number.isInteger) || y < 1900 || y > 9999) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() + 1 === m && t.getUTCDate() === d;
};
const timeValid = x => string(x) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x);
const ymValid = x => object(x) && dateValid(x.y, x.m, 1);
const ymIndex = x => x.y * 12 + x.m - 1;
const ruleId = x => string(x) && /^(?:T(?:0[1-9]|10)|C0[1-6])$/.test(x);

function inputOf(x) {
  if (!object(x) || !dateValid(x.y, x.m, x.d) || !["JP", "other", "unknown"].includes(x.country)) return null;
  if (!["unknown", "exact", "range"].includes(x.timeMode)) return null;
  if (x.country === "other" && (!Number.isFinite(x.offset) || x.offset < -12 || x.offset > 14)) return null;
  if (x.timeMode === "exact" && !timeValid(x.time)) return null;
  if (x.timeMode === "range") {
    if (!timeValid(x.from) || !timeValid(x.to) || (x.toNextDay != null && typeof x.toNextDay !== "boolean")) return null;
    const minutes = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    const span = minutes(x.to) + (x.toNextDay ? 1440 : 0) - minutes(x.from);
    if (span < 0 || span > 1440) return null;
  }
  if (x.nick != null && !string(x.nick) || x.city != null && !string(x.city)) return null;
  const out = { y: x.y, m: x.m, d: x.d, country: x.country, offset: x.country === "other" ? x.offset : null,
    timeMode: x.timeMode, nick: (x.nick || "").slice(0, 20), city: (x.city || "").slice(0, 40) };
  if (x.timeMode === "exact") out.time = x.time;
  if (x.timeMode === "range") Object.assign(out, { from: x.from, to: x.to, toNextDay: Boolean(x.toNextDay) });
  return out;
}

function ruleOf(x, summary = false) {
  if (!object(x) || !ruleId(summary ? x.source : x.id) || ![x.move, x.env, x.burden].every(plain)) return null;
  if (!optionalText(x, ["hypothesis", "detail", "ask", "split"])) return null;
  if (x.source !== undefined && !ruleId(x.source) || x.id !== undefined && !ruleId(x.id)) return null;
  if (x.candidate !== undefined && (!Number.isInteger(x.candidate) || x.candidate < 0)) return null;
  if (x.stars != null && (!Array.isArray(x.stars) || !x.stars.every(s => STARS.has(s)))) return null;
  if (x.star != null && !STARS.has(x.star)) return null;
  const out = pick(x, ["source", "id", "move", "env", "burden", "star", "hypothesis", "detail", "ask", "split", "candidate"]);
  if (x.stars) out.stars = [...x.stars];
  return out;
}
function ruleList(xs, summary = false) {
  if (!Array.isArray(xs) || xs.length > 100) return null;
  const out = xs.map(x => ruleOf(x, summary));
  return out.every(Boolean) ? out : null;
}
const periodPart = x => object(x) && STARS.has(x.star) && plain(x.theme) && plain(x.pillar)
  && optionalText(x, ["description", "action", "baseTheme", "conclusion", "example"])
  ? pick(x, ["star", "theme", "pillar", "description", "action", "baseTheme", "conclusion", "example"]) : null;
function monthOf(x) {
  if (!object(x) || !ymValid(x) || x.key !== `${x.y}-${String(x.m).padStart(2, "0")}` || !STARS.has(x.star)) return null;
  if (![x.theme, x.action, x.pillar].every(plain) || !Number.isInteger(x.last) || x.last < 28 || x.last > 31) return null;
  if (!optionalText(x, ["description", "conclusion", "example", "baseTheme"])) return null;
  if (x.same !== undefined && typeof x.same !== "boolean") return null;
  const b = x.boundary;
  if (!object(b) || !dateValid(x.y, x.m, b.day) || !Number.isInteger(b.hour) || b.hour < 0 || b.hour > 23) return null;
  if (b.minute !== undefined && (!Number.isInteger(b.minute) || b.minute < 0 || b.minute > 59)) return null;
  const before = periodPart(x.before), year = periodPart(x.year);
  if (!before || !year) return null;
  return { ...pick(x, ["key", "y", "m", "last", "star", "theme", "description", "conclusion", "example", "action", "pillar", "same", "baseTheme"]),
    boundary: pick(b, ["day", "hour", "minute"]), before, year };
}
function readingOf(x) {
  if (!object(x) || !FOCUSES.has(x.focus) || ![null, "time", "day"].includes(x.split)) return null;
  if (!object(x.versions) || ![x.versions.calc, x.versions.rules, x.versions.app].every(plain) || !optionalText(x.versions, ["presentation"])) return null;
  if (![x.createdAt, x.consult, x.starLine].every(plain)) return null;
  if (!optionalText(x, ["dayStem", "reason", "headline", "answer", "yearTheme"])) return null;
  if (!Array.isArray(x.candidates) || !x.candidates.length || !x.candidates.every(plain)) return null;
  const summary = x.summary == null ? null : ruleOf(x.summary, true), uniq = ruleList(x.uniq, true);
  if ((x.summary != null && !summary) || !uniq) return null;
  const out = { ...pick(x, ["createdAt", "focus", "consult", "split", "dayStem", "reason", "starLine", "headline", "answer", "yearTheme"]),
    summary, uniq, candidates: [...x.candidates], versions: pick(x.versions, ["calc", "rules", "app", "presentation"]) };
  if (x.split === "day") return out;
  const p = x.period;
  if (!object(p) || !ymValid(p.start) || !ymValid(p.end) || ymIndex(p.end) - ymIndex(p.start) !== 11 || !plain(p.label)) return null;
  if (!Array.isArray(x.months) || x.months.length !== 12) return null;
  const months = x.months.map(monthOf);
  if (!months.every((m, i) => m && ymIndex(m) === ymIndex(p.start) + i)) return null;
  const basics = ruleList(x.basics), combos = ruleList(x.combos), conditional = ruleList(x.conditional);
  if (!basics || !combos || !conditional || !Array.isArray(x.years) || !x.years.length) return null;
  const years = x.years.map(y => {
    const part = periodPart(y);
    if (!part || y.from != null && (!object(y.from) || !dateValid(y.from.y, y.from.m, y.from.d))) return null;
    return { ...part, from: y.from == null ? null : pick(y.from, ["y", "m", "d"]) };
  });
  if (!years.every(Boolean) || !plain(x.headline) || !plain(x.answer) || !plain(x.dayStem)) return null;
  return { ...out, basics, combos, conditional, months, years,
    period: { start: pick(p.start, ["y", "m"]), end: pick(p.end, ["y", "m"]), label: p.label } };
}
function stateOf(x) {
  if (!object(x)) return null;
  const input = x.input == null ? null : inputOf(x.input);
  if (x.input != null && !input) return null;
  const readings = {};
  if (input && object(x.readings)) for (const [key, value] of Object.entries(x.readings)) {
    if (!FOCUSES.has(key)) continue;
    const r = readingOf(value);
    if (r && r.focus === key) readings[key] = r;
  }
  const reading = input ? readingOf(x.reading) : null;
  return { input, focus: FOCUSES.has(x.focus) ? x.focus : null, reading, readings, gridView: x.gridView === true };
}

function get(store, key) { try { return store?.getItem(key) ?? null; } catch { return null; } }
function put(store, key, text) { try { if (!store) return false; store.setItem(key, text); return true; } catch { return false; } }
function remove(store, key) { try { store?.removeItem(key); return true; } catch { return false; } }
function envelope(raw) {
  try {
    const x = JSON.parse(raw);
    if (!object(x) || x.schema !== SCHEMA || !Number.isSafeInteger(x.updatedAt) || x.updatedAt < 0) return null;
    // 世代を持たない旧保存は0。旧削除印はその時刻を削除世代として引き継ぐ。
    const generation = x.generation ?? (x.deleted === true ? x.updatedAt : 0);
    if (!Number.isSafeInteger(generation) || generation < 0) return null;
    if (x.deleted === true) return { schema: SCHEMA, updatedAt: x.updatedAt, generation, deleted: true };
    const data = stateOf(x.data);
    return data ? { schema: SCHEMA, updatedAt: x.updatedAt, generation, data } : null;
  } catch { return null; }
}

export function createStore(local, session) {
  let lastStamp = 0, observedGeneration = 0;
  const latest = () => [envelope(get(local, STORAGE_KEY)), envelope(get(session, STORAGE_KEY))]
    .filter(Boolean).sort((a, b) => b.generation - a.generation || b.updatedAt - a.updatedAt)[0];
  const stamp = () => (lastStamp = Math.max(Date.now(), lastStamp + 1, (latest()?.updatedAt || 0) + 1));
  const saveState = state => {
    const current = latest();
    // 別タブの削除を見ていない古い画面は、保存領域にもfallbackにも書き戻さない。
    // conflict時はloadStateで最新状態を取得してから、その状態を画面へ反映する。
    if ((current?.generation || 0) > observedGeneration) return { persistent: false, conflict: true };
    const data = stateOf(state);
    if (!data) return { persistent: false };
    const text = JSON.stringify({ schema: SCHEMA, updatedAt: stamp(), generation: observedGeneration, data });
    const persistent = put(local, STORAGE_KEY, text);
    const saved = persistent || put(session, STORAGE_KEY, text);
    if (persistent) remove(session, STORAGE_KEY);
    if (saved) remove(session, LEGACY_KEY);
    return { persistent };
  };
  const loadState = () => {
    const current = latest();
    if (current) {
      observedGeneration = current.generation;
      return current.deleted ? null : current.data;
    }
    try {
      const old = JSON.parse(get(session, LEGACY_KEY));
      if (!object(old) || !["app-1.0-beta", "app-1.1-beta", "app-1.2-beta"].includes(old.v)) return null;
      const data = stateOf(old);
      if (!data) return null;
      saveState(data);
      return data;
    } catch { return null; }
  };
  const clearState = () => {
    const updatedAt = stamp();
    observedGeneration = Math.max(updatedAt, (latest()?.generation || 0) + 1);
    const text = JSON.stringify({ schema: SCHEMA, updatedAt, generation: observedGeneration, deleted: true });
    // 個人情報を消してから、小さな削除印を残す。別タブの古いセッションを再移行しない。
    const localRemoved = remove(local, STORAGE_KEY);
    const localMarked = put(local, STORAGE_KEY, text);
    const sessionRemoved = remove(session, STORAGE_KEY);
    const legacyRemoved = remove(session, LEGACY_KEY);
    const sessionMarked = put(session, STORAGE_KEY, text);
    return { cleared: (localRemoved || localMarked) && (sessionRemoved || sessionMarked) && legacyRemoved };
  };
  return { loadState, saveState, clearState };
}
const browserStorage = key => { try { return globalThis[key] ?? null; } catch { return null; } };
const browserStore = createStore(browserStorage("localStorage"), browserStorage("sessionStorage"));
export const loadState = () => browserStore.loadState();
export const saveState = state => browserStore.saveState(state);
export const clearState = () => browserStore.clearState();
