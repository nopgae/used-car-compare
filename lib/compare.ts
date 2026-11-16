type SearchParams = Record<string, string | string[] | undefined>;

export const MAX_COMPARE = 3;

// 비교 대상 id는 "물건관리번호~공매조건번호". URL에서 오므로 형식을 확인하고 앞의 3개만 쓴다.
export function parseIds(sp: SearchParams): [string, number][] {
  const raw = sp.id === undefined ? [] : Array.isArray(sp.id) ? sp.id : [sp.id];
  const out: [string, number][] = [];
  for (const v of raw) {
    const m = /^([^~]{1,80})~(\d{1,18})$/.exec(v);
    if (m && !out.some(([c, p]) => c === m[1] && p === Number(m[2]))) out.push([m[1], Number(m[2])]);
    if (out.length === MAX_COMPARE) break;
  }
  return out;
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
