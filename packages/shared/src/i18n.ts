/**
 * 클라이언트 i18n 의 타입 척추 (PO 2026-08-20: MVP 는 ko/en 2개 언어).
 *
 * 라이브러리 없이 기존 라벨 상수 패턴을 그대로 로케일 쌍으로 확장한다:
 *
 *   const ko = { title: '제목', count: (n: number) => `${n}명` };
 *   const en = { title: 'Title', count: (n: number) => `${n}` } satisfies typeof ko;
 *   export const X_LABEL: Localized<typeof ko> = { ko, en };
 *
 * `satisfies typeof ko` 가 키·함수 인자 드리프트를 컴파일에서 잡고,
 * `catalogKeyPaths` 가 레지스트리 테스트에서 구조 패리티를 한 번 더 잡는다.
 * 메시지 값이 함수인 이유: 님 접미·조사·단위·영어 어순이 로케일별 함수 본문 안에
 * 살아야 하기 때문이다. 문자열 치환 템플릿으로는 두 문법을 한 형태로 못 담는다.
 *
 * 서버 렌더 카피(알림 행·에러 봉투)는 1차에서 한국어 유지 — 이 모듈과 무관하다.
 */

export const LOCALES = ['ko', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ko';

/** ko/en 완전 동형 강제 — 한쪽에만 있는 키는 컴파일 에러다. */
export type Localized<T> = Readonly<Record<Locale, T>>;

/**
 * BCP-47 태그 목록(우선순위순) → 지원 로케일.
 * 첫 실태그가 ko 계열이면 ko, 그 외 전부 en (PO 2026-08-20). 판정 불가면 기본값.
 * "kok"(콘칸어) 같은 접두 우연 일치를 피하려고 태그 경계까지 본다.
 */
export function resolveLocale(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (normalized.length === 0) continue;
    return normalized === 'ko' || normalized.startsWith('ko-') ? 'ko' : 'en';
  }
  return DEFAULT_LOCALE;
}

/** 수동 전환 저장 키 — 앱은 AsyncStorage, 웹은 localStorage 에 같은 키로 둔다. */
export const LOCALE_STORAGE_KEY = 'littlefinger.locale.v1';

/**
 * 기기 언어 감지 스위치. **카탈로그 전환(Phase 3–8)이 끝나기 전에는 false 로 둔다** —
 * 켜는 순간 영어 기기에서 미번역 화면이 절반만 영어로 뜬다. Phase 9 에서 한 곳만 켜면
 * 앱·웹이 함께 켜진다.
 */
export const LOCALE_DETECTION_ENABLED = false;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * 시작 시점의 로케일: 저장된 수동 전환이 항상 우선이고, 그다음이 기기 언어 감지다.
 * 감지가 꺼져 있으면 기본 로케일로 고정된다.
 */
export function resolveInitialLocale(
  deviceTags: readonly string[],
  storedOverride: string | null,
  detectionEnabled: boolean = LOCALE_DETECTION_ENABLED,
): Locale {
  if (isLocale(storedOverride)) return storedOverride;
  if (!detectionEnabled) return DEFAULT_LOCALE;
  return resolveLocale(deviceTags);
}

/**
 * 카탈로그 값 트리의 리프 키 경로를 정렬해 나열한다 — 런타임 패리티 가드용.
 * 문자열·함수·배열이 리프다(배열은 통째로 하나의 메시지로 본다).
 */
export function catalogKeyPaths(value: unknown): readonly string[] {
  const paths: string[] = [];
  const walk = (node: unknown, prefix: string): void => {
    if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
      for (const [key, child] of Object.entries(node)) {
        walk(child, prefix.length === 0 ? key : `${prefix}.${key}`);
      }
      return;
    }
    if (prefix.length > 0) paths.push(prefix);
  };
  walk(value, '');
  return paths.sort();
}
