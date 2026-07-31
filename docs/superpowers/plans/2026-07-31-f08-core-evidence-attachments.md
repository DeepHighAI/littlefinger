# F-08 Core Evidence Attachments Implementation Plan

## Goal

Add optional fulfillment evidence upload and viewing to SCR-A06 and SCR-W04 without claiming the
entire F-08 feature. Each image is pre-uploaded, processed on the server, and bound to a fulfillment
answer in the `fulfillment-submit` transaction.

Confirmed product decisions:

- Accept JPEG, PNG, WEBP, and HEIC inputs up to 5 MB.
- Store only server-generated JPEG files: a maximum 1920 px full image and a 320 px thumbnail.
- Apply orientation, resize, metadata stripping, and JPEG encoding on the server.
- Allow at most three images per participant, promise, and fulfillment round.
- Display blinded evidence as `신고 접수로 가려진 이미지입니다`.
- Defer reporting and moderator workflows, SCR-A05, and SCR-W05 integration.

## Task 1: Policy and Shared Contracts

1. Write failing shared-package tests for the 5 MB boundary, supported input formats, count limit,
   evidence views, upload/discard/sign contracts, validation fields, and endpoint slugs.
2. Confirm the failures are caused by missing or outdated behavior.
3. Update policy constants, validators, API contracts, exports, and the detailed specification.
4. Run focused tests, shared type checking, and regression tests.
5. Commit as `feat: define core evidence attachment contracts`.

## Task 2: Database Storage Lifecycle

1. Generate a migration with the Supabase CLI.
2. Write failing PGlite tests for upload reservation, authorization, round and state checks,
   idempotency, the three-upload limit, READY binding, retained/removed evidence on revision,
   participant privacy, signing eligibility, purge targets, and repeatable J-08 execution.
3. Add the internal `evidence_uploads` table, private Storage bucket configuration, evidence
   lifecycle columns, RPCs, direct-access revocations, and the J-08 schedule.
4. Extend fulfillment submission, detail, and due-close transactions so evidence binding and
   retention dates are committed atomically with the answer and verdict.
5. Run focused PGlite tests, full Supabase tests, advisors where available, and type checking.
6. Commit as `feat: add evidence storage lifecycle`.

## Task 3: Image Processing and Edge Functions

1. Add fixed JPEG, PNG, WEBP, HEIC, and GPS EXIF fixtures.
2. Write failing tests for image format detection, output JPEG, orientation, dimensions, metadata
   removal, MIME spoofing, corruption, the 5 MB boundary, Storage partial failures, safe logging,
   JWT/custom-secret authorization, idempotency, discard, signing, and purge retries.
3. Pin `@imagemagick/magick-wasm@0.0.39` and implement
   auto-orient → resize → strip → JPEG encode.
4. Add pure handlers and thin entries for `evidence-upload`, `evidence-discard`,
   `evidence-sign-url`, and `evidence-purge`.
5. Update fulfillment detail and submit handlers to the new contracts.
6. Run handler, fixture, bundle, type, and regression tests.
7. Commit as `feat: add evidence processing edge functions`.

## Task 4: SCR-A06 Mobile Integration

1. Install the Expo SDK 57-compatible `expo-image-picker`.
2. Write failing Jest tests for permission denial, local validation, three-image limit, parallel
   uploads, progress/retry/removal, submit gating, partial failure, revision retention, placeholders,
   signed URL refresh, encrypted draft storage, and absence of ads.
3. Add the evidence API/controller and encrypted per-user/promise/round draft.
4. Port the 84 dp evidence tile and delete affordance using design tokens only.
5. Run focused Jest tests, mobile type checking, Expo dependency checks, and visual comparison.
6. Commit as `feat: connect app fulfillment evidence`.

## Task 5: SCR-W04 Web Integration

1. Write failing Vitest tests for multi-file selection, validation, parallel upload, object URL
   cleanup, partial failure, retry/removal, revision, history/result viewing, placeholders, and
   signed URL refresh.
2. Store only answer, comment, and successful upload IDs in scoped `sessionStorage`; never store
   files or signed URLs.
3. Reuse the approved attachment and proof styles and connect the evidence API/controller.
4. Run focused web tests, web type checking, production build, and visual comparison.
5. Commit as `feat: connect web fulfillment evidence`.

## Task 6: Verification and Deployment

1. Run:
   - evidence image/EXIF tests
   - PGlite authorization, concurrency, retention, and J-08 tests
   - all handler, mobile, and web tests
   - `npm test`
   - `npm run typecheck`
   - `npm run build:web`
   - `npm run check:agents`
   - `npx expo install --check`
   - Android production export
   - `git diff --check`
2. Compare SCR-A06 and SCR-W04 at 360×800 with the approved references and record intentional
   error, blinded, and expired states.
3. Commit any verification-only corrections atomically.
4. Apply the committed migration and deploy the six affected Edge Functions with `--use-api`.
   If the known CLI role 403 recurs, use the authenticated Management API server-bundling path and
   report the difference. Never run `supabase config push`.
5. Verify private bucket settings, JPEG-only stored outputs, revoked Data API access, authorization
   and strategic-response privacy, 600-second URLs, format and size boundaries, stripped EXIF/GPS,
   repeatable J-08 cleanup, and security/performance advisors.
6. Run two-account app/web UAT when a second Kakao account is available. Otherwise report the
   automated and remote verification as complete while leaving two-account UAT explicitly pending.

## Security Constraints

- Never persist or log source files, source filenames, multipart bodies, Storage paths, signed URLs,
  or internal purge secrets.
- Keep full and thumbnail objects private and expose them only through 10-minute signed URLs.
- Do not reveal counterpart evidence metadata or URLs before the caller submits in the round.
- Revoke direct Data API access to evidence tables and all unintended RPC execution privileges.
- Pin every `SECURITY DEFINER` function to a controlled `search_path` and enforce the caller inside
  the function.
- On partial Storage or purge failure, keep database state retryable and do not mark an object as
  purged until deletion succeeds.
