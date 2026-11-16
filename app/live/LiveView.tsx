"use client";
import type { Listing } from "../../lib/data";
import { LOT_OR_SCRAP } from "../../lib/estimate";
import { km, won } from "../../lib/format";
import { scorecard } from "../../lib/score";
import { useLive } from "../../lib/useData";

const pctText = (v: number) => `${Math.round(v * 100)}%`;

function note(l: Listing) {
  if (l.special) return "특수 개조·용도 차량이라 예측 안 함";
  if (LOT_OR_SCRAP.test(l.name)) return "여러 대 묶음·폐차 조건이라 예측 안 함";
  if (l.predicted === null) return l.group ? "연식·주행거리 없음 또는 학습 데이터 부족" : "모델 계열을 알 수 없음";
  if (l.minBid !== null && l.predicted < l.minBid) return "예상가가 최저입찰가보다 낮음: 유찰 가능성";
  return "";
}

export function LiveView() {
  const { data, error } = useLive();
  if (error) return <p>데이터를 불러오지 못했습니다: {error}</p>;
  if (!data) return <p className="summary">불러오는 중…</p>;
  const s = scorecard(data.scored);

  return (
    <>
      <p className="summary">
        {data.generatedAt.slice(0, 10)} 기준 입찰 중인 차량 {data.listings.length.toLocaleString()}대. 예상 낙찰가는 물건을 처음 본 날 마감 시점 시세로 계산해 저장하고, 이후 바꾸지 않습니다.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>입찰 마감</th><th>물건명</th><th>지역</th><th className="num">연식</th><th className="num">주행거리</th>
              <th className="num">최저입찰가</th><th className="num">예상 낙찰가</th><th className="num">80% 범위</th><th>비고</th>
            </tr>
          </thead>
          <tbody>
            {data.listings.map((l) => (
              <tr key={l.id}>
                <td>{l.bidEnd ?? "-"}</td>
                <td className="name">{l.name}</td>
                <td>{l.region ?? "-"}</td>
                <td className="num">{l.year ?? "-"}</td>
                <td className="num">{km(l.km)}</td>
                <td className="num">{won(l.minBid)}</td>
                <td className="num"><strong>{won(l.predicted)}</strong></td>
                <td className="num">{l.low !== null && l.high !== null ? `${won(l.low)}~${won(l.high)}` : "-"}</td>
                <td className="name">{note(l)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="method">
        <h2>예측 성적표 (마감 전 예측 vs 실제 낙찰가)</h2>
        {s === null ? (
          <p>아직 채점된 예측이 없습니다. 예측을 남긴 공매가 마감·개찰되면 매일 여기에 쌓입니다.</p>
        ) : (
          <>
            <p>
              채점 {s.n.toLocaleString()}건 · 오차 중앙값 <strong>{pctText(s.medianApe)}</strong> · ±20% 안 {pctText(s.within20)} · 80% 범위 적중 {pctText(s.inBand)}
            </p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>개찰일</th><th>물건명</th><th className="num">예측</th><th className="num">실제 낙찰가</th><th className="num">오차</th></tr></thead>
                <tbody>
                  {data.scored.slice(0, 30).map((r) => (
                    <tr key={r.id}>
                      <td>{r.opened.slice(0, 10)}</td><td className="name">{r.name}</td><td className="num">{won(r.predicted)}</td>
                      <td className="num">{won(r.actual)}</td><td className="num">{pctText((r.predicted - r.actual) / r.actual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="method">
        <h2>수집 이력 (최근 30회)</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>시각</th><th>작업</th><th className="num">API 호출</th><th className="num">저장</th><th>오류</th></tr></thead>
            <tbody>
              {data.runs.map((r, i) => (
                <tr key={i}><td>{r.at}</td><td>{r.job}</td><td className="num">{r.calls}</td><td className="num">{r.rows.toLocaleString()}</td><td className="name">{r.error ?? ""}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
