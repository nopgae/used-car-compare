// 공매 낙찰가 추정: 모델 계열마다 log(가격) = a + b·차령 + c·log(주행거리) + d·거래시점 을 최소제곱으로 맞춘다.

export type Sale = { price: number; year: number; km: number; soldAt: Date };
export type Fit = { coef: number[]; sd: number; n: number };

export const MIN_TRAIN = 30;
const EPOCH = Date.UTC(2018, 0, 1);
const YEAR_MS = 365.25 * 86400_000;

// 여러 대 묶음(외 3대, /5대/, 총18대, 84대 ...)·폐차 조건 매각: 한 대 가격이 아니라 학습·예측에서 뺀다.
// 같은 문자열을 MySQL REGEXP(ICU)와 JS RegExp 양쪽에 쓴다: 백슬래시·작은따옴표를 넣지 말 것.
const LOT = "외 ?[0-9]+ ?(대|건)|(^|[^0-9])([2-9]|[1-9][0-9]+) ?대( |/|,|[)]|$)|폐차";
export const LOT_OR_SCRAP = new RegExp(LOT);

// 학습·추정에 쓰는 낙찰 건: 일반 차, 계열·연식·주행거리 있음, 여러 대 묶음·폐차 조건 매각 제외
export const SALES_WHERE = `status_cd = '0010' AND price_won IS NOT NULL AND NOT is_special
  AND model_group IS NOT NULL AND year IS NOT NULL AND mileage_km IS NOT NULL
  AND name NOT REGEXP '${LOT}'`;

export const yearsSinceEpoch = (d: Date) => (d.getTime() - EPOCH) / YEAR_MS;

export function features(year: number, km: number, soldAt: Date): number[] {
  const t = yearsSinceEpoch(soldAt);
  const age = Math.max(0, 2018 + t - year);
  return [1, age, Math.log(Math.max(km, 1_000)), t];
}

// 정규방정식 (XᵀX + λI)β = Xᵀy 를 가우스 소거로 푼다. λ는 열이 겹칠 때(예: 모두 같은 해 거래) 풀리게 하는 작은 값.
export function solve(X: number[][], y: number[], lambda = 1e-6): number[] {
  const k = X[0].length;
  const A = Array.from({ length: k }, (_, i) =>
    Array.from({ length: k + 1 }, (_, j) =>
      j < k ? X.reduce((s, r) => s + r[i] * r[j], 0) + (i === j ? lambda : 0) : X.reduce((s, r, n) => s + r[i] * y[n], 0),
    ),
  );
  for (let c = 0; c < k; c++) {
    const p = A.reduce((best, r, i) => (i >= c && Math.abs(r[c]) > Math.abs(A[best][c]) ? i : best), c);
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((r, i) => r[k] / r[i]);
}

export function fit(sales: Sale[]): Fit | null {
  if (sales.length < MIN_TRAIN) return null;
  const X = sales.map((s) => features(s.year, s.km, s.soldAt));
  const y = sales.map((s) => Math.log(s.price));
  const coef = solve(X, y);
  const resid = X.map((x, i) => y[i] - dot(coef, x));
  const sd = Math.sqrt(resid.reduce((s, r) => s + r * r, 0) / Math.max(1, sales.length - coef.length));
  return { coef, sd, n: sales.length };
}

const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

// 점추정과 80% 구간(잔차가 로그정규라고 가정)
export function predict(f: Fit, year: number, km: number, soldAt: Date) {
  const mu = dot(f.coef, features(year, km, soldAt));
  return { price: Math.exp(mu), low: Math.exp(mu - 1.2816 * f.sd), high: Math.exp(mu + 1.2816 * f.sd) };
}

// 기존 car-price-estimator-demo 방식: 같은 모델, 연식 ±2년 평균
export function baseline(train: Sale[], year: number): number | null {
  const near = train.filter((s) => Math.abs(s.year - year) <= 2);
  return near.length ? near.reduce((s, x) => s + x.price, 0) / near.length : null;
}
