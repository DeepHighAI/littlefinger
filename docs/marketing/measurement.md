# Weekly measurement and operator runbook

Owner: operator supplies account access/exports; Codex executes and checks solo.
Frequency: once weekly, same completed 7-day window; retain each report's native timezone.
First observation: GSC partial period 2026-09-07–09-12 (Pacific time), 0 clicks / 2 impressions.
This is six days with reporting lag, not a completed-week or Korea-only baseline. Other consoles
remain access-limited. See [console execution](2026-09-15-console-execution.md).
This document is a work procedure, not an installed automation or a live analytics integration.

The first guide was published September 15 at 11:26 KST. Its Play link uses
`utm_source=web`, `utm_medium=guide`, `utm_campaign=promise_record`. These labels identify
the link campaign; no guide click count, install attribution or activation result has been measured.

## One funnel, separate measurements

| Stage | Metric and source | Interpretation / limit |
|---|---|---|
| Discovery | GSC conventional impressions/clicks, query/page/country/device | Search visibility and visits; brand/nonbrand groups separately. |
| AI discovery | GSC Generative AI performance impressions | Do not manufacture an AI-click field; inspect report availability and actual export. |
| AI citation | Bing AI Performance citations, cited pages, sampled grounding queries | Not ranking, installs or a census of every AI engine. |
| Store intent | Play listing visitors, unique install clicks, listing CTR | Current listing reports focus on intent, not completed installs. |
| Acquisition | Play Grow overview/Statistics user acquisitions | Use exact metric label; device acquisitions are not unique new users. |
| Product value (north star) | Weekly confirmed promises / ACTIVE transitions, per product spec §12 | Existing product KPI; no aggregate analytics export wired in this batch. |
| New-creator activation | Creators whose first mutually approved promise starts in the period | Additional diagnostic, not a replacement north star; not wired in this batch. |
| Approval friction | Approved partner invitations / eligible partner invitations in a fixed cohort | Separate witness invites; document expiry and observation window. Not implemented here. |

Google's [2026 Play reporting documentation](https://support.google.com/googleplay/android-developer/answer/9859173?hl=en)
distinguishes button-click intent from successful acquisitions. Copy actual metric names into the
CSV. Do not combine unique-user counts across devices/days/dimensions or compute one attribution
funnel from unrelated aggregates. Acquisitions cannot presently be linked to an organic query.

## Console checklist after the reviewed build is deployed

Execution checkpoint: deployment passed on September 15. GSC accepted the sitemap submission,
but its receipt currently says `가져올 수 없음`; submission is not processing success.
Use [Google's fetch-error procedure](https://support.google.com/webmasters/answer/7451001?hl=en):
open the sitemap's error details, then run a live URL inspection and record crawl/fetch results.
Do not change valid XML or repeatedly submit merely to clear the status.

First planned full post-release search window: September 15–21 **Pacific time**. Review once all
seven days are actually available (target September 24 KST); if delayed, retain the partial flag.
This is a manual review target, not an installed scheduled job.

1. Verify `/robots.txt` returns text, `/sitemap.xml` returns XML, home static copy and canonical,
   public legal pages, invite routing, and noindex on app-only paths. Record the deployment ID.
2. GSC: use the existing `https://littlefinger-app.web.app/` property. Confirm ownership is current;
   OAuth branding review is separate. Inspect `/`; submit `/sitemap.xml` and record the receipt.
3. GSC Settings → Search generative AI: inspect Include/inheritance, recording the effective value.
   Read Generative AI performance if available; otherwise record missing/suppressed, not zero.
4. Naver Search Advisor: verify the site if not already registered, then submit the sitemap and
   inspect collection/indexing reports. A verification file must come from the actual account.
5. Bing Webmaster Tools: verify the site or use the offered GSC import; submit the sitemap and
   inspect indexing/AI Performance. No fabricated verification tokens or API keys.
6. Play Console: export a complete 7-day period for Korea/Korean with new/returning segment and
   metric definition recorded. Collect store intent and acquisitions separately.
7. Save exports outside the public web tree. Paste only aggregated, non-sensitive values into
   `weekly-metrics.csv`. Preserve report timezone, lag and suppression in notes.

The execution follow-up inspected GSC through the existing signed-in account. Bing needs login;
Play needs the developer-account session. Naver navigation was refused by the browser tool, so
the PO must complete its verification/submission manually. Receipts and exact limits belong in
the console execution record. Do not interpret missing access as zero traffic.

## Campaign naming

Use stable, non-personal values: `utm_source=littlefinger_web`, `utm_medium=owned`,
`utm_campaign=promise_record_2026q3`. Community links use the channel name and the relevant
campaign. Never include user IDs, invite tokens, promise text or email in tracking parameters.

Example for an owned-guide store CTA (draft, not installed in the app):

`https://play.google.com/store/apps/details?id=com.littlefinger.app&utm_source=littlefinger_web&utm_medium=owned&utm_campaign=promise_record_2026q3`

The initial source audit found source/medium only. The first technical batch adds optional campaign
support and a home campaign (`utm_source=web&utm_medium=home&utm_campaign=home`), deployed and
verified on 2026-09-15; existing unmodified links are not claimed to have campaign reporting.
GSC measures discovery while the outgoing store link measures its landing context; it does not
preserve the original AI/search referrer. Do not describe this as complete source attribution.

## Fixed AI observation panel

Run the same prompts once weekly in clean conversations, Korean locale where available, recording
engine, displayed model/mode, search enabled state, country, date and actual citation URLs.
Use three independent runs per prompt/engine when practical; record failed runs. Do not supply the
brand in nonbrand prompts. Observe both correct attribution and wrong product claims.

| ID | Prompt | Group |
|---|---|---|
| P01 | 둘이 정한 약속 내용을 기록하는 앱이 있나요? | Nonbrand |
| P02 | 안드로이드에서 약속을 만들고 아이폰 친구가 참여할 수 있는 방법은? | Nonbrand |
| P03 | 상대방이 앱을 설치하지 않고 약속 내용을 확인하고 수락할 수 있나요? | Nonbrand |
| P04 | 친구와 공부 약속을 정할 때 어떤 내용을 적으면 좋을까요? | Nonbrand |
| P05 | 약속을 기록하는 앱과 일정 앱은 어떤 점이 다른가요? | Nonbrand |
| P06 | 리틀핑거는 무엇이고 누가 사용할 수 있나요? | Branded accuracy control |

Suggested surfaces: Naver AI 브리핑 (`naver_ai_briefing`), Naver AI탭 (`naver_ai_tab`), ChatGPT Search,
Google AI Mode, Copilot and Perplexity, as actually accessible. Record "no AI briefing shown" as
an observed outcome; do not exclude such runs to make citation rates look better. Naver's web
search reports can lag about a week and cover the web-search area rather than all Naver surfaces
(Claude C13); keep the report lag in each export's notes.
Do not substitute web search snippets for an observed answer from those products. No panel runs
have been completed in this batch. The CSV contains headers only, not invented observations.

Citation presence = runs with a citation to our public page / successfully observed runs, grouped
by engine and prompt. Mention without a link is a separate value. This is a reproducible small
panel, not population share of voice. Inspect linked context before marking accuracy correct.

## Decision log template

At each weekly review record: observation → alternative explanation → one next change → owner →
review date. Initial priority is technical validity and relevant questions, not growth promises.
Keep raw private product data out of marketing files. No tracking pixels, session replay, analytics
cookies or new database collection are introduced by this plan.
