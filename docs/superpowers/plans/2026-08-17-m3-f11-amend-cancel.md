# M3 F-11 Amend and Cancel Agreement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete symmetric ACTIVE-promise amend/cancel requests, counterparty decisions,
requester withdrawal, seven-day expiry, immutable version history, and the MOD-01/SCR-A05/SCR-W04
user flows.

**Architecture:** Keep the existing `promise-amend` endpoint exclusively for pre-acceptance T-05
suggestions. F-11 gets separate participant-authenticated endpoints backed by row-locking Postgres
transactions for T-07 through T-10. Proposed AMEND versions remain immutable inactive rows with a
null stored `version_no`; approval assigns the previous active version plus one, preserving both
declined proposals and contiguous active history. Mobile renders MOD-01 and version history as
SCR-A05-owned sheets because the specification assigns no separate SCR ID; web embeds the same
request/response contract in SCR-W04.

**Tech Stack:** TypeScript, Vitest, PGlite/Postgres SQL, Supabase Edge Functions, React Native +
Expo Router, React + Vite, pg_cron, durable notification outbox.

## Global Constraints

- Only joined CREATOR/PARTNER participants may mutate F-11; WITNESS and non-participants receive
  `E_NOT_FOUND`, and the promise existence is not disclosed.
- Only `ACTIVE -> AMEND_PENDING`, `AMEND_PENDING -> ACTIVE`, and
  `AMEND_PENDING -> CANCELED` are allowed. CHECKING and every terminal state fail closed.
- Every mutation requires a UUID `Idempotency-Key`; first successful response is replayed exactly.
- At most one PENDING `amend_requests` row exists per promise, enforced by the existing partial
  unique index and a locked promise row.
- AMEND validates every section 5-1 field after NFC normalization, requires at least one changed
  field, and validates `end_date` again at approval time against KST server time.
- CANCEL accepts no proposed content and requires a second confirmation before request/approval in
  the clients. Reason is optional and limited to 200 code points for both request types.
- Active content remains immutable. A proposed version is never edited after insertion and a
  rejected, withdrawn, or expired proposal remains inactive for audit history.
- `AMEND_AUTO_WITHDRAW_DAYS=7`; J-05 runs daily at 00:30 KST (`30 15 * * *` UTC), is advisory-lock
  serialized, and is idempotent across repeated runs.
- NT-15, NT-16, and NT-17 use the durable outbox. `AMEND_REMIND` fires at request +3 days 09:00 KST
  and reuses NT-15 for the still-pending counterparty.
- User-facing copy lives in label constants, touch targets are at least 48 dp, and none of MOD-01,
  SCR-A05, or SCR-W04 renders ads.
- `supabase config push` is forbidden. Remote migration/function deployment requires a separate
  explicit approval after local verification.

---

### Task 1: Shared F-11 contracts, validation, notification templates, and version diff

**Files:**
- Create: `packages/shared/src/promise-amend.ts`
- Create: `packages/shared/src/promise-amend.test.ts`
- Modify: `packages/shared/src/api.ts`
- Modify: `packages/shared/src/api.test.ts`
- Modify: `packages/shared/src/validation.ts`
- Modify: `packages/shared/src/validation.test.ts`
- Modify: `packages/shared/src/notification.ts`
- Modify: `packages/shared/src/notification.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces `PromiseAmendProposal`, `PromiseAmendCreateRequest`, `PromiseAmendCreateResponse`,
  `PromiseAmendDecision`, `PromiseAmendRespondRequest`, `PromiseAmendRespondResponse`,
  `PromiseAmendWithdrawRequest`, `PromiseAmendWithdrawResponse`, `PromiseVersionHistoryItem`,
  `PromiseVersionListRequest`, and `PromiseVersionListResponse`.
- Produces strict `asPromiseAmend*Response` and `asPromiseVersionListResponse` parsers.
- Produces `changedPromiseFields(before, after)` in the fixed title/body/category/end_date/keeper/
  reward/penalty order.
- Adds `ENDPOINT.promiseAmendRequest`, `promiseAmendRespond`, `promiseAmendWithdraw`, and
  `promiseVersionList`.

- [ ] **Step 1: Write focused RED contract tests**

```ts
expect(ENDPOINT.promiseAmendRequest).toBe('promise-amend-request');
expect(validateAmendReason('가'.repeat(201)).valid).toBe(false);
expect(changedPromiseFields(before, { ...before, end_date: '2026-09-01' }))
  .toEqual(['end_date']);
expect(renderNotificationTemplate('NT-15', {
  promiseTitle: '러닝', partnerNickname: '민준', amendType: 'AMEND',
}).title).toBe('민준님이 약속 변경을 요청했어요');
expect(renderNotificationTemplate('NT-16', {
  promiseTitle: '러닝', amendDecision: 'DECLINE',
}).title).toBe('요청이 거절됐어요');
```

- [ ] **Step 2: Run RED and confirm failures are missing F-11 symbols/events**

Run: `npx vitest run packages/shared/src/promise-amend.test.ts packages/shared/src/validation.test.ts packages/shared/src/notification.test.ts packages/shared/src/api.test.ts`

- [ ] **Step 3: Add the minimal strict contracts and parsers**

```ts
export interface PromiseAmendCreateRequest {
  promise_id: string;
  type: AmendType;
  proposed?: PromiseAmendProposal;
  reason?: string;
}

export interface PromiseAmendRespondRequest {
  promise_id: string;
  request_id: string;
  decision: 'APPROVE' | 'DECLINE';
}

export interface PromiseVersionHistoryItem {
  version: PromiseDetailVersion;
  change_requester: PromiseDetailActor | null;
  approved_by: PromiseDetailActor | null;
  approved_at: IsoDateTime | null;
  change_reason: string | null;
}
```

- [ ] **Step 4: Run focused GREEN and the existing shared notification/detail regressions**

Run: `npx vitest run packages/shared/src/promise-amend.test.ts packages/shared/src/validation.test.ts packages/shared/src/notification.test.ts packages/shared/src/promise-detail.test.ts packages/shared/src/api.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src
git commit -m "feat: define F-11 amend agreement contracts"
```

### Task 2: Transactional T-07 through T-10 and read-only version history

**Files:**
- Create via CLI: `npx supabase migration new f11_amend_agreement`
- Create: `supabase/tests/promise-amend-agreement.test.ts`
- Modify: `supabase/tests/schema.test.ts`
- Modify: `supabase/tests/promise-detail.test.ts`

**Interfaces:**
- Produces service-role-only `lf_promise_amend_request`, `lf_promise_amend_respond`,
  `lf_promise_amend_withdraw`, and authenticated `lf_promise_version_list`.
- Extends `lf_promise_detail` so both AMEND and CANCEL pending requests expose requester, reason,
  expiry, and the proposal only when applicable.

- [ ] **Step 1: Write PGlite RED tests before creating the migration**

Cover participant symmetry, witness/non-participant hiding, ACTIVE-only state, NFC/field validation,
no-op AMEND rejection, CANCEL proposal rejection, same-time request race, idempotent replay,
request/response race, stale request ID, approval end-date revalidation, decline, withdrawal,
CANCELED closure, schedule cancellation/recreation, immutable proposal retention, contiguous active
version numbers, and direct Data API denial.

```ts
const [left, right] = await Promise.allSettled([
  requestAmend(creator, promiseId, keyA),
  requestCancel(partner, promiseId, keyB),
]);
expect(left.status === 'fulfilled' || right.status === 'fulfilled').toBe(true);
expect(await pendingRequestCount(promiseId)).toBe(1);
```

- [ ] **Step 2: Run RED and confirm the new RPCs are absent**

Run: `npx vitest run supabase/tests/promise-amend-agreement.test.ts supabase/tests/schema.test.ts`

- [ ] **Step 3: Generate and implement the migration**

The migration must drop the current `(promise_id, version_no)` unique constraint, allow null
`version_no` only for inactive proposal rows, and replace it with a partial unique index for non-null
version numbers. Each mutation locks `promises` first, then the current `amend_requests` row, uses
`lf_idempotency_begin/finish` inside the same transaction, writes the correct `approvals` action,
and never mutates proposal content.

```sql
alter table public.promise_versions alter column version_no drop not null;
create unique index promise_versions_numbered_unique
  on public.promise_versions (promise_id, version_no)
  where version_no is not null;
```

- [ ] **Step 4: Run focused GREEN plus detail/RLS/hash/idempotency regressions**

Run: `npx vitest run supabase/tests/promise-amend-agreement.test.ts supabase/tests/promise-detail.test.ts supabase/tests/rls.test.ts supabase/tests/hash.test.ts supabase/tests/idempotency.test.ts supabase/tests/schema.test.ts`

- [ ] **Step 5: Commit the generated migration and tests**

```bash
git add supabase/migrations supabase/tests/promise-amend-agreement.test.ts supabase/tests/promise-detail.test.ts supabase/tests/schema.test.ts
git commit -m "feat: add F-11 amend agreement transactions"
```

### Task 3: NT-15 through NT-17, AMEND_REMIND, and J-05 expiry

**Files:**
- Create via CLI: `npx supabase migration new f11_amend_notifications`
- Create: `supabase/tests/amend-expiry.test.ts`
- Modify: `supabase/tests/notification-outbox.test.ts`
- Modify: `supabase/tests/reminder-dispatch.test.ts`
- Modify: `supabase/tests/schema.test.ts`

**Interfaces:**
- Produces `lf_expire_amend_requests(p_now, p_limit)` and
  `lf_schedule_amend_expiry()`.
- Extends the approval outbox producer for NT-15/NT-16 and due-reminder dispatch for
  `AMEND_REMIND -> NT-15`.

- [ ] **Step 1: Write RED notification and batch tests**

Test requester exclusion for NT-15, request-type template args, requester-only NT-16, both-party
NT-17, one AMEND_REMIND row for the responder, response/withdraw cancellation, exact 3-day 09:00 KST
fire time, expiry race fencing, two-run idempotency, advisory-lock serialization, one cron row, empty
`search_path`, and service-role-only execution.

- [ ] **Step 2: Run RED**

Run: `npx vitest run supabase/tests/amend-expiry.test.ts supabase/tests/notification-outbox.test.ts supabase/tests/reminder-dispatch.test.ts`

- [ ] **Step 3: Generate and implement the migration**

J-05 locks due requests in promise UUID order, marks both AMEND and CANCEL requests `EXPIRED`, returns
the promise to `ACTIVE`, preserves inactive proposals, cancels AMEND_REMIND, and enqueues NT-17 once
per participant. Re-registering `lf-amend-request-expiry` must remove any same-name job first.

- [ ] **Step 4: Run focused GREEN and push worker integration regression**

Run: `npx vitest run supabase/tests/amend-expiry.test.ts supabase/tests/notification-outbox.test.ts supabase/tests/reminder-dispatch.test.ts supabase/tests/push-send-integration.test.ts supabase/tests/schema.test.ts`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests
git commit -m "feat: schedule F-11 notifications and expiry"
```

### Task 4: F-11 Edge Functions and mobile/web API clients

**Files:**
- Create: `supabase/functions/promise-amend-request/handler.ts`
- Create: `supabase/functions/promise-amend-request/index.ts`
- Create: `supabase/functions/promise-amend-respond/handler.ts`
- Create: `supabase/functions/promise-amend-respond/index.ts`
- Create: `supabase/functions/promise-amend-withdraw/handler.ts`
- Create: `supabase/functions/promise-amend-withdraw/index.ts`
- Create: `supabase/functions/promise-version-list/handler.ts`
- Create: `supabase/functions/promise-version-list/index.ts`
- Create: `supabase/tests/edge-promise-amend-agreement.test.ts`
- Modify: `supabase/config.toml`
- Modify: `supabase/tests/edge-bundle.test.ts`
- Create: `apps/mobile/src/lib/promise-amend-api.ts`
- Create: `apps/mobile/src/lib/promise-amend-api.test.ts`
- Create: `apps/mobile/src/lib/promise-amend-native.ts`
- Create: `apps/web/src/lib/promise-amend-api.ts`
- Create: `apps/web/src/lib/promise-amend-api.test.ts`

**Interfaces:**
- Mutations verify JWT, JSON shape, UUID idempotency key, normalized proposal/reason, surface, and
  PII hashes before RPC. Version-list verifies JWT and returns strict participant-scoped history.
- Clients preserve one idempotency key per logical intent until authoritative refresh confirms it.

- [ ] **Step 1: Write Edge and client RED tests**

Assert bearer auth, exact request fields, wrong union shapes, missing/stale idempotency key, APP/WEB
surface, flattened unknown errors, strict response parsing, auth expiry, and no post-commit client
notification insertion.

- [ ] **Step 2: Run RED and confirm missing modules/functions**

Run: `npx vitest run supabase/tests/edge-promise-amend-agreement.test.ts apps/web/src/lib/promise-amend-api.test.ts`

Run: `npm test --workspace=@littlefinger/mobile -- src/lib/promise-amend-api.test.ts --runInBand`

- [ ] **Step 3: Implement pure handlers, thin Deno entries, config, and clients**

Each `index.ts` contains only `Deno.serve(createHandler(createDeps()))`. The read endpoint rejects an
`Idempotency-Key`; every mutation requires one. No request logs contain reason/content.

- [ ] **Step 4: Run focused GREEN, bundle graph, and typecheck**

Run: `npx vitest run supabase/tests/edge-promise-amend-agreement.test.ts supabase/tests/edge-bundle.test.ts apps/web/src/lib/promise-amend-api.test.ts`

Run: `npm test --workspace=@littlefinger/mobile -- src/lib/promise-amend-api.test.ts --runInBand`

Run: `npm run typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/shared supabase/functions supabase/config.toml supabase/tests apps/mobile/src/lib apps/web/src/lib
git commit -m "feat: add F-11 amend agreement endpoints"
```

### Task 5: Mobile MOD-01, SCR-A05 actions, comparison, and version history

**Files:**
- Create: `apps/mobile/src/components/promise-amend-sheet.tsx`
- Create: `apps/mobile/src/screens/mod-01-promise-amend.test.tsx`
- Modify: `apps/mobile/src/app/promise/[promise_id].tsx`
- Modify: `apps/mobile/src/screens/scr-a05-promise-detail.test.tsx`
- Modify: `apps/mobile/src/screens/scr-a05-labels.ts`
- Modify: `apps/mobile/src/screens/scr-a05-detail-state.ts`

**Interfaces:**
- MOD-01 receives the current `PromiseDetailResponse`, emits a validated
  `PromiseAmendCreateRequest`, and has no platform API dependency.
- SCR-A05 owns refresh/reconciliation and passes mutation functions into the sheet.

- [ ] **Step 1: Write mobile RED tests**

Cover ACTIVE-only entry, prefilled seven fields, AMEND/CANCEL segmented control, changed-field CTA,
reason limit, KST date validation, common notice, cancel two-stage confirmation, stable retry key,
requester withdraw, responder approve/decline, stale state refresh, approval date failure, changed
fields only, neutral before/after emphasis, pending CANCEL copy, version history metadata/full content,
48 dp actions, and no ads.

- [ ] **Step 2: Run RED**

Run: `npm test --workspace=@littlefinger/mobile -- src/screens/mod-01-promise-amend.test.tsx src/screens/scr-a05-promise-detail.test.tsx --runInBand`

- [ ] **Step 3: Implement the smallest token-only UI**

Reuse `LfField`, `LfInput`, `LfTextarea`, `LfChoice`, `LfPicker`, `LfButton`, and the Android
DateTimePicker pattern from SCR-A03. Render changed fields in the fixed shared diff order. Render
version history in an SCR-A05-owned modal/sheet opened from the record section.

- [ ] **Step 4: Run focused GREEN and all mobile tests**

Run: `npm test --workspace=@littlefinger/mobile -- src/screens/mod-01-promise-amend.test.tsx src/screens/scr-a05-promise-detail.test.tsx --runInBand`

Run: `npm test --workspace=@littlefinger/mobile`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat: connect mobile F-11 amend agreement"
```

### Task 6: Web SCR-W04 request and response flow

**Files:**
- Modify: `apps/web/src/screens/scr-w04-participant-promises.tsx`
- Modify: `apps/web/src/screens/scr-w04-participant-promises.test.tsx`
- Modify: `apps/web/src/styles/components.css`
- Modify: `apps/web/src/styles/screens/web.css`

**Interfaces:**
- Reuses Task 4 web API calls and `promise-detail` only for the AMEND_PENDING comparison payload.
- Keeps the current fulfillment draft/session behavior unchanged.

- [ ] **Step 1: Write web RED tests**

Cover CREATOR/PARTNER symmetric ACTIVE request, prefilled form, cancel confirmation, pending request
comparison, requester withdrawal, counterparty approve/decline, response-needed ordering, refresh
convergence, same-intent idempotency, expired approval error, signed-out Kakao return to `/promises`,
48 px actions, and no ads.

- [ ] **Step 2: Run RED**

Run: `npx vitest run apps/web/src/screens/scr-w04-participant-promises.test.tsx`

- [ ] **Step 3: Implement the inline SCR-W04 flow using existing frozen CSS classes**

Use `.lf-sheet`, `.lf-segmented`, `.lf-compare`, `.lf-diff-old`, and `.lf-diff-new`; add only the
minimum screen modifiers missing for responsive 360 px layout. Do not persist proposal content or
server responses in `sessionStorage`.

- [ ] **Step 4: Run focused GREEN and web build**

Run: `npx vitest run apps/web/src/screens/scr-w04-participant-promises.test.tsx apps/web/src/lib/promise-amend-api.test.ts`

Run: `npm run build:web`

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat: connect web F-11 amend agreement"
```

### Task 7: Final regression, visual comparison, and local completion record

**Files:**
- Modify: `docs/DEVELOPMENT_STATUS.md`
- Modify: `TODOS.md` only if a concrete deferred defect is found
- Create: `.superpowers/sdd/2026-08-17-m3-f11-amend-cancel/final-report.md` (gitignored)

- [ ] **Step 1: Run required automated gates**

```bash
npm test
npm run typecheck
npm run build:web
npm run check:agents
npx expo install --check
npx expo export --platform android --output-dir C:\tmp\littlefinger-f11-android-export
git diff --check
```

- [ ] **Step 2: Compare at 360x800**

Compare MOD-01, SCR-A05/AMEND_PENDING requester/responder/CANCEL variants, and SCR-W04 against the
frozen references. Record the full section 5-1 editor and version-history sheet as intentional spec
additions. Do not claim a pixel pass if an emulator or populated account is unavailable.

- [ ] **Step 3: Update status accurately**

Record local RED/GREEN counts, Android export module count, unverified two-account/device UAT, and
that new F-11 migrations/functions/cron remain undeployed until explicitly approved.

- [ ] **Step 4: Commit the status document**

```bash
git add docs/DEVELOPMENT_STATUS.md TODOS.md
git commit -m "docs: record local F-11 completion"
```

## Plan Self-Review

- Spec coverage: F-11 sections 4-11-1 through 4-11-4, fields 5-4, T-07 through T-10, J-05,
  AMEND_REMIND, NT-15 through NT-17, permissions, EC-E01 through EC-E05, and two-stage cancel
  confirmation each map to an explicit task.
- Placeholder scan: migration paths are intentionally produced by the mandatory Supabase CLI
  command; no implementation decision is deferred.
- Type consistency: all four endpoints consume the Task 1 types, both clients use the same response
  parsers, and the DB response fields match those types.
- Excluded: witness self-leave, MOD-03, operator alerts, F-01 final legal copy, remote deployment,
  two-account UAT, and origin push.
