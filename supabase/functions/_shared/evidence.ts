import type { Deps, Logger } from './deps.ts';
import type {
  EvidenceImageProcessor,
  ProcessedEvidenceImage,
} from './evidence-image.ts';

export const EVIDENCE_BUCKET = 'fulfillment-evidences';

export interface EvidenceStorage {
  upload: (
    bucket: string,
    key: string,
    bytes: Uint8Array,
    contentType: 'image/jpeg',
  ) => Promise<void>;
  remove: (bucket: string, keys: readonly string[]) => Promise<void>;
  sign: (bucket: string, key: string, expiresIn: number) => Promise<string>;
}

export interface EvidenceDeps extends Pick<Deps, 'authenticate' | 'rpc' | 'log' | 'now'> {
  processImage: EvidenceImageProcessor;
  storage: EvidenceStorage;
}

export interface EvidencePurgeDeps {
  rpc: Deps['rpc'];
  storage: EvidenceStorage;
  purgeSecret: string;
  log: Logger;
  now: () => Date;
}

export interface ReservedEvidenceUpload {
  upload_id: string;
  status: 'PENDING' | 'READY' | 'BOUND' | 'DISCARDED' | 'FAILED';
  mime: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
}

export interface EvidenceUploadObjects {
  fullKey: string;
  thumbnailKey: string;
  image: ProcessedEvidenceImage;
}

export function evidenceObjectKeys(
  promiseId: string,
  uploadId: string,
): { fullKey: string; thumbnailKey: string } {
  const prefix = `${promiseId}/${uploadId}`;
  return {
    fullKey: `${prefix}/full.jpg`,
    thumbnailKey: `${prefix}/thumbnail.jpg`,
  };
}
