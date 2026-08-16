# M3 F-05 Witness Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete witness invitation, authenticated read-only viewing, one-time confirmation signing, account-based revisit, and SCR-W05 evidence viewing without implementing witness withdrawal.

**Architecture:** Keep the existing public `invite-resolve` and Kakao authentication entry, but add dedicated witness RPCs and pure Edge handlers because a witness never participates in partner approval state transitions. A nullable invitation relation binds each WITNESS participant slot to one invitation chain, and account-based `/witness/:promise_id` replaces the token route after redemption.

**Tech Stack:** TypeScript strict mode, Vitest, PGlite 0.5.4, Supabase Postgres/Edge Functions, React Native + Expo SDK 57/Jest, Vite + React + React Router, existing private evidence Storage and ten-minute signed URLs.

## Global Constraints

- Work directly on `main`; the PO has explicitly approved direct main commits for this project.
- Follow RED -> expected failure -> minimal GREEN -> focused regression -> refactor for every behavior.
- Code, types, paths, plans, and commit messages are English; code comments and PO reports are Korean.
- Product copy is Korean and lives in label constants, never inline in screen components.
- `WITNESS_MAX=2`, `INVITE_TTL_HOURS=72`, and all other policy values come from shared config.
- Raw invite tokens never enter DB columns, logs, query strings, AsyncStorage, localStorage, or sessionStorage.
- All mutation endpoints require JWT and UUID `Idempotency-Key`; Origin determines APP versus WEB.
- PENDING witnesses see only title and creator. Full content and signing require an activated version.
- Evidence stays private and uses the existing 600-second `evidence-sign-url` contract.
- Do not edit `design-reference`, `.claude/settings.local.json`, or Supabase auth config.
- Do not run `supabase config push`, deploy while Management API listing returns 403, or push origin without a separate request.
- Before every commit run `npm test`, `npm run typecheck`, `npm run check:agents`, and `git diff --check`.

## File Map

- `packages/shared/src/api.ts`: witness HTTP contracts and endpoint slugs.
- `packages/shared/src/witness.ts`: strict witness response parsers and visibility/status vocabulary.
- `packages/shared/src/witness.test.ts`: contract boundary tests.
- `packages/shared/src/notification.ts`: NT-18 title, deeplink, and template validation.
- `supabase/migrations/20260816000006_f05_witness_flow.sql`: participant relation, RPCs, constraints, grants, and NT-18 outbox support.
- `supabase/tests/witness-flow.test.ts`: PGlite transaction, concurrency, privacy, and permission tests.
- `supabase/functions/_shared/witness.ts`: RPC argument and response sanitization shared by five handlers.
- `supabase/functions/witness-*/handler.ts`: pure request shells.
- `supabase/functions/witness-*/index.ts`: thin Deno runtime entrypoints.
- `supabase/tests/edge-witness.test.ts`: Edge auth, idempotency, surface, errors, and safe-log tests.
- `apps/mobile/src/lib/witness-api.ts`: authenticated mobile API calls.
- `apps/mobile/src/lib/witness-native.ts`: LargeSecureStore token repository and Share integration.
- `apps/mobile/src/components/witness-invite-sheet.tsx`: MOD-02 presentation and interaction.
- `apps/mobile/src/app/promise/[promise_id].tsx`: SCR-A05 entry point.
- `apps/mobile/src/app/invite.tsx`: SCR-A04 conditional entry point.
- `apps/mobile/src/screens/mod-02-labels.ts`: all MOD-02 Korean copy.
- `apps/web/src/lib/witness-api.ts`: join/detail/sign HTTP calls.
- `apps/web/src/screens/scr-w05-witness-confirm.tsx`: SCR-W05 limited/full/signed/evidence UI.
- `apps/web/src/routes.ts` and `apps/web/src/App.tsx`: token and account witness routes.
- `apps/web/src/screens/scr-w01-invite-landing.tsx`: role-based post-login routing.

---

### Task 1: Shared Witness and NT-18 Contracts

**Files:**
- Create: `packages/shared/src/witness.ts`
- Create: `packages/shared/src/witness.test.ts`
- Modify: `packages/shared/src/api.ts`
- Modify: `packages/shared/src/notification.ts`
- Modify: `packages/shared/src/notification.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `ParticipantRole`, `PromiseStatus`, `EvidenceView`, `IsoDateTime`, `ENDPOINT`.
- Produces: `WitnessInviteListResponse`, `WitnessInviteResponse`, `WitnessJoinResponse`, `WitnessDetailResponse`, `WitnessSignResponse`, `asWitness*Response`, and five endpoint slugs.

- [ ] **Step 1: Write failing contract tests**

Add strict parser tests that reject unknown fields, malformed UUIDs, non-instant timestamps, invalid
visibility/content combinations, and more than two witness slots. Add NT-18 tests:

```ts
expect(NOTIFICATION_TITLE['NT-18']('하영')).toBe('하영님이 내용을 확인했어요');
expect(NOTIFICATION_DEEPLINK['NT-18']).toBe('SCR-A05');
expect(renderNotificationTemplate('NT-18', {
  promiseTitle: '아침 러닝',
  partnerNickname: '하영',
})).toEqual({
  title: '하영님이 내용을 확인했어요',
  body: '아침 러닝',
  deeplink: 'SCR-A05',
});
```

Use these exact request shapes:

```ts
export interface WitnessInviteListRequest { promise_id: string }
export interface WitnessInviteRequest { promise_id: string; participant_id?: string }
export interface WitnessJoinRequest { token: string }
export interface WitnessDetailRequest { promise_id: string }
export interface WitnessSignRequest { promise_id: string }
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run packages/shared/src/witness.test.ts packages/shared/src/notification.test.ts`

Expected: FAIL because witness parsers, endpoint slugs, and NT-18 do not exist.

- [ ] **Step 3: Implement minimal contracts and parsers**

Define the slot and response boundary:

```ts
export interface WitnessSlotView {
  participant_id: string;
  status: 'INVITED' | 'JOINED';
  nickname: string | null;
  profile_image_url: string | null;
  expires_at: IsoDateTime | null;
  signed_at: IsoDateTime | null;
}

export interface WitnessInviteListResponse {
  promise_id: string;
  occupied_count: number;
  capacity: 2;
  witnesses: readonly WitnessSlotView[];
}

export interface WitnessInviteResponse {
  promise_id: string;
  participant_id: string;
  invitation_id: string;
  title: string;
  expires_at: IsoDateTime;
  token?: string;
}

export interface WitnessJoinResponse {
  promise_id: string;
  participant_id: string;
  status: 'JOINED';
}
```

Model detail as `visibility: 'LIMITED' | 'FULL'`; LIMITED requires `content`, `partner`,
`activated_at`, `fulfillment`, and `signed_at` to be null. FULL requires activated content and may
contain read-only evidence metadata. Add endpoint slugs `witnessInviteList`, `witnessInvite`,
`witnessJoin`, `witnessDetail`, and `witnessSign`.

Add NT-18 to the notification event union, title map, deeplink map, nickname-required event set, and
inbox sanitizer.

- [ ] **Step 4: Run GREEN and related regression**

Run:

```bash
npx vitest run packages/shared/src/witness.test.ts packages/shared/src/notification.test.ts packages/shared/src/api.test.ts packages/shared/src/promise-detail.test.ts
npm run typecheck
```

Expected: all selected tests and typecheck PASS.

- [ ] **Step 5: Run required commit gates and commit**

```bash
npm test
npm run typecheck
npm run check:agents
git diff --check
git add packages/shared/src/api.ts packages/shared/src/index.ts packages/shared/src/notification.ts packages/shared/src/notification.test.ts packages/shared/src/witness.ts packages/shared/src/witness.test.ts
git commit -m "feat: define F-05 witness contracts"
```

---

### Task 2: Witness Slot, Join, Detail, and Signature Transactions

**Files:**
- Create: `supabase/migrations/20260816000006_f05_witness_flow.sql`
- Create: `supabase/tests/witness-flow.test.ts`
- Modify: `supabase/tests/schema.test.ts`
- Modify: `supabase/tests/rls.test.ts`
- Modify: `supabase/tests/helpers/database.ts` only if the fixture needs a witness-slot helper.

**Interfaces:**
- Consumes: Task 1 JSON shapes, `lf_idempotency_begin/finish`, `lf_assert_actor`, `lf_notification_outbox_enqueue`, `lf_content_hash`, and existing invitation pepper hashing at the Edge layer.
- Produces: `lf_witness_invite_list`, `lf_witness_invite`, `lf_witness_join`, `lf_witness_detail`, and `lf_witness_sign`.

- [ ] **Step 1: Write failing PGlite tests**

Cover all of these as named tests before adding SQL:

```ts
test('joined creator and partner can each issue a WITNESS slot');
test('PENDING ACTIVE AMEND_PENDING CHECKING allow issue and terminal or DISPUTED states reject it');
test('joined plus valid invited count is capped at WITNESS_MAX across concurrent issue calls');
test('expired invited slots do not consume capacity or appear in the list');
test('reissue keeps the slot and revokes only its prior WITNESS invitation');
test('same idempotency key replays metadata without creating a token hash or second slot');
test('one WITNESS token can join only one account under concurrent calls');
test('creator partner and another existing witness receive E_DUPLICATE_ROLE');
test('blocked users receive E_BLOCKED without content');
test('PENDING joined witness receives LIMITED detail only');
test('activated joined witness receives FULL detail and permitted evidence metadata');
test('non-participant detail returns E_NOT_FOUND');
test('parallel witness signatures create one approval and two NT-18 outbox intents');
test('new idempotency key after signing returns the original signed_at');
test('witness cannot approve decline amend cancel or submit fulfillment');
test('witness RPCs and internal tables are unavailable to anon and authenticated Data API roles');
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run supabase/tests/witness-flow.test.ts supabase/tests/schema.test.ts supabase/tests/rls.test.ts`

Expected: FAIL because the relation and five RPCs are absent and `notification_outbox` rejects NT-18.

- [ ] **Step 3: Add schema relation and constraints**

Add the relation and a deterministic capacity index/query boundary:

```sql
alter table public.promise_participants
  add column invitation_id uuid references public.invitations (id);

create unique index promise_participants_invitation_unique
  on public.promise_participants (invitation_id)
  where invitation_id is not null;
```

Replace the outbox event check constraint with the same existing events plus `NT-18`. Do not loosen
the column to arbitrary text.

- [ ] **Step 4: Implement list and issue/reissue RPCs**

All functions are `security definer set search_path = ''`; revoke PUBLIC/anon/authenticated execute
and grant only service_role. `lf_witness_invite` uses this signature:

```sql
public.lf_witness_invite(
  p_idempotency_key uuid,
  p_actor uuid,
  p_promise_id uuid,
  p_token_hash char(64),
  p_participant_id uuid default null
) returns jsonb
```

Lock the promise before counting. Count WITNESS JOINED plus WITNESS INVITED whose linked invitation
is PENDING and `expires_at > now()`. On reissue, require the requested slot to be unbound INVITED,
revoke its current invitation, insert the replacement, and update `invitation_id` in the same
transaction.

- [ ] **Step 5: Implement join, detail, and sign RPCs**

Use exact signatures:

```sql
public.lf_witness_join(
  p_idempotency_key uuid,
  p_actor uuid,
  p_token_hash char(64)
) returns jsonb

public.lf_witness_detail(p_actor uuid, p_promise_id uuid) returns jsonb

public.lf_witness_sign(
  p_idempotency_key uuid,
  p_actor uuid,
  p_promise_id uuid,
  p_surface public.surface,
  p_ip_hash char(64),
  p_user_agent_hash char(64)
) returns jsonb
```

Join locks invitation then promise, binds only its linked slot, and records USED/used_at. Detail
returns LIMITED when no activated current version exists and FULL otherwise. Sign inserts the
current version/hash approval and enqueues NT-18 for each joined CREATOR/PARTNER with dedupe scope
`witness-sign:{participant_id}`.

- [ ] **Step 6: Run GREEN, concurrency regression, and commit**

```bash
npx vitest run supabase/tests/witness-flow.test.ts supabase/tests/schema.test.ts supabase/tests/rls.test.ts supabase/tests/invite-resolve.test.ts supabase/tests/notification-outbox.test.ts supabase/tests/promise-approve.test.ts supabase/tests/core-fulfillment.test.ts
npm run typecheck
npm test
npm run check:agents
git diff --check
git add supabase/migrations/20260816000006_f05_witness_flow.sql supabase/tests/witness-flow.test.ts supabase/tests/schema.test.ts supabase/tests/rls.test.ts supabase/tests/helpers/database.ts
git commit -m "feat: add F-05 witness transactions"
```

Expected: all selected and full suites PASS; two parallel issue/join/sign calls leave capacity,
invitation usage, approval, and outbox rows in one valid final state.

---

### Task 3: Witness Edge Functions

**Files:**
- Create: `supabase/functions/_shared/witness.ts`
- Create: `supabase/functions/witness-invite-list/handler.ts`
- Create: `supabase/functions/witness-invite-list/index.ts`
- Create: `supabase/functions/witness-invite/handler.ts`
- Create: `supabase/functions/witness-invite/index.ts`
- Create: `supabase/functions/witness-join/handler.ts`
- Create: `supabase/functions/witness-join/index.ts`
- Create: `supabase/functions/witness-detail/handler.ts`
- Create: `supabase/functions/witness-detail/index.ts`
- Create: `supabase/functions/witness-sign/handler.ts`
- Create: `supabase/functions/witness-sign/index.ts`
- Create: `supabase/tests/edge-witness.test.ts`
- Modify: `supabase/tests/edge-bundle.test.ts`

**Interfaces:**
- Consumes: Task 1 parsers and Task 2 RPC signatures.
- Produces: five importable pure handlers and five Deno entrypoints.

- [ ] **Step 1: Write failing Edge tests**

Test OPTIONS, POST-only behavior, missing/invalid JWT, UUID body fields, idempotency requirements on
mutations only, token hashing, Origin-derived surface, nullable PII hashes, strict response parsing,
known error mapping, unknown error flattening, and logs that contain no token/hash/link/body.

Assert RPC arguments exactly, for example:

```ts
expect(rpc).toHaveBeenCalledWith('lf_witness_join', {
  p_idempotency_key: IDEMPOTENCY_KEY,
  p_actor: USER_ID,
  p_token_hash: TOKEN_HASH,
});
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run supabase/tests/edge-witness.test.ts supabase/tests/edge-bundle.test.ts`

Expected: FAIL because handlers and entrypoints do not exist.

- [ ] **Step 3: Implement shared request helpers and pure handlers**

Each handler follows JWT -> method/body/header validation -> hash -> RPC -> shared strict sanitizer ->
JSON response. Use `inviteTokenHash` for the token and `piiHash` only when headers exist. Never accept
`surface` from the body.

Each `index.ts` contains only:

```ts
import { createDeps } from '../_shared/runtime.ts';
import { createWitnessSignHandler } from './handler.ts';

Deno.serve(createWitnessSignHandler(createDeps()));
```

- [ ] **Step 4: Run GREEN and commit**

```bash
npx vitest run supabase/tests/edge-witness.test.ts supabase/tests/edge-bundle.test.ts supabase/tests/edge-handlers.test.ts supabase/tests/edge-create-invite.test.ts
npm run typecheck
npm test
npm run check:agents
git diff --check
git add supabase/functions/_shared/witness.ts supabase/functions/witness-invite-list supabase/functions/witness-invite supabase/functions/witness-join supabase/functions/witness-detail supabase/functions/witness-sign supabase/tests/edge-witness.test.ts supabase/tests/edge-bundle.test.ts
git commit -m "feat: add F-05 witness edge functions"
```

---

### Task 4: Android MOD-02 Invitation Flow

**Files:**
- Create: `apps/mobile/src/lib/witness-api.ts`
- Create: `apps/mobile/src/lib/witness-api.test.ts`
- Create: `apps/mobile/src/lib/witness-native.ts`
- Create: `apps/mobile/src/lib/witness-native.test.ts`
- Create: `apps/mobile/src/components/witness-invite-sheet.tsx`
- Create: `apps/mobile/src/screens/mod-02-labels.ts`
- Create: `apps/mobile/src/screens/mod-02-witness-invite.test.tsx`
- Modify: `apps/mobile/src/app/promise/[promise_id].tsx`
- Modify: `apps/mobile/src/app/invite.tsx`
- Modify: `apps/mobile/src/screens/scr-a04-invite.test.tsx`
- Modify: `apps/mobile/src/screens/scr-a05-promise-detail.test.tsx`
- Modify: `apps/mobile/src/components/index.ts`

**Interfaces:**
- Consumes: Task 1 response parsers and endpoint slugs.
- Produces: `listWitnesses`, `issueWitnessInvite`, `shareWitnessInvite`, and `WitnessInviteSheet`.

- [ ] **Step 1: Write failing mobile API and secure-token tests**

Test bearer token propagation, per-call UUID idempotency, strict server response parsing, and
`MobileApiError` flattening. Test encrypted key scope `witness-invite:{userId}:{promiseId}:{participantId}`,
same-token reuse, missing-token reissue, logout isolation, and deletion after a replacement token is
stored.

- [ ] **Step 2: Run API RED and implement minimal wrappers**

Run:

```bash
npm run test --workspace=@littlefinger/mobile -- --runInBand src/lib/witness-api.test.ts src/lib/witness-native.test.ts
```

Expected: FAIL because witness mobile modules do not exist.

Implement wrappers on the existing `callMobileFunction` boundary. Build links with
`EXPO_PUBLIC_WEB_BASE_URL` and share only:

```ts
await Share.share({ message: `${title}\n${webBaseUrl}/i/${token}` });
```

- [ ] **Step 3: Write failing MOD-02 and entry-point tests**

Cover loading/retry, zero/one/two slots, unknown invited nickname copy, joined unsigned, signed
timestamp, same-token reshare without server call, missing-token reissue, share cancel, share error,
rapid double tap, capacity disable copy, 48 dp controls, no ad, A04 conditional entry, and eligible
SCR-A05 statuses/roles.

- [ ] **Step 4: Run screen RED and implement MOD-02**

Run:

```bash
npm run test --workspace=@littlefinger/mobile -- --runInBand src/screens/mod-02-witness-invite.test.tsx src/screens/scr-a04-invite.test.tsx src/screens/scr-a05-promise-detail.test.tsx
```

Expected: FAIL because the sheet and entry actions are absent.

Port the frozen bottom-sheet structure using `LfText`, `LfButton`, `LfChip`, `LfIcon`, and token
values only. Keep request-pending refs outside React state to prevent same-frame duplicate issue or
share calls.

- [ ] **Step 5: Run GREEN, full regression, and commit**

```bash
npm run test --workspace=@littlefinger/mobile -- --runInBand src/lib/witness-api.test.ts src/lib/witness-native.test.ts src/screens/mod-02-witness-invite.test.tsx src/screens/scr-a04-invite.test.tsx src/screens/scr-a05-promise-detail.test.tsx
npm run typecheck
npm test
npm run check:agents
git diff --check
git add apps/mobile/src/lib/witness-api.ts apps/mobile/src/lib/witness-api.test.ts apps/mobile/src/lib/witness-native.ts apps/mobile/src/lib/witness-native.test.ts apps/mobile/src/components/witness-invite-sheet.tsx apps/mobile/src/components/index.ts apps/mobile/src/screens/mod-02-labels.ts apps/mobile/src/screens/mod-02-witness-invite.test.tsx apps/mobile/src/app/promise/[promise_id].tsx apps/mobile/src/app/invite.tsx apps/mobile/src/screens/scr-a04-invite.test.tsx apps/mobile/src/screens/scr-a05-promise-detail.test.tsx
git commit -m "feat: build Android witness invitation flow"
```

---

### Task 5: Web SCR-W05 Join, Revisit, Sign, and Evidence

**Files:**
- Create: `apps/web/src/lib/witness-api.ts`
- Create: `apps/web/src/lib/witness-api.test.ts`
- Create: `apps/web/src/screens/scr-w05-labels.ts`
- Create: `apps/web/src/screens/scr-w05-witness-confirm.tsx`
- Create: `apps/web/src/screens/scr-w05-witness-confirm.test.tsx`
- Modify: `apps/web/src/routes.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/screens/scr-w01-invite-landing.tsx`
- Modify: `apps/web/src/screens/scr-w01-invite-landing.test.tsx`
- Modify: `apps/web/src/styles/screens/web.css` only for selectors already represented by the frozen SCR-W05 reference.

**Interfaces:**
- Consumes: Task 1 contracts, Task 3 endpoints, existing `signInWithKakao`, and existing evidence signed-URL wrapper behavior.
- Produces: `/i/:token/witness`, `/witness/:promise_id`, role-based landing redirect, and SCR-W05.

- [ ] **Step 1: Write failing web API and route tests**

Test session bearer token, join idempotency, detail read without idempotency, sign idempotency,
strict sanitization, and error flattening. Add route assertions:

```ts
expect(witnessJoinPath('abc')).toBe('/i/abc/witness');
expect(witnessPath(PROMISE_ID)).toBe(`/witness/${PROMISE_ID}`);
```

Assert signed-in WITNESS landing redirects to the join path while PARTNER still redirects to review.

- [ ] **Step 2: Run API/route RED and implement wrappers/routes**

Run:

```bash
npx vitest run apps/web/src/lib/witness-api.test.ts apps/web/src/screens/scr-w01-invite-landing.test.tsx apps/web/src/App.test.tsx
```

Expected: FAIL because witness API, paths, and route components are absent.

- [ ] **Step 3: Write failing SCR-W05 behavior tests**

Cover:

- token join then `replace` to account route;
- refresh and direct account revisit;
- signed-out revisit Kakao OAuth return path;
- LIMITED title/creator/wait message with no content or signature CTA;
- FULL read-only content, parties, activation time, and role banner;
- checkbox-gated signature, rapid double tap suppression, original timestamp on repeat;
- signed-state restore after refresh;
- AVAILABLE image URL request, 600-second refresh, BLINDED and EXPIRED placeholders;
- URL cleanup on unmount and no persistent token/signed URL storage;
- no fulfillment mutation controls and no ads.

- [ ] **Step 4: Run screen RED and implement SCR-W05**

Run: `npx vitest run apps/web/src/screens/scr-w05-witness-confirm.test.tsx`

Expected: FAIL because SCR-W05 is absent.

Reuse the frozen `lf-info-banner`, `lf-card--web`, participant rows, evidence tiles, and action area.
Do not port `lf-device`, `lf-device__viewport`, or `lf-browserbar`. Keep all Korean copy in
`scr-w05-labels.ts`.

- [ ] **Step 5: Run GREEN, web regression, and commit**

```bash
npx vitest run apps/web/src/lib/witness-api.test.ts apps/web/src/screens/scr-w01-invite-landing.test.tsx apps/web/src/screens/scr-w05-witness-confirm.test.tsx apps/web/src/App.test.tsx apps/web/src/screens/scr-w04-participant-promises.test.tsx supabase/tests/edge-evidence.test.ts supabase/tests/evidence-lifecycle.test.ts
npm run typecheck
npm run build:web
npm test
npm run check:agents
git diff --check
git add apps/web/src/lib/witness-api.ts apps/web/src/lib/witness-api.test.ts apps/web/src/screens/scr-w05-labels.ts apps/web/src/screens/scr-w05-witness-confirm.tsx apps/web/src/screens/scr-w05-witness-confirm.test.tsx apps/web/src/routes.ts apps/web/src/App.tsx apps/web/src/App.test.tsx apps/web/src/screens/scr-w01-invite-landing.tsx apps/web/src/screens/scr-w01-invite-landing.test.tsx apps/web/src/styles/screens/web.css
git commit -m "feat: build web witness confirmation flow"
```

---

### Task 6: Integration, Visual Verification, and Local Completion Gate

**Files:**
- Modify: `docs/DEVELOPMENT_STATUS.md`
- Modify: `TODOS.md` only to record witness withdrawal as a scoped follow-up if it is not already present.
- Test: all focused suites introduced above.

**Interfaces:**
- Consumes: the complete witness vertical slice from Tasks 1-5.
- Produces: verified local completion evidence and an explicit remote-deployment gate.

- [ ] **Step 1: Run focused integration tests**

Run:

```bash
npx vitest run packages/shared/src/witness.test.ts packages/shared/src/notification.test.ts supabase/tests/witness-flow.test.ts supabase/tests/edge-witness.test.ts apps/web/src/lib/witness-api.test.ts apps/web/src/screens/scr-w05-witness-confirm.test.tsx
npm run test --workspace=@littlefinger/mobile -- --runInBand src/lib/witness-api.test.ts src/lib/witness-native.test.ts src/screens/mod-02-witness-invite.test.tsx src/screens/scr-a04-invite.test.tsx src/screens/scr-a05-promise-detail.test.tsx
```

Expected: all witness contract, transaction, handler, app, and web tests PASS.

- [ ] **Step 2: Run full project gates**

```bash
npm test
npm run typecheck
npm run build:web
npm run check:agents
npx expo install --check
npx expo export --platform android --output-dir C:\tmp\littlefinger-f05-witness-20260816
git diff --check
```

Expected: all commands exit 0; Android export reports a completed bundle.

- [ ] **Step 3: Perform visual verification**

Render MOD-02 and SCR-W05 at 360 x 800 and compare against:

- `design-reference/screens/app/mod-02-witness-invite.html`
- `design-reference/screens/web/scr-w05-witness-confirm.html`

Record as intentional differences: INVITED unknown-user state, PENDING limited state, checkbox
gate, signed revisit state, evidence availability placeholders, retry/error states, and no preview
browser/device chrome. Fix any token, spacing, typography, or 48 dp target regression before continuing.

- [ ] **Step 4: Update status documentation**

Record local F-05 completion, deferred witness withdrawal, deferred remote deploy/UAT, and the
Management API 403. Do not claim remote migration/function presence.

- [ ] **Step 5: Run final gates and commit documentation**

```bash
npm test
npm run typecheck
npm run build:web
npm run check:agents
git diff --check
git add docs/DEVELOPMENT_STATUS.md TODOS.md
git commit -m "docs: record local F-05 witness completion"
```

- [ ] **Step 6: Enforce the remote gate**

Run the read-only migration list only if the local Supabase CLI can authenticate without changing
configuration. If it returns 403, stop remote work immediately. After access is restored in a later
authorized task, apply the committed migration, deploy all five functions with `--use-api`, verify
RLS and NT-18 outbox rows, and run two-account Android/web UAT. Never run `supabase config push`.

## Self-Review Results

- Spec coverage: invitation, maximum capacity, role permissions, pre-ACTIVE privacy, join,
  one-time signature, account revisit, NT-18, evidence viewing, and visual verification each map to
  an explicit task.
- Exclusion coverage: witness withdrawal, email, moderation, remote deployment, and origin push are
  not implemented by any task.
- Type consistency: all five endpoint names and all five RPC names are defined once and reused by
  later tasks.
- Placeholder scan: the plan contains no TBD/TODO implementation steps or unspecified error/test
  directives.
