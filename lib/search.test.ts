import { describe, expect, it } from "vitest";
import { buildQuery } from "./search.ts";

describe("buildQuery", () => {
  it("빈 검색은 낙찰 건 전체, 최신순", () => {
    const q = buildQuery({});
    expect(q.where).toBe("status_cd = '0010' AND price_won IS NOT NULL");
    expect(q.params).toEqual([]);
    expect(q.orderBy).toBe("opened_at DESC");
    expect(q.page).toBe(1);
  });

  it("필터를 파라미터로 넘기고 가격은 만원→원으로 바꾼다", () => {
    const q = buildQuery({ maker: "기아", model: "그랜드 스타렉스", yearMin: "2015", priceMax: "500", sort: "price_asc", page: "3" });
    expect(q.where).toContain("maker = ?");
    expect(q.params).toEqual(["기아", "%그랜드스타렉스%", "%그랜드 스타렉스%", 2015, 5_000_000]);
    expect(q.orderBy).toBe("price_won ASC");
    expect(q.page).toBe(3);
  });

  it("숫자가 아닌 값과 모르는 정렬은 무시한다(SQL에 문자열을 끼우지 않는다)", () => {
    const q = buildQuery({ yearMin: "2015; DROP TABLE bids", sort: "name; --", page: "-1" });
    expect(q.params).toEqual([]);
    expect(q.orderBy).toBe("opened_at DESC");
    expect(q.page).toBe(1);
  });
});
