# 0009. Paid promise slots and expanded ad placements

Date: 2026-08-25 (decisions 2026-08-24 · 2026-08-25)
Status: Accepted

## Context

The PO requested monetization beyond the single F-12 ad slot (2026-08-24): a freemium cap on
promises — 5 free slots, each additional slot a permanent +1 purchased for ₩1,000 via Google Play
in-app purchase — and wider ad exposure. Neither `01` nor `02` anticipated paid features, so every
policy choice here is a PO decision recorded as a spec amendment, not an interpretation.

## Decisions

### D1 — Slot semantics: in-progress promises I created (PO 2026-08-24)

`used` counts promises where I am the **creator** and the status is in-progress per §4-1-4
(`PENDING · ACTIVE · AMEND_PENDING · CHECKING`). Terminal states return the slot. DRAFT is excluded
— the EC-H05 DRAFT-20 cap keeps that role. The accepting partner never consumes a slot.
`capacity = FREE_PROMISE_SLOTS(5) + Σ granted_slots` from purchases that have not been voided.
Completed purchases persist, while refunded or charged-back purchases lose their slot entitlement.

Enforcement lives in **one place**: `lf_invite_issue_row` (the T-02 body), because all three send
entry points (`lf_promise_create` send branch, `lf_promise_invite`, `lf_promise_draft_update` send
branch) pass through it. Only the DRAFT → PENDING transition consumes; a resend (PENDING → PENDING)
never re-checks — the promise already stands on its own slot.

### D2 — Error contract: 15th code `E_SLOT_LIMIT`, HTTP 402 (spec §2-3 amendment)

A capped send raises `E_SLOT_LIMIT` rather than `E_RATE_LIMIT`: the two limits have different
exits (waiting vs. paying), and the client opens the purchase sheet on this code. The message
carries no number — capacity varies per user, so a hardcoded "5" would lie to purchasers.

### D3 — Error priority: content validation before the slot gate (PO 2026-08-25)

At capacity with invalid content, the server answers `E_VALIDATION` first and `E_SLOT_LIMIT` only
once the promise is sendable. Checking slots first would show a purchase sheet for a promise that
still cannot be sent after paying — a "paid but still blocked" trap the trust principles (§8)
cannot tolerate.

### D4 — Lock ordering invariant (Codex red-team P1, 2026-08-25)

The per-user slot advisory lock (`lf_slot_lock`, key `lf_slot:<user_id>`) serializes
count-vs-commit races. Codex found a deadlock: draft-update locked promise rows **before** entering
T-02 (row → advisory), while invite acquired advisory → row. The invariant is now: **the slot
advisory lock is acquired before any promises/promise_versions/invitations row lock** — the two
send entry points pre-acquire `lf_slot_lock` right after their idempotency claim, and the guard's
re-acquisition inside the same transaction is a no-op. The idempotency row cannot cycle with the
advisory lock because its key is (key, user, endpoint)-scoped.

### D5 — Server-authoritative purchases, client receipts untrusted

`purchase-verify` (Edge Function) is the only grant path: JWT → product-id allowlist
(`promise_slot_plus1`) → Google Play Developer API `purchases.products.get` (service-account RS256
JWT OAuth via WebCrypto, no SDK) → require `purchaseState = 0`, an `orderId`, and
`obfuscatedExternalAccountId` equal to the caller (blocks cross-account token replay; the client
sets `obfuscatedAccountId = user.id` at purchase time). All four receipt failures return the same
`E_VALIDATION` so a forger gets no progress meter; Google-side failures flatten to the standard
500. `lf_slot_grant` is idempotent on `order_id`; `purchase_token` is unique as the last barrier
against cross-account reuse, and a foreign `order_id` replay raises `E_VALIDATION` explicitly.

Order of operations on the client is the crash-safety contract: **verify (server 200) → then
consume**. An interrupted purchase stays unconsumed and `reconcileSlotPurchases()` re-verifies and
consumes it on the next paywall open — double grants are impossible (order-id idempotency), and an
unverifiable purchase is never consumed (consuming would settle the payment with no slot).

`purchase_token` is stored as-is: §8-8's hash-only rule covers invite tokens/IP/UA; a Play token is
needed in the original for refund reconciliation and is not personal data. The
`GOOGLE_PLAY_SERVICE_ACCOUNT` key JSON lives only in Supabase Secrets (`.env.example` forbidden
list + `.gitignore` patterns added).

`purchase-reconcile` runs daily against Google Play's Voided Purchases API with an overlapping
**29**-day window. 30 is what the API accepts and therefore what the first implementation sent, but
a `startTime` of exactly `now - 30 days` is already outside the window by the time Google evaluates
it — measured live 2026-08-28, where 30 failed the whole call and 29 returned 200. Backing off one
day costs nothing because the ledger's primary key absorbs the overlap.
`slot_purchase_revocations.purchase_id` makes the overlap idempotent; capacity
excludes a purchase as soon as its revocation is recorded. Existing promises are never deleted or
rewritten if capacity falls below usage — the next send stays blocked until usage drops or another
valid slot is purchased.

### D6 — Ad placements expanded to A02 + A07 + A08 (PO 2026-08-24, F-12/§3 amendment)

One native-ad slot at the bottom of 홈(SCR-A02), 알림함(SCR-A07), and 프로필(SCR-A08). The P4
forbidden zones are unchanged (creation/invite/detail/fulfillment/modals/entire acceptance web).
All three placements share the single remote `ads_enabled` flag and — for now — one native ad unit
id; per-placement units can come later without code shape changes. `ads_enabled=false` still means
the component does not render at all.

## Consequences

- New table `slot_purchases` (append-only; select-own RLS; active-account restrictive boundary;
  table grants pinned to `authenticated:SELECT` only) and functions `lf_free_promise_slots`,
  `lf_slot_lock`, `lf_slot_used`, `lf_slot_capacity`, `lf_slot_status`, `lf_slot_grant`,
  `lf_assert_slot_available` — all server-only via the three-way revoke, asserted by a
  privilege-baseline test. Migration: `20260824000001_paid_promise_slots.sql` (deployed
  2026-08-25).
- New Edge Functions `slot-status` and `purchase-verify` (deployed; `purchase-verify` boots only
  once `GOOGLE_PLAY_SERVICE_ACCOUNT` is set).
- Refund reconciliation adds the append-only `slot_purchase_revocations` ledger and internal
  `purchase-reconcile` worker. The migration schedules it daily; its URL and shared secret live in
  Vault, and `verify_jwt=false` is paired with constant-time header authentication.
- Shared contract: `FREE_PROMISE_SLOTS`, `SLOT_PRODUCT_ID`, `SLOT_PRICE_KRW_DEFAULT` (display
  fallback only — the store's localized price is authoritative), `SlotStatusResponse` +
  `asSlotStatusResponse`, `ENDPOINT.slotStatus/purchaseVerify`.
- Mobile: `expo-iap` (the Expo-official successor to react-native-iap) — a new dev-client build is
  required before device QA; `slot-paywall-sheet` opens on `E_SLOT_LIMIT` from both send screens
  and from the profile slot row.
- Purchase E2E is only possible on a Play-signed build with license testers; local coverage is
  deps-mocked plus the PGlite contract tests.
- Play Console prerequisites (operator): merchant account, in-app product `promise_slot_plus1`
  (managed/consumable, ₩1,000), license testers, GCP service account linked under Play Console →
  API access.
- Design reference (PO-approved previews, 2026-08-25): `scr-a08-profile.html` was brought back in
  line with the shipped RN profile (the stale email-reminder row — a §6-1 violation — removed;
  slot row, language toggle, four reminder toggles + send hour, split terms/privacy rows, block
  list, logout/withdraw, ad marker added), and `mod-04-slot-paywall.html` was created as the
  approved baseline for the purchase sheet. A07/A08 also carry the disabled ad marker.
