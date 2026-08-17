# M3 MOD-03 Completion Celebration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one recoverable, per-user MOD-03 celebration when a creator or partner first opens
a promise in the Android app after it becomes COMPLETED.

**Architecture:** Capture immutable before/after keep-rate snapshots for each party inside T-12,
then expose them through authenticated idempotent claim and shown transactions. SCR-A05 claims only
an eligible COMPLETED detail and uses an encrypted PENDING/SHOWN local envelope to bridge the server
reservation to the native modal and acknowledge actual exposure. SCR-A06 routes an authoritative
COMPLETED submit result into SCR-A05.

**Tech Stack:** TypeScript, Vitest, Jest Expo, PGlite/Postgres SQL, Supabase Edge Functions, React
Native, Expo Router, LargeSecureStore, React Native Testing Library.

## Global Constraints

- The approved design is
  `docs/superpowers/specs/2026-08-17-m3-mod-03-completion-celebration-design.md` at commit
  `c24d830` (original approval `42c64ef`, shown-acknowledgement alignment `c24d830`).
- Use `superpowers:test-driven-development` for every behavior change: RED, expected failure,
  minimum GREEN, focused regression, refactor.
- MOD-03 is APP-only and available only to the JOINED CREATOR and PARTNER of a COMPLETED promise.
- T-12 creates one private celebration row per eligible party in the same transaction as the
  COMPLETED transition. BROKEN, DISPUTED, UNRESOLVED, and waiting submissions create none.
- Do not backfill promises completed before this migration because their pre-transition keep rate
  cannot be reconstructed. Eligible parties receive `available: false` for those promises.
- Keep-rate calculation and `TRUST_MIN_SAMPLE` remain unchanged. Store only the resulting integer
  or null snapshots.
- Display policy is exact: changed `87% → 89%`, unchanged `75% 유지`, first aggregation
  `지킴율 집계가 시작됐어요 · 100%`, and unavailable aggregation `약속 지킴율 집계 중`.
- Claim and shown acknowledgement require JWT and separate UUID `Idempotency-Key` values. Same-key
  claim replay returns the first successful payload; another claim key returns `available: false`
  after reservation. Only the matching server-generated claim ID can record `shown_at`.
- The public promise-detail response must not expose claim or celebration state.
- Claim/shown keys and the server-generated claim ID are encrypted with `LargeSecureStore`; title,
  nickname, rate snapshots, and share text are never persisted locally.
- All product strings live in label constants. All component dimensions, colors, radii, elevation,
  typography, and motion use existing tokens. Action targets are at least 48 dp.
- MOD-03 contains no ad, evidence image, generated share card, or reserved ad space.
- All new `SECURITY DEFINER` functions use `search_path = ''`, schema-qualify every object, revoke
  execution from `PUBLIC`, `anon`, and `authenticated`, and grant only `service_role`.
- Relative TypeScript imports include `.ts` or `.tsx`. Deno entrypoints contain no testable logic.
- Never edit `design-reference`; never run `supabase config push`; never modify or commit
  `.claude/settings.local.json`; do not deploy remotely or push `origin` without a separate request.

---

## File Map

- `packages/shared/src/completion-celebration.ts`: wire types, strict response parser, and four-state
  keep-rate presentation policy.
- `packages/shared/src/completion-celebration.test.ts`: parser, endpoint, and rate-label tests.
- `packages/shared/src/api.ts`: `completionCelebrationClaim` and `completionCelebrationShown`
  endpoint slugs.
- `packages/shared/src/api.test.ts`: endpoint stability assertion.
- `packages/shared/src/index.ts`: public completion-celebration export.
- `supabase/migrations/20260817100453_mod_03_completion_celebration.sql`: private table, T-12 snapshot
  extension, claim/shown RPCs, RLS, and grants.
- `supabase/tests/core-fulfillment.test.ts`: T-12 snapshot and concurrent second-submit behavior.
- `supabase/tests/completion-celebration.test.ts`: claim/shown authorization, idempotency, fencing,
  legacy data, and party independence.
- `supabase/tests/schema.test.ts`: table/RPC/search-path/grant contract.
- `supabase/tests/rls.test.ts`: direct Data API denial.
- `supabase/functions/_shared/completion-celebration.ts`: exact claim and shown request parsers.
- `supabase/functions/completion-celebration-claim/handler.ts`: pure JWT/idempotency/RPC shell.
- `supabase/functions/completion-celebration-claim/index.ts`: thin Deno entrypoint.
- `supabase/functions/completion-celebration-shown/handler.ts`: pure shown-acknowledgement shell.
- `supabase/functions/completion-celebration-shown/index.ts`: thin Deno entrypoint.
- `supabase/tests/edge-completion-celebration.test.ts`: request, response, failure, and safe-log tests.
- `supabase/tests/edge-bundle.test.ts`: new entrypoint import graph.
- `supabase/config.toml`: explicit `verify_jwt = true` entry.
- `apps/mobile/src/lib/completion-celebration-api.ts`: strict mobile function wrapper.
- `apps/mobile/src/lib/completion-celebration-api.test.ts`: endpoint/options/malformed-response tests.
- `apps/mobile/src/lib/completion-celebration-claim.ts`: encrypted PENDING/SHOWN state machine.
- `apps/mobile/src/lib/completion-celebration-claim.test.ts`: response-loss, restart, cleanup, and
  per-user tests.
- `apps/mobile/src/lib/completion-celebration-native.ts`: Expo/Supabase/LargeSecureStore bindings.
- `apps/mobile/src/lib/completion-celebration-native.test.ts`: native module load boundary.
- `apps/mobile/src/screens/mod-03-completion-celebration-labels.ts`: all MOD-03 product copy.
- `apps/mobile/src/components/completion-celebration-sheet.tsx`: token-only native modal.
- `apps/mobile/src/screens/mod-03-completion-celebration.test.tsx`: four states, actions,
  accessibility, and no-ad tests.
- `apps/mobile/src/app/promise/[promise_id].tsx`: eligible claim and sheet integration.
- `apps/mobile/src/screens/scr-a05-promise-detail.test.tsx`: SCR-A05 lifecycle and retry tests.
- `apps/mobile/src/app/fulfillment/[promise_id].tsx`: COMPLETED submit route replacement.
- `apps/mobile/src/screens/scr-a06-fulfillment-check.test.tsx`: authoritative result routing.
- `docs/DEVELOPMENT_STATUS.md`: local MOD-03 status and remaining UAT/deployment gate.
- `TODOS.md`: retain unrelated operational work; add no MOD-03 placeholder after local completion.

---

### Task 1: Define Strict Celebration Contracts and Presentation Policy

**Files:**
- Create: `packages/shared/src/completion-celebration.ts`
- Create: `packages/shared/src/completion-celebration.test.ts`
- Modify: `packages/shared/src/api.ts`
- Modify: `packages/shared/src/api.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**

```ts
export interface CompletionCelebrationClaimRequest {
  promise_id: string;
}

export interface CompletionCelebrationView {
  claim_id: string;
  promise_id: string;
  title: string;
  counterpart_nickname: string | null;
  keep_rate_before: number | null;
  keep_rate_after: number | null;
}

export type CompletionCelebrationClaimResponse =
  | { available: true; celebration: CompletionCelebrationView }
  | { available: false; celebration: null };

export interface CompletionCelebrationShownRequest {
  promise_id: string;
  claim_id: string;
}

export interface CompletionCelebrationShownResponse {
  promise_id: string;
  shown_at: IsoDateTime;
}

export function asCompletionCelebrationClaimResponse(
  value: unknown,
): CompletionCelebrationClaimResponse | null;

export function asCompletionCelebrationShownResponse(
  value: unknown,
): CompletionCelebrationShownResponse | null;

export function completionKeepRateLabel(
  before: number | null,
  after: number | null,
): string;
```

- [ ] **Step 1: Write RED contract and presentation tests**

Create fixtures with valid v4 UUIDs and assert:

```ts
expect(parse(validAvailable)).toEqual(validAvailable);
expect(parse({ available: false, celebration: null })).not.toBeNull();
expect(parse({ ...validAvailable, extra: true })).toBeNull();
expect(parse({ available: true, celebration: null })).toBeNull();
expect(parse({ available: false, celebration: validView })).toBeNull();
expect(parse({ ...validAvailable, celebration: { ...validView, keep_rate_after: 101 } })).toBeNull();
expect(parse({ ...validAvailable, celebration: { ...validView, promise_id: 'bad' } })).toBeNull();
expect(parse({ ...validAvailable, celebration: { ...validView, claim_id: 'bad' } })).toBeNull();
expect(parseShown({ promise_id: PROMISE_ID, shown_at: NOW })).not.toBeNull();
expect(parseShown({ promise_id: PROMISE_ID, shown_at: NOW, extra: true })).toBeNull();

expect(completionKeepRateLabel(87, 89)).toBe('약속 지킴율 87% → 89%');
expect(completionKeepRateLabel(75, 75)).toBe('약속 지킴율 75% 유지');
expect(completionKeepRateLabel(null, 100)).toBe('지킴율 집계가 시작됐어요 · 100%');
expect(completionKeepRateLabel(null, null)).toBe('약속 지킴율 집계 중');
expect(completionKeepRateLabel(75, null)).toBe('약속 지킴율 집계 중');
expect(ENDPOINT.completionCelebrationClaim).toBe('completion-celebration-claim');
expect(ENDPOINT.completionCelebrationShown).toBe('completion-celebration-shown');
```

- [ ] **Step 2: Run RED and confirm missing exports**

Run:

```bash
npx vitest run packages/shared/src/completion-celebration.test.ts packages/shared/src/api.test.ts
```

Expected: FAIL because the module, parser, formatter, export, and endpoint do not exist.

- [ ] **Step 3: Implement the minimum strict module**

Use an exact-record helper, a v1-v5 UUID check matching existing shared parsers, and this rate
policy:

```ts
export function completionKeepRateLabel(before: number | null, after: number | null): string {
  if (after === null) return '약속 지킴율 집계 중';
  if (before === null) return `지킴율 집계가 시작됐어요 · ${after}%`;
  if (before === after) return `약속 지킴율 ${after}% 유지`;
  return `약속 지킴율 ${before}% → ${after}%`;
}
```

The parser accepts only the exact union keys. A view requires a valid UUID, non-empty title,
nickname string or null, a valid claim UUID, and integer rates from 0 through 100 or null. The shown
parser accepts exactly a UUID `promise_id` and ISO instant `shown_at`. Add both endpoint slugs to
`ENDPOINT` and export the module from `packages/shared/src/index.ts`.

- [ ] **Step 4: Run focused GREEN and shared regressions**

Run:

```bash
npx vitest run packages/shared/src/completion-celebration.test.ts packages/shared/src/api.test.ts packages/shared/src/keep-rate.test.ts packages/shared/src/trust-profile.test.ts
npm run typecheck
```

Expected: all selected tests and typecheck PASS.

- [ ] **Step 5: Run the commit gate and commit**

Run:

```bash
npm test
npm run check:agents
git diff --check
git add packages/shared/src/completion-celebration.ts packages/shared/src/completion-celebration.test.ts packages/shared/src/api.ts packages/shared/src/api.test.ts packages/shared/src/index.ts
git diff --cached --check
git commit -m "feat: define completion celebration contracts"
```

---

### Task 2: Capture Completion Snapshots and Add Claim/Shown Transactions

**Files:**
- Create: `supabase/migrations/20260817100453_mod_03_completion_celebration.sql`
- Modify: `supabase/tests/core-fulfillment.test.ts`
- Create: `supabase/tests/completion-celebration.test.ts`
- Modify: `supabase/tests/schema.test.ts`
- Modify: `supabase/tests/rls.test.ts`

**Interfaces:**

```sql
public.lf_completion_celebration_claim(
  p_idempotency_key uuid,
  p_actor uuid,
  p_promise_id uuid
) returns jsonb

public.lf_completion_celebration_shown(
  p_idempotency_key uuid,
  p_actor uuid,
  p_promise_id uuid,
  p_claim_id uuid
) returns jsonb
```

The replacement `lf_fulfillment_submit` must preserve the current nine-argument signature from
`20260731133106_f08_core_evidence_attachments.sql`.

- [ ] **Step 1: Write T-12 RED tests before the migration**

Add named tests that establish explicit fixtures and assert:

```ts
test('KEPT plus KEPT stores creator and partner rates before and after recomputation');
test('a party below the sample threshold stores null before and the first numeric rate after');
test('an unchanged party rate stores the same integer twice');
test.each(['BROKEN', 'DISPUTED'])('%s completion result creates no celebration row');
test('the first response that still waits creates no celebration row');
test('parallel second responses create exactly one row per party and one COMPLETED transition');
test('same fulfillment idempotency key does not overwrite the original snapshots');
```

Seed keeper-specific completed/broken histories so expected rates are literal, not copied from the
implementation. Verify both the promise result and the two stored rows after each test.

- [ ] **Step 2: Write claim and security RED tests**

Add:

```ts
test('creator and partner claim independently');
test('first claim returns title counterpart and immutable rate snapshots');
test('same-key replay returns the original available payload byte-for-byte');
test('a different key after claim returns available false');
test('shown records the first native exposure time for the matching claim ID');
test('same-key shown replay and different-key retry return the original shown time');
test('wrong another-user and random claim IDs are hidden as not found');
test('eligible party on a pre-migration completed promise returns available false');
test('witness outsider inactive user and non-completed caller cannot claim');
test('parallel claim keys expose at most one available true response');
test('authenticated and anon cannot select update or execute the private boundary');
test('claim RPC is SECURITY DEFINER with an empty search_path and service-role-only execute');
```

- [ ] **Step 3: Run RED and confirm missing table/RPC**

Run:

```bash
npx vitest run supabase/tests/core-fulfillment.test.ts supabase/tests/completion-celebration.test.ts supabase/tests/schema.test.ts supabase/tests/rls.test.ts
```

Expected: the new assertions fail because `completion_celebrations`,
`lf_completion_celebration_claim`, and `lf_completion_celebration_shown` do not exist and T-12
stores no snapshots.

- [ ] **Step 4: Create the private table and grants**

Use this schema, then enable RLS without adding client policies:

```sql
create table public.completion_celebrations (
  promise_id uuid not null references public.promises(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  participant_role public.participant_role not null,
  keep_rate_before int,
  keep_rate_after int,
  created_at timestamptz not null default now(),
  claim_id uuid unique,
  claimed_at timestamptz,
  shown_at timestamptz,
  primary key (promise_id, user_id),
  constraint completion_celebrations_party_role
    check (participant_role in ('CREATOR', 'PARTNER')),
  constraint completion_celebrations_before_range
    check (keep_rate_before is null or keep_rate_before between 0 and 100),
  constraint completion_celebrations_after_range
    check (keep_rate_after is null or keep_rate_after between 0 and 100)
);

alter table public.completion_celebrations enable row level security;
revoke all on table public.completion_celebrations from public, anon, authenticated;
```

- [ ] **Step 5: Replace T-12 with exact snapshot capture**

Copy the current complete evidence-aware `lf_fulfillment_submit` definition and preserve all
validation, evidence binding, retention, notification-recipient, and response fields. Add
`v_keep_rates_before jsonb := '{}'::jsonb;` and, only for `v_result = 'COMPLETED'`, execute before
the existing recomputation:

```sql
select coalesce(
         jsonb_object_agg(pp.user_id::text, to_jsonb(tp.keep_rate)),
         '{}'::jsonb
       )
  into v_keep_rates_before
  from public.promise_participants pp
  left join public.trust_profiles tp on tp.user_id = pp.user_id
 where pp.promise_id = p_promise_id
   and pp.role in ('CREATOR', 'PARTNER')
   and pp.status = 'JOINED';
```

Keep `perform public.lf_recompute_promise_trust_profiles(p_promise_id);` in its existing position,
then insert after it only for COMPLETED:

```sql
insert into public.completion_celebrations (
  promise_id, user_id, participant_role, keep_rate_before, keep_rate_after
)
select p_promise_id,
       pp.user_id,
       pp.role,
       (v_keep_rates_before ->> pp.user_id::text)::int,
       tp.keep_rate
  from public.promise_participants pp
  left join public.trust_profiles tp on tp.user_id = pp.user_id
 where pp.promise_id = p_promise_id
   and pp.role in ('CREATOR', 'PARTNER')
   and pp.status = 'JOINED'
on conflict (promise_id, user_id) do nothing;
```

Do not change the trust recomputation, daily metric, promise lock, evidence retention, or response
JSON.

- [ ] **Step 6: Implement the idempotent claim RPC**

Implement the approved order: assert actor, begin endpoint idempotency, lock the COMPLETED promise,
verify a JOINED CREATOR/PARTNER, lock the actor's celebration row, return false for a legacy missing
row or an already reserved row, otherwise generate `claim_id`, set `claimed_at` once, and return the
claim ID plus joined title/current counterpart nickname and snapshots. Use this response shape in
both branches:

```sql
jsonb_build_object(
  'available', false,
  'celebration', null
)
```

and:

```sql
jsonb_build_object(
  'available', true,
  'celebration', jsonb_build_object(
    'claim_id', v_celebration.claim_id,
    'promise_id', p_promise_id,
    'title', v_title,
    'counterpart_nickname', v_counterpart_nickname,
    'keep_rate_before', v_celebration.keep_rate_before,
    'keep_rate_after', v_celebration.keep_rate_after
  )
)
```

Call `lf_idempotency_finish` for both authoritative responses. Revoke the RPC from Data API roles
and grant only `service_role`.

- [ ] **Step 7: Implement the shown acknowledgement RPC**

Assert the ACTIVE actor, begin idempotency under `completion-celebration-shown`, lock the actor-owned
row by `(promise_id, user_id, claim_id)`, and return `E_NOT_FOUND` when it does not match. Set
`shown_at = coalesce(shown_at, now())` and return:

```sql
jsonb_build_object(
  'promise_id', p_promise_id,
  'shown_at', v_shown_at
)
```

Finish idempotency for the first response. The same key replays it, and a different key after
success returns the same stored `shown_at`. Apply the same empty `search_path`, schema qualification,
revokes, and service-role grant as the claim RPC.

- [ ] **Step 8: Run focused GREEN and transaction regressions**

Run:

```bash
npx vitest run supabase/tests/core-fulfillment.test.ts supabase/tests/completion-celebration.test.ts supabase/tests/schema.test.ts supabase/tests/rls.test.ts supabase/tests/evidence-lifecycle.test.ts supabase/tests/idempotency.test.ts supabase/tests/trust-profile.test.ts supabase/tests/promise-integrity.test.ts
npm run typecheck
```

Expected: all selected tests and typecheck PASS.

- [ ] **Step 9: Run the commit gate and commit**

Run:

```bash
npm test
npm run check:agents
git diff --check
git add supabase/migrations/20260817100453_mod_03_completion_celebration.sql supabase/tests/core-fulfillment.test.ts supabase/tests/completion-celebration.test.ts supabase/tests/schema.test.ts supabase/tests/rls.test.ts
git diff --cached --check
git commit -m "feat: add completion celebration transaction"
```

---

### Task 3: Add the Authenticated Celebration Edge Functions

**Files:**
- Create: `supabase/functions/_shared/completion-celebration.ts`
- Create: `supabase/functions/completion-celebration-claim/handler.ts`
- Create: `supabase/functions/completion-celebration-claim/index.ts`
- Create: `supabase/functions/completion-celebration-shown/handler.ts`
- Create: `supabase/functions/completion-celebration-shown/index.ts`
- Create: `supabase/tests/edge-completion-celebration.test.ts`
- Modify: `supabase/tests/edge-bundle.test.ts`
- Modify: `supabase/config.toml`

**Interfaces:**

```ts
export function completionCelebrationPromiseIdOf(
  body: Record<string, unknown>,
): string;

export function completionCelebrationShownInputOf(
  body: Record<string, unknown>,
): { promiseId: string; claimId: string };

export function createCompletionCelebrationClaimHandler(deps: Deps):
  (request: Request) => Promise<Response>;

export function createCompletionCelebrationShownHandler(deps: Deps):
  (request: Request) => Promise<Response>;
```

- [ ] **Step 1: Write Edge RED tests**

For both handlers cover OPTIONS, non-POST, missing or invalid JWT, missing or invalid idempotency key,
non-object JSON, exact keys, exact RPC arguments, known `E_NOT_FOUND`, unknown-failure flattening,
handler reuse, and safe logs. Claim additionally covers valid available/unavailable payloads and
malformed unions. Shown accepts exactly `promise_id` and `claim_id`, strictly parses an ISO
`shown_at`, and rejects an extra key or malformed UUID. Add both indexes to the real import-graph
test and assert both config stanzas are JWT-protected.

- [ ] **Step 2: Run RED**

Run:

```bash
npx vitest run supabase/tests/edge-completion-celebration.test.ts supabase/tests/edge-bundle.test.ts supabase/tests/edge-shared.test.ts
```

Expected: FAIL because the request helpers, handlers, entrypoints, and config entries do not exist.

- [ ] **Step 3: Implement exact request parsing and the pure handler**

The request helper accepts only `{ promise_id }` and validates the repository UUID pattern. The
handler follows this exact boundary:

```ts
export function createCompletionCelebrationClaimHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      }
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const promiseId = completionCelebrationPromiseIdOf(
        await jsonBody(request, 'promise_id'),
      );
      const payload = asCompletionCelebrationClaimResponse(
        await deps.rpc('lf_completion_celebration_claim', {
          p_idempotency_key: idempotencyKey,
          p_actor: actor,
          p_promise_id: promiseId,
        }),
      );
      if (payload === null) throw new Error('INVALID_COMPLETION_CELEBRATION_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
```

Keep `index.ts` to `createDeps`, handler construction, and `Deno.serve`. Add:

```toml
[functions.completion-celebration-claim]
verify_jwt = true

[functions.completion-celebration-shown]
verify_jwt = true
```

Implement shown with this explicit boundary:

```ts
export function createCompletionCelebrationShownHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') {
        throw new ApiError('E_VALIDATION', { field: 'promise_id' });
      }
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const idempotencyKey = idempotencyKeyOf(request);
      const input = completionCelebrationShownInputOf(
        await jsonBody(request, 'promise_id'),
      );
      const payload = asCompletionCelebrationShownResponse(
        await deps.rpc('lf_completion_celebration_shown', {
          p_idempotency_key: idempotencyKey,
          p_actor: actor,
          p_promise_id: input.promiseId,
          p_claim_id: input.claimId,
        }),
      );
      if (payload === null) throw new Error('INVALID_COMPLETION_CELEBRATION_SHOWN_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
```

- [ ] **Step 4: Run focused GREEN and Edge regressions**

Run:

```bash
npx vitest run supabase/tests/edge-completion-celebration.test.ts supabase/tests/edge-bundle.test.ts supabase/tests/edge-shared.test.ts supabase/tests/edge-fulfillment.test.ts
npm run typecheck
```

- [ ] **Step 5: Run the commit gate and commit**

Run:

```bash
npm test
npm run check:agents
git diff --check
git add supabase/functions/_shared/completion-celebration.ts supabase/functions/completion-celebration-claim/handler.ts supabase/functions/completion-celebration-claim/index.ts supabase/functions/completion-celebration-shown/handler.ts supabase/functions/completion-celebration-shown/index.ts supabase/tests/edge-completion-celebration.test.ts supabase/tests/edge-bundle.test.ts supabase/config.toml
git diff --cached --check
git commit -m "feat: add completion celebration endpoints"
```

---

### Task 4: Add the Encrypted Mobile Claim Lifecycle

**Files:**
- Create: `apps/mobile/src/lib/completion-celebration-api.ts`
- Create: `apps/mobile/src/lib/completion-celebration-api.test.ts`
- Create: `apps/mobile/src/lib/completion-celebration-claim.ts`
- Create: `apps/mobile/src/lib/completion-celebration-claim.test.ts`
- Create: `apps/mobile/src/lib/completion-celebration-native.ts`
- Create: `apps/mobile/src/lib/completion-celebration-native.test.ts`

**Interfaces:**

```ts
export interface CompletionCelebrationApiDeps {
  call<T>(endpoint: Endpoint, body: unknown, options: MobileApiOptions): Promise<T>;
}

export async function claimCompletionCelebrationWith(
  promiseId: string,
  idempotencyKey: string,
  deps: CompletionCelebrationApiDeps,
): Promise<CompletionCelebrationClaimResponse>;

export async function acknowledgeCompletionCelebrationShownWith(
  promiseId: string,
  claimId: string,
  idempotencyKey: string,
  deps: CompletionCelebrationApiDeps,
): Promise<CompletionCelebrationShownResponse>;

export type CompletionClaimEnvelope =
  | { phase: 'PENDING'; claim_idempotency_key: string }
  | { phase: 'SHOWN'; claim_id: string; shown_idempotency_key: string };

export interface CompletionCelebrationClaimDeps {
  currentUserId(): Promise<string>;
  randomUuid(): string;
  storage: Pick<LargeSecureStore, 'getItem' | 'setItem' | 'removeItem'>;
  claimWith(promiseId: string, idempotencyKey: string):
    Promise<CompletionCelebrationClaimResponse>;
  acknowledgeShownWith(promiseId: string, claimId: string, idempotencyKey: string):
    Promise<CompletionCelebrationShownResponse>;
}

export async function claimCompletionCelebration(
  promiseId: string,
  deps: CompletionCelebrationClaimDeps,
): Promise<CompletionCelebrationView | null>;

export async function markCompletionCelebrationShown(
  promiseId: string,
  claimId: string,
  deps: CompletionCelebrationClaimDeps,
): Promise<void>;
```

- [ ] **Step 1: Write mobile API RED tests**

Assert the claim wrapper calls `ENDPOINT.completionCelebrationClaim` with `{ promise_id }`,
`idempotent: true`, and the exact caller key. Assert the shown wrapper calls
`ENDPOINT.completionCelebrationShown` with exact `{ promise_id, claim_id }` and its separate key.
Assert valid responses parse, while extra keys, invalid rates/instants, and inconsistent claim
unions throw fixed internal malformed-response errors.

- [ ] **Step 2: Write encrypted lifecycle RED tests**

Use an in-memory `LargeSecureStore`-compatible dependency and deterministic UUIDs. Assert:

```ts
test('stores PENDING before the network call');
test('reuses the same key after a rejected request and across a new repository instance');
test('available false removes the envelope and returns null');
test('available true returns the view and keeps PENDING until native onShow');
test('mark shown stores claim ID and a separate shown key before acknowledgement');
test('failed shown acknowledgement leaves SHOWN and restart retries it without redisplay');
test('shown success clears the envelope only after the server response');
test('wrong returned claim ID is never synthesized or replaced by the client');
test('different users and promises never share an envelope');
test('no title nickname rate or share text is persisted');
```

- [ ] **Step 3: Run RED**

Run:

```bash
npm run test --workspace=@littlefinger/mobile -- --runInBand src/lib/completion-celebration-api.test.ts src/lib/completion-celebration-claim.test.ts src/lib/completion-celebration-native.test.ts
```

Expected: FAIL because all three modules are absent.

- [ ] **Step 4: Implement the strict API wrapper**

Call each mobile function as `unknown`, parse with its shared strict parser, and throw the fixed
internal error on a malformed success. Do not generate idempotency keys in the API wrapper.

- [ ] **Step 5: Implement the PENDING/SHOWN repository and orchestrator**

Use storage key:

```ts
`lf.completion-celebration-claim.${userId}.${promiseId}`
```

Persist only the discriminated envelope. Before a claim, restore PENDING or create and save a new
claim UUID before calling the server. If the envelope is SHOWN, retry
`completion-celebration-shown` with its stored claim ID/key, clear only on success, and return null
without claiming or displaying. For `available: false`, remove PENDING and return null. For
`available: true`, return the view and retain PENDING. `markCompletionCelebrationShown` first
overwrites PENDING with `{ phase: 'SHOWN', claim_id, shown_idempotency_key }`, then acknowledges the
server, and removes the envelope only after success. An acknowledgement failure stays SHOWN so a
restart retries without redisplay.

- [ ] **Step 6: Bind native dependencies without top-level test side effects**

`completion-celebration-native.ts` binds `currentMobileUserId`, `Crypto.randomUUID`,
`getMobileEncryptedStorage`, `callMobileFunctionNative`, and the pure orchestrator. Follow the
existing dynamic native-module test pattern so Jest proves that importing pure modules does not
load Expo native globals. Bind one dependency object rather than duplicating orchestration:

```ts
const deps: CompletionCelebrationClaimDeps = {
  currentUserId: currentMobileUserId,
  randomUuid: () => Crypto.randomUUID(),
  storage: getMobileEncryptedStorage(),
  claimWith: async (promiseId, key) =>
    await claimCompletionCelebrationWith(promiseId, key, apiDeps),
  acknowledgeShownWith: async (promiseId, claimId, key) =>
    await acknowledgeCompletionCelebrationShownWith(promiseId, claimId, key, apiDeps),
};
```

- [ ] **Step 7: Run focused GREEN and storage regressions**

Run:

```bash
npm run test --workspace=@littlefinger/mobile -- --runInBand src/lib/completion-celebration-api.test.ts src/lib/completion-celebration-claim.test.ts src/lib/completion-celebration-native.test.ts src/lib/large-secure-store.test.ts src/lib/mobile-api.test.ts
npm run typecheck
```

- [ ] **Step 8: Run the commit gate and commit**

Run:

```bash
npm test
npm run check:agents
git diff --check
git add apps/mobile/src/lib/completion-celebration-api.ts apps/mobile/src/lib/completion-celebration-api.test.ts apps/mobile/src/lib/completion-celebration-claim.ts apps/mobile/src/lib/completion-celebration-claim.test.ts apps/mobile/src/lib/completion-celebration-native.ts apps/mobile/src/lib/completion-celebration-native.test.ts
git diff --cached --check
git commit -m "feat: add durable celebration claim lifecycle"
```

---

### Task 5: Build MOD-03 and Connect SCR-A06 to SCR-A05

**Files:**
- Create: `apps/mobile/src/screens/mod-03-completion-celebration-labels.ts`
- Create: `apps/mobile/src/components/completion-celebration-sheet.tsx`
- Create: `apps/mobile/src/screens/mod-03-completion-celebration.test.tsx`
- Modify: `apps/mobile/src/app/promise/[promise_id].tsx`
- Modify: `apps/mobile/src/screens/scr-a05-promise-detail.test.tsx`
- Modify: `apps/mobile/src/app/fulfillment/[promise_id].tsx`
- Modify: `apps/mobile/src/screens/scr-a06-fulfillment-check.test.tsx`

**Interfaces:**

```ts
export const MOD_03_LABEL = {
  title: '약속 지킴! 축하해요',
  complete: (title: string) => `${title} — 완주!`,
  highFive: (nickname: string | null) =>
    nickname === null ? '상대방과 하이파이브 하세요' : `${nickname}님과 하이파이브 하세요`,
  newPromise: '새 약속 만들기',
  share: '공유하기',
  close: '축하 닫기',
} as const;

export interface CompletionCelebrationSheetProps {
  visible: boolean;
  celebration: CompletionCelebrationView | null;
  onShown(): void;
  onClose(): void;
  onNewPromise(): void;
  onShare(): void;
}
```

- [ ] **Step 1: Write MOD-03 component RED tests**

Render the four approved rate pairs and assert the complete Korean label, promise completion line,
nickname and null fallback, `LfPinky`, filled new-promise action, text share action, modal
accessibility boundary, `축하 닫기`, `onShow`, scrim dismissal, Android `onRequestClose`, 48 dp button
contract, and absence of ad/test ad placeholders. Assert share does not close the component.

- [ ] **Step 2: Write SCR-A05 claim RED tests**

Mock the native claim functions and assert:

```ts
test('COMPLETED creator claims after detail renders and opens MOD-03');
test('COMPLETED partner claims but witness and every other status do not');
test('available false and claim failure keep SCR-A05 usable without an error banner');
test('one screen generation never starts duplicate claims after detail refresh');
test('native onShow acknowledges the returned claim ID exactly once');
test('shown acknowledgement failure does not close or break SCR-A05');
test('dismiss remains on the loaded detail and does not reclaim');
test('new promise dismisses and pushes /promise/edit');
test('share reuses SCR_A05_LABEL.shareMessage and keeps the sheet visible');
```

- [ ] **Step 3: Write SCR-A06 routing RED tests**

Return a literal `FulfillmentSubmitResponse` with status COMPLETED and assert evidence-draft cleanup
happens before:

```ts
expect(replace).toHaveBeenCalledWith({
  pathname: '/promise/[promise_id]',
  params: { promise_id: PROMISE_ID },
});
```

Assert CHECKING, BROKEN, and DISPUTED retain their current refresh/result behavior and do not open or
route to MOD-03.

- [ ] **Step 4: Run RED**

Run:

```bash
npm run test --workspace=@littlefinger/mobile -- --runInBand src/screens/mod-03-completion-celebration.test.tsx src/screens/scr-a05-promise-detail.test.tsx src/screens/scr-a06-fulfillment-check.test.tsx
```

Expected: new component tests fail because MOD-03 is absent; integration assertions fail because
SCR-A05 does not claim and SCR-A06 ignores the submit response.

- [ ] **Step 5: Implement the token-only celebration sheet**

Port the frozen centered sheet with existing `Modal`, `LfPinky size="xl" tone="onContainer"`,
`LfText`, `LfIcon name="trending-up"`, a filled `LfButton size="cta" block` for new promise, and a
`LfButton variant="text" block` for sharing. Use `colors.primaryContainer`, `colors.scrim`,
`elevation.sheet`, `gutter.app`, `radius['2xl']`, `radius.pill`, `size.touchMin`, and `space` tokens.
Do not add a raw color, size, radius, or new dependency. The scrim and Android back invoke `onClose`;
the native Modal `onShow` invokes `onShown`.

- [ ] **Step 6: Integrate claim lifecycle into SCR-A05**

After a successful detail load, start one claim only when status is COMPLETED and `my_role` is
CREATOR or PARTNER. Keep the detail phase independent from claim or acknowledgement failure. Store
the returned view in component state, render the sheet after the ScrollView, call
`markCompletionCelebrationShown(detail.promise_id, celebration.claim_id)` from `onShown`, and clear
only the in-memory view on dismiss. Guard `onShown` with a ref keyed by `claim_id` so repeated native
callbacks cannot create multiple acknowledgement attempts in one screen generation. Reuse:

```ts
Share.share({
  message: SCR_A05_LABEL.shareMessage(detail.title, PROMISE_STATUS_LABEL.COMPLETED),
});
```

Reset the attempt generation and celebration state only when `promiseId` changes.

- [ ] **Step 7: Route authoritative COMPLETED submissions**

Capture the result from `submitFulfillment`. Preserve draft cleanup and local form reset. If the
result status is COMPLETED, call `router.replace` with the typed SCR-A05 route and return before the
current refresh. Keep the existing refresh path for every other response.

- [ ] **Step 8: Run focused GREEN and mobile regressions**

Run:

```bash
npm run test --workspace=@littlefinger/mobile -- --runInBand src/screens/mod-03-completion-celebration.test.tsx src/screens/scr-a05-promise-detail.test.tsx src/screens/scr-a06-fulfillment-check.test.tsx src/lib/completion-celebration-claim.test.ts src/screens/root-layout.test.tsx
npm run typecheck
```

- [ ] **Step 9: Run the commit gate and commit**

Run:

```bash
npm test
npm run check:agents
git diff --check
git add apps/mobile/src/screens/mod-03-completion-celebration-labels.ts apps/mobile/src/components/completion-celebration-sheet.tsx apps/mobile/src/screens/mod-03-completion-celebration.test.tsx "apps/mobile/src/app/promise/[promise_id].tsx" apps/mobile/src/screens/scr-a05-promise-detail.test.tsx "apps/mobile/src/app/fulfillment/[promise_id].tsx" apps/mobile/src/screens/scr-a06-fulfillment-check.test.tsx
git diff --cached --check
git commit -m "feat: build completion celebration flow"
```

---

### Task 6: Run Full Gates, Compare MOD-03, and Record Status

**Files:**
- Modify: `docs/DEVELOPMENT_STATUS.md`
- Inspect only: `TODOS.md`
- Inspect only: `design-reference/screens/app/mod-03-completion-celebrate.html`
- Inspect only: `design-reference/styles/components.css`
- Inspect only: `design-reference/styles/screens/app-support.css`
- Create then delete before commit: `apps/mobile/src/app/mod-03-preview.tsx`

**Produces:** A reproducible local verification report and an honest deployment/UAT boundary.

- [ ] **Step 1: Run all automated repository gates**

Run from the repository root:

```bash
npm test
npm run typecheck
npm run build:web
npm run check:agents
git diff --check
```

Run from `apps/mobile`:

```bash
npx expo install --check
npx expo export --platform android --output-dir C:\tmp\littlefinger-mod03-20260817
```

Expected: Vitest, mobile Jest, all TypeScript projects, web build, agent sync, Expo dependency check,
Android bundle export, and diff checks PASS. Record exact file/test/module counts.

- [ ] **Step 2: Perform the 360 x 800 visual contract comparison**

Create this temporary Expo Router preview with `apply_patch`; never stage it:

```tsx
import type { CompletionCelebrationView } from '@littlefinger/shared';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { CompletionCelebrationSheet } from '../components/completion-celebration-sheet.tsx';
import { colors } from '../theme/tokens.ts';

const RATES = {
  changed: [87, 89],
  unchanged: [75, 75],
  started: [null, 100],
  pending: [null, null],
} as const;

export default function Mod03Preview(): React.JSX.Element {
  const params = useLocalSearchParams<{ state?: keyof typeof RATES }>();
  const [before, after] = RATES[params.state ?? 'changed'];
  const celebration: CompletionCelebrationView = {
    claim_id: '11111111-1111-4111-8111-111111111111',
    promise_id: '22222222-2222-4222-8222-222222222222',
    title: '매주 화·목 아침 러닝 같이 하기',
    counterpart_nickname: '민준',
    keep_rate_before: before,
    keep_rate_after: after,
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <CompletionCelebrationSheet
        visible
        celebration={celebration}
        onShown={() => undefined}
        onClose={() => undefined}
        onNewPromise={() => undefined}
        onShare={() => undefined}
      />
    </View>
  );
}
```

Start an installed development build and Metro, set a 1080 x 2400 emulator to 480 dpi, and open
each state through `littlefinger://mod-03-preview?state=<state>`. Capture with device-side
`screencap` followed by `adb pull` to avoid PowerShell binary redirection. Compare all four images
with the frozen HTML at 360 x 800. Verify centered `LfPinky`, primary-container bottom sheet,
handle, title, two-line result copy, rate pill, full-width filled CTA, text share action, scrim, no
horizontal overflow, no ad, and minimum 48 dp targets. Record accessible dismiss and the three
additional rate states as intentional differences.

Delete the temporary route with `apply_patch`, stop Metro/emulator processes, reset any `wm size` or
`wm density` override, and prove `git status --short` does not list the preview. If no development
build can reach the preview or the emulator repeats its System UI/startup ANR, preserve the failure
evidence, mark device pixels blocked, and do not deploy as a workaround.

- [ ] **Step 3: Update development status only after gates**

In `docs/DEVELOPMENT_STATUS.md`, replace MOD-03 as the next local product step with:

- locally implemented contracts, transactions, Edge shells, encrypted claim/shown lifecycle, and
  app sheet;
- exact automated verification evidence;
- remote migration/function deployment still pending;
- two-account creator/partner once-only UAT still pending;
- device pixel status, including any emulator block; and
- M4 as the next local product stage.

Do not add a completed MOD-03 row to `TODOS.md`; that file remains for actionable future work only.

- [ ] **Step 4: Run the documentation commit gate and commit**

Run:

```bash
npm test
npm run typecheck
npm run check:agents
git diff --check
git add docs/DEVELOPMENT_STATUS.md
git diff --cached --check
git commit -m "docs: record completion celebration status"
```

- [ ] **Step 5: Verify the final local boundary**

Run:

```bash
git status --short
git log --oneline -7
```

Expected: only the pre-existing untracked `.claude/settings.local.json` remains. Report remote
migration, Edge deployment, cross-account once-only behavior, and real-device pixels as incomplete
unless separately authorized and actually verified.

---

## Remote Gate After Separate Authorization

This is not part of the local execution. After explicit deployment approval:

1. read `supabase migration list` and `supabase functions list` to confirm project identity;
2. apply the committed migration without running `supabase config push`;
3. deploy `completion-celebration-claim` and `completion-celebration-shown` separately with
   `npx supabase functions deploy <slug> --use-api`;
4. verify `verify_jwt = true`, private table privileges, RPC grants, and no backfill rows;
5. use separate creator and partner accounts to prove independent once-only claims and server
   `shown_at` acknowledgement from native `onShow`; and
6. capture MOD-03 at 360 x 800 on an Android development build.

No remote-completion claim is valid until all six steps have evidence.
