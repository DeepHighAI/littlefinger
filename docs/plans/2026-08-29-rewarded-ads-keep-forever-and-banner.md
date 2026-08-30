# Plan — Rewarded benefits, permanent access, retention purge, and A02 banner

Date: 2026-08-29
Status: Implemented locally; operator deployment pending
Decision record: ADR 0015

## Confirmed scope

- Keep the existing 5 free promise slots and permanent `promise_slot_plus1` (+1, ₩1,000).
- Witnesses: creator free 1 + creator rewarded 1 + partner rewarded 1; max 3 per promise. A place
  returns to its inviter when the witness leaves. Existing witness counts are preserved.
- Duration: KST creation date +30 days free; creator rewarded ad +30 days, repeatable. An effective
  creator `promise_permanent_access` purchase permits a no-end proposal. Every actual ACTIVE change
  still needs counterpart approval.
- A no-end promise finishes only by one party's request and the other's approval. Approval enters
  CHECKING and becomes the retention anchor.
- Retention is personal for every JOINED participant of an ever-activated promise: 30 days free,
  rewarded +30 days, repeatable, or `promise_permanent_access` for personal permanent access.
  Finite promises anchor at the end-date boundary even in CHECKING/DISPUTED. Expired access
  disappears immediately and is never restorable.
- After the final participant access expires, purge evidence objects and the relational record;
  preserve only de-identified keepRate aggregates. Unformed TTLs: DRAFT 90 days, PENDING last
  invite expiry +30 days, never-activated DECLINED/CANCELED close +30 days. Existing expired
  activated records receive deployment +30-day grace.
- Refunds revoke personal permanent access and recompute fallback expiry. They never undo an
  already approved no-end amendment or finish agreement.
- Exposure ads: retain A02/A07/A08 bottom native ads; on A02 ACTIVE/WAITING tabs with >=6 rows,
  insert one banner after the fifth visual promise card, counting the hero. Paid users still see
  ads. `ads_enabled=false` and load/no-fill reserve no space.
- Rewarded ads are Android-only, user initiated, separately gated by `rewarded_ads_enabled`, and
  granted only through AdMob SSV. When an ad cannot be shown the benefit stays locked — there is
  no free fallback (PO 2026-08-29). The acceptance web has no ad or payment path.

## Implemented units

1. Shared contract: configuration, nullable end dates, FINISH actions/T-19…T-21, endpoint shapes,
   strict parsers, notifications NT-22/23, error codes, and localized catalogs.
2. Database: append-only reward/purchase ledgers, role-owned witness capacity, duration guards,
   participant access functions, permanent purchase/refund behavior, no-end finish RPCs, grace,
   warnings, lease-fenced purge, keepRate aggregate preservation, and home/detail access filters.
3. Edge: entitlement, reward intent/status/fallback/SSV, retention worker, permanent purchase
   verification, and function configuration.
4. Mobile: rewarded SDK path, witness unlock, duration/retention benefit sheet, permanent purchase
   and crash recovery, no-end editor/amendment/finish flow, retention status, and A02 banner.
5. Acceptance web: nullable/no-end date display plus symmetric FINISH request/approval/decline;
   no ad or payment path.
6. Documentation: 01 v1.3, 02 v1.2, ADR 0015, project rules/status, release configuration sample.

## Verification and release boundary

- Mandatory local gates: `npm run typecheck`, `npm test`, `npm run check:agents`.
- Screen changes require Android real-device visual QA; the native rewarded/IAP path additionally
  requires a Play-signed build and license tester.
- Deployment is intentionally not part of the local implementation. Operator steps are in
  `docs/setup/monetization-retention-release.md`.
