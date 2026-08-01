-- F-06 J-01 — 도래한 reminder_schedules 를 채널 fanout 으로 발송한다(02 §7-2·§8).
--
-- 발송 판단은 전부 서버 시계(p_now)와 KST 변환으로 한다. 행 잠금은 reminder_schedules 에만
-- 걸어(J-02/J-03 이 잡는 promises 행과 교차 대기가 생기지 않게) 10분 주기 워커 둘이 겹쳐도
-- 서로 다른 행을 나눠 갖는다.

-- ============================================================
-- 조용한 시간 정책값 (02 §11-3 QUIET_HOURS_KST 21:00–08:00)
-- ============================================================

insert into public.app_configs (key, value)
values
  ('quiet_hours_start_kst', '21'::jsonb),
  ('quiet_hours_end_kst', '8'::jsonb)
on conflict (key) do nothing;

-- CREATE OR REPLACE 는 ALTER 로 걸어 둔 search_path 설정을 지우므로 여기서 다시 명시한다.
create or replace function public.lf_policy_config_int(p_key text)
returns int
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_value   jsonb;
  v_numeric numeric;
  v_default int;
  v_min     int;
  v_max     int;
begin
  case p_key
    when 'check_deadline_days' then
      v_default := 7;
      v_min := 1;
      v_max := 2147483647;
    when 'reminder_send_hour_kst' then
      v_default := 9;
      v_min := 0;
      v_max := 23;
    when 'quiet_hours_start_kst' then
      v_default := 21;
      v_min := 0;
      v_max := 23;
    when 'quiet_hours_end_kst' then
      v_default := 8;
      v_min := 0;
      v_max := 23;
    else
      return null;
  end case;

  select ac.value
    into v_value
    from public.app_configs ac
   where ac.key = p_key;

  if v_value is null or jsonb_typeof(v_value) <> 'number' then
    return v_default;
  end if;

  begin
    v_numeric := (v_value #>> '{}')::numeric;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      return v_default;
  end;

  if v_numeric = trunc(v_numeric)
     and v_numeric between v_min and v_max then
    return v_numeric::int;
  end if;

  return v_default;
end;
$$;

-- ============================================================
-- J-01 발송 함수
-- ============================================================

create or replace function public.lf_dispatch_due_reminders(
  p_now timestamptz default now(),
  p_limit int default 200
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_kst        timestamp := p_now at time zone 'Asia/Seoul';
  v_kst_date   date := (p_now at time zone 'Asia/Seoul')::date;
  v_ymd        text := to_char((p_now at time zone 'Asia/Seoul')::date, 'YYYYMMDD');
  v_hour       int := extract(hour from p_now at time zone 'Asia/Seoul')::int;
  v_quiet_start int := public.lf_policy_config_int('quiet_hours_start_kst');
  v_quiet_end   int := public.lf_policy_config_int('quiet_hours_end_kst');
  v_quiet      boolean;
  v_defer_until timestamptz;
  v_row        record;
  v_event      text;
  v_title      text;
  v_deeplink   text;
  v_days       int;
  v_sent       int := 0;
  v_canceled   int := 0;
  v_deferred   int := 0;
begin
  v_quiet := case
    when v_quiet_start > v_quiet_end then v_hour >= v_quiet_start or v_hour < v_quiet_end
    else v_hour >= v_quiet_start and v_hour < v_quiet_end
  end;

  -- §8-3 의 이연 목록은 NT-06~08·NT-10 만 열거하지만 §2-2 총칙은 "스케줄 알림" 전체를
  -- 다음 08:00 로 미룬다. NT-04 도 12시간 리드가 있어 이연해도 만료를 넘지 않으므로
  -- 총칙을 따라 J-01 이 다루는 모든 종류를 이연한다.
  v_defer_until := case
    when not v_quiet then null
    when v_hour < v_quiet_end
      then (v_kst_date::timestamp + make_interval(hours => v_quiet_end))
             at time zone 'Asia/Seoul'
    else ((v_kst_date + 1)::timestamp + make_interval(hours => v_quiet_end))
           at time zone 'Asia/Seoul'
  end;

  for v_row in
    select rs.id   as schedule_id,
           rs.kind,
           rs.user_id,
           rs.promise_id,
           p.status as promise_status,
           p.title  as promise_title,
           p.end_date,
           p.check_deadline_at,
           u.status as user_status,
           coalesce(
             u.notification_pref ->> case rs.kind
               when 'D7' then 'remind_d7'
               when 'D3' then 'remind_d3'
               when 'D1' then 'remind_d1'
               when 'DDAY' then 'remind_dday'
               else null
             end,
             'true') as pref
      from public.reminder_schedules rs
      join public.promises p on p.id = rs.promise_id
      join public.users u on u.id = rs.user_id
     where rs.status = 'PENDING'
       and rs.fire_at <= p_now
       -- AMEND_REMIND 는 문구·수신 조건 계약이 F-11 에서 정해진다. 그때까지 건드리지 않는다.
       and rs.kind <> 'AMEND_REMIND'
       -- 정지는 해제될 수 있으므로 행을 소비하지 않고 보류한다(약속 종결 시 일괄 취소된다).
       and u.status <> 'SUSPENDED'
       and (
         -- 발송 가능한 상태 조합. AMEND_PENDING 은 기존 내용이 아직 유효하므로 리마인드를 보낸다.
         (rs.kind in ('D7', 'D3', 'D1', 'DDAY') and p.status in ('ACTIVE', 'AMEND_PENDING'))
         or (rs.kind in ('CHECK_REQ', 'CHECK_R1', 'CHECK_R2') and p.status = 'CHECKING')
         or (rs.kind = 'INVITE_EXPIRE_SOON' and p.status = 'PENDING')
         -- 리마인드의 시점이 이미 지나간 조합 → 취소 대상으로 잡는다. 전이 경로가 취소를
         -- 놓친 행을 여기서 걷지 않으면 매 실행마다 다시 스캔되는 찌꺼기로 남는다.
         or p.status in ('COMPLETED', 'BROKEN', 'UNRESOLVED', 'CANCELED', 'DECLINED')
         or (rs.kind in ('D7', 'D3', 'D1', 'DDAY') and p.status in ('CHECKING', 'DISPUTED'))
         or (rs.kind = 'INVITE_EXPIRE_SOON' and p.status <> 'PENDING')
         or u.status = 'WITHDRAWN'
       )
     order by rs.fire_at, rs.id
     limit greatest(p_limit, 0)
     for update of rs skip locked
  loop
    -- 취소 사유가 발송 사유보다 먼저다 — 탈퇴자·종결 약속에는 어떤 채널도 만들지 않는다.
    if v_row.user_status = 'WITHDRAWN'
       or v_row.promise_status in ('COMPLETED', 'BROKEN', 'UNRESOLVED', 'CANCELED', 'DECLINED')
       or (v_row.kind in ('D7', 'D3', 'D1', 'DDAY')
           and v_row.promise_status in ('CHECKING', 'DISPUTED'))
       or (v_row.kind = 'INVITE_EXPIRE_SOON' and v_row.promise_status <> 'PENDING')
    then
      update public.reminder_schedules set status = 'CANCELED' where id = v_row.schedule_id;
      v_canceled := v_canceled + 1;
      continue;
    end if;

    -- §5-6 에서 끈 종류는 발송 단계에서 거른다(§8-2). 시점이 지난 행을 PENDING 으로 두면
    -- 매 실행 다시 잡히고, 나중에 켜면 묵은 리마인드가 뒤늦게 나가므로 CANCELED 로 소비한다.
    if v_row.pref = 'false' then
      update public.reminder_schedules set status = 'CANCELED' where id = v_row.schedule_id;
      v_canceled := v_canceled + 1;
      continue;
    end if;

    v_days := null;
    case v_row.kind
      when 'D7', 'D3', 'D1' then
        v_event := 'NT-06';
        v_deeplink := 'SCR-A05';
        -- 남은 일수는 행이 아니라 시계에서 센다. 배치가 늦게 돈 날에도 문구가 사실이어야 한다.
        v_days := v_row.end_date - v_kst_date;
        v_title := '약속까지 ' || v_days || '일 남았어요';
      when 'DDAY' then
        v_event := 'NT-07';
        v_deeplink := 'SCR-A05';
        v_title := '오늘이 약속 종료일이에요';
        -- 종료일 당일에만 참인 문장이다. 지나쳤으면 J-02 몫이므로 보내지 않는다.
        if v_row.end_date <> v_kst_date then
          v_days := 0;
        else
          v_days := 1;
        end if;
      when 'CHECK_REQ' then
        v_event := 'NT-08';
        v_deeplink := 'SCR-A06';
        v_title := '약속이 지켜졌나요?';
        v_days := 1;
      when 'CHECK_R1', 'CHECK_R2' then
        v_event := 'NT-10';
        v_deeplink := 'SCR-A06';
        v_days := (v_row.check_deadline_at at time zone 'Asia/Seoul')::date - v_kst_date;
        v_title := '이행 확인이 ' || v_days || '일 남았어요';
      when 'INVITE_EXPIRE_SOON' then
        v_event := 'NT-04';
        v_deeplink := 'SCR-A04';
        v_title := '초대가 곧 만료돼요';
        v_days := 1;
    end case;

    -- "n일 남았어요"가 0 이하로 떨어진 행은 이미 다른 알림(NT-07·J-03)의 시간대다.
    if v_days is null or v_days < 1 then
      update public.reminder_schedules set status = 'CANCELED' where id = v_row.schedule_id;
      v_canceled := v_canceled + 1;
      continue;
    end if;

    if v_quiet then
      update public.reminder_schedules
         set fire_at = v_defer_until
       where id = v_row.schedule_id;
      v_deferred := v_deferred + 1;
      continue;
    end if;

    perform public.lf_notification_fanout(
      v_row.user_id,
      v_row.promise_id,
      v_event,
      v_title,
      v_row.promise_title,
      v_deeplink,
      v_row.promise_id::text || ':' || v_event || ':' || v_row.user_id::text
        || ':INAPP:' || v_ymd,
      v_row.promise_id::text || ':' || v_event || ':' || v_row.user_id::text
        || ':PUSH:' || v_ymd,
      p_now
    );

    -- 같은 트랜잭션이므로 fanout 이 실패하면 이 갱신도 함께 풀려 행이 PENDING 으로 남는다.
    update public.reminder_schedules set status = 'SENT' where id = v_row.schedule_id;
    v_sent := v_sent + 1;
  end loop;

  return jsonb_build_object(
    'claimed', v_sent + v_canceled + v_deferred,
    'sent', v_sent,
    'canceled', v_canceled,
    'deferred', v_deferred
  );
end;
$$;

comment on function public.lf_dispatch_due_reminders(timestamptz, int) is
  '도래한 reminder_schedules 를 조용한 시간·설정·상태 게이트를 거쳐 채널 fanout 으로 발송한다(J-01).';

revoke all on function public.lf_dispatch_due_reminders(timestamptz, int)
  from public, anon, authenticated;

grant execute on function public.lf_dispatch_due_reminders(timestamptz, int) to service_role;
