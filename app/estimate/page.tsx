import type { RowDataPacket } from "mysql2";
import metrics from "../../data/metrics.json";
import { db } from "../../lib/db";
import { fit, MIN_TRAIN, predict, SALES_WHERE } from "../../lib/estimate";
import { km, won } from "../../lib/format";
import type { SearchParams } from "../../lib/search";

type Sale = RowDataPacket & { cltr_mng_no: string; pbct_cdtn_no: number; name: string; price_won: number; year: number; mileage_km: number; opened_at: string };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const pctText = (v: number) => `${Math.round(v * 100)}%`;

export default async function EstimatePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const group = one(sp.group), yearIn = one(sp.year), kmIn = one(sp.km);
  const [groups] = await db.query<(RowDataPacket & { g: string; n: number })[]>(
    `SELECT model_group g, COUNT(*) n FROM bids WHERE ${SALES_WHERE} GROUP BY model_group HAVING n >= ? ORDER BY g`,
    [MIN_TRAIN],
  );
  const thisYear = new Date().getFullYear();
  const year = /^\d{4}$/.test(yearIn) && +yearIn >= 1980 && +yearIn <= thisYear + 1 ? +yearIn : null;
  const mileage = /^\d{1,7}$/.test(kmIn) ? +kmIn : null;
  const valid = groups.some((g) => g.g === group) && year !== null && mileage !== null;

  let result: React.ReactNode = null;
  if (valid) {
    const [sales] = await db.query<Sale[]>(
      `SELECT cltr_mng_no, pbct_cdtn_no, name, price_won, year, mileage_km, opened_at FROM bids WHERE ${SALES_WHERE} AND model_group = ?`,
      [group],
    );
    const f = fit(sales.map((s) => ({ price: Number(s.price_won), year: s.year, km: s.mileage_km, soldAt: new Date(`${s.opened_at}Z`) })))!;
    const p = predict(f, year, mileage, new Date());
    // 시세는 시점에 따라 움직이므로 비슷한 조건 안에서 최근 거래부터 보여준다
    const similar = sales
      .filter((s) => Math.abs(s.year - year) <= 1 && Math.abs(s.mileage_km - mileage) <= mileage * 0.3)
      .sort((a, b) => b.opened_at.localeCompare(a.opened_at))
      .slice(0, 10);
    result = (
      <section className="estimate">
        <p className="big">예상 공매 낙찰가 <strong>{won(p.price)}</strong></p>
        <p>80% 범위: {won(p.low)} ~ {won(p.high)} · {group} 일반 차량 낙찰 {f.n.toLocaleString()}건으로 학습</p>
        <h2>비슷한 낙찰 사례 (연식 ±1년, 주행거리 ±30%, 최근 순)</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>개찰일</th><th>물건명</th><th className="num">연식</th><th className="num">주행거리</th><th className="num">낙찰가</th></tr></thead>
            <tbody>
              {similar.map((s) => (
                <tr key={`${s.cltr_mng_no}-${s.pbct_cdtn_no}`}>
                  <td>{s.opened_at.slice(0, 10)}</td><td className="name">{s.name}</td><td className="num">{s.year}</td>
                  <td className="num">{km(s.mileage_km)}</td><td className="num">{won(Number(s.price_won))}</td>
                </tr>
              ))}
              {similar.length === 0 && <tr><td colSpan={5}>조건에 맞는 사례가 없습니다. 추정이 데이터 범위 밖일 수 있습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  const m = metrics;
  return (
    <>
      <h1>공매 낙찰가 추정</h1>
      <form className="filters" method="get">
        <label>모델 계열
          <select name="group" defaultValue={group} required>
            <option value="">선택</option>
            {groups.map((g) => <option key={g.g} value={g.g}>{g.g} ({g.n.toLocaleString()})</option>)}
          </select>
        </label>
        <label>연식<input name="year" inputMode="numeric" defaultValue={yearIn} placeholder="2016" required /></label>
        <label>주행거리(km)<input name="km" inputMode="numeric" defaultValue={kmIn} placeholder="120000" required /></label>
        <button type="submit">추정</button>
      </form>
      {(group || yearIn || kmIn) && !valid && <p>모델 계열을 고르고 연식(4자리)과 주행거리(숫자)를 넣어 주세요.</p>}
      {result}

      <section className="method">
        <h2>얼마나 맞나 (홀드아웃 검증)</h2>
        <p>
          {m.split.testFrom}~{m.split.testTo} 낙찰 {m.counts.compared.toLocaleString()}건을 떼어 두고, 그 이전 데이터로만 학습해 맞혀 봤습니다.
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>방법</th><th className="num">오차 중앙값</th><th className="num">±20% 안</th><th className="num">평균 절대오차</th></tr></thead>
            <tbody>
              <tr><td>이 추정({m.method})</td><td className="num">{pctText(m.model.medianApe)}</td><td className="num">{pctText(m.model.within20pct)}</td><td className="num">{won(m.model.maeWon)}</td></tr>
              <tr><td>비교 기준({m.baselineMethod})</td><td className="num">{pctText(m.baseline.medianApe)}</td><td className="num">{pctText(m.baseline.within20pct)}</td><td className="num">{won(m.baseline.maeWon)}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="summary">
          80% 범위 안에 실제 낙찰가가 든 비율: {pctText(m.model.interval80Coverage)}. 구급·소방·순찰차 같은 특수 개조 차량, 여러 대 묶음, 폐차 조건 매각은 학습과 추정에서 뺐습니다.
          차 상태·옵션·사고 이력은 데이터에 없어 반영하지 못합니다.
        </p>
      </section>
    </>
  );
}
