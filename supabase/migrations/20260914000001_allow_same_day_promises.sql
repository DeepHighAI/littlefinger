-- PO 2026-09-14: 생성·초안 수정·변경 요청 모두 KST 오늘부터 허용한다.
-- 현재 함수의 권한·보관·멱등성 검사를 보존하고 날짜 하한만 바꾼다.
do $$
declare
  v_signature text;
  v_definition text;
  v_before text;
  v_after text;
begin
  for v_signature, v_before, v_after in
    select * from (values
      ('public.lf_promise_create_draft(uuid,text,text,text,text,text,text,text,boolean)',
       'v_days < 1', 'v_days < 0'),
      ('public.lf_promise_draft_update(uuid,uuid,uuid,text,text,text,text,text,text,text,boolean,character)',
       'v_days < 1', 'v_days < 0'),
      ('public.lf_promise_amend_request_unfiltered(uuid,uuid,uuid,text,jsonb,text,public.surface,text,text)',
       'v_end_date <= (now() at time zone ''Asia/Seoul'')::date',
       'v_end_date < (now() at time zone ''Asia/Seoul'')::date')
    ) as changes(signature, before_text, after_text)
  loop
    v_definition := pg_get_functiondef(v_signature::regprocedure);
    if position(v_before in v_definition) = 0 then
      raise exception 'Expected date guard missing in %', v_signature;
    end if;
    execute replace(replace(v_definition, v_before, v_after),
      '**내일 ~ 오늘+365**, KST(S-7). 오늘을 배제하는 것은 T-01 규칙이다.',
      '**오늘부터**, KST. 상한과 혜택 검증은 기존 규칙을 따른다.');
  end loop;
end;
$$;
