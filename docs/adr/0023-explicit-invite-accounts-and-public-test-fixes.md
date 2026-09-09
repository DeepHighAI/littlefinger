# ADR 0023 — Explicit invitation accounts and public-test corrections

- Status: Accepted
- Date: 2026-09-09
- Decider: PO

## Context

Public testing reported missing invitations after Google login, spaces disappearing during
fulfillment input, Kakao branding on generic sharing, email-shaped participant names, and a
keyboard obscuring amendment reasons. The PO approved the diagnosis and implementation, and
explicitly required recipients to choose which account reviews and accepts an invitation.

## Decision

- Remove unsolicited Kakao OAuth from the invitation landing. Both providers remain explicit
  choices. Existing authenticated recipients confirm the provider and their stored public nickname
  before partner review or witness joining. Account changes invalidate that confirmation; each
  invitation has a fresh confirmation. Google selection inside Kakao's embedded browser explains
  how to reopen the same invitation in a regular browser because Google blocks embedded OAuth.
- Retain invitation/detail destinations in memory across onboarding and OAuth callbacks; do not
  persist raw invitation tokens in a new storage location. Account confirmation does not merge
  identities or change existing approvals/participants.
- Preserve raw fulfillment text during IME editing. Normalize only for validation and submission.
- Protect custom nicknames in the database. Reject email-shaped public nicknames, skip such OAuth
  names, and backfill affected existing public names from a safe provider name or `사용자`.
- Use the ordinary yellow share CTA and `share` icon for both invitation buttons. Replace the
  messenger-shaped preview with the existing flat-card grammar. Update Korean and English sharing
  copy. Authentication provider marks remain meaningful login labels.
- Give the amendment/cancellation sheet its own keyboard-aware scroll inset and focused-input
  reveal, covering title, body, reward, penalty, and reason.

## Verification and rollout

Regression coverage includes provider choice, account confirmation and changes, stale session
responses, deep-link restoration, IME spaces, and database nickname boundaries. Visual verification
uses the 360 dp viewport and font scales 1.0/1.5. Results are recorded in DEVELOPMENT_STATUS.md.

The database migration and app/web changes must ship together. Existing approvals are immutable;
this change does not transfer a promise previously accepted by a different user to a Google account.
