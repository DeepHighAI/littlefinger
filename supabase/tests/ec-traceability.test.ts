import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const EC_EVIDENCE = {
  'EC-A01': 'apps/mobile/src/screens/scr-a01-login.test.tsx',
  'EC-A02': 'apps/mobile/src/screens/scr-a01-login.test.tsx',
  'EC-A03': 'apps/mobile/src/screens/scr-a01-login.test.tsx',
  'EC-A04': 'apps/mobile/src/screens/profile-nickname.test.tsx',
  'EC-A05': 'supabase/tests/user-provisioning.test.ts',
  'EC-A06': 'apps/mobile/src/screens/scr-a01-login.test.tsx',
  'EC-A07': 'supabase/tests/account-safety.test.ts',
  'EC-B01': 'supabase/tests/invite-preview.test.ts',
  'EC-B02': 'apps/web/src/screens/scr-w02-promise-review.test.tsx',
  'EC-B03': 'supabase/tests/invite-resolve.test.ts',
  'EC-B04': 'supabase/tests/promise-approve.test.ts',
  'EC-B05': 'supabase/tests/promise-approve.test.ts',
  'EC-B06': 'supabase/tests/promise-approve.test.ts',
  'EC-B07': 'supabase/tests/invite-draft-batches.test.ts',
  'EC-B08': 'supabase/tests/promise-create-invite.test.ts',
  'EC-B09': 'supabase/tests/invite-draft-batches.test.ts',
  'EC-B10': 'supabase/tests/promise-approve.test.ts',
  'EC-B11': 'supabase/tests/invite-preview.test.ts',
  'EC-C01': 'supabase/tests/idempotency.test.ts',
  'EC-C02': 'supabase/tests/promise-approve.test.ts',
  'EC-C03': 'supabase/tests/promise-draft-update-revoke.test.ts',
  'EC-C04': 'supabase/tests/invite-preview.test.ts',
  'EC-D01': 'supabase/tests/witness-flow.test.ts',
  'EC-D02': 'supabase/tests/witness-flow.test.ts',
  'EC-D03': 'supabase/tests/witness-flow.test.ts',
  'EC-D04': 'supabase/tests/witness-flow.test.ts',
  'EC-D05': 'supabase/tests/invite-preview.test.ts',
  'EC-E01': 'supabase/tests/promise-amend-agreement.test.ts',
  'EC-E02': 'supabase/tests/promise-amend-agreement.test.ts',
  'EC-E03': 'supabase/tests/promise-amend-agreement.test.ts',
  'EC-E04': 'supabase/tests/amend-expiry.test.ts',
  'EC-E05': 'supabase/tests/promise-amend-agreement.test.ts',
  'EC-F01': 'supabase/tests/core-fulfillment.test.ts',
  'EC-F02': 'supabase/tests/core-fulfillment.test.ts',
  'EC-F03': 'supabase/tests/fulfillment-batches-rechecks.test.ts',
  'EC-F04': 'supabase/tests/core-fulfillment.test.ts',
  'EC-F05': 'apps/web/src/screens/scr-w04-participant-promises.test.tsx',
  'EC-F06': 'supabase/tests/account-safety.test.ts',
  'EC-F07': 'supabase/tests/core-fulfillment.test.ts',
  'EC-F08': 'supabase/tests/fulfillment-batches-rechecks.test.ts',
  'EC-F09': 'packages/shared/src/datetime.test.ts',
  'EC-F10': 'supabase/tests/fulfillment-batches-rechecks.test.ts',
  'EC-G01': 'apps/mobile/src/screens/scr-a05-promise-detail.test.tsx',
  'EC-G02': 'supabase/tests/push-delivery.test.ts',
  'EC-G03': 'packages/shared/src/validation.test.ts',
  'EC-G04': 'supabase/tests/notification-outbox.test.ts',
  'EC-G05': 'supabase/tests/notification-fanout.test.ts',
  'EC-H01': 'supabase/tests/account-safety.test.ts',
  'EC-H02': 'supabase/tests/account-safety.test.ts',
  'EC-H03': 'supabase/tests/account-safety.test.ts',
  'EC-H04': 'supabase/tests/device-token-registration.test.ts',
  'EC-H05': 'supabase/tests/promise-create-invite.test.ts',
  'EC-H06': 'supabase/tests/promise-integrity.test.ts',
  'EC-I01': 'apps/mobile/src/screens/invite-review.test.tsx',
  'EC-I02': 'apps/web/src/screens/scr-w01-invite-landing.test.tsx',
  'EC-I03': 'apps/web/src/screens/scr-w03-approval-complete.test.tsx',
  'EC-I04': 'packages/shared/src/app-version.test.ts',
  'EC-J01': 'supabase/tests/monetization-retention.test.ts',
  'EC-J02': 'supabase/tests/monetization-retention.test.ts',
  'EC-J03': 'supabase/tests/monetization-retention.test.ts',
  'EC-J04': 'supabase/tests/monetization-retention.test.ts',
  'EC-K01': 'supabase/tests/monetization-retention.test.ts',
  'EC-K02': 'supabase/tests/monetization-retention.test.ts',
  'EC-L01': 'supabase/tests/monetization-retention.test.ts',
  'EC-L02': 'supabase/tests/monetization-retention.test.ts',
  'EC-L03': 'supabase/tests/monetization-retention.test.ts',
} as const;

const EC_IDS = Object.keys(EC_EVIDENCE).sort();

describe('02 §10 edge-case traceability', () => {
  test('명세의 EC-A01~EC-L03 66개와 추적 계약이 정확히 일치한다', () => {
    const spec = readFileSync(resolve('docs/기획/02_세부기능명세서.md'), 'utf8');
    const specIds = [...new Set(spec.match(/EC-[A-L][0-9]{2}/gu) ?? [])].sort();

    expect(EC_IDS).toHaveLength(66);
    expect(EC_IDS).toEqual(specIds);
  });

  test.each(Object.entries(EC_EVIDENCE))('%s는 실제 테스트 이름으로 추적된다', (id, file) => {
    const source = readFileSync(resolve(file), 'utf8');
    const namedEvidence = source.split(/\r?\n/u).some((line) =>
      line.includes(id) && /\b(?:describe|it|test)(?:\.each)?\s*\(/u.test(line),
    );

    expect(namedEvidence, `${id}: ${file}`).toBe(true);
  });
});

