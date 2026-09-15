# SEO → AEO → GEO for Littlefinger: independent research and critical review (Claude)

Research date: 2026-09-15 (KST). Author: the adjacent Claude Code terminal (Orca task
`task_aa0576ed4b9d`). Companion to Codex's [evidence brief](2026-09-15-research.md),
[strategy](strategy.md), [content drafts](content-drafts.md) and [measurement runbook](measurement.md).
Scope: the real product — a mutual promise record between two people (Android creator, web
partner). Not a calendar, legal contract, debt-collection, habit-tracker or iOS product.

This file records evidence and recommendations only. No files outside this one were changed, no
deploy or commit was run, no console was touched, and no outreach was sent. Every number below is
either a quoted platform statement or a live observation made today; there is no keyword volume,
ranking or efficacy estimate anywhere in this document, because none was measured.

---

## 1. Executive summary

1. **Google says AEO/GEO is SEO.** The current Google guide states that optimizing for AI Overviews
   and AI Mode "is still SEO", that `llms.txt`, content chunking, AI-specific rewriting, artificial
   mentions and special schema are unnecessary, and that a page must be indexed *and* included in
   the Search Console generative-AI setting to appear at all. [C1]
2. **Korea is a two-engine market.** StatCounter shows Google and Naver within three points of each
   other in August 2026 [C22]. That is a sampled page-referral share, not a count of people, but it
   is enough to say that a plan following only Google documentation leaves the Naver side
   unaddressed. Naver's own guide answers the technical questions (crawler `Yeti`,
   robots/sitemap rules, SPA rendering, report semantics) and Naver's AI answers (AI 브리핑, AI탭)
   are documented by Naver as drawing on the Naver ecosystem (blog, cafe, place). [C10–C21]
3. **AI citation is visibility, not traffic.** The only independent click data found (Pew, US, 2025)
   shows links inside AI summaries were clicked in 1% of visits [C23]; a 2026 preregistered
   experiment finds AI features reduce publisher click-through [C27]; a 2026 critical survey of 45
   GEO studies finds no technique with a stable causal effect on discoverability [C26]. Google's
   counter-claim of "higher engagement" is unquantified [C4]. Plan for citations to be measured, not
   monetized.
4. **The live site is not yet crawl-ready.** `/robots.txt`, `/sitemap.xml` and every unknown path
   return the 2,377-byte SPA shell with HTTP 200 [C39]; there is no canonical, no per-route title,
   and the two public legal pages other than privacy are empty shells in the served HTML. Naver
   states an HTML-typed robots.txt may be treated as absent and a 5xx as "disallow all". [C11]
5. **The Play listing and the web disagree on positioning.** The live listing title is
   `리틀핑거 - 보상을 걸고 지키는 약속` and its copy leads with 보상 [C40]; the web home and the
   repo's listing document lead with `둘이 지키는 약속 기록`. This is a PO decision before any
   content is published (drafting can continue), because both search engines and the brand-name
   collision (open issue N-1) reward one consistent phrase. Asked to the PO on 2026-09-15; pending.
6. **Recommended first batch** (§7): static `robots.txt` + public-only `sitemap.xml`, canonical on
   the root, `X-Robots-Tag: noindex` headers on the token/account/auth path families, `utm_campaign`
   on the store link, and tests for all of it. No visual change, no tracker, no content publication.
   The accepted, narrower batch 1 and its verification are recorded in §12; unique titles and the
   remaining legal-page prerenders moved to the next batch because that area of the tree is dirty.
7. **Critical review of Codex's plan** (§9): sound overall and its two 2026 arXiv sources are real
   [C26, C27]. Three corrections matter: `noindex` on the shared `app.html` shell would also
   de-index `/legal/terms` and `/account-deletion`; the Play acquisition report captures only
   `utm_source` and `utm_campaign` so the campaign parameter is a first-batch item, not a later one;
   and the AI observation panel omits Naver's AI surfaces.

---

## 2. Method and honesty notes

- Sources were opened on 2026-09-15 (KST morning). Access method per row: **[F]** full page text
  read (Chrome page-text extraction or `curl` + HTML-to-text); **[S]** read through a fetch tool
  that returns an extractive summary of the page — quotes are as returned, the full page was not
  read. Dates are the ones visible on the page; "not shown" means none was visible.
- Naver blocks Anthropic's fetch tools and the Chrome extension refused `searchadvisor.naver.com`,
  so Naver guide pages were read with `curl` (full text). Naver press releases on `navercorp.com`
  were reachable through the fetch tool. Naver's official search blog could not be read; vendor blogs
  about "AI 브리핑 인용 조건" were seen in search results and are **not** cited as evidence.
- Codex's source IDs are `S1…S13`; mine are `C1…C40` to avoid collisions.

---

## 3. Source ledger

### 3-1. Google Search (generative features, indexing controls)

| ID | Source | Pub/update shown | Access | Essential finding |
|---|---|---|---|---|
| C1 | [Google — Optimizing your website for Google Search's generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) (served as `?hl=ko`) | not shown in page body (Codex reports 2026-07-10; I could not confirm) | [F] Chrome | Generative features sit on core ranking (RAG + query fan-out). "AEO/GEO" is SEO. Requirements: indexed, snippet-eligible, included in the Search Console generative-AI setting. Explicitly unnecessary: `llms.txt` ("Google 검색에서는 이를 무시"), chunking, AI-only rewriting, inauthentic mentions, extra schema. Making one page per query variant is called out as scaled-content abuse. Measure with the Search Console generative-AI report; distrust tools claiming internal metrics. |
| C2 | [Search Console — Generative AI performance report (Search)](https://support.google.com/webmasters/answer/16984139?hl=en) | "As of August 31, 2026, we've rolled out these insights to all websites worldwide." | [F] Chrome | Impressions only (no clicks) for AI Overviews and AI Mode; dimensions pages/countries/dates/devices; dates in Pacific time; property-level aggregation in the chart; the usual 1,000-row limit. Report absent = not enough impressions or site excluded, not zero. |
| C3 | [Search Console — Search generative AI control](https://support.google.com/webmasters/answer/16908024?hl=en) | rollout note 2026-08-31 | [S] | Default is Include; child properties inherit; affects Search generative features only, not training (that is Google-Extended); changes apply within days. |
| C4 | [Google — AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) | last updated 2025-12-10 | [S] | "There are no additional requirements to appear in AI Overviews or AI Mode." Opt-out through `nosnippet`/`max-snippet`/`noindex`/robots. Google asserts AI Overview clicks show higher engagement — no number given. |
| C5 | [Google — Robots meta tag and X-Robots-Tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) | last updated 2026-03-24 | [S] | "Any rule that can be used in a robots meta tag can also be specified as an X-Robots-Tag." A URL disallowed in robots.txt cannot have its noindex seen. Most restrictive rule wins on conflict. |
| C6 | [Google — Canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) | last updated 2026-07-10 | [S] | Canonical via `<link>` or HTTP `Link` header; sitemap inclusion is a weak signal; canonicals are hints, not directives; JS-injected canonicals carry a caveat. |
| C7 | [Google — FAQPage structured data](https://developers.google.com/search/docs/appearance/structured-data/faqpage) | deprecation notice May 2026 | [S] | FAQ rich results "will no longer appear in Google Search starting May 7, 2026" — for all sites. Corroborates Codex S2. |
| C8 | [Search Console — Page indexing report (soft 404)](https://support.google.com/webmasters/answer/7440203?hl=en) | not shown | [S] | Soft 404 = "not found" content with a non-404 status; fix is to return 404 for truly missing pages. |
| C9 | [Google — Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | last updated 2025-12-10 | [S] | Self-assessment on originality, first-hand experience, "who/how/why"; warns against content made primarily for search engines and against targeting word counts. |

### 3-2. Naver (guide, crawler, reports, AI answers)

| ID | Source | Pub/update shown | Access | Essential finding |
|---|---|---|---|---|
| C10 | [Naver Search Advisor — 검색엔진 최적화의 목적](https://searchadvisor.naver.com/guide/seo-basic-intro) | not shown | [F] curl | Site registration is host-level; ownership by `<meta>` tag or HTML file upload (same mechanism as the existing Google file). JS/meta-refresh redirects on the main page are unsupported for verification. |
| C11 | [Naver — robots.txt 설정하기](https://searchadvisor.naver.com/guide/seo-basic-robots) | cites IETF standard of 2022-09 | [F] curl | Crawler is `Yeti`. No robots.txt → everything allowed. **"robots.txt가 HTML 문서로 반환된다면 … robots.txt가 없음(모두 허용)으로 해석될 수도 있습니다"** — must be `text/plain` at the root. 4xx → allow all; **5xx → disallow all**. Supports `Sitemap:` line. Keep favicon, JS and CSS crawlable. Webmaster tool has a robots.txt 수집 요청 + tester. |
| C12 | [Naver — RSS 및 사이트맵 제출](https://searchadvisor.naver.com/guide/request-feed) | example dates 2019 | [F] curl | Sitemaps are treated as content feeds and re-visited; prefer sitemap over RSS; all URLs must be on the verified host; ≤10 MB and ≤50,000 URLs per file. |
| C13 | [Naver — 콘텐츠 노출 및 클릭 리포트](https://searchadvisor.naver.com/guide/report-expose-ctr) | example dates 2019 | [F] curl | Counts only the 웹 검색 area — VIEW/블로그 areas and ad areas are excluded. Data lags ~1 week and is kept 90 days; provides clicks, impressions, CTR and TOP-30 keywords/URLs. |
| C14 | [Naver — 콘텐츠 마크업](https://searchadvisor.naver.com/guide/markup-content) | not shown | [F] curl | Main-page `<title>` should be the brand name; every page needs a unique title ("사이트 내의 모든 페이지를 동일한 제목으로 넣지 마세요"); description 1–2 sentences; Naver's robot also uses Open Graph; `og:image` should be >150×150, ≥5,000 bytes, ratio ≤3:1 and unique per page. |
| C15 | [Naver — 사이트 연관채널 (structured data)](https://searchadvisor.naver.com/guide/structured-data-channel) | not shown | [F] curl | `Organization`/`Person` JSON-LD with `sameAs` links the site to channels Naver analyzes: 블로그, 스마트스토어, 지식iN, 유튜브, 인스타그램, 스레드, **카카오톡 채널**, 당근, 틱톡, X. Exposure is not guaranteed. |
| C16 | [Naver — 자바스크립트 검색 최적화](https://searchadvisor.naver.com/guide/seo-advanced-javascript) | not shown | [F] curl | SPA crawling is supported but costs "몇 배 이상의 리소스"; **server-side rendering of the main HTML areas is recommended**; no fragment URLs; JS/CSS must be crawlable. |
| C17 | [Naver — 검색로봇 확인 방법](https://searchadvisor.naver.com/guide/seo-basic-firewall) | not shown | [F] curl | `Yeti/1.1` user-agent strings; reverse-DNS to `.naver.com` for verification. Useful only if a firewall ever blocks it. |
| C18 | [Naver Corp press release — "AI 시대에도 블로그 창작자 수익 늘었다"](https://navercorp.com/media/pressReleasesDetail?seq=10034578) | 2026-08-07 | [S] | AI 브리핑 launched 2025-03 and "links to source blog content that informed those responses". Creator-support spending roughly doubled Feb 2025 → Jun 2026. No citation-share or user numbers given. |
| C19 | [Naver Corp press release — AI탭 정식 출시](https://www.navercorp.com/media/pressReleasesDetail?seq=10034429) | 2026-06-26 | [S] | Conversational AI 탭 for all users; 4 million beta users in two months; sources named are Naver services (지도, 쇼핑, 플레이스); no external web documents mentioned. |
| C20 | [Naver Corp story — 진화된 AI 브리핑](https://navercorp.com/storyDetail?seq=32525) | 2025-05-23 | [S] | AI 브리핑 appears on how-to, trend, travel, place and short-form queries; expanding from a subset of queries. |
| C21 | [Naver Corp press release — AI탭 베타](https://www.navercorp.com/media/pressReleasesDetail?seq=34984) | 2026-04-28 | [S] | Beta for Naver Plus members; content integrated from 플레이스, 블로그, 카페 and vertical search. |

### 3-3. Market share, click evidence, GEO research

| ID | Source | Pub/update shown | Access | Essential finding |
|---|---|---|---|---|
| C22 | [StatCounter — Search engine market share, South Korea](https://gs.statcounter.com/search-engine-market-share/all/south-korea) | August 2026 | [S] | Google 46.6%, Naver 43.71%, Bing 5.44%, Daum 0.88%. Page-view sampling; no methodology shown on the page — indicative only. |
| C23 | [Pew Research — Google users are less likely to click on links when an AI summary appears](https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/) | 2025-07-22 | [S] | 900 US adults, March 2025, 68,879 searches. Clicked a result in 8% of visits with an AI summary vs 15% without; clicked a link inside the summary in 1% of visits; US-only. |
| C24 | [Ahrefs — AI Overviews reduce clicks by 34.5%](https://ahrefs.com/blog/ai-overviews-reduce-clicks/) | 2025-04-17 | [S] | Vendor study, 300k informational keywords, forecasted CTR rather than observed; states Search Console cannot separate AI-Overview clicks. Treat as vendor evidence. |
| C25 | [Aggarwal et al. — GEO: Generative Engine Optimization (arXiv 2311.09735)](https://arxiv.org/abs/2311.09735) | v3 2024-06-28 | [S] | Claims "up to 40%" visibility gain on the authors' own GEO-bench setup; efficacy "varies across domains". Not a commercial-engine or traffic result. |
| C26 | [Martinez — Optimizing Visibility in Generative Engines: A Critical Survey (arXiv 2607.14035)](https://arxiv.org/abs/2607.14035) | 2026-07-15 | [S] | Exists (verifies Codex S12). 45 studies; "no reviewed technique shows a stable, longitudinal, cross-platform causal effect on organic discoverability or downstream behavior." |
| C27 | [Wang, Gleason, Bart, Wilson, Metaxa — AI in Search Reduces Publisher Referrals… (arXiv 2608.18352)](https://arxiv.org/abs/2608.18352) | 2026-08-18 | [S] | Exists (verifies Codex S13). Preregistered, 1,100 participants: removing AI Overviews/AI Mode increases publisher CTR; AI-Mode-only reduces it. |

### 3-4. AI crawlers and other engines

| ID | Source | Pub/update shown | Access | Essential finding |
|---|---|---|---|---|
| C28 | [OpenAI — crawlers](https://developers.openai.com/api/docs/bots) | not shown | [S] | `OAI-SearchBot` = ChatGPT search inclusion (opt-out removes you from answers); `GPTBot` = training; `ChatGPT-User` = user-initiated, robots may not apply and it does not decide search inclusion. |
| C29 | [Anthropic — Does Anthropic crawl data from the web…](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) | updated 2026-04-07 | [S] | `ClaudeBot` (training), `Claude-User` (user fetch), `Claude-SearchBot` (search quality); all honor robots.txt; `Crawl-delay` supported. |
| C30 | [Bing Webmaster — AI Performance (public preview)](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview) | 2026-02-10 | [S] | Citations, cited pages, sampled grounding queries across Copilot and Bing AI answers; explicitly not placement, rank or authority. |
| C31 | [IndexNow — FAQ](https://www.indexnow.org/faq) | not shown | [S] | Participants named: Bing, Naver, Yandex, Seznam, Yep, Amazon. Google is not a participant. One key file at the root; one submission fans out. |

### 3-5. Google Play, Kakao, hosting

| ID | Source | Pub/update shown | Access | Essential finding |
|---|---|---|---|---|
| C32 | [Play Console — Store listing experiments](https://support.google.com/googleplay/android-developer/answer/6227309?hl=en) | "recently made some changes" | [S] | For published apps; one default-graphics experiment + up to five localized experiments, two variants each; metrics are unique install/open/pre-register clicks; auto-complete after 6 months. |
| C33 | [Play Console — Custom store listings](https://support.google.com/googleplay/android-developer/answer/9867158?hl=en) | not shown | [S] | Up to 50 listings; targeting by country, user state, pre-registration, search keywords, ads traffic; reachable by URL `…&listing=<slug>` (lowercase alphanumerics `.-_~`). |
| C34 | [Play Console — Store performance report](https://support.google.com/googleplay/android-developer/answer/9859173?hl=en) | not shown | [S] | Store listing visitors, unique clicks, CTR (replaces conversion rate), store listing acquisitions; sources: Play search / Play explore / ads & referrals / not attributed. **UTM captures `utm_source` and `utm_campaign` only**, visible under the ads-and-referrals filter. |
| C35 | [Play policy — User ratings, reviews and installs](https://support.google.com/googleplay/android-developer/answer/9898684?hl=en) | not shown | [S] | No incentivized ratings, no fake reviews, no manipulative prompts, no automated install inflation; asking clearly and non-deceptively for a rating is allowed. |
| C36 | [Android — Play Install Referrer API](https://developer.android.com/google/play/installreferrer) | last updated 2025-07-21 | [S] | Referrer URL, click and install timestamps, Play Store ≥ 8.3.73. Would let the app read the store `referrer` after install — not needed for batch 1. |
| C37 | [Kakao Business — 카카오톡 채널](https://business.kakao.com/info/kakaotalkchannel/) | not shown | [F] Chrome | "누구나 무료로 만드는 카카오톡 안의 비즈니스 홈"; 소식(posts), 1:1 채팅, 채널 statistics (friend count, post reactions, add-friend paths). Message sending is presented as a marketing product; its price is not on this page (unknown). |
| C38 | [Firebase Hosting — Full configuration](https://firebase.google.com/docs/hosting/full-config) | not shown | [S] | "Firebase Hosting only applies a rewrite rule if a file or directory does not exist at a URL path" — static files in `public/` beat the `**` rewrite. Priority: reserved → redirects → exact static → rewrites → custom 404. |

### 3-6. Live observations (today)

| ID | What | Observation (2026-09-15, KST morning) |
|---|---|---|
| C39 | `curl` probes of `https://littlefinger-app.web.app` | `/` → 200 `text/html`, 4,781 B, static home body. `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/legal/privacy`, `/legal/terms`, `/account-deletion` → all 200 `text/html`, 2,377 B (the empty shell). Headers: `Cache-Control: public, max-age=0, must-revalidate`, `Last-Modified: 2026-09-09`, HSTS with preload, served from an ICN edge. |
| C40 | Play listing `com.littlefinger.app` (`hl=ko`), read in Chrome | Title `리틀핑거 - 보상을 걸고 지키는 약속`; developer 주식회사딥하이; "광고 포함 · 인앱 구매"; "0+ 다운로드"; 업데이트 2026-09-14; category 커뮤니케이션; 12세 이상; short description "친구, 연인과 약속하고, 서로 정한 보상을 받아보세요. 지킨 약속이 쌓일수록 나의 신뢰가 보입니다."; full description opens "지키면 보상. 쌓이면 신뢰." The `en` listing was not inspected. |

---

## 4. Facts versus hypotheses

**Facts (platform statements or direct observation)**

- Google requires indexability + snippet eligibility + the generative-AI inclusion setting, and
  nothing else, to be eligible for AI Overviews/AI Mode. [C1, C3, C4]
- Google's AI-feature reporting is impressions-only and rolled out worldwide on 2026-08-31. [C2]
- FAQ rich results are gone for everyone since 2026-05-07. [C7]
- Naver treats a non-`text/plain` robots.txt as possibly absent, a 5xx as "disallow all", recommends
  SSR for SPAs, wants unique titles per page, and its site report excludes blog/VIEW areas and lags
  a week. [C11, C13, C14, C16]
- Naver's AI answers are documented by Naver as linking to source blog content and drawing on Naver
  services; no Naver document read today describes ranking of external web pages inside AI 브리핑.
  [C18, C19, C21]
- The Play acquisition report attributes referrals by `utm_source` and `utm_campaign` only. [C34]
- The site's privacy policy in the repo commits the acceptance web to "no advertising or behavioral
  analytics cookies" (`apps/web/src/legal/legal-content.ts`), so measurement must stay in consoles.
- Creating a 카카오톡 채널 is free; sending messages is a paid product of unknown price. [C37]

**Hypotheses (plausible, unmeasured — validate before spending effort)**

- H1: Korean users who search for this need type "약속 기록 앱", "둘이 약속", "약속 지키기 앱" or
  similar; Search Console and Naver TOP-30 keyword reports are the only honest way to learn the
  actual phrasing. No volume tool was consulted and none should be quoted.
- H2: An operator-run 네이버 블로그 (disclosed as the maker, one original post per topic) is the most
  plausible zero-budget route into AI 브리핑, because Naver documents AI 브리핑 as linking blog
  sources [C18]. Vendor claims such as "70% of citations are UGC" were seen but are not evidence.
- H3: For Google AI surfaces, the same four public pages plus two or three original guides are
  sufficient inputs; more pages will not help and could trip the scaled-content policy. [C1]
- H4: The dominant zero-budget acquisition loop is the product's own invite: partner opens the web,
  approves, sees the store CTA. Measuring that CTA by campaign is worth more than any new channel.
- H5: A consistent brand phrase across Play title, web title and og tags reduces confusion with
  리틀핑거 주식회사 (유아용품) and the *Little Fingers* app (open issue N-1). Direction, not proof.

---

## 5. Current-site gaps (read-only audit of repo + live site)

| # | Gap | Evidence | Effect |
|---|---|---|---|
| G1 | No robots.txt; the shell is returned as HTML with 200 | C39, C11 | Naver may treat it as absent (harmless today) and no `Sitemap:` hint exists; Google logs soft-404-like fetches. |
| G2 | No sitemap.xml | C39, C12 | Both engines lack the discovery hint; Naver's webmaster tool has nothing to submit. |
| G3 | No canonical, single shared `<title>리틀핑거</title>` and one description/OG set for every route | `apps/web/index.html` = `app.html` (byte-identical by test) | Naver's guide asks for a unique title per page and says repeated or unrelated keywords "may be disadvantaged" [C14] — published guidance, not a documented ranking weight or an explicit duplicate-title penalty. While every route shares one title, the legal pages cannot describe themselves in results (e.g. 계정 삭제). |
| G4 | `/legal/terms` and `/account-deletion` are empty shells in served HTML; `/legal/privacy` prerender exists only in the uncommitted working tree | C39, `vite.config.ts` | Naver recommends SSR for SPAs [C16]. Play Data Safety lists `/account-deletion` as the public deletion URL (`docs/setup/play-data-safety.md`) — it must stay reachable; Play does not require it to be indexed. |
| G5 | Every unknown URL returns 200 HTML | C39, C8 | Soft-404 noise if junk URLs are ever linked. Fixable later without a server by narrowing the `**` rewrite to the known route families and letting Hosting's own 404 answer the rest; out of batch 1, mitigated meanwhile by never linking such URLs. |
| G6 | Token/account/auth routes (`/i/*`, `/witness/*`, `/promises`, `/auth/callback`) carry no `noindex` | `routes.ts` | Low harm (pre-login content only), but token URLs shared in KakaoTalk can be crawled and indexed as thin duplicates. |
| G7 | Store link carries `utm_source=web&utm_medium=home` only | `home-static.ts`, `packages/shared/src/app-links.ts`, C34 | Play reports source and campaign; medium is invisible, so home vs invite CTAs are indistinguishable in the console. |
| G8 | Positioning mismatch: live Play listing (보상 first) vs web home and `docs/setup/play-store-listing.md` registered value (기록 first) | C40, `home-labels.ts` | Search snippets, AI answers and brand queries will describe two different products. **Status: asked to the PO asynchronously on 2026-09-15; answer pending.** |
| G9 | No Naver Search Advisor registration evidence; no Bing property | repo grep; Google file present | Naver side of the market is unmeasured. |
| G10 | Single `og-image.png` for all pages | `index.html`, C14 | Fine now; each future guide page should get its own image or Naver may not use it. |
| G11 | No `Organization` + `sameAs` markup | C15 | Only relevant once an official 블로그 / 카카오톡 채널 exists. |
| G12 | English is client-side only (static home is Korean) | `home-static.ts` | Do not claim an English page is indexed; no hreflang work until demand appears. |

---

## 6. Korean discovery specifics that change the plan

1. **Two engines, two consoles.** Register the host in Naver Search Advisor with an HTML
   verification file in `apps/web/public/` (exactly like the Google file, pinned by test), submit the
   sitemap, and press robots.txt 수집 요청 after deploy. Naver's report will lag ~1 week and covers
   web-search area only [C13] — say so in the weekly sheet.
2. **Naver AI answers are ecosystem-first.** Nothing read today says an external site is cited by
   AI 브리핑 or AI탭 on its own merits; Naver's statements point at blogs, cafes and places. The
   zero-budget consequence is H2 (a disclosed maker blog), and the `sameAs` markup [C15] to tie it to
   the site once it exists. This is a PO decision (operating a channel is ongoing work).
3. **Naver wants plain HTML.** Prerender the public pages (the existing `homePrerender` plugin
   pattern) rather than relying on Naver's costlier SPA rendering [C16]. Google renders JS fine, so
   this is a Naver-driven requirement.
4. **Naver's guide says its robot may use Open Graph and favicons when analysing a page** [C14, C11] —
   guidance, not a documented ranking weight. Both already exist and are absolute-pathed; keep them
   crawlable in robots.txt.
5. **KakaoTalk is the distribution medium, not a search engine.** A 카카오톡 채널 is free [C37] and
   gives invite recipients a place to verify the sender's brand inside the app they already use;
   it is not a traffic source and message blasts cost money. Hypothesis only.
6. **Bing web-search share is ~5% [C22].** That figure says nothing about Copilot usage, which
   StatCounter does not measure. A free Bing Webmaster Tools property is still worth having for the
   AI Performance citation report [C30]; it is not worth content effort on its own.

---

## 7. Recommended first batch (safe, measurable, no visual change)

> **Superseded 2026-09-15.** This table was my pre-synthesis wishlist. The bounded batch that was
> actually accepted and implemented is recorded in §12. Rows that §12 does not list (B3's unique
> titles and HTML canonical, B5's legal-page prerenders, per-page OG images) are neither promised
> nor done; they are candidates for a later batch once the dirty legal work lands.

Ownership per the coordinator: the technical batch is implemented after joint synthesis, not now.
Smallest sound set, in order:

| # | Change | Why (source) | Verification |
|---|---|---|---|
| B1 | `apps/web/public/robots.txt` — `User-agent: *` / `Allow: /` / `Sitemap: https://littlefinger-app.web.app/sitemap.xml`. No `Disallow` on private prefixes (noindex needs a crawl [C5]). No AI-crawler rules in this batch (policy, §10). | C11, C38 (static beats rewrite) | `curl -I /robots.txt` → `text/plain`; Naver robots tester; GSC robots report. |
| B2 | `apps/web/public/sitemap.xml` with exactly `/`, `/legal/privacy`, `/legal/terms`, `/account-deletion` and `lastmod`. Never a token, `/promises`, `/witness/*` or `/auth/*`. | C12, Codex S8 | Test asserts the URL set equals the public route set and excludes private prefixes. |
| B3 | Canonical `<link>` and a unique `<title>`/description per public page, injected by the existing prerender plugin into `index.html` and each prerendered legal page (not into `app.html`, which stays byte-identical). | C6, C14 | Build output contains `rel="canonical"` for each of the four URLs and four distinct titles. |
| B4 | `X-Robots-Tag: noindex` headers in `firebase.json` for `/i/**`, `/witness/**`, `/promises`, `/auth/**` (glob headers are already used for `/assets/**`). Not on `**`. | C5 (header ≡ meta) | `curl -I /i/x` shows the header; `/legal/terms` does not. Naver's handling of `X-Robots-Tag` was not found in its guide — accepted risk because these pages hold no promise content pre-login. |
| B5 | Extend the privacy prerender to terms and account-deletion (same plugin, same label source), so all four public pages are static HTML. | C16, Play Data Safety URL | Served HTML has the `<h1>`; Naver 사이트 간단 체크; GSC URL inspection. |
| B6 | Add `utm_campaign` to `buildPlayStoreUrl` (contracts-first: extend the `utm` shape in `packages/shared/src/app-links.ts`, keep `utm_medium` for consistency) and use distinct campaigns for the home CTA and the invite-flow CTA. | C34 | Play → Store performance → ads & referrals → UTM dimension shows both campaigns within days of deploy. |
| B7 | Tests in `apps/web/src/seo.test.ts`: robots exists and is text; sitemap set; header rules; canonical/title presence; no private path in the sitemap. | project rule §1-4 | `npm test`, `npm run typecheck`. |
| B8 | Operator console steps after deploy (PO accounts): GSC sitemap submit + generative-AI setting check [C3]; Naver Search Advisor registration + sitemap + robots 수집 요청; Bing property (optional, via GSC import). Record receipts, not screenshots of promises. | C2, C10–C13, C30 | Receipts recorded in `measurement.md`. |

**What "measurable" means for this batch (2–4 weeks after deploy):** robots and sitemap fetched
without error in both consoles; four public URLs indexed (GSC page indexing; Naver 수집/색인
현황); first brand vs non-brand query split in GSC; first Naver 노출/클릭 row (with its one-week lag);
Play referral rows split by campaign. Success is "the instruments work", not any traffic number.

---

## 8. What NOT to do (with the source that says so)

- Do not add `llms.txt` and call it GEO work; Google ignores it [C1]. It is harmless, so it is also
  not worth arguing about — just do not count it as progress.
- Do not add FAQPage schema for rich results; retired 2026-05-07 [C7]. Q&A headings for readers are
  fine [C1].
- Do not create one page per query variant ("약속 앱", "약속 기록 앱", "커플 약속 앱"…); that is
  scaled-content abuse [C1] and Naver penalizes keyword-stuffed titles/descriptions [C14].
- Do not add analytics cookies or a tracking SDK to the acceptance web; the published privacy policy
  says none are used. Measure in consoles.
- Do not `Disallow` private routes in robots.txt while relying on `noindex` [C5].
- Do not offer anything for ratings or installs, and do not solicit reviews from friends as if they
  were users [C35].
- Do not quote vendor blogs' "AI 브리핑 인용 조건" or "70% UGC" as facts; no primary source was found.
- Do not describe the product with 계약·서명·법적·효력·공증·증거·판결 on any public page (the
  listing wording guard in `docs/setup/play-store-listing.md` §9 applies to marketing pages too).
- Do not use citation counts, AI impressions or Bing citations as acquisition metrics [C2, C30].
- Do not post in communities or send outreach in this phase (task boundary), and never at scale.

---

## 9. Critical review of Codex's draft package

Read: `2026-09-15-research.md`, `strategy.md`, `content-drafts.md`, `measurement.md`, `README.md`,
both CSV headers, and the four coordinator messages of 2026-09-15 00:44–00:52 UTC.

**Agree (independently confirmed):** S1 substance, S2 (FAQ removal, corroborated by C7), S3/S4
(control + impressions-only report), S5, S6, S7, S9's "test content and type, not status" (same live
results as C39), S10's visitors/clicks/CTR framing, the "citation ≠ install" stance, north star =
weekly ACTIVE transitions (`01_상위기획서.md` §12 says exactly that), no trackers, deployment kept
separate from the dirty tree. S12 and S13 exist and say what the brief says they say [C26, C27].

**Corrections and additions**

1. **`noindex` on `app.html` is unsafe.** `firebase.json` rewrites `**` to `app.html`, so the shell
   also serves `/legal/terms` and `/account-deletion` (and `/legal/privacy` until the prerender ships).
   A meta `noindex` there would drop those public pages from search results. It would **not** make
   them inaccessible — Play's Data Safety form needs the deletion URL to be reachable, not indexed —
   so the cost is discoverability of the legal pages, not a policy breach. Use `X-Robots-Tag`
   headers on the private path families (B4) and keep the shell neutral. Codex's later message
   already leans this way; this confirms it with the Google header-equivalence statement [C5].
2. **Canonical persistence across client navigation can matter, so use HTTP only.** A `<link
   rel="canonical">` in `index.html` stays in the DOM after the SPA navigates to `/legal/terms`, and
   any client that reads the live DOM (rendering crawlers that follow in-page links, share/inspect
   tools, future prerender snapshots) would see a home canonical on a legal page. An HTTP `Link`
   header is request-scoped and cannot leak that way [C6]. Batch 1 therefore sets the canonical as
   a header on `/` and `/index.html` only, with no HTML canonical anywhere. My earlier draft called
   this "not a crawler problem"; that was too strong.
3. **`utm_campaign` belongs in batch 1, not "future".** Play reports source and campaign only [C34];
   the current builder emits source and medium, so home vs invite CTAs cannot be told apart in the
   console. It is a small contracts-first change (B6).
4. **S1's "Updated 2026-07-10" is not visible in the page body I read.** Keep it if Codex saw it in
   the page footer; otherwise mark "not shown".
5. **S11 (Naver robots) should carry the two rules that bite us:** HTML-typed robots.txt may be read
   as absent, and 5xx means "disallow all" [C11].
6. **The AI observation panel has no Naver row.** For Korean users the primary AI answer surfaces are
   AI 브리핑 and AI탭 [C18–C21]. Add `engine=naver_ai_briefing` / `naver_ai_tab` to
   `ai-observations.csv` and to the weekly panel; record "no AI 브리핑 shown" as an observation.
7. **Content drafts need the prerender path.** `/guides/*` served by the shell would be empty HTML
   for Naver [C16]. Each guide needs static HTML, its own title/description/canonical and ideally its
   own `og:image` [C14]. Also run the §9 wording guard over drafts as a test, as the listing does.
8. **Positioning must be settled before publication (PO).** The drafts and strategy say "둘이 지키는
   약속 기록"; the live Play listing says "보상을 걸고 지키는 약속" [C40]. Drafting can continue;
   publishing guides before this is decided produces two brands. Asked to the PO on 2026-09-15,
   pending.
9. **"Distribute to one community" needs a rules check per channel** (네이버 카페, 에브리타임, 당근
   commonly forbid maker promotion) and is out of scope for this phase anyway.
10. **S9 can add the useful fact:** static files in `public/` take precedence over the `**` rewrite
    [C38], so B1/B2 need no `firebase.json` change.
11. **`weekly-metrics.csv`** should carry a `report_lag_note` for Naver (one-week lag, web-search area
    only [C13]) and a Play `traffic_source` segment so campaign rows are not compared with Play-search
    rows.

**Overall:** Codex's plan is the right shape. With items 1, 3 and 6 fixed it is the batch I would
implement.

---

## 10. PO 확인 필요 (Korean, as required by CLAUDE.md §1-2)

1. **포지셔닝 한 줄 확정** — Play 등록정보(`보상을 걸고 지키는 약속`)와 웹 홈·저장소 문서
   (`둘이 지키는 약속 기록`) 중 어느 쪽이 정본인가요? 검색 스니펫, AI 답변, 상표 혼동(N-1) 모두
   한 문구로 맞춰야 합니다. (2026-09-15 코디네이터가 PO에게 비동기로 질문함 — 답변 대기 중)
2. **AI 학습용 크롤러 차단 여부** — `GPTBot`, `ClaudeBot`, `Google-Extended`를 robots.txt에서
   막을지 결정이 필요합니다. 검색용 봇(`OAI-SearchBot`, `Claude-SearchBot`, Googlebot)은 열어 두어야
   AI 답변에 인용될 수 있습니다 [C28, C29, C3]. 1차 배치는 "모두 허용"으로 두고 별도 결정을 기다립니다.
3. **네이버 서치어드바이저 등록 계정** — 어떤 네이버 ID로 사이트를 등록·소유확인할지(HTML 파일을
   `apps/web/public/`에 두는 방식) 정해 주세요.
4. **네이버 블로그·카카오톡 채널 운영 여부** — 네이버 AI 브리핑은 네이버 생태계(블로그 등) 출처를
   연결한다고 네이버가 밝혔습니다 [C18]. 운영은 지속 업무이므로 PO 결정 사항입니다.
5. **Play 영문 등록정보 이름 오타(`Liitlefinger-promise`, 2026-09-03 기록)** — 오늘 `hl=ko`만
   확인했습니다. 영문 등록정보 현황 확인이 필요합니다.
6. **공개 테스트 상태** — 등록정보에 "0+ 다운로드"로 표시됩니다. 등록정보 실험(A/B)이 현재 트랙에서
   가능한지 콘솔에서 확인이 필요합니다 [C32].

---

## 12. Batch 1 implementation record (2026-09-15, Orca task `task_c5782167df3a`)

Scope accepted by the joint synthesis, narrower than §7. Nothing was deployed or committed.

| Item | What changed | Where |
|---|---|---|
| Robots | `User-agent: *` / `Allow: /` / `Sitemap: https://littlefinger-app.web.app/sitemap.xml`. No `Disallow`, no AI-crawler policy (PO decision pending, §10-2). | `apps/web/public/robots.txt` |
| Sitemap | One `<loc>`: the canonical public root. No `lastmod` (none is known). Other public URLs stay crawlable and indexable; they are simply not listed yet. | `apps/web/public/sitemap.xml` |
| Canonical | HTTP `Link: <https://littlefinger-app.web.app/>; rel="canonical"` on `/` and `/index.html` only. Chosen over an HTML tag because a `<link rel="canonical">` in the SPA shell stays in the DOM after client-side navigation; a request-scoped header cannot leak. No HTML canonical anywhere. | `firebase.json` |
| Index boundary | `X-Robots-Tag: noindex` on `/app.html`, `/i`, `/i/**`, `/witness`, `/witness/**`, `/promises`, `/promises/**`, `/auth`, `/auth/**`. Never on `**`, never on `/legal/*` or `/account-deletion`. Existing rewrites (incl. the dirty `/legal/privacy` one) and OG tags untouched. | `firebase.json` |
| Store attribution | `buildPlayStoreUrl` gained an optional `campaign`; output without it is byte-identical to before (asserted). Home CTA now sends `utm_source=web&utm_medium=home&utm_campaign=home` in both React and the static home markup. Invite/approval CTAs unchanged (later batch). No IDs, tokens or analytics. | `packages/shared/src/app-links.ts`, `apps/web/src/screens/home.tsx`, `home-static.ts` |
| Tests | robots content and no-Disallow guard; sitemap = root only, no `lastmod`; canonical header sources exactly `/` and `/index.html`; noindex sources exactly the nine private entries and none on public/`**`; campaign byte-identity and encoding; static-home link equals the builder output. | `apps/web/src/seo.test.ts`, `packages/shared/src/app-links.test.ts`, `apps/web/src/screens/home-static.test.ts` |

**Verification run (all on 2026-09-15 KST)**

- `npx vitest run apps/web/src/seo.test.ts apps/web/src/screens/home-static.test.ts packages/shared/src/app-links.test.ts` → 3 files, 27 tests passed.
- `npm run typecheck` → exit 0 (five projects).
- `npm run build:web` → built; `dist/` contains `robots.txt` (78 B, `text/plain` when served) and `sitemap.xml` (176 B, `application/xml`), and `dist/index.html` carries `utm_campaign=home`.
- Full root `npx vitest run` → 122 files / 2,228 tests passed, **1 pre-existing failure** unrelated to this batch: `apps/web/src/i18n-parity.test.ts` reports the untracked dirty file `screens/legal-document-labels.ts#VERSION_LINE` as unregistered. It failed before this batch and belongs to the legal work. The mobile jest suite was not run (no mobile change).
- Header-rule coverage: matched every probe path against the `firebase.json` rules with `minimatch` 3.1.2 (the matcher inside the installed superstatic) on POSIX-normalized paths. Result: canonical on `/`, `/index.html` and `/?query` only; `noindex` on every private form tested (`/i`, `/i/`, `/i/tok`, `/i/tok/review`, `/i/tok?x=1`, `/i/tok/done/`, `/witness`, `/witness/abc`, `/witness/abc/`, `/promises`, `/promises/`, `/promises?x=1`, `/auth`, `/auth/callback`, `/auth/callback?code=1`, `/app.html`); none on `/legal/privacy`, `/legal/terms`, `/account-deletion`, `/robots.txt`, `/sitemap.xml`, the Google verification file, `/nonexistent`, `/i.html` or `/promisesX`. `/i/` and `/promises/` match both the exact and the `**` rule with the same value, which is harmless.

**Limitation, stated plainly:** the local Firebase Hosting emulator (firebase-tools 15.1.0, superstatic 10.0.0) applied **no** custom header at all on this Windows machine — not the new `Link`/`X-Robots-Tag` rules and not the pre-existing `Cache-Control` rules, and not even a one-rule `X-Test` on `**` in an isolated temp config. The coordinator traced it to `glob-slasher` turning `/` into a backslash on Windows before `minimatch` sees it, so every rule fails to match in the emulator only. The live site already returns the configured `Cache-Control` for `/` (C39), so production matching works; the new headers still need a POSIX-side emulator run or a post-deploy `curl -I` to be observed end to end. Files, types and body content were verified in the emulator (robots `text/plain`, sitemap `application/xml`, root static body, private routes rewritten to the shell).

## 11. Research-phase boundaries respected

- During the research task only this file was written. The dirty working tree (legal/privacy prerender, `firebase.json`,
  status docs) was read, not modified. No deploy, no commit, no console action, no outreach.
- OAuth brand verification remains deferred per the PO; the Google verification file must stay.
- Everything in §7 is a recommendation for the joint synthesis, not work performed.

Coordinator follow-up: the subsequent implementation task is recorded in §12 above. After that
task settled, the coordinator passed 23 real HTTP checks with a verification-only POSIX URL
normalization preload in the Windows emulator. This is not production verification; see
[the final verification record](verification.md) for the workaround and remaining checks.
