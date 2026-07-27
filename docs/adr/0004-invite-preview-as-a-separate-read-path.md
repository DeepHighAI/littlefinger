# ADR 0004 — Serve SCR-W02 from a separate `invite-preview` read path

- Status: Accepted
- Date: 2026-07-27
- Extends: ADR 0003 (the shell/RPC split this reuses)
- Amends: `04_AI-Agent_코딩가이드` §7-3, whose Edge Function list has no read endpoint
- Deciders: PO (대표)

## Context

SCR-W02 is the conversion screen the acceptance web exists for: the partner opens a KakaoTalk link,
reads what they are agreeing to, and approves. `02` §4-3-4 lists what it must show — 약속 전문,
종료일과 D-Day, 보상/벌칙, 지킬 사람, 작성자 프로필, 증인 사용 예정 여부.

Nothing in the system could serve that payload.

**`invite-resolve` cannot.** It returns four fields and is deliberately thin: it is
`verify_jwt = false`, callable by the entire internet, and IP-rate-limited, because it runs *before*
Kakao login. Its design principle is what it refuses to return — `02` §4-3-3 frames this as
링크 유출 대비. The promise content is exactly the thing a leaked link must not expose.

**RLS cannot.** At PENDING the invited partner has no `promise_participants` row. `lf_promise_create`
(migration `20260727000009`) inserts a CREATOR row and nothing else, and the PARTNER row is written
inside `lf_promise_approve` — *after* approval. So `can_read_promise()` is false for the one person
the screen is for, and `select * from promises` returns an empty set.

The invite is a **link, not an address**. Nobody knows which `user_id` will open it until someone
does. That single fact is what rules out the cheaper options below.

## Decision

**A fifth Edge Function, `invite-preview`, backed by a `stable` Postgres function.** It is
`verify_jwt = true`, takes the invite token, re-runs `lf_invite_resolve`'s guard order plus
`lf_promise_approve`'s participant guards, and returns the full current version — without consuming
the invite.

`stable` is not a performance hint here. It is the enforcement mechanism: the function is
structurally incapable of consuming, revoking or extending the invitation, so the token-consuming
boundary stays where `02` §7-1 puts it, at T-03.

**The participant guards run before any content is selected.** A creator opening their own link, a
blocked user, or someone who already holds a role gets the error, not the promise. Reading is the
easiest place to leak, precisely because nothing is written and the leak leaves no trace.

### Rejected alternatives

**(B) Write an `INVITED` participant row at T-02, and let RLS serve the read.** Cheaper in code, and
less foreign to the schema than it first appears — `can_read_promise()` already admits
`pp.status in ('INVITED','JOINED')` and lets CREATOR/PARTNER bypass the DRAFT/PENDING exclusion, so
the branch was written expecting something like this and is currently unreachable. It still fails on
the fact above: there is no `user_id` at T-02. Writing the row at first authenticated open puts a
write on the read path, which is the property `stable` on `lf_invite_resolve` exists to deny.

**(C) Widen `invite-resolve` to return the full content when a JWT is present.** Puts the pre-login
and post-login payloads in one function whose entire value is the difference between them, on the
one endpoint the whole internet can call, sharing a single IP rate-limit bucket between an
unauthenticated probe and a legitimate participant.

## Consequences

**The acceptance web now has a read endpoint, and only one.** Anything else SCR-W02 or SCR-W03 later
needs — 버전 이력 (`02` §4-4-3) is the known case — extends this function rather than adding another.
Version history is deliberately **not** in the first payload; it is an open PO item.

**`02` §9's permission matrix now has a reader with no participant row.** The matrix is expressed in
RLS everywhere else. Here it is expressed in the guard sequence of one `stable` function, which
means that sequence is load-bearing in a way policy text is not — it has to be tested branch by
branch rather than trusted.

**Two functions must keep the same guard order forever.** `lf_invite_preview` and `lf_invite_resolve`
answer the same question about the same token at two different moments. If they drift, a user reads
a promise the approve path will then refuse, or reads an error for a token that would have worked.
The tests compare them rather than checking each alone.

**Still no notification, no transition, no write.** `02` §8-1 attaches nothing to a read, and §7-1
has no transition for it.
