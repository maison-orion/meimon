// LINEの友だち追加URLが確定したら設定する。出生情報・診断結果をURLに追加しない。
export const SERVICE = Object.freeze({ lineFriendUrl: "" });
export function lineUrl(value = SERVICE.lineFriendUrl) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (url.hostname !== 'lin.ee' && url.hostname !== 'line.me') return null;
    if (url.pathname === '/') return null;
    return url.href;
  } catch { return null; }
}
