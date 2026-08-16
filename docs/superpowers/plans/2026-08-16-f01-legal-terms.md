# F-01 Legal Terms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public draft legal documents, connect both login surfaces to them, and record one server-owned terms agreement for every new or previously unrecorded user.

**Architecture:** `packages/shared` owns draft metadata and URL construction. The Vite app serves token-based public document pages, and the mobile app opens those pages through `Linking`. A forward Postgres migration records consent in the auth-user transaction, backfills only users with no prior agreement during `lf_user_provision`, and removes direct client writes.

**Tech Stack:** TypeScript, Vitest, React, React Router, React Native, jest-expo, PostgreSQL, PGlite, Supabase Auth triggers.

## Global Constraints

- Legal status is `DRAFT`; both document versions are `2026-08-16-draft.1` with effective date `2026-08-16`.
- Public paths are exactly `/legal/terms` and `/legal/privacy`.
- The draft must show `[배포 전 입력 필요]` for every unknown operator or transfer fact.
- `LEGAL_DISCLAIMER` remains byte-for-byte unchanged and appears expanded on both pages.
- Product copy is Korean and lives in label/content constants, not screen components.
- New users receive an agreement atomically; legacy users are backfilled only when they have no agreement rows.
- A later document version never creates implicit consent for a user with any prior agreement.
- `anon` and `authenticated` cannot insert `terms_agreements` directly.
- No ads, design-reference edits, remote deployment, `supabase config push`, `origin` push, or `.claude/settings.local.json` changes.

---

### Task 1: Shared legal metadata and URL contract

**Files:**
- Create: `packages/shared/src/legal.ts`
- Create: `packages/shared/src/legal.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `LegalDocumentStatus`, `LegalDocumentKind`, `LegalDocumentMetadata`, `LEGAL_DOCUMENTS`, `legalDocumentPath(kind)`, and `buildLegalDocumentUrl(baseUrl, kind)`.
- Consumes: `IsoDate` from `packages/shared/src/promise.ts`.

- [ ] **Step 1: Write the failing metadata tests**

```ts
import { describe, expect, it } from 'vitest';
import { LEGAL_DOCUMENTS, buildLegalDocumentUrl, legalDocumentPath } from './legal.ts';

describe('draft legal metadata', () => {
  it('publishes the approved draft versions and paths', () => {
    expect(LEGAL_DOCUMENTS).toEqual({
      TERMS: {
        kind: 'TERMS', status: 'DRAFT', version: '2026-08-16-draft.1',
        path: '/legal/terms', effective_date: '2026-08-16',
      },
      PRIVACY: {
        kind: 'PRIVACY', status: 'DRAFT', version: '2026-08-16-draft.1',
        path: '/legal/privacy', effective_date: '2026-08-16',
      },
    });
  });

  it('builds canonical HTTP URLs and rejects unsafe bases', () => {
    expect(buildLegalDocumentUrl('https://littlefinger.pages.dev/', 'TERMS'))
      .toBe('https://littlefinger.pages.dev/legal/terms');
    expect(() => buildLegalDocumentUrl('javascript:alert(1)', 'PRIVACY')).toThrow();
    expect(legalDocumentPath('PRIVACY')).toBe('/legal/privacy');
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run packages/shared/src/legal.test.ts`

Expected: FAIL because `legal.ts` does not exist.

- [ ] **Step 3: Implement the minimal shared contract**

```ts
import type { IsoDate } from './promise.ts';

export type LegalDocumentStatus = 'DRAFT' | 'FINAL';
export type LegalDocumentKind = 'TERMS' | 'PRIVACY';

export interface LegalDocumentMetadata {
  kind: LegalDocumentKind;
  status: LegalDocumentStatus;
  version: string;
  path: '/legal/terms' | '/legal/privacy';
  effective_date: IsoDate;
}

export const LEGAL_DOCUMENTS = {
  TERMS: { kind: 'TERMS', status: 'DRAFT', version: '2026-08-16-draft.1', path: '/legal/terms', effective_date: '2026-08-16' },
  PRIVACY: { kind: 'PRIVACY', status: 'DRAFT', version: '2026-08-16-draft.1', path: '/legal/privacy', effective_date: '2026-08-16' },
} as const satisfies Record<LegalDocumentKind, LegalDocumentMetadata>;

export function legalDocumentPath(kind: LegalDocumentKind): LegalDocumentMetadata['path'] {
  return LEGAL_DOCUMENTS[kind].path;
}

export function buildLegalDocumentUrl(baseUrl: string, kind: LegalDocumentKind): string {
  const url = new URL(legalDocumentPath(kind), baseUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('INVALID_LEGAL_BASE_URL');
  return url.toString();
}
```

Export `./legal.ts` from `index.ts`.

- [ ] **Step 4: Verify GREEN and shared regression**

Run: `npx vitest run packages/shared/src/legal.test.ts packages/shared/src/api.test.ts packages/shared/src/promise.test.ts`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/legal.ts packages/shared/src/legal.test.ts packages/shared/src/index.ts
git commit -m "feat: define draft legal document contract"
```

---

### Task 2: Public terms and privacy draft pages

**Files:**
- Create: `apps/web/src/legal/legal-content.ts`
- Create: `apps/web/src/screens/legal-document.tsx`
- Create: `apps/web/src/screens/legal-document.test.tsx`
- Modify: `apps/web/src/routes.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/styles/screens/web.css`

**Interfaces:**
- Consumes: `LEGAL_DOCUMENTS`, `LEGAL_DISCLAIMER`, `LegalDocumentKind`, and `legalDocumentPath` from Task 1.
- Produces: public React routes for `/legal/terms` and `/legal/privacy`.

- [ ] **Step 1: Write failing page and route tests**

```tsx
it.each([
  ['/legal/terms', '이용약관', '서비스 이용계약'],
  ['/legal/privacy', '개인정보 처리방침', '처리하는 개인정보'],
])('opens %s without authentication', (path, title, section) => {
  renderAt(path);
  expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
  expect(screen.getByText('비배포용 초안')).toBeTruthy();
  expect(screen.getByText(section)).toBeTruthy();
  expect(screen.getByText(LEGAL_DISCLAIMER)).toBeTruthy();
  expect(screen.getAllByText(/\[배포 전 입력 필요\]/u).length).toBeGreaterThan(0);
  expect(document.querySelector('ins, iframe, .lf-ad')).toBeNull();
});
```

Add assertions that the privacy page states `이메일과 전화번호는 수집하지 않습니다`, and that both pages expose version `2026-08-16-draft.1` and effective date `2026-08-16`.

- [ ] **Step 2: Run the focused web tests and verify RED**

Run: `npx vitest run apps/web/src/screens/legal-document.test.tsx apps/web/src/App.test.tsx`

Expected: FAIL because the legal routes and component do not exist.

- [ ] **Step 3: Add exact draft content constants**

Create `LEGAL_DRAFT_LABELS` with these visible values:

```ts
export const LEGAL_DRAFT_LABELS = {
  draftBadge: '비배포용 초안',
  draftNotice: '이 문서는 개발 검증용 초안입니다. 실제 사업자 정보 입력과 법률 검토 전에는 배포할 수 없습니다.',
  missingOperator: '[배포 전 입력 필요: 사업자명·대표자·사업자등록번호·주소·고객지원 연락처]',
  missingPrivacyOfficer: '[배포 전 입력 필요: 개인정보 보호책임자 이름·직책·이메일·전화번호]',
  missingTransfers: '[배포 전 입력 필요: 수탁자별 국가·이전 일시와 방법·보유기간 확인]',
  termsTitle: '이용약관',
  privacyTitle: '개인정보 처리방침',
} as const;
```

Define terms sections named `서비스 이용계약`, `계정`, `약속 기록`, `서비스 이용`, `금지 행위`, `기록 보존과 탈퇴`, `서비스 변경과 중단`, `책임과 면책`, `분쟁 해결`, and `운영자 정보`. Define privacy sections named `처리하는 개인정보`, `처리 목적`, `보유 및 이용기간`, `제3자 제공`, `처리위탁과 국외 처리`, `정보주체의 권리`, `안전성 확보조치`, `개인정보 보호책임자`, and `방침 변경`. Include the concrete data and retention facts from the approved design; use the three exact placeholder constants for unknown facts.

- [ ] **Step 4: Implement the shared page and routes**

```tsx
export function LegalDocument({ kind }: { kind: LegalDocumentKind }): React.JSX.Element {
  const metadata = LEGAL_DOCUMENTS[kind];
  const document = LEGAL_DRAFT_CONTENT[kind];
  return (
    <main className="lf-legal">
      <article className="lf-legal__document">
        <p className="lf-legal__draft">{LEGAL_DRAFT_LABELS.draftBadge}</p>
        <h1>{document.title}</h1>
        <p>{LEGAL_DRAFT_LABELS.draftNotice}</p>
        <p>{`버전 ${metadata.version} · 시행 예정일 ${metadata.effective_date}`}</p>
        {document.sections.map((section) => (
          <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((text) => <p key={text}>{text}</p>)}</section>
        ))}
        <p className="lf-disclaimer">{LEGAL_DISCLAIMER}</p>
      </article>
    </main>
  );
}
```

Add `ROUTE.terms` and `ROUTE.privacy`, then register both before the wildcard route. Style only with existing token variables, including readable line length, responsive gutters, visible focus, and no fixed viewport wrapper.

- [ ] **Step 5: Verify GREEN and build the web app**

Run: `npx vitest run apps/web/src/screens/legal-document.test.tsx apps/web/src/App.test.tsx`

Run: `npm run build:web`

Expected: tests PASS and the Vite build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/legal/legal-content.ts apps/web/src/screens/legal-document.tsx apps/web/src/screens/legal-document.test.tsx apps/web/src/routes.ts apps/web/src/App.tsx apps/web/src/App.test.tsx apps/web/src/styles/screens/web.css
git commit -m "feat: publish draft legal documents"
```

---

### Task 3: Connect app and web login links

**Files:**
- Create: `apps/mobile/src/lib/legal-native.ts`
- Create: `apps/mobile/src/lib/legal-native.test.ts`
- Modify: `apps/mobile/src/app/index.tsx`
- Modify: `apps/mobile/src/screens/scr-a01-login.test.tsx`
- Modify: `apps/web/src/screens/scr-w01-invite-landing.tsx`
- Modify: `apps/web/src/screens/scr-w01-invite-landing.test.tsx`

**Interfaces:**
- Consumes: `buildLegalDocumentUrl` and `legalDocumentPath` from Task 1.
- Produces: `openLegalDocument(kind)` for native callers and accessible legal links on both login surfaces.

- [ ] **Step 1: Write failing native URL and login-link tests**

```ts
it('opens the terms page from the configured web origin', async () => {
  await openLegalDocument('TERMS', {
    baseUrl: 'https://littlefinger.pages.dev/',
    openUrl: jest.fn().mockResolvedValue(undefined),
  });
  expect(openUrl).toHaveBeenCalledWith('https://littlefinger.pages.dev/legal/terms');
});
```

In SCR-A01, press the separately accessible `이용약관` and `개인정보 처리방침` links and assert the native wrapper receives `TERMS` and `PRIVACY`. In SCR-W01, assert the same-origin anchors use `/legal/terms` and `/legal/privacy`, and that clicking them does not call `signInWithOAuth`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm run test --workspace=@littlefinger/mobile -- src/lib/legal-native.test.ts src/screens/scr-a01-login.test.tsx --runInBand`

Run: `npx vitest run apps/web/src/screens/scr-w01-invite-landing.test.tsx`

Expected: FAIL because the wrapper and interactive links do not exist.

- [ ] **Step 3: Implement the native wrapper and accessible links**

```ts
export async function openLegalDocument(
  kind: LegalDocumentKind,
  deps = { baseUrl: process.env.EXPO_PUBLIC_WEB_BASE_URL ?? '', openUrl: Linking.openURL },
): Promise<void> {
  await deps.openUrl(buildLegalDocumentUrl(deps.baseUrl, kind));
}
```

Replace nested non-interactive login text with two 48dp `Pressable` links and a separate agreement sentence. Catch open failures, keep the login screen mounted, and render `법적 문서를 열 수 없습니다. 잠시 후 다시 시도해 주세요.` in the existing alert region. Add same-origin React Router links below the SCR-W01 CTA without changing OAuth behavior or invite-token storage.

- [ ] **Step 4: Verify GREEN and screen regressions**

Run the two focused commands from Step 2.

Expected: all tests PASS; existing cancellation, OAuth, and no-ad tests remain green.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/legal-native.ts apps/mobile/src/lib/legal-native.test.ts apps/mobile/src/app/index.tsx apps/mobile/src/screens/scr-a01-login.test.tsx apps/web/src/screens/scr-w01-invite-landing.tsx apps/web/src/screens/scr-w01-invite-landing.test.tsx
git commit -m "feat: connect login legal document links"
```

---

### Task 4: Server-owned agreement recording

**Files:**
- Create: `supabase/migrations/20260816000003_f01_terms_agreements.sql`
- Modify: `supabase/tests/user-provisioning.test.ts`
- Modify: `supabase/tests/rls.test.ts`
- Modify: `supabase/tests/schema.test.ts`
- Modify: `packages/shared/src/legal.test.ts`

**Interfaces:**
- Consumes: draft versions from Task 1, duplicated through `lf_current_terms_version()` and `lf_current_privacy_version()`.
- Produces: atomic new-user recording and idempotent legacy backfill through the existing `lf_user_stub` and `lf_user_provision` signatures.

- [ ] **Step 1: Write failing database behavior tests**

Add tests that prove:

```ts
test('a new auth user receives one current agreement in the trigger transaction', async () => {
  const userId = await createAuthUser();
  expect(await agreements(userId)).toEqual([{
    terms_version: '2026-08-16-draft.1',
    privacy_version: '2026-08-16-draft.1',
  }]);
});

test('provision backfills only a user with no agreement history', async () => {
  const userId = await createLegacyPublicUserWithoutAgreement();
  await provision(userId, 'APP');
  await provision(userId, 'WEB');
  expect(await agreements(userId)).toHaveLength(1);
});
```

Also seed an old agreement and prove provisioning does not add the draft version. Assert `anon` and `authenticated` direct inserts fail, self-read still succeeds, the unique key rejects a duplicate, and SQL version functions match `LEGAL_DOCUMENTS`.

Replace `public.lf_current_terms_version()` temporarily in the PGlite test so it raises an exception, insert a new `auth.users` row, and assert the complete statement rolls back: no `auth.users`, `public.users`, or `terms_agreements` row may remain for that UUID. Restore the function definition before the next test.

- [ ] **Step 2: Run focused PGlite tests and verify RED**

Run: `npx vitest run supabase/tests/user-provisioning.test.ts supabase/tests/rls.test.ts supabase/tests/schema.test.ts packages/shared/src/legal.test.ts`

Expected: FAIL because current agreements, unique enforcement, and write revocation are absent.

- [ ] **Step 3: Implement the forward migration**

The migration must:

```sql
create or replace function public.lf_current_terms_version()
returns text language sql immutable set search_path = ''
as $$ select '2026-08-16-draft.1'::text $$;

create or replace function public.lf_current_privacy_version()
returns text language sql immutable set search_path = ''
as $$ select '2026-08-16-draft.1'::text $$;

create unique index terms_agreements_version_unique
  on public.terms_agreements (user_id, terms_version, privacy_version);

revoke insert on public.terms_agreements from anon, authenticated;
```

Drop the legacy `"terms insert own"` RLS policy. Replace `lf_user_stub` so it inserts `public.users` and then the current agreement before returning. Remove the legacy `exception when others then return new` block: the approved F-01 invariant requires either all three records (`auth.users`, `public.users`, and the current agreement) or none. Update the function comment so it no longer claims that trigger failures are swallowed. Replace `lf_user_provision` with the complete hardened profile logic from `20260730000012_user_provisioning_hardening.sql` plus:

```sql
if not exists (
  select 1 from public.terms_agreements where user_id = p_user_id
) then
  insert into public.terms_agreements (user_id, terms_version, privacy_version)
  values (p_user_id, public.lf_current_terms_version(), public.lf_current_privacy_version())
  on conflict do nothing;
end if;
```

Revoke the version functions from `public`, `anon`, and `authenticated`; grant them and `lf_user_provision` only to `service_role`. Keep the trigger function non-callable by PostgREST through its `trigger` return type.

- [ ] **Step 4: Verify GREEN and provisioning regressions**

Run the focused command from Step 2.

Run: `npx vitest run supabase/tests/edge-user-provision.test.ts apps/web/src/lib/user-provision.test.ts apps/mobile/src/lib/kakao-auth.test.ts`

Expected: all tests PASS, and `user-provision` remains a 204 idempotent repair path.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260816000003_f01_terms_agreements.sql supabase/tests/user-provisioning.test.ts supabase/tests/rls.test.ts supabase/tests/schema.test.ts packages/shared/src/legal.test.ts
git commit -m "feat: record server-owned terms agreements"
```

---

### Task 5: F-01 verification and status

**Files:**
- Modify: `docs/DEVELOPMENT_STATUS.md`

**Interfaces:**
- Consumes: all F-01 deliverables.
- Produces: an accurate local-only status and production legal release gate.

- [ ] **Step 1: Run the complete verification matrix**

Run:

```bash
npm test
npm run typecheck
npm run build:web
npm run check:agents
npx expo install --check
npx expo export --platform android --output-dir C:\tmp\littlefinger-f01-legal-20260816
git diff --check
```

Expected: every command exits 0. Record actual test and module counts.

- [ ] **Step 2: Perform the structural legal-page review**

At 360x800, verify the title, `비배포용 초안` banner, version, content headings, placeholders, expanded disclaimer, keyboard focus, scroll completion, and absence of ads. Record that this is a structural review, not legal or pixel approval.

- [ ] **Step 3: Update development status**

State that F-01 is technically complete only as a local draft. List the production blockers: operator facts, processor/transfer verification, counsel review, `DRAFT` to `FINAL` version change, Cloudflare deployment, Supabase migration, and real app/web sign-in UAT.

- [ ] **Step 4: Verify and commit the status update**

Run: `git diff --check && npm run check:agents`

```bash
git add docs/DEVELOPMENT_STATUS.md
git commit -m "docs: record F-01 legal draft status"
```
