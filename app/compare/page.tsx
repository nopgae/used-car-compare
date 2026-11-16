import { Suspense } from "react";
import { CompareView } from "./CompareView";

export default function ComparePage() {
  return (
    <>
      <h1>차량 비교</h1>
      <Suspense>
        <CompareView />
      </Suspense>
    </>
  );
}
