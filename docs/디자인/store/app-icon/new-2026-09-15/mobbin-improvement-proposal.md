# Optional mascot layout improvements

Status: Awaiting PO confirmation. None of these changes is included in the authorized asset replacement.

## Scope already authorized

Replace the current mascot body, eyes, hands, launcher and splash with the PO-supplied identity. Keep existing layout footprints, UI tokens, copy, actions, status semantics and hand-loop behavior. Update the mobile, acceptance web and design reference consistently.

## References inspected through Mobbin MCP

- [Alan welcome](https://mobbin.com/screens/21080b03-a1f7-4113-8a57-b7dee60054d2): a large 3D character sits above a short greeting and a clearly separated login/subscription action group.
- [Evernote empty tasks](https://mobbin.com/screens/9e3fbaf7-2ec1-4505-9627-fa76cef34e92): a compact character illustration, title, explanatory sentence and nearby create action form one readable group.
- [Discord empty friends](https://mobbin.com/screens/6ed25b59-0b8e-4125-9a86-8260d0822797): the illustration and message occupy the middle, while a full-width action remains at the bottom.

These are layout references only. No third-party artwork, copy, colors or brand identity will be copied.

## Proposed changes requiring approval

| ID | Proposed change | Benefit | Boundaries and verification |
| --- | --- | --- | --- |
| M1 | Rebalance onboarding/login vertical spacing so the new 3D character and existing headline read as one group, with clearer space before the existing login buttons. | Makes the character feel intentional while keeping the login action easy to find. | Existing text, OAuth options and order stay. Use current spacing tokens. Compare 360 × 800 at font scales 1.0 and 1.5; buttons and notices must remain reachable. Inspired by Alan. |
| M2 | Reduce the visual gap between the empty-state character and its title/description, especially on home and history, while keeping the current primary action in its existing position. | Connects the friendly illustration to the explanation without duplicating actions. | No new CTA, copy, emotion, state or navigation. Use current tokens and preserve scrollability. Inspired by Evernote and Discord. |

## Recommendation

Consider M1 and M2 after reviewing the straightforward replacement. Implement only IDs explicitly approved by the PO. The approved asset replacement does not implicitly approve these spacing changes.

## Acceptance checks if approved

- Before/after screenshots at 360 dp with font scales 1.0/1.5; keyboard-visible login state where applicable.
- One clear action hierarchy, no clipped notices or controls, unchanged 48 dp touch targets.
- Same localized copy and behavior, no celebratory treatment of disputed or failed promises.
- Typecheck and affected screen/component tests.
