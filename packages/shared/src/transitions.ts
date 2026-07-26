/**
 * 상태 전이표 — 02_세부기능명세서 §7-1.
 *
 * **이 표에 없는 전이는 구현하지 않는다.** 표를 데이터로 두고 `canTransition` 이
 * 그 데이터만 보게 하면, 전이 규칙이 코드 여기저기로 흩어지지 않는다.
 *
 * 여기 있는 것은 "이 전이가 표에 존재하는가"뿐이다.
 * 선행 조건(권한·토큰 유효성·기한)은 서버가 별도로 검사한다 —
 * 모든 전이는 서버에서만 수행하고 클라이언트는 요청만 할 수 있다(02 §1-3).
 */

import type { PromiseStatus } from './promise.js';

export interface Transition {
  /** 명세의 전이 ID. 새로 만들지 않는다(02 §1-2). */
  id: string;
  /** `null` 은 신규 생성 — 이전 상태가 없다. */
  from: PromiseStatus | null;
  to: PromiseStatus;
  trigger: string;
}

export const TRANSITIONS: readonly Transition[] = [
  { id: 'T-01', from: null, to: 'DRAFT', trigger: '작성자 저장' },
  { id: 'T-02', from: 'DRAFT', to: 'PENDING', trigger: '초대 발송' },
  { id: 'T-03', from: 'PENDING', to: 'ACTIVE', trigger: '상대 승인' },
  { id: 'T-04', from: 'PENDING', to: 'DECLINED', trigger: '상대 거절' },
  { id: 'T-05', from: 'PENDING', to: 'DRAFT', trigger: '상대 수정 제안' },
  // 초대만 만료되고 약속 상태는 유지된다. 작성자가 재발송할 수 있다.
  { id: 'T-06', from: 'PENDING', to: 'PENDING', trigger: '초대 링크 만료 (J-04)' },
  { id: 'T-07', from: 'ACTIVE', to: 'AMEND_PENDING', trigger: '변경·파기 요청' },
  { id: 'T-08', from: 'AMEND_PENDING', to: 'ACTIVE', trigger: '변경 승인' },
  { id: 'T-09', from: 'AMEND_PENDING', to: 'ACTIVE', trigger: '변경 거절·철회·기한 만료 (J-05)' },
  { id: 'T-10', from: 'AMEND_PENDING', to: 'CANCELED', trigger: '파기 승인' },
  { id: 'T-11', from: 'ACTIVE', to: 'CHECKING', trigger: '종료일 익일 00:00 KST (J-02)' },
  { id: 'T-12', from: 'CHECKING', to: 'COMPLETED', trigger: '양측 KEPT' },
  { id: 'T-13', from: 'CHECKING', to: 'BROKEN', trigger: '양측 NOT_KEPT' },
  // 판정하지 않는다. 양측 주장을 나란히 기록만 한다(원칙 P1).
  { id: 'T-14', from: 'CHECKING', to: 'DISPUTED', trigger: '응답 불일치' },
  { id: 'T-15', from: 'CHECKING', to: 'UNRESOLVED', trigger: '응답 기한 경과 (J-03)' },
  { id: 'T-16', from: 'DISPUTED', to: 'CHECKING', trigger: '재협의 요청' },
  { id: 'T-17', from: 'DISPUTED', to: 'DISPUTED', trigger: '재협의 라운드도 불일치·무응답' },
  { id: 'T-18', from: 'PENDING', to: 'DECLINED', trigger: '초대 대상이 수락 전 탈퇴' },
];

const ALLOWED_PAIRS: ReadonlySet<string> = new Set(
  TRANSITIONS.filter((t) => t.from !== null).map((t) => `${t.from}>${t.to}`),
);

/** 전이표에 존재하는 전이인지만 본다. 선행 조건 검사는 서버의 몫이다. */
export function canTransition(from: PromiseStatus, to: PromiseStatus): boolean {
  return ALLOWED_PAIRS.has(`${from}>${to}`);
}
