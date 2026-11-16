"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { km, pct, won } from "../lib/format";
import { counts, readFilters, search } from "../lib/search";
import { useBids } from "../lib/useData";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const SORT_LABELS = { recent: "최신 개찰순", price_asc: "낙찰가 낮은순", price_desc: "낙찰가 높은순", year_desc: "연식 최신순", km_asc: "주행거리 적은순" };

export function SearchView() {
  const sp = useSearchParams();
  const { data: bids, error } = useBids();
  if (error) return <p>데이터를 불러오지 못했습니다: {error}</p>;
  if (!bids) return <p className="summary">낙찰 데이터를 불러오는 중…</p>;

  const f = readFilters((k) => sp.get(k));
  const r = search(bids, f);
  const pageHref = (p: number) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), page: String(p) })}`;

  return (
    <>
      <form className="filters" method="get">
        <label>제조사
          <select name="maker" defaultValue={f.maker}>
            <option value="">전체</option>
            {counts(bids, "maker").map(([v, n]) => <option key={v} value={v}>{v} ({n.toLocaleString()})</option>)}
          </select>
        </label>
        <label>모델<input name="model" defaultValue={f.model} placeholder="예: 쏘나타" /></label>
        <label>차종
          <select name="category" defaultValue={f.category}>
            <option value="">전체</option>
            {counts(bids, "category").map(([v, n]) => <option key={v} value={v}>{v} ({n.toLocaleString()})</option>)}
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

      <form action={`${BASE}/compare/`} method="get">
        <div className="result-bar">
          <p className="summary">낙찰 {r.total.toLocaleString()}건 · {r.page}/{r.pages}쪽</p>
          <button type="submit" className="secondary">선택한 차량 비교 (최대 3대)</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th><span className="sr-only">비교 선택</span></th>
                <th>개찰일</th><th>물건명</th><th>제조사</th><th>모델</th><th>차종</th>
                <th className="num">연식</th><th className="num">주행거리</th><th className="num">감정가</th>
                <th className="num">낙찰가</th><th className="num">감정가 대비</th><th className="num">입찰자</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((b) => (
                <tr key={b.id}>
                  <td><input type="checkbox" name="id" value={b.id} aria-label={`${b.name} 비교에 추가`} /></td>
                  <td>{b.opened.slice(0, 10)}</td>
                  <td className="name">{b.name}</td>
                  <td>{b.maker ?? "-"}</td>
                  <td>{b.model ?? "-"}</td>
                  <td>{b.category ?? "-"}</td>
                  <td className="num">{b.year ?? "-"}</td>
                  <td className="num">{km(b.km)}</td>
                  <td className="num">{won(b.appraisal)}</td>
                  <td className="num"><strong>{won(b.price)}</strong></td>
                  <td className="num">{pct(b.price, b.appraisal)}</td>
                  <td className="num">{b.bidders ?? "-"}</td>
                </tr>
              ))}
              {r.rows.length === 0 && <tr><td colSpan={12}>조건에 맞는 낙찰 건이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </form>
      <nav className="pager" aria-label="페이지">
        {r.page > 1 && <Link href={pageHref(r.page - 1)}>← 이전</Link>}
        {r.page < r.pages && <Link href={pageHref(r.page + 1)}>다음 →</Link>}
      </nav>
    </>
  );
}
