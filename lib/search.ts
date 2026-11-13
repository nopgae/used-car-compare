// 검색 화면의 URL 쿼리를 SQL WHERE 절과 파라미터로 바꾼다. 낙찰된(가격 있는) 건만 대상.

export type SearchParams = Record<string, string | string[] | undefined>;

export const SORTS = {
  recent: "opened_at DESC",
  price_asc: "price_won ASC",
  price_desc: "price_won DESC",
  year_desc: "year DESC, opened_at DESC",
  km_asc: "mileage_km ASC",
} as const;
export type SortKey = keyof typeof SORTS;

export const PAGE_SIZE = 50;

export type Query = {
  where: string;
  params: (string | number)[];
  orderBy: string;
  page: number;
  filters: Record<string, string>; // 폼에 다시 채울 값
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const num = (v: string) => (/^\d+$/.test(v) ? Number(v) : null);

export function buildQuery(sp: SearchParams): Query {
  const f = Object.fromEntries(
    ["maker", "category", "model", "yearMin", "yearMax", "kmMax", "priceMin", "priceMax", "sort", "page"].map((k) => [k, one(sp[k])]),
  );
  const where = ["status_cd = '0010'", "price_won IS NOT NULL"];
  const params: (string | number)[] = [];
  const add = (sql: string, v: string | number) => {
    where.push(sql);
    params.push(v);
  };

  if (f.maker) add("maker = ?", f.maker);
  if (f.category) add("category = ?", f.category);
  if (f.model) {
    // model_key는 공백을 뺀 값이라 입력도 공백을 빼고 비교한다
    where.push("(model_key LIKE ? OR name LIKE ?)");
    params.push(`%${f.model.replace(/\s+/g, "")}%`, `%${f.model}%`);
  }
  const yearMin = num(f.yearMin), yearMax = num(f.yearMax), kmMax = num(f.kmMax);
  const priceMin = num(f.priceMin), priceMax = num(f.priceMax); // 만원 단위 입력
  if (yearMin !== null) add("year >= ?", yearMin);
  if (yearMax !== null) add("year <= ?", yearMax);
  if (kmMax !== null) add("mileage_km <= ?", kmMax);
  if (priceMin !== null) add("price_won >= ?", priceMin * 10_000);
  if (priceMax !== null) add("price_won <= ?", priceMax * 10_000);

  const sort: SortKey = f.sort in SORTS ? (f.sort as SortKey) : "recent";
  f.sort = sort;
  const page = Math.max(1, num(f.page) ?? 1);
  return { where: where.join(" AND "), params, orderBy: SORTS[sort], page, filters: f };
}
