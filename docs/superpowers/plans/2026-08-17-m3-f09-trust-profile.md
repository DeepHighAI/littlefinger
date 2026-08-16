# M3 F-09 Trust Profile and SCR-A08 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the signed-in user's private trust profile, reminder preferences, safe Android logout, SCR-A08, and the idempotent J-10 repair batch.

**Architecture:** Three authenticated Edge Functions wrap service-role-only Postgres RPCs. The shared package owns strict wire parsers, the mobile layer owns encrypted current-device token persistence and logout orchestration, and SCR-A08 renders only the signed-in user's aggregate. J-10 repairs the existing real-time trust cache once per day.

**Tech Stack:** TypeScript, Vitest, PGlite, Supabase Postgres/Edge Functions/pg_cron, React Native, Expo SDK 57, Expo Router, jest-expo, `LargeSecureStore`, `react-native-svg`.

## Global Constraints

- The approved contract is `docs/superpowers/specs/2026-08-17-m3-f09-trust-profile-design.md`.
- Code, identifiers, file names, types, plans, and commits are English; code comments and product copy are Korean.
- Product copy lives in label constants. Screen code uses the existing token layer and never renders an ad.
- Only the signed-in user's profile is returned. Responses exclude `kakao_id`, email fields, `primary_surface`, and other users' identifiers.
- Keep rate follows F-09 exactly: only keeper-scoped `COMPLETED` and `BROKEN` promises form the denominator; fewer than three samples returns `null`.
- Reminder keys are exactly `remind_d7`, `remind_d3`, `remind_d1`, `remind_dday`, and `remind_hour`; hours are exactly `09`, `12`, or `20`, defaulting to `09`.
- Mutation endpoints require a UUID `Idempotency-Key`; reads require JWT but no idempotency key.
- All new `SECURITY DEFINER` functions set `search_path = ''`, qualify relations, and revoke execution from `PUBLIC`, `anon`, and `authenticated`.
- J-10 runs at `0 18 * * *` UTC, equal to 03:00 KST, and duplicate registration or execution must be harmless.
- The last server-accepted Expo token is stored in user-scoped encrypted `LargeSecureStore`; plaintext AsyncStorage is forbidden.
- Android logout unregisters the current device before Supabase sign-out. Any token resolution, unregister, or sign-out failure preserves the session and offers retry.
- `LEGAL_DISCLAIMER` remains verbatim through `LfDisclaimer`; terms and privacy use `openLegalDocument`.
- Block management, account withdrawal, email reminders, badges, rankings, partner rates, F-11, remote deployment, and real-device UAT are excluded.
- Never run `supabase config push`; never modify or commit `.claude/settings.local.json`; do not push `origin` without a separate request.

---

## File Map

- `packages/shared/src/trust-profile.ts`: F-09 wire types, defaults, constants, and strict response parsers.
- `packages/shared/src/trust-profile.test.ts`: exact-key, type, URL, count, percentage, and instant boundary tests.
- `packages/shared/src/promise.ts`: adds `activeCount` to the existing domain `TrustProfile`.
- `packages/shared/src/api.ts`: adds validation fields and the three endpoint slugs.
- `packages/shared/src/index.ts`: exports the F-09 shared module.
- `supabase/migrations/20260817000001_f09_trust_profile.sql`: profile read, settings update/reschedule, device unregister, and full repair RPCs.
- `supabase/migrations/20260817000002_schedule_j10_trust_profile.sql`: duplicate-safe J-10 registration.
- `supabase/tests/trust-profile.test.ts`: PGlite behavior, permissions, idempotency, concurrency, and J-10 tests.
- `supabase/functions/_shared/trust-profile.ts`: Edge-only strict RPC response sanitizers.
- `supabase/functions/trust-profile/{handler,index}.ts`: authenticated profile read.
- `supabase/functions/trust-profile-settings-update/{handler,index}.ts`: authenticated full settings replacement.
- `supabase/functions/device-token-unregister/{handler,index}.ts`: authenticated current-token removal.
- `supabase/tests/edge-trust-profile.test.ts`: handler auth, validation, RPC arguments, flattening, and safe-log tests.
- `supabase/tests/edge-bundle.test.ts`: import graph coverage for the three new entry points.
- `supabase/config.toml`: explicit `verify_jwt = true` entries for all three functions.
- `apps/mobile/src/lib/trust-profile-api.ts`: dependency-injected mobile API calls.
- `apps/mobile/src/lib/trust-profile-api.test.ts`: endpoint and idempotency tests.
- `apps/mobile/src/lib/trust-profile-native.ts`: Expo-native API wrappers and UUID creation.
- `apps/mobile/src/lib/profile-session.ts`: encrypted token keying and safe logout state machine.
- `apps/mobile/src/lib/profile-session.test.ts`: registration cache and logout failure-order tests.
- `apps/mobile/src/lib/push-registration.ts`: persists a token only after server registration succeeds.
- `apps/mobile/src/lib/push-registration-native.ts`: connects token persistence to `LargeSecureStore`.
- `apps/mobile/src/lib/push-registration.test.ts`: token-persistence ordering and failure tests.
- `apps/mobile/src/screens/scr-a08-labels.ts`: all SCR-A08 Korean copy.
- `apps/mobile/src/screens/scr-a08-profile-state.ts`: load/update generation fencing and confirmed preference rollback.
- `apps/mobile/src/screens/scr-a08-profile.test.tsx`: SCR-A08 behavior, accessibility, legal, logout, and no-ad tests.
- `apps/mobile/src/app/profile.tsx`: SCR-A08 route and presentation.
- `apps/mobile/src/app/home.tsx`: separate notification and profile app-bar actions.
- `apps/mobile/src/screens/scr-a02-labels.ts`: profile action accessibility label.
- `apps/mobile/src/screens/scr-a02-home.test.tsx`: home-to-profile navigation.
- `apps/mobile/src/app/_layout.tsx`: protected `/profile` route.
- `apps/mobile/src/screens/root-layout.test.tsx`: protected-route registration.
- `docs/DEVELOPMENT_STATUS.md`: local completion and blocked deployment/UAT state.

---

### Task 1: Define F-09 Shared Contracts

**Files:**
- Create: `packages/shared/src/trust-profile.ts`
- Create: `packages/shared/src/trust-profile.test.ts`
- Modify: `packages/shared/src/promise.ts`
- Modify: `packages/shared/src/api.ts`
- Modify: `packages/shared/src/api.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `IsoDateTime` from `promise.ts` and `isIsoInstant` from `datetime.ts`.
- Produces: `REMINDER_HOURS`, `DEFAULT_REMINDER_PREFERENCES`, `ReminderHour`, `ReminderPreferences`, `TrustProfileDetailResponse`, `TrustProfileSettingsUpdateRequest`, `TrustProfileSettingsUpdateResponse`, `DeviceTokenUnregisterRequest`, `DeviceTokenUnregisterResponse`, `asTrustProfileDetailResponse`, `asTrustProfileSettingsUpdateResponse`, and `asDeviceTokenUnregisterResponse`.

- [ ] **Step 1: Write the failing shared contract tests**

```ts
const detail = {
  nickname: '지우',
  profile_image_url: 'https://example.com/profile.jpg',
  keep_rate: 75,
  completed_count: 3,
  broken_count: 1,
  disputed_count: 2,
  unresolved_count: 1,
  active_count: 4,
  updated_at: '2026-08-17T00:00:00.000Z',
  reminders: {
    remind_d7: true,
    remind_d3: true,
    remind_d1: false,
    remind_dday: true,
    remind_hour: '12',
  },
};

expect(asTrustProfileDetailResponse(detail)).toEqual(detail);
expect(asTrustProfileDetailResponse({ ...detail, kakao_id: 'forbidden' })).toBeNull();
expect(asTrustProfileDetailResponse({ ...detail, keep_rate: 101 })).toBeNull();
expect(asTrustProfileDetailResponse({ ...detail, profile_image_url: 'http://example.com/a.jpg' })).toBeNull();
expect(asTrustProfileDetailResponse({ ...detail, reminders: { ...detail.reminders, remind_hour: '10' } })).toBeNull();
expect(asTrustProfileSettingsUpdateResponse({ reminders: detail.reminders, updated_at: detail.updated_at })).not.toBeNull();
expect(asDeviceTokenUnregisterResponse({ removed: true })).toEqual({ removed: true });
```

Also assert `DEFAULT_REMINDER_PREFERENCES` is all `true` with hour `09`, `REMINDER_HOURS` is exactly `['09', '12', '20']`, `TrustProfile.activeCount` is required, and `ENDPOINT` exposes the three approved slugs.

- [ ] **Step 2: Run the focused tests and capture RED**

Run: `npx vitest run packages/shared/src/trust-profile.test.ts packages/shared/src/api.test.ts`

Expected: FAIL because the F-09 module, endpoint slugs, validation fields, and `activeCount` do not exist.

- [ ] **Step 3: Implement exact shared types and strict parsers**

```ts
export const REMINDER_HOURS = ['09', '12', '20'] as const;
export type ReminderHour = (typeof REMINDER_HOURS)[number];

export interface ReminderPreferences {
  remind_d7: boolean;
  remind_d3: boolean;
  remind_d1: boolean;
  remind_dday: boolean;
  remind_hour: ReminderHour;
}

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  remind_d7: true,
  remind_d3: true,
  remind_d1: true,
  remind_dday: true,
  remind_hour: '09',
};

export interface TrustProfileDetailResponse {
  nickname: string;
  profile_image_url: string | null;
  keep_rate: number | null;
  completed_count: number;
  broken_count: number;
  disputed_count: number;
  unresolved_count: number;
  active_count: number;
  updated_at: IsoDateTime;
  reminders: ReminderPreferences;
}
```

Implement exact-key object checks. Counts must be non-negative integers, `keep_rate` must be an integer from 0 through 100 or `null`, the image must be HTTPS or `null`, and `updated_at` must pass `isIsoInstant`.

Add `reminders` and `remind_hour` to `ApiValidationField`, and add:

```ts
trustProfile: 'trust-profile',
trustProfileSettingsUpdate: 'trust-profile-settings-update',
deviceTokenUnregister: 'device-token-unregister',
```

- [ ] **Step 4: Run focused GREEN and shared regression**

Run: `npx vitest run packages/shared/src/trust-profile.test.ts packages/shared/src/api.test.ts packages/shared/src/keep-rate.test.ts packages/shared/src/promise.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the task gate and commit**

Run: `npm test && npm run typecheck && npm run check:agents && git diff --check`

Commit:

```bash
git add packages/shared/src/trust-profile.ts packages/shared/src/trust-profile.test.ts packages/shared/src/promise.ts packages/shared/src/api.ts packages/shared/src/api.test.ts packages/shared/src/index.ts
git commit -m "feat: define F-09 trust profile contracts"
```

---

### Task 2: Add Profile Transactions and J-10

**Files:**
- Create: `supabase/migrations/20260817000001_f09_trust_profile.sql`
- Create: `supabase/migrations/20260817000002_schedule_j10_trust_profile.sql`
- Create: `supabase/tests/trust-profile.test.ts`
- Modify: `supabase/tests/schema.test.ts`

**Interfaces:**
- Consumes: `lf_assert_actor(uuid)`, `lf_idempotency_begin(uuid,uuid,text)`, `lf_idempotency_finish(uuid,jsonb)`, `lf_recompute_trust_profile(uuid)`, `users.notification_pref`, `trust_profiles`, and `reminder_schedules`.
- Produces: `lf_my_trust_profile(uuid)`, `lf_trust_profile_settings_update(uuid,uuid,jsonb)`, `lf_device_token_unregister(uuid,uuid,text)`, `lf_recompute_all_trust_profiles()`, and `lf_schedule_trust_profile_recompute()`.

- [ ] **Step 1: Write PGlite RED tests for read privacy and defaults**

Create users with empty and partial `notification_pref` JSON. Assert:

```ts
async function oneJson(sql: string, params: readonly unknown[]): Promise<Record<string, unknown>> {
  const { rows } = await db.asAdmin(sql, [...params]);
  const value = rows[0]?.['result'];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('EXPECTED_JSON_OBJECT');
  }
  return value as Record<string, unknown>;
}

const payload = await oneJson(
  `select public.lf_my_trust_profile($1::uuid) as result`,
  [actor],
);
expect(payload).toMatchObject({
  nickname: '프로필사용자',
  profile_image_url: null,
  keep_rate: null,
  completed_count: 0,
  broken_count: 0,
  disputed_count: 0,
  unresolved_count: 0,
  active_count: 0,
  reminders: {
    remind_d7: true,
    remind_d3: true,
    remind_d1: true,
    remind_dday: true,
    remind_hour: '09',
  },
});
expect(Object.keys(payload).sort()).not.toContain('kakao_id');
```

Assert inactive users receive `E_FORBIDDEN`, absent users receive `E_AUTH_REQUIRED`, and no profile row is inserted by the read.
When `trust_profiles` has no row, return zero counts, a null rate, and `users.updated_at` as the
response instant; when the cache exists, return `trust_profiles.updated_at`.

- [ ] **Step 2: Write PGlite RED tests for atomic settings and rescheduling**

Insert PENDING `D7`, `D3`, `D1`, and `DDAY` schedules for two users on the same promise. Call the settings RPC with hour `20` and assert only the actor's rows become the KST wall-clock hour 20. Assert switches remain stored without deleting schedules, unrelated JSON keys survive, invalid/missing/extra fields raise `E_VALIDATION`, a reused idempotency key replays the first payload, a new key applies the new payload, and parallel same-key calls make one logical change.

```ts
const result = await oneJson(
  `select public.lf_trust_profile_settings_update($1,$2,$3::jsonb) as result`,
  [key, actor, JSON.stringify(nextPreferences)],
);
expect(result.reminders).toEqual(nextPreferences);
```

- [ ] **Step 3: Write PGlite RED tests for token removal and J-10**

Assert the unregister RPC deletes only `(actor, token)`, reports `{ removed: false }` for an absent or other-user token, replays the first response for the same key, and cannot remove a token that moved to another account after the request snapshot.

Create keeper-scoped completed/broken promises plus disputed, unresolved, and active promises. Corrupt the cache, call `lf_recompute_all_trust_profiles()` twice, and assert both final cache snapshots match F-09 and the second run creates no duplicate row. Assert WITHDRAWN users are skipped, service-role-only grants are present, the function has an empty search path, and the scheduler leaves exactly one `lf-j10-trust-profile-recompute` job at `0 18 * * *`.

- [ ] **Step 4: Run the database tests and capture RED**

Run: `npx vitest run supabase/tests/trust-profile.test.ts supabase/tests/schema.test.ts`

Expected: FAIL with missing relation functions and missing J-10 registration.

- [ ] **Step 5: Implement the profile transaction migration**

Use these exact signatures and response shapes:

```sql
create or replace function public.lf_my_trust_profile(p_actor uuid)
returns jsonb language plpgsql stable security definer set search_path = '';

create or replace function public.lf_trust_profile_settings_update(
  p_idempotency_key uuid,
  p_actor uuid,
  p_reminders jsonb
) returns jsonb language plpgsql security definer set search_path = '';

create or replace function public.lf_device_token_unregister(
  p_idempotency_key uuid,
  p_actor uuid,
  p_expo_push_token text
) returns jsonb language plpgsql security definer set search_path = '';

create or replace function public.lf_recompute_all_trust_profiles()
returns jsonb language plpgsql security definer set search_path = '';
```

The settings function must lock the actor row, validate exact JSON types, preserve unrelated keys, update `users.updated_at`, and recompute only actor-owned PENDING D-day schedule rows:

```sql
update public.reminder_schedules rs
   set fire_at = (
     (p.end_date
       - case rs.kind when 'D7' then 7 when 'D3' then 3 when 'D1' then 1 else 0 end
     )::timestamp
     + pg_catalog.make_interval(hours => (p_reminders->>'remind_hour')::int)
   ) at time zone 'Asia/Seoul'
  from public.promises p
 where rs.promise_id = p.id
   and rs.user_id = p_actor
   and rs.status = 'PENDING'
   and rs.kind in ('D7', 'D3', 'D1', 'DDAY');
```

Parenthesize the KST expression so PostgreSQL applies `AT TIME ZONE` to the complete local timestamp. Call `lf_idempotency_finish` in the same transaction as each mutation.

J-10 must take `pg_advisory_xact_lock(hashtextextended('lf-j10-trust-profile',0))`, iterate ACTIVE user UUIDs in ascending order, invoke `lf_recompute_trust_profile`, and return `{ "processed_count": n }`.

- [ ] **Step 6: Implement duplicate-safe J-10 scheduling**

Follow the existing J-09 scheduler pattern with a distinct advisory lock and job name:

```sql
perform cron.schedule(
  'lf-j10-trust-profile-recompute',
  '0 18 * * *',
  'select public.lf_recompute_all_trust_profiles();'
);
```

If `cron.schedule(text,text,text)` is unavailable in PGlite, return without failure. Revoke all five functions from client roles and grant them only to `service_role`.

- [ ] **Step 7: Run database GREEN and fulfillment regression**

Run: `npx vitest run supabase/tests/trust-profile.test.ts supabase/tests/core-fulfillment.test.ts supabase/tests/fulfillment-batches-rechecks.test.ts supabase/tests/reminder-dispatch.test.ts supabase/tests/schema.test.ts`

Expected: PASS.

- [ ] **Step 8: Run the task gate and commit**

Run: `npm test && npm run typecheck && npm run check:agents && git diff --check`

Commit:

```bash
git add supabase/migrations/20260817000001_f09_trust_profile.sql supabase/migrations/20260817000002_schedule_j10_trust_profile.sql supabase/tests/trust-profile.test.ts supabase/tests/schema.test.ts
git commit -m "feat: add F-09 trust profile transactions"
```

---

### Task 3: Add the Three Authenticated Edge Functions

**Files:**
- Create: `supabase/functions/_shared/trust-profile.ts`
- Create: `supabase/functions/trust-profile/handler.ts`
- Create: `supabase/functions/trust-profile/index.ts`
- Create: `supabase/functions/trust-profile-settings-update/handler.ts`
- Create: `supabase/functions/trust-profile-settings-update/index.ts`
- Create: `supabase/functions/device-token-unregister/handler.ts`
- Create: `supabase/functions/device-token-unregister/index.ts`
- Create: `supabase/tests/edge-trust-profile.test.ts`
- Modify: `supabase/tests/edge-bundle.test.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: the three RPCs from Task 2, `Deps.authenticate`, `Deps.rpc`, `idempotencyKeyOf`, shared strict response parsers, and existing HTTP error flattening.
- Produces: `createTrustProfileHandler`, `createTrustProfileSettingsUpdateHandler`, and `createDeviceTokenUnregisterHandler`.

- [ ] **Step 1: Write handler RED tests**

Test these exact boundaries:

```ts
expect(profileRpc).toEqual({ fn: 'lf_my_trust_profile', args: { p_actor: ACTOR_ID } });
expect(settingsRpc).toEqual({
  fn: 'lf_trust_profile_settings_update',
  args: {
    p_actor: ACTOR_ID,
    p_idempotency_key: IDEMPOTENCY_KEY,
    p_reminders: preferences,
  },
});
expect(unregisterRpc).toEqual({
  fn: 'lf_device_token_unregister',
  args: {
    p_actor: ACTOR_ID,
    p_idempotency_key: IDEMPOTENCY_KEY,
    p_expo_push_token: EXPO_TOKEN,
  },
});
```

Also assert OPTIONS works, non-POST fails, JWT is required, mutation keys must be UUIDs, settings bodies have exactly one `reminders` object with exactly five correctly typed fields, token bodies have exactly `expo_push_token`, malformed RPC responses flatten to 500, known RPC errors preserve shared codes, and logs never contain the token or preferences.

- [ ] **Step 2: Run Edge tests and capture RED**

Run: `npx vitest run supabase/tests/edge-trust-profile.test.ts supabase/tests/edge-bundle.test.ts`

Expected: FAIL because the handlers, entry points, sanitizers, and config entries are absent.

- [ ] **Step 3: Implement the pure handlers and thin entry points**

The read handler follows this structure:

```ts
export function createTrustProfileHandler(deps: Deps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return corsPreflight();
    try {
      if (request.method !== 'POST') throw new ApiError('E_VALIDATION', { field: 'reminders' });
      const actor = await deps.authenticate(request.headers.get('authorization'));
      const body = await jsonBody(request, 'reminders');
      if (Object.keys(body).length !== 0) throw new ApiError('E_VALIDATION', { field: 'reminders' });
      const payload = asTrustProfileDetailResponse(
        await deps.rpc('lf_my_trust_profile', { p_actor: actor }),
      );
      if (payload === null) throw new Error('INVALID_TRUST_PROFILE_RESPONSE');
      return jsonResponse(payload, 200);
    } catch (raised) {
      return failureResponse(raised, { log: deps.log.error });
    }
  };
}
```

The mutation handlers authenticate before parsing state, validate the UUID header, pass only approved RPC arguments, sanitize responses, and use `failureResponse`. Each `index.ts` contains only `createDeps`, the handler import, and `Deno.serve(...)`.

- [ ] **Step 4: Register explicit JWT configuration and bundle coverage**

Add:

```toml
[functions.trust-profile]
verify_jwt = true

[functions.trust-profile-settings-update]
verify_jwt = true

[functions.device-token-unregister]
verify_jwt = true
```

Extend the import graph test so all six new TypeScript entry files resolve without Deno globals entering `handler.ts`.

- [ ] **Step 5: Run Edge GREEN and related regression**

Run: `npx vitest run supabase/tests/edge-trust-profile.test.ts supabase/tests/edge-bundle.test.ts supabase/tests/edge-device-token.test.ts supabase/tests/edge-shared.test.ts`

Expected: PASS.

- [ ] **Step 6: Run the task gate and commit**

Run: `npm test && npm run typecheck && npm run check:agents && git diff --check`

Commit:

```bash
git add supabase/functions/_shared/trust-profile.ts supabase/functions/trust-profile supabase/functions/trust-profile-settings-update supabase/functions/device-token-unregister supabase/tests/edge-trust-profile.test.ts supabase/tests/edge-bundle.test.ts supabase/config.toml
git commit -m "feat: add F-09 trust profile edge functions"
```

---

### Task 4: Add Mobile Profile API and Safe Session Actions

**Files:**
- Create: `apps/mobile/src/lib/trust-profile-api.ts`
- Create: `apps/mobile/src/lib/trust-profile-api.test.ts`
- Create: `apps/mobile/src/lib/trust-profile-native.ts`
- Create: `apps/mobile/src/lib/profile-session.ts`
- Create: `apps/mobile/src/lib/profile-session.test.ts`
- Modify: `apps/mobile/src/lib/push-registration.ts`
- Modify: `apps/mobile/src/lib/push-registration-native.ts`
- Modify: `apps/mobile/src/lib/push-registration.test.ts`

**Interfaces:**
- Consumes: Task 1 contracts, `callMobileFunctionNative`, `getMobileEncryptedStorage`, Expo Notifications, EAS project ID, and Supabase Auth.
- Produces: `loadTrustProfile`, `updateTrustProfileSettings`, `unregisterDeviceToken`, `createTrustProfileIdempotencyKey`, `registeredPushTokenStorageKey`, `logoutCurrentDevice`, and `logoutCurrentDeviceNative`.

- [ ] **Step 1: Write mobile API RED tests**

```ts
expect(call).toHaveBeenCalledWith(ENDPOINT.trustProfile, {}, { idempotent: false });
expect(call).toHaveBeenCalledWith(
  ENDPOINT.trustProfileSettingsUpdate,
  { reminders: preferences },
  { idempotent: true, idempotencyKey: KEY },
);
expect(call).toHaveBeenCalledWith(
  ENDPOINT.deviceTokenUnregister,
  { expo_push_token: EXPO_TOKEN },
  { idempotent: true, idempotencyKey: KEY },
);
```

Expected native wrappers must create a fresh Expo UUID for each mutation and return strict shared response types.

- [ ] **Step 2: Write registration-cache and logout RED tests**

Use a call-order array and assert:

1. successful registration orders `channel → permission → token → register → encrypted-cache`;
2. server registration failure never writes the cache;
3. a cached token avoids permission reads and native token lookup during logout;
4. missing Android cache orders `channel → token lookup → unregister → sign out → cache remove` without requesting permission;
5. unregister failure does not call sign-out or cache removal;
6. sign-out failure keeps the cache for a safe retry;
7. another platform signs out without Expo calls; and
8. user IDs produce different encrypted keys.

```ts
await expect(logoutCurrentDevice(USER_ID, deps)).resolves.toBeUndefined();
expect(calls).toEqual(['cache:get', 'unregister', 'signout', 'cache:remove']);
```

- [ ] **Step 3: Run mobile library tests and capture RED**

Run: `npm run test --workspace=@littlefinger/mobile -- --runInBand src/lib/trust-profile-api.test.ts src/lib/profile-session.test.ts src/lib/push-registration.test.ts`

Expected: FAIL because the profile API, token cache, and logout orchestration do not exist.

- [ ] **Step 4: Implement dependency-injected API wrappers**

```ts
export async function loadTrustProfile(deps: TrustProfileApiDeps) {
  return await deps.call<TrustProfileDetailResponse>(
    ENDPOINT.trustProfile,
    {},
    { idempotent: false },
  );
}
```

Implement the two mutation wrappers with caller-provided UUID keys. Native wrappers use `callMobileFunctionNative` and `Crypto.randomUUID()`.

- [ ] **Step 5: Implement encrypted token persistence and safe logout**

Use a stable user-scoped key without embedding the token:

```ts
export function registeredPushTokenStorageKey(userId: string): string {
  return `push-token:${userId}`;
}
```

Extend `PushRegistrationDeps` with `persistRegisteredToken(token: string): Promise<void>` and call it only after a successful server response. The native registration wrapper writes through `getMobileEncryptedStorage()` using `session.user.id`.

Implement logout in this exact order:

```ts
const cached = await deps.storage.getItem(registeredPushTokenStorageKey(userId));
const token = deps.platform !== 'android'
  ? null
  : cached ?? await deps.resolveCurrentAndroidToken();
if (token !== null) await deps.unregister(token, deps.randomUuid());
await deps.signOut();
if (cached !== null) await deps.storage.removeItem(registeredPushTokenStorageKey(userId));
```

The native fallback creates the Android channel, requires the configured EAS project ID, calls `getExpoPushTokenAsync`, never calls `requestPermissionsAsync`, and forwards failures rather than signing out.
Native sign-out must call `supabase.auth.signOut({ scope: 'local' })`; a Supabase error is a failed
logout, not a successful session clear.

- [ ] **Step 6: Run mobile GREEN and session regression**

Run: `npm run test --workspace=@littlefinger/mobile -- --runInBand src/lib/trust-profile-api.test.ts src/lib/profile-session.test.ts src/lib/push-registration.test.ts src/lib/session-gate.test.ts src/lib/supabase.test.ts`

Expected: PASS.

- [ ] **Step 7: Run the task gate and commit**

Run: `npm test && npm run typecheck && npm run check:agents && git diff --check`

Commit:

```bash
git add apps/mobile/src/lib/trust-profile-api.ts apps/mobile/src/lib/trust-profile-api.test.ts apps/mobile/src/lib/trust-profile-native.ts apps/mobile/src/lib/profile-session.ts apps/mobile/src/lib/profile-session.test.ts apps/mobile/src/lib/push-registration.ts apps/mobile/src/lib/push-registration-native.ts apps/mobile/src/lib/push-registration.test.ts
git commit -m "feat: add safe profile session actions"
```

---

### Task 5: Build SCR-A08 and Home Entry

**Files:**
- Create: `apps/mobile/src/screens/scr-a08-labels.ts`
- Create: `apps/mobile/src/screens/scr-a08-profile-state.ts`
- Create: `apps/mobile/src/screens/scr-a08-profile.test.tsx`
- Create: `apps/mobile/src/app/profile.tsx`
- Modify: `apps/mobile/src/app/home.tsx`
- Modify: `apps/mobile/src/screens/scr-a02-labels.ts`
- Modify: `apps/mobile/src/screens/scr-a02-home.test.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx`
- Modify: `apps/mobile/src/screens/root-layout.test.tsx`

**Interfaces:**
- Consumes: Task 4 native functions, `LfAppBar`, `LfAvatar`, `LfButton`, `LfCard`, `LfDisclaimer`, `LfIcon`, `LfPicker`, `LfSwitch`, `LfText`, `openLegalDocument`, and theme tokens.
- Produces: protected `/profile`, `SCR_A08_LABEL`, `profileReducer`, and a separate home profile action.

- [ ] **Step 1: Write reducer RED tests for stale loads and failed settings**

The reducer state owns `profile`, `confirmedReminders`, `displayedReminders`, `latestLoadId`, `pendingUpdateId`, `loading`, `saving`, and error flags. Assert:

```ts
const updated = profileReducer(loaded, {
  type: 'UPDATE_STARTED',
  updateId: 4,
  reminders: next,
});
expect(updated.displayedReminders).toEqual(next);
expect(profileReducer(updated, { type: 'UPDATE_FAILED', updateId: 4 }).displayedReminders)
  .toEqual(loaded.confirmedReminders);
expect(profileReducer(updated, staleLoadSuccess)).toEqual(updated);
```

- [ ] **Step 2: Write SCR-A08 RED tests**

Cover:

- loading, retryable read failure, and loaded nickname/avatar;
- percentage ring at 75 and `집계 중` at `null`;
- completed, broken, disputed, unresolved, and active counts;
- four independent labeled switches and disabled controls while saving;
- hour picker choices exactly 09:00, 12:00, and 20:00 KST;
- update success, update failure rollback, and stale load/update responses;
- terms and privacy links calling `openLegalDocument`;
- immutable disclaimer text;
- logout confirmation, failure feedback, and navigation returning to the auth gate through session state;
- every interactive control has at least the shared 48 dp touch target;
- no ad component or reserved ad test ID.

- [ ] **Step 3: Write home and route RED tests**

Assert the home app bar has distinct `알림` and `마이 프로필` buttons, tapping the second pushes `/profile`, and the protected stack contains `screen:profile` only for an authenticated session.

- [ ] **Step 4: Run UI tests and capture RED**

Run: `npm run test --workspace=@littlefinger/mobile -- --runInBand src/screens/scr-a08-profile.test.tsx src/screens/scr-a02-home.test.tsx src/screens/root-layout.test.tsx`

Expected: FAIL because SCR-A08, its reducer, the route, and the home action are absent.

- [ ] **Step 5: Implement labels and the fenced reducer**

All copy belongs in `SCR_A08_LABEL`, including loading, errors, count strings, switch labels, hour labels, legal actions, logout confirmation, and retry. The reducer accepts only matching `loadId` and `updateId` completions and restores confirmed settings on a matching failure.

- [ ] **Step 6: Implement SCR-A08 using only components and tokens**

Build the ring with `react-native-svg`. Derive its 88 dp size from existing tokens (`size.iconButton * 2`), derive radius from spacing tokens (`space[9] + space[5]`), and compute `strokeDashoffset` from the clamped rate. Render percentage text or `집계 중` in addition to the ring so color is never the only signal.

Render the frozen reference structure, then add the approved differences: back action, four switches, time picker, explicit terms/privacy actions, error states, and logout. Use `Alert.alert` for hour choices and logout confirmation. Do not render email, block-list, withdrawal, settings, ads, badges, rankings, or partner rates.

- [ ] **Step 7: Wire the route and separate home actions**

Use an `LfRow` as the app-bar action containing two 48 dp `Pressable` controls. Keep the existing notification path and add:

```tsx
onPress={() => router.push('/profile')}
```

Register `<Stack.Screen name="profile" />` in the authenticated group.

- [ ] **Step 8: Run UI GREEN and mobile regression**

Run: `npm run test --workspace=@littlefinger/mobile -- --runInBand src/screens/scr-a08-profile.test.tsx src/screens/scr-a02-home.test.tsx src/screens/root-layout.test.tsx src/components/components.test.tsx`

Expected: PASS.

- [ ] **Step 9: Generate typed routes, typecheck, and commit**

Run from `apps/mobile`: `npx expo start --offline --clear`

Stop the server after `.expo/types/router.d.ts` contains `/profile`.

Run: `npm test && npm run typecheck && npm run check:agents && git diff --check`

Commit:

```bash
git add apps/mobile/src/screens/scr-a08-labels.ts apps/mobile/src/screens/scr-a08-profile-state.ts apps/mobile/src/screens/scr-a08-profile.test.tsx apps/mobile/src/app/profile.tsx apps/mobile/src/app/home.tsx apps/mobile/src/screens/scr-a02-labels.ts apps/mobile/src/screens/scr-a02-home.test.tsx apps/mobile/src/app/_layout.tsx apps/mobile/src/screens/root-layout.test.tsx
git commit -m "feat: build SCR-A08 trust profile"
```

---

### Task 6: Final Local Verification and Status Record

**Files:**
- Modify: `docs/DEVELOPMENT_STATUS.md`
- Create or update ignored evidence: `.superpowers/sdd/2026-08-17-m3-f09-trust-profile/final-report.md`

**Interfaces:**
- Consumes: committed Tasks 1 through 5.
- Produces: auditable local verification evidence and an accurate deployment/UAT boundary.

- [ ] **Step 1: Run focused F-09 verification**

Run:

```bash
npx vitest run packages/shared/src/trust-profile.test.ts supabase/tests/trust-profile.test.ts supabase/tests/edge-trust-profile.test.ts
npm run test --workspace=@littlefinger/mobile -- --runInBand src/lib/trust-profile-api.test.ts src/lib/profile-session.test.ts src/lib/push-registration.test.ts src/screens/scr-a08-profile.test.tsx src/screens/scr-a02-home.test.tsx src/screens/root-layout.test.tsx
```

Expected: every focused test passes with zero skipped F-09 cases.

- [ ] **Step 2: Run every repository gate**

Run:

```bash
npm test
npm run typecheck
npm run build:web
npm run check:agents
cd apps/mobile && npx expo install --check
cd apps/mobile && npx expo export --platform android --output-dir C:\tmp\littlefinger-f09-android-export
git diff --check
```

Expected: all commands exit 0; Android export reports a completed bundle.

- [ ] **Step 3: Perform the 360x800 visual comparison**

Open `design-reference/screens/app/scr-a08-profile.html` at 360x800 and capture the implemented `/profile` route at the same viewport or density. Compare app bar, avatar, trust card, ring, counts, reminder card, legal card, disclaimer, touch targets, scrolling, and no-ad spacing. Record the approved differences: back action, four switches, hour picker, error states, logout, and omitted email control.

If the emulator cannot reach the route, record the exact emulator or System UI failure and report visual verification as blocked; do not claim pixel parity from static source inspection.

- [ ] **Step 4: Recheck the read-only deployment gate**

Run: `npx supabase migration list`

If it returns Management API 403, stop all remote work immediately. Do not run function deployment, secrets, Vault mutations, cron changes, or `supabase config push`. Record local completion and remote deployment/UAT as blocked.

- [ ] **Step 5: Update development status and write the final report**

Record the exact HEAD, focused/full test counts, typecheck/build/export results, visual evidence path or blocker, untracked files, and remote 403 state. Mark F-09 as locally implemented only; do not mark remote J-10, Edge Functions, push-token removal, or real-device logout as verified.

- [ ] **Step 6: Commit the status record**

Run: `git diff --check && git status --short`

Commit only the tracked status document:

```bash
git add docs/DEVELOPMENT_STATUS.md
git commit -m "docs: record local F-09 completion"
```

The final user report must state the commit SHAs, actual test counts, Android export result, visual status, remote deployment gate, and that `.claude/settings.local.json` remains untouched.
