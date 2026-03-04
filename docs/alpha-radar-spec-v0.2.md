# Alpha Radar 개발 스펙 v0.2 (Codex용)

## 0) 제품 정의

- 목적: 급등/모멘텀(C 스타일) 단타 유저가 "지금 뜨는 종목"을 빠르게 찾고, 나쁜 급등을 제거(B 전략)하여 진입/손절 결정을 빠르게 하도록 돕는 레이더
- 특징: `Score(0~100) + Tags(복수)` 하이브리드
- 금지(MVP): 자동매매, 뉴스 NLP, 게임, 리딩방

## 1) 데이터/연동 (키움 REST + WebSocket)

- REST: 스캐닝/랭킹/캔들(분봉/일봉 등)로 넓게 훑기
- WebSocket: 실시간 체결/호가 등으로 좁게 추적하기
- 핵심: 전체 시장을 실시간 추적하지 말고 2단 구조로 운영

## 2) 추적 종목 운영 전략 (확정)

### Layer 1 — Market Scan (넓게)

- 대상: 코스피+코스닥 전체(약 2000~2500)
- 방식: REST 기반 5~10초 주기 스캔
- 출력: Candidate Pool 50~100개 (추천 기본값 80)

### Layer 2 — Realtime Tracking (좁게)

- 대상: Candidate Pool에서 상위 20~40개 (추천 30)
- 방식: WebSocket 실시간 추적

### Layer 3 — Hot List (최종)

- 대상: Realtime Tracking에서 Top 5~10개 (추천 8)
- UI에서 "빨간불"은 Hot List 중심으로 표시

구조: 전체(2500) -> 후보(80) -> 실시간(30) -> 핫(8)

## 3) UI 레이아웃 (3영역 고정)

### A. Top Bar: Market State (정량 필터)

- 시장 레짐 상태 1개: `TREND / CHOP / THEME / PANIC` 등
- `Breadth(상승/하락 비율), 거래대금 집중도, 변동성 상태`를 한 줄 요약
- 역할: 시황 해석보다 레이더 민감도/임계값 자동 조정

### B. Center: Momentum Radar (핵심 테이블)

Row 필드:

- 종목명/코드
- Score(0~100)
- Tags(복수)
- 30초/1분 등락, 거래대금(1m), 가속도(Δ), (가능하면) 스프레드/체결밀도

### C. Right: Entry Panel (의사결정 패널)

- 현재가/단기 고점/최근 고점, 간단 지지/저항 후보
- 진입 체크리스트(충족 항목)
- 자동 손절/익절 후보(변동성 기반, 단순)
- 최근 30~120초 미니 타임라인(요약)

## 4) 엔진 설계 핵심: B 전략(나쁜 종목 제거) + Lynch 필터 재해석

### 4.1 기본 철학

- 좋은 종목 추천이 아니라 나쁜 급등(Bad Surge) 제거가 1순위
- Peter Lynch 필터는 장기 철학을 단타용으로 재해석
- 스토리/질 -> 매매 가능한 급등(Attractive Surge) 판별

## 5) 로직 우선순위 (중요 변경점)

- 급등 요소가 메인 트리거
- 거래대금은 서브(필터/신뢰도 판정)

## 6) 신호 파이프라인 (MVP)

### Step 0 — Universe Filter (사전 제외)

- 거래정지/관리/경고 등 리스크 종목 제외(가능하면)
- 초저가/호가단위 과도 종목 제외 옵션

### Step 1 — Surge Trigger (레드 후보 생성, 메인)

트리거 조건(초기값은 튜닝 대상):

- `ΔP_30s (30초 수익률) >= Y`
- `ΔP_1m (1분 수익률) >= X`
- `accel (가속도)` 급증
- `BREAKOUT` (최근 N분/당일 고점 갱신)

### Step 2 — Lynch Attractive Filter (Bad Surge 제거, 서브쿼리)

탈락/강한 감점 조건:

- 거래대금 너무 낮음 (매매 불가/장난 가능성)
- 스프레드 과도 / 체결 밀도 낮음(가능 시)
- 과도한 갭/과확장(추격 위험)
- 급등 후 리버설 패턴(되밀림 반복)

통과/가점 조건:

- 거래대금/참여자 급증 (avg 대비 N배 등)
- 돌파 유지(짧은 시간 내 고점 유지)
- (가능 시) 매도 체결 흡수(가격 안 밀림)

### Step 3 — Event Pattern Tagging (뉴스 API 없이도 패턴으로 추정)

- `NEWS_SURGE / THEME_MOVE / DISCLOSURE_MOVE` 태그는 뉴스 텍스트가 아니라 가격+대금 패턴으로 추정
- 외부 뉴스 API는 MVP에서 제외

### Step 4 — Score 계산 (0~100)

급등 중심으로 가중치 배분:

- `Surge(0~60)`: `ΔP_30s, ΔP_1m, accel, BREAKOUT`
- `Tradeable(0~25)`: 거래대금(최소치 통과 + 상대 증가), (가능시) 스프레드/체결밀도
- `Risk(0~15)`: 과확장/리버설 위험 패널티

## 7) Tags (MVP 최소 6개)

- `SURGE_30S`
- `SURGE_1M`
- `BREAKOUT`
- `TRADEABLE` (대금/체결 조건 통과)
- `OVEREXT` (추격 위험)
- `REVERSAL_RISK` (되밀림 위험)

선택 확장:

- `NEWS_SURGE`
- `THEME_MOVE`
- `DISCLOSURE_MOVE`

## 8) 장 운영 범위

- 기본: 장중 전체(09:00~15:30)
- 옵션: 장 초반(09:00~10:30) 모드(민감도 다르게)

## 9) 실시간 처리 플로우 (구현 관점)

- WS 이벤트 수신 -> `symbol_state` (최근 120초 링버퍼) 갱신
- 1~2초 주기 feature 계산 -> tags 평가 -> score 산출
- Market Scan은 5~10초 주기로 Candidate Pool 갱신
- Candidate Pool 변화 시 WS 구독 종목(30개) 재구성
- Hot List(Top 8) 업데이트 시 UI 레드불 강조 + 알림(토스트/사운드)

## 10) Codex 작업 백로그 (단계별)

### Phase 1: 키움 연결 최소 성공

- [x] OAuth 토큰 발급/재발급
- [x] REST 스캔 API 호출 성공 (랭킹)
- [x] WS 연결 + 종목 등록/해지 성공
- [x] 실시간 체결 수신 확인 (mock 검증 완료, live는 장중/체결 발생 시점 의존)

### Phase 2: 상태 저장/버퍼

- [x] `symbol_state` in-memory (링버퍼 120초)
- [ ] (옵션) Redis/DB (현재는 in-memory 유지)

### Phase 3: 엔진 MVP

- [x] Surge Trigger 구현(30초/1분 변화율 + 가속도)
- [x] Lynch Filter(대금 최소치 + 과확장/리버설 감점) 구현
- [x] Score v0.2 구현
- [x] Tags 6개 구현 (`SURGE_30S`, `SURGE_1M`, `BREAKOUT`, `TRADEABLE`, `OVEREXT`, `REVERSAL_RISK`)

### Phase 4: UI MVP

- [x] 3영역 레이아웃 고정 완성
- [x] Radar Table 실시간 갱신(WS 기반) (`AutoRefresh` 5초 + 백엔드 WS/링버퍼 반영)
- [x] Entry Panel 상세 (현재가/고점/지지저항/손절익절/체크리스트/최근 타임라인)
- [x] Hot List 레드 표시 + 토스트/사운드 알림

### Phase 5: 유저 사용 기능

- [x] 매매일지(진입/청산/메모) (`GET/POST /api/journal`, in-memory)
- [x] 신호 리플레이(지난 5분 되감기) (`GET /api/replay?symbol=...`)

## 11) 현재 미확정(문서 확인 필요)

- WS 구독 종목/타입 동시 제한
- REST 호출 rate limit
- 제약에 따른 Scan 주기 / Tracking 종목 수 재조정
