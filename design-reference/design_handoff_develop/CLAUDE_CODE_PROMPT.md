# Implementation brief — Soft Promise → Quiet Record, palette A

Implement the approved mobile refresh in `apps/mobile` after reading, in order:

1. repository `CLAUDE.md`, `DESIGN.md`, and higher-ranked product specs;
2. this folder’s `README.md`;
3. the four `screens/app/*.html` references and `styles/components-b.css`;
4. existing token, `Lf*`, state-presentation, autosave, and screen-test patterns.

Reconstruct the reference with existing React Native components; do not port the DOM. Preserve all
domain data, API, transition, validation, draft-autosave, permission, notification, witness,
fulfilment, legal-copy, and ad-policy behaviour. Do not add dependencies.

Required implementation:

- mirror the complete A role palette from `DESIGN.md` across canonical CSS, mobile, web, and this
  bundle: Pine for identity/progress/approval, Action for filled CTA, Record Blue for durable
  information, Apricot for deadline/response attention, red only for danger, and neutrals for the
  majority of the interface;
- add `LfBottomNav`, `LfHero`, `LfTrustRing`, `LfWizardProgress`, `LfHelper`, `LfTrustStrip`,
  `LfPromiseSeam`, and semantic `LfCard variant="record"`;
- make home a neutral surface with a de-duplicated Mint hero, Apricot response cue, Blue record
  entry, and ADR 0008 rows;
- move the complete filter/list behaviour to pushed `/promises` without bottom navigation;
- split the existing editor into Content, Conditions, and Review without creating a second draft;
- map all 11 detail statuses to friendly, record, or terminal-neutral presentation while preserving
  all actions and keeping DISPUTED perfectly symmetric;
- make Profile neutral except for the Mint trust hero; use Blue for ordinary settings information,
  keep only real push settings, and add no email row;
- add Korean and English copy together in typed catalogs.

Verification is part of the implementation: focused tests per unit, full `npm test`, full
`npm run typecheck`, 360×800 Korean/English visual comparison at font scale 1.0/1.5 and both Android
navigation modes, reduced-motion checks, then `npm run check:agents`. Never report completion
without actual command output.
