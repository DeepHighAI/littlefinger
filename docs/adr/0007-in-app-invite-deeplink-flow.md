# ADR 0007 — In-app invite review behind App Links, store fallback via intent URI

- Status: Accepted
- Date: 2026-08-20
- Deciders: PO (대표)

## Context

Android App Links for `https://littlefinger-app-philwoo.web.app/i/*` were already built and
device-verified, but the app's `/i/[token]` route was a hand-off card that bounced users back
to the browser — contradicting spec EC-I01 ("해당 약속 화면으로 딥링크"). Two gaps remained:
KakaoTalk's in-app WebView (the most common place an invite link is tapped) never triggers App
Links even when the app is installed, and no path led a user without the app toward the store.

PO decisions (2026-08-20): keep the web approval path (01 P6's no-install funnel stands) while
making the landing nudge strongly toward the app/store; and when the app opens, land in an
in-app review where a signed-in partner approves/declines/suggests without the browser.

## Decision

1. **One intent URI does both jobs.** SCR-W01 (Android UA only) renders a primary CTA whose
   href is `intent://{host}/i/{token}#Intent;scheme=https;package=com.littlefinger.app;`
   `S.browser_fallback_url={Play Store URL with UTM};end` — installed devices open the app,
   others fall through to the store. iPhone renders no nudge (EC-I03). Login stays available
   under a "웹으로 계속하기" caption. Builders live in `packages/shared/src/app-links.ts`,
   which is now the only definition of the package name, store URL, and `/i/` path shape.
2. **`/i/[token]` is the in-app twin of SCR-W01→W02.** Resolve via public `invite-resolve`;
   no session → minimal landing (§4-3-3 fields) with Kakao/Google sign-in that keeps the user
   on the route (the root layout's redirects exempt `/i/` in both directions — pinned by
   tests); session + PARTNER → `invite-preview` full review with 승인/거절/수정 제안 through
   the same endpoints the web uses; approve replaces to `/promise/{id}`, decline/amend end in
   an inline done state. Idempotency keys are minted per endpoint per screen entry (§7-3.6).
3. **Witness tokens keep the browser hand-off.** Witness join/sign UI is web-complete
   (SCR-W05); porting it in-app is deferred scope, made explicit by the phase machine's
   `HANDOFF` branch.
4. **Surface honesty for free.** RN `fetch` sends no `Origin` header, so in-app approvals are
   recorded `surface=APP` by the server's existing header-presence rule — nothing client-declared.

## Consequences

- Until the Play listing exists (M4), the intent URI's store fallback lands on "item not
  found" — accepted pre-launch; testers run dev builds.
- The store build will silently lose App Links until the Play App Signing SHA-256 is appended
  to `apps/web/public/.well-known/assetlinks.json` (operator step at M4; the dev cert stays).
- `invite-flow.ts`'s throwing builders keep their Korean developer-facing messages — SCR-A04
  catches and renders its own labels, so those strings are not user copy.
- EC-I01's traceability evidence moved to `apps/mobile/src/screens/invite-review.test.tsx`.
