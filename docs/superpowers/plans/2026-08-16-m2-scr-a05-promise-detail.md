# M2 SCR-A05 Promise Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the participant-only promise detail API and the nine approved SCR-A05 visual variants, covering every non-DRAFT promise status without implementing the separate F-11 mutation flows.

**Architecture:** A dedicated `promise-detail` read endpoint returns one strict, server-owned snapshot containing content, participants, confirmation, invitation, amendment, and fulfillment records. The mobile route `/promise/[promise_id]` renders shared sections plus status-specific variants; ten non-DRAFT database statuses map to nine visual variants because DECLINED and CANCELED share the approved terminal layout family. Existing mutation routes remain the only action owners: PENDING opens SCR-A04, CHECKING opens SCR-A06, DISPUTED uses `fulfillment-reopen`, and COMPLETED can share or start a new promise.

**Tech Stack:** PostgreSQL/PGlite, Supabase Edge Functions, shared TypeScript strict parsers, Expo SDK 57, Expo Router, React Native Testing Library, Vitest, jest-expo.

## Global Constraints

- Work directly on the explicitly approved `main` branch with strict RED -> expected failure -> minimal GREEN -> regression -> refactor cycles.
- SCR-A05 never renders an advertisement or reserved advertisement space.
- Nonparticipants receive `E_NOT_FOUND`; response payloads never expose IP/UA hashes, invitation token hashes, storage keys, or signed URLs.
- DRAFT stays on SCR-A03 and is rejected by the detail endpoint; all other statuses are read through `promise-detail`.
- Before a party submits in CHECKING, the other party's answer, comment, and evidence metadata remain hidden; joined witnesses see only submission facts until the round closes.
- DISPUTED always renders creator and partner claims with identical structure, ordering weight, typography, and colour emphasis.
- `LEGAL_DISCLAIMER` is rendered verbatim by `LfDisclaimer` and only in the ACTIVE confirmation area for this feature.
- All visible Korean strings live in label constants; screen styles use mobile tokens only; touch targets are at least 48dp.
- F-11 request/respond/withdraw mutations, witness invitation/signing, version-history navigation, MOD-03, J-09 scheduling, and SCR-W04 changes remain separate roadmap work. AMEND_PENDING is read-only here.
- Do not modify `design-reference`, run `supabase config push`, deploy remotely while Management API returns 403, push `origin`, or commit `.claude/settings.local.json`.

---

### Task 1: Promise detail contract and strict boundary

**Files:**
- Modify: `packages/shared/src/api.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `packages/shared/src/promise-detail.ts`
- Create: `packages/shared/src/promise-detail.test.ts`

**Interfaces:**
- Consumes: `PromiseStatus`, `ParticipantRole`, `ParticipantStatus`, `FulfillmentCheckView`, `FulfillmentRoundView`.
- Produces: `PromiseDetailRequest`, `PromiseDetailResponse`, `PromiseDetailPerson`, `PromiseDetailApproval`, `PromiseDetailVersion`, `PromiseDetailInvitation`, `PromiseDetailAmendRequest`, `PromiseDetailFulfillment`, `PromiseDetailIntegrity`, `asPromiseDetailResponse`, and `ENDPOINT.promiseDetail = 'promise-detail'`.

- [ ] Write RED contract tests that accept a hand-written complete snapshot and reject DRAFT, extra keys, malformed UUID/date/instant/HTTPS values, impossible status-specific objects, leaked storage/token/hash fields, and invalid evidence/check structures.

```ts
expect(asPromiseDetailResponse(validActive)).toEqual(validActive);
expect(asPromiseDetailResponse({ ...validActive, storage_key: 'private/full.jpg' })).toBeNull();
expect(asPromiseDetailResponse({ ...validActive, status: 'DRAFT' })).toBeNull();
```

- [ ] Run `npx vitest run packages/shared/src/promise-detail.test.ts` and confirm failures are caused by the missing contract/parser.
- [ ] Add the exact response shape: base content/timestamps, `my_role`, creator/partner/witnesses, approvals, current version/fingerprint, invitation, amendment, fulfillment, and `VERIFIED | FAILED | UNVERIFIED` integrity.
- [ ] Implement exact-key recursive parsing; require `invitation` only for PENDING, require a PENDING `amend_request` for AMEND_PENDING while permitting an APPROVED CANCEL record for CANCELED, require fulfillment for CHECKING/COMPLETED/BROKEN/DISPUTED/UNRESOLVED, and require confirmed statuses to report VERIFIED or FAILED integrity.
- [ ] Re-run focused tests and `npm run typecheck` until green.
- [ ] Commit `feat: define promise detail contract`.

### Task 2: Participant-only promise detail RPC

**Files:**
- Create: `supabase/migrations/20260816000002_promise_detail.sql`
- Create: `supabase/tests/promise-detail.test.ts`
- Modify: `supabase/tests/schema.test.ts`

**Interfaces:**
- Consumes: `lf_content_hash`, `lf_fulfillment_evidence_views`, current schema tables.
- Produces: service-role-only `public.lf_promise_detail(p_actor uuid, p_promise_id uuid) returns jsonb`.

- [ ] Write RED PGlite tests for creator, partner, joined witness, declined partner, outsider, hidden promise, and DRAFT access.
- [ ] Add RED status fixtures proving PENDING invitation countdown data; ACTIVE confirmation/approvals/fingerprint/integrity; AMEND_PENDING before/after versions; CHECKING strategic-answer privacy; five fulfillment terminal results; DECLINED reason; and CANCELED reason.
- [ ] Add RED security tests proving no private table key/token/hash leaves the payload and authenticated/anon cannot execute the RPC directly.

```ts
const outsider = await detail(outsiderId, promiseId);
await expect(outsider).rejects.toThrow('E_NOT_FOUND');
expect(JSON.stringify(active)).not.toMatch(/token_hash|ip_hash|storage_key/u);
```

- [ ] Run `npx vitest run supabase/tests/promise-detail.test.ts` and confirm the missing RPC is the RED cause.
- [ ] Implement one stable SECURITY DEFINER snapshot with an empty explicit `search_path`, actor membership before all content reads, and deterministic `acted_at/id`, `role/id`, `version_no`, `round_no` ordering.
- [ ] Recompute the current activated version hash at read time. Return FAILED on mismatch, VERIFIED on equality, and UNVERIFIED for PENDING/DECLINED where no confirmed record exists.
- [ ] Preserve CHECKING privacy: parties see their own check and the counterpart only after submitting; witnesses see current submission booleans but no current answers until terminal.
- [ ] Revoke public/anon/authenticated execution and grant only service_role.
- [ ] Re-run focused PGlite/schema tests and `npm run typecheck` until green.
- [ ] Commit `feat: add participant promise detail rpc`.

### Task 3: Edge Function and mobile API

**Files:**
- Create: `supabase/functions/_shared/promise-detail.ts`
- Create: `supabase/functions/promise-detail/handler.ts`
- Create: `supabase/functions/promise-detail/index.ts`
- Modify: `supabase/config.toml`
- Create: `supabase/tests/edge-promise-detail.test.ts`
- Modify: `supabase/tests/edge-bundle.test.ts`
- Create: `apps/mobile/src/lib/promise-detail-api.ts`
- Create: `apps/mobile/src/lib/promise-detail-api.test.ts`
- Create: `apps/mobile/src/lib/promise-detail-native.ts`

**Interfaces:**
- Consumes: `PromiseDetailRequest`, `PromiseDetailResponse`, `asPromiseDetailResponse`, `callMobileFunctionNative`.
- Produces: `createPromiseDetailHandler(deps)`, `loadPromiseDetail(promiseId, deps)`, and native `loadPromiseDetail(promiseId)`.

- [ ] Write RED Edge tests for OPTIONS, POST-only, JWT-before-body, exact UUID-only request, RPC arguments, E_NOT_FOUND flattening, malformed public response -> E_INTERNAL, safe logs, and Deno-free handler import.
- [ ] Write RED mobile tests proving the wrapper calls only `ENDPOINT.promiseDetail`, uses no idempotency key, and rejects malformed server snapshots.

```ts
expect(spy.rpcCalls).toEqual([{ fn: 'lf_promise_detail', args: { p_actor: ACTOR_ID, p_promise_id: PROMISE_ID } }]);
expect(call).toHaveBeenCalledWith(ENDPOINT.promiseDetail, { promise_id: PROMISE_ID }, { idempotent: false });
```

- [ ] Run the two focused suites and confirm the missing modules are the RED cause.
- [ ] Implement strict request parsing, JWT -> body -> RPC -> strict public response ordering, thin `index.ts`, `verify_jwt = true`, and the mobile boundary.
- [ ] Re-run Edge/mobile focused tests, bundle graph, and `npm run typecheck` until green.
- [ ] Commit `feat: add promise detail edge function`.

### Task 4: Shared SCR-A05 presentation primitives

**Files:**
- Create: `apps/mobile/src/components/LfDisclaimer.tsx`
- Modify: `apps/mobile/src/components/components.test.tsx`
- Create: `apps/mobile/src/screens/scr-a05-labels.ts`
- Create: `apps/mobile/src/screens/scr-a05-detail-state.ts`
- Create: `apps/mobile/src/screens/scr-a05-detail-state.test.ts`

**Interfaces:**
- Consumes: detail response and domain label maps.
- Produces: immutable disclaimer component, KST detail formatters, nine-variant selector, status metadata, response visibility labels, and evidence placeholder labels.

- [ ] Write RED component tests proving `LfDisclaimer` accepts no text override and renders the immutable constant.
- [ ] Write table-driven RED tests mapping PENDING, ACTIVE, AMEND_PENDING, CHECKING, COMPLETED, BROKEN, DISPUTED, UNRESOLVED, and DECLINED/CANCELED to nine visual variants and literal Korean labels.
- [ ] Add RED tests for KST dates/times, fingerprint text, D-Day, response facts, EXPIRED/BLINDED evidence placeholders, and symmetric DISPUTED claim descriptors.
- [ ] Run focused Jest and confirm missing primitives are the RED cause.
- [ ] Implement token-only presentation helpers and label constants without reading the device timezone.
- [ ] Re-run focused tests and mobile typecheck until green.
- [ ] Commit `feat: add SCR-A05 detail presentation contract`.

### Task 5: SCR-A05 route and nine status variants

**Files:**
- Create: `apps/mobile/src/app/promise/[promise_id].tsx`
- Create: `apps/mobile/src/screens/scr-a05-promise-detail.test.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx`

**Interfaces:**
- Consumes: native detail loader, existing evidence signing, fulfillment reopen, Router, React Native Share, Task 4 labels/helpers.
- Produces: authenticated `/promise/[promise_id]` SCR-A05 screen.

- [ ] Write RED route tests for malformed/missing UUID, loading, safe retry, back, no advertisement, and every status heading/label.
- [ ] Add RED common-section tests for full content, category/keeper, reward/penalty, people/witnesses, approval timestamps, fingerprint, integrity failure badge, and ACTIVE-only disclaimer.
- [ ] Add RED variant tests: PENDING invitation status; ACTIVE confirmation; AMEND_PENDING equal-weight before/after comparison; CHECKING submission facts; COMPLETED reward/evidence; BROKEN recorded penalty; DISPUTED symmetric claims/reopen; UNRESOLVED response facts; DECLINED/CANCELED neutral reasons.
- [ ] Add RED action tests for PENDING -> SCR-A04, CHECKING -> SCR-A06, DISPUTED idempotent reopen -> SCR-A06, COMPLETED title-only Share and new promise, signed evidence URL requests, and absent F-11/witness/version-history mutation controls.
- [ ] Run `npx jest --runInBand src/screens/scr-a05-promise-detail.test.tsx` and confirm feature-missing failures.
- [ ] Implement one SafeArea/ScrollView screen with shared token-only sections and nine variant renderers. Render AVAILABLE evidence only after a fresh 10-minute URL; never persist it.
- [ ] Re-run focused SCR-A05/component/API tests and mobile typecheck until green.
- [ ] Commit `feat: build SCR-A05 promise detail variants`.

### Task 6: Home and notification navigation integration

**Files:**
- Modify: `apps/mobile/src/app/home.tsx`
- Modify: `apps/mobile/src/screens/scr-a02-home.test.tsx`
- Modify: `apps/mobile/src/lib/push-navigation.ts`
- Modify: `apps/mobile/src/lib/push-navigation.test.ts`
- Modify: `apps/mobile/src/screens/root-layout.test.tsx`

**Interfaces:**
- Consumes: `/promise/[promise_id]` route.
- Produces: all non-DRAFT home cards and SCR-A05 push/inbox events navigate to the detail route.

- [ ] Write RED tests proving DRAFT remains SCR-A03 while PENDING/ACTIVE/AMEND_PENDING/CHECKING/all terminal cards open SCR-A05; SCR-A05 push destinations carry the validated promise UUID.
- [ ] Run focused home/push/root tests and confirm existing PENDING/A04, CHECKING/A06, read-only, and SCR-A05/home fallbacks produce the expected RED failures.
- [ ] Replace those temporary F-10 fallbacks with `/promise/[promise_id]`; keep SCR-A06 notification events mapped to fulfillment.
- [ ] Re-run focused navigation/home tests and mobile typecheck until green.
- [ ] Commit `feat: connect promise detail navigation`.

### Task 7: Verification and local status

**Files:**
- Modify: `docs/DEVELOPMENT_STATUS.md`
- Create or update ignored report: `.superpowers/sdd/2026-08-16-m2-scr-a05-promise-detail/task-7-report.md`

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces: accurate local completion and explicit deployment/UAT limitations.

- [ ] Run focused shared/PGlite/Edge/mobile suites and record exact counts.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build:web`, `npm run check:agents`, `npx expo install --check`, Android production export to a verified task-specific temporary directory, and `git diff --check`.
- [ ] Compare all nine variants at 360x800 with frozen SCR-A05 references. Record F-11/witness/version-history controls as intentionally absent; do not claim populated pixel pass if the remote function or emulator is blocked.
- [ ] Attempt only read-only `supabase migration list`. On 403, stop without function listing, migration application, deploy, secret mutation, or `supabase config push`.
- [ ] Update development status with local SCR-A05 completion, F-11 and live UAT remaining, exact verification evidence, and the next roadmap item.
- [ ] Commit `docs: update SCR-A05 development status` only after every local gate is green.

## Self-Review

- Spec coverage: all approved SCR-A05 variants are mapped; CANCELED shares the DECLINED terminal family; confirmation, approvals, integrity, content, participants, fulfillment evidence/results, and strategic-response privacy have owning tasks.
- Scope boundary: every unavailable mutation control is absent rather than disabled or fake. Existing PENDING/CHECKING/DISPUTED/COMPLETED actions are the only interactive paths.
- Type consistency: the RPC, Edge handler, mobile wrapper, and screen all consume the same `PromiseDetailResponse`; route name is `/promise/[promise_id]` everywhere.
- Security: actor membership precedes reads; DRAFT and outsiders are not disclosed; private storage/token/audit fields cannot pass the strict parser.
- Placeholder scan: no task contains an unspecified implementation branch or an undefined later interface.
