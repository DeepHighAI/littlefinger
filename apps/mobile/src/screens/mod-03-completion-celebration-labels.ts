export const MOD_03_LABEL = {
  title: '약속 지킴! 축하해요',
  complete: (title: string) => `${title} — 완주!`,
  highFive: (nickname: string | null) =>
    nickname === null ? '상대방과 하이파이브 하세요' : `${nickname}님과 하이파이브 하세요`,
  newPromise: '새 약속 만들기',
  share: '공유하기',
  close: '축하 닫기',
  pinky: '새끼손가락 걸기',
} as const;
