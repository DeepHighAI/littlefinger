import type { Localized } from '@littlefinger/shared';

const ko = {
  progress: (step: number, total: number) => `${step}/${total} · 처음 약속 만들기`,
  home: { title: '약속을 만들어보세요', body: '아래 버튼을 눌러 첫 약속을 시작해요.' },
  content: { title: '어떤 약속인지 적어주세요', body: '이곳을 눌러 제목과 내용을 직접 입력해요. 다 적으면 ‘조건 정하기’를 눌러요.' },
  conditions: { title: '언제, 누가 지킬까요?', body: '이곳을 눌러 종료일과 지킬 사람을 정해요. 아래에서 보상·벌칙도 고르거나 직접 적을 수 있어요.' },
  review: { title: '내용을 확인하고 보내세요', body: '내용이 맞으면 아래 버튼을 눌러요. 다음 화면에서 초대 링크를 공유할 수 있어요.' },
  invite: { title: '이제 상대방을 초대해요', body: '강조된 버튼으로 원하는 앱에 링크를 공유해요. 상대가 수락하면 약속이 시작돼요.' },
  done: '알겠어요',
};
const en = {
  progress: (step: number, total: number) => `${step}/${total} · Your first promise`,
  home: { title: 'Create your first promise', body: 'Tap the button below to get started.' },
  content: { title: 'What is your promise?', body: 'Tap here to enter a title and details. Then tap “Set the terms”.' },
  conditions: { title: 'When, and who?', body: 'Tap here to choose the end date and who keeps it. Below, you can choose or type a reward and penalty.' },
  review: { title: 'Review before sending', body: 'If everything looks right, tap below. You can share an invite link on the next screen.' },
  invite: { title: 'Invite your partner', body: 'Use the highlighted button to share the link in your preferred app. Your promise starts when your partner accepts.' },
  done: 'Got it',
} satisfies typeof ko;

export const PROMISE_TUTORIAL_LABEL: Localized<typeof ko> = { ko, en };
