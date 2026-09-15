import type { Localized } from '@littlefinger/shared';
const ko = {
  viewRecord: '약속 보기', leave: '증인 나가기', leaveConfirm: '증인에서 나갈까요?', leaveHint: '이 약속을 더 이상 볼 수 없어요. 이미 남긴 확인 서명은 유지돼요.', left: '증인에서 나왔어요',
  title: '증인으로 확인하기', role: '증인은 약속 내용을 확인해요. 누가 옳은지 판정하지 않아요.',
  loading: '약속을 불러오는 중이에요', error: '처리하지 못했어요. 다시 시도해 주세요.',
  retry: '다시 시도', join: '증인으로 참여하기', sign: '내용을 확인했습니다',
  waiting: '약속이 확정되면 전체 내용을 보고 확인 서명할 수 있어요.',
  confirmed: '확인 서명을 남겼어요', joined: '증인으로 참여했어요',
  decline: '거절하기', declineConfirm: '이 초대를 거절할까요?', stay: '돌아가기',
  declined: '초대를 거절했어요', close: '홈으로', busy: '처리하는 중…',
  body: '약속 내용', reward: '보상', penalty: '벌칙', endDate: '종료일', noEndDate: '종료일 없음',
  creator: '작성자', partner: '상대방', keeper: '지킬 사람', category: '카테고리',
  signFailed: '증인 참여는 완료됐지만 확인 서명을 저장하지 못했어요. 다시 눌러주세요.',
};
const en = {
  viewRecord: 'View promise', leave: 'Leave as witness', leaveConfirm: 'Leave this witness role?', leaveHint: 'You will lose access to this promise. Existing signatures are kept.', left: 'You left the witness role',
  title: 'Review as a witness', role: 'Witnesses review the content. They do not judge who is right.',
  loading: 'Loading the promise', error: 'Could not complete the request. Please try again.',
  retry: 'Try again', join: 'Join as a witness', sign: 'I have reviewed the content',
  waiting: 'Once the promise is confirmed, you can review the full details and sign.',
  confirmed: 'Your review signature is saved', joined: 'You joined as a witness',
  decline: 'Decline', declineConfirm: 'Decline this invitation?', stay: 'Go back',
  declined: 'Invitation declined', close: 'Go home', busy: 'Processing…',
  body: 'Promise details', reward: 'Reward', penalty: 'Penalty', endDate: 'End date', noEndDate: 'No end date',
  creator: 'Creator', partner: 'Partner', keeper: 'Who keeps it', category: 'Category',
  signFailed: 'You joined as a witness, but your signature was not saved. Please try again.',
} satisfies typeof ko;
export const WITNESS_REVIEW_LABEL: Localized<typeof ko> = { ko, en };
