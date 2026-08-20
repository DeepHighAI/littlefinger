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
  previewSectionTitle: '약속 미리보기',
  previewHint: '자세한 내용은 로그인 후 볼 수 있어요',
  serviceIntroLines: ['리틀핑거는 둘이 합의한 약속을 기록하고', '지키게 돕는 서비스예요'],
  kakaoCta: '카카오 로그인하고 내용 보기',
  googleCta: 'Google 로그인하고 내용 보기',
  ctaCaption: '앱 설치 없이 3분이면 끝나요',
  externalBrowserGuide: '기본 브라우저에서 열어 주세요.',
  continueInApp: '앱에서 계속하기',
  continueOnWeb: '웹으로 계속하기',
  legalNav: '법적 문서',
  pinkyBadge: '새끼손가락 걸기',
};

const en = {
  headline: (nickname: string) => `${nickname} sent you a promise`,
  countdownSuffix: 'left to respond',
  previewSectionTitle: 'Promise preview',
  previewHint: 'Sign in to see the full details',
  serviceIntroLines: [
    'Littlefinger records the promises you make together',
    'and helps you keep them',
  ],
  kakaoCta: 'Sign in with Kakao to view',
  googleCta: 'Sign in with Google to view',
  ctaCaption: 'Done in 3 minutes, no app required',
  externalBrowserGuide: 'Please open this page in your default browser.',
  continueInApp: 'Continue in the app',
  continueOnWeb: 'Continue on the web',
  legalNav: 'Legal documents',
  pinkyBadge: 'Pinky promise',
} satisfies typeof ko;

export const SCR_W01_LABEL: Localized<typeof ko> = { ko, en };
