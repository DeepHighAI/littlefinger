import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
  NOTIFICATION_DEEPLINK,
  NOTIFICATION_TITLE,
  renderNotificationTemplate,
  scheduledDedupeKey,
  type NotificationEvent,
  type NotificationTemplateArgs,
} from '../../packages/shared/src/notification.ts';
import { createPromise, createTestDb, createUser, type TestDb } from './harness.ts';

let db: TestDb;

interface DispatchResult {
  claimed: number;
  sent: number;
  canceled: number;
  deferred: number;
}

interface NotificationRow {
  user_id: string;
  type: string;
  channel: 'INAPP';
  title: string;
  body: string;
  deeplink: string;
  status: string;
  dedupe_key: string;
}

/**
 * KST 오늘 자정 + 오프셋으로 시각 앵커를 만든다.
 *
 * createPromise 의 end_date 가 DB 의 now() 기준 KST 오늘로 계산되므로, 테스트가 넘기는
 * p_now 도 같은 시계에서 만들어야 D-n 계산이 날짜 경계에서 흔들리지 않는다.
 */
async function kstAnchor(
  dayOffset: number,
  hour: number,
  minute = 0,
): Promise<{ instant: string; yyyymmdd: string }> {
  const { rows } = await db.asAdmin(
    `select ((((now() at time zone 'Asia/Seoul')::date + $1::int)::timestamp
               + make_interval(hours => $2::int, mins => $3::int))
              at time zone 'Asia/Seoul')::text as instant,
            to_char((now() at time zone 'Asia/Seoul')::date + $1::int, 'YYYYMMDD') as yyyymmdd`,
    [dayOffset, hour, minute],
  );
  const row = rows[0] as { instant: string; yyyymmdd: string };
  return { instant: row.instant, yyyymmdd: row.yyyymmdd };
}

async function scheduleRow(input: {
  promiseId: string;
  userId: string;
  kind: string;
  fireAt: string;
  checkRoundNo?: number;
}): Promise<string> {
  const { rows } = await db.asAdmin(
    `insert into public.reminder_schedules (promise_id, user_id, kind, fire_at, check_round_no)
     values ($1, $2, $3::public.reminder_kind, $4::timestamptz, $5)
     returning id`,
    [input.promiseId, input.userId, input.kind, input.fireAt, input.checkRoundNo ?? null],
  );
  return String((rows[0] as { id: string }).id);
}

async function dispatch(instant: string, limit = 100): Promise<DispatchResult> {
  const { rows } = await db.asAdmin(
    `select public.lf_dispatch_due_reminders($1::timestamptz, $2::int) as result`,
    [instant, limit],
  );
  return (rows[0] as { result: DispatchResult }).result;
}

async function scheduleState(id: string): Promise<{ status: string; fire_at: string }> {
  const { rows } = await db.asAdmin(
    `select status::text, fire_at::text from public.reminder_schedules where id = $1`,
    [id],
  );
  return rows[0] as { status: string; fire_at: string };
}

async function outboxRowsFor(promiseId: string): Promise<NotificationRow[]> {
  const { rows } = await db.asAdmin(
    `select recipient_user_id as user_id, event as type, template_args,
            status::text, inapp_dedupe_key as dedupe_key
       from public.notification_outbox
      where promise_id = $1
      order by created_at`,
    [promiseId],
  );
  return rows.map((raw) => {
    const row = raw as {
      user_id: string;
      type: NotificationEvent;
      template_args: NotificationTemplateArgs;
      status: string;
      dedupe_key: string;
    };
    return {
      user_id: row.user_id,
      type: row.type,
      channel: 'INAPP',
      ...renderNotificationTemplate(row.type, row.template_args),
      status: row.status,
      dedupe_key: row.dedupe_key,
    };
  });
}

/** CHECKING 상태를 J-02 가 만든 모양 그대로 재현한다(종료일 익일 00:00 KST + 7일 기한). */
async function enterChecking(promiseId: string): Promise<void> {
  await db.asAdmin(
    `update public.promises
        set status = 'CHECKING',
            checking_started_at = ((end_date + 1)::timestamp at time zone 'Asia/Seoul'),
            check_deadline_at = ((end_date + 1)::timestamp at time zone 'Asia/Seoul')
                                + interval '7 days',
            check_round_no = 1
      where id = $1`,
    [promiseId],
  );
}

/**
 * 발송 함수는 due 행을 전역으로 쓸어 담으므로, PENDING 으로 끝나는 행을 남기는 테스트는
 * 마지막에 행을 중화해야 뒤 테스트의 개수 단언이 오염되지 않는다.
 */
async function neutralize(...scheduleIds: string[]): Promise<void> {
  await db.asAdmin(`update public.reminder_schedules set status = 'CANCELED' where id = any($1)`, [
    scheduleIds,
  ]);
}

async function messageOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('lf_dispatch_due_reminders — J-01 예약 알림 발송', () => {
  test('AMEND_REMIND는 진행 중 요청의 상대에게 NT-15를 다시 보낸다', async () => {
    const creatorId = await createUser(db, '변경독촉수신자');
    const partnerId = await createUser(db, '변경독촉요청자');
    const promiseId = await createPromise(db, {
      creatorId,
      partnerId,
      status: 'ACTIVE',
      endDateOffsetDays: 10,
    });
    const { rows } = await db.asAdmin(
      `insert into public.amend_requests
         (promise_id, requester_id, type, reason, expires_at)
       values ($1, $2, 'CANCEL', '다시 정해요', now() + interval '4 days')
       returning id`,
      [promiseId, partnerId],
    );
    await db.asAdmin(`update public.promises set status = 'AMEND_PENDING' where id = $1`, [
      promiseId,
    ]);
    const rowId = await scheduleRow({
      promiseId,
      userId: creatorId,
      kind: 'AMEND_REMIND',
      fireAt: (await kstAnchor(0, 9)).instant,
    });

    const result = await dispatch((await kstAnchor(0, 9)).instant);
    expect(result).toMatchObject({ claimed: 1, sent: 1 });
    expect((await scheduleState(rowId)).status).toBe('SENT');
    expect(await outboxRowsFor(promiseId)).toEqual([
      expect.objectContaining({
        user_id: creatorId,
        type: 'NT-15',
        title: expect.stringContaining('파기를 요청했어요'),
        deeplink: 'SCR-A05',
      }),
    ]);
    expect(rows[0]?.['id']).toEqual(expect.any(String));
  });

  test('기한이 되지 않은 행은 건드리지 않는다', async () => {
    const userId = await createUser(db, '미도래');
    const promiseId = await createPromise(db, {
      creatorId: userId,
      status: 'ACTIVE',
      endDateOffsetDays: 7,
    });
    const rowId = await scheduleRow({
      promiseId,
      userId,
      kind: 'D7',
      fireAt: (await kstAnchor(0, 10)).instant,
    });

    const result = await dispatch((await kstAnchor(0, 9)).instant);

    expect(result).toMatchObject({ claimed: 0, sent: 0 });
    expect((await scheduleState(rowId)).status).toBe('PENDING');
    expect(await outboxRowsFor(promiseId)).toHaveLength(0);
    await neutralize(rowId);
  });

  test('기한이 된 D-1 을 NT-06으로 발송하고 행을 SENT로 바꾼다', async () => {
    const userId = await createUser(db, '디원');
    await db.asAdmin(`select public.lf_device_token_register($1, $2)`, [
      userId,
      'ExponentPushToken[reminder-d1]',
    ]);
    const promiseId = await createPromise(db, {
      creatorId: userId,
      status: 'ACTIVE',
      endDateOffsetDays: 1,
    });
    const rowId = await scheduleRow({
      promiseId,
      userId,
      kind: 'D1',
      fireAt: (await kstAnchor(0, 9)).instant,
    });

    const now = await kstAnchor(0, 9);
    const result = await dispatch(now.instant);

    expect(result).toMatchObject({ claimed: 1, sent: 1, canceled: 0, deferred: 0 });
    expect((await scheduleState(rowId)).status).toBe('SENT');

    const rows = await outboxRowsFor(promiseId);
    expect(rows).toHaveLength(1);
    const inapp = rows.find((r) => r.channel === 'INAPP');
    expect(inapp).toMatchObject({
      user_id: userId,
      type: 'NT-06',
      title: NOTIFICATION_TITLE['NT-06']('1'),
      body: '매일 걷기',
      deeplink: NOTIFICATION_DEEPLINK['NT-06'],
      status: 'PENDING',
      dedupe_key: scheduledDedupeKey({
        promiseId,
        event: 'NT-06',
        userId,
        channel: 'INAPP',
        yyyymmddKst: now.yyyymmdd,
      }),
    });
  });

  test('DDAY 는 NT-07, 초대 만료 임박은 NT-04로 나간다', async () => {
    const creatorId = await createUser(db, '디데이');
    const ddayPromise = await createPromise(db, {
      creatorId,
      status: 'ACTIVE',
      endDateOffsetDays: 0,
    });
    await scheduleRow({
      promiseId: ddayPromise,
      userId: creatorId,
      kind: 'DDAY',
      fireAt: (await kstAnchor(0, 9)).instant,
    });
    const invitePromise = await createPromise(db, {
      creatorId,
      status: 'PENDING',
      endDateOffsetDays: 7,
    });
    await scheduleRow({
      promiseId: invitePromise,
      userId: creatorId,
      kind: 'INVITE_EXPIRE_SOON',
      fireAt: (await kstAnchor(0, 9)).instant,
    });

    const result = await dispatch((await kstAnchor(0, 9)).instant);

    expect(result).toMatchObject({ sent: 2 });
    const dday = (await outboxRowsFor(ddayPromise)).find((r) => r.channel === 'INAPP');
    expect(dday).toMatchObject({
      type: 'NT-07',
      title: NOTIFICATION_TITLE['NT-07'](''),
      deeplink: NOTIFICATION_DEEPLINK['NT-07'],
    });
    const invite = (await outboxRowsFor(invitePromise)).find((r) => r.channel === 'INAPP');
    expect(invite).toMatchObject({
      type: 'NT-04',
      title: NOTIFICATION_TITLE['NT-04'](''),
      deeplink: NOTIFICATION_DEEPLINK['NT-04'],
    });
  });

  test('CHECK_REQ 는 NT-08, 독촉은 남은 일수를 담아 NT-10으로 나간다', async () => {
    const creatorId = await createUser(db, '확인자');
    const partnerId = await createUser(db, '상대자');
    // 종료일이 3일 전 → 확인 시작 2일 전, CHECK_R1(종료+3일 09:00)이 오늘 09:00 에 도래한다.
    const promiseId = await createPromise(db, {
      creatorId,
      partnerId,
      status: 'ACTIVE',
      endDateOffsetDays: -3,
    });
    await enterChecking(promiseId);
    await scheduleRow({
      promiseId,
      userId: creatorId,
      kind: 'CHECK_REQ',
      fireAt: (await kstAnchor(-2, 9)).instant,
      checkRoundNo: 1,
    });
    await scheduleRow({
      promiseId,
      userId: partnerId,
      kind: 'CHECK_R1',
      fireAt: (await kstAnchor(0, 9)).instant,
      checkRoundNo: 1,
    });

    const result = await dispatch((await kstAnchor(0, 9)).instant);

    expect(result).toMatchObject({ sent: 2 });
    const rows = await outboxRowsFor(promiseId);
    const checkReq = rows.find((r) => r.user_id === creatorId && r.channel === 'INAPP');
    expect(checkReq).toMatchObject({
      type: 'NT-08',
      title: NOTIFICATION_TITLE['NT-08'](''),
      deeplink: NOTIFICATION_DEEPLINK['NT-08'],
    });
    // 확인 기한 = 종료+8일 00:00 KST, 오늘 발송이므로 5일 남았다.
    const urge = rows.find((r) => r.user_id === partnerId && r.channel === 'INAPP');
    expect(urge).toMatchObject({
      type: 'NT-10',
      title: NOTIFICATION_TITLE['NT-10']('5'),
      deeplink: NOTIFICATION_DEEPLINK['NT-10'],
    });
  });

  test('설정에서 끈 종류는 발송 대신 CANCELED 처리한다', async () => {
    const userId = await createUser(db, '옵트아웃');
    await db.asAdmin(
      `update public.users set notification_pref = '{"remind_d1": false}'::jsonb where id = $1`,
      [userId],
    );
    const promiseId = await createPromise(db, {
      creatorId: userId,
      status: 'ACTIVE',
      endDateOffsetDays: 1,
    });
    const rowId = await scheduleRow({
      promiseId,
      userId,
      kind: 'D1',
      fireAt: (await kstAnchor(0, 9)).instant,
    });

    const result = await dispatch((await kstAnchor(0, 9)).instant);

    expect(result).toMatchObject({ sent: 0, canceled: 1 });
    expect((await scheduleState(rowId)).status).toBe('CANCELED');
    expect(await outboxRowsFor(promiseId)).toHaveLength(0);
  });

  test('토큰 없는 수신자는 INAPP만 만든다', async () => {
    const userId = await createUser(db, '무기기');
    const promiseId = await createPromise(db, {
      creatorId: userId,
      status: 'ACTIVE',
      endDateOffsetDays: 3,
    });
    await scheduleRow({
      promiseId,
      userId,
      kind: 'D3',
      fireAt: (await kstAnchor(0, 9)).instant,
    });

    const result = await dispatch((await kstAnchor(0, 9)).instant);

    expect(result).toMatchObject({ sent: 1 });
    const rows = await outboxRowsFor(promiseId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ channel: 'INAPP', type: 'NT-06' });
  });

  test('조용한 시간(22:30 KST)에는 다음 08:00 KST로 미룬다', async () => {
    const userId = await createUser(db, '심야');
    const promiseId = await createPromise(db, {
      creatorId: userId,
      status: 'ACTIVE',
      endDateOffsetDays: 3,
    });
    const rowId = await scheduleRow({
      promiseId,
      userId,
      kind: 'D3',
      fireAt: (await kstAnchor(0, 9)).instant,
    });

    const result = await dispatch((await kstAnchor(0, 22, 30)).instant);

    expect(result).toMatchObject({ sent: 0, deferred: 1 });
    const state = await scheduleState(rowId);
    expect(state.status).toBe('PENDING');
    expect(state.fire_at).toBe((await kstAnchor(1, 8)).instant);
    expect(await outboxRowsFor(promiseId)).toHaveLength(0);
    await neutralize(rowId);
  });

  test('조용한 시간(07:00 KST)에는 당일 08:00 KST로 미룬다 — 초대 임박도 이연 대상이다', async () => {
    const userId = await createUser(db, '새벽');
    const promiseId = await createPromise(db, {
      creatorId: userId,
      status: 'PENDING',
      endDateOffsetDays: 7,
    });
    // §8-3 의 이연 목록은 NT-06~08·NT-10만 열거하지만, §2-2 의 총칙은 "스케줄 알림"
    // 전체를 이연한다. NT-04 는 12시간 리드가 있어 이연해도 만료를 넘지 않으므로 총칙을 따른다.
    const rowId = await scheduleRow({
      promiseId,
      userId,
      kind: 'INVITE_EXPIRE_SOON',
      fireAt: (await kstAnchor(0, 6)).instant,
    });

    const result = await dispatch((await kstAnchor(0, 7)).instant);

    expect(result).toMatchObject({ sent: 0, deferred: 1 });
    const state = await scheduleState(rowId);
    expect(state.status).toBe('PENDING');
    expect(state.fire_at).toBe((await kstAnchor(0, 8)).instant);
    await neutralize(rowId);
  });

  test('같은 시각으로 두 번 실행해도 중복 발송되지 않는다', async () => {
    const userId = await createUser(db, '재실행');
    const promiseId = await createPromise(db, {
      creatorId: userId,
      status: 'ACTIVE',
      endDateOffsetDays: 3,
    });
    await scheduleRow({
      promiseId,
      userId,
      kind: 'D3',
      fireAt: (await kstAnchor(0, 9)).instant,
    });

    const first = await dispatch((await kstAnchor(0, 9)).instant);
    const second = await dispatch((await kstAnchor(0, 9)).instant);

    expect(first).toMatchObject({ sent: 1 });
    expect(second).toMatchObject({ claimed: 0, sent: 0 });
    expect(await outboxRowsFor(promiseId)).toHaveLength(1);
  });

  test('같은 날 도래한 D-7·D-3 은 하루 1회 규칙으로 한 건에 합쳐진다', async () => {
    const userId = await createUser(db, '중복도래');
    const promiseId = await createPromise(db, {
      creatorId: userId,
      status: 'ACTIVE',
      endDateOffsetDays: 3,
    });
    // 배치가 며칠 죽어 있던 상황: D7 행이 며칠 늦게 D3 행과 같은 날 도래했다(EC-G04).
    const d7 = await scheduleRow({
      promiseId,
      userId,
      kind: 'D7',
      fireAt: (await kstAnchor(-4, 9)).instant,
    });
    const d3 = await scheduleRow({
      promiseId,
      userId,
      kind: 'D3',
      fireAt: (await kstAnchor(0, 9)).instant,
    });

    const result = await dispatch((await kstAnchor(0, 9)).instant);

    expect(result).toMatchObject({ sent: 2 });
    expect((await scheduleState(d7)).status).toBe('SENT');
    expect((await scheduleState(d3)).status).toBe('SENT');
    // 두 행 모두 NT-06 이고 dedupe 날짜가 같아 알림은 한 건이다.
    expect(await outboxRowsFor(promiseId)).toHaveLength(1);
  });

  test('p_limit 는 fire_at 오름차순으로 자른다', async () => {
    const userId = await createUser(db, '리밋');
    const promiseId = await createPromise(db, {
      creatorId: userId,
      status: 'ACTIVE',
      endDateOffsetDays: 1,
    });
    const older = await scheduleRow({
      promiseId,
      userId,
      kind: 'D3',
      fireAt: (await kstAnchor(-2, 9)).instant,
    });
    const newer = await scheduleRow({
      promiseId,
      userId,
      kind: 'D1',
      fireAt: (await kstAnchor(0, 9)).instant,
    });

    const result = await dispatch((await kstAnchor(0, 10)).instant, 1);

    expect(result).toMatchObject({ claimed: 1 });
    expect((await scheduleState(older)).status).not.toBe('PENDING');
    expect((await scheduleState(newer)).status).toBe('PENDING');
    await neutralize(newer);
  });

  test('AMEND_PENDING이 아닌 약속의 stale AMEND_REMIND는 취소한다', async () => {
    const userId = await createUser(db, '수정보류');
    const promiseId = await createPromise(db, {
      creatorId: userId,
      status: 'DRAFT',
      endDateOffsetDays: 7,
    });
    const rowId = await scheduleRow({
      promiseId,
      userId,
      kind: 'AMEND_REMIND',
      fireAt: (await kstAnchor(-1, 9)).instant,
    });

    const result = await dispatch((await kstAnchor(0, 9)).instant);

    expect(result).toMatchObject({ claimed: 1, canceled: 1 });
    expect((await scheduleState(rowId)).status).toBe('CANCELED');
    expect(await outboxRowsFor(promiseId)).toHaveLength(0);
  });

  test('종결된 약속의 리마인드는 발송 대신 CANCELED 처리한다', async () => {
    const userId = await createUser(db, '종결');
    const promiseId = await createPromise(db, {
      creatorId: userId,
      status: 'COMPLETED',
      endDateOffsetDays: 3,
    });
    const rowId = await scheduleRow({
      promiseId,
      userId,
      kind: 'D3',
      fireAt: (await kstAnchor(0, 9)).instant,
    });

    const result = await dispatch((await kstAnchor(0, 9)).instant);

    expect(result).toMatchObject({ sent: 0, canceled: 1 });
    expect((await scheduleState(rowId)).status).toBe('CANCELED');
    expect(await outboxRowsFor(promiseId)).toHaveLength(0);
  });

  test('약속 상태가 리마인드보다 뒤처져 있으면 보류한다 — J-02 지연 중의 CHECK_REQ', async () => {
    const userId = await createUser(db, '지연');
    // J-02 가 아직 CHECKING 으로 못 넘긴 상태에서 CHECK_REQ 가 먼저 도래한 창.
    const promiseId = await createPromise(db, {
      creatorId: userId,
      status: 'ACTIVE',
      endDateOffsetDays: -1,
    });
    const rowId = await scheduleRow({
      promiseId,
      userId,
      kind: 'CHECK_REQ',
      fireAt: (await kstAnchor(0, 9)).instant,
      checkRoundNo: 1,
    });

    const result = await dispatch((await kstAnchor(0, 9)).instant);

    expect(result).toMatchObject({ claimed: 0 });
    expect((await scheduleState(rowId)).status).toBe('PENDING');
  });

  test('탈퇴한 사용자 행은 CANCELED, 정지된 사용자 행은 보류한다', async () => {
    const withdrawnId = await createUser(db, '탈퇴자');
    const suspendedId = await createUser(db, '정지자');
    const promiseId = await createPromise(db, {
      creatorId: withdrawnId,
      partnerId: suspendedId,
      status: 'ACTIVE',
      endDateOffsetDays: 3,
    });
    const withdrawnRow = await scheduleRow({
      promiseId,
      userId: withdrawnId,
      kind: 'D3',
      fireAt: (await kstAnchor(0, 9)).instant,
    });
    const suspendedRow = await scheduleRow({
      promiseId,
      userId: suspendedId,
      kind: 'D3',
      fireAt: (await kstAnchor(0, 9)).instant,
    });
    await db.asAdmin(`update public.users set status = 'WITHDRAWN' where id = $1`, [withdrawnId]);
    await db.asAdmin(`update public.users set status = 'SUSPENDED' where id = $1`, [suspendedId]);

    const result = await dispatch((await kstAnchor(0, 9)).instant);

    expect(result).toMatchObject({ sent: 0, canceled: 1 });
    expect((await scheduleState(withdrawnRow)).status).toBe('CANCELED');
    expect((await scheduleState(suspendedRow)).status).toBe('PENDING');
    expect(await outboxRowsFor(promiseId)).toHaveLength(0);
  });

  test('outbox intent 쓰기가 실패하면 트랜잭션이 함께 풀려 행이 PENDING 으로 남는다', async () => {
    const userId = await createUser(db, '실패복구');
    const promiseId = await createPromise(db, {
      creatorId: userId,
      status: 'ACTIVE',
      endDateOffsetDays: 3,
    });
    const rowId = await scheduleRow({
      promiseId,
      userId,
      kind: 'D3',
      fireAt: (await kstAnchor(0, 9)).instant,
    });
    await db.execAdmin(`
      create function public.lf_test_fail_reminder_insert()
      returns trigger
      language plpgsql
      set search_path = ''
      as $$
      begin
        if new.event = 'NT-06' then
          raise exception 'lf_test_forced_failure';
        end if;
        return new;
      end;
      $$;

      create trigger lf_test_fail_reminder_insert
      before insert on public.notification_outbox
      for each row execute function public.lf_test_fail_reminder_insert();
    `);

    try {
      const now = await kstAnchor(0, 9);
      const message = await messageOf(() => dispatch(now.instant));
      expect(message).toContain('lf_test_forced_failure');
      expect((await scheduleState(rowId)).status).toBe('PENDING');
      expect(await outboxRowsFor(promiseId)).toHaveLength(0);
    } finally {
      await db.execAdmin(`
        drop trigger lf_test_fail_reminder_insert on public.notification_outbox;
        drop function public.lf_test_fail_reminder_insert();
      `);
    }
  });

  test('동시 실행은 SKIP LOCKED 로 분할한다 — 카탈로그 계약', async () => {
    // PGlite 는 단일 연결이라 실제 경쟁을 실행할 수 없다. 두 워커가 같은 행을 잡지 않게 하는
    // FOR UPDATE OF ... SKIP LOCKED 경계가 함수에 남아 있는지를 카탈로그로 지킨다.
    const { rows } = await db.asAdmin(
      `select pg_get_functiondef(
         'public.lf_dispatch_due_reminders(timestamptz,integer)'::regprocedure
       ) as definition`,
    );
    const definition = String(rows[0]?.['definition']).replace(/\s+/gu, ' ').toLowerCase();

    expect(definition).toContain('for update of rs skip locked');
    expect(definition).toContain('limit greatest(p_limit, 0)');
  });

  test('클라이언트 역할은 직접 호출할 수 없다', async () => {
    const userId = await createUser(db, '직접호출');

    const message = await messageOf(() =>
      db.asUser(userId, `select public.lf_dispatch_due_reminders(now(), 10)`),
    );

    expect(message).toContain('permission denied');
  });
});
