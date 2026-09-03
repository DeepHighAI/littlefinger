# Play Store 등록정보 — 리틀핑거 0.2.0

Date: 2026-08-31. `docs/google_play_store_listing_guide.md`(ASO/CVR 가이드)를 기준으로 작성한
**Play Console에 그대로 붙여 넣는 등록정보 본문**이다. 출시 절차는
`monetization-retention-release.md`, 데이터 보안 답변은 `play-data-safety.md`가 각각 맡는다.

두 가지 하드 제약이 모든 문장에 적용된다.

1. **문구 가드 (CLAUDE.md §8-3)** — 등록정보 어디에도 계약·서명·법적·효력·공증·증거·판결 /
   contract·sign·legally·binding·notar·evidence·verdict 를 쓰지 않는다. 이 앱은 약속을 기록할
   뿐 판정하지 않으며, 벌칙은 적어 둔 텍스트 기록일 뿐이다(§8-6: 금전 예치·자동 정산 금지).
   **콘솔에 붙여 넣는 8개 블록(§1-1·§1-2·§1-3·§1-4·§5)에는 위 단어가 0건**임을 기계 검사로
   확인했다. 문서 다른 곳의 등장(§9 가드 목록, §6의 "Google sign-in", §7의 "evidence photos")은
   운영자 지시문이라 등록정보가 아니다.
2. **Play 메타데이터 정책 (가이드 §3-1)** — 앱 이름·아이콘·피처 그래픽에 1위/최고/No.1/Best/
   무료/특가 같은 홍보 수식어 금지, 쉼표·해시태그 키워드 나열 금지, 출처 불명 추천사 금지.

PO 확정: **등록정보 언어 ko-KR + en-US 두 벌**(2026-08-31). 기본 카테고리는 2026-08-31에
라이프스타일로 정했으나 콘솔 입력은 **커뮤니케이션**으로 됐고, PO가 2026-09-03에 콘솔 값 유지를
결정했다(§3).

콘솔 실제 상태와 남은 PO 콘솔 작업은 `open-testing-po-guide.md`가 단계별로 안내한다
(2026-09-03 콘솔 대조 기준).

---

## 1. 텍스트 메타데이터

### 1-1. 앱 이름 (Title, 최대 30자)

**등록값 (ko-KR)**

```
리틀핑거 - 둘이 지키는 약속 기록
```

**등록값 (en-US)**

```
Littlefinger: Promises Kept
```

19자 / 27자. 가이드 §1.2 (1)의 `[브랜드명] - [핵심 기능·가치]` 구조이고 핵심 키워드 **약속**과
**약속 기록**을 이름에 담았다.

**브랜드 단독명을 쓰지 않는 이유** — 오픈 이슈 N-1(`기획/01` §15): 동명 회사 *리틀핑거 주식회사*
(영유아용품)와 Play 앱 *Little Fingers*가 이미 존재한다. 수식어가 붙은 위 이름이 검색 혼동과
상표 마찰을 동시에 줄인다. **상표 확인은 공개 전 PO 몫이다.**

**A/B 후보** (가이드 §4.2 스토어 등록정보 실험 — 한 번에 한 변수만):

| 안 | 값 | 자수 | 노림수 |
|---|---|---:|---|
| A (등록값) | `리틀핑거 - 둘이 지키는 약속 기록` | 19 | 브랜드 각인 + 핵심 키워드 |
| B | `약속 기록·리마인드 - 리틀핑거` | 17 | 검색 가중치 최상위 자리에 키워드 |
| C | `리틀핑거 - 약속 기록·알림·증인` | 18 | 시그니처 기능(증인) 롱테일 |

### 1-2. 간단한 설명 (Short Description, 최대 80자)

**ko-KR** (55자)

```
둘이 정한 약속을 그대로 기록하고, 종료일까지 챙겨주는 약속 관리. 상대는 앱 설치 없이 승인해요.
```

**en-US** (72자)

```
Record the promise you two made, get reminders, and confirm how it went.
```

첫 문장이 "왜 나에게 필요한가"에 답한다: 기록 → 챙김 → 상대의 진입장벽 제거(P6, 최대 차별점).

수락 웹의 SEO 메타(`apps/web/index.html`, `seo.test.ts`가 고정)에도 같은 성격의 한 줄이 있다 —
"두 사람의 약속을 기록하고 지키도록 돕는 상호 약속 관리 서비스. …". 어휘(`약속`·`기록`·
`약속 관리`)는 일부러 같게 맞췄지만 **대상이 다르다**: 메타의 뒷문장은 카톡 링크로 들어온
*상대방*에게 말하고, Play 등록정보는 약속을 만드는 *작성자*에게 말한다. 한쪽을 고칠 때 다른
쪽을 자동으로 따라 고치지 말고, 대상이 맞는지부터 본다.

### 1-3. 자세한 설명 (Full Description, 최대 4,000자) — ko-KR

```
"그때 그렇게 하기로 했잖아."
카톡에서 오간 약속은 대화에 묻히고, 시간이 지나면 서로 기억이 달라집니다.
리틀핑거는 두 사람이 함께 정한 약속을 하나의 기록으로 남기고, 종료일까지 잊지 않게 챙겨주는 상호 약속 관리 앱입니다. 무겁지 않게, 새끼손가락 걸듯 가볍게 시작하세요.

■ 이렇게 사용해요

• 약속 작성 — 약속 내용, 지킬 사람, 종료일, 보상과 벌칙까지 적어 두면 나중에 말이 엇갈리지 않아요.
• 카톡으로 초대 — 링크 하나면 끝. 상대는 앱을 설치하지 않아도, 아이폰에서도 웹으로 열어 승인할 수 있어요.
• 함께 확정 — 두 사람이 모두 승인해야 약속이 시작돼요. 확정된 약속 기록은 그대로 보관됩니다.
• 리마인드 — D-7 / D-3 / D-1 / 당일에 알려드려요. 받을 시각과 주기는 직접 고를 수 있어요.
• 이행 확인 — 종료일이 되면 두 사람에게 "약속 지켜졌나요?" 하고 물어봐요. 사진을 함께 남길 수도 있어요.
• 증인 — 친구를 증인으로 부르면(약속당 최대 3명) 두 사람의 약속을 옆에서 확인해 줘요.
• 약속 지킴율 — 내가 지키기로 한 약속을 얼마나 지켰는지 프로필에 쌓여요.

■ 이런 분들께 추천해요

- 커플 — "게임 줄일게", "연락 잘할게" 같은 다짐을 눈에 보이게 남기고 싶은 분
- 친구 — 다이어트 내기, 소소한 벌칙 내기를 제대로 기록해 두고 싶은 분
- 혼자 하는 목표 관리가 자꾸 흐지부지되는 분
- 상대에게 앱 설치를 부탁하기 미안한 분 (상대는 웹으로 참여해요)

■ 리틀핑거가 지키는 원칙

- 두 사람이 함께 정합니다. 내용을 바꾸는 것도, 약속을 그만두는 것도 양쪽이 동의해야 해요.
- 확정된 기록은 바뀌지 않습니다. 바꾸고 싶으면 새 버전으로 다시 합의해요.
- 앱은 판정하지 않습니다. 서로 답이 엇갈리면 두 사람의 이야기를 나란히 기록만 해요.
- 벌칙은 적어 두는 기록일 뿐입니다. 리틀핑거는 돈을 맡아 두거나 대신 받아 주지 않아요.
- 약속을 만들고 승인하는 순간에는 배너 광고를 띄우지 않습니다.

■ 안전하게 보관해요

- 사진은 위치 정보를 지운 뒤 비공개로 보관하고, 약속에 참여한 사람에게만 잠깐 열리는 링크로 보여줘요.
- 끝난 약속은 30일 동안 볼 수 있어요. 광고로 30일씩 늘리거나 영구 보관을 구매할 수 있어요.
- 언제든 탈퇴하고 내 기록을 삭제할 수 있어요.
- 개인정보처리방침 https://littlefinger-app.web.app/legal/privacy
- 문의 task@deephigh.ai

■ 유료 상품 안내

- 기본 기능은 결제 없이 쓸 수 있어요. 약속은 동시에 5개까지 만들 수 있어요.
- 약속 슬롯 추가 ₩1,000 / 약속별 영구 보관 ₩2,000 (실제 가격은 스토어 표시가를 따릅니다)
- 증인 자리, 기간 연장, 기록 보관 연장은 보상형 광고를 직접 선택해 볼 때만 열려요.

리틀핑거는 두 사람의 약속을 기록하고 챙겨주는 서비스예요. 약속을 지켰는지 판정하거나 강제로 이행하게 하지 않습니다.

새끼손가락 걸고, 약속!
```

### 1-4. 자세한 설명 (Full Description) — en-US

기계번역이 아니라 인앱 en 라벨의 톤(`Pinky swear, it's a promise!`)을 이어받아 따로 썼다.

```
"But we agreed on it back then."
Promises made in a chat thread get buried, and weeks later the two of you remember them differently.
Littlefinger keeps the promise you made together as one record and looks after it until the end date. Nothing heavy — just link pinkies and start.

■ How it works

• Write it down — the promise, who keeps it, the end date, the reward and the forfeit. Nothing is left to memory.
• Invite by KakaoTalk — one link. The other person approves on the web, with nothing to install, iPhone included.
• Confirm together — the promise starts only once you both approve, and the confirmed record stays as it is.
• Reminders — D-7 / D-3 / D-1 and the day itself. You pick the timing.
• Check in — on the end date you both answer "was it kept?", with a photo if you want.
• Witnesses — bring a friend in (up to 3 per promise) to look on and confirm what you agreed.
• Keep rate — your profile builds up how many of your own promises you kept.

■ Who it's for

- Couples who want "I'll cut down on gaming" to be more than a passing line
- Friends running a diet bet or a small forfeit
- Anyone whose solo goals keep fizzling out
- Anyone who would rather not ask the other person to install an app

■ What Littlefinger will not do

- Nothing moves without both of you. Edits and cancellations need both approvals.
- A confirmed record is never rewritten. Changing it means agreeing on a new version.
- The app never decides who is right. If your answers differ, both sides are recorded next to each other.
- A forfeit is text you wrote down, nothing more. Littlefinger never holds or collects money.
- No banner ads while you write, review, approve or check a promise.

■ Your data

- Photos are stored privately with location data stripped, and shown only to the people in the promise through short-lived links.
- A finished promise stays visible for 30 days. Add 30 more days with an ad, or buy permanent access.
- You can leave and delete your records at any time.
- Privacy policy https://littlefinger-app.web.app/legal/privacy
- Support task@deephigh.ai

■ Paid items

- The core features need no payment. You can run 5 promises at a time.
- Extra promise slot ₩1,000 / permanent access to one promise ₩2,000 (the price your store shows applies).
- Extra witness spots, longer promises and longer record keeping open only when you choose to watch a rewarded ad.

Littlefinger records the promise between two people and looks after it. It does not judge whether it was kept, and it does not enforce anything.

Pinky swear, it's a promise!
```

### 1-5. 키워드 계획

| 구분 | 키워드 | 배치 |
|---|---|---|
| 주 키워드 | 약속, 약속 기록, 약속 관리 | 앱 이름 · 간단한 설명 첫 문장 · 자세한 설명 도입부와 기능 불릿 |
| 보조 | 리마인드, 이행 확인, 증인, 약속 지킴율 | 기능 불릿 소제목 |
| 롱테일 | 커플, 친구, 내기, 다짐, 습관 | "이런 분들께 추천해요" |

밀도 목표 2~3%. **쉼표 나열식 스터핑 금지** — 위 키워드는 모두 문장 안에서만 반복된다.
"무료"는 정책 리스크가 있어 이름·간단한 설명·그래픽에 쓰지 않았고, 본문에서도 "결제 없이 쓸 수
있어요"로 우회했다.

---

## 2. 그래픽 애셋

### 2-1. 규격과 제작 상태

| 애셋 | 규격 | 파일 | 상태 |
|---|---|---|---|
| 앱 아이콘 | 512×512, 32-bit PNG, 투명도 없음, 1MB 이하 | `docs/디자인/store/store-icon-512.png` (21 KB, alpha 전 픽셀 255) | ✅ 콘솔 등록 완료 (2026-09-03 확인) |
| 피처 그래픽 (ko) | 1024×500, 24-bit PNG | `docs/디자인/store/feature-graphic-1024x500.png` (83 KB) | ✅ 콘솔 등록 완료 — PO가 업로드로 승인 (2026-09-03) |
| 피처 그래픽 (en) | 1024×500, 24-bit PNG | `docs/디자인/store/feature-graphic-1024x500-en.png` (91 KB) | ✅ 콘솔 등록 완료 (2026-09-03) |
| 스크린샷 | 휴대전화 9:16, 8장 | 원본 파일은 PO 보관(저장소에 없음) | ✅ 콘솔 8/8 등록 (2026-09-03) — 갤러리 렌더 + 상단 버터 밴드 오버레이 스토리보드 |
| 태블릿 스크린샷 (7·10인치) | 선택 | — | ⬜ 미등록 — 등록정보는 "검토를 위해 전송 준비 완료" 상태라 필수 아님 |
| 홍보 동영상 | YouTube URL | — | ⛔ 미제작, 이번 범위 밖 |

아이콘은 ADR 0016의 런처 아트워크(`apps/mobile/assets/images/icon.png`, 1024² 버터 필드 +
페이퍼 화이트 손 + 잉크 외곽선)를 512로 축소하고 알파를 버터로 flatten 한 것이다. 런처 아트가
바뀌면 이 파일도 다시 뽑아야 한다.

피처 그래픽은 잉크&스티커 시스템(크림 `#F3ECDC` 캔버스 + 버터 `#F6E7A3` 스티커 카드 + 잉크
`#221C13` 6px 테두리와 하드 오프셋 그림자 + Pretendard ExtraBold/SemiBold)으로 조립했다.
카피는 인앱 태그라인 `새끼손가락 걸고, 약속!` / `Pinky swear, it's a promise!` 와 부제
`둘이 지키는 약속 기록` / `The promises you two keep`. 홍보 수식어는 없다.

### 2-2. 스크린샷 스토리보드 (8장)

**2026-09-03 등록본**은 `design-reference/screens/` 갤러리 렌더에 상단 버터 밴드 오버레이를 얹어
PO가 만든 8장이다(실기기 캡처가 아님). 아래 규칙은 **다음 갱신** 때 적용한다:
소스는 내부 테스트 빌드를 올린 실기기에서 1080×2400으로 캡처하고, 최종 등록 파일은
1080×1920(9:16) 24-bit PNG로 내보낸다. Play는 장변이 단변의 2배를 넘는 이미지를 받지
않으므로 1080×2400 원본을 그대로 올리면 안 된다. 기기 QA
(`docs/qa/ADR0015_DEVICE_QA.md`) 때 같이 찍는다. 아래는 촬영 지시서이고, 소스 화면은 모두
`design-reference/screens/`에 실재한다(`npm run preview`로 확인 가능).

| # | 소스 화면 | 상단 오버레이 카피 (ko / en) | 무엇을 증명하는가 |
|---:|---|---|---|
| 1 | `scr-a02-home.html` | 약속이 한눈에, 잊지 않게 / Every promise, in one place | **훅** — 앱을 열면 뭘 보게 되는가 |
| 2 | `scr-a03-promise-create.html` | 보상도 벌칙도 함께 적어요 / Reward and forfeit, written down | 주력 기능 — 합의 "내용"을 다룬다 |
| 3 | `scr-a04-invite-sent.html` | 카톡 링크 하나면 끝 / One KakaoTalk link is all it takes | **차별점** — 초대 동선 |
| 4 | `web/scr-w02-promise-review.html` | 상대는 앱 설치 없이 승인해요 / They approve on the web, no install | **차별점 증명** — 아이폰 상대도 참여 |
| 5 | `scr-a06-fulfillment-check.html` | 종료일에 서로 확인해요 / On the end date you both check in | 이행 확인 루프 |
| 6 | `mod-02-witness-invite.html` | 친구를 증인으로 불러요 / Bring a friend in as a witness | 시그니처 기능 |
| 7 | `scr-a08-profile.html` | 약속 지킴율이 쌓여요 / Your keep rate adds up | 리텐션 동력 |
| 8 | `mod-03-completion-celebrate.html` | 지켰다면, 같이 축하해요 / Kept it? Celebrate together | 감정 마무리 |

오버레이 규칙: 상단 1줄, Pretendard ExtraBold, 잉크 `#221C13`, 버터 `#F6E7A3` 밴드 위.
카피 영역은 전체 높이의 20% 이내이고, 앱 화면을 찌그러뜨리지 않는다. 1~3번에 가장 강한
가치를 배치한다(가이드 §2.2). 캡처에 실명·실제 전화번호·테스트 계정 이메일이 보이면 안 된다.
상태 표시줄의 통신사명·알림 아이콘 등 불필요한 요소는 최종본에서 제외한다.

---

## 3. 카테고리와 태그

| 항목 | 값 |
|---|---|
| 앱/게임 | 앱 |
| 기본 카테고리 | **커뮤니케이션** (콘솔 실제값 · PO 유지 결정 2026-09-03; 2026-08-31 안은 라이프스타일) |
| 태그 (5개) | **데이트 · 소셜 · 엔터테인먼트 · 장난 · 커뮤니케이션** (콘솔 선택값, PO 유지 결정 2026-09-03) |

당초 태그 우선순위 안은 ① 관계 ② 미리 알림·알림 ③ 할 일·계획 ④ 일상 기록 ⑤ 습관·자기 관리
⑥ 커플이었다. **Play Console이 제공하는 목록이 정본이며 임의 태그는 입력할 수 없다** — 위
표의 5개가 실제 선택값이고, 바꾸면 이 표를 다시 적는다.

생산성 카테고리는 검토했으나 "혼자 쓰는 할 일 앱"으로 오인될 위험이 커서 탈락했다.

---

## 4. 연락처 · URL · 개발자 정보

| Play Console 항목 | 값 |
|---|---|
| 개발자 이메일 | `task@deephigh.ai` |
| 개발자 웹사이트 | `https://littlefinger-app.web.app` (AdMob이 `app-ads.txt`를 크롤링) |
| 개인정보처리방침 URL | `https://littlefinger-app.web.app/legal/privacy` (버전 `2026-08-30.1`) |
| 이용약관 URL | `https://littlefinger-app.web.app/legal/terms` (버전 `2026-08-30.1`) |
| 계정 삭제 URL | `https://littlefinger-app.web.app/account-deletion` |
| 전화번호 | 02-3443-1028 |
| 판매자 정보 | 주식회사 딥하이 · 대표 심충섭 · 사업자등록번호 798-86-01094 · 통신판매업 신고번호 **2026-대구북구-0751** · 대구광역시 북구 검단로 50 (복현동, 복현서한타운) 110동 202호 |

정본은 `apps/web/src/legal/legal-content.ts`. 콘솔 값이 이 파일과 어긋나면 파일이 맞다.

---

## 5. 출시 노트 (What's new, 각 500자 이하)

`ko-KR`과 `en-US` 출시 노트에 그대로 붙여 넣는다.

**ko-KR** (281자)

```
0.2.0 새로운 기능
• 증인 자리 늘리기: 광고를 보면 이 약속의 증인 자리가 하나 더 열려요.
• 약속 기간 늘리기: 작성자는 광고를 보고 종료일 범위를 30일씩 늘릴 수 있어요.
• 내 기록 보관하기: 끝난 약속의 기록은 30일 동안 보관돼요. 광고로 30일씩 늘리거나 영구 보관(₩2,000)을 구매할 수 있어요.
• 종료일 없는 약속: 영구 보관을 구매한 작성자는 종료일 없이 약속을 제안할 수 있고, 두 사람이 합의해 마무리해요.
• 홈 목록에 약속이 6개 이상이면 광고가 한 번 표시돼요.
```

**en-US** (476자)

```
What's new in 0.2.0
• Extra witness spot: watch an ad to open one more witness spot on a promise.
• Longer promises: the creator can watch an ad to extend the end-date range by 30 days.
• Keep your record: finished promises stay for 30 days. Add 30 days with an ad, or buy permanent access (₩2,000).
• Open-ended promises: a creator with permanent access can propose no end date; you both agree when to finish.
• One banner ad appears in the home list at six or more promises.
```

Prices shown are the ₩2,000 display fallback; the store-localized price is authoritative
(ADR 0015 D5), so the note says "₩2,000" only in the Korean and English notes for the KR storefront.

---

## 6. 등록정보 · 앱 콘텐츠 플래그

| Play Console location | Set to | Why |
|---|---|---|
| 앱 콘텐츠 → 광고 | **예, 광고 포함** | A02 banner + three native slots + rewarded units (ADR 0009, 0015) |
| 인앱 상품 (수익 창출) | `promise_slot_plus1` ₩1,000 and `promise_permanent_access` ₩2,000 both **활성** | Play derives the "인앱 구매" badge from active products; there is no separate toggle |
| 앱 콘텐츠 → 콘텐츠 등급 (IARC) | Answer **yes** to digital purchases and **yes** to ads; no user-generated public content (promise text is shared only with invited participants) | Badge and rating consistency |
| 앱 콘텐츠 → 타겟층 및 콘텐츠 | **만 14세 이상**: tick 13–15, 16–17, 18+ (never 12 and under) | Terms require 만 14세 이상. Ticking 13–15 requires AdMob "최대 광고 콘텐츠 등급" ≤ T — PO to confirm in AdMob → 앱 → 차단 제어 |
| 앱 콘텐츠 → 데이터 보안 | Re-submit from `docs/setup/play-data-safety.md` | See §8 |
| 앱 콘텐츠 → **광고 ID** | **예 · 광고 또는 마케팅** | `react-native-google-mobile-ads` adds `com.google.android.gms.permission.AD_ID`; without this declaration a targetSdk 33+ release cannot be submitted — it was the one item locking 게시 개요 on 2026-09-03 |
| 앱 콘텐츠 → 로그인 세부정보 | **일부 기능 제한** + Google/카카오 로그인 안내 (`open-testing-po-guide.md` §3) | Login is mandatory; the 2026-09-03 console value "no special access needed" risks an access rejection |
| 스토어 설정 → 스토어 등록정보 → 개발자 웹사이트 | `https://littlefinger-app.web.app` | AdMob crawls it for `app-ads.txt` |
| 개인정보처리방침 URL | `https://littlefinger-app.web.app/legal/privacy` | Must be the 2026-08-30.1 page |
| 계정 삭제 URL (데이터 보안) | `https://littlefinger-app.web.app/account-deletion` | Unchanged |
| 앱 액세스 권한 | "일부 기능 제한" with license-tester instructions: Google sign-in, then the reviewer account listed in 라이선스 테스트 | Reviewers must reach a rewarded row and the ₩2,000 sheet |

## 7. Permission set to verify in the AAB manifest

Run `java -jar bundletool-all-1.18.1.jar dump manifest --bundle dist/littlefinger-internal-v0.2.0-code<N>.aab`
(runbook §2-6) and compare every `<uses-permission>` against this table. This is a **check list,
not an expectation list** — the Expo plugins merge their own permissions and the exact set is only
known from the dump.

| Permission | Must be | Source |
|---|---|---|
| `android.permission.INTERNET` | present | app |
| `com.google.android.gms.permission.AD_ID` | present | `react-native-google-mobile-ads` — required because 광고 = 예; if absent, the Data safety "advertising ID" answer is wrong the other way |
| `com.android.vending.BILLING` | present | `expo-iap` — required for both products |
| `android.permission.POST_NOTIFICATIONS` | present | `expo-notifications` (Android 13+) |
| `android.permission.ACCESS_NETWORK_STATE` | expected | ads SDK / Expo |
| `android.permission.VIBRATE`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, `com.google.android.c2dm.permission.RECEIVE` | expected | `expo-notifications` + FCM |
| `android.permission.READ_MEDIA_IMAGES` / `READ_EXTERNAL_STORAGE` (maxSdk 32) | expected | `expo-image-picker` (evidence photos) |
| `android.permission.CAMERA`, `RECORD_AUDIO` | **finding if present** — the picker is gallery-only. Found in the code 19 dump (2026-09-03); removed from code 21 on by `android.blockedPermissions` in `app.json`, locked by `apps/mobile/config/android-permissions.test.js` | `expo-image-picker` default merge |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `READ_PHONE_STATE`, `SYSTEM_ALERT_WINDOW`, `READ_CONTACTS`, `QUERY_ALL_PACKAGES` | **must be absent** — `SYSTEM_ALERT_WINDOW` came from the Expo template and was present through code 20; blocked from code 21 | none justified; any of them is a release blocker |

Also confirm from the same dump: `package="com.littlefinger.app"`, `versionCode="<N>"`,
`versionName="0.2.0"`, `minSdkVersion 24`, `targetSdkVersion 36`, and that the
`react-native-google-mobile-ads` `APPLICATION_ID` meta-data is the real `ca-app-pub-…~…` app id,
not the Google test id `ca-app-pub-3940256099942544~3347511713` (a production build carrying the
test app id means the EAS environment was not applied).

Record the final permission list in `docs/DEVELOPMENT_STATUS.md` next to the build code.

## 8. Data safety diff (pointer)

The form answers live in `docs/setup/play-data-safety.md` and are maintained there. What changed
in this batch and therefore needs re-submission of the form:

- Rewarded ads: AdMob server-side verification sends the advertising id and an opaque per-user id
  to Google (ADR 0015 D6).
- Purchases: Play purchase tokens for `promise_permanent_access` are verified server-side and
  bound to user + promise (D5).
- Retention: records are deleted per participant after expiry, with a de-identified aggregate kept
  for keepRate (D4) — affects the "data deletion" answers.
- Legal documents are 2026-08-30.1 (terms + privacy).

## 9. Wording guard (§8-3)

Before saving any listing field, search the text for: 계약, 서명, 법적, 효력, 공증, 증거, 판결,
contract, sign, legally, binding, notar, evidence, verdict. None may appear. Preferred words:
약속 / 기록 / 확인 / 증인 / 지킴율; promise / record / confirm / witness / keep rate. The app
description must not claim the record has legal effect and must not describe the 벌칙 as anything
other than a text record.

`기획/01` §10의 디스클레이머 원문은 이 가드에 걸리는 단어를 포함하므로 **등록정보에는 원문을
쓰지 않는다.** §1-3 마지막 문단이 같은 뜻의 제품 카피 버전이다.

---

## 10. 출시 전 최종 점검 (가이드 §5)

| 항목 | 판정 | 근거 |
|---|:--:|---|
| 앱 이름 30자 이내 + 핵심 키워드 | ✅ | ko 19자 / en 27자, "약속·약속 기록" 포함 |
| 간단한 설명 80자 이내 + 가치 제안 명확 | ✅ | ko 55자 / en 72자 |
| 자세한 설명이 불릿 구조로 읽기 쉬움 | ✅ | 5개 섹션, 기능 7불릿, ko 1,493자 / en 2,562자 |
| 금지 홍보 문구 배제 | ✅ | 1위·최고·No.1·Best·무료·특가 0건 (§1-5) |
| 아이콘 512×512 / 피처 그래픽 1024×500 규격 | ✅ | `magick identify` 확인, 아이콘 alpha 전 픽셀 255 |
| 첫 3장 스크린샷에 최강 가치 | ✅ | 콘솔 8/8 등록(2026-09-03), §2-2 스토리보드 순서 |
| 카테고리 1개 + 태그 5개 | ✅ | 커뮤니케이션 + 5태그, 콘솔 선택값을 §3에 기록 (PO 2026-09-03) |
| 앱 이름 콘솔 값 = §1-1 등록값 | ⚠️ | 2026-09-03 콘솔은 ko `리틀핑거` / en `Liitlefinger-promise`(오타) — PO가 §1-1 값으로 교체 (`open-testing-po-guide.md` §2) |
| 개발자 연락처·웹사이트·방침 URL | ✅ | §4 |

자수는 **NFC 정규화 후 코드포인트** 기준으로 셌다(`02` §2-3의 계수 규칙과 동일). 문구를 고치면
다시 세고 이 표의 숫자를 갱신한다.

## 11. 공개 전 남은 차단 요인

1. **외부 법무 검토** — 약관·방침 `2026-08-30.2`가 스토어 공개 전 필수
   (`docs/DEVELOPMENT_STATUS.md`). 공개 테스트는 공개 트랙이므로 `.2` 없이 진행할지는 PO 판단
   (`open-testing-po-guide.md` §8-1).
2. **광고 ID 선언 + 앱 이름 교체 + 로그인 세부정보** — PO 콘솔 작업(`open-testing-po-guide.md` §1–§3).
3. **상표(N-1)** — '리틀핑거' 동명 회사·유사 앱 확인. 수식어 이름으로 완화.
4. **AdMob 계정 승인 대기** — 앱과 Play 등록정보 연결 전까지 실광고 미노출
   (`monetization-retention-release.md`).

해결: 스크린샷 8장·피처 그래픽은 2026-09-03 콘솔 등록으로 종결(§2-1).
