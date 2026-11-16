import type { Scored } from "./data.ts";

// 마감 전에 남긴 예측과 실제 낙찰가 비교
export function scorecard(rows: Scored[]) {
  if (rows.length === 0) return null;
  const ape = rows.map((r) => Math.abs(r.predicted - r.actual) / r.actual).sort((a, b) => a - b);
  return {
    n: rows.length,
    medianApe: ape[ape.length >> 1],
    within20: ape.filter((v) => v <= 0.2).length / rows.length,
    inBand: rows.filter((r) => r.actual >= r.low && r.actual <= r.high).length / rows.length,
  };
}
