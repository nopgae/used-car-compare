import { describe, expect, it } from "vitest";
import { compact, niceTicks, outliers } from "./chart.ts";

describe("niceTicks", () => {
  it("0부터 데이터 최댓값을 덮는 깔끔한 눈금", () => {
    expect(niceTicks(950)).toEqual([0, 500, 1000]);
    expect(niceTicks(125_257)).toEqual([0, 50_000, 100_000, 150_000]);
    expect(niceTicks(1.3)).toEqual([0, 0.5, 1, 1.5]);
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});

describe("outliers / compact", () => {
  it("중앙값에서 크게 벗어난 달만 고른다", () => {
    expect([...outliers([100, 120, 15_926, 110, 4, 130])]).toEqual([2, 4]);
    expect(outliers([1, 1, 1]).size).toBe(0);
  });
  it("축 눈금을 짧게", () => {
    expect(compact(150_000)).toBe("15만");
    expect(compact(5_000)).toBe("5,000");
  });
});
