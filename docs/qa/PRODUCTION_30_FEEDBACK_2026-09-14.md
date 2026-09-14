# Production code 30 feedback verification

Date: 2026-09-14
Decision: ADR 0026, approved after cause review. Completion storage was explicitly changed by the PO from account scope to installation scope.

## Automated checks

- `npm test`: Vitest **122 files / 2,222 tests passed**, then Jest **94 suites / 966 tests passed**.
- After adding the screen-focus regression: `npm run test:mobile` → **94 suites / 967 tests passed**.
- `npm run typecheck`: all five projects, exit 0.
- `npm run check:agents`: `AGENTS.md 는 CLAUDE.md 와 동기화되어 있다.`
- `git diff --check`: exit 0.

Regression coverage includes today/yesterday and KST midnight, native date selection/cancel,
creation, draft update, same-day amendment approval, unchanged privilege guards, reminder
selection/close/save rollback, completion/restart/reinstall storage behavior, and screen focus.
The PGlite suites apply the new migration and execute real PostgreSQL functions and RLS.

## Native visual and interaction checks

Android API 36.1 emulator, 1080×2400 at 480 dpi (**360×800 dp**), font scales **1.0 / 1.5**.
The device uses UTC, deliberately different from the product's KST calendar.
Screens are the actual React Native source bundled in production mode into an isolated,
debug-signed fixture APK using the existing code-27 Expo 57/RN 0.86 native runtime. Backend,
router and monetization adapters are fixtures; SecureStore and the date picker are real native
modules. No production records, real invitations, payments or ads were used. This validates
native layout and client interaction, not a new production release or live backend deployment.

- Followed home → content → conditions → review → invite at both font scales. Only the
  highlighted target is actionable during each callout. A background menu tap and Android back
  left step 1 in place. Content/conditions guidance releases the form for genuine input.
- Verified empty text-field hints and receiving-language reward presets. Preset chips wrap
  without clipping at 1.5. The profile breakdown displays `못 지킴`.
- Verified the reminder sheet at both font scales: all three times, selected text, and a visible
  close icon. Closing did not alter the selected time; save and rollback are also covered by tests.
- Selected September 14 (KST today), advanced to review, and reached invite. The corrected native
  calendar exposes September 13 as `enabled=false` and September 14 as `enabled=true` on UTC.
- Completed guidance, force-stopped and relaunched: no tutorial. Uninstalled/reinstalled the fixture:
  step 1 returned. Expo SecureStore's Android backup/extraction XML excludes its preferences from
  cloud backups and device transfer, unlike ordinary AsyncStorage.
- Rounded spotlight masks were corrected during visual review. The local Metro override was
  restored byte-for-byte after fixture exports.

### Visual review evidence

Compared against the reported Android Alert/calendar screenshots and the approved Ink & Block
component grammar. The reminder window now uses the same paper surface, ink border, yellow
selection and close control as other app sheets. Text changes leave the existing components and
tokens intact. Tutorial rendering follows the supplied spotlight/callout interaction reference.

| Surface | Evidence |
|---|---|
| Tutorial home, 1.0 | [After reinstall](assets/production30-feedback-2026-09-14/tutorial-home-final1.png) |
| Tutorial, 1.5 | [Home](assets/production30-feedback-2026-09-14/tutorial-home15.png), [content](assets/production30-feedback-2026-09-14/tutorial-content15.png), [conditions](assets/production30-feedback-2026-09-14/tutorial-conditions15.png), [review](assets/production30-feedback-2026-09-14/tutorial-review15.png), [invite](assets/production30-feedback-2026-09-14/tutorial-invite15.png) |
| Reward text and manual hints, 1.5 | [Creation fields](assets/production30-feedback-2026-09-14/reward-copy15-final.png) |
| Profile breakdown | [1.0](assets/production30-feedback-2026-09-14/profile.png), [1.5](assets/production30-feedback-2026-09-14/profile15.png) |
| Reminder picker | [1.0](assets/production30-feedback-2026-09-14/reminder-1.png), [1.5](assets/production30-feedback-2026-09-14/reminder15-final.png) |
| Calendar | [Today enabled, yesterday disabled](assets/production30-feedback-2026-09-14/calendar-final.png) |
| Completed installation after restart | [No overlay](assets/production30-feedback-2026-09-14/final-completed-restart.png) |

## Release boundary

No production deployment, Play upload or new production AAB was performed. The existing 0.3.3 /
code-30 artifact is unchanged. Shipping the changes requires the migration
`20260914000001_allow_same_day_promises.sql`, redeployment of `promise-create`,
`promise-draft-update`, `promise-amend-request` and `promise-invite` (shared validation/error copy), and
a new Android production build. Use the existing release workflow; keep `supabase config push`
prohibited. Live physical-device acceptance and live server smoke checks remain release checks.

## Local evidence

Detailed command logs, XML captures and the fixture harness are under the gitignored
`.expo/feedback-qa/`. The fixture APK must never be distributed as a production build.
