// Storage 어댑터 — `evidence-runtime.ts` 에서 떼어낸 이유는 번들 크기다.
//
// 저 파일은 최상단에서 `npm:@imagemagick/magick-wasm` 을 import 하므로, 삭제만 하는 워커가
// `createStorage` 하나를 가져오려고 그 파일을 건드리면 이미지 처리기까지 번들에 딸려 온다.

import type { EvidenceStorage } from './evidence.ts';
import { createAdminClient } from './runtime.ts';

export function createStorage(): EvidenceStorage {
  const admin = createAdminClient();
  return {
    upload: async (bucket, key, bytes, contentType) => {
      const { error } = await admin.storage.from(bucket).upload(key, bytes, {
        contentType,
        // 동일 업로드 키 재시도는 같은 처리 결과로 수렴해야 한다.
        upsert: true,
      });
      if (error !== null) throw new Error(error.message);
    },
    remove: async (bucket, keys) => {
      if (keys.length === 0) return;
      const { error } = await admin.storage.from(bucket).remove([...keys]);
      if (error !== null) throw new Error(error.message);
    },
    sign: async (bucket, key, expiresIn) => {
      const { data, error } = await admin.storage
        .from(bucket)
        .createSignedUrl(key, expiresIn);
      if (error !== null) throw new Error(error.message);
      return data.signedUrl;
    },
  };
}
