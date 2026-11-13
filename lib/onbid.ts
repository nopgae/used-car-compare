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
  model_group: string | null;
  is_special: boolean;
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

// 모델 계열: 표기·세대명이 달라도 같은 차를 한데 묶는다. 앞에 있는 것이 우선(구체적인 이름을 먼저).
// shortcut: 공매에 자주 나오는 국산 모델만 손으로 적었다. 목록에 없는 모델은 계열 없음(null).
const GROUPS: [string, string[]][] = [
  ["그랜드스타렉스", ["그랜드스타렉스"]], ["스타렉스", ["스타렉스"]], ["스타리아", ["스타리아"]],
  ["카니발", ["카니발"]], ["G80", ["G80"]], ["G70", ["G70"]], ["G90", ["G90", "EQ900"]], ["제네시스", ["제네시스"]],
  ["에쿠스", ["에쿠스"]], ["그랜저", ["그랜저"]], ["쏘나타", ["쏘나타"]], ["아반떼", ["아반떼"]], ["엑센트", ["엑센트"]],
  ["베르나", ["베르나"]], ["클릭", ["클릭"]], ["아이오닉", ["아이오닉"]], ["코나", ["코나"]], ["투싼", ["투싼"]],
  ["싼타페", ["싼타페"]], ["베라크루즈", ["베라크루즈"]], ["팰리세이드", ["팰리세이드"]], ["테라칸", ["테라칸"]],
  ["트라제", ["트라제"]], ["그레이스", ["그레이스"]], ["포터", ["포터"]], ["마이티", ["마이티"]], ["카운티", ["카운티"]], ["에어로타운", ["에어로타운"]],
  ["그린시티", ["그린시티"]], ["에어로시티", ["에어로시티"]], ["유니버스", ["유니버스"]], ["메가트럭", ["메가트럭"]],
  ["엑시언트", ["엑시언트"]], ["쏠라티", ["쏠라티"]], ["블루온", ["블루온"]],
  ["모닝", ["모닝"]], ["레이", ["레이"]], ["프라이드", ["프라이드"]], ["포르테", ["포르테"]], ["쎄라토", ["쎄라토"]],
  ["K3", ["K3"]], ["K5", ["K5"]], ["K7", ["K7"]], ["K8", ["K8"]], ["K9", ["K9"]], ["로체", ["로체"]], ["오피러스", ["오피러스"]],
  ["쏘울", ["쏘울"]], ["니로", ["니로"]], ["셀토스", ["셀토스"]], ["스포티지", ["스포티지"]], ["쏘렌토", ["쏘렌토"]],
  ["모하비", ["모하비"]], ["카렌스", ["카렌스"]], ["봉고", ["봉고"]],
  ["스파크", ["스파크"]], ["마티즈", ["마티즈"]], ["라세티", ["라세티"]], ["젠트라", ["젠트라"]], ["크루즈", ["크루즈"]],
  ["말리부", ["말리부"]], ["토스카", ["토스카"]], ["윈스톰", ["윈스톰"]], ["캡티바", ["캡티바"]], ["올란도", ["올란도"]],
  ["트랙스", ["트랙스"]], ["다마스", ["다마스"]], ["라보", ["라보"]],
  ["렉스턴스포츠", ["렉스턴스포츠"]], ["렉스턴", ["렉스턴"]], ["코란도스포츠", ["코란도스포츠"]],
  ["코란도투리스모", ["코란도투리스모"]], ["코란도", ["코란도"]], ["액티언스포츠", ["액티언스포츠"]], ["액티언", ["액티언"]],
  ["카이런", ["카이런"]], ["무쏘", ["무쏘"]], ["체어맨", ["체어맨"]], ["로디우스", ["로디우스"]], ["티볼리", ["티볼리"]],
  ["SM3", ["SM3"]], ["SM5", ["SM5"]], ["SM6", ["SM6"]], ["SM7", ["SM7"]], ["QM3", ["QM3"]], ["QM5", ["QM5"]],
  ["QM6", ["QM6"]], ["XM3", ["XM3"]], ["트위지", ["트위지"]],
];
const SPELLING: [RegExp, string][] = [[/소나타/g, "쏘나타"], [/산타페/g, "싼타페"], [/그랜져/g, "그랜저"], [/엑티언/g, "액티언"]];

// 전기·하이브리드·리무진(개조)은 같은 차체라도 값이 달라 계열을 나눈다.
const variant = (t: string) =>
  /전기|EV|일렉트릭|Z\.E/.test(t) ? " 전기" : /하이브리드|HEV/.test(t) ? " 하이브리드" : /리무진/.test(t) ? " 리무진" : "";

export function modelGroup(...sources: (string | null)[]): string | null {
  for (const s of sources) {
    if (!s) continue;
    let t = s.toUpperCase().replace(/\s+/g, "");
    for (const [re, to] of SPELLING) t = t.replace(re, to);
    for (const [group, pats] of GROUPS) if (pats.some((p) => t.includes(p))) return group + variant(t);
  }
  return null;
}

// 특수 개조·용도 차량. 같은 차체라도 값이 일반 차와 달라 시세 추정 학습에서 뺀다.
const SPECIAL_CATEGORIES = new Set(["특수자동차", "소방및안전및인명구조차", "덤프트럭", "트레일러"]);
const SPECIAL_WORDS =
  /구급|장애|휠체어|리프트|소방|펌프|진개|덤프|고소작업|활선|살수|방제|방역|청소|냉동|탑차|내장|순찰|호송|어린이|목욕|탱크|암롤|압축|압착|수거|세척|크레인|사다리|구조|지휘|경찰|형사|노면|견인|레커|특장|캠핑|진공|급수|주유|교반|방송|중계|검사|수송/;

export function isSpecial(category: string | null, ...texts: (string | null)[]): boolean {
  return (category !== null && SPECIAL_CATEGORIES.has(category)) || texts.some((t) => t !== null && SPECIAL_WORDS.test(t));
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
    model_group: modelGroup(model, name),
    is_special: isSpecial(category, model, name),
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
