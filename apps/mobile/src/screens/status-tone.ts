import type { PromiseStatus } from '@littlefinger/shared';

import type { LfChipTone } from '../components/LfChip';

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
