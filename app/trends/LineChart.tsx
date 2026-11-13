import { niceTicks } from "../../lib/chart";

// value가 null인 달(원본 이상값 등)은 선을 끊고 비워 둔다.
type Point = { ym: string; value: number | null };

const W = 800, H = 250, L = 72, R = 16, T = 12, B = 40;

// 단일 계열 월별 선 차트. 범례 없이 제목이 계열을 말한다. 월마다 투명 영역에 hover하면 세로선·점·툴팁(<title>)이 뜬다.
export function LineChart({ title, points, format, tickFormat = format, unit }: {
  title: string; points: Point[]; format: (v: number) => string; tickFormat?: (v: number) => string; unit: string;
}) {
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (values.length < 2) return null;
  const ticks = niceTicks(Math.max(...values));
  const top = ticks[ticks.length - 1];
  const x = (i: number) => L + (i * (W - L - R)) / (points.length - 1);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const path = points
    .map((p, i) => (p.value === null ? "" : `${i && points[i - 1].value !== null ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`))
    .join("");
  const band = (W - L - R) / (points.length - 1);
  const lastIdx = points.findLastIndex((p) => p.value !== null);
  const show = (p: Point) => (p.value === null ? "원본 이상값이라 뺌" : `${format(p.value)}${unit}`);

  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, ${points[0].ym}~${points[points.length - 1].ym}. 값은 아래 표로 보기에 있습니다.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
              <text x={L - 8} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">{tickFormat(t)}</text>
            </g>
          ))}
          {points.map((p, i) =>
            p.ym.endsWith("-01") ? <text key={p.ym} x={x(i)} y={H - 4} className="tick" textAnchor="middle">{p.ym.slice(0, 4)}</text> : null,
          )}
          <path d={path} className="line" />
          <circle cx={x(lastIdx)} cy={y(points[lastIdx].value!)} r={4} className="dot" />
          {points.map((p, i) => (
            <g key={p.ym} className="hit">
              <rect x={x(i) - band / 2} y={T} width={band} height={H - T - B} />
              <line x1={x(i)} x2={x(i)} y1={T} y2={H - B} className="cross" />
              {p.value !== null && <circle cx={x(i)} cy={y(p.value)} r={4} className="dot" />}
              <title>{`${p.ym}: ${show(p)}`}</title>
            </g>
          ))}
        </svg>
      <details>
        <summary>표로 보기</summary>
        <div className="table-wrap">
          <table>
            <thead><tr><th>월</th><th className="num">{title}</th></tr></thead>
            <tbody>{[...points].reverse().map((p) => <tr key={p.ym}><td>{p.ym}</td><td className="num">{show(p)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
