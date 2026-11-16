"use client";
import { useSearchParams } from "next/navigation";
import { LOT_OR_SCRAP, predict } from "../../lib/estimate";
import { km, won } from "../../lib/format";
import { useBids, useModels } from "../../lib/useData";

export function EstimateView() {
  const sp = useSearchParams();
  const { data: models, error } = useModels();
  const { data: bids } = useBids();
  if (error) return <p>데이터를 불러오지 못했습니다: {error}</p>;
  if (!models) return <p className="summary">모델을 불러오는 중…</p>;

  const group = sp.get("group") ?? "", yearIn = sp.get("year") ?? "", kmIn = sp.get("km") ?? "";
  const thisYear = new Date().getFullYear();
  const year = /^\d{4}$/.test(yearIn) && +yearIn >= 1980 && +yearIn <= thisYear + 1 ? +yearIn : null;
  const mileage = /^\d{1,7}$/.test(kmIn) ? +kmIn : null;
  const m = models.groups.find((g) => g.group === group);
  const asked = group || yearIn || kmIn;

  let result: React.ReactNode = null;
  if (m && year !== null && mileage !== null) {
    const p = predict(m, year, mileage, new Date());
    // 시세는 시점에 따라 움직이므로 비슷한 조건 안에서 최근 거래부터 보여준다(bids.json은 최신순)
    const similar = (bids ?? [])
      .filter((b) => b.group === group && !b.special && !LOT_OR_SCRAP.test(b.name) && b.year !== null && b.km !== null
        && Math.abs(b.year - year) <= 1 && Math.abs(b.km - mileage) <= mileage * 0.3)
      .slice(0, 10);
    result = (
      <section className="estimate">
        <p className="big">예상 공매 낙찰가 <strong>{won(p.price)}</strong></p>
        <p>80% 범위: {won(p.low)} ~ {won(p.high)} · {group} 일반 차량 낙찰 {m.n.toLocaleString()}건으로 학습</p>
        <h2>비슷한 낙찰 사례 (연식 ±1년, 주행거리 ±30%, 최근 순)</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>개찰일</th><th>물건명</th><th className="num">연식</th><th className="num">주행거리</th><th className="num">낙찰가</th></tr></thead>
            <tbody>
              {similar.map((s) => (
                <tr key={s.id}>
                  <td>{s.opened.slice(0, 10)}</td><td className="name">{s.name}</td><td className="num">{s.year}</td>
                  <td className="num">{km(s.km)}</td><td className="num">{won(s.price)}</td>
                </tr>
              ))}
              {bids && similar.length === 0 && <tr><td colSpan={5}>조건에 맞는 사례가 없습니다.</td></tr>}
              {!bids && <tr><td colSpan={5}>사례를 불러오는 중…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <>
      <form className="filters" method="get">
        <label>모델 계열
          <select name="group" defaultValue={group} required>
            <option value="">선택</option>
            {models.groups.map((g) => <option key={g.group} value={g.group}>{g.group} ({g.n.toLocaleString()})</option>)}
          </select>
        </label>
        <label>연식<input name="year" inputMode="numeric" defaultValue={yearIn} placeholder="2016" required /></label>
        <label>주행거리(km)<input name="km" inputMode="numeric" defaultValue={kmIn} placeholder="120000" required /></label>
        <button type="submit">추정</button>
      </form>
      {asked && !result && <p>모델 계열을 고르고 연식(4자리)과 주행거리(숫자)를 넣어 주세요.</p>}
      {result}
    </>
  );
}
