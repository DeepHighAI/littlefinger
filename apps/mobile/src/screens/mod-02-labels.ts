export const MOD_02_LABEL = {
  title: '증인 초대',
  close: '증인 초대 닫기',
  description: '약속을 지켜봐 줄 사람을 불러요 (최대 2명)',
  count: (occupied: number, capacity: number) => `증인 ${occupied} / ${capacity}`,
  loading: '증인 목록을 불러오는 중이에요',
  loadError: '증인 목록을 불러오지 못했어요.',
  retry: '다시 시도',
  anonymous: '초대받은 증인',
  invited: '초대 중',
  unsigned: '확인 대기',
  signed: '확인 완료',
  signedAt: (instant: string) => {
    const parts = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(instant));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';
    return `${value('year')}. ${value('month')}. ${value('day')}. ${value('hour')}:${value('minute')} 확인 서명`;
  },
  twoRemaining: '두 자리 남았어요',
  oneRemaining: '한 자리 남았어요',
  atCapacity: '증인은 최대 2명까지예요.',
  hint: '증인은 내용을 확인만 해요 — 판정 권한은 없어요',
  invite: '카카오톡으로 증인 초대하기',
  reshare: '초대 링크 다시 공유',
  shareError: '증인 초대 링크를 공유하지 못했어요.',
} as const;
