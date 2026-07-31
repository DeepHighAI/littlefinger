import type {
  FulfillmentSubmitRequest,
  FulfillmentSubmitResponse,
  EvidenceSignUrlResponse,
  EvidenceUploadResponse,
  EvidenceSignUrlRequest,
  ParticipantPromiseSummary,
  PromiseFulfillmentDetailResponse,
} from '@littlefinger/shared';
import * as Crypto from 'expo-crypto';

import {
  discardFulfillmentEvidence as discardFulfillmentEvidenceWith,
  listParticipantPromises as listParticipantPromisesWith,
  loadFulfillmentDetail as loadFulfillmentDetailWith,
  reopenFulfillment as reopenFulfillmentWith,
  signFulfillmentEvidence as signFulfillmentEvidenceWith,
  submitFulfillment as submitFulfillmentWith,
} from './fulfillment-api.ts';
import {
  FulfillmentEvidenceDraftRepository,
  type FulfillmentEvidenceDraft,
} from './fulfillment-evidence-draft.ts';
import {
  callMobileFunctionNative,
  callMobileMultipartFunctionNative,
  currentMobileUserId,
} from './mobile-api-native.ts';
import { getMobileEncryptedStorage } from './supabase-native.ts';

const deps = { call: callMobileFunctionNative };
const drafts = new FulfillmentEvidenceDraftRepository(getMobileEncryptedStorage());

export interface PickedFulfillmentEvidence {
  uri: string;
  file_name: string;
  mime: string;
  bytes: number;
}

export type PickFulfillmentEvidenceResult =
  | { status: 'DENIED' | 'CANCELED'; assets: [] }
  | { status: 'SELECTED'; assets: PickedFulfillmentEvidence[] };

export async function listParticipantPromises(): Promise<
  ParticipantPromiseSummary[]
> {
  return await listParticipantPromisesWith(deps);
}

export async function loadFulfillmentDetail(
  promiseId: string,
): Promise<PromiseFulfillmentDetailResponse> {
  return await loadFulfillmentDetailWith(promiseId, deps);
}

export async function submitFulfillment(
  input: FulfillmentSubmitRequest,
  idempotencyKey: string,
): Promise<FulfillmentSubmitResponse> {
  return await submitFulfillmentWith(input, idempotencyKey, deps);
}

export async function reopenFulfillment(
  promiseId: string,
  idempotencyKey: string,
) {
  return await reopenFulfillmentWith(promiseId, idempotencyKey, deps);
}

export function createFulfillmentIdempotencyKey(): string {
  return Crypto.randomUUID();
}

export async function pickFulfillmentEvidence(
  selectionLimit: number,
): Promise<PickFulfillmentEvidenceResult> {
  const ImagePicker = await import('expo-image-picker');
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'DENIED', assets: [] };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: selectionLimit > 1,
    selectionLimit,
    quality: 1,
    exif: false,
  });
  if (result.canceled) return { status: 'CANCELED', assets: [] };

  return {
    status: 'SELECTED',
    assets: await Promise.all(
      result.assets.map(async (asset, index) => {
        let mime = asset.mimeType ?? '';
        let bytes = asset.fileSize ?? -1;
        if (mime.length === 0 || bytes < 0) {
          try {
            const blob = await (await fetch(asset.uri)).blob();
            if (mime.length === 0) mime = blob.type;
            if (bytes < 0) bytes = blob.size;
          } catch {
            // 검증할 수 없는 파일은 화면 검증에서 거절한다.
          }
        }
        return {
          uri: asset.uri,
          file_name: asset.fileName ?? `evidence-${index + 1}`,
          mime,
          bytes,
        };
      }),
    ),
  };
}

export async function uploadFulfillmentEvidence(
  promiseId: string,
  roundNo: number,
  asset: PickedFulfillmentEvidence,
  idempotencyKey: string,
): Promise<EvidenceUploadResponse> {
  const form = new FormData();
  form.append('promise_id', promiseId);
  form.append('round_no', String(roundNo));
  form.append(
    'file',
    {
      uri: asset.uri,
      name: asset.file_name,
      type: asset.mime,
    } as unknown as Blob,
  );
  return await callMobileMultipartFunctionNative(
    'evidence-upload',
    form,
    idempotencyKey,
  );
}

export async function discardFulfillmentEvidence(
  uploadId: string,
  idempotencyKey: string,
) {
  return await discardFulfillmentEvidenceWith(uploadId, idempotencyKey, deps);
}

export async function signFulfillmentEvidence(
  evidenceId: string,
  variant: EvidenceSignUrlRequest['variant'],
): Promise<EvidenceSignUrlResponse> {
  return await signFulfillmentEvidenceWith(evidenceId, variant, deps);
}

export async function loadFulfillmentEvidenceDraft(
  promiseId: string,
  roundNo: number,
): Promise<FulfillmentEvidenceDraft | null> {
  return await drafts.load(await currentMobileUserId(), promiseId, roundNo);
}

export async function saveFulfillmentEvidenceDraft(
  promiseId: string,
  roundNo: number,
  draft: FulfillmentEvidenceDraft,
): Promise<void> {
  await drafts.save(await currentMobileUserId(), promiseId, roundNo, draft);
}

export async function clearFulfillmentEvidenceDraft(
  promiseId: string,
  roundNo: number,
): Promise<void> {
  await drafts.clear(await currentMobileUserId(), promiseId, roundNo);
}
