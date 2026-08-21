# Edge-case traceability

Snapshot: 2026-08-18 KST.

The executable source of truth is
[`supabase/tests/ec-traceability.test.ts`](../../supabase/tests/ec-traceability.test.ts). It maps
every unique ID in `02_세부기능명세서.md` §10 to a behavior test whose name contains the same ID.
The trace contains exactly 57 cases, from EC-A01 through EC-I04, and fails if the specification and
test catalog diverge.

| Group | IDs | Count | Primary evidence |
|---|---|---:|---|
| Authentication and account | EC-A01--EC-A07 | 7 | Mobile auth screens, user provisioning, account lifecycle |
| Invite and acceptance | EC-B01--EC-B11 | 11 | Invite resolve/preview, approval, invite expiry and draft cleanup |
| Approval integrity | EC-C01--EC-C04 | 4 | Idempotency, rollback, lock fencing, immutable version source |
| Witness | EC-D01--EC-D05 | 5 | Witness capacity, role uniqueness, immutable signature and visibility |
| Amend and cancel | EC-E01--EC-E05 | 5 | Parallel request fencing, validation, expiry and state guards |
| Fulfillment | EC-F01--EC-F10 | 10 | Parallel verdict, revision, KST batches, evidence and recheck rounds |
| Notification | EC-G01--EC-G05 | 5 | Manual Kakao fallback, token eviction, no-email scope, dedupe and required events |
| Data and account | EC-H01--EC-H06 | 6 | Withdrawal preservation, hiding, token cap, limits and integrity incidents |
| Platform | EC-I01--EC-I04 | 4 | In-app invite review via App Links (resolve/preview/approve/decline/amend, ADR 0007), Kakao in-app intent CTA fallback, iOS web path and version gate |

## Concurrency evidence

| ID | Local evidence | Remote evidence |
|---|---|---|
| EC-B06 | Conditional `used_at is null` update, invitation row lock and unique participant indexes | Pending two-connection test |
| EC-C01 | Idempotency cache replay and one append-only approval set | Pending simultaneous HTTP replay |
| EC-C03 | Approval and revoke functions both lock the invitation row | Pending approve-versus-revoke race |
| EC-E01 | `Promise.allSettled` request race leaves one PENDING amend row | Pending remote confirmation |
| EC-F01 | `Promise.all` fulfillment submissions produce one verdict and two check rows | Pending remote confirmation |

PGlite uses an in-process execution model, so its `Promise.all` coverage cannot prove PostgreSQL
lock waiting across two network connections. The remote concurrency rows must remain pending until
the test Supabase project accepts the migrations and two independent clients can run the requests.

## Platform and device evidence

EC-I01--I04 have automated route/configuration contracts. Actual Android App Link domain
verification, KakaoTalk in-app browser behavior, throttled network timing, and physical-device push
delivery are device/UAT gates rather than claims made by the automated trace.

