# M4 Mobile Accessibility Pass Implementation Plan

## Goal

Complete the spec-defined mobile accessibility pass without implementing J-07. The acceptance
boundary is limited to minimum 48x48 dp interaction targets, state communication that includes a
text label, and meaningful Android screen-reader semantics.

## Scope

- Preserve the existing 48 dp token floor across buttons, choices, pickers, switches, FABs, icon
  actions, cards, evidence controls, and modal close actions.
- Remove false interactive semantics from decorative or non-actionable content.
- Expose app-bar titles as headings, avatars as images, validation errors as live alerts, and picker
  selections as current accessibility values.
- Keep modal sheet actions independently focusable while hiding dismiss scrims from both iOS and
  Android accessibility trees.
- Verify that promise and notification states retain visible text labels in addition to color.
- Keep all user-facing accessibility names in existing label constants or component props.

## TDD Sequence

1. Add RED component and screen tests for the false login button, heading/image/value semantics,
   validation alert announcement, and Android-hidden modal scrims.
2. Implement the smallest semantic prop changes and keep every existing action and visual style
   unchanged.
3. Add passing audit coverage for the 48 dp primitives and state-label presentations; these are
   characterization checks and require no production rewrite when already compliant.
4. Run focused mobile tests, the complete repository regression, full typecheck, web production
   build, agent-doc synchronization, Expo dependency alignment, Android production export, and diff
   checks.
5. Exercise the updated Android accessibility tree on the connected 360x800 dp development client.
   Confirm that TalkBack is bound with touch exploration enabled, visible controls expose meaningful
   labels and selected state, and keyboard traversal produces a visible accessibility focus. Restore
   the emulator's accessibility settings after the check.

## Exclusions

- J-07 operational metrics or any automatic ad enablement.
- Web redesign, visual token changes, copy changes, and new product policy.
- Production AdMob identifiers, Play Console declarations, or remote deployment.
