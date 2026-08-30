import * as magick from 'npm:@imagemagick/magick-wasm@0.0.39';

import type { EvidenceDeps, EvidencePurgeDeps } from './evidence.ts';
import {
  createEvidenceImageProcessor,
  type EvidenceImageProcessor,
} from './evidence-image.ts';
import { createDeps, requireEnv } from './runtime.ts';
import { createStorage } from './storage-runtime.ts';

const MAGICK_WASM_URL =
  'https://cdn.jsdelivr.net/npm/@imagemagick/magick-wasm@0.0.39/dist/magick.wasm';
const MAGICK_WASM_SHA256 =
  '90fe71287714b753b1768bf46dd1946c5d3c5ab84761e51ad779067b878b47fb';

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function loadMagickProcessor(): Promise<EvidenceImageProcessor> {
  const response = await fetch(MAGICK_WASM_URL);
  if (!response.ok) throw new Error('failed to load pinned image processor');

  const wasm = new Uint8Array(await response.arrayBuffer());
  const digest = hex(await crypto.subtle.digest('SHA-256', wasm));
  if (digest !== MAGICK_WASM_SHA256) {
    throw new Error('image processor integrity check failed');
  }
  return await createEvidenceImageProcessor(magick, wasm);
}

let processor: Promise<EvidenceImageProcessor> | undefined;

function processImage(
  input: Parameters<EvidenceImageProcessor>[0],
): ReturnType<EvidenceImageProcessor> {
  processor ??= loadMagickProcessor();
  return processor.then(async (ready) => await ready(input));
}

export function createEvidenceDeps(): EvidenceDeps {
  const base = createDeps();
  return {
    authenticate: base.authenticate,
    rpc: base.rpc,
    log: base.log,
    now: base.now,
    storage: createStorage(),
    processImage,
  };
}

export function createEvidencePurgeDeps(): EvidencePurgeDeps {
  const base = createDeps();
  return {
    rpc: base.rpc,
    log: base.log,
    now: base.now,
    storage: createStorage(),
    purgeSecret: requireEnv('EVIDENCE_PURGE_SECRET'),
  };
}
