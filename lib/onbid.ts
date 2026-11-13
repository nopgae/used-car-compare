// 온비드 차량 입찰결과 API 응답 한 건을 bids 테이블 행으로 바꾼다.

export type OnbidItem = Record<string, string | number | null>;

export type BidRow = {
  cltr_mng_no: string;
  pbct_cdtn_no: number;
  name: string;
  category: string | null;
  maker: string | null;
  model: string | null;
  model_key: string | null;
  year: number | null;
  mileage_km: number | null;
  displacement_cc: number | null;
  fuel: string | null;
  property_type: string | null;
  appraisal_won: number | null;
  min_bid_won: number | null;
  price_won: number | null;
  status_cd: string;
  status: string;
  round_no: string | null;
  bidders: number | null;
  opened_at: string;
};

// shortcut: 차가 아닌 장비를 소분류명으로만 거른다. 새 소분류가 나오면 목록에 추가.
const NON_VEHICLE = new Set([
  "지게차", "자전거", "오토바이", "기타중기", "굴삭기", "ATV(4륜오토바이)", "자동차부품및보조용품", "자전거부품및보조용품",
]);

// shortcut: 표기 흔들림만 합친다. 브랜드가 늘면 여기에 추가.
const MAKERS: [RegExp, string][] = [
  [/제네시스/, "제네시스"],
  [/현대/, "현대"],
  [/기아/, "기아"],
  [/쌍용|KG\s*모빌리티/i, "KG모빌리티(쌍용)"],
  [/르노|삼성자동차/, "르노코리아(삼성)"],
  [/쉐보레|GM\s*대우|한국GM|대우자동차/i, "쉐보레(GM대우)"],
  [/타타대우/, "타타대우"],
  [/벤츠|Mercedes/i, "벤츠"],
  [/BMW/i, "BMW"],
  [/아우디|Audi/i, "아우디"],
  [/폭스바겐|Volkswagen/i, "폭스바겐"],
  [/도요타|토요타|Toyota/i, "토요타"],
  [/렉서스|Lexus/i, "렉서스"],
  [/혼다|Honda/i, "혼다"],
  [/볼보|Volvo/i, "볼보"],
  [/테슬라|Tesla/i, "테슬라"],
  [/포드|Ford/i, "포드"],
];

const SPEC_TOKEN = /^([\d.,]+(cc)?|DOHC|SOHC|LPI|LPG|LPLI|VGT|CRDI|GDI|MPI|TCI|가솔린|디젤|경유|휘발유)$/i;

const text = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
};

const int = (v: unknown): number | null => {
  const s = text(v);
  if (s === null || !/^-?[\d,]+$/.test(s)) return null;
  return Number(s.replace(/,/g, ""));
};

// 원본에 오기가 있다(주행거리 수십억 km, 배기량 24979cc 등). 범위를 벗어나면 비운다.
const inRange = (n: number | null, min: number, max: number): number | null =>
  n !== null && n >= min && n <= max ? n : null;

export function normalizeMaker(...sources: (string | null)[]): string | null {
  for (const s of sources) {
    if (!s) continue;
    for (const [re, name] of MAKERS) if (re.test(s)) return name;
  }
  return null;
}

// "스파크 1.0 DOHC" → "스파크", "그랜드 스타렉스" → "그랜드스타렉스"
export function modelKey(model: string | null): string | null {
  if (!model) return null;
  const key = model.split(" ").filter((t) => !SPEC_TOKEN.test(t)).join("");
  return key === "" ? null : key;
}

// 낙찰가는 문자형이고 여러 건이면 "|"로 이어진다. 한 대의 가격을 확정할 수 없으니 버린다.
export function parsePrice(v: unknown): number | null {
  const s = text(v);
  if (s === null || s.includes("|")) return null;
  const n = int(s);
  return n !== null && n > 0 ? n : null;
}

export function toRow(it: OnbidItem, thisYear = new Date().getFullYear()): BidRow | null {
  const category = text(it.cltrUsgSclsCtgrNm);
  if (category && NON_VEHICLE.has(category)) return null;
  const opened = text(it.cltrOpbdDt);
  const cltr = text(it.cltrMngNo);
  if (!opened || !/^\d{12}$/.test(opened) || !cltr || it.pbctCdtnNo == null) return null;

  const name = text(it.onbidCltrNm) ?? "";
  const model = text(it.carMdlNm);
  const year = int(it.yrmdl);
  const mileage = int(it.drvDstc);
  const fuel = text(it.fuelCont);
  return {
    cltr_mng_no: cltr,
    pbct_cdtn_no: Number(it.pbctCdtnNo),
    name,
    category,
    maker: normalizeMaker(text(it.cltrMkrNm), name, model),
    model,
    model_key: modelKey(model),
    year: year !== null && year >= 1970 && year <= thisYear + 1 ? year : null,
    mileage_km: inRange(mileage, 1, 2_000_000),
    displacement_cc: inRange(int(it.dsvlm), 1, 20_000),
    fuel: fuel && /[가-힣A-Za-z]{2,}/.test(fuel) ? fuel : null, // "-", "X" 같은 자리채움 값 제거
    property_type: text(it.prptDivNm),
    appraisal_won: int(it.apslEvlAmt) || null,
    min_bid_won: int(it.lowstBidPrcIndctCont) || null, // "비공개" → null
    price_won: parsePrice(it.scfbAmt),
    status_cd: text(it.pbctStatCd) ?? "",
    status: text(it.pbctStatNm) ?? "",
    round_no: text(it.pbctNsq),
    bidders: int(it.vldBddrNope),
    opened_at: `${opened.slice(0, 4)}-${opened.slice(4, 6)}-${opened.slice(6, 8)} ${opened.slice(8, 10)}:${opened.slice(10, 12)}:00`,
  };
}
