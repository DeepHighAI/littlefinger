import {
  EVIDENCE_FULL_MAX_PX,
  EVIDENCE_JPEG_QUALITY,
  EVIDENCE_MAX_MB,
  EVIDENCE_THUMB_MAX_PX,
} from '../../../packages/shared/src/config.ts';
import { validateEvidences } from '../../../packages/shared/src/validation.ts';
import { ApiError } from './errors.ts';

interface MagickImageLike {
  readonly format: string;
  readonly width: number;
  readonly height: number;
  quality: number;
  autoOrient: () => void;
  clone: <T>(callback: (image: MagickImageLike) => T) => T;
  resize: (width: number, height: number) => void;
  strip: () => void;
  write: <T>(format: string, callback: (data: Uint8Array) => T) => T;
}

export interface MagickModuleLike {
  readonly ImageMagick: unknown;
  readonly MagickFormat: {
    readonly Jpeg: string;
  };
  initializeImageMagick: (wasm: Uint8Array) => Promise<void>;
}

export interface EvidenceImageInput {
  mime: string;
  bytes: Uint8Array;
}

export interface ProcessedEvidenceVariant {
  bytes: Uint8Array;
  width: number;
  height: number;
}

export interface ProcessedEvidenceImage {
  full: ProcessedEvidenceVariant;
  thumbnail: ProcessedEvidenceVariant;
}

export type EvidenceImageProcessor = (
  input: EvidenceImageInput,
) => Promise<ProcessedEvidenceImage>;

const MIME_FORMAT: Readonly<Record<string, string>> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'image/heic': 'HEIC',
};

function resizeWithin(image: MagickImageLike, maxPx: number): void {
  const longest = Math.max(image.width, image.height);
  if (longest <= maxPx) return;

  const scale = maxPx / longest;
  image.resize(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
}

function encodeJpeg(
  image: MagickImageLike,
  maxPx: number,
  jpeg: string,
): ProcessedEvidenceVariant {
  resizeWithin(image, maxPx);
  image.strip();
  image.quality = EVIDENCE_JPEG_QUALITY;
  return image.write(jpeg, (data) => ({
    // WASM 이미지가 dispose 된 뒤에도 Storage 업로드가 안전하도록 복사한다.
    bytes: new Uint8Array(data),
    width: image.width,
    height: image.height,
  }));
}

export async function createEvidenceImageProcessor(
  magick: MagickModuleLike,
  wasm: Uint8Array,
): Promise<EvidenceImageProcessor> {
  await magick.initializeImageMagick(wasm);
  const imageMagick = magick.ImageMagick as {
    read: <T>(data: Uint8Array, callback: (image: MagickImageLike) => T) => T;
  };

  return async ({ bytes, mime }) => {
    const validation = validateEvidences([{ mime, bytes: bytes.byteLength }]);
    if (!validation.valid) {
      throw new ApiError('E_VALIDATION', { field: 'evidences' });
    }

    try {
      return imageMagick.read(bytes, (image) => {
        if (image.format !== MIME_FORMAT[mime]) {
          throw new ApiError('E_UPLOAD_FAILED');
        }

        image.autoOrient();
        return image.clone((thumbnail) => ({
          full: encodeJpeg(image, EVIDENCE_FULL_MAX_PX, magick.MagickFormat.Jpeg),
          thumbnail: encodeJpeg(thumbnail, EVIDENCE_THUMB_MAX_PX, magick.MagickFormat.Jpeg),
        }));
      });
    } catch (raised) {
      if (raised instanceof ApiError && raised.code === 'E_VALIDATION') throw raised;
      throw new ApiError('E_UPLOAD_FAILED');
    }
  };
}

export const EVIDENCE_MAX_BYTES = EVIDENCE_MAX_MB * 1024 * 1024;
