-- 확정 기록 해시와 기록 지문 — 02_세부기능명세서 §4-4-2.
--
-- **여기가 해시의 유일한 생산지다.** 클라이언트는 물론 Edge Function 도 직접 만들지 않는다.
-- 04 §7-3 은 "Edge Function 안에만 둔다"고 적었지만, 그 조항의 의도는 "클라이언트가 위조하지
-- 못하게"다. Postgres 함수는 그보다 더 안쪽이고, 확정 트랜잭션과 같은 트랜잭션에서 돌기 때문에
-- 해시와 상태 전이가 갈라질 수 없다. (PO 결정 2026-07-26)
--
-- 규칙을 하나라도 어기면 J-09 해시 검증 잡이 멀쩡한 약속을 "기록 검증 실패"로 낙인찍는다.
-- `supabase/tests/hash.test.ts` 가 독립적인 TS 구현과 대조해 이 함수를 지킨다.

-- ============================================================
-- content_hash
-- ============================================================

create or replace function public.lf_content_hash(
  p_title text,
  p_body text,
  p_category public.promise_category,
  p_end_date date,
  p_keeper public.keeper,
  p_reward text,
  p_penalty text,
  p_version_no int
)
returns char(64)
language sql
immutable
as $$
  -- §4-4-2.1 키 순서 **고정**, 공백 없음.
  --   jsonb_build_object 를 쓰면 키가 알파벳순으로 재정렬돼 명세를 어긴다.
  --   to_jsonb(text) 는 JSON 문자열 이스케이프(따옴표·역슬래시·제어문자)를 정확히 해 주므로
  --   값 직렬화에만 빌려 쓰고, 객체 조립은 손으로 한다.
  -- §4-4-2.2 문자열은 trim 후 NFC, null 은 빈 문자열.
  -- §4-4-2.3 end_date 는 YYYY-MM-DD.
  -- §4-4-2.4 UTF-8 → SHA-256 → 소문자 hex 64자.
  select encode(
    sha256(
      convert_to(
        '{'
          || '"title":'      || to_jsonb(normalize(btrim(coalesce(p_title,   '')), NFC))::text
          || ',"body":'      || to_jsonb(normalize(btrim(coalesce(p_body,    '')), NFC))::text
          || ',"category":'  || to_jsonb(coalesce(p_category::text, ''))::text
          || ',"end_date":'  || to_jsonb(coalesce(to_char(p_end_date, 'YYYY-MM-DD'), ''))::text
          || ',"keeper":'    || to_jsonb(coalesce(p_keeper::text, ''))::text
          || ',"reward":'    || to_jsonb(normalize(btrim(coalesce(p_reward,  '')), NFC))::text
          || ',"penalty":'   || to_jsonb(normalize(btrim(coalesce(p_penalty, '')), NFC))::text
          || ',"version_no":'|| p_version_no::text
        || '}',
        'UTF8'
      )
    ),
    'hex'
  )::char(64);
$$;

comment on function public.lf_content_hash is
  '확정 내용 해시 (02 §4-4-2). 키 순서 고정 · trim 후 NFC · null 은 빈 문자열 · 소문자 hex 64자.';

-- ============================================================
-- 기록 지문 — 사람이 읽는 표현
-- ============================================================

-- 형식은 02 에 없다. PO 결정(2026-07-26): 해시 앞 4자 - 다음 4자 - 버전번호.
-- 앞 8자를 쓰는 건 §4-11-4 의 버전 이력 표시("content_hash 앞 8자")와 같은 구간이다.
-- 확정 화면에 인쇄되고 나면 사실상 바꿀 수 없는 값이다.
create or replace function public.lf_fingerprint(
  p_content_hash char(64),
  p_version_no int
)
returns text
language sql
immutable
as $$
  -- lpad 는 대상 길이보다 긴 문자열을 **잘라낸다**. lpad('123', 2, '0') = '12' 이라
  -- 버전 123 이 버전 12 와 같은 지문을 갖게 된다. 재협의 라운드는 무제한(S-10)이므로
  -- 세 자리가 실제로 나올 수 있다. 두 자리 미만일 때만 채운다.
  select upper(substr(p_content_hash, 1, 4))
      || '-' || upper(substr(p_content_hash, 5, 4))
      || '-' || lpad(p_version_no::text, greatest(2, length(p_version_no::text)), '0');
$$;

comment on function public.lf_fingerprint is
  '기록 지문 — 확정 영역에 노출하는 사람이 읽는 표현. 예: A3F9-77C2-01. 용어는 "기록 지문"이며 해시·서명으로 부르지 않는다.';
