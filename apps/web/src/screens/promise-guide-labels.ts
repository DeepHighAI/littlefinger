import type { Localized } from '@littlefinger/shared';

const ko = {
  title: '둘이 정한 약속, 같은 내용으로 기억하려면',
  description: '약속 내용과 확인 기준을 함께 정하고, 리틀핑거에 기록하는 방법. Android에서 만들고 상대는 웹에서 수락해요.',
  reviewed: '리틀핑거 운영팀 · 2026년 9월 15일 확인',
  intro: '리틀핑거는 두 사람이 함께 정한 약속을 하나의 기록으로 남기는 서비스예요. 약속을 만드는 사람은 Android 앱을 쓰고, 상대는 받은 초대 링크에서 앱 설치 없이 내용을 확인하고 수락해요. 수락할 때는 카카오 또는 Google 로그인이 필요해요.',
  prepareTitle: '약속을 적기 전에 함께 정할 것',
  checklist: [
    '무엇을 할지: 두 사람이 같은 뜻으로 이해할 수 있게 적어요.',
    '누가 지킬지: 약속을 지킬 사람을 정해요.',
    '언제 확인할지: 종료일과 결과를 확인할 기준을 함께 정해요.',
    '보상이나 벌칙이 있다면: 무엇을 하기로 했는지 구체적으로 적어요.',
  ],
  exampleTitle: '공부 약속을 예로 들어 볼게요',
  example: '“공부 열심히 하기” 대신 “이번 토요일까지 3장을 읽고, 읽은 부분을 이야기하기”처럼 적으면 무엇을 약속했는지 다시 확인하기 쉬워요. 이 예시는 사용 방법을 설명하기 위한 가상의 약속이에요.',
  flowTitle: '리틀핑거에서는 이렇게 남겨요',
  steps: [
    'Android 앱에서 약속 내용과 지킬 사람, 종료일을 작성해요.',
    '상대에게 초대 링크를 보내요. 상대는 웹에서 로그인한 뒤 내용을 확인하고 수락해요. iPhone에서도 웹으로 참여할 수 있어요.',
    '상대가 수락하면 약속이 시작돼요. 확정된 내용을 바꾸려면 새 버전으로 다시 합의해요.',
    '종료일에 두 사람이 결과를 답해요. 답이 다르면 두 사람의 답을 나란히 기록해요.',
  ],
  limitsTitle: '기록이 대신해 주지 않는 것',
  limits: '리틀핑거는 누가 옳은지 판정하지 않아요. 돈을 맡아 두거나 보상·벌칙을 대신 집행하지도 않아요. 서로 동의한 내용을 확인하는 기록으로 사용해 주세요.',
  store: 'Google Play에서 받기',
  home: '리틀핑거 소개',
  privacy: '개인정보처리방침',
};

const en = {
  title: 'Keep the same record of the promise you made together',
  description: 'Agree on the details and how to check a promise, then record it in Littlefinger. Create on Android; the other person accepts on the web.',
  reviewed: 'Littlefinger team · Reviewed September 15, 2026',
  intro: 'Littlefinger records a promise agreed by two people. The creator uses the Android app. The other person reviews and accepts an invite link on the web without installing the app. Accepting requires signing in with Kakao or Google.',
  prepareTitle: 'Agree on the details first',
  checklist: [
    'What to do: write it so both people understand the same thing.',
    'Who will do it: choose the person who will keep the promise.',
    'When to check: agree on an end date and how to check the result.',
    'Any reward or forfeit: write down exactly what you agreed to do.',
  ],
  exampleTitle: 'A study promise example',
  example: '“Read chapter three by Saturday and discuss what we read” is easier to revisit than “Study harder.” This is an illustrative example, not a report about a real user.',
  flowTitle: 'How to record it in Littlefinger',
  steps: [
    'Write the promise, who will keep it and the end date in the Android app.',
    'Share an invite link. The other person signs in, reviews and accepts on the web. People using an iPhone can participate on the web too.',
    'The promise starts when the other person accepts. Changes to confirmed details require a new agreed version.',
    'Both people report the result on the end date. If the answers differ, both answers are recorded side by side.',
  ],
  limitsTitle: 'What the record does not do',
  limits: 'Littlefinger does not decide who is right, hold money, or enforce rewards or forfeits. Use it to check the details you agreed on together.',
  store: 'Get it on Google Play',
  home: 'About Littlefinger',
  privacy: 'Privacy Policy',
} satisfies typeof ko;

export const PROMISE_GUIDE_LABEL: Localized<typeof ko> = { ko, en };
