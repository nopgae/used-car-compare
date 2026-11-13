import Link from "next/link";
import type { RowDataPacket } from "mysql2";
import { db } from "../../lib/db";
import { median, parseIds } from "../../lib/compare";
import { km, pct, won } from "../../lib/format";
import type { SearchParams } from "../../lib/search";

type Bid = RowDataPacket & {
  cltr_mng_no: string; pbct_cdtn_no: number; name: string; category: string | null; maker: string | null;
  model: string | null; model_key: string | null; model_group: string | null; is_special: number; year: number | null;
  mileage_km: number | null; displacement_cc: number | null; fuel: string | null; property_type: string | null;
  appraisal_won: number | null; min_bid_won: number | null; price_won: number | null; bidders: number | null;
  round_no: string | null; opened_at: string;
};

// "비슷한 차": 같은 모델 계열(없으면 같은 모델명)·같은 일반/특수 구분, 연식 ±1년의 낙찰가
async function peers(b: Bid) {
  if (b.year == null || (!b.model_group && !b.model_key)) return null;
  const [col, val] = b.model_group ? ["model_group", b.model_group] : ["model_key", b.model_key];
  const [rows] = await db.query<(RowDataPacket & { price_won: number })[]>(
    `SELECT price_won FROM bids WHERE status_cd='0010' AND price_won IS NOT NULL
       AND ${col} = ? AND is_special = ? AND year BETWEEN ? AND ?`,
    [val, b.is_special, b.year - 1, b.year + 1],
  );
  return { n: rows.length, median: median(rows.map((r) => Number(r.price_won))) };
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const ids = parseIds(sp);
  const requested = sp.id === undefined ? 0 : Array.isArray(sp.id) ? sp.id.length : 1;
  if (ids.length === 0) {
    return (
      <>
        <h1>차량 비교</h1>
        <p>검색 결과에서 비교할 차량을 최대 3대까지 체크한 뒤 “선택한 차량 비교”를 누르세요. <Link href="/">검색으로</Link></p>
      </>
    );
  }

  const [found] = await db.query<Bid[]>(
    `SELECT * FROM bids WHERE (cltr_mng_no, pbct_cdtn_no) IN (${ids.map(() => "(?, ?)").join(",")})`,
    ids.flat(),
  );
  const cars = ids
    .map(([c, p]) => found.find((r) => r.cltr_mng_no === c && Number(r.pbct_cdtn_no) === p))
    .filter((r): r is Bid => r !== undefined);
  const stats = await Promise.all(cars.map(peers));

  const minPrice = Math.min(...cars.map((c) => c.price_won ?? Infinity));
  const rows: [string, (c: Bid, i: number) => React.ReactNode][] = [
    ["물건명", (c) => c.name],
    ["제조사", (c) => c.maker ?? "-"],
    ["모델", (c) => c.model ?? "-"],
    ["모델 계열", (c) => (c.model_group ?? "-") + (c.is_special ? " · 특수 개조/용도" : "")],
    ["차종", (c) => c.category ?? "-"],
    ["연식", (c) => c.year ?? "-"],
    ["주행거리", (c) => km(c.mileage_km)],
    ["배기량", (c) => (c.displacement_cc ? `${c.displacement_cc.toLocaleString()}cc` : "-")],
    ["연료", (c) => c.fuel ?? "-"],
    ["재산유형", (c) => c.property_type ?? "-"],
    ["감정가", (c) => won(c.appraisal_won)],
    ["최저입찰가", (c) => won(c.min_bid_won)],
    ["낙찰가", (c) => (c.price_won === minPrice && cars.length > 1 ? <strong>{won(c.price_won)} (최저)</strong> : <strong>{won(c.price_won)}</strong>)],
    ["감정가 대비 낙찰가", (c) => pct(c.price_won, c.appraisal_won)],
    ["유효 입찰자", (c) => c.bidders ?? "-"],
    ["공매 회차", (c) => c.round_no ?? "-"],
    ["개찰일", (c) => c.opened_at.slice(0, 16)],
    ["비슷한 차 낙찰 중앙값", (_, i) => (stats[i] && stats[i].median != null ? `${won(stats[i].median)} (${stats[i].n}건)` : "-")],
    ["중앙값 대비", (c, i) => (stats[i] && stats[i].n < 5 ? `${pct(c.price_won, stats[i].median)} (표본 적음)` : pct(c.price_won, stats[i]?.median ?? null))],
  ];

  return (
    <>
      <h1>차량 비교</h1>
      {requested > ids.length && <p className="summary">최대 {ids.length}대까지만 비교합니다. 앞에서부터 {ids.length}대를 보여줍니다.</p>}
      {cars.length < ids.length && <p className="summary">찾을 수 없는 차량 {ids.length - cars.length}대는 뺐습니다.</p>}
      <div className="table-wrap">
        <table className="compare">
          <tbody>
            {rows.map(([label, cell]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {cars.map((c, i) => <td key={`${c.cltr_mng_no}-${c.pbct_cdtn_no}`} className="name">{cell(c, i)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="summary">
        “비슷한 차”는 같은 모델 계열(예: 카니발·올뉴카니발·카니발 리무진 → 카니발, 전기·하이브리드는 따로), 같은 일반/특수 구분, 연식 ±1년인 낙찰 건입니다.
      </p>
      <p><Link href="/">← 검색으로</Link></p>
    </>
  );
}
