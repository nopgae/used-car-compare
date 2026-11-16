// 진행 중 차량 공매를 모두 받아 listings에 upsert하고, 처음 보는 물건에는 그 시점의 예상 낙찰가를 기록한다.
// 사용: npm run snapshot
import mysql from "mysql2/promise";
import { fit, LOT_OR_SCRAP, predict, SALES_WHERE, type Fit } from "../lib/estimate.ts";
import { toListing, type ListingRow, type OnbidItem } from "../lib/onbid.ts";
import { logged } from "../lib/runs.ts";

const API = "https://apis.data.go.kr/B010003/OnbidCarListSrvc2/getCarCltrList2";
const ALL_PROPERTY_TYPES = "0002,0003,0004,0005,0006,0007,0008,0010,0011,0013";
const PAGE = 500;
const key = process.env.DATA_GO_KR_KEY;
if (!key || !process.env.DATABASE_URL) throw new Error("DATA_GO_KR_KEY, DATABASE_URL을 .env에 넣어야 합니다");

async function fetchPage(page: number): Promise<{ total: number; items: OnbidItem[] }> {
  const qs = new URLSearchParams({
    serviceKey: key!, pageNo: String(page), numOfRows: String(PAGE), resultType: "json", prptDivCd: ALL_PROPERTY_TYPES, pvctTrgtYn: "N",
  });
  for (let attempt = 1; ; attempt++) {
    try {
      const body = await (await fetch(`${API}?${qs}`)).json();
      if (body?.header?.resultCode !== "00") throw new Error(JSON.stringify(body?.result ?? body?.header));
      const item = body.body.items?.item ?? [];
      return { total: body.body.totalCount, items: Array.isArray(item) ? item : [item] };
    } catch (e) {
      if (attempt >= 3) throw new Error(`목록 p${page} 실패: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

const COLS: (keyof ListingRow)[] = [
  "cltr_mng_no", "pbct_cdtn_no", "name", "category", "car_type", "maker", "model", "model_group", "is_special", "year",
  "mileage_km", "fuel", "color", "region", "org", "property_type", "appraisal_won", "min_bid_won", "failed_rounds",
  "bid_start_at", "bid_end_at",
];
const PRED = ["predicted_won", "predicted_low", "predicted_high", "predicted_n", "predicted_at"];
// 예측 컬럼은 UPDATE 목록에 없다 → 처음 넣은 값이 유지된다
const UPSERT = `INSERT INTO listings (${[...COLS, "first_seen_at", "last_seen_at", ...PRED].join(",")}) VALUES ?
  ON DUPLICATE KEY UPDATE ${[...COLS.slice(2), "last_seen_at"].map((c) => `${c}=VALUES(${c})`).join(",")}`;

const db = await mysql.createConnection({ uri: process.env.DATABASE_URL, dateStrings: true });
try {
  await logged(db, "snapshot", async () => {
    let calls = 0, page = 1, seen = 0, total = 0;
    const listings: ListingRow[] = [];
    do {
      const r = await fetchPage(page++);
      calls++;
      total = r.total;
      seen += r.items.length;
      listings.push(...r.items.map((it) => toListing(it)).filter((x): x is ListingRow => x !== null));
      if (r.items.length === 0) break;
    } while (seen < total);

    // 일반 차량만, 계열별로 지금까지의 낙찰로 학습
    const [sales] = await db.query<mysql.RowDataPacket[]>(
      `SELECT model_group g, price_won p, year y, mileage_km km, opened_at t FROM bids WHERE ${SALES_WHERE}`,
    );
    const byGroup = new Map<string, { price: number; year: number; km: number; soldAt: Date }[]>();
    for (const s of sales) byGroup.set(s.g, [...(byGroup.get(s.g) ?? []), { price: Number(s.p), year: s.y, km: s.km, soldAt: new Date(`${s.t}Z`) }]);
    const fits = new Map<string, Fit | null>();
    const now = new Date();
    // API 시각(개찰·마감)이 한국 시간이라 저장 시각도 한국 시간으로 맞춘다
    const nowSql = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 19).replace("T", " ");

    const rows = listings.map((l) => {
      let pred: (number | string | null)[] = [null, null, null, null, null];
      if (!l.is_special && !LOT_OR_SCRAP.test(l.name) && l.model_group && l.year !== null && l.mileage_km !== null) {
        if (!fits.has(l.model_group)) fits.set(l.model_group, fit(byGroup.get(l.model_group) ?? []));
        const f = fits.get(l.model_group);
        // 마감 시점 시세로 예측. 학습 쪽(opened_at)과 같은 방식으로 한국 시각을 그대로 읽는다
        const at = l.bid_end_at ? new Date(`${l.bid_end_at}Z`) : now;
        if (f) {
          const p = predict(f, l.year, l.mileage_km, at);
          pred = [Math.round(p.price), Math.round(p.low), Math.round(p.high), f.n, nowSql];
        }
      }
      return [...COLS.map((c) => l[c]), nowSql, nowSql, ...pred];
    });
    if (rows.length) await db.query(UPSERT, [rows]);
    const predicted = rows.filter((r) => r[r.length - 5] !== null).length;
    console.log(`진행 중 ${total}건, 저장 ${rows.length}건(장비 제외), 예측 가능 ${predicted}건, API ${calls}회`);
    return { calls, rows: rows.length };
  });
} finally {
  await db.end();
}
