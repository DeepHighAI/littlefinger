// Google Play Developer API 구매 조회 — 서비스 계정 JWT OAuth.
//
// SDK 를 쓰지 않는 이유: googleapis 패키지는 Node 전제라 Edge(Deno)에서 무겁고, 필요한 것은
// 요청 두 개(토큰 교환 + purchases.products.get)뿐이다. WebCrypto 는 Deno 와 Node(vitest)
// 양쪽에 있으므로 이 모듈은 Deno 전역 없이 순수하다 — 그래야 테스트가 존재할 수 있다.
//
// 액세스 토큰을 캐시하지 않는다. 구매는 드문 이벤트고 함수 인스턴스는 수명이 짧다 —
// 캐시 만료 관리가 버그 표면만 넓힌다.

/** purchases.products.get 응답 중 판정에 쓰는 필드만. */
export interface GoogleProductPurchase {
  /** 0 구매 완료 · 1 취소 · 2 대기. 0 만 부여 대상이다. */
  purchaseState: number;
  orderId: string | null;
  purchaseTimeMillis: string | null;
  /** 구매 시점에 클라이언트가 심은 사용자 바인딩. 계정 간 토큰 재사용을 막는 근거다. */
  obfuscatedExternalAccountId: string | null;
}

export interface GoogleVerifierConfig {
  /** 서비스 계정 키 JSON 원문 (client_email + private_key). Supabase Secrets 에만 존재한다. */
  serviceAccountJson: string;
  packageName: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

function base64UrlOfBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function base64UrlOfJson(value: unknown): string {
  return base64UrlOfBytes(new TextEncoder().encode(JSON.stringify(value)));
}

/** PEM(PKCS#8) → DER. 서비스 계정 키 JSON 의 private_key 형식이다. */
function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/u, '')
    .replace(/-----END PRIVATE KEY-----/u, '')
    .replace(/\s/gu, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

interface ServiceAccount {
  clientEmail: string;
  privateKey: string;
}

function parseServiceAccount(json: string): ServiceAccount {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_MALFORMED');
  }
  const record = parsed as Record<string, unknown>;
  const clientEmail = record['client_email'];
  const privateKey = record['private_key'];
  if (typeof clientEmail !== 'string' || typeof privateKey !== 'string') {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_MALFORMED');
  }
  return { clientEmail, privateKey };
}

async function signedAssertion(account: ServiceAccount, nowMs: number): Promise<string> {
  const issuedAt = Math.floor(nowMs / 1000);
  const header = base64UrlOfJson({ alg: 'RS256', typ: 'JWT' });
  const claims = base64UrlOfJson({
    iss: account.clientEmail,
    scope: ANDROID_PUBLISHER_SCOPE,
    aud: OAUTH_TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  });
  const signingInput = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(account.privateKey).buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64UrlOfBytes(new Uint8Array(signature))}`;
}

function asPurchase(value: unknown): GoogleProductPurchase | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record['purchaseState'] !== 'number') return null;
  return {
    purchaseState: record['purchaseState'],
    orderId: typeof record['orderId'] === 'string' ? record['orderId'] : null,
    purchaseTimeMillis:
      typeof record['purchaseTimeMillis'] === 'string' ? record['purchaseTimeMillis'] : null,
    obfuscatedExternalAccountId:
      typeof record['obfuscatedExternalAccountId'] === 'string'
        ? record['obfuscatedExternalAccountId']
        : null,
  };
}

/**
 * 구매 조회. **유효하지 않은 구매는 `null`** (핸들러가 E_VALIDATION 으로 바꾼다),
 * Google 쪽 장애는 throw (껍데기의 500 평탄화로 떨어진다) — 두 실패는 성격이 다르다:
 * 앞은 사용자의 영수증 문제, 뒤는 재시도하면 되는 우리 쪽 사정이다.
 */
export function createGooglePurchaseVerifier(
  config: GoogleVerifierConfig,
): (productId: string, purchaseToken: string) => Promise<GoogleProductPurchase | null> {
  const account = parseServiceAccount(config.serviceAccountJson);
  const fetchImpl = config.fetchImpl ?? fetch;
  const now = config.now ?? (() => new Date());

  return async function verify(productId, purchaseToken) {
    const assertion = await signedAssertion(account, now().getTime());
    const tokenResponse = await fetchImpl(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });
    if (!tokenResponse.ok) {
      throw new Error(`GOOGLE_OAUTH_TOKEN_${tokenResponse.status}`);
    }
    const tokenBody = (await tokenResponse.json()) as Record<string, unknown>;
    const accessToken = tokenBody['access_token'];
    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      throw new Error('GOOGLE_OAUTH_TOKEN_MALFORMED');
    }

    const purchaseResponse = await fetchImpl(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
        `${encodeURIComponent(config.packageName)}/purchases/products/` +
        `${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    // 400·404·410 은 "그런 구매가 없다/이미 무효다" — 사용자 영수증 문제라 null 로 돌려
    // E_VALIDATION 이 되게 한다. 그 밖의 비정상은 Google 쪽 사정이므로 던진다.
    if (
      purchaseResponse.status === 400 ||
      purchaseResponse.status === 404 ||
      purchaseResponse.status === 410
    ) {
      return null;
    }
    if (!purchaseResponse.ok) {
      throw new Error(`GOOGLE_PLAY_API_${purchaseResponse.status}`);
    }
    const purchase = asPurchase(await purchaseResponse.json());
    if (purchase === null) {
      throw new Error('GOOGLE_PLAY_API_MALFORMED');
    }
    return purchase;
  };
}
