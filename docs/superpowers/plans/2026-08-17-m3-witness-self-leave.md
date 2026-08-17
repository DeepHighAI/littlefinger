# M3 Witness Self-Leave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for every
> behavior change. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated joined witness permanently leave any promise while preserving
append-only signature history, revoking future reads, and reopening the witness slot.

**Architecture:** Add one strict shared contract, one service-role-only Postgres transaction, one
authenticated Edge Function, and one SCR-W05 action. The transaction changes only the existing
participant status from JOINED to WITHDRAWN. Every existing read boundary continues to require
JOINED status, so no duplicate authorization layer is added.

**Tech Stack:** TypeScript, Vitest, PGlite/Postgres SQL, Supabase Edge Functions, React + Vite,
React Router, Testing Library.

## Global Constraints

- The approved design is
  `docs/superpowers/specs/2026-08-17-m3-witness-self-leave-design.md`.
- A joined WITNESS may leave in every promise status. Promise status and fulfillment data never
  change.
- `approvals.WITNESS_SIGN` remains append-only and must survive leave.
- A withdrawn participant remains in `promise_participants`; hard deletion is forbidden.
- Future detail, promise, evidence, home-list, and participant-list reads require JOINED status and
  must reject the withdrawn witness.
- Previously issued evidence URLs keep only their existing ten-minute lifetime. New URLs are
  denied after leave.
- The preserved `(promise_id, user_id)` row makes the leave permanent. Rejoining with another
  witness invitation remains `E_DUPLICATE_ROLE`.
- The mutation requires a JWT and UUID `Idempotency-Key`. Same-key replay and a new-key retry after
  success both return `{ promise_id, status: 'WITHDRAWN' }`.
- No notification event, promise transition, trust-profile change, or email is added.
- Product strings live in `SCR_W05_LABEL`. Controls are at least 48 px, accessible, and ad-free.
- All new `SECURITY DEFINER` functions use `search_path = ''`, qualify relations, and revoke
  execution from `PUBLIC`, `anon`, and `authenticated`.
- Never run `supabase config push`; never modify or commit `.claude/settings.local.json`; do not
  push `origin` without a separate request.

---

## File Map

- `packages/shared/src/api.ts`: leave request/response contracts and endpoint slug.
- `packages/shared/src/witness.ts`: strict leave response parser.
- `packages/shared/src/witness.test.ts`: exact wire-boundary tests.
- `packages/shared/src/index.ts`: existing witness exports remain the public shared entry.
- `supabase/migrations/20260817000003_witness_self_leave.sql`: leave transaction and grants.
- `supabase/tests/witness-flow.test.ts`: state, history, authorization, idempotency, and concurrency.
- `supabase/tests/schema.test.ts`: RPC and permission contract.
- `supabase/tests/rls.test.ts`: post-leave direct-read regression.
- `supabase/functions/witness-leave/handler.ts`: pure authenticated request shell.
- `supabase/functions/witness-leave/index.ts`: thin Deno entrypoint.
- `supabase/functions/_shared/witness.ts`: reuses exact promise-ID request validation.
- `supabase/tests/edge-witness.test.ts`: method, auth, idempotency, RPC, parser, and logging tests.
- `supabase/tests/edge-bundle.test.ts`: new function import graph.
- `supabase/config.toml`: explicit `verify_jwt = true` entry.
- `apps/web/src/lib/witness-api.ts`: authenticated leave call.
- `apps/web/src/lib/witness-api.test.ts`: request and malformed-response tests.
- `apps/web/src/screens/scr-w05-labels.ts`: confirmation and completion copy.
- `apps/web/src/screens/scr-w05-witness-confirm.tsx`: leave confirmation and completion state.
- `apps/web/src/screens/scr-w05-witness-confirm.test.tsx`: signed/unsigned/cancel/retry/race behavior.
- `apps/web/src/styles/screens/web.css`: minimum token-based confirmation overlay styles.
- `docs/DEVELOPMENT_STATUS.md`: local completion and remaining MOD-03 work.
- `TODOS.md`: remove the completed witness self-leave follow-up and retain unrelated items.

---

### Task 1: Define Strict Witness Leave Contracts

**Files:**
- Modify: `packages/shared/src/api.ts`
- Modify: `packages/shared/src/witness.ts`
- Modify: `packages/shared/src/witness.test.ts`
- Modify: `packages/shared/src/api.test.ts`

**Interfaces:**

```ts
export interface WitnessLeaveRequest {
  promise_id: string;
}

export interface WitnessLeaveResponse {
  promise_id: string;
  status: 'WITHDRAWN';
}

export function asWitnessLeaveResponse(value: unknown): WitnessLeaveResponse | null;
```

- [ ] **Step 1: Write RED contract tests**

Add literal fixtures that prove the parser accepts only a valid UUID plus `WITHDRAWN`, rejects
unknown keys, rejects a non-UUID ID, rejects JOINED, and rejects missing fields. Assert
`ENDPOINT.witnessLeave === 'witness-leave'` through the shared API contract test.

- [ ] **Step 2: Run RED and confirm the missing-symbol failure**

Run:

```bash
npx vitest run packages/shared/src/witness.test.ts packages/shared/src/api.test.ts
```

Expected: FAIL because `WitnessLeaveResponse`, `asWitnessLeaveResponse`, and the endpoint slug do
not exist.

- [ ] **Step 3: Implement the minimum strict contract**

Add the two interfaces next to the existing witness sign contract. Extend the witness parser using
the existing exact-record and UUID helpers. Add `witnessLeave: 'witness-leave'` without changing any
existing endpoint value.

- [ ] **Step 4: Run focused GREEN and shared regressions**

Run:

```bash
npx vitest run packages/shared/src/witness.test.ts packages/shared/src/api.test.ts packages/shared/src/promise-detail.test.ts packages/shared/src/promise-home.test.ts
npm run typecheck
```

- [ ] **Step 5: Run the commit gate and commit**

Run: `npm test`, `npm run check:agents`, and `git diff --check`.

Commit:

```bash
git add packages/shared/src/api.ts packages/shared/src/api.test.ts packages/shared/src/witness.ts packages/shared/src/witness.test.ts
git commit -m "feat: define witness self-leave contracts"
```

---

### Task 2: Add the Permanent Leave Transaction

**Files:**
- Create: `supabase/migrations/20260817000003_witness_self_leave.sql`
- Modify: `supabase/tests/witness-flow.test.ts`
- Modify: `supabase/tests/schema.test.ts`
- Modify: `supabase/tests/rls.test.ts`

**Interface:**

```sql
public.lf_witness_leave(
  p_idempotency_key uuid,
  p_actor uuid,
  p_promise_id uuid
) returns jsonb
```

- [ ] **Step 1: Write PGlite RED tests before the migration**

Add behavior tests whose names identify these breaks:

```ts
test.each(PROMISE_STATUSES)('joined witness can leave %s without changing promise state');
test('leave preserves an existing WITNESS_SIGN approval byte-for-byte');
test('leave revokes witness detail and a new evidence signed URL target');
test('leave excludes the witness from occupied slots and account lists');
test('same-key replay and a different-key retry return the same withdrawn state');
test('creator partner outsider and inactive user cannot leave as the witness');
test('withdrawn account cannot redeem another witness invitation for the same promise');
test('parallel sign and leave serialize to one allowed outcome without deleting a signature');
test('direct Data API roles cannot execute the leave RPC or update participant status');
```

Use literal expected status and row counts. For the race, accept only the two approved serial
orders and then assert the durable rows, rather than asserting which Promise wins scheduling.

- [ ] **Step 2: Run RED and confirm the absent RPC**

Run:

```bash
npx vitest run supabase/tests/witness-flow.test.ts supabase/tests/schema.test.ts supabase/tests/rls.test.ts
```

Expected: the new tests fail because `lf_witness_leave` does not exist.

- [ ] **Step 3: Implement the forward migration**

Implement `lf_witness_leave` with this order:

```sql
perform public.lf_assert_actor(p_actor);
v_cached := public.lf_idempotency_begin(p_idempotency_key, p_actor, 'witness-leave');
select * from public.promises where id = p_promise_id for update;
select * from public.promise_participants
 where promise_id = p_promise_id
   and user_id = p_actor
   and role = 'WITNESS'
   and status in ('JOINED', 'WITHDRAWN')
 for update;
update public.promise_participants
   set status = 'WITHDRAWN'
 where id = v_participant.id and status = 'JOINED';
```

Return only `promise_id` and `status`. Preserve every other participant column. Do not add a state
guard or outbox intent. Revoke all execution from Data API roles and grant only `service_role`.

- [ ] **Step 4: Run focused GREEN and authorization regressions**

Run:

```bash
npx vitest run supabase/tests/witness-flow.test.ts supabase/tests/schema.test.ts supabase/tests/rls.test.ts supabase/tests/evidence-lifecycle.test.ts supabase/tests/promise-detail.test.ts supabase/tests/promise-home-list.test.ts supabase/tests/idempotency.test.ts
npm run typecheck
```

- [ ] **Step 5: Run the commit gate and commit**

Run: `npm test`, `npm run check:agents`, and `git diff --check`.

Commit:

```bash
git add supabase/migrations/20260817000003_witness_self_leave.sql supabase/tests/witness-flow.test.ts supabase/tests/schema.test.ts supabase/tests/rls.test.ts
git commit -m "feat: add witness self-leave transaction"
```

---

### Task 3: Add the Authenticated Edge Function

**Files:**
- Create: `supabase/functions/witness-leave/handler.ts`
- Create: `supabase/functions/witness-leave/index.ts`
- Modify: `supabase/tests/edge-witness.test.ts`
- Modify: `supabase/tests/edge-bundle.test.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes `witnessPromiseIdOf`, `idempotencyKeyOf`, `Deps.rpc`, and
  `asWitnessLeaveResponse`.
- Calls `lf_witness_leave` with `p_idempotency_key`, `p_actor`, and `p_promise_id`.

- [ ] **Step 1: Write Edge RED tests**

Cover OPTIONS, non-POST, missing/invalid JWT, missing/invalid idempotency key, missing/extra/invalid
`promise_id`, exact RPC arguments, same handler instance reuse, strict malformed success rejection,
known `E_NOT_FOUND`, unknown-failure flattening, and logs that contain no request payload or IDs.
Add the entrypoint to the real bundle-graph test.

- [ ] **Step 2: Run RED**

Run:

```bash
npx vitest run supabase/tests/edge-witness.test.ts supabase/tests/edge-bundle.test.ts
```

Expected: FAIL because the handler and entrypoint do not exist.

- [ ] **Step 3: Implement the pure handler and thin entrypoint**

Follow the existing `witness-sign` shape but omit surface and PII hashing because leaving writes no
approval audit row. Add:

```toml
[functions.witness-leave]
verify_jwt = true
```

- [ ] **Step 4: Run focused GREEN and all witness handlers**

Run:

```bash
npx vitest run supabase/tests/edge-witness.test.ts supabase/tests/edge-bundle.test.ts supabase/tests/edge-shared.test.ts
npm run typecheck
```

- [ ] **Step 5: Run the commit gate and commit**

Run: `npm test`, `npm run check:agents`, and `git diff --check`.

Commit:

```bash
git add supabase/functions/witness-leave supabase/tests/edge-witness.test.ts supabase/tests/edge-bundle.test.ts supabase/config.toml
git commit -m "feat: add witness self-leave endpoint"
```

---

### Task 4: Connect SCR-W05 Self-Leave UX

**Files:**
- Modify: `apps/web/src/lib/witness-api.ts`
- Modify: `apps/web/src/lib/witness-api.test.ts`
- Modify: `apps/web/src/screens/scr-w05-labels.ts`
- Modify: `apps/web/src/screens/scr-w05-witness-confirm.tsx`
- Modify: `apps/web/src/screens/scr-w05-witness-confirm.test.tsx`
- Modify: `apps/web/src/styles/screens/web.css`

**Interfaces:**

```ts
export function leaveWitness(
  accessToken: string,
  promiseId: string,
  idempotencyKey?: string,
): Promise<WitnessLeaveResponse>;
```

The screen extends its phase union with `{ kind: 'LEFT' }` and keeps confirmation visibility and
leave pending state separate from loaded detail.

- [ ] **Step 1: Write web API RED tests**

Assert the real wrapper sends POST to `witness-leave`, sends only `{ promise_id }`, includes bearer
and idempotency headers, parses a strict success, and maps network/auth/malformed responses through
`WitnessApiError`.

- [ ] **Step 2: Write SCR-W05 RED behavior tests**

Cover:

- LIMITED and FULL views expose `증인 나가기` with a 48 px target;
- unsigned confirmation uses the access-loss copy;
- signed confirmation uses the exact EC-D03 signature-preservation copy;
- `계속 보기` closes the dialog without a request;
- confirm is same-frame single-flight and uses one idempotency key;
- a failure keeps the loaded detail and allows retry with the same key;
- success removes all promise content and evidence, displays `증인에서 나왔습니다.`, and exposes
  `내 약속 보기` to `/promises`;
- no sign request can be started while leave is pending; and
- no ad element or reserved ad space appears.

- [ ] **Step 3: Run RED and confirm missing API/action/state**

Run:

```bash
npx vitest run apps/web/src/lib/witness-api.test.ts apps/web/src/screens/scr-w05-witness-confirm.test.tsx
```

- [ ] **Step 4: Implement the minimum web flow**

Add labels only in `SCR_W05_LABEL`. Use a `useRef` single-flight fence and one UUID key retained
until success. On success set the phase directly to LEFT so the old detail and signed URL tiles
unmount immediately. Use an accessible `role="dialog"`, focusable buttons, and existing token
variables; add no design literals outside the stylesheet token system.

- [ ] **Step 5: Run focused GREEN and route/auth regressions**

Run:

```bash
npx vitest run apps/web/src/lib/witness-api.test.ts apps/web/src/screens/scr-w05-witness-confirm.test.tsx apps/web/src/App.test.tsx apps/web/src/screens/scr-w04-participant-promises.test.tsx
npm run typecheck
npm run build:web
```

- [ ] **Step 6: Run the commit gate and commit**

Run: `npm test`, `npm run check:agents`, and `git diff --check`.

Commit:

```bash
git add apps/web/src/lib/witness-api.ts apps/web/src/lib/witness-api.test.ts apps/web/src/screens/scr-w05-labels.ts apps/web/src/screens/scr-w05-witness-confirm.tsx apps/web/src/screens/scr-w05-witness-confirm.test.tsx apps/web/src/styles/screens/web.css
git commit -m "feat: build web witness self-leave flow"
```

---

### Task 5: Final Regression, Visual Verification, and Status

**Files:**
- Modify: `docs/DEVELOPMENT_STATUS.md`
- Modify: `TODOS.md`
- Create ignored report:
  `.superpowers/sdd/2026-08-17-m3-witness-self-leave/final-report.md`

- [ ] **Step 1: Run the complete focused witness and access suite**

```bash
npx vitest run packages/shared/src/witness.test.ts supabase/tests/witness-flow.test.ts supabase/tests/edge-witness.test.ts supabase/tests/rls.test.ts supabase/tests/evidence-lifecycle.test.ts supabase/tests/promise-detail.test.ts supabase/tests/promise-home-list.test.ts apps/web/src/lib/witness-api.test.ts apps/web/src/screens/scr-w05-witness-confirm.test.tsx
```

- [ ] **Step 2: Run all mandatory repository gates**

```bash
npm test
npm run typecheck
npm run build:web
npm run check:agents
cd apps/mobile && npx expo install --check
cd apps/mobile && npx expo export --platform android --output-dir C:\tmp\littlefinger-witness-leave-20260817
git diff --check
```

- [ ] **Step 3: Perform 360 x 800 web visual verification**

Run the Vite preview on an unused port, render signed and unsigned SCR-W05 fixtures at 360 x 800,
and compare confirmation and LEFT states against the frozen SCR-W05 surface. Record the new leave
action and confirmation dialog as intentional additions. If fixture authentication or browser
automation blocks the populated state, record the blocker and do not claim a pixel pass.

- [ ] **Step 4: Self-review security and mutation coverage**

Verify that realistic mutations fail tests: deleting the participant, deleting the signature,
allowing a non-witness, changing promise status, keeping detail after success, using a new key on
retry, or permitting a new evidence URL after leave.

- [ ] **Step 5: Update status and report**

Record local completion, the absence of remote deployment/UAT, and MOD-03 as the next product
implementation. Remove only the completed witness self-leave row from `TODOS.md`.

- [ ] **Step 6: Commit documentation**

```bash
git add docs/DEVELOPMENT_STATUS.md TODOS.md
git commit -m "docs: record witness self-leave completion"
```

## Completion Boundary

Local completion requires all focused and full automated gates plus a documented visual result.
Remote migration application, `witness-leave --use-api` deployment, function configuration checks,
cross-account UAT, `supabase config push`, and `origin` push are not part of this plan.
