// 한국교통안전공단 자동차 성능점검 건수(전국, 월별)를 monthly_stats에 upsert한다.
// 사용: npm run ingest:stats -- [시작 YYYY-MM, 기본 2018-01]
import mysql from "mysql2/promise";

const API = "https://apis.data.go.kr/B553881/prfomncChckInfoService_01/getprfomncChckInfoService";
const key = process.env.DATA_GO_KR_KEY;
if (!key || !process.env.DATABASE_URL) throw new Error("DATA_GO_KR_KEY, DATABASE_URL을 .env에 넣어야 합니다");

// 응답은 resultType과 상관없이 XML이다: <resultCode>00</resultCode> ... <dtaCo>101274</dtaCo>
async function count(y: number, m: number): Promise<number> {
  const qs = new URLSearchParams({ serviceKey: key!, registYy: String(y), registMt: String(m).padStart(2, "0") });
  for (let attempt = 1; ; attempt++) {
    try {
      const xml = await (await fetch(`${API}?${qs}`)).text();
      const code = /<resultCode>(\d+)<\/resultCode>/.exec(xml)?.[1];
      const n = /<dtaCo>(\d+)<\/dtaCo>/.exec(xml)?.[1];
      if (code !== "00" || n === undefined) throw new Error(xml.slice(0, 200));
      return Number(n);
    } catch (e) {
      if (attempt >= 3) throw new Error(`${y}-${m} 실패: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

const [from = "2018-01"] = process.argv.slice(2);
const now = new Date();
const db = await mysql.createConnection(process.env.DATABASE_URL!);
try {
  for (let d = new Date(`${from}-01T00:00:00Z`); d <= now; d.setUTCMonth(d.getUTCMonth() + 1)) {
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    const n = await count(y, m);
    await db.query("INSERT INTO monthly_stats (metric, ym, value) VALUES ('performance_checks', ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [ym, n]);
    console.log(ym, n);
  }
} finally {
  await db.end();
}
