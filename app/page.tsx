import { Suspense } from "react";
import { SearchView } from "./SearchView";

export default function SearchPage() {
  return (
    <>
      <h1>온비드 차량 공매 낙찰 검색</h1>
      <p className="summary">
        공공기관이 쓰다 처분한 차(불용품, 낙찰의 약 86%)와 압류·국공유 재산 차량의 공매 결과입니다. 법원 경매는 포함하지 않습니다.
      </p>
      <Suspense>
        <SearchView />
      </Suspense>
    </>
  );
}
