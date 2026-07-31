import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as magick from '@imagemagick/magick-wasm';
import { beforeAll, describe, expect, test } from 'vitest';

import {
  EVIDENCE_FULL_MAX_PX,
  EVIDENCE_MAX_MB,
  EVIDENCE_THUMB_MAX_PX,
} from '../../packages/shared/src/config.ts';
import {
  createEvidenceImageProcessor,
  type EvidenceImageProcessor,
} from '../functions/_shared/evidence-image.ts';

const FIXTURE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/evidence');
const require = createRequire(import.meta.url);

async function fixture(name: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(resolve(FIXTURE_DIR, name)));
}

function containsAscii(bytes: Uint8Array, value: string): boolean {
  return Buffer.from(bytes).includes(Buffer.from(value, 'ascii'));
}

describe('server evidence image processing', () => {
  let processImage: EvidenceImageProcessor;

  beforeAll(async () => {
    const wasmPath = require.resolve('@imagemagick/magick-wasm/magick.wasm');
    processImage = await createEvidenceImageProcessor(
      magick,
      new Uint8Array(await readFile(wasmPath)),
    );
  });

  test.each([
    ['sample-gps.jpg', 'image/jpeg'],
    ['sample.png', 'image/png'],
    ['sample.webp', 'image/webp'],
    ['sample.heic', 'image/heic'],
  ] as const)('%s becomes metadata-free JPEG', async (name, mime) => {
    const result = await processImage({ bytes: await fixture(name), mime });

    expect([...result.full.bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    expect([...result.thumbnail.bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    expect(Math.max(result.full.width, result.full.height)).toBeLessThanOrEqual(
      EVIDENCE_FULL_MAX_PX,
    );
    expect(Math.max(result.thumbnail.width, result.thumbnail.height)).toBeLessThanOrEqual(
      EVIDENCE_THUMB_MAX_PX,
    );

    for (const marker of ['Exif', 'GPSLatitude', 'ICC_PROFILE', 'xmp', 'XML:com.adobe.xmp']) {
      expect(containsAscii(result.full.bytes, marker), marker).toBe(false);
      expect(containsAscii(result.thumbnail.bytes, marker), marker).toBe(false);
    }
  });

  test('auto-orients before resizing', async () => {
    const result = await processImage({
      bytes: await fixture('sample-oriented.jpg'),
      mime: 'image/jpeg',
    });

    expect(result.full.width).toBe(1800);
    expect(result.full.height).toBe(1200);
  });

  test('rejects a MIME-spoofed image', async () => {
    await expect(
      processImage({ bytes: await fixture('sample.png'), mime: 'image/jpeg' }),
    ).rejects.toThrow('E_UPLOAD_FAILED');
  });

  test('rejects corrupt image bytes', async () => {
    await expect(
      processImage({ bytes: new Uint8Array([0xff, 0xd8, 0xff, 0x00]), mime: 'image/jpeg' }),
    ).rejects.toThrow('E_UPLOAD_FAILED');
  });

  test('accepts exactly 5MB but rejects 5MB + 1 byte before decode', async () => {
    const exact = new Uint8Array(EVIDENCE_MAX_MB * 1024 * 1024);
    const over = new Uint8Array(exact.byteLength + 1);

    await expect(processImage({ bytes: exact, mime: 'image/jpeg' })).rejects.toThrow(
      'E_UPLOAD_FAILED',
    );
    await expect(processImage({ bytes: over, mime: 'image/jpeg' })).rejects.toThrow(
      'E_VALIDATION',
    );
  });
});
