import type { Localized } from '@littlefinger/shared';

const ko = {
  title: '약속 지킴! 축하해요',
  complete: (title: string) => `${title} — 완주!`,
  highFive: (nickname: string | null) =>
    nickname === null ? '상대방과 하이파이브 하세요' : `${nickname}님과 하이파이브 하세요`,
  newPromise: '새 약속 만들기',
  share: '공유하기',
  close: '축하 닫기',
  pinky: '새끼손가락 걸기',
};

const en = {
  title: 'Promise kept! Congrats',
  complete: (title: string) => `${title} — complete!`,
  // 님 접미가 없는 대신 이름을 문장 끝에 둔다 — 영어 어순은 함수 본문이 감당한다.
  highFive: (nickname: string | null) =>
    nickname === null ? 'High-five your partner' : `High-five ${nickname}`,
  newPromise: 'Create a new promise',
  share: 'Share',
  close: 'Close celebration',
  pinky: 'Pinky promise',
} satisfies typeof ko;

export const MOD_03_LABEL: Localized<typeof ko> = { ko, en };
