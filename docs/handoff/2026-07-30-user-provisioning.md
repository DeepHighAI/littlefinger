# Handoff — the live 401 is a missing `public.users` row, and how it gets written

Date: 2026-07-30. Follows `2026-07-29-apps-web-scaffold-w06.md`, whose `## LIVE BREAKAGE` section was
rewritten in `fac4af6` with the diagnosis below.

Status: **diagnosed and closed as a mystery, not yet fixed.** Nothing is broken in code — the seven
Edge Functions, `authenticate`, `getUser`, the keys and RLS are all healthy. What is missing is one
row per user. The design for writing it is decided (PO, 2026-07-30) and specified here; **no
implementation has started.**

## The diagnosis, settled

`lf_assert_actor` (`20260727000009_promise_create_invite.sql:92-96`) raises `E_AUTH_REQUIRED` when
`public.users` has no row for the caller. **Nothing in production ever writes that row** — no trigger
on `auth.users`, no INSERT policy, and the only `insert into public.users` in the repo is
`supabase/tests/harness.ts:137`, the PGlite harness. That is also exactly why 987 tests pass.

Evidence is in the previous handoff's table. The two things worth not rediscovering:

- **`E_AUTH_REQUIRED` has two raisers** — `authenticate` and `lf_assert_actor` — with byte-identical
  responses. Two diagnoses died on that ambiguity (ES256/HS256, then "unknown `getUser` failure").
- **`failureResponse` logs only *unmapped* codes.** A known code raised by an RPC returns silently, so
  log silence is not evidence the RPC was never reached.

To tell the two apart, use `promise-create` as a one-bit auth probe: it calls `authenticate` *before*
`idempotencyKeyOf` (`handler.ts:60-61`), so a deliberately non-UUID `Idempotency-Key` answers
`E_VALIDATION` when auth passed and `E_AUTH_REQUIRED` when it did not.

## Decision — trigger **and** correcting call (PO, 2026-07-30)

`02` §165 specifies `primary_surface` = 로그인 표면, which a trigger cannot know, and the three NOT NULL
columns (`kakao_id`, `nickname`, `primary_surface`) mean a raising trigger rolls back the `auth.users`
insert — **a failed provision would become a failed login**. Kakao's `profile_nickname` is [선택 동의]
(§6-1), so that is a live path, not a hypothetical. Hence both halves:

1. **Trigger guarantees the row exists** so the actor guard can never be the wall again.
2. **A post-login call corrects it** with the values only the client's context knows.

### The irreversible part: `primary_surface` must become nullable

The enum is `('APP','WEB')` — there is no third value to mean "not yet known", and the trigger needs
one. So the new migration must `alter column primary_surface drop not null`, and NULL becomes the
sentinel. This **diverges from `02` §6-2's NOT NULL**, deliberately, because the trigger cannot supply
a truthful value and inventing one destroys the column's only purpose (앱 설치 전환 KPI). The
correcting call sets it `where primary_surface is null` — **first write wins**, which is what 최초 가입
표면 means. A second call never overwrites it. (That last rule is my judgement call, not a PO
instruction — it follows from 최초, but say so if it is ever questioned.)

### Trigger

`after insert on auth.users`, `security definer`:

- `insert into public.users (id, kakao_id, nickname, primary_surface) values (new.id, 'pending:' ||
  new.id, '사용자', null) on conflict (id) do nothing`
- `'pending:' || new.id` is unique by construction, which is what keeps the `unique` constraint on
  `kakao_id` from ever raising here.
- Wrap the body in `exception when others then return new`. Swallowing errors is normally wrong; here
  the alternative is that any provisioning defect locks every user out of login. Log nothing sensitive.

### RPC + Edge Function

`lf_user_provision(p_user_id, p_surface, p_nickname, p_profile_image_url)`:

- fills the placeholders; sets `primary_surface` only when it is currently NULL
- **`kakao_id` is not a parameter.** The function reads it itself:
  ```sql
  select i.provider_id into v_kakao_id
  from auth.identities i
  where i.user_id = p_user_id and i.provider = 'kakao';
  ```
  It runs as `service_role`, so the `auth` schema is readable. See "Where the Kakao 회원번호 lives"
  below for why it must not come from the client or from `user_metadata`.
- `security definer`, and the **three-way revoke** — `revoke all … from public, anon, authenticated`
  then `grant execute … to service_role`. `from public` alone leaves it callable with the anon key.

`user-provision` Edge Function, `verify_jwt = true`, `handler.ts` pure + `index.ts` one line (§5-6).
`surface` comes from the **presence of the `Origin` header**, the same rule `approvals.surface`
already uses — not from the request body, not from `users.primary_surface`. No notification (§8-1 has
no NT-* event for signup).

Client call sites: web — after `detectSessionInUrl` picks the session up on SCR-W01; app — after
`setSession`. Both call it once per login; it must be idempotent.

### Where the Kakao 회원번호 lives (verified 2026-07-30 against gotrue source)

`internal/api/provider/kakao.go` sets both fields to the numeric Kakao id:

```go
Subject:    strconv.Itoa(u.ID),
ProviderId: strconv.Itoa(u.ID),
```

`external.go` turns the claims into a map with `identityData = structs.Map(userData.Metadata)` and
writes it to **both** `identities.identity_data` and, via `user.UpdateUserMetaData(tx, identityData)`,
`users.raw_user_meta_data`. The `Claims` struct carries matching `json:` **and** `structs:` tags, so
the keys are snake_case — `structs.Map` reads the `structs` tag, not the `json` one, and it would have
produced `Subject`/`ProviderId` if only `json` tags existed.

So the value is in three places. **Use `auth.identities.provider_id`**, a real NOT NULL column whose
documented contents are "the user's account ID with that provider":

| Location | Verdict |
|---|---|
| `auth.identities.provider_id` | **Use this.** No client API writes it |
| `auth.identities.identity_data->>'sub'` | Same value, also not client-writable. A JSON read for no gain |
| `auth.users.raw_user_meta_data->>'sub'` | **Do not use.** This is `user_metadata`, and `updateUser({data})` lets the user overwrite it — they could claim someone else's 회원번호, which EC-A05 uses as the account-identity key |
| `…->>'provider_id'` | Same, and gotrue marks the `ProviderId` claim **deprecated** |

Two consequences for the trigger, both already satisfied by writing placeholders only:

- The claims use `omitempty`, so a user who refuses `profile_nickname` ([선택 동의], §6-1) produces a
  metadata map with **no `name` key at all** — absent, not empty string. `coalesce` on a missing JSON
  key works; do not test for `''`.
- `raw_user_meta_data` is written by an `UpdateUserMetaData` **UPDATE**, and `auth.identities` is
  created after the user row, so **neither is reliably present when an `after insert on auth.users`
  trigger fires.** The trigger must not read either one. The correcting call runs after login, when
  both exist.

## The exact next step

Write one migration containing: the `alter column primary_surface drop not null`, the trigger function
+ trigger, `lf_user_provision` with its three-way revoke. Then `packages/shared` types + `ENDPOINT`
slug, the `user-provision` function, `config.toml` block, and PGlite tests — the harness needs to
insert `auth.users` rows carrying `raw_user_meta_data`, which `createUser` currently does not do
(`insert into auth.users default values`).

Test what actually broke this time: that the trigger **never raises** on absent metadata, that the row
appears without any client call, that provision corrects once, and that a second provision does not
move `primary_surface`.

Then apply, deploy, and verify end-to-end. **Verification needs a real user token.** Anonymous
sign-ins were enabled briefly for the diagnosis and are OFF again (confirmed 2026-07-30) — either turn
them on again for the walk, or use a Kakao login. Once provisioning works, step 2 (`promise-approve`'s
happy path, still only ever run in PGlite) can be walked with **two anonymous users** instead of two
Kakao accounts — no PII, and it closes the last verification debt.

## Incidental findings

- The keys Supabase injects into Edge Functions are **new-format**: `SUPABASE_ANON_KEY` is
  `sb_publishable_…` (46 chars), `SUPABASE_SERVICE_ROLE_KEY` is `sb_secret_…` (41 chars). `.env` still
  ships the legacy anon JWT (208 chars, `eyJ…`). Both work today; CLAUDE.md §9's "기존 `anon public`
  JWT" describes the client side only.
- The project signs user tokens with a single **ES256** key (JWKS has one `kid`). Verified working
  end-to-end, so the alg is permanently off the suspect list.
- The Supabase CLI has a `--profile` flag. Two accounts on this machine have now caused the
  wrong-account 403 twice (2026-07-29 and 2026-07-30); profiles would end it structurally.
- `docs/handoff/2026-07-29-…md` still carries `authenticate`'s logging commit (`5680259`) as useful.
  It is — but note it could not have fired for this bug.
