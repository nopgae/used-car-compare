import { describe, expect, it } from "vitest";
import type { Bid } from "./data.ts";
import { counts, readFilters, search } from "./search.ts";

const bid = (o: Partial<Bid>): Bid => ({
  id: "x~1", opened: "2026-10-01 10:00", name: "", category: "승용차", maker: "기아", model: "카니발", group: "카니발", special: false,
  year: 2016, km: 100_000, cc: null, fuel: null, property: null, appraisal: null, minBid: null, price: 5_000_000, bidders: 1, round: "1", ...o,
});
const bids = [
  bid({ id: "a~1", model: "그랜드 스타렉스", group: "그랜드스타렉스", maker: "현대", price: 7_000_000, opened: "2026-10-03 10:00" }),
  bid({ id: "b~1", year: 2012, price: 3_000_000, opened: "2026-10-02 10:00" }),
  bid({ id: "c~1", year: 2018, km: null, price: 9_000_000, opened: "2026-10-01 10:00" }),
];
const f = (q: Record<string, string>) => readFilters((k) => q[k] ?? null);

describe("search", () => {
  it("빈 검색은 전체, 최신순", () => {
    expect(search(bids, f({})).rows.map((b) => b.id)).toEqual(["a~1", "b~1", "c~1"]);
  });

  it("모델은 공백을 무시하고, 가격은 만원 단위", () => {
    expect(search(bids, f({ model: "그랜드스타렉스" })).rows.map((b) => b.id)).toEqual(["a~1"]);
    expect(search(bids, f({ maker: "기아", priceMax: "500" })).rows.map((b) => b.id)).toEqual(["b~1"]);
  });

  it("값이 없는 차는 범위 조건에서 빠지고, 숫자가 아닌 입력과 모르는 정렬은 무시", () => {
    expect(search(bids, f({ kmMax: "200000" })).total).toBe(2);
    expect(search(bids, f({ yearMin: "abc", sort: "x;--", page: "-1" })).total).toBe(3);
    expect(search(bids, f({ sort: "price_asc" })).rows[0].id).toBe("b~1");
  });

  it("범위를 넘는 쪽 번호는 마지막 쪽으로", () => {
    expect(search(bids, f({ page: "999" })).page).toBe(1);
  });

  it("선택지 건수", () => {
    expect(counts(bids, "maker")).toEqual([["기아", 2], ["현대", 1]]);
  });
});
