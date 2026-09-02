import type { Localized } from '@littlefinger/shared';

const ko = {
  title: '증인 초대',
  close: '증인 초대 닫기',
  description: (max: number) => `약속을 지켜봐 줄 사람을 불러요 (최대 ${max}명)`,
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
  // E_WITNESS_LIMIT 의 명세 문구와 같은 말을 쓴다 — 자리를 '쓴' 사람에게만 보인다.
  atCapacity: '지금 사용할 수 있는 증인 자리를 모두 사용했어요.',
  // 자리가 0 인 사람(상대방 기본)은 쓴 적이 없으니 '잠김'으로 설명한다.
  locked: '내 증인 자리는 아직 잠겨 있어요. 광고를 보면 한 자리가 열려요.',
  unlock: '광고 보고 증인 1명 추가',
  unlocking: '광고 보상을 확인하고 있어요',
  unlockUnavailable: '지금은 광고를 볼 수 없어 잠겨 있어요.',
  unlockError: '증인 자리를 추가하지 못했어요.',
  hint: '증인은 내용을 확인만 해요 — 판정 권한은 없어요',
  invite: '초대 링크 공유하기',
  reshare: '초대 링크 다시 공유',
  shareError: '증인 초대 링크를 공유하지 못했어요.',
};

const en = {
  title: 'Invite witnesses',
  close: 'Close witness invite',
  description: (max: number) => `Bring in people to watch over the promise (up to ${max})`,
  count: (occupied: number, capacity: number) => `Witnesses ${occupied} / ${capacity}`,
  loading: 'Loading witnesses',
  loadError: 'Could not load the witness list.',
  retry: 'Try again',
  anonymous: 'Invited witness',
  invited: 'Invite sent',
  unsigned: 'Awaiting confirmation',
  signed: 'Confirmed',
  // KST 고정은 제품 규칙이다 — 로케일이 바뀌어도 표기 시간대는 Asia/Seoul 을 지킨다.
  signedAt: (instant: string) => {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(instant));
    return `Signed ${formatted}`;
  },
  twoRemaining: 'Two spots left',
  oneRemaining: 'One spot left',
  atCapacity: 'All currently available witness spots are in use.',
  locked: 'Your witness spot is still locked. Watch an ad to unlock one.',
  unlock: 'Watch an ad for 1 spot',
  unlocking: 'Verifying your ad reward',
  unlockUnavailable: 'Ads are not available right now, so this stays locked.',
  unlockError: 'Could not add a witness spot.',
  hint: 'Witnesses only confirm the details — they have no authority to judge',
  invite: 'Share invite link',
  reshare: 'Share invite link again',
  shareError: 'Could not share the witness invite link.',
} satisfies typeof ko;

export const MOD_02_LABEL: Localized<typeof ko> = { ko, en };
