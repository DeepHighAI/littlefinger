# 0015. Rewarded benefits, personal retention, and permanent access

Date: 2026-08-29
Status: Accepted (PO-confirmed, 2026-08-29)
Extends: ADR 0009

## Context

The original monetization model had one paid item (`promise_slot_plus1`, ₩1,000) and three
bottom native-ad placements. The PO chose four additional mechanics: rewarded witness capacity,
rewarded promise-duration extensions, rewarded record-retention extensions with a ₩2,000
permanent option, and one A02 in-feed banner for lists above five promises.

These mechanics touch record integrity and mutual consent. A client-only ad callback cannot grant
anything, a unilateral duration change cannot mutate an ACTIVE promise, and record retention must
be personal because one participant's willingness to pay cannot remove another participant's
access.

## Decisions

### D1 — Witness capacity belongs to the inviting role

A promise supports at most three witnesses. The creator receives one free place and may unlock one
more through a rewarded ad. The partner starts with zero and may unlock one through a rewarded ad.
Capacity is permanent for that promise but is reusable when a witness leaves. Existing witness
counts are grandfathered; migration grants preserve their current shape and only block new invites
when capacity is exhausted.

### D2 — Duration is an entitlement ceiling, not a unilateral mutation

The initial ceiling is the KST creation date plus 30 days. Each creator `DURATION_30D` grant adds
30 days and may repeat. Sending a DRAFT and creating an AMEND request both enforce the ceiling.
The partner still approves every actual date change. A valid creator permanent-access purchase
removes the business ceiling and permits a proposed `end_date = NULL`; a partner's personal
purchase never changes the shared duration ceiling.

`END_DATE_MAX_DAYS = 36500` is only a date-picker and validation safety ceiling. It is not the
business allowance and cannot bypass server entitlement checks.

When a send hits both limits, the slot gate (`E_SLOT_LIMIT`) is answered before the duration
ceiling (`E_END_DATE_RANGE`): a user is never asked to pay for a slot after already watching ads
for range. The reverse case (buy a slot, then be told the date is too far) is accepted; the editor
shows the current ceiling next to the date picker so it is rare. An AMEND request that keeps the
current `end_date` (including NULL = NULL) skips the ceiling, so a refunded creator purchase never
blocks body-only amendments of an already no-end promise.

### D3 — A no-end promise finishes by mutual agreement

Either party may create `amend_requests.type = FINISH` while a no-end promise is ACTIVE. The other
party approves or declines. Approval moves `AMEND_PENDING → CHECKING`; the server approval instant
is both `checking_started_at` and `retention_anchor_at`. Decline, requester withdrawal, or expiry
returns the promise to ACTIVE. The append-only actions are `FINISH_REQUEST`, `FINISH_APPROVE`,
`FINISH_DECLINE`, and `FINISH_WITHDRAW` (T-19…T-21).

### D4 — Retention is per participant and irreversible after expiry

Only ever-activated promises receive personal retention. A finite promise's anchor is the KST
instant immediately after `end_date`; CHECKING and DISPUTED do not move it. A no-end promise's
anchor is D3's finish-approval instant. Each JOINED participant gets 30 free days, may add 30 days
per `RETENTION_30D` reward, or may buy permanent access for that participant only.

At an individual's expiry the record disappears immediately for that individual and can no longer
be restored by an ad or purchase. Other participants keep independent access. When nobody has
finite or permanent access, the promise enters a two-phase purge: claim a lease, delete evidence
objects, then delete the relational record. Before deletion, keeper/result counts are transferred
to a de-identified per-user aggregate so keepRate is unchanged.

Unformed records are not purchasable retention: DRAFT expires after 90 days, PENDING 30 days after
the last invite expiry, and never-activated DECLINED/CANCELED 30 days after close. Records already
expired under the new formula receive a deployment-time 30-day grace.

### D5 — One consumable product has two role-sensitive effects

`promise_permanent_access` is a per-promise Google Play consumable with a ₩2,000 display fallback;
the store-localized price is authoritative. Any participant purchase grants personal permanent
access. Only an effective creator purchase also unlocks shared no-end proposals. Purchases bind
`obfuscatedExternalAccountId` to the user and `obfuscatedExternalProfileId` to the promise; the
server verifies both before granting, then the client consumes. Unconsumed purchases are recovered
when the benefit sheet reopens.

A voided purchase revokes personal permanent access and recalculates the finite fallback expiry.
It does not undo a no-end amendment or a finish agreement already approved by the counterpart.

### D6 — Reward grants are server-authoritative AdMob SSV

The server creates a 15-minute `reward_intents` row with an opaque user binding. The client passes
the opaque id and intent id through AdMob server-side verification fields. `reward-callback`
verifies Google's P-256 signature, allowed rewarded unit, transaction replay barrier, intent
binding, current role, state, and entitlement precondition before inserting an append-only grant.
The client `EARNED_REWARD` event grants nothing; it only starts status polling.

If the SDK cannot show a rewarded ad (flag off, no fill, consent declined, load timeout) the benefit
stays **locked** (PO 2026-08-29). There is no free fallback: the server cannot verify no-fill, so a
self-reported no-fill would be an unverifiable free grant reachable by anyone who calls the intent
endpoint. Where a product exists, the permanent-access purchase remains the only other path.
`rewarded_ads_enabled` controls intent issuance independently from exposure ads. The intent TTL is
compared with the signed SSV `timestamp`, not with callback arrival, so an AdMob retry after a
transient 5xx still settles; a missed TTL answers `{granted:false}` without consuming the intent.

### D7 — Exposure ads keep the trust boundary

The existing A02/A07/A08 bottom native ads stay. ACTIVE and WAITING tabs with at least six rows add
one adaptive banner after the fifth visual promise card, counting the ACTIVE hero. There is no
second banner. `ads_enabled=false`, SDK failure, or no fill renders no component and reserves no
space. Paid users are not ad-free.

P4 now distinguishes exposure from a user-requested benefit: banners/native ads remain forbidden
on creation, review, approval, confirmation, fulfillment, all modals, and the entire acceptance
web. A rewarded ad initiated by the user is allowed only for witness, duration, or personal
retention benefits in the Android app. The web contains neither ad nor payment code.

### D8 — Retention work is a fenced, idempotent worker

An hourly job emits participant-specific D-7 (`NT-22`) and D-1 (`NT-23`) warnings with deterministic
dedupe scopes, and queues promises whose last access ended. `retention-maintenance` uses a shared
secret, leases at most 50 purge jobs, deletes storage first, and finalizes only with the current
lease id. Re-running any stage is safe.

## Consequences

- Shared contracts add nullable end dates, FINISH amendment/actions, entitlement/reward response
  parsers, configuration constants, `E_END_DATE_RANGE`, reward errors, and T-19…T-21.
- Migration `20260829103504_rewarded_ads_retention_bm.sql` adds the server-only ledgers, access
  filters, purge queue, aggregate preservation, duration guards, witness capacity, finish RPCs,
  purchase grant/refund behavior, reminders, and hourly schedule.
- Edge Functions add `promise-entitlements`, reward intent/status/SSV endpoints, and the
  retention worker. `purchase-verify` now allowlists and binds the permanent product.
- Mobile adds rewarded and banner AdMob paths, witness and duration unlocks, personal retention UI,
  permanent purchase/recovery, no-end editing and finish agreement. The acceptance web displays
  nullable end dates and lets either party request or respond to FINISH without ads or payments.
- Operator work is required before release: three rewarded units, one banner unit, SSV callback,
  the Play product, Edge secrets, Vault worker URL/secret, migration deploy, and a new Android build.
