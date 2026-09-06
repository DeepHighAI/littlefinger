import type { PromiseStatus } from '@littlefinger/shared';

import type { LfChipTone } from '../components/LfChip';
import type { LfIconName } from '../components/LfIcon';
import type { LfStatusTileTone } from '../components/LfStatusTile';

/** 상세 헤더 상태 칩의 면 — DISPUTED 는 어느 쪽도 편들지 않는 종이(P1). 타일 표와 다르다. */
const STATUS_TONE: Record<PromiseStatus, LfChipTone> = {
  DRAFT: 'yellow',
  PENDING: 'paper',
  ACTIVE: 'mint',
  AMEND_PENDING: 'sky',
  CHECKING: 'pink',
  COMPLETED: 'mint',
  BROKEN: 'pink',
  DISPUTED: 'paper',
  UNRESOLVED: 'muted',
  DECLINED: 'muted',
  CANCELED: 'muted',
};

export function statusToneOf(status: PromiseStatus): LfChipTone {
  return STATUS_TONE[status];
}

export interface StatusTile {
  icon: LfIconName;
  tone: LfStatusTileTone;
  /** PENDING 만 점선 — 아직 상대가 확정하지 않은 자리 */
  dashed: boolean;
}

/** README 상태 타일 표 — 아이콘과 면 색. 라벨은 언제나 PROMISE_STATUS_LABEL 이 따로 붙는다(§8-7). */
const STATUS_TILE: Record<PromiseStatus, StatusTile> = {
  DRAFT: { icon: 'edit', tone: 'yellow', dashed: false },
  PENDING: { icon: 'hourglass_empty', tone: 'paper', dashed: true },
  ACTIVE: { icon: 'bolt', tone: 'mint', dashed: false },
  AMEND_PENDING: { icon: 'sync_alt', tone: 'sky', dashed: false },
  CHECKING: { icon: 'notification_important', tone: 'pink', dashed: false },
  COMPLETED: { icon: 'check', tone: 'mint', dashed: false },
  BROKEN: { icon: 'close', tone: 'pink', dashed: false },
  DISPUTED: { icon: 'balance', tone: 'muted', dashed: false },
  UNRESOLVED: { icon: 'remove', tone: 'muted', dashed: false },
  DECLINED: { icon: 'remove', tone: 'muted', dashed: false },
  CANCELED: { icon: 'remove', tone: 'muted', dashed: false },
};

const NO_END_ACTIVE: StatusTile = { icon: 'all_inclusive', tone: 'sky', dashed: false };

export function statusTileOf(status: PromiseStatus, noEnd = false): StatusTile {
  return status === 'ACTIVE' && noEnd ? NO_END_ACTIVE : STATUS_TILE[status];
}
