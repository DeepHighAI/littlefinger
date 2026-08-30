import { UUID_PATTERN } from '../_shared/monetization.ts';

export interface SsvVerifierKey {
  keyId: number;
  pem: string;
}

export interface VerifiedSsvCallback {
  intentId: string;
  opaqueUserId: string;
  transactionId: string;
  adUnitId: string;
  rewardedAt: string;
}

/** 콜백의 `key_id`. 정수가 아니면 `null` — 그런 요청은 키 재조회의 근거가 되지 못한다. */
export function ssvKeyIdOf(url: string): number | null {
  const text = new URL(url).searchParams.get('key_id');
  if (text === null || !/^\d+$/u.test(text)) return null;
  const keyId = Number(text);
  return Number.isSafeInteger(keyId) ? keyId : null;
}

function base64UrlBytes(value: string): Uint8Array {
  const padded = value.replace(/-/gu, '+').replace(/_/gu, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function pemBytes(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/gu, '');
  return base64UrlBytes(body);
}

function ownedBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function derLength(bytes: Uint8Array, offset: number): { length: number; next: number } {
  const first = bytes[offset];
  if (first === undefined) throw new Error('INVALID_DER_SIGNATURE');
  if ((first & 0x80) === 0) return { length: first, next: offset + 1 };
  const count = first & 0x7f;
  if (count < 1 || count > 2) throw new Error('INVALID_DER_SIGNATURE');
  let length = 0;
  for (let index = 0; index < count; index += 1) {
    const part = bytes[offset + 1 + index];
    if (part === undefined) throw new Error('INVALID_DER_SIGNATURE');
    length = (length << 8) | part;
  }
  return { length, next: offset + 1 + count };
}

/** WebCrypto ECDSA가 받는 IEEE-P1363 r||s 형태로 Google DER 서명을 바꾼다. */
export function derToP1363(signature: Uint8Array): Uint8Array {
  if (signature[0] !== 0x30) throw new Error('INVALID_DER_SIGNATURE');
  const sequence = derLength(signature, 1);
  let cursor = sequence.next;
  if (cursor + sequence.length !== signature.length || signature[cursor] !== 0x02) {
    throw new Error('INVALID_DER_SIGNATURE');
  }
  const rLength = derLength(signature, cursor + 1);
  const r = signature.slice(rLength.next, rLength.next + rLength.length);
  cursor = rLength.next + rLength.length;
  if (signature[cursor] !== 0x02) throw new Error('INVALID_DER_SIGNATURE');
  const sLength = derLength(signature, cursor + 1);
  const s = signature.slice(sLength.next, sLength.next + sLength.length);
  if (sLength.next + sLength.length !== signature.length) throw new Error('INVALID_DER_SIGNATURE');
  const output = new Uint8Array(64);
  const normalizedR = r[0] === 0 ? r.slice(1) : r;
  const normalizedS = s[0] === 0 ? s.slice(1) : s;
  if (normalizedR.length > 32 || normalizedS.length > 32) throw new Error('INVALID_DER_SIGNATURE');
  output.set(normalizedR, 32 - normalizedR.length);
  output.set(normalizedS, 64 - normalizedS.length);
  return output;
}

export async function verifySsvCallback(
  url: string,
  keys: readonly SsvVerifierKey[],
  allowedAdUnits: ReadonlySet<string>,
): Promise<VerifiedSsvCallback | null> {
  const parsed = new URL(url);
  const raw = parsed.search.slice(1);
  const signatureMarker = '&signature=';
  const signatureIndex = raw.lastIndexOf(signatureMarker);
  if (signatureIndex < 1) return null;
  const signedQuery = raw.slice(0, signatureIndex);
  const signature = parsed.searchParams.get('signature');
  const keyId = ssvKeyIdOf(url);
  const intentId = parsed.searchParams.get('custom_data');
  const opaqueUserId = parsed.searchParams.get('user_id');
  const transactionId = parsed.searchParams.get('transaction_id');
  const adUnitId = parsed.searchParams.get('ad_unit');
  const timestamp = Number(parsed.searchParams.get('timestamp'));
  if (
    signature === null || keyId === null || intentId === null ||
    !UUID_PATTERN.test(intentId) || opaqueUserId === null || opaqueUserId.length !== 64 ||
    transactionId === null || transactionId.length === 0 || adUnitId === null ||
    !allowedAdUnits.has(adUnitId) || !Number.isSafeInteger(timestamp) || timestamp <= 0
  ) return null;
  const key = keys.find((candidate) => candidate.keyId === keyId);
  if (key === undefined) return null;
  try {
    const cryptoKey = await crypto.subtle.importKey(
      'spki', ownedBuffer(pemBytes(key.pem)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'],
    );
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      cryptoKey,
      ownedBuffer(derToP1363(base64UrlBytes(signature))),
      ownedBuffer(new TextEncoder().encode(signedQuery)),
    );
    if (!valid) return null;
  } catch {
    return null;
  }
  return {
    intentId,
    opaqueUserId,
    transactionId,
    adUnitId,
    rewardedAt: new Date(timestamp).toISOString(),
  };
}
