import { describe, expect, it } from "vitest";
import { median, parseIds } from "./compare.ts";

describe("parseIds", () => {
  it("형식이 맞는 id만, 중복 없이, 최대 3개", () => {
    expect(
      parseIds({ id: ["2026-1000-057931~6253935", "bad", "2026-1000-057931~6253935", "A~1", "B~2", "C~3"] }),
    ).toEqual([["2026-1000-057931", 6253935], ["A", 1], ["B", 2]]);
  });

  it("id가 하나거나 없으면", () => {
    expect(parseIds({ id: "X~9" })).toEqual([["X", 9]]);
    expect(parseIds({})).toEqual([]);
  });
});

describe("median", () => {
  it("홀수·짝수·빈 배열", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
