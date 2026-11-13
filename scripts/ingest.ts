// 온비드 차량 입찰결과를 월 단위로 받아 MySQL bids 테이블에 upsert한다.
// 사용: npm run ingest -- [시작 YYYY-MM, 기본 2018-01] [끝 YYYY-MM, 기본 이번 달]
import mysql from "mysql2/promise";
import { toRow, type BidRow, type OnbidItem } from "../lib/onbid.ts";

const API = "https://apis.data.go.kr/B010003/OnbidCltrBidRsltListSrvc2/getCltrBidRsltList2";
const ALL_PROPERTY_TYPES = "0002,0003,0004,0005,0006,0007,0008,0010,0011,0013";
const PAGE = 500;

const key = process.env.DATA_GO_KR_KEY;
const dbUrl = process.env.DATABASE_URL;
if (!key || !dbUrl) throw new Error("DATA_GO_KR_KEY, DATABASE_URL을 .env에 넣어야 합니다");

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

async function fetchPage(from: string, to: string, page: number): Promise<{ total: number; items: OnbidItem[] }> {
  const params = new URLSearchParams({
    serviceKey: key!, pageNo: String(page), numOfRows: String(PAGE), resultType: "json",
    cltrTypeCd: "0002", prptDivCd: ALL_PROPERTY_TYPES, opbdDtStart: from, opbdDtEnd: to,
  });
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${API}?${params}`);
      const body = await res.json();
      if (body?.header?.resultCode !== "00") throw new Error(JSON.stringify(body?.result ?? body?.header));
      const item = body.body.items?.item ?? [];
      return { total: body.body.totalCount, items: Array.isArray(item) ? item : [item] };
    } catch (e) {
      if (attempt >= 3) throw new Error(`${from}~${to} p${page} 실패: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

const COLS: (keyof BidRow)[] = [
  "cltr_mng_no", "pbct_cdtn_no", "name", "category", "maker", "model", "model_key", "model_group", "is_special", "year", "mileage_km",
  "displacement_cc", "fuel", "property_type", "appraisal_won", "min_bid_won", "price_won", "status_cd",
  "status", "round_no", "bidders", "opened_at",
];
const UPSERT = `INSERT INTO bids (${COLS.join(",")}) VALUES ? ON DUPLICATE KEY UPDATE ${COLS.slice(2)
  .map((c) => `${c}=VALUES(${c})`).join(",")}`;

const [fromArg = "2018-01", toArg] = process.argv.slice(2);
const now = new Date();
const yesterday = new Date(now.getTime() - 86400_000);
const end = toArg ? new Date(`${toArg}-01T00:00:00Z`) : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

const db = await mysql.createConnection(dbUrl);
let calls = 0, saved = 0, skipped = 0;
try {
  for (let m = new Date(`${fromArg}-01T00:00:00Z`); m <= end; m.setUTCMonth(m.getUTCMonth() + 1)) {
    const last = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0));
    const to = last < yesterday ? last : yesterday; // 개찰일은 오늘 이전만 조회된다
    if (to < m) break;
    let page = 1, seen = 0, total = 0;
    do {
      const r = await fetchPage(ymd(m), ymd(to), page++);
      calls++;
      total = r.total;
      seen += r.items.length;
      const rows = r.items.map((it) => toRow(it)).filter((x): x is BidRow => x !== null);
      skipped += r.items.length - rows.length;
      if (rows.length) {
        await db.query(UPSERT, [rows.map((row) => COLS.map((c) => row[c]))]).catch((e) => {
          throw new Error(`${ymd(m).slice(0, 6)} 저장 실패: ${e.sqlMessage ?? e.message}`); // SQL 전문은 너무 길어 메시지만
        });
      }
      saved += rows.length;
      if (r.items.length === 0) break;
    } while (seen < total);
    console.log(`${ymd(m).slice(0, 6)}: ${total}건`);
  }
} finally {
  await db.end();
}
console.log(`API 호출 ${calls}회, 저장 ${saved}건, 제외(장비·불량) ${skipped}건`);
