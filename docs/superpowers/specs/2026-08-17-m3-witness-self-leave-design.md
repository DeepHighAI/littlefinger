# M3 Witness Self-Leave Design

**Date:** 2026-08-17

**Status:** Proposed for implementation review
**Scope:** Authenticated witness self-leave and EC-D03 record preservation

## Goal

Complete the deferred F-05 witness self-leave outcome without changing promise state or deleting
audit history. A joined witness can leave any promise, including a terminal promise. Leaving
immediately removes future account-based promise access, excludes the witness from occupied-slot
counts, and preserves every existing `WITNESS_SIGN` approval.

MOD-03 is deliberately not part of this design. It follows as a separate design and TDD unit after
witness self-leave is locally complete.

## Chosen Architecture

Reuse the existing `promise_participants.status = 'WITHDRAWN'` value and add one dedicated
authenticated `witness-leave` mutation.

The alternatives are rejected for the following reasons:

1. **Delete the participant row.** This would make the slot available, but it would remove the
   durable membership relation that explains the append-only witness signature and would weaken
   auditability.
2. **Add a separate witness-leave table while keeping the participant JOINED.** This would preserve
   an event timestamp, but every authorization query would need an additional anti-join and the
   existing participant status enum would remain unused for its intended lifecycle boundary.
3. **Selected: update the existing participant row to WITHDRAWN.** Existing list, detail, evidence,
   and RLS boundaries already require JOINED participation. One transaction therefore revokes all
   future reads without duplicating authorization rules.

No new promise status, participant role, approval action, or notification event is introduced.

## Public Contract

Add one authenticated endpoint:

- `witness-leave`: permanently withdraw the caller's joined WITNESS participant row.

The shared contract is:

```ts
interface WitnessLeaveRequest {
  promise_id: string;
}

interface WitnessLeaveResponse {
  promise_id: string;
  status: 'WITHDRAWN';
}
```

The endpoint requires a Supabase JWT and a UUID `Idempotency-Key`. The response parser is strict:
unknown keys, invalid UUIDs, or any status other than `WITHDRAWN` are rejected. Non-witnesses and
users with no participant history receive `E_NOT_FOUND`, preserving the repository's
non-disclosure boundary.

## Transaction and Concurrency

Add the service-role-only transaction function:

```sql
public.lf_witness_leave(
  p_idempotency_key uuid,
  p_actor uuid,
  p_promise_id uuid
) returns jsonb
```

The function performs these steps atomically:

1. assert that the actor is an ACTIVE user;
2. begin the existing idempotency protocol under endpoint name `witness-leave`;
3. lock the promise row;
4. lock the actor's WITNESS participant row in JOINED or WITHDRAWN state;
5. return `E_NOT_FOUND` when either row or the actor's witness history is absent;
6. update JOINED to WITHDRAWN, leaving `user_id`, `invited_at`, `joined_at`, and `invitation_id`
   unchanged;
7. return the same successful response when the row is already WITHDRAWN; and
8. finish the idempotency record with the authoritative response.

There is intentionally no promise-status guard. PENDING, ACTIVE, AMEND_PENDING, CHECKING,
COMPLETED, BROKEN, DISPUTED, UNRESOLVED, DECLINED, and CANCELED promises all permit self-leave. A
synthetic DRAFT fixture also remains state-independent at the transaction boundary, although the
normal product flow cannot join a witness while a promise is DRAFT.

The lock order matches `lf_witness_sign`: promise first, participant second. When signing and
leaving race:

- if signing commits first, the signature remains and leaving then succeeds;
- if leaving commits first, the later signing request cannot find a JOINED witness and returns
  `E_NOT_FOUND`.

A second request with a different idempotency key is a successful no-op. This allows recovery when
the client loses the first response after the transaction commits.

## Record Preservation and Access Revocation

Leaving changes only the participant status.

- `approvals.WITNESS_SIGN` remains append-only and is never updated or deleted.
- The witness does not affect the promise status, fulfillment result, trust profile, or any party's
  notification settings.
- `lf_witness_detail`, `lf_witness_sign`, `lf_promise_detail`, `lf_evidence_sign_target`, home and
  participant lists, and RLS reads continue to require JOINED status. Future access therefore
  fails immediately after the leave transaction commits.
- In-flight responses created before the commit cannot be recalled. A previously issued evidence
  signed URL remains usable only until its existing ten-minute expiry; no new signed URL can be
  issued after leave. The web clears its loaded detail state on success and never persists a
  signed URL.
- The creator and partner witness list excludes WITHDRAWN rows, so the slot becomes available
  again in states where F-05 still permits a new invitation.
- The preserved `(promise_id, user_id)` participant row makes leave permanent for that account.
  A later invite redemption by the same account continues to return `E_DUPLICATE_ROLE`; this avoids
  silently restoring a role whose prior signature remains authoritative.

No notification is emitted. F-05 and the notification matrix define an event for witness signing,
not for witness leaving. Parties see the available slot on their next MOD-02 refresh.

## Edge Function Boundary

The new function follows the existing witness shell split:

- `handler.ts` authenticates, requires POST, validates exact `{ promise_id }`, requires the
  idempotency header, invokes `lf_witness_leave`, strictly parses the response, and flattens unknown
  failures;
- `index.ts` only creates runtime dependencies and registers `Deno.serve`.

The function logs no promise title, participant identity, idempotency key, or response payload.
`supabase/config.toml` explicitly sets `[functions.witness-leave] verify_jwt = true`.

## SCR-W05 UX

SCR-W05 is the only self-leave surface because F-05 defines witnesses as authenticated web
participants.

Both LIMITED and FULL joined-witness views expose a 48 px `증인 나가기` action. Selecting it opens
an accessible confirmation dialog without discarding the currently loaded detail.

- If the witness has signed, the dialog displays the EC-D03 copy verbatim:
  `서명 기록은 지워지지 않습니다. 계속하시겠어요?`
- If the witness has not signed, it displays:
  `나가면 이 약속을 더 이상 볼 수 없습니다. 계속하시겠어요?`
- The actions are `계속 보기` and `나가기`.

The confirm action is single-flight and reuses one idempotency key until success. A failure keeps
the detail and dialog available for retry. A success immediately clears the detail and renders a
neutral completion state: `증인에서 나왔습니다.` with `내 약속 보기`, which navigates to
`/promises`. Refreshing or revisiting the old `/witness/{promise_id}` route returns `E_NOT_FOUND`.

All copy lives in `SCR_W05_LABEL`; no ad or reserved ad space is rendered. The implementation uses
the existing token and web component classes and adds only the minimum dialog styles that the
frozen reference does not contain.

## TDD and Verification Strategy

Implementation proceeds in strict RED -> expected failure -> minimum GREEN cycles:

1. shared leave request/response contracts, endpoint slug, and strict parser;
2. PGlite transaction tests for every promise status, unsigned and signed witnesses, append-only
   signature preservation, different-key retry, slot release, outsider hiding, permanent rejoin
   rejection, and sign-versus-leave serialization;
3. pure Edge handler tests for JWT, method, exact request shape, idempotency, RPC arguments, strict
   response parsing, flattened failures, and safe logs;
4. web API and SCR-W05 tests for unsigned and signed confirmation copy, cancel, single-flight
   submission, retry, success-state clearing, account-list navigation, and post-leave access denial;
5. focused regressions for witness invite/detail/sign, promise detail, evidence authorization, home
   list, and participant list; and
6. full repository tests, typecheck, web build, agent sync check, Expo dependency check, Android
   production export, diff checks, and a 360 x 800 web visual comparison.

The change is locally complete only when all automated gates pass. Remote migration and Edge
Function deployment are a separate explicitly authorized operation. `supabase config push` and an
unrequested origin push remain prohibited.

## Exclusions

- signature cancellation, deletion, or redaction;
- party-initiated witness removal;
- witness rejoin or role restoration;
- witness-leave notifications;
- MOD-03 completion celebration;
- email delivery, moderation, or evidence reporting; and
- remote deployment and cross-account UAT in this local implementation step.
