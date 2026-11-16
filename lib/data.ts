// 정적 사이트가 읽는 JSON의 모양. scripts/export.ts가 만들고 브라우저 쪽 화면이 읽는다.

// 낙찰 한 건. JSON 용량을 줄이려고 배열로 내보내고(BID_COLS 순서) 읽을 때 객체로 바꾼다.
export const BID_COLS = [
  "id", "opened", "name", "category", "maker", "model", "group", "special", "year", "km", "cc", "fuel",
  "property", "appraisal", "minBid", "price", "bidders", "round",
] as const;

export type Bid = {
  id: string; opened: string; name: string; category: string | null; maker: string | null; model: string | null;
  group: string | null; special: boolean; year: number | null; km: number | null; cc: number | null; fuel: string | null;
  property: string | null; appraisal: number | null; minBid: number | null; price: number; bidders: number | null; round: string | null;
};

export type BidsFile = { generatedAt: string; cols: typeof BID_COLS; rows: unknown[][] };

export function decodeBids(file: BidsFile): Bid[] {
  return file.rows.map((r) => Object.fromEntries(file.cols.map((c, i) => [c, c === "special" ? r[i] === 1 : r[i]])) as Bid);
}

export type GroupModel = { group: string; n: number; coef: number[]; sd: number };
export type ModelsFile = { generatedAt: string; groups: GroupModel[] };

export type Listing = {
  id: string; name: string; category: string | null; group: string | null; special: boolean; year: number | null; km: number | null;
  region: string | null; org: string | null; property: string | null; appraisal: number | null; minBid: number | null;
  failedRounds: number | null; bidEnd: string | null; predicted: number | null; low: number | null; high: number | null;
};

// 예측했던 물건이 마감·낙찰된 뒤의 채점 한 줄
export type Scored = {
  id: string; name: string; group: string; opened: string; predicted: number; low: number; high: number; actual: number; predictedAt: string;
};

export type LiveFile = { generatedAt: string; listings: Listing[]; scored: Scored[]; runs: { job: string; at: string; calls: number; rows: number; error: string | null }[] };

export const DATA_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data`;
