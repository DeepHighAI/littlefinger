# ADR 0001 — Implement the "Pinky" design system as framework-free HTML/CSS

- Status: Accepted
- Date: 2026-07-25
- Supersedes: —

## Context

The design round in Claude Design (`리틀핑거 모바일 UI 컨셉안`) produced four concepts and
concluded with concept **1d "핑키"** being selected. The follow-up turn expanded that concept
into the full screen inventory of 디자인요청서 v1.0 §5, including all SCR-A05 state variants
and the three key flows. The export is `design/concept-4.html`.

That file is a design canvas, not usable application code:

- every element carries inline styles, so there is no token or component layer
- screens are wrapped in `<x-import component-from-global-scope="AndroidDevice">` and
  `<sc-if>` elements that only the Claude Design runtime understands
- it is a single 202 KB document containing two rounds of history side by side

Meanwhile the app framework is explicitly **not decided**. 상위기획서 v1.1 lists it as open
point **N-3** ("크로스플랫폼 프레임워크 확정 — Flutter 우선 검토, 03_AI-Agent_코딩가이드에서 확정"),
and that coding-guide document does not exist yet. The repository contained only planning
documents when this work started.

## Decision

Implement the approved design as a **framework-free HTML/CSS screen library** with a real
token and component layer, rather than scaffolding an app in a framework that has not been chosen.

Structure:

- `src/styles/tokens.css` — the Pinky palette, type scale, shape, spacing and motion tokens,
  keeping Material 3 role structure but rebranded to the rose used by concept 1d
- `src/styles/components.css` — the shared `lf-*` component classes every screen composes from
- `src/screens/{app,web}/` — one file per screen, semantic markup, no inline styles
- `src/types/promise.ts` — the domain contracts (states, roles, labels, policy constants)
- `index.html` / `docs/flows.html` — screen gallery and flow diagram

## Consequences

Good:

- N-3 stays genuinely open. Nothing here presumes Flutter, React Native, or Next.js.
- The token and component layer is the part that survives any framework choice — porting means
  re-expressing `components.css` in the target widget system, with token values carried across verbatim.
- The 수락용 웹 surface (SCR-W01–W06) is specified as a lightweight standalone web app in
  상위기획서 §기술 방향. For that surface this implementation is close to shippable, not a throwaway.
- Screens are reviewable in a browser at the real 360×800dp viewport, so design regressions are visible.
- Fixed policy text (the legal disclaimer, §9 status labels) lives in one place as constants.

Costs / risks:

- There is no component runtime, so shared chrome (app bar, browser bar) is duplicated as markup
  across screen files rather than being a single component. Accepted: at 27 screens the duplication
  is legible, and it disappears at port time.
- The screens are static. Interactive prototypes (tab switching, sheet open/close, form state) are
  not implemented.
- When N-3 lands, this becomes a visual reference rather than production app code for the Android
  surface. That cost is deliberate and smaller than building the wrong app twice.

## Alternatives considered

**Scaffold a Flutter app now.** Rejected: 상위기획서 only says Flutter is the preferred candidate
to *evaluate*, and picks the framework in a document not yet written. Choosing it here would
quietly close an open decision that the PO reserved.

**Commit the exported canvas as-is.** Rejected: it carries no token layer, cannot be maintained,
and mixes two design rounds in one file. It is kept under `design/` as the read-only source of truth.

**Wait for N-3 before implementing anything.** Rejected: the token system, the domain contracts,
and the accept-web surface are all needed regardless of which framework wins, and the design
decisions are fresh now.
