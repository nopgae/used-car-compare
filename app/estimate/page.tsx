import { Suspense } from "react";
import metrics from "../../data/metrics.json";
import { won } from "../../lib/format";
import { EstimateView } from "./EstimateView";

const pctText = (v: number) => `${Math.round(v * 100)}%`;

export default function EstimatePage() {
  const m = metrics;
  return (
    <>
      <h1>공매 낙찰가 추정</h1>
      <Suspense>
        <EstimateView />
      </Suspense>

      <section className="method">
        <h2>얼마나 맞나 (홀드아웃 검증)</h2>
        <p>
          {m.split.testFrom}~{m.split.testTo} 낙찰 {m.counts.compared.toLocaleString()}건을 떼어 두고, 그 이전 데이터로만 학습해 맞혀 봤습니다.
          진행 중 공매에 대해 마감 전에 남긴 예측의 실제 성적은 <a href="../live/">진행 중 공매</a>에서 날마다 쌓입니다.
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
