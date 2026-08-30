import { WITNESS_MAX, type Localized } from '@littlefinger/shared';

/**
 * 앱 내 초대 검토(EC-I01) 문구 — 태생부터 이중언어 카탈로그다.
 *
 * ko 는 웹 SCR-W01/W02/W06·종결 화면과 **문자 그대로 같은 카피**를 쓴다. 같은 초대를
 * 웹에서 열든 앱에서 열든 같은 문장을 만나야 한다. 웹 문구가 바뀌면 여기도 함께 바꾼다.
 */
const ko = {
  // ── 랜딩 (비로그인, §4-3-3 최소 정보) ──
  landingHeadline: (nickname: string) => `${nickname}님이 약속을 보냈어요`,
  countdownSuffix: '안에 확인해 주세요',
  previewSectionTitle: '약속 미리보기',
  previewHint: '자세한 내용은 로그인 후 볼 수 있어요',
  kakaoCta: '카카오 로그인하고 내용 보기',
  googleCta: 'Google 로그인하고 내용 보기',
  authCanceled: '로그인을 취소했습니다. 다시 시도해 주세요.',
  authError: '지금 로그인이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.',
  // ── 검토 (§4-3-4, SCR-W02 동형) ──
  reviewHeadline: (nickname: string) => `${nickname}님과의 약속, 꼼꼼히 봐주세요`,
  endDate: '종료일',
  noEndDate: '종료일 없음',
  keeper: '지킬 사람',
  category: '카테고리',
  reward: '보상',
  penalty: '벌칙',
  witnessNotice: `확정 후 증인을 초대할 수 있어요(최대 ${WITNESS_MAX}명)`,
  approveCta: '승인하기',
  amendCta: '수정 제안',
  declineCta: '거절하기',
  confirmQuestion: (nickname: string) => `${nickname}님이 보낸 약속이 맞나요?`,
  confirmBody: '승인하면 두 사람의 기록으로 확정돼요.',
  confirmYes: '네, 승인합니다',
  confirmNo: '아니에요',
  endDatePassedMessage:
    '종료일이 지난 약속은 승인할 수 없어요. 작성자에게 종료일 변경을 요청해 주세요.',
  amendFieldLabel: '수정 제안 의견',
  // ── 종결 (웹 /responded/:outcome 동형) ──
  doneDeclined: '거절했어요. 작성자에게 알려드릴게요.',
  doneAmendSuggested: '수정 제안을 보냈어요. 작성자가 내용을 고쳐 다시 보내면 알림을 받게 돼요.',
  goHome: '홈으로',
  // ── 실패 (SCR-W06 동형 다섯 사유 + EC-B05) ──
  unavailableTitle: '이 링크는 더 쓸 수 없어요',
  oneTimeNotice: '초대 링크는 1회용이에요',
  unavailableReason: {
    E_INVITE_EXPIRED: '초대 링크가 만료되었습니다. 상대에게 새 링크를 요청해 주세요.',
    E_INVITE_USED: '이미 사용된 초대입니다.',
    E_INVITE_REVOKED: '이 초대는 취소되었습니다.',
    E_BLOCKED: '이 초대는 열 수 없습니다.',
    E_NOT_FOUND: '초대 링크를 찾을 수 없습니다.',
  },
  selfInvite: '본인은 상대방이 될 수 없어요.',
  retryCta: '다시 시도',
  invalidToken: '초대 링크를 확인할 수 없어요.',
  // ── 증인 핸드오프 (웹 SCR-W05 로) ──
  handoffTitle: '초대 확인은 웹에서 이어져요',
  handoffBody: '카카오 로그인과 승인은 기본 브라우저에서 안전하게 진행합니다.',
  handoffAction: '기본 브라우저에서 열기',
  handoffFailure: '기본 브라우저를 열지 못했어요. 다시 시도해 주세요.',
};

const en = {
  landingHeadline: (nickname: string) => `${nickname} sent you a promise`,
  countdownSuffix: 'left to respond',
  previewSectionTitle: 'Promise preview',
  previewHint: 'Sign in to see the full details',
  kakaoCta: 'Sign in with Kakao to view',
  googleCta: 'Sign in with Google to view',
  authCanceled: 'Sign-in was canceled. Please try again.',
  authError: 'Sign-in is not working right now. Please try again shortly.',
  reviewHeadline: (nickname: string) => `Review your promise with ${nickname} carefully`,
  endDate: 'End date',
  noEndDate: 'No end date',
  keeper: 'Who keeps it',
  category: 'Category',
  reward: 'Reward',
  penalty: 'Penalty',
  witnessNotice: `You can invite witnesses after it is confirmed (up to ${WITNESS_MAX})`,
  approveCta: 'Approve',
  amendCta: 'Suggest a change',
  declineCta: 'Decline',
  confirmQuestion: (nickname: string) => `Is this the promise ${nickname} sent you?`,
  confirmBody: 'Approving makes it a record for both of you.',
  confirmYes: 'Yes, approve it',
  confirmNo: 'Not this one',
  endDatePassedMessage:
    'A promise past its end date cannot be approved. Ask the creator to change the end date.',
  amendFieldLabel: 'Suggested change',
  doneDeclined: 'Declined. We will let the creator know.',
  doneAmendSuggested:
    'Suggestion sent. You will be notified when the creator updates the promise.',
  goHome: 'Go home',
  unavailableTitle: 'This link can no longer be used',
  oneTimeNotice: 'Invite links are single-use',
  unavailableReason: {
    E_INVITE_EXPIRED: 'This invite link has expired. Ask for a new link.',
    E_INVITE_USED: 'This invite has already been used.',
    E_INVITE_REVOKED: 'This invite has been canceled.',
    E_BLOCKED: 'This invite cannot be opened.',
    E_NOT_FOUND: 'Invite link not found.',
  },
  selfInvite: 'You cannot be your own partner.',
  retryCta: 'Try again',
  invalidToken: 'This invite link cannot be read.',
  handoffTitle: 'Continue this invite on the web',
  handoffBody: 'Sign-in and approval continue safely in your default browser.',
  handoffAction: 'Open in default browser',
  handoffFailure: 'Could not open the browser. Please try again.',
} satisfies typeof ko;

export const INVITE_REVIEW_LABEL: Localized<typeof ko> = { ko, en };
