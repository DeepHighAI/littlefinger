# M3 F-05 Witness Invitation and Confirmation Design

## Goal

Complete the F-05 witness flow as one local vertical slice:

- invite up to two witnesses from the Android app;
- redeem a one-time 72-hour witness link after Kakao login;
- show the restricted pre-confirmation view and the read-only confirmed promise view;
- record one irreversible witness confirmation signature;
- restore the witness screen later from the authenticated account without the invite token; and
- expose fulfillment evidence to a joined witness under the existing private signed-URL rules.

Witness self-withdrawal from EC-D03 is intentionally deferred to a separate design and plan. A
signature remains append-only and cannot be canceled.

## Architectural Choice

Use dedicated witness contracts and transaction functions while reusing the existing public
`invite-resolve` endpoint and Kakao authentication flow.

The alternative of adding `target_role` branches throughout the partner invite endpoints was
rejected because partner approval changes promise state while witness participation never does.
Combining those permission models would increase the regression and authorization surface in the
most security-sensitive path. A backend-only phase was also rejected because it would not complete
the approved invite, view, sign, and revisit outcome.

## Public Contracts

Add dedicated authenticated endpoints:

- `witness-invite-list`: list joined witnesses and currently valid invited slots for a promise;
- `witness-invite`: create a new invited slot or reissue the link for one existing invited slot;
- `witness-join`: consume a valid WITNESS invitation and bind its slot to the signed-in user;
- `witness-detail`: return the account-based SCR-W05 view; and
- `witness-sign`: append one witness confirmation signature.

All mutation endpoints require a JWT and UUID `Idempotency-Key`. Read endpoints require a JWT and
return `E_NOT_FOUND` to non-participants so they do not reveal that a promise exists.

The shared package owns the request and response shapes, endpoint slugs, strict response parsers,
screen labels, and NT-18 notification template. Product surfaces must not construct an unchecked
response object or duplicate a policy string.

## Data Model and Transactions

Add an internal nullable `invitation_id` relation on `promise_participants` so each WITNESS
`INVITED` slot maps to exactly one invitation chain. The relation is unique when present. Direct
Data API writes remain revoked.

### Issue or reissue

`lf_witness_invite` locks the promise row and performs the following atomically:

1. assert an active actor who is a joined CREATOR or PARTNER;
2. require promise status PENDING, ACTIVE, AMEND_PENDING, or CHECKING;
3. count joined witnesses plus invited slots whose current invitation is PENDING and unexpired;
4. reject a new slot when that count is already `WITNESS_MAX`;
5. create a nullable-user WITNESS participant slot and a WITNESS invitation, or revoke the old
   pending invitation and create the replacement for a requested slot; and
6. return invitation metadata while persisting only the peppered token hash.

Expired invited slots do not consume capacity and are omitted from the modal list. The original
token exists only in the first successful Edge response. On an idempotency replay the response
returns the slot metadata without a token; the app reissues that slot with a new key if it no longer
has the token encrypted locally.

### Join

`lf_witness_join` locks the invitation before the promise, matching the existing invitation lock
order. It validates status, expiry, target role, bidirectional block state, and duplicate role, then
binds the invitation's participant slot to the authenticated user and marks it JOINED while marking
the invitation USED. Concurrent users of one token cannot both succeed.

A valid invitation issued in an allowed state remains redeemable for its 72-hour lifetime even if
the promise later reaches a terminal state. This is not a new invitation. Joined witnesses retain
read access as required by F-05.

### Detail and sign

`lf_witness_detail` requires a joined WITNESS participant. For PENDING it returns only the title,
creator identity, status, and the wait message contract. From ACTIVE onward it returns the current
read-only promise content, participants, confirmation time, existing signature, fulfillment result
metadata, and evidence availability allowed by the existing privacy rules.

`lf_witness_sign` locks the promise and participant, requires a joined WITNESS and an activated
version, and appends one `approvals.WITNESS_SIGN` row containing that version and its `content_hash`.
The signature is unique per promise and user. A retry with a different idempotency key returns the
original `signed_at` without adding another approval or notification.

The signature transaction also writes two NT-18 outbox intents, one for each joined party. The
shared notification title is `{witness}님이 내용을 확인했어요` and the app deeplink is SCR-A05.
Email delivery remains outside the MVP.

## Token and Privacy Rules

- Raw invite tokens never enter DB columns, logs, query strings, or ordinary browser/app storage.
- The app keeps a returned witness token only in `LargeSecureStore`, scoped by user, promise, and
  participant slot.
- The web keeps the token only in the route during redemption and replaces that route with
  `/witness/{promise_id}` after joining.
- IP and User-Agent values are stored only as `PII_HASH_SALT` hashes where an approval audit row
  requires them.
- Evidence remains in the private bucket and is read through the existing ten-minute signed URL
  endpoint. Blinded and expired evidence never receives a usable object URL.

## App UX: MOD-02

Port the approved MOD-02 bottom sheet over SCR-A05 using existing design tokens and components.

- Eligible PENDING, ACTIVE, AMEND_PENDING, and CHECKING detail screens expose a witness action.
- SCR-A04 also exposes `증인도 초대하기` when the draft was sent with `witness_enabled=true`.
- The sheet shows `증인 n / 2`, joined and valid invited slots, and remaining capacity.
- A not-yet-bound slot is labeled `초대받은 증인 · 초대 중`.
- A bound unsigned witness shows the Kakao nickname and `확인 대기`.
- A signed witness shows the nickname, signature time, and `확인 완료`.
- When the encrypted token exists, share the same title-and-link message through React Native
  `Share`. When it does not, reissue that slot before sharing.
- At two occupied slots the CTA is disabled and `증인은 최대 2명까지예요` is displayed.

Every touch target is at least 48 dp. No ad view or empty ad space is rendered.

## Web UX: SCR-W05

The existing SCR-W01 route uses `InviteResolveResponse.target_role` after authentication:

- PARTNER continues to `/i/{token}/review`;
- WITNESS goes to `/i/{token}/witness`, calls `witness-join`, and replaces the route with
  `/witness/{promise_id}`.

The account route restores the Supabase session. A signed-out revisit starts Kakao OAuth with the
same account route as its return destination.

SCR-W05 has two explicit states:

- PENDING shows the title, creator, witness-role explanation, and
  `약속이 확정되면 전체 내용을 볼 수 있습니다`; it does not render a signature control.
- ACTIVE and later states show the read-only content, parties, activation time, role explanation,
  fulfillment result evidence allowed to the witness, and a confirmation checkbox. The signature
  CTA is enabled only after the checkbox is selected.

After signing, the screen shows the recorded time and no second signature action. The acceptance
web remains ad-free. The implementation reuses the frozen SCR-W05 classes and removes the preview
device and browser chrome.

## Evidence Viewing

This screen closes the SCR-W05 integration deliberately deferred by the F-08 core plan.

- Only evidence metadata already public to the joined witness is rendered.
- AVAILABLE evidence requests a ten-minute URL through `evidence-sign-url`.
- BLINDED renders `신고 접수로 가려진 이미지입니다`.
- EXPIRED renders the existing expired-evidence placeholder.
- Expired signed URLs are requested again and are never stored in persistent browser storage.
- Witnesses receive no fulfillment response, revision, reporting, or judgment controls.

## Errors and Authorization

- Party using a witness link: `E_DUPLICATE_ROLE`.
- Capacity exceeded: `E_WITNESS_LIMIT`.
- Invite issued in a disallowed status: `E_STATE_CONFLICT`.
- Expired, used, or revoked token: the existing `E_INVITE_*` errors.
- Bidirectional block: `E_BLOCKED`.
- Non-participant list/detail access: `E_NOT_FOUND`.
- Unknown failures: the existing flattened internal-error response.

Regression tests must prove that a WITNESS cannot call approval, decline, amend, cancel, or
fulfillment submission endpoints.

## TDD and Verification Strategy

Implementation proceeds contract-first in strict RED -> GREEN cycles:

1. shared witness types, strict parsers, endpoint slugs, labels, and NT-18;
2. PGlite schema, issue/reissue capacity, concurrency, join, role guards, signing, and outbox;
3. pure Edge handlers for authentication, idempotency, surface, safe errors, and safe logs;
4. MOD-02 list/share/reissue/capacity behavior and SCR-A04/SCR-A05 entry points;
5. SCR-W05 authentication, pending restriction, full detail, signature, revisit, and evidence;
6. full regression, typecheck, web build, agent sync check, Expo dependency check, Android production
   export, diff checks, and 360 x 800 visual comparison.

Remote deployment is not part of the local completion claim while the Supabase Management API
continues to return 403. No `supabase config push` or unrequested origin push is allowed.

## Exclusions

- witness self-withdrawal and EC-D03 withdrawal UI/API;
- signature deletion or cancellation;
- email collection or delivery;
- evidence reporting and moderator workflows;
- arbitrary public or permanent evidence URLs; and
- remote deployment or two-account UAT while the current external gates remain blocked.
