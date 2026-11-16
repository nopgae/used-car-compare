"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { median, parseIds } from "../../lib/compare";
import type { Bid } from "../../lib/data";
import { km, pct, won } from "../../lib/format";
import { useBids } from "../../lib/useData";

// "비슷한 차": 같은 모델 계열(없으면 같은 모델명)·같은 일반/특수 구분, 연식 ±1년의 낙찰가
function peers(all: Bid[], b: Bid) {
  if (b.year == null || (!b.group && !b.model)) return null;
  const same = (x: Bid) => (b.group ? x.group === b.group : x.model === b.model);
  const prices = all.filter((x) => same(x) && x.special === b.special && x.year !== null && Math.abs(x.year - b.year!) <= 1).map((x) => x.price);
  return { n: prices.length, median: median(prices) };
}

export function CompareView() {
  const sp = useSearchParams();
  const { data: bids, error } = useBids();
  const requested = sp.getAll("id");
  const ids = parseIds({ id: requested });
  if (ids.length === 0) {
    return <p>검색 결과에서 비교할 차량을 최대 3대까지 체크한 뒤 “선택한 차량 비교”를 누르세요. <Link href="/">검색으로</Link></p>;
  }
  if (error) return <p>데이터를 불러오지 못했습니다: {error}</p>;
  if (!bids) return <p className="summary">낙찰 데이터를 불러오는 중…</p>;

  const cars = ids.map(([c, p]) => bids.find((b) => b.id === `${c}~${p}`)).filter((b): b is Bid => b !== undefined);
  const stats = cars.map((c) => peers(bids, c));
  const minPrice = Math.min(...cars.map((c) => c.price));
  const rows: [string, (c: Bid, i: number) => React.ReactNode][] = [
    ["물건명", (c) => c.name],
    ["제조사", (c) => c.maker ?? "-"],
    ["모델", (c) => c.model ?? "-"],
    ["모델 계열", (c) => (c.group ?? "-") + (c.special ? " · 특수 개조/용도" : "")],
    ["차종", (c) => c.category ?? "-"],
    ["연식", (c) => c.year ?? "-"],
    ["주행거리", (c) => km(c.km)],
    ["배기량", (c) => (c.cc ? `${c.cc.toLocaleString()}cc` : "-")],
    ["연료", (c) => c.fuel ?? "-"],
    ["재산유형", (c) => c.property ?? "-"],
    ["감정가", (c) => won(c.appraisal)],
    ["최저입찰가", (c) => won(c.minBid)],
    ["낙찰가", (c) => <strong>{won(c.price)}{c.price === minPrice && cars.length > 1 ? " (최저)" : ""}</strong>],
    ["감정가 대비 낙찰가", (c) => pct(c.price, c.appraisal)],
    ["유효 입찰자", (c) => c.bidders ?? "-"],
    ["공매 회차", (c) => c.round ?? "-"],
    ["개찰일", (c) => c.opened],
    ["비슷한 차 낙찰 중앙값", (_, i) => (stats[i]?.median != null ? `${won(stats[i]!.median)} (${stats[i]!.n}건)` : "-")],
    ["중앙값 대비", (c, i) => (stats[i] && stats[i]!.n < 5 ? `${pct(c.price, stats[i]!.median)} (표본 적음)` : pct(c.price, stats[i]?.median ?? null))],
  ];

  return (
    <>
      {requested.length > ids.length && <p className="summary">최대 {ids.length}대까지만 비교합니다. 앞에서부터 {ids.length}대를 보여줍니다.</p>}
      {cars.length < ids.length && <p className="summary">찾을 수 없는 차량 {ids.length - cars.length}대는 뺐습니다.</p>}
      <div className="table-wrap">
        <table className="compare">
          <tbody>
            {rows.map(([label, cell]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {cars.map((c, i) => <td key={c.id} className="name">{cell(c, i)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="summary">
        “비슷한 차”는 같은 모델 계열(예: 카니발·올뉴카니발 → 카니발, 전기·하이브리드·리무진은 따로), 같은 일반/특수 구분, 연식 ±1년인 낙찰 건입니다.
      </p>
      <p><Link href="/">← 검색으로</Link></p>
    </>
  );
}
