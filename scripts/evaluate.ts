// 시세 추정 홀드아웃 검증: 마지막 6개월 낙찰을 떼어 두고, 그 이전 데이터로만 학습해 맞혀 본다.
// 결과는 data/metrics.json(화면과 README에 쓰는 숫자)으로 저장한다.
import { mkdir, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { baseline, fit, predict, SALES_WHERE, type Fit, type Sale } from "../lib/estimate.ts";

const db = await mysql.createConnection({ uri: process.env.DATABASE_URL, dateStrings: true });
const [rows] = await db.query<mysql.RowDataPacket[]>(
  `SELECT model_group g, price_won p, year y, mileage_km km, opened_at t FROM bids WHERE ${SALES_WHERE}`,
);
await db.end();

const all = rows.map((r) => ({ g: r.g as string, sale: { price: Number(r.p), year: r.y, km: r.km, soldAt: new Date(`${r.t}Z`) } as Sale }));
const last = new Date(Math.max(...all.map((r) => r.sale.soldAt.getTime())));
const cutoff = new Date(last);
cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);

const train = new Map<string, Sale[]>();
const test: typeof all = [];
for (const r of all) {
  if (r.sale.soldAt < cutoff) train.set(r.g, [...(train.get(r.g) ?? []), r.sale]);
  else test.push(r);
}
const fits = new Map<string, Fit | null>([...train].map(([g, s]) => [g, fit(s)]));

type Pair = { y: number; model: number; base: number; inBand: boolean };
const pairs: Pair[] = [];
let modelOnly = 0, baseOnly = 0;
for (const { g, sale } of test) {
  const f = fits.get(g);
  const m = f ? predict(f, sale.year, sale.km, sale.soldAt) : null;
  const b = baseline(train.get(g) ?? [], sale.year);
  if (m && b !== null) pairs.push({ y: sale.price, model: m.price, base: b, inBand: sale.price >= m.low && sale.price <= m.high });
  else if (m) modelOnly++;
  else if (b !== null) baseOnly++;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
const score = (pick: (p: Pair) => number) => {
  const ape = pairs.map((p) => Math.abs(pick(p) - p.y) / p.y);
  return {
    maeWon: Math.round(pairs.reduce((s, p) => s + Math.abs(pick(p) - p.y), 0) / pairs.length),
    mape: +(ape.reduce((s, v) => s + v, 0) / ape.length).toFixed(3),
    medianApe: +median(ape).toFixed(3),
    within20pct: +(ape.filter((v) => v <= 0.2).length / ape.length).toFixed(3),
  };
};

const metrics = {
  generatedAt: new Date().toISOString(),
  method: "모델 계열별 log(낙찰가) ~ 차령 + log(주행거리) + 거래시점 최소제곱, 학습 30건 이상 계열만",
  baselineMethod: "같은 모델 계열, 연식 ±2년 낙찰가 평균(기존 car-price-estimator-demo 방식)",
  split: { trainBefore: cutoff.toISOString().slice(0, 10), testFrom: cutoff.toISOString().slice(0, 10), testTo: last.toISOString().slice(0, 10) },
  counts: { usableSales: all.length, train: all.length - test.length, test: test.length, compared: pairs.length, modelOnly, baselineOnly: baseOnly, groupsWithModel: [...fits.values()].filter(Boolean).length },
  model: { ...score((p) => p.model), interval80Coverage: +(pairs.filter((p) => p.inBand).length / pairs.length).toFixed(3) },
  baseline: score((p) => p.base),
};
await mkdir("data", { recursive: true });
await writeFile("data/metrics.json", JSON.stringify(metrics, null, 2) + "\n");
console.log(JSON.stringify(metrics, null, 2));
