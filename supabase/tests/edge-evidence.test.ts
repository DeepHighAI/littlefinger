import { describe, expect, test } from 'vitest';

import type {
  EvidenceDeps,
  EvidencePurgeDeps,
  EvidenceStorage,
} from '../functions/_shared/evidence.ts';
import { ApiError } from '../functions/_shared/errors.ts';
import { createEvidenceDiscardHandler } from '../functions/evidence-discard/handler.ts';
import { createEvidencePurgeHandler } from '../functions/evidence-purge/handler.ts';
import { createEvidenceSignUrlHandler } from '../functions/evidence-sign-url/handler.ts';
import { createEvidenceUploadHandler } from '../functions/evidence-upload/handler.ts';

const ACTOR_ID = '11111111-1111-1111-1111-111111111111';
const PROMISE_ID = '22222222-2222-2222-2222-222222222222';
const UPLOAD_ID = '33333333-3333-4333-8333-333333333333';
const EVIDENCE_ID = '44444444-4444-4444-8444-444444444444';
const IDEMPOTENCY_KEY = '55555555-5555-4555-8555-555555555555';
const NOW = new Date('2026-07-31T03:00:00.000Z');

interface EvidenceSpy {
  deps: EvidenceDeps;
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
  uploads: { bucket: string; key: string; bytes: Uint8Array; contentType: string }[];
  removals: { bucket: string; keys: string[] }[];
  logs: { message: string; detail: unknown }[];
}

function evidenceSpy(options: {
  rpc?: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  upload?: EvidenceStorage['upload'];
  remove?: EvidenceStorage['remove'];
} = {}): EvidenceSpy {
  const rpcCalls: EvidenceSpy['rpcCalls'] = [];
  const uploads: EvidenceSpy['uploads'] = [];
  const removals: EvidenceSpy['removals'] = [];
  const logs: EvidenceSpy['logs'] = [];

  const deps: EvidenceDeps = {
    authenticate: async (authorization) => {
      if (authorization === null) throw new ApiError('E_AUTH_REQUIRED');
      return ACTOR_ID;
    },
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, args });
      if (options.rpc !== undefined) return await options.rpc(fn, args);
      if (fn === 'lf_evidence_upload_reserve') {
        return {
          upload_id: UPLOAD_ID,
          status: 'PENDING',
          mime: null,
          bytes: null,
          width: null,
          height: null,
        };
      }
      return {
        upload_id: UPLOAD_ID,
        status: 'READY',
        mime: 'image/jpeg',
        bytes: 4,
        width: 2,
        height: 1,
      };
    },
    processImage: async () => ({
      full: { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 2, height: 1 },
      thumbnail: { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 2, height: 1 },
    }),
    storage: {
      upload:
        options.upload ??
        (async (bucket, key, bytes, contentType) => {
          uploads.push({ bucket, key, bytes, contentType });
        }),
      remove:
        options.remove ??
        (async (bucket, keys) => {
          removals.push({ bucket, keys: [...keys] });
        }),
      sign: async () => 'https://storage.example/signed',
    },
    log: { error: (message, detail) => logs.push({ message, detail }) },
    now: () => NOW,
  };

  return { deps, rpcCalls, uploads, removals, logs };
}

function uploadRequest(bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])): Request {
  const form = new FormData();
  form.set('promise_id', PROMISE_ID);
  form.set('round_no', '1');
  form.set('file', new Blob([bytes], { type: 'image/jpeg' }), 'private-name.jpg');
  return new Request('https://example.test/evidence-upload', {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt',
      'idempotency-key': IDEMPOTENCY_KEY,
    },
    body: form,
  });
}

describe('evidence-upload Edge handler', () => {
  test('reserves, processes, stores both JPEG variants, then marks READY', async () => {
    const spy = evidenceSpy();
    const response = await createEvidenceUploadHandler(spy.deps)(uploadRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      upload_id: UPLOAD_ID,
      status: 'READY',
      mime: 'image/jpeg',
      bytes: 4,
      width: 2,
      height: 1,
    });
    expect(spy.rpcCalls.map(({ fn }) => fn)).toEqual([
      'lf_evidence_upload_reserve',
      'lf_evidence_upload_complete',
    ]);
    expect(spy.uploads).toHaveLength(2);
    expect(spy.uploads.every(({ contentType }) => contentType === 'image/jpeg')).toBe(true);
    expect(spy.uploads.map(({ key }) => key)).toEqual([
      `${PROMISE_ID}/${UPLOAD_ID}/full.jpg`,
      `${PROMISE_ID}/${UPLOAD_ID}/thumbnail.jpg`,
    ]);
  });

  test('returns an existing READY reservation without touching Storage', async () => {
    const ready = {
      upload_id: UPLOAD_ID,
      status: 'READY',
      mime: 'image/jpeg',
      bytes: 123,
      width: 10,
      height: 20,
    };
    const spy = evidenceSpy({ rpc: async () => ready });

    const response = await createEvidenceUploadHandler(spy.deps)(uploadRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(ready);
    expect(spy.uploads).toEqual([]);
    expect(spy.rpcCalls).toHaveLength(1);
  });

  test('removes the full image when thumbnail storage fails and logs no private data', async () => {
    let uploadCount = 0;
    const spy = evidenceSpy({
      upload: async () => {
        uploadCount += 1;
        if (uploadCount === 2) throw new Error('private-name.jpg secret/object/path');
      },
    });

    const response = await createEvidenceUploadHandler(spy.deps)(uploadRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      code: 'E_UPLOAD_FAILED',
      message: '사진을 올리지 못했어요. 다시 시도해 주세요.',
    });
    expect(spy.removals).toEqual([
      {
        bucket: 'fulfillment-evidences',
        keys: [`${PROMISE_ID}/${UPLOAD_ID}/full.jpg`],
      },
    ]);
    const serializedLogs = JSON.stringify(spy.logs);
    expect(serializedLogs).not.toContain('private-name.jpg');
    expect(serializedLogs).not.toContain(PROMISE_ID);
    expect(serializedLogs).not.toContain(UPLOAD_ID);
  });

  test('rejects an oversized body before reserving or processing', async () => {
    const spy = evidenceSpy();
    const response = await createEvidenceUploadHandler(spy.deps)(
      uploadRequest(new Uint8Array(5 * 1024 * 1024 + 1)),
    );

    expect(response.status).toBe(422);
    expect(spy.rpcCalls).toEqual([]);
    expect(spy.uploads).toEqual([]);
  });
});

describe('evidence-discard and evidence-sign-url Edge handlers', () => {
  test('discards an upload, removes private objects, and does not expose object keys', async () => {
    const fullKey = `${PROMISE_ID}/${UPLOAD_ID}/full.jpg`;
    const thumbKey = `${PROMISE_ID}/${UPLOAD_ID}/thumbnail.jpg`;
    const spy = evidenceSpy({
      rpc: async () => ({
        upload_id: UPLOAD_ID,
        status: 'DISCARDED',
        storage_key: fullKey,
        thumb_key: thumbKey,
      }),
    });
    const response = await createEvidenceDiscardHandler(spy.deps)(
      new Request('https://example.test/evidence-discard', {
        method: 'POST',
        headers: {
          authorization: 'Bearer jwt',
          'content-type': 'application/json',
          'idempotency-key': IDEMPOTENCY_KEY,
        },
        body: JSON.stringify({ upload_id: UPLOAD_ID }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      upload_id: UPLOAD_ID,
      status: 'DISCARDED',
    });
    expect(spy.removals).toEqual([
      { bucket: 'fulfillment-evidences', keys: [fullKey, thumbKey] },
    ]);
  });

  test('returns a signed URL with the RPC-provided exact 600-second expiry', async () => {
    const spy = evidenceSpy({
      rpc: async () => ({
        evidence_id: EVIDENCE_ID,
        bucket_id: 'fulfillment-evidences',
        object_key: `${PROMISE_ID}/${UPLOAD_ID}/full.jpg`,
        variant: 'FULL',
        expires_in: 600,
      }),
    });
    const response = await createEvidenceSignUrlHandler(spy.deps)(
      new Request('https://example.test/evidence-sign-url', {
        method: 'POST',
        headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' },
        body: JSON.stringify({ evidence_id: EVIDENCE_ID, variant: 'FULL' }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      evidence_id: EVIDENCE_ID,
      variant: 'FULL',
      signed_url: 'https://storage.example/signed',
      expires_at: '2026-07-31T03:10:00.000Z',
    });
  });
});

describe('evidence-purge internal Edge handler', () => {
  test('rejects a request without the internal secret before DB access', async () => {
    let rpcCalled = false;
    const deps: EvidencePurgeDeps = {
      rpc: async () => {
        rpcCalled = true;
        return {};
      },
      storage: evidenceSpy().deps.storage,
      purgeSecret: 'expected-secret',
      log: { error: () => undefined },
      now: () => NOW,
    };

    const response = await createEvidencePurgeHandler(deps)(
      new Request('https://example.test/evidence-purge', { method: 'POST' }),
    );

    expect(response.status).toBe(401);
    expect(rpcCalled).toBe(false);
  });

  test('marks only objects whose Storage removal succeeded', async () => {
    const failedKey = 'promise/failed/full.jpg';
    const completeArgs: Record<string, unknown>[] = [];
    const deps: EvidencePurgeDeps = {
      rpc: async (fn, args) => {
        if (fn === 'lf_evidence_purge_targets') {
          return {
            evidences: [
              {
                evidence_id: EVIDENCE_ID,
                bucket_id: 'fulfillment-evidences',
                storage_key: 'promise/evidence/full.jpg',
                thumb_key: 'promise/evidence/thumbnail.jpg',
              },
            ],
            uploads: [
              {
                upload_id: UPLOAD_ID,
                bucket_id: 'fulfillment-evidences',
                storage_key: failedKey,
                thumb_key: 'promise/failed/thumbnail.jpg',
              },
            ],
          };
        }
        completeArgs.push(args);
        return { evidence_count: 1, upload_count: 0 };
      },
      storage: {
        ...evidenceSpy().deps.storage,
        remove: async (_bucket, keys) => {
          if (keys.includes(failedKey)) throw new Error('storage path must stay private');
        },
      },
      purgeSecret: 'expected-secret',
      log: { error: () => undefined },
      now: () => NOW,
    };

    const response = await createEvidencePurgeHandler(deps)(
      new Request('https://example.test/evidence-purge', {
        method: 'POST',
        headers: { 'x-evidence-purge-secret': 'expected-secret' },
      }),
    );

    expect(response.status).toBe(200);
    expect(completeArgs).toEqual([
      { p_evidence_ids: [EVIDENCE_ID], p_upload_ids: [] },
    ]);
    await expect(response.json()).resolves.toEqual({
      evidence_count: 1,
      upload_count: 0,
      failed_count: 1,
    });
  });
});
