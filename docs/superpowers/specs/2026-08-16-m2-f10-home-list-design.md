# M2 F-10 Home List Design

## Goal

Complete SCR-A02 as the account-based promise home: three independently paged tabs, an ACTIVE-tab-only imminent section, complete card metadata, pull-to-refresh, and the already available routes to SCR-A03, SCR-A04, and SCR-A06. SCR-A05 remains the next project.

## Confirmed Product Decisions

- Each tab owns an independent 20-row cursor, loaded pages, loading state, and error state. Switching tabs preserves that state.
- Only the selected tab refreshes. Refreshing ACTIVE also refreshes its pinned section and all tab counts.
- The pinned section appears only above the ACTIVE tab. Pinned promises do not also appear in the ordinary list, and pinned rows do not consume the 20-row page limit.
- DRAFT opens SCR-A03, PENDING opens SCR-A04, and CHECKING opens SCR-A06.
- ACTIVE, AMEND_PENDING, and terminal cards are read-only until SCR-A05 is implemented.

## Public Contract

`packages/shared` owns the following wire contract:

```ts
type PromiseHomeTab = 'ACTIVE' | 'WAITING' | 'COMPLETED';
type PromiseHomeCursor =
  | { tab: 'ACTIVE'; status_rank: number; end_date: IsoDate; promise_id: string }
  | { tab: 'WAITING'; updated_at: IsoDateTime; promise_id: string }
  | {
      tab: 'COMPLETED';
      closed_at: IsoDateTime | null;
      updated_at: IsoDateTime;
      promise_id: string;
    };

interface PromiseHomePerson {
  nickname: string;
  profile_image_url: string | null;
}

interface PromiseHomeCard {
  promise_id: string;
  title: string;
  status: PromiseStatus;
  end_date: IsoDate | null;
  updated_at: IsoDateTime;
  closed_at: IsoDateTime | null;
  my_role: ParticipantRole;
  creator: PromiseHomePerson;
  partner: PromiseHomePerson | null;
  has_witness: boolean;
  needs_response: boolean;
}

interface PromiseHomeListRequest {
  tab: PromiseHomeTab;
  cursor?: PromiseHomeCursor;
}

interface PromiseHomeListResponse {
  items: readonly PromiseHomeCard[];
  pinned: readonly PromiseHomeCard[];
  counts: Record<PromiseHomeTab, number>;
  next_cursor: PromiseHomeCursor | null;
}
```

The endpoint slug is `promise-home-list`. `PROMISE_HOME_PAGE_SIZE` is 20 and the existing `IMMINENT_THRESHOLD_DAYS` remains 3.

## Server Design

`lf_promise_home_list` is a `SECURITY DEFINER` RPC with an empty `search_path`, service-role-only execution, and an explicit actor UUID from the verified JWT. Its trailing `p_now timestamptz default now()` parameter exists only for deterministic KST boundary tests; the Edge Function never supplies it. It is the only home read path.

The RPC includes promises where the actor has a matching joined participant row. DRAFT and PENDING require the actor to be the creator; the other tabs include joined CREATOR, PARTNER, and WITNESS roles. Rows hidden by the actor remain excluded.

Tab membership and order are fixed:

- ACTIVE: ACTIVE, AMEND_PENDING, CHECKING; CHECKING first, then `end_date ASC`, then UUID.
- WAITING: DRAFT, PENDING; `updated_at DESC`, then UUID DESC.
- COMPLETED: COMPLETED, BROKEN, DISPUTED, UNRESOLVED, DECLINED, CANCELED; `closed_at DESC NULLS LAST`, then `updated_at DESC`, then UUID DESC.

The ACTIVE pinned query returns all CHECKING rows plus ACTIVE rows whose KST D-Day is from 0 through 3. Those IDs are excluded from the ordinary ACTIVE page. AMEND_PENDING is never pinned. `needs_response` is true only when a joined creator/partner has not submitted the current CHECKING round; witnesses never receive that action.

Tab counts include every visible promise in the tab, including ACTIVE promises rendered in the pinned section. A nullable DRAFT `end_date` is returned as `null` and has no D-Day/date label; confirmed statuses retain the server-enforced date.

The result includes creator and partner display data, the actor's role, and whether any witness has joined. A missing partner remains `null`; the app renders the existing neutral “상대방” fallback rather than inventing an identity.

The Edge Function is the established pure `handler.ts` plus thin `index.ts` structure. It validates POST, JWT, tab, cursor shape, cursor/tab equality, UUID, and RFC3339/date fields before calling the RPC. Invalid requests flatten to the shared API error contract; unknown database failures remain the common 500 response.

## Mobile Design

`home-promises-api.ts` is the platform-independent request wrapper and validates the complete server response before exposing it. `home-promises-native.ts` supplies the authenticated mobile call and keeps the existing DRAFT deletion operation.

The screen owns one reducer state per tab:

- first load is lazy for the selected tab;
- tab switching preserves prior items and cursor;
- page completion appends newest server order with `promise_id` deduplication;
- duplicate end-reached requests are fenced;
- refresh resets only the selected tab generation, discards late page results, and replaces ACTIVE pinned rows;
- page failures preserve loaded rows and permit retry;
- deleting a DRAFT removes it locally and decrements WAITING count.

SCR-A02 uses interactive 48dp tabs and a `FlatList` with `RefreshControl`. The ACTIVE header contains pinned cards only. Ordinary cards show status, title, KST D-Day/end date, creator/partner identity, witness badge, and response-needed text without relying on colour alone. Profile images use a small token-based `LfAvatar` with an initial fallback. No ad component or reserved ad space is rendered.

## Navigation and Scope Boundaries

- DRAFT: `/promise/edit?promise_id=...`
- PENDING: `/invite?promise_id=...`
- CHECKING: `/fulfillment/[promise_id]`
- All other statuses: no press action in this project.

This project does not implement SCR-A05 variants, promise hiding, witness invitation, reminder settings, notification preferences, or advertisement activation.

## Failure Handling and Security

- Each tab exposes a Korean retry message without internal SQL or Edge details.
- A failed next page never clears already loaded cards.
- A failed refresh preserves the last successful list and shows a retry affordance.
- The client cannot choose a page size above 20.
- The response sanitizer rejects extra or malformed fields, invalid enum values, cursor/tab mismatches, and arbitrary profile URL data shapes.
- Direct reads continue to be protected by existing RLS, but the app no longer depends on direct promise reads for home rendering.

## Verification

- Shared contract/sanitizer Vitest.
- PGlite tests for membership, hidden rows, all three orderings, cursor ties, page boundary 20/21, pinned exclusion, KST D-Day, witness role, metadata, and nonparticipant isolation.
- Edge handler tests for authentication, validation, RPC arguments, error flattening, and strict response parsing.
- Mobile API and Jest screen tests for independent tab caches, pagination, refresh generation fencing, errors, card metadata, routes, DRAFT deletion, accessibility, and no ad.
- Full `npm test`, `npm run typecheck`, `npm run build:web`, `npm run check:agents`, `npx expo install --check`, Android production export, and `git diff --check`.
- 360x800 visual comparison against the frozen SCR-A02 reference. Missing SCR-A05 navigation and the intentionally absent ad are recorded differences.

Remote migration and Edge Function deployment remain gated by the existing Supabase Management API 403. Local completion must not be reported as deployed completion.
