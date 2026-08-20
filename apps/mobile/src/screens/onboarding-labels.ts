import type { Localized } from '@littlefinger/shared';

// 줄바꿈은 승인된 첫 페이지 시안 그대로다 — 카탈로그가 \n 을 보존한다.
const ko = {
  skip: '건너뛰기',
  badge: '새끼손가락 걸기',
  headline: '약속하고, 걸고,\n지키는 재미',
  subcopy: '둘이 정한 약속을 기록하고\n잊지 않게 챙겨드려요',
  stepWrite: '작성',
  stepInvite: '카톡 초대',
  stepKeep: '걸고 지키기',
  pageIndicator: '1/3 단계',
  start: '시작하기',
};

const en = {
  skip: 'Skip',
  badge: 'Pinky promise',
  headline: 'The fun of promising,\npinky-swearing, and keeping it',
  subcopy: 'We record the promises you two make\nand help you never forget them',
  stepWrite: 'Write',
  stepInvite: 'KakaoTalk invite',
  stepKeep: 'Swear and keep',
  pageIndicator: 'Step 1 of 3',
  start: 'Get started',
} satisfies typeof ko;

export const ONBOARDING_LABEL: Localized<typeof ko> = { ko, en };
