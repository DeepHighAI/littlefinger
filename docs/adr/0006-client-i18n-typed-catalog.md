# ADR 0006 — Client i18n as typed ko/en catalogs, no library

- Status: Accepted
- Date: 2026-08-20
- Deciders: PO (대표)

## Context

The PO decided the MVP ships in Korean and English (2026-08-20): full client UI on both
surfaces, language resolved from the device/browser locale (non-Korean → English) with a
persisted manual toggle. Server-rendered copy — notification rows (written immutably into the
append-only `notifications` table before delivery) and error envelopes (shared by 48 Edge
Functions) — stays Korean in this phase; localizing it requires per-recipient language
resolution before fanout and an API envelope change, deferred as its own project.

The codebase already held ~800 Korean strings in label-constant objects (8 mobile
`*-labels.ts` files, per-file consts on web, shared label maps in `packages/shared`), with no
locale infrastructure of any kind.

## Decision

No i18n library. A typed catalog convention built on two shared primitives in
`packages/shared/src/i18n.ts`:

- `type Locale = 'ko' | 'en'` and `Localized<T> = Readonly<Record<Locale, T>>`.
- Catalog files keep the existing label-object shape and add the pair:
  `const ko = {…}; const en = {…} satisfies typeof ko; export const X_LABEL: Localized<typeof ko> = { ko, en };`
- Message values are plain strings or **arrow functions** — Korean particles (님, 명, 일) and
  English word order/plurals live inside each locale's function body, which no string-template
  scheme can express in one shape.
- Screens resolve with one line: `const L = useLabels(X_LABEL)`. Providers:
  `apps/mobile/src/lib/locale-native.tsx` (expo-localization + AsyncStorage `littlefinger.locale.v1`)
  and `apps/web/src/lib/locale.tsx` (navigator.languages + localStorage, sets `<html lang>`).
  Non-React call sites use `getCurrentLocale()`; pure modules take `locale` as a parameter with
  default `'ko'` so server callers never change.
- Shared maps gained `*_BY_LOCALE` pairs whose `ko` is the **same object** as the existing
  constant — Edge Functions and the verbatim-disclaimer test are untouched.
- Detection is gated by `LOCALE_DETECTION_ENABLED` in shared `i18n.ts`, kept `false` until every
  catalog was converted, so intermediate commits rendered byte-identical Korean. **Flipped to `true`
  on 2026-08-20** once both surfaces were converted and their parity guards passed; it now exists
  only as the single switch that forces Korean everywhere again.

## Why not i18next / react-i18next

String keys erase the compile-time safety the label objects already have; ICU templates cannot
carry the Korean-particle logic that arrow functions carry today; it adds a runtime dependency
to three bundles including Hermes (with known Intl gaps); and `satisfies typeof ko` gives ko/en
key-and-arity parity at `tsc` time, which is stronger than any runtime missing-key warning.
Registry-driven tests (`catalogKeyPaths`) add structural parity as a second net.

## Consequences

- `LEGAL_DISCLAIMER` ko stays verbatim-immutable; `LEGAL_DISCLAIMER_BY_LOCALE.en` and the
  English legal document texts are **drafts pending legal review** and change only through it.
- Times remain KST on every locale (EC-F09) — only the display language changes.
- Notification inbox rows and server error envelopes render Korean even in the English UI in
  this phase; phase 2 owns them.
- The Play Store listing name and other store metadata are localized in the store console, not
  in code.
