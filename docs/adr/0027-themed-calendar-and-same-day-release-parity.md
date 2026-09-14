# ADR 0027: Themed calendar and same-day release parity

Status: Accepted by PO on 2026-09-14.

## Context

The PO's internal-test code 31 allowed KST today in the mobile calendar, but the
production Edge validation still required `daysFromToday >= 1` and three database
functions still rejected today. Sending a same-day promise returned a date-field
validation error and deliberately moved the editor back to Terms. This also affected
ordinary creation; the tutorial did not cause the server rejection. The server-dependent
limitation had been recorded in the code-31 handoff, but prevented full acceptance.

The remaining native Android date picker used its default teal theme, outside the
approved Ink & Block design. The PO approved deploying the prepared same-day server
change and replacing that picker after reviewing this diagnosis.

## Decision

- Deploy the existing `20260914000001_allow_same_day_promises` migration and the four
  affected Edge Functions. Keep yesterday invalid and preserve upper limits, benefits,
  authorization, transactions and status transitions.
- Replace the imperative native picker with a small application-owned request store
  and a single calendar host under the root locale provider. Existing creation and
  amendment callers keep the same `openEndDatePicker` signature.
- Render the calendar in `LfSheet`: paper surface, ink borders, yellow selection,
  month navigation, a Today shortcut, close/cancel and explicit confirmation. Day cells
  use the shared touch-size token; the calendar body scrolls at large font sizes.
- Compute calendar cells with UTC calendar arithmetic; the selectable lower bound
  remains KST today. Revalidate confirmation across midnight. Cancellation never
  changes the form, and route changes close the calendar.
- Keep field-specific error navigation, adding a persistent footer explanation so
  users understand why they returned to a previous step.

## Verification and delivery

Production rollback smoke verification created a same-day PENDING promise with an
invitation and rejected yesterday. All temporary users/records were rolled back.
Deployed validation and database guards were read back. Native visual evidence,
regression tests and the replacement AAB are recorded in the code-32 QA report.
Play upload, internal-test rollout, physical-device acceptance and promotion remain
PO-owned. No minimum-version or authentication settings are changed.
