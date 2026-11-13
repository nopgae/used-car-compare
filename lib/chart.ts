// 선 차트 축 계산: 0부터 시작하는 깔끔한 눈금(1·2·5 × 10^k)
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => +(i * step).toFixed(10));
}


// 원본 이상값(전체 중앙값의 3배 초과 또는 1/3 미만)을 찾아낸다. 고치지 않고 차트에서 비우는 데 쓴다.
export function outliers(values: number[]): Set<number> {
  const s = [...values].sort((a, b) => a - b);
  const mid = s[s.length >> 1];
  return new Set(values.map((v, i) => (v > mid * 3 || v < mid / 3 ? i : -1)).filter((i) => i >= 0));
}

// 10,000 이상은 "만" 단위로 짧게 (축 눈금용)
export const compact = (v: number) => (v >= 10_000 ? `${(v / 10_000).toLocaleString("ko-KR")}만` : v.toLocaleString("ko-KR"));
