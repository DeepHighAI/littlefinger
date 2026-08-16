# F-01 Legal Terms and J-09 Record Integrity Design

## Goal

Complete the local F-01 legal-document and terms-agreement boundary, then add the weekly J-09 integrity batch. The legal copy remains a visibly marked, non-deployable draft until the PO supplies operator details and counsel reviews the text. J-09 remains internal: participants keep reading the authoritative activated version, and only operators see integrity incidents.

## Confirmed Decisions

- Publish local draft pages at `/legal/terms` and `/legal/privacy` without authentication or ads.
- Mark both pages `DRAFT` and use version `2026-08-16-draft.1`.
- Show explicit placeholders for the operator, representative, address, support contact, privacy officer, and overseas-processing details.
- Record the current terms and privacy versions once for each new user. Backfill only users who have no agreement record; never infer consent to a later version.
- Store J-09 alerts in a private `integrity_incidents` table instead of user notifications.
- Keep hash and cache failures off SCR-A05 and every public API response.
- Check both the activated version hash and the `promises` read cache required by EC-C04.
- Do not deploy legal drafts or claim remote completion. The Supabase Management API 403 remains a separate deployment gate.

## Legal Basis and Draft Boundary

The draft follows the product specification and the current public guidance available on 2026-08-16. The Korean Terms and Conditions Act requires clear Korean terms and conspicuous presentation of important clauses. The Personal Information Protection Commission's 2026 guidance identifies collection items, purposes, retention, recipients and processors, rights, and contact paths as core privacy-policy content.

References:

- [Korean Terms and Conditions Act](https://law.go.kr/LSW/lsInfoP.do?ancYnChk=0&lsId=000667)
- [2026 Personal Information Processing Policy guidance announcement](https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS074&mCode=C020010000&nttId=12021)

The documents are engineering drafts, not legal advice. Every page shows a draft banner and a release checklist. A production release must replace every placeholder, confirm processor and overseas-transfer facts, change the versions, obtain legal review, and record the approval date. Tests deliberately require the draft marker so this implementation cannot be mistaken for final copy.

## Shared Legal Contract

`packages/shared` owns the stable document metadata:

```ts
type LegalDocumentStatus = 'DRAFT' | 'FINAL';
type LegalDocumentKind = 'TERMS' | 'PRIVACY';

interface LegalDocumentMetadata {
  kind: LegalDocumentKind;
  status: LegalDocumentStatus;
  version: string;
  path: '/legal/terms' | '/legal/privacy';
  effective_date: IsoDate;
}
```

The current metadata uses `DRAFT`, `2026-08-16-draft.1`, and `2026-08-16`. Shared helpers build same-origin web paths and mobile URLs from `EXPO_PUBLIC_WEB_BASE_URL`; they reject a missing or non-HTTP(S) base URL. Korean labels and document prose live in dedicated label/content modules, not screen files.

SQL owns matching current-version functions because migrations cannot import TypeScript. A cross-boundary test compares SQL results with the shared metadata. Changing either version without the other fails the suite.

## Draft Documents and Links

The web app adds public, responsive legal pages that reuse its tokens and base components. Neither page uses a new SCR identifier because the planning documents define them as legal resources rather than product-flow screens. Both pages contain a title, draft notice, version and effective date, structured sections, the immutable `LEGAL_DISCLAIMER`, and a release checklist.

The terms draft covers:

- service purpose and definitions;
- Kakao-only accounts and user responsibility;
- promise creation, mutual approval, immutable activated versions, reminders, fulfillment checks, and optional evidence;
- prohibited conduct and account restrictions;
- retention, withdrawal, and de-identification;
- service changes and interruptions;
- no escrow, automatic penalty settlement, notarization, or guaranteed legal effect;
- dispute handling and operator placeholders.

The privacy draft describes the implemented data flow:

- Kakao identifier, nickname, and profile image;
- no collection of email or phone numbers in the MVP;
- promise content, approval history, hashed audit attributes, push tokens, and optional evidence;
- hashed IP and User-Agent values without retaining originals;
- 90-day DRAFT and notification retention, 365-day post-closure evidence retention, and preserved activated records;
- Kakao, Supabase, Expo/FCM, and Cloudflare processing roles;
- third-party provision, processing delegation, overseas processing, user rights, safeguards, and contact placeholders.

SCR-A01 opens the legal paths in the system browser. SCR-W01 uses same-origin links. Link failures preserve the login screen and expose an accessible Korean error. The acceptance web remains ad-free.

## Terms-Agreement Recording

A forward migration hardens `terms_agreements`:

- add a unique constraint on `(user_id, terms_version, privacy_version)`;
- revoke direct inserts from `anon` and `authenticated`;
- retain self-read access so a future profile screen can show agreement history;
- grant writes only through server-owned functions.

The existing `auth.users` trigger inserts the current versions in the same transaction as a new public user. A failed agreement insert therefore aborts the new user creation rather than leaving a session without the required record.

`lf_user_provision` handles pre-feature users. It inserts the current draft versions only when the actor has no agreement rows. It does not add a new agreement when any older record exists; future version changes require an explicit re-consent design. Repeated app and web sign-ins remain idempotent through the unique constraint.

The Edge shell keeps its current 204 response. New users do not depend on a post-login network call because the auth trigger is authoritative. For a legacy user, a failed provision call leaves the row missing and retries on the next `SIGNED_IN` event, matching the established non-blocking profile-repair behavior.

## Internal Integrity Model

The existing `promises.hash_verified_at` stores the last completed J-09 check time without revealing its outcome. An unresolved private incident is the failure flag. J-09 adds no outcome column to `promises`, because participant RLS permits direct promise reads and would expose that column through the Data API.

`integrity_incidents` stores one lifecycle row per promise, activated version, and incident kind:

```text
kind = HASH_MISMATCH | CACHE_MISMATCH
first_detected_at
last_detected_at
resolved_at
```

The table stores identifiers, hashes, and mismatched field names, never raw promise content. RLS is enabled without client policies. `anon` and `authenticated` receive no table or function privileges.

The public promise-detail contract removes `integrity_status`. SCR-A05 removes the corresponding badge and card. Participants still see the activated `promise_versions` data, fingerprint, and approval history. A cache mismatch cannot make the cache authoritative.

## J-09 Batch

`lf_verify_promise_integrity(p_now timestamptz default now())` is a `SECURITY DEFINER` function with an empty `search_path` and service-role-only execution. It takes a transaction advisory lock so overlapping cron or manual runs cannot interleave.

The batch selects every current version whose `activated_at` is non-null, including ACTIVE, AMEND_PENDING, CHECKING, and terminal promises. It excludes DRAFT, PENDING, and DECLINED versions that were never activated.

For each selected row, it:

1. recalculates the version hash with `lf_content_hash` and compares it with `promise_versions.content_hash`;
2. compares the eight current cache fields with the authoritative version using null-safe exact equality;
3. sets `hash_verified_at`;
4. opens or refreshes one incident for each failed check;
5. resolves an open incident when that check passes again.

The batch never edits version content, stored hashes, or promise cache fields. Any write failure rolls back the complete run. The response contains only `checked_count`, `failed_count`, and `resolved_count`; it exposes no content or hash. `checked_count` counts promises, `failed_count` counts promises with either failed check, and `resolved_count` counts incident rows resolved during the run.

`lf_schedule_promise_integrity()` replaces any cron job with the same name and creates exactly one schedule at `30 20 * * 6` UTC, which is Sunday 05:30 KST. The scheduler uses a transaction advisory lock and service-role-only execution.

## Failure Handling and Security

- A legal URL builder rejects malformed configuration before opening a browser.
- A legal-page failure never starts OAuth or discards an invite token.
- Agreement insertion is atomic for new users and retryable for legacy users.
- Clients cannot forge versions or agreement times through the Data API.
- J-09 failures roll back rather than publishing partial verification state.
- Re-running J-09 with the same `p_now` creates no duplicate incidents and no divergent timestamps.
- Incidents never enter the user notification outbox.
- Logs contain counts and error codes only.

## TDD and Verification

Implementation follows strict RED, observed failure, minimal GREEN, regression, and refactor cycles.

F-01 tests cover metadata parsing, routes, draft markers, required sections, the immutable disclaimer, mobile and web links, new-user atomic insertion, legacy backfill, old-version preservation, duplicate sign-in, and Data API denial.

J-09 tests cover a valid record, hash mismatch, cache mismatch, simultaneous mismatches, pre-activation exclusion, all activated lifecycle states, immutable source data, incident deduplication, later detection, resolution, overlapping execution, permissions, safe result shape, cron replacement, and the absence of integrity state from public detail responses and SCR-A05.

Required gates:

- focused shared, web, PGlite, Edge, and mobile tests;
- `npm test`;
- `npm run typecheck`;
- `npm run build:web`;
- `npm run check:agents`;
- `npx expo install --check`;
- Android production export;
- `git diff --check`.

The draft pages receive a structural 360x800 review. Pixel-pass, remote migration, cron verification, Cloudflare deployment, and production legal approval remain blocked.

## Scope Exclusions

- final legal advice or production operator facts;
- changed-terms re-consent UI;
- SCR-A08 profile and legal-history UI;
- account withdrawal implementation;
- operator dashboard, email, Slack, or pager delivery for incidents;
- automatic integrity repair;
- remote deployment, `supabase config push`, or `origin` push;
- `.claude/settings.local.json`.
