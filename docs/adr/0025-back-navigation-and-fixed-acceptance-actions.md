# ADR 0025: Home fallback and fixed acceptance actions

Date: 2026-09-10
Status: Accepted by PO

## Context

Public test 27 (0.3.2) found a dead back button after invitation acceptance,
clipped login notice copy on a Galaxy S25, and acceptance actions buried in promise
content while witness invitations occupied the fixed footer.

## Decisions

- App back/close actions return to the previous route when history exists and replace
  the route with `/home` otherwise. Apply this consistently to detail, fulfillment,
  creation, history, notifications, profile, nickname and blocked-user screens.
  Accepted invitations continue to replace their consumed review route.
- Login notice layout uses the available body width and gives the notice and its text an explicit full-width
  layout, avoiding intrinsic text measurement after display density changes. Keep the approved copy, font scale and design tokens.
- Initial invitation acceptance and its confirmation are outside the scrolling content.
  Amendment, cancellation and no-end-date finish responses occupy the detail footer,
  with decline beside acceptance at the default text scale. Expanded text scales stack
  the actions with acceptance first so translated labels retain usable width. Existing server permissions, confirmation steps,
  loading guards, errors and idempotency remain authoritative.
- Witness invitation moves below the detail participant list and still opens the
  existing witness sheet. The PO explicitly confirmed retaining this function in the
  body. It never occupies the fixed action footer.

## Scope and verification

This is a native interaction/layout correction; no backend contract, state transition,
legal copy, acceptance-web CSS or frozen reference asset changes are required.
See `docs/notes/public-test-27-followup.md` for executed checks and device limitations.
