import {
  KST_MARK,
  KEEPER_LABEL_BY_LOCALE,
  PROMISE_CATEGORY_LABEL_BY_LOCALE,
  PROMISE_STATUS_LABEL_BY_LOCALE,
  changedPromiseFields,
  ddayFrom,
  formatDday,
  formatKstDate,
  formatKstDateTime,
  type EvidenceAvailability,
  type FulfillmentCheckView,
  type IsoDate,
  type IsoDateTime,
  type Locale,
  type Localized,
  type PromiseDetailStatus,
  type PromiseDetailVersion,
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

export type PromiseDetailVisualMode = 'friendly' | 'record' | 'terminal-neutral';

/** 상태 정책은 바꾸지 않고, 확정 전·후의 시각 언어만 순수하게 분리한다. */
export function detailVisualModeOf(status: PromiseStatus): PromiseDetailVisualMode {
  if (status === 'DRAFT' || status === 'PENDING') return 'friendly';
  if (status === 'DECLINED') return 'terminal-neutral';
  return 'record';
}

// 순수 모듈이라 훅을 못 쓴다 — 로케일은 뒤쪽 인자(기본 ko)로 받는다.
const HEADLINE: Localized<Record<PromiseDetailStatus, string>> = {
  ko: {
    PENDING: '상대방의 승인을 기다리고 있어요',
    ACTIVE: '함께 확인한 약속이에요',
    AMEND_PENDING: '변경 내용을 확인하고 있어요',
    CHECKING: '약속, 지켜졌나요?',
    COMPLETED: '함께 지킨 약속으로 기록됐어요',
    BROKEN: '이번엔 못 지켰어요',
    DISPUTED: '서로의 응답이 달라요',
    UNRESOLVED: '응답 없이 종료됐어요',
    DECLINED: '이번엔 성립되지 않았어요',
    CANCELED: '약속이 파기됐어요',
  },
  // DISPUTED en 도 P1(기록자, 판정자 아님)을 지킨다 — 누가 옳은지 암시하지 않는다.
  en: {
    PENDING: "Waiting for your partner's approval",
    ACTIVE: 'This promise was confirmed together',
    AMEND_PENDING: 'Reviewing the proposed changes',
    CHECKING: 'Was the promise kept?',
    COMPLETED: 'Recorded as a promise kept together',
    BROKEN: "It wasn't kept this time",
    DISPUTED: 'Your responses differ',
    UNRESOLVED: 'Closed without a response',
    DECLINED: "It didn't come together this time",
    CANCELED: 'The promise was canceled',
  },
};

const TONE: Record<PromiseDetailStatus, LfChipTone> = {
  PENDING: 'neutral',
  ACTIVE: 'info',
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

export function detailStatusOf(
  status: PromiseStatus,
  locale: Locale = 'ko',
): {
  label: string;
  headline: string;
  tone: LfChipTone;
} {
  if (status === 'DRAFT') throw new Error('DRAFT_HAS_NO_DETAIL');
  return {
    label: PROMISE_STATUS_LABEL_BY_LOCALE[locale][status],
    headline: HEADLINE[locale][status],
    tone: TONE[status],
  };
}

export function formatDetailDate(value: IsoDate | null, locale: Locale = 'ko'): string {
  return value === null ? SCR_A05_LABEL[locale].noEndDate : formatKstDate(value, locale);
}

export function formatDetailInstant(value: IsoDateTime): string {
  return `${formatKstDateTime(new Date(value))}${KST_MARK}`;
}

export function formatDetailDday(
  endDate: IsoDate | null,
  now: Date,
  locale: Locale = 'ko',
): string {
  return endDate === null ? SCR_A05_LABEL[locale].noEndDate : formatDday(ddayFrom(endDate, now));
}

export function fingerprintText(value: string, locale: Locale = 'ko'): string {
  return locale === 'en' ? `Record fingerprint · ${value}` : `기록 지문 · ${value}`;
}

export interface ChangedVersionRow {
  field: ReturnType<typeof changedPromiseFields>[number];
  label: string;
  before: string;
  after: string;
}

function versionFieldValue(
  version: PromiseDetailVersion,
  field: ChangedVersionRow['field'],
  locale: Locale,
): string {
  if (field === 'category') return PROMISE_CATEGORY_LABEL_BY_LOCALE[locale][version.category];
  if (field === 'keeper') return KEEPER_LABEL_BY_LOCALE[locale][version.keeper];
  if (field === 'end_date') return formatDetailDate(version.end_date, locale);
  if (field === 'reward') return version.reward ?? SCR_A05_LABEL[locale].noReward;
  if (field === 'penalty') return version.penalty ?? SCR_A05_LABEL[locale].noPenalty;
  return version[field];
}

/** 변경 협의에서는 달라진 필드만 같은 구조와 강조도로 표시한다. */
export function changedVersionRows(
  before: PromiseDetailVersion,
  after: PromiseDetailVersion,
  locale: Locale = 'ko',
): ChangedVersionRow[] {
  return changedPromiseFields(before, after).map((field) => ({
    field,
    label: SCR_A05_LABEL[locale].versionFieldLabel[field],
    before: versionFieldValue(before, field, locale),
    after: versionFieldValue(after, field, locale),
  }));
}

export function evidenceAvailabilityText(
  value: EvidenceAvailability,
  locale: Locale = 'ko',
): string | null {
  if (value === 'BLINDED') return SCR_A05_LABEL[locale].evidenceBlinded;
  if (value === 'EXPIRED') return SCR_A05_LABEL[locale].evidenceExpired;
  return null;
}

export function responseFact(
  nickname: string,
  submitted: boolean,
  locale: Locale = 'ko',
): string {
  const fact =
    locale === 'en'
      ? submitted
        ? 'Responded'
        : 'No response'
      : submitted
        ? '응답 완료'
        : '응답 없음';
  return `${nickname} · ${fact}`;
}

export function claimPresentation(
  check: FulfillmentCheckView,
  nickname: string,
  locale: Locale = 'ko',
): {
  nickname: string;
  answer: string;
  submittedAt: string;
  evidenceCount: string;
} {
  return {
    nickname,
    answer: SCR_A05_LABEL[locale].answer[check.answer],
    submittedAt: formatDetailInstant(check.submitted_at),
    evidenceCount: SCR_A05_LABEL[locale].evidenceCount(check.evidences.length),
  };
}
