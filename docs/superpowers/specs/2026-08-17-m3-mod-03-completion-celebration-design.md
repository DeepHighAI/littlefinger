# M3 MOD-03 Completion Celebration Design

**Date:** 2026-08-17

**Status:** Proposed for implementation review

**Scope:** One-time authenticated app celebration after a promise becomes COMPLETED

## Goal

Complete MOD-03 for creators and partners. When a user first opens a promise in the Android app
after its transition to COMPLETED, the app presents one celebration sheet with the promise result,
that user's keep-rate change, a text-share action, and a new-promise action. The experience must be
recoverable across request loss, consumed independently per participant, and must not change the
promise result or the keep-rate formula.

The completion celebration is an app-only delivery concern. It is not a notification, is not part
of the public promise-detail response, and is never shown to witnesses or on the acceptance web.

## Product Decisions

The following decisions are fixed for this implementation:

- the celebration is delivered once per promise and per CREATOR/PARTNER user;
- the durable server record is created in the same transaction that changes CHECKING to COMPLETED;
- opening the COMPLETED SCR-A05 detail is the delivery trigger, regardless of whether the user
  arrived from SCR-A06, the home list, a notification, or a cold-start deep link;
- a server claim plus an encrypted local idempotency key protects the handoff to the native modal;
- the sheet can be dismissed with its scrim or the Android back action;
- text sharing remains in MVP, while an image share card remains deferred;
- the existing trust-profile calculation and three-promise minimum sample do not change; and
- no ad or reserved ad area is rendered.

## Chosen Architecture

Add a private per-user completion-delivery record and a dedicated authenticated claim endpoint.

The alternatives are rejected for the following reasons:

1. **Store display fields on `promise_participants`.** This avoids a new table, but mixes a screen
   delivery lifecycle into membership data, provides no clean immutable before/after keep-rate
   snapshot, and makes later delivery variants add more participant columns.
2. **Store a local seen flag only.** This is simple, but cannot enforce one delivery across devices,
   reinstallations, or lost server responses.
3. **Selected: private per-user celebration records plus a claim endpoint.** This keeps the result
   transaction atomic, captures historical rates at the only authoritative transition, and gives
   each party an independent, idempotent consumption boundary.

## Shared Contract

Add one authenticated endpoint slug, `completion-celebration-claim`, and these strict shared
contracts:

```ts
interface CompletionCelebrationClaimRequest {
  promise_id: string;
}

interface CompletionCelebrationView {
  promise_id: string;
  title: string;
  counterpart_nickname: string | null;
  keep_rate_before: number | null;
  keep_rate_after: number | null;
}

interface CompletionCelebrationClaimResponse {
  available: boolean;
  celebration: CompletionCelebrationView | null;
}
```

`available: true` requires a non-null celebration and `available: false` requires
`celebration: null`. Parsers reject unknown keys, invalid UUIDs, out-of-range rates, and
inconsistent unions. The mutation requires a Supabase JWT and a UUID `Idempotency-Key`.

The shared presentation helper renders exactly four keep-rate states:

| Before | After | Label |
|---|---|---|
| number, changed number | number | `87% → 89%` |
| number, same number | number | `75% 유지` |
| `null` | number | `지킴율 집계가 시작됐어요 · 100%` |
| any value | `null` | `약속 지킴율 집계 중` |

The final row also safely covers the domain-impossible numeric-to-null case without inventing a new
policy. All product copy lives in a MOD-03 label constant. The existing SCR-A05 text-share formatter
remains the single share-message source.

## Data Model and Completion Transaction

Add private table `completion_celebrations` with:

- `promise_id uuid not null`;
- `user_id uuid not null`;
- `participant_role participant_role not null`, constrained to CREATOR or PARTNER;
- `keep_rate_before integer null`, constrained to 0 through 100;
- `keep_rate_after integer null`, constrained to 0 through 100;
- `created_at timestamptz not null`;
- `claimed_at timestamptz null`; and
- primary key `(promise_id, user_id)`.

The table stores no invite token, notification payload, share content, or client routing state.
Direct Data API privileges are revoked from `anon` and `authenticated`; only service-role internal
functions can read or mutate it.

The latest `lf_fulfillment_submit` definition is replaced in a forward migration. When the second
response resolves the current round to COMPLETED, the locked transaction performs these steps:

1. identify the JOINED CREATOR and PARTNER rows;
2. read each user's existing `trust_profiles.keep_rate` before recomputation;
3. run the existing trust-profile recomputation unchanged;
4. read each user's resulting keep rate;
5. insert one celebration row per party with `on conflict do nothing`; and
6. complete the existing daily metric and response work.

BROKEN, DISPUTED, UNRESOLVED, and every non-terminal response create no celebration row. Promise
locking and the unique key make simultaneous second submissions produce at most one record per
user. An idempotent replay of the fulfillment response cannot overwrite the original rate snapshot.
For transitions committed after this migration, creation is inside T-12, so a committed COMPLETED
transition cannot exist without both party delivery records when both required participants exist.

The migration does not backfill promises that were already COMPLETED. Their historical pre-transition
keep rate cannot be reconstructed without inventing data. An eligible party opening such a promise
receives `available: false` and continues to SCR-A05 without a retrospective celebration.

## Claim Transaction and Idempotency

Add service-role-only function:

```sql
public.lf_completion_celebration_claim(
  p_idempotency_key uuid,
  p_actor uuid,
  p_promise_id uuid
) returns jsonb
```

The function:

1. asserts that the actor is an ACTIVE user;
2. begins the existing idempotency protocol under endpoint name
   `completion-celebration-claim`;
3. locks the promise and verifies that it is COMPLETED;
4. verifies that the actor is its JOINED CREATOR or PARTNER, returning `E_NOT_FOUND` to every other
   caller;
5. locks the actor's celebration row, returning `available: false` when an eligible actor has no
   row because the promise predates the feature;
6. if `claimed_at` is null, sets it once and returns `available: true` with the title, current
   counterpart nickname, and immutable rate snapshots;
7. if another idempotency key already consumed the row, returns `available: false`; and
8. stores the authoritative JSON response in the idempotency record.

Reusing the same key replays the first response byte-for-byte, including `available: true`, after
`claimed_at` has been set. A new key cannot consume the celebration again. Creator and partner rows
are independent, so one party's claim has no effect on the other. A missing counterpart nickname is
returned as null and rendered with the existing neutral `상대방` label.

Every `SECURITY DEFINER` function uses an explicit empty `search_path`, schema-qualifies objects,
and grants execute only to `service_role`. Claiming does not update the promise, trust profile,
notifications, or daily metrics.

## Edge Function Boundary

The new function follows the repository shell split:

- `handler.ts` requires POST, authenticates the JWT, validates exact `{ promise_id }`, validates
  the UUID idempotency header, invokes the RPC, strictly parses its response, and flattens unknown
  failures;
- `index.ts` creates runtime dependencies and registers `Deno.serve` only.

`supabase/config.toml` explicitly sets `[functions.completion-celebration-claim] verify_jwt = true`.
Logs never include a promise title, nickname, idempotency key, response payload, or participant ID.
The endpoint emits no notification and does not turn a committed fulfillment result into a failure.

## Mobile Delivery Lifecycle

SCR-A06 uses the authoritative `FulfillmentSubmitResponse`. When a successful submission returns
`status: 'COMPLETED'`, it clears the existing evidence draft and replaces the route with
`/promise/[promise_id]`. Other fulfillment outcomes retain their current behavior.

SCR-A05 attempts a claim only after an authoritative detail response reports COMPLETED. Before the
request, the app stores a user-and-promise-scoped UUID idempotency key with `LargeSecureStore`.
There is at most one in-flight claim per screen generation.

The lifecycle is:

1. load the COMPLETED promise detail;
2. restore or create and durably store the claim key;
3. call the claim endpoint;
4. render MOD-03 when the response is `available: true`;
5. remove the local key only from the modal's native `onShow` callback; and
6. clear the key without rendering when the response is `available: false`.

If the request or response fails before `onShow`, the key remains encrypted and the next eligible
detail entry replays the server's cached response. If the app process stops after the server claim
but before the modal is visible, the same key is recovered and the same payload is shown. Claim
failure is silent in the detail content: SCR-A05 remains usable and a later entry retries. The app
does not persist the title, nickname, rate snapshots, or share message locally.

## MOD-03 UX

Port the frozen MOD-03 reference as a focused native bottom sheet over SCR-A05:

- celebration icon and title `약속 지킴! 축하해요`;
- promise title followed by the completion message;
- counterpart copy using the returned nickname or neutral `상대방` fallback;
- one keep-rate state label from the shared helper;
- filled `새 약속 만들기` action; and
- text `공유하기` action.

`새 약속 만들기` dismisses the sheet and pushes `/promise/edit`. `공유하기` invokes the existing
SCR-A05 React Native `Share` message and leaves the celebration visible after the system share sheet
closes. A scrim press and Android back dismiss the celebration to the already-loaded SCR-A05 detail.
Dismissal never reopens the same server record.

The sheet uses existing color, spacing, typography, radius, elevation, and motion tokens. It has an
accessible modal boundary, an accessible dismiss action, and at least 48 dp action targets. It
contains no evidence image, generated share card, ad component, or reserved ad spacing.

## TDD and Verification Strategy

Implementation proceeds in strict RED -> expected failure -> minimum GREEN cycles:

1. shared request/response contracts, endpoint, strict parser, four-state keep-rate formatter, and
   MOD-03 labels;
2. PGlite completion-transition tests for before/after snapshots, both party records, non-COMPLETED
   outcomes, fulfillment idempotency, and simultaneous second submissions;
3. PGlite claim tests for actor eligibility, witness and outsider hiding, party independence, first
   claim, same-key replay, different-key exhaustion, privileges, and `search_path` hardening;
4. pure Edge handler tests for JWT, method, exact body, idempotency header, RPC arguments, strict
   response parsing, flattened failures, and safe logs;
5. mobile API and secure lifecycle tests for pre-request persistence, response-loss replay,
   process-restart recovery, native `onShow` cleanup, unavailable cleanup, retry, and in-flight
   deduplication;
6. SCR-A06 and SCR-A05 tests for the COMPLETED route replacement, eligible-only claim, sheet
   dismissal, text share, new-promise navigation, all rate states, accessibility, and absence of
   ads; and
7. focused regressions plus full repository tests, typecheck, web build, agent sync check, Expo
   dependency check, Android production export, diff checks, and a 360 x 800 visual comparison.

The visual report records the accessible dismiss behavior and four data-dependent rate labels as
intentional additions to the single frozen sample. Local implementation is not reported complete
until all automated gates pass. Remote migration and Edge Function deployment require a separate
explicit authorization.

## Atomic Implementation Boundaries

The subsequent executable plan should preserve these commit boundaries:

1. shared celebration contracts and presentation policy;
2. completion snapshots and claim transaction;
3. authenticated celebration Edge Function;
4. encrypted mobile claim lifecycle;
5. MOD-03 with SCR-A06 and SCR-A05 routing; and
6. verification and development-status documentation.

Each boundary closes its own RED, GREEN, focused regression, full `npm test`, `npm run typecheck`,
`npm run check:agents`, and `git diff --check` loop before commit.

## Exclusions

- image share-card generation;
- web or witness celebration delivery;
- keep-rate formula or sample-threshold changes;
- a completion push-notification event;
- changes to public promise-detail responses;
- ads, evidence images, moderation, or email delivery;
- remote migration or Edge Function deployment;
- an unrequested origin push; and
- changes to `.claude/settings.local.json`.
