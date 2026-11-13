export const won = (n: number | null) => (n == null ? "-" : `${Math.round(n / 10_000).toLocaleString("ko-KR")}만원`);
export const km = (n: number | null) => (n == null ? "-" : `${n.toLocaleString("ko-KR")}km`);
export const pct = (a: number | null, b: number | null) => (a && b ? `${Math.round((a / b) * 100)}%` : "-");
