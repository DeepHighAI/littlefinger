import type { PromiseDraftFields } from './promise-draft.ts';

export const DRAFT_AUTOSAVE_DELAY_MS = 3_000;

interface EncryptedItemStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

function draftKey(userId: string, promiseId: string | null): string {
  return `lf.promise-draft.${userId}.${promiseId ?? 'new'}`;
}

export class PromiseDraftRepository {
  constructor(private readonly store: EncryptedItemStore) {}

  async load(userId: string, promiseId: string | null): Promise<PromiseDraftFields | null> {
    const value = await this.store.getItem(draftKey(userId, promiseId));
    if (value === null) return null;
    try {
      return JSON.parse(value) as PromiseDraftFields;
    } catch {
      await this.remove(userId, promiseId);
      return null;
    }
  }

  async save(
    userId: string,
    promiseId: string | null,
    draft: PromiseDraftFields,
  ): Promise<void> {
    await this.store.setItem(draftKey(userId, promiseId), JSON.stringify(draft));
  }

  async remove(userId: string, promiseId: string | null): Promise<void> {
    await this.store.removeItem(draftKey(userId, promiseId));
  }
}

export class DraftAutosave {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: PromiseDraftFields | null = null;

  constructor(private readonly save: (draft: PromiseDraftFields) => Promise<void>) {}

  schedule(draft: PromiseDraftFields): void {
    this.pending = draft;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, DRAFT_AUTOSAVE_DELAY_MS);
  }

  async flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const draft = this.pending;
    this.pending = null;
    if (draft !== null) await this.save(draft);
  }
}
