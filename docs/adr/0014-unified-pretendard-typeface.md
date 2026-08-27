# 0014. Unified Pretendard typeface

Date: 2026-08-27
Status: Accepted (PO-confirmed, 2026-08-27)
Supersedes: the typography portion of ADR 0012

## Context

The first Ink & Sticker implementation used Gaegu for the product face and Roboto Mono for record
strings. Real-device internal testing exposed inconsistent glyph shapes and fallback behaviour
across Korean and English copy. The split also required separate font packages, weight convergence,
and role-specific exceptions in three targets.

The PO chose consistency and maintainability over a separate display face: Korean and English must
use Pretendard everywhere, including headings, navigation labels, body copy, metadata,
fingerprints, timers, and decorative intro lines.

## Decision

1. **One text family:** every user-visible text role uses Pretendard. The `brand` and legacy `mono`
   tokens remain for API compatibility but both resolve to the same Pretendard stack.
2. **One weight contract:** regular = 400, medium = 600, bold = 700, heavy = 800.
3. **Platform loading:** React Native loads the existing Pretendard Regular, SemiBold, Bold, and
   ExtraBold static TTF files. The acceptance web and frozen reference use the self-hosted
   Pretendard Variable WOFF2. Material Symbols remains an icon font and is not user text.
4. **Dependency removal:** Gaegu and Roboto Mono packages and entry-point imports are removed.
5. **Regression lock:** tests require Pretendard for both font tokens, pin the four mobile files and
   mappings, and reject the removed packages from mobile and web manifests.

## Consequences

- Korean and English now share glyph metrics and weight semantics across every screen.
- The visual system keeps Ink & Sticker colour, shape, border, shadow, and illustration rules; only
  typography is superseded from ADR 0012.
- The former typewriter and monospaced record treatments keep their size, spacing, and colour roles
  but no longer change families.
- A new signed Android bundle is required because embedded font assets changed.
