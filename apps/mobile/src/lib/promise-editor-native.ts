import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import {
  END_DATE_MAX_DAYS,
  ENDPOINT,
  ERROR_MESSAGE,
  toKstDate,
  type PromiseInviteResponse,
} from '@littlefinger/shared';

import { PromiseDraftRepository } from './draft-autosave.ts';
import {
  ensureInviteToken,
  InviteRepository,
} from './invite-flow.ts';
import {
  callMobileFunctionNative,
  currentMobileUserId,
} from './mobile-api-native.ts';
import { MobileApiError } from './mobile-api.ts';
import {
  EMPTY_PROMISE_DRAFT,
  type PromiseDraftFields,
} from './promise-draft.ts';
import { submitPromiseDraft } from './promise-editor-api.ts';
import {
  getMobileEncryptedStorage,
  getMobileSupabaseClient,
} from './supabase-native.ts';

const KST_TIME_ZONE = 'Asia/Seoul';
const DAY_MS = 24 * 60 * 60 * 1000;

function repository(): PromiseDraftRepository {
  return new PromiseDraftRepository(getMobileEncryptedStorage());
}

function asDraft(row: Record<string, unknown>): PromiseDraftFields {
  return {
    title: String(row.title),
    body: String(row.body),
    category: row.category as PromiseDraftFields['category'],
    end_date: String(row.end_date),
    keeper: row.keeper as PromiseDraftFields['keeper'],
    reward: row.reward === null ? '' : String(row.reward),
    penalty: row.penalty === null ? '' : String(row.penalty),
    witness_enabled: row.witness_enabled === true,
  };
}

export async function loadEditorDraft(
  promiseId: string | null,
): Promise<PromiseDraftFields> {
  const userId = await currentMobileUserId();
  const local = await repository().load(userId, promiseId);
  if (local !== null) return local;
  if (promiseId === null) return EMPTY_PROMISE_DRAFT;

  const { data, error } = await getMobileSupabaseClient()
    .from('promises')
    .select('title,body,category,end_date,keeper,reward,penalty,witness_enabled')
    .eq('id', promiseId)
    .eq('status', 'DRAFT')
    .maybeSingle();
  if (error !== null) throw error;
  if (data === null) {
    throw new MobileApiError(
      'E_NOT_FOUND',
      ERROR_MESSAGE.E_NOT_FOUND ?? '약속을 찾을 수 없어요.',
    );
  }
  return asDraft(data);
}

export async function saveEditorLocalDraft(
  promiseId: string | null,
  draft: PromiseDraftFields,
): Promise<void> {
  await repository().save(await currentMobileUserId(), promiseId, draft);
}

export async function clearEditorLocalDraft(promiseId: string | null): Promise<void> {
  await repository().remove(await currentMobileUserId(), promiseId);
}

async function issueInvite(promiseId: string): Promise<PromiseInviteResponse> {
  return await callMobileFunctionNative(
    ENDPOINT.promiseInvite,
    { promise_id: promiseId },
    { idempotent: true },
  );
}

export async function submitEditorDraft(
  draft: PromiseDraftFields,
  promiseId: string | null,
  send: boolean,
) {
  const response = await submitPromiseDraft(draft, promiseId, send, {
    call: callMobileFunctionNative,
  });

  if (response.status === 'PENDING') {
    const invite = await ensureInviteToken(response, issueInvite);
    await new InviteRepository(getMobileEncryptedStorage()).save(
      await currentMobileUserId(),
      invite,
    );
    return invite;
  }
  return response;
}

function isoDateAtKstMidnight(value: string): Date {
  return new Date(`${value}T00:00:00+09:00`);
}

export function openEndDatePicker(
  value: string,
  onSelect: (isoDate: string) => void,
): void {
  const today = isoDateAtKstMidnight(toKstDate(new Date()));
  const minimumDate = new Date(today.getTime() + DAY_MS);
  const maximumDate = new Date(today.getTime() + END_DATE_MAX_DAYS * DAY_MS);
  const selected = value === '' ? minimumDate : isoDateAtKstMidnight(value);

  DateTimePickerAndroid.open({
    value: selected,
    mode: 'date',
    minimumDate,
    maximumDate,
    timeZoneName: KST_TIME_ZONE,
    onChange: (event, nextDate) => {
      if (event.type === 'set' && nextDate !== undefined) onSelect(toKstDate(nextDate));
    },
  });
}
