-- 온비드 차량 공매 입찰결과 (한국자산관리공사, 공공데이터포털 getCltrBidRsltList2)
CREATE TABLE IF NOT EXISTS bids (
  cltr_mng_no     VARCHAR(80)  NOT NULL,             -- 물건관리번호
  pbct_cdtn_no    BIGINT       NOT NULL,             -- 공매조건번호
  name            VARCHAR(300) NOT NULL,             -- 물건명
  category        VARCHAR(100) NULL,                 -- 용도 소분류(승용차, 승합차 ...)
  maker           VARCHAR(50)  NULL,
  model           VARCHAR(300) NULL,                 -- 원문 모델명(공백 정리)
  model_key       VARCHAR(300) NULL,                 -- 공백·엔진 표기를 뺀 모델명
  model_group     VARCHAR(50)  NULL,                 -- 모델 계열(카니발, 올뉴카니발 → 카니발)
  is_special      BOOLEAN      NOT NULL DEFAULT FALSE, -- 구급·소방·순찰 등 특수 개조·용도 차량
  year            SMALLINT     NULL,
  mileage_km      INT          NULL,
  displacement_cc INT          NULL,
  fuel            VARCHAR(100) NULL,
  property_type   VARCHAR(50)  NULL,                 -- 재산유형(불용품, 압류재산 ...)
  appraisal_won   BIGINT       NULL,                 -- 감정가
  min_bid_won     BIGINT       NULL,                 -- 최저입찰가
  price_won       BIGINT       NULL,                 -- 낙찰가
  status_cd       CHAR(4)      NOT NULL,             -- 0010 낙찰, 0011 유찰, 0012 취소 ...
  status          VARCHAR(50)  NOT NULL,
  round_no        VARCHAR(20)  NULL,                 -- 공매 회차
  bidders         INT          NULL,                 -- 유효 입찰자 수
  opened_at       DATETIME     NOT NULL,             -- 개찰일시
  PRIMARY KEY (cltr_mng_no, pbct_cdtn_no),
  KEY idx_status_opened (status_cd, opened_at),
  KEY idx_model_year (model_key, year),
  KEY idx_maker (maker),
  KEY idx_group_year (model_group, year)
);

-- 월별 통계 (한국교통안전공단 자동차 성능점검 건수 등)
CREATE TABLE IF NOT EXISTS monthly_stats (
  metric VARCHAR(40) NOT NULL,
  ym     CHAR(7)     NOT NULL,  -- YYYY-MM
  value  BIGINT      NOT NULL,
  PRIMARY KEY (metric, ym)
);

-- 진행 중 차량 공매 스냅샷(getCarCltrList2)과 처음 본 시점의 예상 낙찰가.
-- 예측(predicted_*)은 처음 저장한 값을 다시 덮어쓰지 않는다: 마감 전에 한 예측임을 보장하기 위해.
CREATE TABLE IF NOT EXISTS listings (
  cltr_mng_no     VARCHAR(80)  NOT NULL,
  pbct_cdtn_no    BIGINT       NOT NULL,
  name            VARCHAR(300) NOT NULL,
  category        VARCHAR(100) NULL,
  car_type        VARCHAR(50)  NULL,                 -- 차종(소형차, 중형차 ...)
  maker           VARCHAR(50)  NULL,
  model           VARCHAR(300) NULL,
  model_group     VARCHAR(50)  NULL,
  is_special      BOOLEAN      NOT NULL DEFAULT FALSE,
  year            SMALLINT     NULL,
  mileage_km      INT          NULL,
  fuel            VARCHAR(100) NULL,
  color           VARCHAR(50)  NULL,
  region          VARCHAR(50)  NULL,                 -- 소재지 시도
  org             VARCHAR(200) NULL,                 -- 공고기관
  property_type   VARCHAR(50)  NULL,
  appraisal_won   BIGINT       NULL,
  min_bid_won     BIGINT       NULL,
  failed_rounds   INT          NULL,                 -- 유찰 횟수
  bid_start_at    DATETIME     NULL,
  bid_end_at      DATETIME     NULL,
  first_seen_at   DATETIME     NOT NULL,
  last_seen_at    DATETIME     NOT NULL,
  predicted_won   BIGINT       NULL,
  predicted_low   BIGINT       NULL,
  predicted_high  BIGINT       NULL,
  predicted_n     INT          NULL,                 -- 예측에 쓴 학습 건수
  predicted_at    DATETIME     NULL,
  PRIMARY KEY (cltr_mng_no, pbct_cdtn_no),
  KEY idx_end (bid_end_at)
);

-- 수집 작업 이력
CREATE TABLE IF NOT EXISTS ingest_runs (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  job         VARCHAR(40)  NOT NULL,
  started_at  DATETIME     NOT NULL,
  finished_at DATETIME     NOT NULL,
  api_calls   INT          NOT NULL,
  row_count   INT          NOT NULL,
  error       VARCHAR(500) NULL
);
