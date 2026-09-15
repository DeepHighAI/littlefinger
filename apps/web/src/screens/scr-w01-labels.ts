import type { Localized } from '@littlefinger/shared';

/**
 * SCR-W01 문구 — 첫 이중언어 카탈로그.
 *
 * 헤드라인이 문자열 접미('님이…')에서 함수로 바뀐 이유: 영어는 닉네임이 문장 앞에
 * 오지 않아 접미 연결 자체가 성립하지 않는다. 로케일별 문법은 함수 본문이 갖는다.
 */
const ko = {
  headline: (nickname: string) => `${nickname}님이 약속을 보냈어요`,
  countdownSuffix: '안에 확인해 주세요',
  previewEyebrow: '약속 미리보기',
  previewHint: '자세한 내용은 로그인 후 볼 수 있어요',
  serviceIntroLines: ['리틀핑거는 둘이 합의한 약속을 기록하고', '지키게 돕는 서비스예요'],
  kakaoCta: '카카오 로그인하고 내용 보기',
  googleCta: 'Google 로그인하고 내용 보기',
  ctaCaption: '앱 설치 없이 3분이면 끝나요',
  externalBrowserGuide: '기본 브라우저에서 열어 주세요.',
  externalBrowserSteps: '메뉴에서 ‘다른 브라우저로 열기’를 선택하거나 초대 링크를 복사해 브라우저에서 연 뒤 Google로 로그인해 주세요.',
  continueInApp: '앱에서 확인하기',
  witnessHeadline: (nickname: string) => `${nickname}님이 증인으로 초대했어요`,
  decline: '거절하기',
  confirmDecline: '이 초대를 거절할까요?',
  declineHint: '거절하면 이 링크로 참여할 수 없어요.',
  stay: '돌아가기',
  declining: '거절하는 중…',
  declined: '초대를 거절했어요',
  declinedHint: '초대를 보낸 사람에게 알려드릴게요.',
  installHint: '앱이 없거나 이 화면으로 돌아오면 설치·업데이트 후 초대 링크를 다시 열어주세요.',
  androidHint: '현재 Android 앱에서 참여할 수 있어요. Android 기기에서 이 링크를 열어주세요.',
  retry: '다시 시도',
  continueOnWeb: '웹으로 계속하기',
  legalNav: '법적 문서',
  pinkyBadge: '새끼손가락 걸기',
};

const en = {
  headline: (nickname: string) => `${nickname} sent you a promise`,
  countdownSuffix: 'left to respond',
  previewEyebrow: 'Promise preview',
  previewHint: 'Sign in to see the full details',
  serviceIntroLines: [
    'Littlefinger records the promises you make together',
    'and helps you keep them',
  ],
  kakaoCta: 'Sign in with Kakao to view',
  googleCta: 'Sign in with Google to view',
  ctaCaption: 'Done in 3 minutes, no app required',
  externalBrowserGuide: 'Please open this page in your default browser.',
  externalBrowserSteps: 'Choose “Open in browser” from the menu, or copy the invite link into your browser, then sign in with Google.',
  continueInApp: 'View in the app',
  witnessHeadline: (nickname: string) => `${nickname} invited you as a witness`,
  decline: 'Decline',
  confirmDecline: 'Decline this invitation?',
  declineHint: 'You will no longer be able to join with this link.',
  stay: 'Go back',
  declining: 'Declining…',
  declined: 'Invitation declined',
  declinedHint: 'We’ll notify the person who invited you.',
  installHint: 'If the app is missing or you return here, install or update it, then reopen this invitation.',
  androidHint: 'Joining is currently available on Android. Open this link on an Android device.',
  retry: 'Try again',
  continueOnWeb: 'Continue on the web',
  legalNav: 'Legal documents',
  pinkyBadge: 'Pinky promise',
} satisfies typeof ko;

export const SCR_W01_LABEL: Localized<typeof ko> = { ko, en };
