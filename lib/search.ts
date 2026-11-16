// 검색 화면의 URL 쿼리를 낙찰 목록 필터·정렬로 바꾼다(브라우저에서 실행).
import type { Bid } from "./data.ts";

export const SORTS = {
  recent: (a: Bid, b: Bid) => b.opened.localeCompare(a.opened),
  price_asc: (a: Bid, b: Bid) => a.price - b.price,
  price_desc: (a: Bid, b: Bid) => b.price - a.price,
  year_desc: (a: Bid, b: Bid) => (b.year ?? 0) - (a.year ?? 0) || b.opened.localeCompare(a.opened),
  km_asc: (a: Bid, b: Bid) => (a.km ?? Infinity) - (b.km ?? Infinity),
} as const;
export type SortKey = keyof typeof SORTS;

export const PAGE_SIZE = 50;
export const FILTER_KEYS = ["maker", "category", "model", "yearMin", "yearMax", "kmMax", "priceMin", "priceMax", "sort", "page"] as const;
export type Filters = Record<(typeof FILTER_KEYS)[number], string>;

const num = (v: string) => (/^\d+$/.test(v) ? Number(v) : null);

export function readFilters(get: (k: string) => string | null): Filters {
  const f = Object.fromEntries(FILTER_KEYS.map((k) => [k, get(k)?.trim() ?? ""])) as Filters;
  if (!(f.sort in SORTS)) f.sort = "recent";
  return f;
}

export function search(bids: Bid[], f: Filters): { total: number; page: number; pages: number; rows: Bid[] } {
  const model = f.model.replace(/\s+/g, "");
  const yearMin = num(f.yearMin), yearMax = num(f.yearMax), kmMax = num(f.kmMax);
  const priceMin = num(f.priceMin), priceMax = num(f.priceMax); // 만원 단위 입력
  const hit = bids.filter(
    (b) =>
      (!f.maker || b.maker === f.maker) &&
      (!f.category || b.category === f.category) &&
      (!model || `${b.model ?? ""}${b.group ?? ""}${b.name}`.replace(/\s+/g, "").includes(model)) &&
      (yearMin === null || (b.year !== null && b.year >= yearMin)) &&
      (yearMax === null || (b.year !== null && b.year <= yearMax)) &&
      (kmMax === null || (b.km !== null && b.km <= kmMax)) &&
      (priceMin === null || b.price >= priceMin * 10_000) &&
      (priceMax === null || b.price <= priceMax * 10_000),
  );
  hit.sort(SORTS[f.sort as SortKey]);
  const pages = Math.max(1, Math.ceil(hit.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, num(f.page) ?? 1));
  return { total: hit.length, page, pages, rows: hit.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}

// 제조사·차종 선택지(건수 많은 순)
export function counts(bids: Bid[], key: "maker" | "category"): [string, number][] {
  const m = new Map<string, number>();
  for (const b of bids) if (b[key]) m.set(b[key]!, (m.get(b[key]!) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
}
