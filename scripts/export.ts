// MySQL → 정적 사이트용 JSON(public/data). 빌드 직전에 돌린다.
import { mkdir, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { BID_COLS, type BidsFile, type GroupModel, type LiveFile, type ModelsFile } from "../lib/data.ts";
import { fit, MIN_TRAIN, SALES_WHERE, type Sale } from "../lib/estimate.ts";

const db = await mysql.createConnection({ uri: process.env.DATABASE_URL, dateStrings: true });
const generatedAt = new Date().toISOString();
const num = (v: unknown) => (v == null ? null : Number(v));

const [bids] = await db.query<mysql.RowDataPacket[]>(
  `SELECT CONCAT(cltr_mng_no, '~', pbct_cdtn_no) id, LEFT(opened_at, 16) opened, name, category, maker, model, model_group,
          is_special, year, mileage_km, displacement_cc, fuel, property_type, appraisal_won, min_bid_won, price_won, bidders, round_no
   FROM bids WHERE status_cd = '0010' AND price_won IS NOT NULL ORDER BY opened_at DESC`,
);
const bidsFile: BidsFile = {
  generatedAt,
  cols: BID_COLS,
  rows: bids.map((b) => [
    b.id, b.opened, b.name, b.category, b.maker, b.model, b.model_group, b.is_special ? 1 : 0, b.year, b.mileage_km,
    b.displacement_cc, b.fuel, b.property_type, num(b.appraisal_won), num(b.min_bid_won), num(b.price_won), b.bidders, b.round_no,
  ]),
};

const [sales] = await db.query<mysql.RowDataPacket[]>(
  `SELECT model_group g, price_won p, year y, mileage_km km, opened_at t FROM bids WHERE ${SALES_WHERE}`,
);
const byGroup = new Map<string, Sale[]>();
for (const s of sales) byGroup.set(s.g, [...(byGroup.get(s.g) ?? []), { price: Number(s.p), year: s.y, km: s.km, soldAt: new Date(`${s.t}Z`) }]);
const groups: GroupModel[] = [...byGroup]
  .filter(([, s]) => s.length >= MIN_TRAIN)
  .map(([group, s]) => ({ group, ...fit(s)! }))
  .map(({ group, n, coef, sd }) => ({ group, n, coef: coef.map((c) => +c.toFixed(6)), sd: +sd.toFixed(4) }))
  .sort((a, b) => a.group.localeCompare(b.group, "ko"));
const modelsFile: ModelsFile = { generatedAt, groups };

const [live] = await db.query<mysql.RowDataPacket[]>(
  `SELECT CONCAT(cltr_mng_no, '~', pbct_cdtn_no) id, name, category, model_group, is_special, year, mileage_km, region, org,
          property_type, appraisal_won, min_bid_won, failed_rounds, LEFT(bid_end_at, 16) bid_end,
          predicted_won, predicted_low, predicted_high
   FROM listings WHERE bid_end_at >= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 9 HOUR) ORDER BY bid_end_at`,
);
// 예측을 남긴 회차가 낙찰되면 채점한다(같은 물건관리번호+공매조건번호)
const [scored] = await db.query<mysql.RowDataPacket[]>(
  `SELECT CONCAT(l.cltr_mng_no, '~', l.pbct_cdtn_no) id, l.name, l.model_group, LEFT(b.opened_at, 16) opened,
          l.predicted_won, l.predicted_low, l.predicted_high, b.price_won, LEFT(l.predicted_at, 16) predicted_at
   FROM listings l JOIN bids b ON b.cltr_mng_no = l.cltr_mng_no AND b.pbct_cdtn_no = l.pbct_cdtn_no
   WHERE l.predicted_won IS NOT NULL AND b.status_cd = '0010' AND b.price_won IS NOT NULL AND l.predicted_at < b.opened_at
   ORDER BY b.opened_at DESC`,
);
const [runs] = await db.query<mysql.RowDataPacket[]>(
  "SELECT job, LEFT(started_at, 16) at, api_calls, row_count, error FROM ingest_runs ORDER BY id DESC LIMIT 30",
);
const liveFile: LiveFile = {
  generatedAt,
  listings: live.map((l) => ({
    id: l.id, name: l.name, category: l.category, group: l.model_group, special: !!l.is_special, year: l.year, km: l.mileage_km,
    region: l.region, org: l.org, property: l.property_type, appraisal: num(l.appraisal_won), minBid: num(l.min_bid_won),
    failedRounds: l.failed_rounds, bidEnd: l.bid_end, predicted: num(l.predicted_won), low: num(l.predicted_low), high: num(l.predicted_high),
  })),
  scored: scored.map((s) => ({
    id: s.id, name: s.name, group: s.model_group, opened: s.opened, predicted: Number(s.predicted_won), low: Number(s.predicted_low),
    high: Number(s.predicted_high), actual: Number(s.price_won), predictedAt: s.predicted_at,
  })),
  runs: runs.map((r) => ({ job: r.job, at: r.at, calls: r.api_calls, rows: r.row_count, error: r.error })),
};
await db.end();

await mkdir("public/data", { recursive: true });
for (const [name, data] of [["bids", bidsFile], ["models", modelsFile], ["live", liveFile]] as const) {
  const json = JSON.stringify(data);
  await writeFile(`public/data/${name}.json`, json);
  console.log(`${name}.json ${(json.length / 1024 / 1024).toFixed(1)}MB`);
}
console.log(`낙찰 ${bids.length}건, 모델 계열 ${groups.length}개, 진행 중 ${live.length}건, 채점 ${scored.length}건`);
