# Handoff — B1-6 (Edge Function shells)

Date: 2026-07-27. Follows `2026-07-26-b1-5-decline-amend.md`.

## Status

**B1-6 complete, deployed, and rate-limited.** `npm test` → Vitest **685 passed** (19 files),
jest-expo **137 passed**. `npm run typecheck` clean across **four** projects (was two).
`npm run check:agents` clean.

Migrations 0001–0008 are applied to `vepnrrmxvsytguocicfe` and all four functions are live.
Commits: `22602ef` (shells) · `4b86e83` (deploy record) · `b4935c0` (rate limit) · `649d998`
(Kakao / config.toml). Not pushed.

| File | What |
|---|---|
| `supabase/functions/_shared/*.ts` | errors · hash · http · request · notify · transition · deps · runtime |
| `supabase/functions/{invite-resolve,promise-approve,promise-decline,promise-amend}/` | `handler.ts` (pure) + `index.ts` (`Deno.serve` only) |
| `supabase/functions/{deno.d.ts,tsconfig.json}` | ambient Deno surface + the tsc project |
| `packages/shared/src/api.ts` | HTTP contract — error body, request shapes, endpoint slugs |
| `packages/shared/src/notification.ts` | NT codes, titles, deeplinks, `dedupe_key` builders |
| `…/migrations/20260727000008_rate_limit.sql` | `rate_limit_counters` + `lf_rate_limit_hit` |
| `supabase/tests/edge-{shared,handlers,bundle}.test.ts` · `rate-limit.test.ts` | 128 tests |
| `supabase/tests/tsconfig.json` | `supabase/tests` was never type-checked before |

## PO decisions taken this session (8)

| # | Question | Decision |
|---|---|---|
| 1 | How does the shell reach `packages/shared`? | **Rewrite its internal specifiers `.js` → `.ts`** + `allowImportingTsExtensions` |
| 2 | `token_hash` pepper? | **`SHA-256(token + INVITE_TOKEN_PEPPER)`**; `02` §6-2 corrected |
| 3 | Does B1-6 write notification rows? | **INAPP only**, `status='SENT'`. PUSH lands with `push-send` in M2 |
| 4 | `dedupe_key` format | **Two shapes** — transitions end in `{idempotency_key}`, batch jobs in `{yyyymmdd}` (KST) |
| 5 | Where does the notification body's promise title come from? | **Added `title` to all three RPC payloads** |
| 6 | NT-01/02/03 copy | **Design-reference brand tone** |
| 7 | Rate limit strength | **60 requests / 10 min per IP** — generous because Korean carriers use CGNAT and that is the KakaoTalk in-app browser path |
| 8 | Rate limit scope | **`invite-resolve` only** — the other three are JWT-gated and already bounded by idempotency keys and one-use tokens |

## The one thing that must not regress

**`packages/shared` relative imports must stay `.ts`.** `tsc` (`moduleResolution: bundler`), Vitest,
and jest-expo all accept `./config.js` pointing at `config.ts` — so every local check passes. Deno
does not, and the Supabase CLI's collector is a text scanner that **`WARN`s and skips** a file it
cannot open. The deploy then fails at bundle time with Module not found, and nothing before that says
a word.

`supabase/tests/edge-bundle.test.ts` walks the module graph from each of the four entrypoints exactly
the way the CLI collector does. Verified by mutation: reverting `errors.ts` to `./config.js` fails 5
tests and names `./config.js` in the output.

## Two things that cost hours — do not rediscover them

**1. The client IP is `cf-connecting-ip`, not any position in `x-forwarded-for`.**
Cloudflare fronts Supabase Edge Functions. Measured against the deployed platform, not assumed:

| header | observed |
|---|---|
| `cf-connecting-ip` | the real client address, **constant** across requests |
| `x-forwarded-for` | `[client, client, internal hop]` — the **last entry rotates every request** |
| a client-supplied `X-Forwarded-For` | **dropped entirely** — the forged value never arrives |

The first implementation read the *last* entry, on the general principle that a proxy appends what it
observed. That principle is right and the conclusion was wrong: the last slot here is an internal hop,
so every request minted a fresh rate-limit bucket and **210 live requests never once returned 429**.
The only thing that settled it was deploying a throwaway function that echoed hashed hops, sending a
few requests, and seeing which position stayed constant. Do that again rather than reasoning about
XFF semantics — it took one deploy and two minutes.

**2. A fixed 10-minute window makes a naive burst test lie.**
After the fix was already correct, a 70-request loop still produced no 429 — because it straddled a
window boundary, so neither window reached 61. Reading `rate_limit_counters` directly showed
`hits = 60` sitting exactly at the cap (the 61st raises and rolls its own increment back, so 60 is
the ceiling a stored row can show). **Check the counter table before concluding the limiter is
broken.** A throwaway function with the service-role client can read it; nothing else can.

## Decisions not in the spec (flag these at the Codex review)

| # | Decision | Why |
|---|---|---|
| D-v | **Migrations 0006/0007 were edited in place** rather than re-issued in a new 0008 | `04` §7-1 says add-only, but that rule protects *applied* migrations and nothing has been applied (`db push` is still deferred). A `create or replace` 0008 would have duplicated ~570 lines and left the **mutation-tested copy as the stale one** — the exact two-sources problem ADR 0003 pays a cross-check test to prevent. Reversible; say the word and it becomes 0008 |
| D-w | `title` is read from the **version row**, not `promises.title` | `promises` content columns are a list-view cache; the original is `promise_versions` (§6-2). It matters most for T-05: after DRAFT regression the creator rewrites v1, and the notification must keep the title that was objected to. Three tests diverge the two values to prove which is read |
| D-x | `surface` is derived from the **presence of `Origin`** | `approvals` is append-only and cannot be corrected, so a client-declared value is permanent. `users.primary_surface` is the *signup* surface, a KPI field (§6-2) |
| D-y | `ip_hash`/`ua_hash` use a **new secret `PII_HASH_SALT`**, not the invite pepper | Sharing one secret means a single leak hands over both link authentication and an oracle for stored IPs. **PO action: register it in Supabase Secrets** alongside `INVITE_TOKEN_PEPPER` |
| D-z | Missing IP/UA headers pass **NULL**, not a hash of a placeholder | Both columns are nullable and the RPC itself writes NULL for the creator row. Hashing a placeholder makes different people share a hash, which makes the audit log lie |
| D-aa | Unknown raised messages become a **500 with EC-C02's copy**, original to the log only | Postgres puts table, column and value into constraint messages. Letting one through breaks §9 on the failure path only — the path nobody watches |
| D-ab | `E_VALIDATION` means **one specific field per function** | The RPC raises it bare, but approve has no user input at all (so it can only be the end date), decline only `reason`, amend only `comment`. Approve additionally carries `action: 'AMEND_SUGGEST'` — without it SCR-W02 has no basis to render EC-B10's [종료일 변경 요청하기] and the promise is stuck in PENDING |
| D-ac | Shell-thrown `ApiError`s **do not inherit** the per-function validation meaning | Otherwise a missing `Idempotency-Key` answers "종료일이 지났어요". A test holds this |
| D-ad | `Idempotency-Key` must be a **UUID**, rejected otherwise | A client sending a constant would pin all its requests to the first response forever, and `lf_idempotency_begin` cannot tell the difference — returning the cache is its job |
| D-ae | The shell **never** normalizes or measures text | §2-3 puts normalization before counting and the RPC owns both. A length check in the shell would run on un-normalized input and reject valid Korean typed as conjoining jamo |
| D-af | Every function split into `handler.ts` + `index.ts` | Not style. A Deno global at module top level makes the file unimportable by Vitest, so logic in `index.ts` is logic no test can reach |
| D-ag | `@supabase/supabase-js` added as a **root devDependency** | Only so `runtime.ts` gets real types via the `npm:` shim in `deno.d.ts`. Excluding the one file that talks to the outside world from tsc was the alternative |
| D-ah | Deploys must pass **`--use-api`** | Without it the CLI bundles with Docker when present and silently falls back to the API bundler when not, so the same source builds two ways depending on the machine |
| D-ai | `notifications.type` = NT codes, `deeplink` = screen IDs | Both are §6-2/§8-1 verbatim, not inventions. Screen IDs because `notifications` has no UPDATE policy — a wrong URL written today can never be corrected |

## Verified on the live instance (2026-07-27, after deploy)

These are the things PGlite structurally could not reach.

| Check | Result |
|---|---|
| Migrations 0001–0008 applied | `migration list` — local and remote paired; `db push --dry-run` reports "up to date" |
| `anon` calling a server-only `lf_*` with **correct arguments** | `42501 permission denied for function` |
| Control: `can_read_promise` (deliberately not revoked) | HTTP 200 — so the block above is privilege, not signature mismatch |
| `anon` INSERT into `app_configs` | rejected, "new row violates row-level security policy" |
| `--use-api` bundling of the cross-directory import | **`packages/shared/src/config.ts` appears in the upload list for every function** — the transitive hop that a `.js` specifier would have dropped |
| `invite-resolve` end to end | HTTP 404 `{"code":"E_NOT_FOUND","message":"약속을 찾을 수 없어요."}` — module graph, secrets, service_role, RPC and error mapping all live |
| `verify_jwt = true` on the three transitions | platform rejects with `UNAUTHORIZED_NO_AUTH_HEADER` before our code runs |
| `verify_jwt = false` on `invite-resolve` | answers with **no apikey at all** |
| anon key used as the JWT on `promise-approve` | **passes the platform gate, blocked by our own `authenticate`** → `E_AUTH_REQUIRED`. The redundant check in `deps.ts` earned its place |
| CORS preflight | 204, `access-control-allow-headers` includes `idempotency-key` |
| `lf_rate_limit_hit` from an Edge Function | three calls returned `1, 2, 3` and the row persisted — the RPC layer works, isolated from the shell |
| Rate limit end to end | trips at 60 → HTTP 429 `{"code":"E_RATE_LIMIT","message":"잠시 후 다시 시도해 주세요."}` |
| Kakao provider | authorize redirect now carries a 32-char hex `client_id` and the correct `redirect_uri`. It had been the literal `littlefinger` |
| `env()` warnings | gone from every CLI command after the auth blocks became comments |

## What is still not proven

1. **RLS filtering is not demonstrated on the live instance.** Every table returns `[]` to `anon`, but
   the database is empty — an RLS filter and an empty table are indistinguishable from outside. The
   policies themselves are covered by `rls.test.ts` (28 tests) against real Postgres, and the INSERT
   rejection above confirms RLS is enabled. Redo the read checks once there is data.
2. **§13 parallel concurrency is still open** (EC-B06 · EC-C01 · EC-C03). Third handoff carrying it.
   It is now actually testable — the functions are live — so it has no excuse left.
3. **No transition has ever succeeded.** Every live call so far was a failure path; nothing has
   reached `lf_promise_approve`'s happy path, so the notification insert, the `dedupe_key` shape and
   `content_hash` generation are untested outside PGlite. Needs a real invite, which needs T-02.
4. **Metro** resolves `.ts` specifiers through the barrel (probed with jest-expo, then deleted). A real
   `expo start` bundle was not run.
5. **Kakao login has never completed a round trip.** The `client_id` is now the right shape and the
   redirect is correct, but nobody has actually signed in — that needs SCR-A01 or SCR-W01. `02` §6-1
   warns that a missing 비즈 앱 consent item fails with **KOE205 before the consent screen renders**,
   and that class of failure is invisible from the authorize URL alone.
6. **The rate limit only bounds a single source.** A distributed caller is unaffected, and CGNAT means
   one bucket can legitimately hold many users. It protects the Free-tier quota against one abusive
   client, nothing more. A global ceiling was considered and rejected — tripping it would take the
   whole acceptance web down, which an attacker could do deliberately.

## The exact next step

Secrets, `db push`, `functions deploy --use-api`, the rate limit and the Kakao `client_id` are all
**done**. What remains, in order:

1. **Turn on the keep-alive.** The GitHub Actions secrets are still unset, and the database now holds
   real schema rather than nothing. Free tier pauses after 7 idle days. This is the only item that
   can silently destroy work already done.
2. **T-02 (issue an invite).** Until it exists no transition can be exercised end to end, so the
   happy paths of all three shells — the notification insert, the `dedupe_key` shape, `content_hash`
   — remain PGlite-only. It also unblocks a real Kakao login round trip.
3. `supabase/tests/concurrency.pg.test.ts` driving two real `pg` clients over all three transition
   RPCs — closes the §13 item that three handoffs have now carried, and is finally testable.
4. **Redo the RLS read checks once there is data** (see "What is still not proven" #1).

**Migrations are append-only from here.** The window in which 0006/0007 could be edited in place
(D-v) closed the moment `db push` ran.

**Never run `supabase config push`** — see CLAUDE.md §3. `link`, `db push` and `functions deploy`
cannot touch config; that one command can, and it would PATCH the whole auth body from a file that
deliberately no longer describes auth.

## PO 확인 필요

**New:**

1. **~~`invite-resolve` 남용 방지~~ — 해결됨.** IP 당 10분 60회로 배포·검증 완료. 남은 한계는
   "What is still not proven" #6 참조 — 분산 호출은 막지 못하고 CGNAT 뒤 다수 사용자가 한 버킷을
   공유합니다.
2. **카카오 `client_id` 가 `littlefinger` 로 들어가 있었습니다 — PO 가 정정 완료.** 원인은 CLI 가
   아닙니다(`link`·`db push`·`functions deploy` 는 config 를 쓸 수 없음을 소스에서 확인). 대시보드
   수기 입력으로 보입니다. **로그인 왕복은 아직 미검증** — SCR-A01/W01 이 생겨야 하고, §6-1 의
   KOE205(비즈 앱 동의항목) 부류는 그때 드러납니다.
3. **EC-B02 의 "참여자 본인이면 약속 상세로" 분기는 구현하지 않았습니다.** `invite-resolve` 는
   로그인 전 함수라 누가 부르는지 모르고, 사용된 토큰에는 `E_INVITE_USED` 만 돌려줍니다. 로그인 전
   함수를 로그인 전 그대로 두는 편이 감사하기 쉬워서 그렇게 뒀습니다. SCR-W06 에
   [로그인하고 내 약속 보기] 를 두면 한 번 더 눌러 도달합니다. **B1-6 범위에서 구현이 없는 유일한
   §10 항목입니다** — 의도적 유예로 볼지 확인 부탁드립니다.
4. **마이그레이션 0006·0007 을 새 파일이 아니라 제자리에서 고쳤습니다** (위 D-v). `04` §7-1 의
   문자와 다릅니다. `db push` 가 끝난 지금은 되돌릴 수 없으므로 **기록으로만** 남깁니다 — 앞으로는
   같은 일을 할 수 없습니다.
5. **`supabase/config.toml` 에서 `[auth]` 와 카카오 블록을 주석으로 내렸습니다.** 대시보드가 정본이고,
   블록이 살아 있으면 `config push` 한 번에 로그인이 죽습니다(`client_id` 가 리터럴
   `env(KAKAO_REST_API_KEY)` 로 들어감 — `secret` 과 달리 가드가 없습니다). 의도값은 주석으로
   남겼습니다. config-as-code 를 하려면 C-3(수락 웹 도메인) 확정과 `littlefinger://**`,
   "Allow users without an email" 표현이 먼저 필요합니다.

**Carried forward, unchanged from B1-5:**

6. **재발송 대상이 바뀌면 새 상대는 참여할 수 없다** — T-05 가 수정 제안자의 `user_id` 를 PARTNER
   행에 남기므로, 작성자가 새 링크를 *다른 사람* 에게 보내면 `E_DUPLICATE_ROLE` 입니다.
7. **EC-B09 의 3일 DRAFT 리마인드에 `reminder_kind` 가 없습니다.** 미구현.
8. **DECLINED 약속이 살아 있는 증인 초대를 그대로 가질 수 있습니다.**
9. **SCR-W06 문구** — 승인된 마크업은 만료·사용됨을 한 문장으로 합치고 작성자를 이름으로 부르는데,
   실패 경로에는 payload 가 없어 이름을 실을 수 없습니다(EC-B01·B03·B11 이 금지하기도 합니다).
   에러 코드별 네 문장으로 가는 것을 권합니다.
10. **SCR-W01 헤드라인이 수신자를 이름으로 부릅니다** — 로그인 전이라 만들 수 없습니다.
11. **Actions secrets 미설정** — keep-alive 가 돌지 않고 있습니다. **DB 에 실제 스키마가 들어간
    지금은 우선순위가 올라갔습니다** — 7일 방치하면 정지됩니다.
12. NT-04/NT-05 의 조용한 시간 분류가 §8-3 에 없고, blinded-evidence 문구가 §4-8 과 EC-F06 에서
    다릅니다.
