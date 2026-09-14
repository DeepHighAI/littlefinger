# ADR 0026: First promise tutorial and same-day promises

Date: 2026-09-14
Status: Accepted by PO after cause review

## Decision

- Reward presets use `스벅 얻어먹기` and `올영 선물 받기`. Penalty presets and saved promise contents remain unchanged.
- Empty title, body, reward and penalty fields in the creation wizard display `직접 입력 하기`, with an English equivalent.
- The profile keepRate breakdown uses `못 지킴`; status constants, other status labels and keepRate calculations are unchanged.
- First-use guidance highlights a single target with a dimmed backdrop, a pointer and a five-step localized callout: create, enter content, set conditions, review, invite. Content and conditions callouts introduce the editable section; tapping it releases the form for real input. Review requires the user's own submit action; the final invitation explanation does not send a message.
- Completion belongs to the installation, not the account. Android SecureStore is already excluded from backups by the Expo plugin, so the small completion marker survives app restarts but disappears on uninstall/reinstall. An interrupted tutorial is not marked complete. A first encounter with this tutorial version is eligible, including an existing account on a fresh installation.
- The reminder-hour picker uses the existing Ink & Block sheet, three choices, selected-state text and an explicit close control. It replaces an Android Alert whose fourth button was silently discarded.
- Creation, draft update and amendment requests accept KST today as the minimum date. Approval continues to reject a date that has become yesterday. Duration entitlements, upper bounds, state transitions and next-day fulfillment checks remain unchanged. Past reminder times are not sent retroactively.

## Implementation boundaries

No account fields or tutorial server calls are added. Native calendar selection, shared validation, Edge Function error copy and the three database validation guards change together. A migration changes only the lower-bound expressions in the existing function definitions, preserving ownership, grants and all transaction guards; it fails if an expected expression is missing.

## Verification

See `docs/qa/PRODUCTION_30_FEEDBACK_2026-09-14.md` for commands, native fixture screenshots and deployment status.
