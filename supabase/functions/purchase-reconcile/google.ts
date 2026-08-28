import { createGoogleAccessTokenProvider } from '../purchase-verify/google.ts';

export interface GoogleVoidedPurchase {
  purchaseToken: string;
  voidedTimeMillis: string;
  voidedSource: number;
  voidedReason: number;
}

export interface GoogleVoidedPurchaseConfig {
  serviceAccountJson: string;
  packageName: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

function pageOf(value: unknown): {
  items: GoogleVoidedPurchase[];
  nextPageToken: string | null;
} {
  if (typeof value !== 'object' || value === null) {
    throw new Error('GOOGLE_VOIDED_PURCHASES_MALFORMED');
  }
  const record = value as Record<string, unknown>;
  const rawItems = record['voidedPurchases'] ?? [];
  if (!Array.isArray(rawItems)) throw new Error('GOOGLE_VOIDED_PURCHASES_MALFORMED');

  const items = rawItems.map((item) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error('GOOGLE_VOIDED_PURCHASES_MALFORMED');
    }
    const row = item as Record<string, unknown>;
    if (
      typeof row['purchaseToken'] !== 'string' ||
      typeof row['voidedTimeMillis'] !== 'string' ||
      typeof row['voidedSource'] !== 'number' ||
      typeof row['voidedReason'] !== 'number'
    ) {
      throw new Error('GOOGLE_VOIDED_PURCHASES_MALFORMED');
    }
    return {
      purchaseToken: row['purchaseToken'],
      voidedTimeMillis: row['voidedTimeMillis'],
      voidedSource: row['voidedSource'],
      voidedReason: row['voidedReason'],
    };
  });

  const pagination = record['tokenPagination'];
  const nextPageToken =
    typeof pagination === 'object' && pagination !== null &&
      typeof (pagination as Record<string, unknown>)['nextPageToken'] === 'string'
      ? String((pagination as Record<string, unknown>)['nextPageToken'])
      : null;
  return { items, nextPageToken };
}

/** 최근 30일의 voided-at 창을 모두 순회한다. DB 원장의 PK가 겹치는 창을 멱등화한다. */
export function createGoogleVoidedPurchaseLister(
  config: GoogleVoidedPurchaseConfig,
): (startTimeMs: number, endTimeMs: number) => Promise<GoogleVoidedPurchase[]> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const accessToken = createGoogleAccessTokenProvider(config);

  return async function list(startTimeMs, endTimeMs) {
    const token = await accessToken();
    const items: GoogleVoidedPurchase[] = [];
    const seenTokens = new Set<string>();
    let pageToken: string | null = null;

    for (let page = 0; page < 100; page += 1) {
      const query = new URLSearchParams({
        startTime: String(startTimeMs),
        endTime: String(endTimeMs),
        type: '0',
        'pageSelection.maxResults': '1000',
      });
      if (pageToken !== null) query.set('pageSelection.token', pageToken);
      const response = await fetchImpl(
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
          `${encodeURIComponent(config.packageName)}/purchases/voidedpurchases?${query.toString()}`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error(`GOOGLE_VOIDED_PURCHASES_${response.status}`);

      const parsed = pageOf(await response.json());
      items.push(...parsed.items);
      if (parsed.nextPageToken === null) return items;
      if (seenTokens.has(parsed.nextPageToken)) {
        throw new Error('GOOGLE_VOIDED_PURCHASES_PAGINATION_LOOP');
      }
      seenTokens.add(parsed.nextPageToken);
      pageToken = parsed.nextPageToken;
    }

    throw new Error('GOOGLE_VOIDED_PURCHASES_PAGE_LIMIT');
  };
}
