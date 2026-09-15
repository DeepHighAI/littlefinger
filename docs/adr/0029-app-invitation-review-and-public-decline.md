# ADR 0029 — App invitation review and token-holder decline

Status: Accepted by PO on 2026-09-15. Implementation and verification in progress.

## Decision

Partner and witness invitation links show only the sender and promise title, the
approved mascot, Open in app and Decline. No web OAuth or authenticated web review
redirect belongs to invitation entry. Legacy /review and /i/:token/witness routes
render the same landing. Existing /witness/:promise_id links hand off to the app.
The Android intent preserves the invitation token; its browser fallback opens Play.
After installation, the recipient explicitly reopens the original invitation link.
There is no deferred-install token service and no automatic approval.

The app keeps account confirmation and content review before partner approval.
Witnesses now sign in and review inside the app. Preview is authenticated and read
only, does not join or consume the token, and retains LIMITED visibility until the
promise is activated. An explicit action joins; FULL content can then be signed.
Join/sign keep their established separate idempotent transactions: a signature
failure must be retryable after a successful join. Witness signatures never change
the agreement state. Existing signed records and role restrictions remain intact.

The PO explicitly authorized token-holder web decline. A POST plus explicit UI
confirmation is required; GET previews never mutate state. No account is invented
and no account-attributed approval is written. An RLS-protected, server-only
invitation_declines ledger records invitation/promise/role, content hash for partner
rejection, time and salted IP/UA hashes. No raw token/IP/UA is stored. Partner decline
terminates PENDING as DECLINED and cancels reminders; witness decline only closes the
invited witness slot. Both consume their invitation and enqueue a deduplicated NT-02
notice to the inviter using an explicit unidentified-recipient label. Repeat requests
return the same minimal result. Expired, revoked and previously accepted links fail.

All mutations are service-role RPCs; direct anon/authenticated database access is
revoked. Public Edge decline applies the existing IP rate limit before strict token
validation and hashes the token with the established pepper. Invite then promise row
locking matches acceptance/deletion. Existing authenticated decline APIs remain for
installed clients. Account login remains in the app and unrelated account-web routes.

## Design

Mode: Operate. Preserve Ink & Block, Pretendard, existing paper/ink/yellow tokens and
new portrait. Group mascot/sender/title; one yellow app action and one outlined decline
action. Desktop content width is capped by the new web-only invite-content-max token.
Use an inline confirmation group for decline, without a third initial task action.
The installation hint links to Play so older app versions that return witnesses to the web have an update escape path. The two primary task actions remain unchanged. The global locale switch remains. Errors, loading and terminal states are distinct.

Mobbin screens inspected:
- [Finch invitation](https://mobbin.com/screens/6fd8cf44-4d27-47df-8b43-2f7ab077d7b7): sender,
  character and invitation content grouped above primary and secondary actions.
- [Luma invitation](https://mobbin.com/screens/9d434fbd-38f6-4f9c-ac2c-09cb0d4e3b25): inviter
  identity directly precedes a clear Accept/Decline choice.
Only hierarchy and grouping are references; no third-party artwork or visual skin is copied.
The earlier optional mobile login/empty spacing proposals remain outside this approval.

## Compatibility and release order

New AAB required for native witness review and witness detail deep links. Code 33 and
older send witnesses back to the web. Deploy additive server changes first, prepare
and verify the new app, then transition the web when the updated Play build is available.
Do not force a minimum-version change or publish a Play release without PO instruction.
The PO owns Play upload/publication. Old partner invitation paths remain compatible.

## Verification

Required: real Postgres-compatible transaction tests for public decline, revoked/used/
expired tokens, participant scope and preview non-consumption; Edge hashing/auth/rate
limit tests; UI tests for explicit actions, handoff and sign retry; five-project typecheck;
web and native screenshots at 360 dp and normal/large text. PGlite queues statements on
one connection: queued response tests establish mutually exclusive outcomes, not a
multi-connection deadlock benchmark. Exact release evidence will be recorded separately.
