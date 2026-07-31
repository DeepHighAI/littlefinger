import type { Answer } from '@littlefinger/shared';

interface EncryptedStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface FulfillmentEvidenceDraftUpload {
  local_id: string;
  upload_id: string;
  idempotency_key: string;
  uri: string;
  mime: string;
  bytes: number;
}

export interface FulfillmentEvidenceDraft {
  answer: Answer | null;
  comment: string;
  uploads: FulfillmentEvidenceDraftUpload[];
  retained_evidence_ids: string[];
}

function draftKey(userId: string, promiseId: string, roundNo: number): string {
  return `lf.fulfillment-evidence-draft.${userId}.${promiseId}.${roundNo}`;
}

export class FulfillmentEvidenceDraftRepository {
  constructor(private readonly store: EncryptedStore) {}

  async load(
    userId: string,
    promiseId: string,
    roundNo: number,
  ): Promise<FulfillmentEvidenceDraft | null> {
    const value = await this.store.getItem(draftKey(userId, promiseId, roundNo));
    if (value === null) return null;
    try {
      return JSON.parse(value) as FulfillmentEvidenceDraft;
    } catch {
      return null;
    }
  }

  async save(
    userId: string,
    promiseId: string,
    roundNo: number,
    draft: FulfillmentEvidenceDraft,
  ): Promise<void> {
    await this.store.setItem(
      draftKey(userId, promiseId, roundNo),
      JSON.stringify(draft),
    );
  }

  async clear(
    userId: string,
    promiseId: string,
    roundNo: number,
  ): Promise<void> {
    await this.store.removeItem(draftKey(userId, promiseId, roundNo));
  }
}
