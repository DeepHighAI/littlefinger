# 0011. Creation-flow guidance, optional category, history screen, red errors

Date: 2026-08-26
Status: Accepted

## Context

Four PO decisions from internal-test device QA (2026-08-26), each confirmed via structured
questions before implementation. Two of them amend spec stances (`02` §2-3 / §5-1 / §3·F-10).

## Decisions

### D1 — Never block a form silently (SCR-A03)

The spec's original stance — "no invented copy → disable the CTA" (§2-3) — produced dead buttons
and silent no-ops for rules that §5 gave no wording (empty category, out-of-range end date). Now:
CTAs stay enabled; an invalid press marks every field touched (waking the inline §5 messages),
jumps to the first invalid field's wizard step, and shows a one-line red summary
(`필드 — 문구`, falling back to a generic `입력 내용을 확인해 주세요.` where §5 has none).
`PromiseDraftValidation` gains `invalidFields` because message-less failures never appear in
`fields`. §5 wording stays authoritative where it exists.

### D2 — Category is optional; unselected saves as `ETC` (§5-1 row 3 amendment)

The enum already had `ETC`(기타), so the default lives entirely client-side
(`submitPromiseDraft` maps `'' → 'ETC'`): DB NOT NULL, `lf_assert_promise_content`, the content
hash and every integrity job are untouched. The review step shows `기타` for an unselected
category — the screen must not display 없음 and then record 기타.

### D3 — Home = 진행·대기 tabs; terminal promises move to SCR-A09 (§3·F-10 amendment)

Home keeps two tabs (ACTIVE·WAITING — WAITING hosts drafts with the delete affordance) plus a
"지난 약속 히스토리 보기" entry. The new SCR-A09 splits the six terminal statuses into **four**
tabs: 완료(DONE=[COMPLETED]) · 불이행(BROKEN=[BROKEN]) · 협의 중단(UNSETTLED=[DISPUTED,
UNRESOLVED]) · 거절·파기(DECLINED=[DECLINED, CANCELED]). The PO originally asked for three
(완료/미완료/거절); the four-way split was chosen because folding 의견 불일치 into "미완료" is a
verdict — P1 forbids it. The 전체 약속 screen (`/promises`) is removed: its role is fully covered
by the home tabs + history.

**Compatibility invariant:** installed builds parse `counts` as an exact
`{ACTIVE, WAITING, COMPLETED}` record and still request the legacy `COMPLETED` tab. So
`lf_promise_home_list` (migration `20260826000001`, deployed) keeps every legacy response
byte-compatible and returns the four-key history counts only for history-tab requests; the
client parser validates counts per tab family, and the reducer merges count families instead of
replacing. The shell's request validator sources its tab vocabulary from `packages/shared`
(copying it is what let the first deploy reject history tabs with 422 — same lesson as the
error-code table).

### D4 — In-app error copy is red (`error` token)

New closed `LfText` variant `error` (#CA1D13, caption scale); every inline error/failure line
(~25 sites across 13 screens/sheets) moved off the muted gray. OS `Alert` dialogs are
system-rendered and cannot be styled — the PO confirmed the in-app scope. State is still never
color-only (§8-7): these are sentences, not indicators.

## Consequences

- Spec amendments dated in `02`: §5-1 row 3 (category), §3 screen table SCR-A09 row, F-10 tabs.
  SCR-A09 is a sanctioned new screen ID (MOD-04 precedent).
- Design reference: `scr-a02-home(.., -empty).html` now show two tabs + the history entry;
  new `scr-a09-history.html` joined the gallery.
- Server deployed 2026-08-26: migration `20260826000001_history_tabs.sql` +
  `promise-home-list` redeploy. Live smoke: legacy tabs byte-identical, history tabs 200 with
  four-key counts and P1-correct bucketing.
- The pending versionCode-5 AAB (purchase auto-resume only) was superseded; the next production
  build carries this batch plus the auto-resume fix.
