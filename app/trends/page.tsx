import type { RowDataPacket } from "mysql2";
import { db } from "../../lib/db";
import { median } from "../../lib/compare";
import { compact, outliers } from "../../lib/chart";
import { LineChart } from "./LineChart";

// 통계는 하루 단위로 바뀌므로 1시간마다 다시 만든다(ISR)
export const revalidate = 3600;

const fmtInt = (v: number) => Math.round(v).toLocaleString("ko-KR");

export default async function TrendsPage() {
  const thisMonth = new Date().toISOString().slice(0, 7); // 진행 중인 달은 덜 쌓여 있어 뺀다
  const [[won], [ratios], [checks]] = await Promise.all([
    db.query<(RowDataPacket & { ym: string; n: number })[]>(
      `SELECT DATE_FORMAT(opened_at, '%Y-%m') ym, COUNT(*) n FROM bids WHERE status_cd = '0010'
       GROUP BY ym HAVING ym < ? ORDER BY ym`,
      [thisMonth],
    ),
    db.query<(RowDataPacket & { ym: string; r: number })[]>(
      `SELECT DATE_FORMAT(opened_at, '%Y-%m') ym, price_won / appraisal_won r FROM bids
       WHERE status_cd = '0010' AND price_won IS NOT NULL AND appraisal_won > 0 AND opened_at < ?`,
      [`${thisMonth}-01`],
    ),
    db.query<(RowDataPacket & { ym: string; value: number })[]>(
      "SELECT ym, value FROM monthly_stats WHERE metric = 'performance_checks' AND ym < ? ORDER BY ym",
      [thisMonth],
    ),
  ]);

  const byMonth = new Map<string, number[]>();
  for (const { ym, r } of ratios) byMonth.set(ym, [...(byMonth.get(ym) ?? []), Number(r)]);
  const checkValues = checks.map((c) => Number(c.value));
  const bad = outliers(checkValues);
  const checkPoints = checks.map((c, i) => ({ ym: c.ym, value: bad.has(i) ? null : checkValues[i] }));
  const badText = [...bad].map((i) => `${checks[i].ym}(${fmtInt(checkValues[i])}건)`).join(", ");
  const ratioPoints = [...byMonth].sort(([a], [b]) => a.localeCompare(b)).map(([ym, rs]) => ({ ym, value: median(rs)! * 100 }));

  return (
    <>
      <h1>국내 거래 동향</h1>
      <p className="summary">진행 중인 이번 달({thisMonth})은 집계가 덜 돼 뺐습니다. 점 위에 마우스를 올리면 그 달 값이 나옵니다.</p>

      <LineChart title="월별 차량 공매 낙찰 건수" unit="건" format={fmtInt} points={won.map((w) => ({ ym: w.ym, value: Number(w.n) }))} />
      <p className="summary">온비드 차량 공매 낙찰 건수(개찰일 기준). 2021년부터 연간 낙찰이 크게 줄었는데, 원인은 데이터에 나와 있지 않습니다.</p>

      <LineChart title="감정가 대비 낙찰가율 (월 중앙값)" unit="%" format={fmtInt} points={ratioPoints} />
      <p className="summary">감정가가 있는 낙찰 건만. 100%를 넘으면 감정가보다 비싸게 팔린 것입니다.</p>

      <LineChart title="전국 중고차 성능점검 건수" unit="건" format={fmtInt} tickFormat={compact} points={checkPoints} />
      <p className="summary">
        한국교통안전공단 자동차 성능점검 통계(공공데이터포털). 매매업자를 거쳐 파는 중고차는 성능·상태 점검을 받으므로 국내 중고차 매매 규모를 가늠하는 지표로 씁니다.
        {badText && ` 원본 값이 전체 중앙값과 3배 넘게 차이 나는 달은 오류로 보고 비웠습니다: ${badText}.`}
      </p>
    </>
  );
}
