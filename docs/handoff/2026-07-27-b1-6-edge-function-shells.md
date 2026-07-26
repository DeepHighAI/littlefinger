# Handoff — B1-6 (Edge Function shells)

Date: 2026-07-27. Follows `2026-07-26-b1-5-decline-amend.md`.

## Status

**B1-6 complete.** `npm test` → Vitest **660 passed** (18 files, 117 new), jest-expo **137 passed**.
`npm run typecheck` clean across **four** projects (was two). `npm run check:agents` clean.

The four shells exist, are tested, and are type-checked. **None of them has ever run.** Docker is not
installed on this machine, so `supabase functions serve` cannot start and no `supabase db push` has
happened — see "What the tests cannot prove".

| File | What |
|---|---|
| `supabase/functions/_shared/*.ts` | errors · hash · http · request · notify · transition · deps · runtime |
| `supabase/functions/{invite-resolve,promise-approve,promise-decline,promise-amend}/` | `handler.ts` (pure) + `index.ts` (`Deno.serve` only) |
| `supabase/functions/{deno.d.ts,tsconfig.json}` | ambient Deno surface + the tsc project |
| `packages/shared/src/api.ts` | HTTP contract — error body, request shapes, endpoint slugs |
| `packages/shared/src/notification.ts` | NT codes, titles, deeplinks, `dedupe_key` builders |
| `supabase/tests/edge-{shared,handlers,bundle}.test.ts` | 114 tests |
| `supabase/tests/tsconfig.json` | `supabase/tests` was never type-checked before |

## PO decisions taken this session (6)

| # | Question | Decision |
|---|---|---|
| 1 | How does the shell reach `packages/shared`? | **Rewrite its internal specifiers `.js` → `.ts`** + `allowImportingTsExtensions` |
| 2 | `token_hash` pepper? | **`SHA-256(token + INVITE_TOKEN_PEPPER)`**; `02` §6-2 corrected |
| 3 | Does B1-6 write notification rows? | **INAPP only**, `status='SENT'`. PUSH lands with `push-send` in M2 |
| 4 | `dedupe_key` format | **Two shapes** — transitions end in `{idempotency_key}`, batch jobs in `{yyyymmdd}` (KST) |
| 5 | Where does the notification body's promise title come from? | **Added `title` to all three RPC payloads** |
| 6 | NT-01/02/03 copy | **Design-reference brand tone** |

## The one thing that must not regress

**`packages/shared` relative imports must stay `.ts`.** `tsc` (`moduleResolution: bundler`), Vitest,
and jest-expo all accept `./config.js` pointing at `config.ts` — so every local check passes. Deno
does not, and the Supabase CLI's collector is a text scanner that **`WARN`s and skips** a file it
cannot open. The deploy then fails at bundle time with Module not found, and nothing before that says
a word.

`supabase/tests/edge-bundle.test.ts` walks the module graph from each of the four entrypoints exactly
the way the CLI collector does. Verified by mutation: reverting `errors.ts` to `./config.js` fails 5
tests and names `./config.js` in the output.

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

## What the tests cannot prove

1. **Nothing has run.** No Deno, no Docker, so `supabase functions serve` is unavailable and the four
   handlers have never executed on the real runtime. Covered by construction: `deps.ts` isolates every
   external call, `edge-bundle.test.ts` replicates the CLI's file collector, and `tsc` sees all 12
   function files. Not covered: whether the Edge Runtime accepts the module graph, whether
   `auth.getUser` behaves as assumed, and whether `verify_jwt` is applied as configured.
2. **§13 parallel concurrency is still open** (EC-B06 · EC-C01 · EC-C03). Third handoff carrying it.
   The shells are now the parallel-request surface PGlite never was, but only after a deploy.
3. **`--use-api` bundling is unverified** — it is deploy-only and, per Supabase's own announcement,
   experimental for exactly this monorepo case.
4. **Metro** resolves `.ts` specifiers through the barrel (probed with jest-expo, then deleted). A real
   `expo start` bundle was not run.

## The exact next step

**Deploy and verify, in this order.** Everything below is blocked until the two secrets exist.

1. PO registers `INVITE_TOKEN_PEPPER` and `PII_HASH_SALT` in Supabase Secrets, and the GitHub Actions
   secrets that keep-alive needs (still unset since B1-1 — Free tier pauses after 7 idle days).
2. `npx supabase db push` — the migrations have never been applied. `db push` first, functions second;
   the shells call RPCs that do not exist yet on the remote.
3. `npx supabase functions deploy --use-api`. Expect the module graph to be the first thing that
   breaks; `edge-bundle.test.ts` is the local proxy for it, not a guarantee.
4. `supabase/tests/concurrency.pg.test.ts` driving two real `pg` clients over all three transition
   RPCs — closes the §13 item.
5. Rate-limit `invite-resolve` before the URL is public. It is `verify_jwt = false`, so it is open to
   the internet with no abuse control at all. `E_RATE_LIMIT` → 429 already exists in
   `packages/shared/src/errors.ts`. Recommendation: a Postgres counter table, testable in the existing
   PGlite harness, rather than a third-party limiter holding token-derived keys.

## PO 확인 필요

**New:**

1. **`invite-resolve` 는 지금 아무 남용 방지 장치가 없습니다.** `verify_jwt = false` 라 인터넷 전체가
   부를 수 있고, 토큰을 계속 대입해 볼 수 있습니다. 토큰이 32바이트 난수라 맞힐 가능성은 사실상
   없지만, 호출 자체를 막을 것이 없어 무료 플랜 사용량을 태울 수는 있습니다. URL 을 공개하기 전에
   반드시 넣어야 합니다 (위 5번).
2. **EC-B02 의 "참여자 본인이면 약속 상세로" 분기는 구현하지 않았습니다.** `invite-resolve` 는
   로그인 전 함수라 누가 부르는지 모르고, 사용된 토큰에는 `E_INVITE_USED` 만 돌려줍니다. 로그인 전
   함수를 로그인 전 그대로 두는 편이 감사하기 쉬워서 그렇게 뒀습니다. SCR-W06 에
   [로그인하고 내 약속 보기] 를 두면 한 번 더 눌러 도달합니다. **B1-6 범위에서 구현이 없는 유일한
   §10 항목입니다** — 의도적 유예로 볼지 확인 부탁드립니다.
3. **마이그레이션 0006·0007 을 새 파일이 아니라 제자리에서 고쳤습니다** (위 D-v). `04` §7-1 의
   문자와 다릅니다. 적용된 적이 없어 결과는 같지만, 규칙을 지키는 쪽을 원하시면 0008 로 옮기겠습니다.

**Carried forward, unchanged from B1-5:**

4. **재발송 대상이 바뀌면 새 상대는 참여할 수 없다** — T-05 가 수정 제안자의 `user_id` 를 PARTNER
   행에 남기므로, 작성자가 새 링크를 *다른 사람* 에게 보내면 `E_DUPLICATE_ROLE` 입니다.
5. **EC-B09 의 3일 DRAFT 리마인드에 `reminder_kind` 가 없습니다.** 미구현.
6. **DECLINED 약속이 살아 있는 증인 초대를 그대로 가질 수 있습니다.**
7. **SCR-W06 문구** — 승인된 마크업은 만료·사용됨을 한 문장으로 합치고 작성자를 이름으로 부르는데,
   실패 경로에는 payload 가 없어 이름을 실을 수 없습니다(EC-B01·B03·B11 이 금지하기도 합니다).
   에러 코드별 네 문장으로 가는 것을 권합니다.
8. **SCR-W01 헤드라인이 수신자를 이름으로 부릅니다** — 로그인 전이라 만들 수 없습니다.
9. **Actions secrets 미설정** — keep-alive 가 돌지 않고 있습니다.
10. NT-04/NT-05 의 조용한 시간 분류가 §8-3 에 없고, blinded-evidence 문구가 §4-8 과 EC-F06 에서
    다릅니다.
