import type { Localized } from '@littlefinger/shared';

/**
 * SCR-W03 문구.
 *
 * stampLabel 은 §4-4-3 이 요구하는 "확정된 약속" 라벨이다. 레퍼런스 HTML 의 "딱! 약속이
 * 성립됐어요"를 대신한다 — 문서 우선순위에서 `02` 가 레퍼런스보다 위다(CLAUDE.md §4,
 * SCR-W06 과 같은 판단).
 *
 * confirmedAt · approvalLine 이 접미 상수에서 함수로 바뀐 이유: 영어는 동사가 시각 앞에
 * 오고 닉네임과 역할 사이에 공백이 필요해, 접미 연결로는 두 언어를 다 만족할 수 없다.
 * 로케일별 문법은 함수 본문이 갖는다.
 */
const ko = {
  stampLabel: '확정된 약속',
  confirmedAt: (time: string) => `${time} 확정`,
  approvalLine: (nickname: string, role: string, actedAt: string) =>
    `${nickname}(${role}) 승인 ${actedAt}`,
  fingerprintLabel: '기록 지문',
  revisitCopy: '이 약속은 로그인하면 언제든 다시 볼 수 있어요',
  revisitCta: '참여 중인 약속 보기',
  androidStoreCta: 'Android 앱 설치하기',
  androidStoreCopy: '앱에서는 푸시로 약속을 챙겨드려요',
  pinkyAlt: '새끼손가락 걸기',
};

const en = {
  stampLabel: 'Confirmed promise',
  confirmedAt: (time: string) => `Confirmed ${time}`,
  approvalLine: (nickname: string, role: string, actedAt: string) =>
    `${nickname} (${role}) approved ${actedAt}`,
  fingerprintLabel: 'Record fingerprint',
  revisitCopy: 'Sign in anytime to see this promise again',
  revisitCta: 'View my promises',
  androidStoreCta: 'Get the Android app',
  androidStoreCopy: 'The app sends push reminders for your promises',
  pinkyAlt: 'Pinky promise',
} satisfies typeof ko;

export const SCR_W03_LABEL: Localized<typeof ko> = { ko, en };
