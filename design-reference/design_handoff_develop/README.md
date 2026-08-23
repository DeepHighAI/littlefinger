# Design handoff: Soft Promise → Quiet Record

This bundle is the approved visual reference for the 2026-08-23 mobile refresh. It supersedes the
earlier “B green dashboard” and single-green palette notes inside this folder. The permanent design
contract is the repository root `DESIGN.md`; product policy and accessibility constraints still
outrank this bundle.

## Scope

- SCR-A02 home plus the pushed `/promises` list
- SCR-A03 three-step promise editor
- SCR-A05 detail across all 11 statuses
- SCR-A08 profile
- Layout scope is mobile-only. The approved A colour roles are mirrored to the acceptance web;
  backend, database, state-transition, validation, and dependencies do not change.

The four HTML screens are 360×800 design references, not production DOM. CSS px maps 1:1 to React
Native dp. Production uses existing `Lf*` components and static Pretendard weights.

## Visual modes

| Mode | Status or surface | Treatment |
|---|---|---|
| Soft Promise | Home, create, DRAFT, PENDING | Neutral canvas, Mint promise surfaces, asymmetric 28/28/28/12 hero |
| Quiet Record | ACTIVE, AMEND_PENDING, CHECKING, COMPLETED, BROKEN, DISPUTED, UNRESOLVED, CANCELED | Neutral canvas, Blue Soft record surfaces, symmetric structure |
| Terminal neutral | DECLINED | Neutral canvas without celebratory or blame cues |
| Trust emphasis | Profile | Neutral canvas; only the trust-rate hero is green |

DISPUTED claims use identical size, colour, order weight, and icon treatment. Record surfaces must
not resemble contracts, stamps, certificates, or court documents.

## Locked values

The refresh adds hero radius 28, hero tail 12, record radius 16, hero D-day 46/50 at weight 800,
bottom navigation content height 64, centre create button 52, 26dp navigation/app-bar icons, a
soft action fill, and a warm-ivory action symbol. Screen gutter remains 16 and the existing 4dp
spacing rhythm remains authoritative. Weight 800 is reserved for D-day and confirmed-record
headlines; titles use 700 and body/meta text uses 400 or 600.

The approved A palette is **Pine Anchor · Warm Promise · Blue Record**:

| Role | Value | Meaning |
|---|---:|---|
| Pine | `#0B6B4B` | Brand, progress, selection, approval |
| Mint | `#E7F4ED` | Promise and confirmation surfaces |
| Action / pressed / ink | `#78CEA5` / `#62BF92` / `#12382B` | Filled primary action |
| Record blue / soft | `#466FA8` / `#EAF1FB` | Durable record, information, unread state |
| Attention / ink | `#FFF1E6` / `#B86A24` | Deadline, response, checking, amendment |
| Canvas / ink | `#F7F8F6` / `#191C1B` | Neutral page and primary text |
| Danger / soft | `#C4433B` / `#FCECEA` | Error, destructive action, failure only |

Aim for neutral 70%, green 18%, blue 9%, and attention/danger 3%. Filled buttons and the centre
create action use Action, never Pine. Urgent chips use Apricot. Confirmed metadata and information
use Record Blue. State, progress, and approval keep Pine so the softer action treatment does not
weaken meaning.

The bottom safe-area inset is added outside the 64dp navigation content. All actions are at least
48dp. Motion uses existing emphasized easing: wizard transitions 240ms; trust ring and Promise Seam
400ms. Reduced-motion users get no slide and an immediate or short-fade record seam.

## Screen contracts

### Home

- State-neutral greeting; never infer how many promises are “on track”.
- One eligible promise becomes the hero and is removed from the rows below.
- Ordinary promises remain full-bleed rows with hairlines (ADR 0008). Only the hero and
  response-required item use explicit containers.
- App bar has the notification action; no status filters or legacy FAB.
- “View all” pushes `/promises`, which owns filter/count/sort/pagination/refresh/draft deletion.
- The trust strip enters Profile. When ads are disabled, no ad component or reserved space exists.

### Create

One draft and the existing autosave/submission contract are preserved. The local wizard is:
1. Content — title, body, category.
2. Conditions — end date, keeper, reward, penalty.
3. Review — witness setting, complete summary, per-section edit links, send to partner.

Next validates only the current step. Final submit runs the existing complete validation and
sensitive-number confirmation. Back moves 3→2→1; closing step 1 flushes autosave before exit.
Server field errors return to the owning step.

### Detail

Visual mode is a pure status mapping. A Promise Seam mounts once only when the current version has
`activated_at`. It brings two quiet lines toward the existing `LfPinky` over 400ms, with no bounce,
loop, confetti, or celebration. Approval time, both approvals, and record fingerprint form one
structured record. Actions, permissions, notifications, versions, witnesses, fulfilment logic, and
the immutable `LfDisclaimer` remain unchanged.

### Profile

Neutral canvas with one green trust hero and `LfTrustRing`. Keep real push-reminder settings
(D-7/D-3/D-1/D-day and time), language, legal information, blocked users, logout, and withdrawal.
Do not add email reminders.

## Files and RN mapping

| Reference | Production |
|---|---|
| `.lf-bottomnav*` | `LfBottomNav` |
| `.lf-hero*` | `LfHero` |
| `.lf-ring-b*` | `LfTrustRing` |
| `.lf-wizard-progress*` | `LfWizardProgress` |
| `.lf-helper` | `LfHelper` |
| `.lf-trust-strip*` | `LfTrustStrip` |
| `.lf-promise-seam*` | `LfPromiseSeam` |
| `.lf-record` | `LfCard variant="record"` |

All new Korean and English copy belongs in typed `Localized<T>` catalogs. The legal disclaimer is
verbatim-immutable in both locales.
