import type { Localized } from '@littlefinger/shared';

// 테스트 로그인 문구도 카탈로그에 있지만 릴리스 번들에서는 `__DEV__` 게이트가 UI 째로 걷어낸다.
const ko = {
  wordmark: '리틀핑거',
  subtitle: '새끼손가락 걸고, 약속!',
  hook: '오늘도 새끼손가락 걸어볼까요?',
  logo: '리틀핑거 로고',
  kakaoCta: '카카오로 시작하기',
  googleCta: 'Google로 시작하기',
  kakaoCanceled: '로그인을 취소했습니다. 다시 시도해 주세요.',
  kakaoError: '지금 카카오 로그인이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.',
  nicknameRequired: '닉네임 정보는 약속 기록에 꼭 필요합니다. 동의 후 이용해 주세요.',
  googleError: '지금 Google 로그인이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.',
  sessionExpired: '다시 로그인해 주세요.',
  legalDocumentError: '법적 문서를 열 수 없습니다. 잠시 후 다시 시도해 주세요.',
  legalAgreement: '시작하면 위 문서에 동의하게 돼요',
  testLoginTitle: '테스트 로그인 (개발 빌드 전용)',
  testLoginEmail: '테스트 이메일',
  testLoginPassword: '테스트 비밀번호',
  testLoginSubmit: '테스트 계정으로 로그인',
  testLoginError: '테스트 로그인에 실패했습니다. 계정 정보를 확인해 주세요.',
};

const en = {
  wordmark: 'Littlefinger',
  subtitle: 'Pinky swear, it’s a promise!',
  hook: 'Ready to link pinkies today?',
  logo: 'Littlefinger logo',
  kakaoCta: 'Start with Kakao',
  googleCta: 'Start with Google',
  kakaoCanceled: 'Sign-in was canceled. Please try again.',
  kakaoError: 'Kakao sign-in is not working right now. Please try again shortly.',
  nicknameRequired: 'A nickname is required for promise records. Please agree and try again.',
  googleError: 'Google sign-in is not working right now. Please try again shortly.',
  sessionExpired: 'Please sign in again.',
  legalDocumentError: 'Could not open the document. Please try again shortly.',
  legalAgreement: 'By starting, you agree to the documents above',
  testLoginTitle: 'Test sign-in (dev builds only)',
  testLoginEmail: 'Test email',
  testLoginPassword: 'Test password',
  testLoginSubmit: 'Sign in with test account',
  testLoginError: 'Test sign-in failed. Check the account details.',
} satisfies typeof ko;

export const LOGIN_LABEL: Localized<typeof ko> = { ko, en };
