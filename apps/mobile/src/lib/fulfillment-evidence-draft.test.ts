import {
  FulfillmentEvidenceDraftRepository,
  type FulfillmentEvidenceDraft,
} from './fulfillment-evidence-draft.ts';

describe('이행 증빙 암호화 초안', () => {
  test('사용자·약속·라운드별 키로 저장·복원하고 성공 제출 뒤 제거한다', async () => {
    const values = new Map<string, string>();
    const store = {
      getItem: jest.fn(async (key: string) => values.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        values.delete(key);
      }),
    };
    const repository = new FulfillmentEvidenceDraftRepository(store);
    const draft: FulfillmentEvidenceDraft = {
      answer: 'KEPT',
      comment: '함께 달렸어요',
      uploads: [
        {
          local_id: 'local-1',
          upload_id: 'upload-1',
          idempotency_key: 'key-1',
          uri: 'file:///private-preview.jpg',
          mime: 'image/jpeg',
          bytes: 1024,
        },
      ],
      retained_evidence_ids: ['evidence-1'],
    };

    await repository.save('user-1', 'promise-1', 2, draft);
    await expect(repository.load('user-1', 'promise-1', 2)).resolves.toEqual(draft);
    await expect(repository.load('user-2', 'promise-1', 2)).resolves.toBeNull();
    expect(store.setItem).toHaveBeenCalledWith(
      'lf.fulfillment-evidence-draft.user-1.promise-1.2',
      JSON.stringify(draft),
    );

    await repository.clear('user-1', 'promise-1', 2);
    await expect(repository.load('user-1', 'promise-1', 2)).resolves.toBeNull();
  });
});
