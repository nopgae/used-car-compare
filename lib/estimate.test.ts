import { describe, expect, it } from "vitest";
import { baseline, features, fit, predict, solve, type Sale } from "./estimate.ts";

describe("solve", () => {
  it("정확히 맞는 선형식을 복원한다", () => {
    const X = [[1, 0], [1, 1], [1, 2], [1, 3]];
    const coef = solve(X, [1, 3, 5, 7]);
    expect(coef[0]).toBeCloseTo(1, 4);
    expect(coef[1]).toBeCloseTo(2, 4);
  });
});

describe("fit / predict", () => {
  // 차령 1년마다 10%, 주행거리 2배마다 약 13% 떨어지는 가상의 시장(노이즈 없음)
  const truth = (year: number, km: number, soldAt: Date) => {
    const [, age, lkm] = features(year, km, soldAt);
    return Math.exp(Math.log(2e7) - 0.1 * age - 0.2 * (lkm - Math.log(1e5)));
  };
  const sales: Sale[] = [];
  for (let i = 0; i < 60; i++) {
    const year = 2008 + (i % 12), km = 30_000 + ((i * 7919) % 200_000), soldAt = new Date(Date.UTC(2019 + (i % 7), i % 12, 1));
    sales.push({ year, km, soldAt, price: truth(year, km, soldAt) });
  }

  it("학습 건수가 모자라면 추정하지 않는다", () => {
    expect(fit(sales.slice(0, 10))).toBeNull();
  });

  it("규칙대로 만든 가격을 되맞힌다", () => {
    const f = fit(sales)!;
    const at = new Date(Date.UTC(2026, 0, 1));
    const p = predict(f, 2016, 80_000, at);
    expect(p.price / truth(2016, 80_000, at)).toBeCloseTo(1, 3);
    expect(p.low).toBeLessThanOrEqual(p.price);
    expect(p.high).toBeGreaterThanOrEqual(p.price);
  });
});

describe("baseline", () => {
  it("연식 ±2년 평균, 없으면 null", () => {
    const s = (year: number, price: number): Sale => ({ year, price, km: 1, soldAt: new Date() });
    expect(baseline([s(2010, 100), s(2012, 200), s(2015, 999)], 2011)).toBe(150);
    expect(baseline([s(2000, 100)], 2011)).toBeNull();
  });
});
