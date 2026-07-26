// 껍데기가 바깥 세계와 닿는 유일한 지점.
//
// 핸들러는 이 인터페이스만 알고 Supabase 클라이언트도 `Deno.env` 도 직접 만지지 않는다.
// 취향이 아니라 **테스트가 존재하기 위한 조건**이다 — 모듈 최상단에서 Deno 전역을 건드리면
// vitest 가 파일을 import 하는 순간 `ReferenceError: Deno is not defined` 로 죽는다.
// 그래서 각 함수는 `handler.ts`(순수)와 `index.ts`(`Deno.serve` 한 줄)로 갈라져 있다.

import type { NotificationRow } from './notify.ts';

export interface Logger {
  /** 원문 토큰·IP·User-Agent 는 절대 넘기지 않는다(§13). */
  error: (message: string, detail: unknown) => void;
}

export interface Secrets {
  /** `SHA-256(token + pepper)` 의 pepper. Supabase Secrets 에만 존재한다(04 §9). */
  invitePepper: string;
  /** IP·UA 해시용 salt. pepper 와 **다른 값**이다. */
  piiSalt: string;
}

export interface Deps {
  /**
   * `lf_*` 함수 호출. 실패는 raise 한 메시지를 그대로 담은 에러로 던진다.
   *
   * `service_role` 로 부른다 — 모든 `lf_*` 는 anon·authenticated 에서 회수돼 있다(ADR 0003).
   */
  rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;

  /**
   * JWT → `user_id`. 검증 실패는 `E_AUTH_REQUIRED` 다.
   *
   * `verify_jwt = true` 라 플랫폼이 이미 한 번 검증하지만 여기서 다시 확인한다. 설정 한 줄이
   * 잘못되면 상태 전이 세 개가 익명에게 열리는데, 그 실수를 코드가 붙들어 줘야 한다.
   */
  authenticate: (authorization: string | null) => Promise<string>;

  /** 커밋 뒤 알림 삽입. 같은 `dedupe_key` 는 조용히 무시한다. */
  insertNotification: (row: NotificationRow) => Promise<void>;

  secrets: Secrets;
  log: Logger;
  now: () => Date;
}
