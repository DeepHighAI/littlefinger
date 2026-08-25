# 0010. Drop the personal name from the public domain

Date: 2026-08-25
Status: Accepted (partially supersedes ADR 0005's domain choice; the Firebase project itself is
unchanged)

## Context

ADR 0005 pointed the acceptance web at the Firebase project's default Hosting site,
`littlefinger-app-philwoo.web.app` — which exposes a personal name in every invite link, the App
Links host, the store listing's developer website, and `app-ads.txt`. The PO directed (2026-08-25)
that the service identity must not contain personal information, and flagged it before the Play
Console listing was created — the last moment this could change, because after launch the domain
is frozen (sent invite links live only in KakaoTalk messages; the server keeps no copy to migrate).

`littlefinger.web.app` was already reserved by another project.

## Decision

- New official origin: **`https://littlefinger-app.web.app`** — an additional Hosting **site** on
  the same Firebase project (multi-site). The project ID (`littlefinger-app-philwoo`) still
  contains the name but appears only in consoles, never to users. PO picked the name from three
  reserved candidates (`littlefinger-app`, `-kr`, `-promise`; the other two were released).
- The old site stays as a **301 redirect** (path-preserving, explicit rule for `/`) so any stale
  E2E-era link lands on the new origin. Deploys target `hosting:web` (new) + `hosting:legacy`
  (redirect-only) via `.firebaserc` targets.
- Everything that carried the origin moved with it: web SEO/OG, `routes.ts` docs, all tests,
  `.env(.example)`, EAS `EXPO_PUBLIC_WEB_BASE_URL` (production + development — App Links intent
  filters derive from it at build time), Supabase auth `site_url` + allowlist (field-scoped
  Management API PATCH; legacy origin kept in the allowlist during transition), current-truth
  docs. Historical records (ADR 0005/0007 bodies, handoffs, QA run logs) keep the old string.
- The privacy policy §8 account-deletion URL is document text, so the change is a re-version:
  **PRIVACY `2026-08-25.1`** (migration `20260825000001` bumps `lf_current_privacy_version()`;
  TERMS stays `2026-08-22.3`).
- The in-flight production AAB (`73a42ec1`) was cancelled — it had the old origin baked into the
  bundle and intent filters — and rebuilt after the env change.

## Consequences

- The Play listing, AdMob `app-ads.txt` crawl, and store developer-website field all use the new
  origin; `app-ads.txt` and `assetlinks.json` are live on it (verified 200).
- The Expo account name (`owner: philwoo`) and the GCP/Firebase project IDs are unchanged — they
  are operator-console identifiers, not user-facing surface. Renaming them would reset EAS build
  history and Firebase config for no user-visible gain.
- A custom domain (e.g. `littlefinger.kr`, open item N-1 adjacent) can be attached to the new
  site later without another migration.
