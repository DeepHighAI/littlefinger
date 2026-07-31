import {
  KEEPER_LABEL,
  PARTICIPANT_ROLE_LABEL,
  PROMISE_STATUS_LABEL,
  type Answer,
  type Keeper,
  type ParticipantRole,
  type PromiseStatus,
} from '@littlefinger/shared';

export const SCR_A06_LABEL = {
  title: '이행 확인',
  back: '뒤로가기',
  loading: '이행 확인을 불러오는 중이에요',
  loadError: '이행 확인을 불러오지 못했어요.',
  notFound: '약속을 찾을 수 없어요.',
  retry: '다시 시도',
  question: '약속, 지켜졌나요?',
  sameQuestion: '상대방에게도 같은 질문이 가요',
  answerLegend: '약속을 지켰는지 선택해 주세요',
  answer: {
    KEPT: '지켰어요',
    NOT_KEPT: '안 지켜졌어요',
  } satisfies Record<Answer, string>,
  answerSubtitle: {
    KEPT: '뿌듯한 쪽',
    NOT_KEPT: '솔직한 쪽',
  } satisfies Record<Answer, string>,
  comment: '한 줄 의견',
  optional: '선택',
  commentPlaceholder: '서로에게 남길 말을 적어보세요',
  commentLimit: (max: number) =>
    `한 줄 의견은 ${max}자까지 입력할 수 있어요.`,
  submit: '제출',
  reviseSubmit: '수정 제출',
  counterpartFirst: '상대방이 먼저 답했어요',
  waiting: '상대의 확인을 기다리고 있습니다.',
  revise: '응답 수정',
  revisionUsed: '응답 수정 기회를 사용했어요.',
  beforeChecking: '종료일 다음 날부터 확인할 수 있습니다.',
  alreadyClosed: '이미 종료된 약속입니다.',
  actionError: '요청을 처리하지 못했어요. 다시 시도해 주세요.',
  disputed: '두 분의 확인이 서로 달라요. 대화로 다시 정해보세요.',
  reopen: '다시 확인 요청하기',
  currentResult: '이번 확인 결과',
  history: '이전 확인 기록',
  roundHistory: (roundNo: number) => `${roundNo}차 확인 기록`,
  submittedAt: '응답 시각',
  noComment: '의견 없음',
  responseDone: (role: Extract<ParticipantRole, 'CREATOR' | 'PARTNER'>) =>
    `${PARTICIPANT_ROLE_LABEL[role]} 응답 완료`,
  responseMissing: (role: Extract<ParticipantRole, 'CREATOR' | 'PARTNER'>) =>
    `${PARTICIPANT_ROLE_LABEL[role]} 미응답`,
  endDate: (date: string) => `종료일 ${date}`,
  keeper: (keeper: Keeper) => `지킬 사람 ${KEEPER_LABEL[keeper]}`,
  status: (status: PromiseStatus) => PROMISE_STATUS_LABEL[status],
  role: (role: Extract<ParticipantRole, 'CREATOR' | 'PARTNER'>) =>
    PARTICIPANT_ROLE_LABEL[role],
} as const;
