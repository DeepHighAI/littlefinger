import {
  KST_MARK,
  PROMISE_STATUS_LABEL,
  ddayFrom,
  formatDday,
  formatKstDate,
  formatKstDateTime,
  type EvidenceAvailability,
  type FulfillmentCheckView,
  type IsoDate,
  type IsoDateTime,
  type PromiseDetailStatus,
  type PromiseStatus,
} from '@littlefinger/shared';

import type { LfChipTone } from '../components/LfChip';
import { SCR_A05_LABEL } from './scr-a05-labels';

export type PromiseDetailVariant =
  | 'PENDING'
  | 'ACTIVE'
  | 'AMEND_PENDING'
  | 'CHECKING'
  | 'COMPLETED'
  | 'BROKEN'
  | 'DISPUTED'
  | 'UNRESOLVED'
  | 'TERMINAL';

const HEADLINE: Record<PromiseDetailStatus, string> = {
  PENDING: '상대방의 승인을 기다리고 있어요',
  ACTIVE: '두 사람이 손가락 걸었어요!',
  AMEND_PENDING: '변경 내용을 확인하고 있어요',
  CHECKING: '약속, 지켜졌나요?',
  COMPLETED: '약속 지킴! 완주했어요',
  BROKEN: '이번엔 못 지켰어요',
  DISPUTED: '서로의 응답이 달라요',
  UNRESOLVED: '응답 없이 종료됐어요',
  DECLINED: '이번엔 성립되지 않았어요',
  CANCELED: '약속이 파기됐어요',
};

const TONE: Record<PromiseDetailStatus, LfChipTone> = {
  PENDING: 'neutral',
  ACTIVE: 'status',
  AMEND_PENDING: 'urgent',
  CHECKING: 'urgent',
  COMPLETED: 'done',
  BROKEN: 'broken',
  DISPUTED: 'neutral',
  UNRESOLVED: 'neutral',
  DECLINED: 'neutral',
  CANCELED: 'neutral',
};

export function detailVariantOf(status: PromiseStatus): PromiseDetailVariant {
  if (status === 'DRAFT') throw new Error('DRAFT_HAS_NO_DETAIL');
  if (status === 'DECLINED' || status === 'CANCELED') return 'TERMINAL';
  return status;
}

export function detailStatusOf(status: PromiseStatus): {
  label: string;
  headline: string;
  tone: LfChipTone;
} {
  if (status === 'DRAFT') throw new Error('DRAFT_HAS_NO_DETAIL');
  return {
    label: PROMISE_STATUS_LABEL[status],
    headline: HEADLINE[status],
    tone: TONE[status],
  };
}

export function formatDetailDate(value: IsoDate): string {
  return formatKstDate(value);
}

export function formatDetailInstant(value: IsoDateTime): string {
  return `${formatKstDateTime(new Date(value))}${KST_MARK}`;
}

export function formatDetailDday(endDate: IsoDate, now: Date): string {
  return formatDday(ddayFrom(endDate, now));
}

export function fingerprintText(value: string): string {
  return `기록 지문 · ${value}`;
}

export function evidenceAvailabilityText(value: EvidenceAvailability): string | null {
  if (value === 'BLINDED') return SCR_A05_LABEL.evidenceBlinded;
  if (value === 'EXPIRED') return SCR_A05_LABEL.evidenceExpired;
  return null;
}

export function responseFact(nickname: string, submitted: boolean): string {
  return `${nickname} · ${submitted ? '응답 완료' : '응답 없음'}`;
}

export function claimPresentation(
  check: FulfillmentCheckView,
  nickname: string,
): {
  nickname: string;
  answer: string;
  submittedAt: string;
  evidenceCount: string;
} {
  return {
    nickname,
    answer: check.answer === 'KEPT' ? '지켰어요' : '안 지켜졌어요',
    submittedAt: formatDetailInstant(check.submitted_at),
    evidenceCount:
      check.evidences.length === 0 ? '증빙 없음' : `증빙 ${check.evidences.length}장`,
  };
}
