"use client";
import { useEffect, useState } from "react";
import { DATA_BASE, decodeBids, type Bid, type BidsFile, type LiveFile, type ModelsFile } from "./data";

// 같은 파일을 여러 화면이 쓰므로 한 번만 받는다
const cache = new Map<string, Promise<unknown>>();
function load<T>(name: string): Promise<T> {
  if (!cache.has(name)) {
    cache.set(name, fetch(`${DATA_BASE}/${name}.json`).then((r) => {
      if (!r.ok) throw new Error(`${name}.json ${r.status}`);
      return r.json();
    }));
  }
  return cache.get(name) as Promise<T>;
}
let bidsPromise: Promise<Bid[]> | undefined;
const loadBids = () => (bidsPromise ??= load<BidsFile>("bids").then(decodeBids));

function useLoad<T>(fn: () => Promise<T>): { data?: T; error?: string } {
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  useEffect(() => {
    fn().then((data) => setState({ data }), (e: Error) => setState({ error: e.message }));
  }, [fn]);
  return state;
}

export const useBids = () => useLoad(loadBids);
const loadModels = () => load<ModelsFile>("models");
export const useModels = () => useLoad(loadModels);
const loadLive = () => load<LiveFile>("live");
export const useLive = () => useLoad(loadLive);
