import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { PROMISE_STATUSES } from '../../packages/shared/src/promise.ts';

/**
 * 스키마·RLS 구조 검증 — 02 §6, §9, 04 §7-2, §12.
 *
 * 실 DB 없이 마이그레이션 SQL 을 읽어 **절대제약이 스키마 레벨에서 지켜지는지** 본다.
 * 여기서 막는 것들은 전부 사후에 고치기 비싼 종류다 —
 * 비참여자에게 약속 존재가 새거나, 감사 로그가 지워지거나, 토큰 원문이 남는 일.
 *
 * Docker 가 뜨면 `supabase start` 로 실제 정책 동작까지 검증하는 통합 테스트를 얹는다.
 * 이 테스트는 그걸 대체하지 않는다 — 구조만 본다.
 */

const MIGRATIONS_DIR = join(__dirname, '../migrations');

function readMigrations(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8')).join('\n');
}

const sql = readMigrations();
const lower = sql.toLowerCase();

describe('F-05 witness transaction schema', () => {
  test('participant slots link one invitation and witness signatures are unique', () => {
    expect(lower).toMatch(
      /alter table public\.promise_participants[\s\S]*add column invitation_id uuid references public\.invitations/iu,
    );
    expect(lower).toMatch(
      /create unique index promise_participants_unique_invitation[\s\S]*where invitation_id is not null/iu,
    );
    expect(lower).toMatch(
      /create unique index approvals_unique_witness_sign[\s\S]*where action = 'witness_sign'/iu,
    );
  });

  test('notification outbox keeps a closed event set that includes NT-18', () => {
    const migration = readFileSync(
      join(MIGRATIONS_DIR, '20260816000006_f05_witness_flow.sql'),
      'utf8',
    ).toLowerCase();
    expect(migration).toContain('drop constraint notification_outbox_event_check');
    expect(migration).toMatch(/add constraint notification_outbox_event_check check[\s\S]*'nt-18'/u);
  });
});

describe('F-11 amend agreement transaction schema', () => {
  test('inactive proposals are unnumbered and all mutation RPCs are service-role-only', () => {
    expect(lower).toMatch(
      /create unique index promise_versions_numbered_unique[\s\S]*where version_no is not null/iu,
    );
    for (const name of [
      'lf_promise_amend_request',
      'lf_promise_amend_respond',
      'lf_promise_amend_withdraw',
      'lf_promise_version_list',
    ]) {
      expect(lower).toMatch(
        new RegExp(`revoke all on function public\\.${name}\\s*\\(`, 'u'),
      );
    }
  });
});

describe('F-01 약관 동의 서버 경계', () => {
  test('버전 조합을 유일하게 만들고 클라이언트 INSERT 정책을 제거한다', () => {
    expect(lower).toMatch(
      /create unique index\s+terms_agreements_version_unique[\s\S]*?user_id\s*,\s*terms_version\s*,\s*privacy_version/iu,
    );
    expect(lower).toContain('drop policy if exists "terms insert own"');
    expect(lower).toMatch(/revoke insert on (?:table )?public\.terms_agreements from anon, authenticated/iu);
  });

  test('현재 버전 함수와 provision은 클라이언트 실행 권한이 없다', () => {
    for (const signature of [
      'public.lf_current_terms_version()',
      'public.lf_current_privacy_version()',
      'public.lf_user_provision(uuid, public.surface, text, text)',
    ]) {
      expect(lower).toContain(`revoke all on function ${signature}`);
    }
  });
});

describe('J-09 record integrity scheduler', () => {
  test('weekly job uses one fixed name and Sunday 05:30 KST schedule', () => {
    expect(lower).toContain("'littlefinger-j09-integrity'");
    expect(lower).toContain("'30 20 * * 6'");
    expect(lower).toContain("'select public.lf_verify_promise_integrity();'");
    expect(lower).toContain('select public.lf_schedule_promise_integrity();');
  });
});

describe('F-09 trust profile and J-10 scheduler', () => {
  test('프로필 경계와 전량 재계산 함수가 서버 전용으로 선언된다', () => {
    for (const signature of [
      'public.lf_my_trust_profile(uuid)',
      'public.lf_trust_profile_settings_update(uuid, uuid, jsonb)',
      'public.lf_device_token_unregister(uuid, uuid, text)',
      'public.lf_recompute_all_trust_profiles()',
      'public.lf_schedule_trust_profile_recompute()',
    ]) {
      expect(lower).toContain(`revoke all on function ${signature}`);
    }
  });

  test('J-10은 한 고정 이름으로 매일 03:00 KST에 등록된다', () => {
    expect(lower).toContain("'lf-j10-trust-profile-recompute'");
    expect(lower).toContain("'0 18 * * *'");
    expect(lower).toContain("'select public.lf_recompute_all_trust_profiles();'");
    expect(lower).toContain('select public.lf_schedule_trust_profile_recompute();');
  });
});

/** `create table [if not exists] [public.]name` 에서 이름만 뽑는다. */
function declaredTables(): string[] {
  const names: string[] = [];
  for (const m of lower.matchAll(/create table\s+(?:if not exists\s+)?(?:public\.)?([a-z_]+)/gu)) {
    if (m[1] !== undefined) names.push(m[1]);
  }
  return names;
}

/**
 * `create policy` 문을 블록 단위로 잘라 테이블·명령·본문을 뽑는다.
 * 테이블 이름을 정규식에 끼워 넣는 방식은 이름이 서로의 접두사일 때 조용히 틀린다.
 */
export interface PolicyBlock {
  table: string;
  command: string;
  body: string;
}

function policyBlocks(): PolicyBlock[] {
  const blocks: PolicyBlock[] = [];
  for (const chunk of sql.split(/create policy/iu).slice(1)) {
    const statement = chunk.slice(0, chunk.indexOf(';') + 1);
    const head = statement.match(/"[^"]*"\s+on\s+(?:public\.)?([a-z_]+)\s+for\s+(all|select|insert|update|delete)/iu);
    if (head?.[1] === undefined || head[2] === undefined) continue;
    blocks.push({
      table: head[1].toLowerCase(),
      command: head[2].toLowerCase(),
      body: statement.slice(head.index === undefined ? 0 : head.index + head[0].length),
    });
  }
  return blocks;
}

function policies(): { table: string; command: string }[] {
  return policyBlocks().map(({ table, command }) => ({ table, command }));
}

const tables = declaredTables();
const allPolicies = policies();

/**
 * 04 §7-2 가 append-only 로 못박은 테이블 — UPDATE/DELETE 정책을 아예 만들지 않는다.
 * `fulfillment_checks` 의 1회 정정 예외도 서버가 처리하므로 클라이언트 정책은 없다.
 */
const APPEND_ONLY = [
  'approvals',
  'promise_versions',
  'fulfillment_checks',
  'notifications',
] as const;

describe('마이그레이션이 존재한다', () => {
  test('SQL 파일이 있고 테이블을 만든다', () => {
    expect(readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).length).toBeGreaterThan(0);
    expect(tables.length).toBeGreaterThan(0);
  });

  test('02 §6-2 의 테이블을 빠짐없이 만든다', () => {
    const required = [
      'users',
      'device_tokens',
      'promises',
      'promise_versions',
      'promise_participants',
      'approvals',
      'invitations',
      'fulfillment_checks',
      'fulfillment_evidences',
      'amend_requests',
      'notifications',
      'reminder_schedules',
      'trust_profiles',
      'blocks',
      'reports',
      'terms_agreements',
      'integrity_incidents',
      'daily_metrics',
      'app_configs',
    ];
    const missing = required.filter((t) => !tables.includes(t));
    expect(missing).toEqual([]);
  });
});

describe('RLS — 04 §7-2 "모든 테이블에 RLS를 켠다"', () => {
  test.each(tables)('%s 에 RLS 가 켜져 있다', (table) => {
    const pattern = new RegExp(
      `alter table\\s+(?:public\\.)?${table}\\s+enable row level security`,
      'u',
    );
    expect(pattern.test(lower)).toBe(true);
  });

  test('RLS 를 켜고 정책이 하나도 없는 테이블이 없다', () => {
    // 정책 없이 RLS 만 켜면 service_role 외에는 아무도 못 읽는다.
    // 의도한 경우(Edge Function 전용 테이블)라면 주석으로 명시해야 한다.
    const withoutPolicy = tables.filter((t) => !allPolicies.some((p) => p.table === t));
    const declaredServerOnly = withoutPolicy.filter(
      (t) => !new RegExp(`--\\s*server-only:\\s*${t}\\b`, 'u').test(lower),
    );
    expect(declaredServerOnly).toEqual([]);
  });
});

describe('append-only 테이블 — 02 §6-2, 04 §7-2', () => {
  test.each(APPEND_ONLY)('%s 에 UPDATE 정책이 없다', (table) => {
    const updates = allPolicies.filter((p) => p.table === table && ['update', 'all'].includes(p.command));
    expect(updates).toEqual([]);
  });

  test.each(APPEND_ONLY)('%s 에 DELETE 정책이 없다', (table) => {
    const deletes = allPolicies.filter((p) => p.table === table && ['delete', 'all'].includes(p.command));
    expect(deletes).toEqual([]);
  });
});

describe('삭제 — 02 §9 "기록 삭제는 모든 역할에게 ❌"', () => {
  test('DELETE 정책은 DRAFT 약속과 자기 기기 토큰에만 있다', () => {
    // §9 의 "기록 삭제 ❌" 는 약속 기록을 말한다. 로그아웃 시 지우는 기기 토큰은
    // 기록이 아니므로 여기 포함된다. 그 외 어떤 테이블에도 DELETE 를 열지 않는다.
    const deletable = [
      ...new Set(allPolicies.filter((p) => p.command === 'delete').map((p) => p.table)),
    ].sort();
    expect(deletable).toEqual(['device_tokens', 'promises']);
  });

  test('promises 의 DELETE 정책은 DRAFT 로 한정된다', () => {
    // 확정된 약속이 지워지면 상대방의 기록까지 사라진다.
    const block = sql.match(/create policy\s+"[^"]*"\s+on\s+(?:public\.)?promises\s+for delete[\s\S]*?;/iu);
    expect(block).not.toBeNull();
    expect(block?.[0]).toContain("'DRAFT'");
  });
});

describe('개인정보 — 04 §12-8 "해시만 저장, 원본 미보관"', () => {
  test('초대 토큰 원문 컬럼이 없다', () => {
    expect(lower).toContain('token_hash');
    // `token` 단독 컬럼이 있으면 원문을 저장한다는 뜻이다.
    expect(/^\s+token\s+(text|varchar|char)/mu.test(lower)).toBe(false);
  });

  test('IP·User-Agent 는 해시 컬럼으로만 존재한다', () => {
    expect(lower).toContain('ip_hash');
    expect(lower).toContain('user_agent_hash');
    expect(/^\s+ip\s+(text|inet|varchar)/mu.test(lower)).toBe(false);
    expect(/^\s+user_agent\s+(text|varchar)/mu.test(lower)).toBe(false);
  });

  test('증빙은 공개 URL 이 아니라 비공개 버킷 키로 저장한다', () => {
    expect(lower).toContain('storage_key');
    expect(/^\s+(public_)?url\s+(text|varchar)/mu.test(lower)).toBe(false);
  });
});

describe('enum — 02 §6-3 "코드와 DB 동일 문자열"', () => {
  test('promise_status 가 packages/shared 의 11개 값과 정확히 같다', () => {
    const block = sql.match(/create type\s+(?:public\.)?promise_status\s+as enum\s*\(([^)]+)\)/iu);
    expect(block).not.toBeNull();
    const values = [...(block?.[1] ?? '').matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]);
    expect(values).toEqual([...PROMISE_STATUSES]);
  });

  test.each([
    ['promise_category', ['HABIT', 'BET', 'MONEY', 'ETC']],
    ['keeper', ['CREATOR', 'PARTNER', 'BOTH']],
    ['participant_role', ['CREATOR', 'PARTNER', 'WITNESS']],
    ['participant_status', ['INVITED', 'JOINED', 'DECLINED', 'WITHDRAWN']],
    ['fulfillment_answer', ['KEPT', 'NOT_KEPT']],
    ['surface', ['APP', 'WEB']],
    ['invitation_status', ['PENDING', 'USED', 'EXPIRED', 'REVOKED']],
    ['amend_type', ['AMEND', 'CANCEL']],
    ['amend_status', ['PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN', 'EXPIRED']],
    ['user_status', ['ACTIVE', 'SUSPENDED', 'WITHDRAWN']],
  ])('%s 의 값이 명세와 같다', (name, expected) => {
    const block = sql.match(new RegExp(`create type\\s+(?:public\\.)?${name}\\s+as enum\\s*\\(([^)]+)\\)`, 'iu'));
    expect(block).not.toBeNull();
    const values = [...(block?.[1] ?? '').matchAll(/'([A-Z_]+)'/gu)].map((m) => m[1]);
    expect(values).toEqual(expected);
  });
});

describe('불변성 — 원칙 P3 "확정 후 내용 필드는 UPDATE 거부"', () => {
  test('promises 의 UPDATE 정책이 DRAFT 를 벗어난 내용 변경을 막는다', () => {
    const block = sql.match(/create policy\s+"[^"]*"\s+on\s+(?:public\.)?promises\s+for update[\s\S]*?;/iu);
    expect(block).not.toBeNull();
    // ACTIVE 이후 내용 변경은 promise_versions 추가로만 표현한다.
    expect(block?.[0]).toContain("'DRAFT'");
  });
});

describe('존재 은닉 — 04 §7-2 "비참여자에게 약속의 존재 자체를 알리지 않는다"', () => {
  /** 참여 여부로 행이 걸러져야 하는 테이블. 여기 SELECT 가 열리면 존재가 샌다. */
  const PARTICIPANT_SCOPED = [
    'promises',
    'promise_versions',
    'promise_participants',
    'approvals',
    'invitations',
    'fulfillment_checks',
    'fulfillment_evidences',
    'amend_requests',
    'notifications',
    'trust_profiles',
    'blocks',
    'reports',
    'terms_agreements',
    'device_tokens',
    'users',
  ];

  /** 누구나 읽어도 되는 테이블. ads_enabled 같은 원격 설정은 로그인 전에도 필요하다. */
  const PUBLIC_READ = ['app_configs'];

  function selectPolicyBodies(table: string): string[] {
    return policyBlocks()
      .filter((b) => b.table === table && ['select', 'all'].includes(b.command))
      .map((b) => b.body);
  }

  test.each(PARTICIPANT_SCOPED)('%s 의 SELECT 정책이 무조건 참을 쓰지 않는다', (table) => {
    const bodies = selectPolicyBodies(table);
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      // using (true) 는 테이블 전체를 여는 것이고, 그 순간 존재 은닉이 깨진다.
      expect(body.replace(/\s+/gu, '')).not.toContain('using(true)');
    }
  });

  test.each(PARTICIPANT_SCOPED)('%s 의 SELECT 정책이 신원이나 참여 여부로 건다', (table) => {
    for (const body of selectPolicyBodies(table)) {
      const scoped =
        body.includes('auth.uid()') ||
        body.includes('can_read_promise') ||
        body.includes('is_promise_participant');
      expect(scoped).toBe(true);
    }
  });

  test('공개 읽기를 허용한 테이블은 명시된 것뿐이다', () => {
    const openTables = [
      ...new Set(
        allPolicies
          .filter((p) => ['select', 'all'].includes(p.command))
          .map((p) => p.table)
          .filter((t) => selectPolicyBodies(t).some((b) => b.replace(/\s+/gu, '').includes('using(true)'))),
      ),
    ].sort();
    expect(openTables).toEqual(PUBLIC_READ);
  });
});
