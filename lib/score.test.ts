import { describe, expect, it } from "vitest";
import { scorecard } from "./score.ts";

const row = (predicted: number, actual: number) => ({ id: "", name: "", group: "", opened: "", predictedAt: "", predicted, actual, low: predicted * 0.7, high: predicted * 1.3 });

describe("scorecard", () => {
  it("오차 중앙값·±20% 비율·80% 범위 적중률", () => {
    const s = scorecard([row(100, 100), row(100, 125), row(100, 200)])!;
    expect(s.n).toBe(3);
    expect(s.medianApe).toBeCloseTo(0.2);
    expect(s.within20).toBeCloseTo(2 / 3);
    expect(s.inBand).toBeCloseTo(2 / 3);
  });
  it("채점할 게 없으면 null", () => {
    expect(scorecard([])).toBeNull();
  });
});
