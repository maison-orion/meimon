// 夜空版の文字色と背景の比率を計算する（WCAGの相対輝度）。半透明の面は夜の紺に重ねた色で計算。
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const over = (fg, a, bg) => fg.map((c, i) => Math.round(c * a + bg[i] * (1 - a)));
const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const night = hex("#101a30"), top = hex("#21324a");
const panel = over([25, 40, 62], 0.62, top); // 最も明るい上部に重ねた場合（厳しい側）
const quiet = over([101, 122, 142], 0.14, top);
const nowRow = over([184, 155, 98], 0.08, top);
const C = { moon: hex("#e7edf0"), sub: hex("#b3bfcd"), gold: hex("#b89b62"), goldSoft: hex("#dfc995"), shu: hex("#b89b62"), err: hex("#ff9b8f"), field: hex("#8391b8"), focus: hex("#9cc3ff") };
const rows = [
  ["本文/夜", C.moon, night, 4.5], ["本文/上部の紺", C.moon, top, 4.5], ["補助文字/上部の紺", C.sub, top, 4.5], ["補助文字/カード", C.sub, panel, 4.5],
  ["補助文字/紫の面", C.sub, quiet, 4.5], ["金の見出し/上部の紺", C.gold, top, 4.5], ["回答の金/カード", C.goldSoft, panel, 4.5],
  ["主ボタン文字(夜)/金", night, C.gold, 4.5], ["今月タグ文字/朱", hex("#0c1425"), C.shu, 4.5], ["エラー/上部の紺", C.err, top, 4.5],
  ["補助文字/今月の行", C.sub, nowRow, 4.5], ["入力枠/上部の紺", C.field, top, 3], ["フォーカス/上部の紺", C.focus, top, 3], ["朱の見本帯/夜", C.shu, night, 4.5],
];
let ng = 0;
for (const [name, f, b, min] of rows) { const r = ratio(f, b); if (r < min) ng++; console.log(`${r >= min ? "ok" : "NG"} ${r.toFixed(2)}:1（目標${min}）${name}`); }
process.exitCode = ng ? 1 : 0;
