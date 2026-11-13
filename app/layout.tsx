import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "공공기관 중고차 공매 시세",
  description: "공공기관이 온비드에 내놓은 차량 공매(불용 관용차·압류차 등)의 낙찰 결과로 보는 중고차 검색·비교·시세",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="top">
          <Link href="/" className="brand">공공기관 중고차 공매 시세</Link>
          <nav>
            <Link href="/">🇰🇷 한국 (온비드)</Link>
            <Link href="/us">🇺🇸 미국 (개발 예정)</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          데이터: 한국자산관리공사 온비드 차량 공매 입찰결과(공공데이터포털, 이용허락범위 제한 없음).
          공매 낙찰가는 관공서 퇴역차·압류차 등의 거래가로, 일반 중고차 소매 시세와 다릅니다.
        </footer>
      </body>
    </html>
  );
}
