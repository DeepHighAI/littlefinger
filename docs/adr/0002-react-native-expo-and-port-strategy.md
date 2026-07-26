# ADR 0002 — Adopt React Native + Expo (N-3) and port the HTML/CSS screen library

- Status: Accepted
- Date: 2026-07-25
- Supersedes: the "N-3 stays open" consequence of [ADR 0001](0001-pinky-design-system-in-plain-html.md)
- Deciders: PO (대표)

## Context

ADR 0001 deliberately left the app framework open (상위기획서 open point **N-3**) and implemented
the approved "핑키" design as a framework-free HTML/CSS screen library so that the choice would not
be pre-empted. That decision has now been made.

Three candidates were compared in `03_기술스택_비교분석`: **Flutter**, **React Native + Expo**, and
**Kotlin (Jetpack Compose) + Next.js**. The comparison was constrained by the PO to stacks that are
**usable entirely on free tiers**, including under an ad-supported revenue model.

Two findings reframed the decision:

1. **The acceptance web must be TypeScript in every option.** `kakao_flutter_sdk` supports Android and
   iOS only — web support is listed as "coming in the near future" — and Flutter Web ships a
   1.5–1.8 MB gzipped bundle, which Flutter's own documentation discourages for lightweight pages.
   The 수락 웹 has a **3-second load target** (상위기획서 §13) and runs inside the KakaoTalk in-app
   browser. So the web surface is TypeScript regardless of what wins.

   That collapses the decision to a single variable: **the language of the Android app.** Flutter means
   two languages (Dart + TS), Kotlin means two (Kotlin + TS), React Native means **one**.

2. **RN's headline risk turned out to be avoidable.** The concern was that the only React Native
   Kakao-login package (`@react-native-kakao/*`) is maintained by a single individual, not by Kakao.
   However **Supabase Auth supports Kakao as a built-in OAuth provider**, so the app can talk to
   Kakao's official OAuth endpoints through Supabase and skip the unofficial SDK entirely.

Kotlin was ranked last: it means a full second implementation for iOS with **no workaround**, whereas
the risks in the other two options all have one.

## Decision

**Adopt React Native + Expo for the app, and keep the existing HTML/CSS as the port source rather
than a throwaway.**

| Surface | Stack |
|---|---|
| App (SCR-A*, MOD-*) | React Native + **Expo SDK 57** (RN 0.86) · TypeScript 5.9+ · Expo Router |
| Acceptance web (SCR-W*) | **Vite + React + React Router** — reusing the existing CSS verbatim |
| DB · Auth · Storage · server logic · batch | **Supabase Free** (Postgres · Auth · Storage · Edge Functions · pg_cron) |
| Web hosting | **Cloudflare Pages** |
| Push | expo-notifications + Expo Push Service |
| Ads | `react-native-google-mobile-ads` (AdMob), SCR-A02 only |

Kakao login goes through **Supabase Auth's official Kakao provider**. The unofficial React Native
Kakao SDK is not used.

Explicitly rejected: **Vercel** (the Hobby plan forbids ad-monetized commercial use), **Firebase Blaze**
(usage billing; Expo Push Service removes the need), **Next.js** for the acceptance web (no SSR need,
heavier bundle against the 3s target), **react-native-web / Expo Web** for the acceptance web
(discards finished CSS and hits layout limits), and Render / Railway / Fly.io (no viable free tier).

### Port strategy

The token and component layer is the part that survives, exactly as ADR 0001 predicted. Concretely:

- `src/types/promise.ts` → `packages/shared/src/promise.ts`, **content unchanged**.
- `tokens.css` → `tokens.ts`. The CSS was authored at a 360×800**dp** viewport, so **px values equal
  React Native dp 1:1** — every colour, size, radius and spacing number transfers verbatim. Only
  shadows (→ shadow objects), easing (→ `Easing.bezier`) and font weights (→ strings) change shape.
- `components.css`'s **111 `lf-*` classes → ~33 React Native components**, with CSS modifier classes
  becoming props (`lf-btn--filled` → `<LfButton variant="filled">`).
- The acceptance web (SCR-W01–W06) moves to Vite **keeping the CSS as-is**. Removed: the `lf-device`
  wrapper, `frame.js`, `screen-page.css`, `lf-browserbar` — all preview-only scaffolding.
- The current HTML/CSS then moves to `design-reference/` and becomes **read-only**.

Full rules, including the per-file migration table, live in `04_AI-Agent_코딩가이드` §3–§5.

## Consequences

Good:

- **One language across app, web, shared logic, and server logic.** For a solo developer this is the
  dominant maintenance factor, and it is also the strongest condition for AI-agent-driven development
  (TypeScript is the largest share of training data among the candidates; Expo's tooling is mature).
- **The HTML/CSS work is not wasted.** The acceptance web ships close to as-is, and the app port is a
  mechanical translation against a visual reference rather than a redesign.
- **N-2 (iOS) stays cheap.** Adding iOS later is a build target, not a second implementation.
- **Zero recurring cost** at MVP scale, with no terms-of-service conflict against ad revenue.

Costs / risks:

- **Two font gotchas found up front.** `PretendardVariable.woff2` is unusable in React Native — four
  static `.ttf` weights (400/600/700/800) are required, because RN Android's variable-font weight-axis
  selection is unreliable. Material Symbols Rounded is not bundled with Expo, so MVP uses
  `@expo/vector-icons` MaterialIcons behind an `LfIcon` wrapper; corner curvature differs slightly.
- **Supabase Free pauses a project after one week of inactivity.** Mitigated by a daily GitHub Actions
  keep-alive ping plus a weekly `supabase db dump` backup.
- **`account_email` requires Kakao "Biz App" registration**, which requires a business registration
  number. Until then the app must work with no user email. `User.email` is already `string | null`, so
  no type change is needed — but the reminder path for web participants narrows. Open as **C-1**.
- **Google Play closed testing**: 12 testers for 14 consecutive days is required for personal developer
  accounts created after 2023-11-13. Tester recruitment must start alongside development, not after.
- Expo's free EAS Build tier allows 15 Android builds/month with 1 concurrency; local builds are the
  default to avoid the cap.

## Alternatives considered

**Flutter** (the candidate 상위기획서 N-3 named as "preferred to evaluate"). Rejected as first choice:
the official Kakao SDK has no web support and Flutter Web cannot meet the 3s acceptance-web target, so
choosing Flutter still means two languages — while giving up the single-language benefit. It remains a
defensible second choice and was ranked as such.

**Kotlin (Jetpack Compose) + Next.js.** Rejected: best-in-class Android quality and the most mature
Kakao SDK story, but iOS would require a complete second implementation with no workaround, and it
also lands on two languages. For a solo developer this is the highest long-run cost of the three.

**Stay on plain HTML/CSS and package with a WebView.** Not seriously entertained: push notifications,
image capture, secure storage and AdMob all want native access, and a WebView shell would read as a
web page inside an app precisely on the trust screens where it matters most.
