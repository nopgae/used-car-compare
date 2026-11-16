import type { Connection } from "mysql2/promise";

// 수집 작업 하나를 ingest_runs에 남긴다. 실패해도 이력은 남기고 오류를 다시 던진다.
export async function logged<T extends { calls: number; rows: number }>(db: Connection, job: string, work: () => Promise<T>): Promise<T> {
  const started = new Date();
  let result: T | undefined, error: string | null = null;
  try {
    result = await work();
    return result;
  } catch (e) {
    error = (e as Error).message.slice(0, 500);
    throw e;
  } finally {
    await db.query(
      "INSERT INTO ingest_runs (job, started_at, finished_at, api_calls, row_count, error) VALUES (?, ?, ?, ?, ?, ?)",
      [job, started, new Date(), result?.calls ?? 0, result?.rows ?? 0, error],
    );
  }
}
