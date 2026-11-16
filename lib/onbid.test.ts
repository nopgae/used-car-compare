import { describe, expect, it } from "vitest";
import { isSpecial, modelGroup, modelKey, normalizeMaker, parsePrice, toListing, toRow } from "./onbid.ts";

// 2026-10 실제 응답에서 가져온 한 건(필드 일부)
const sample = {
  cltrMngNo: "2026-1100-057000",
  pbctCdtnNo: 6249000,
  onbidCltrNm: "기아자동차 대형 승용 카니발 2,199cc - 66소2",
  cltrUsgSclsCtgrNm: "승용차",
  prptDivNm: "불용품",
  apslEvlAmt: null,
  lowstBidPrcIndctCont: "비공개",
  cltrOpbdDt: "202610281100",
  pbctStatCd: "0010",
  pbctStatNm: "낙찰",
  scfbAmt: "6670000",
  vldBddrNope: 12,
  drvDstc: 65426,
  cltrMkrNm: null,
  carMdlNm: " 카니발",
  yrmdl: "2015",
  fuelCont: null,
  dsvlm: 2199,
  pbctNsq: "1",
};

describe("toRow", () => {
  it("실제 응답 한 건을 행으로 바꾼다", () => {
    expect(toRow(sample, 2026)).toMatchObject({
      maker: "기아",
      model: "카니발",
      model_key: "카니발",
      year: 2015,
      mileage_km: 65426,
      price_won: 6670000,
      min_bid_won: null,
      opened_at: "2026-10-28 11:00:00",
    });
  });

  it("차가 아닌 장비와 날짜가 없는 행은 버린다", () => {
    expect(toRow({ ...sample, cltrUsgSclsCtgrNm: "지게차" })).toBeNull();
    expect(toRow({ ...sample, cltrOpbdDt: null })).toBeNull();
  });

  it("말이 안 되는 연식과 주행거리 0은 비운다", () => {
    expect(toRow({ ...sample, yrmdl: "2099", drvDstc: 0 }, 2026)).toMatchObject({ year: null, mileage_km: null });
    expect(toRow({ ...sample, drvDstc: 9_999_999_999, dsvlm: 24979, fuelCont: "-" })).toMatchObject({
      mileage_km: null, displacement_cc: null, fuel: null,
    });
  });
});

describe("helpers", () => {
  it("제조사 표기를 합친다", () => {
    expect(normalizeMaker(null, "쉐보레(GM대우) 경차 마티즈")).toBe("쉐보레(GM대우)");
    expect(normalizeMaker("현대자동차")).toBe("현대");
    expect(normalizeMaker("에이엠특장")).toBeNull();
  });

  it("모델 키에서 공백과 엔진 사양을 뺀다", () => {
    expect(modelKey("스파크 1.0 DOHC")).toBe("스파크");
    expect(modelKey("그랜드 스타렉스")).toBe(modelKey("그랜드스타렉스"));
    expect(modelKey("K5 하이브리드")).toBe("K5하이브리드");
  });

  it("여러 건이 이어진 낙찰가는 버린다", () => {
    expect(parsePrice("5790000")).toBe(5790000);
    expect(parsePrice("100|200")).toBeNull();
    expect(parsePrice(null)).toBeNull();
  });
});

describe("modelGroup / isSpecial", () => {
  it("표기·세대가 달라도 같은 계열로 묶는다", () => {
    expect(modelGroup("올뉴카니발")).toBe("카니발");
    expect(modelGroup("그랜드 카니발")).toBe("카니발");
    expect(modelGroup("포터Ⅱ(PORTERⅡ)")).toBe("포터");
    expect(modelGroup("NF소나타")).toBe("쏘나타");
    expect(modelGroup("그랜드스타렉스")).toBe("그랜드스타렉스");
    expect(modelGroup("스타렉스(STAREX)")).toBe("스타렉스");
    expect(modelGroup("렉스턴스포츠 칸")).toBe("렉스턴스포츠");
    expect(modelGroup("제네시스 G80")).toBe("G80");
    expect(modelGroup("BS090", "대우 중형승합 BS090")).toBeNull();
    expect(modelGroup("그레이스 터보 15인승")).toBe("그레이스");
    expect(modelGroup("레이전기차")).toBe("레이 전기");
    expect(modelGroup("SM3 Z.E.")).toBe("SM3 전기");
    expect(modelGroup("K5 하이브리드")).toBe("K5 하이브리드");
    expect(modelGroup("카니발 하이리무진")).toBe("카니발 리무진");
  });

  it("모델명에 계열이 없으면 물건명에서 찾는다", () => {
    expect(modelGroup(null, "기아자동차 대형 승용 카니발 2,199cc")).toBe("카니발");
  });

  it("특수 개조·용도 차량을 가려낸다", () => {
    expect(isSpecial("승합차", "오텍그랜드스타렉스장애인차")).toBe(true);
    expect(isSpecial("승용차", "아반떼 순찰차")).toBe(true);
    expect(isSpecial("특수자동차", "마이티")).toBe(true);
    expect(isSpecial("승용차", "카니발", "기아자동차 대형 승용 카니발 2,199cc")).toBe(false);
  });
});

describe("toListing", () => {
  it("진행 중 공매 한 건(2026-11 실제 응답 일부)을 행으로", () => {
    const row = toListing({
      cltrMngNo: "2026-1100-060474", pbctCdtnNo: 6270672, onbidCltrNm: "엑센트, 현대자동차", cltrUsgSclsCtgrNm: "승용차",
      prptDivNm: "불용품", cltrBidBgngDt: "202611060900", cltrBidEndDt: "202611121800", apslEvlAmt: 1000000,
      lowstBidPrcIndctCont: "1000000", lctnSdnm: "전북특별자치도", orgNm: "장수군청", cltrMkrNm: "현대", carVhknNm: "소형차",
      carMdlNm: "엑센트", yrmdl: "2011", drvDstc: 249430, fuelCont: "가솔린", usbdNft: 0,
    }, 2026);
    expect(row).toMatchObject({
      model_group: "엑센트", maker: "현대", year: 2011, mileage_km: 249430, region: "전북특별자치도",
      min_bid_won: 1000000, bid_end_at: "2026-11-12 18:00:00", is_special: false,
    });
  });
});
