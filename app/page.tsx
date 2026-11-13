import Link from "next/link";
import type { RowDataPacket } from "mysql2";
import { db } from "../lib/db";
import { km, pct, won } from "../lib/format";
import { buildQuery, PAGE_SIZE, type SearchParams } from "../lib/search";

type Bid = RowDataPacket & {
  cltr_mng_no: string; pbct_cdtn_no: number; name: string; category: string | null; maker: string | null;
  model: string | null; year: number | null; mileage_km: number | null; appraisal_won: number | null;
  price_won: number; bidders: number | null; opened_at: string;
};

const SORT_LABELS = { recent: "최신 개찰순", price_asc: "낙찰가 낮은순", price_desc: "낙찰가 높은순", year_desc: "연식 최신순", km_asc: "주행거리 적은순" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = buildQuery(await searchParams);
  const [[rows], [[{ total }]], [makers], [categories]] = await Promise.all([
    db.query<Bid[]>(
      `SELECT cltr_mng_no, pbct_cdtn_no, name, category, maker, model, year, mileage_km, appraisal_won, price_won, bidders, opened_at
       FROM bids WHERE ${q.where} ORDER BY ${q.orderBy} LIMIT ? OFFSET ?`,
      [...q.params, PAGE_SIZE, (q.page - 1) * PAGE_SIZE],
    ),
    db.query<(RowDataPacket & { total: number })[]>(`SELECT COUNT(*) total FROM bids WHERE ${q.where}`, q.params),
    db.query<(RowDataPacket & { v: string; n: number })[]>(
      "SELECT maker v, COUNT(*) n FROM bids WHERE status_cd='0010' AND maker IS NOT NULL GROUP BY maker ORDER BY n DESC",
    ),
    db.query<(RowDataPacket & { v: string; n: number })[]>(
      "SELECT category v, COUNT(*) n FROM bids WHERE status_cd='0010' AND category IS NOT NULL GROUP BY category ORDER BY n DESC",
    ),
  ]);
  const f = q.filters;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => `/?${new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), page: String(p) })}`;

  return (
    <>
      <h1>차량 공매 낙찰 검색</h1>
      <form className="filters" method="get">
        <label>제조사
          <select name="maker" defaultValue={f.maker}>
            <option value="">전체</option>
            {makers.map((m) => <option key={m.v} value={m.v}>{m.v} ({m.n.toLocaleString()})</option>)}
          </select>
        </label>
        <label>모델
          <input name="model" defaultValue={f.model} placeholder="예: 쏘나타" />
        </label>
        <label>차종
          <select name="category" defaultValue={f.category}>
            <option value="">전체</option>
            {categories.map((c) => <option key={c.v} value={c.v}>{c.v} ({c.n.toLocaleString()})</option>)}
          </select>
        </label>
        <label>연식 최소<input name="yearMin" inputMode="numeric" defaultValue={f.yearMin} placeholder="2015" /></label>
        <label>연식 최대<input name="yearMax" inputMode="numeric" defaultValue={f.yearMax} /></label>
        <label>주행거리 최대(km)<input name="kmMax" inputMode="numeric" defaultValue={f.kmMax} placeholder="100000" /></label>
        <label>낙찰가 최소(만원)<input name="priceMin" inputMode="numeric" defaultValue={f.priceMin} /></label>
        <label>낙찰가 최대(만원)<input name="priceMax" inputMode="numeric" defaultValue={f.priceMax} /></label>
        <label>정렬
          <select name="sort" defaultValue={f.sort}>
            {Object.entries(SORT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <button type="submit">검색</button>
      </form>

      <p className="summary">낙찰 {total.toLocaleString()}건 · {q.page}/{pages}쪽</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>개찰일</th><th>물건명</th><th>제조사</th><th>모델</th><th>차종</th>
              <th className="num">연식</th><th className="num">주행거리</th><th className="num">감정가</th>
              <th className="num">낙찰가</th><th className="num">감정가 대비</th><th className="num">입찰자</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.cltr_mng_no}-${r.pbct_cdtn_no}`}>
                <td>{r.opened_at.slice(0, 10)}</td>
                <td className="name">{r.name}</td>
                <td>{r.maker ?? "-"}</td>
                <td>{r.model ?? "-"}</td>
                <td>{r.category ?? "-"}</td>
                <td className="num">{r.year ?? "-"}</td>
                <td className="num">{km(r.mileage_km)}</td>
                <td className="num">{won(r.appraisal_won)}</td>
                <td className="num"><strong>{won(r.price_won)}</strong></td>
                <td className="num">{pct(r.price_won, r.appraisal_won)}</td>
                <td className="num">{r.bidders ?? "-"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={11}>조건에 맞는 낙찰 건이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      <nav className="pager" aria-label="페이지">
        {q.page > 1 && <Link href={pageHref(q.page - 1)}>← 이전</Link>}
        {q.page < pages && <Link href={pageHref(q.page + 1)}>다음 →</Link>}
      </nav>
    </>
  );
}
