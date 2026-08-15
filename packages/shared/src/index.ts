/**
 * `@littlefinger/shared` 공개 표면.
 *
 * 여기 있는 것: 도메인 타입, 상태·역할·라벨 상수, 정책 수치, 에러 코드, 검증 규칙.
 * 여기 없는 것: 화면, 스타일, 플랫폼 API. 이 패키지는 `react-native` · `window` ·
 * `document` 를 import 하지 않는다 — 그래야 앱과 웹 양쪽에서 안전하게 쓰인다(04 §6).
 *
 * `content_hash` 생성도 여기 두지 않는다. Edge Function 안에만 둬서
 * 클라이언트가 위조 해시를 만들 수 없게 한다(04 §7-3).
 */

export * from './api.ts';
export * from './config.ts';
export * from './datetime.ts';
export * from './errors.ts';
export * from './keep-rate.ts';
export * from './notification.ts';
export * from './promise.ts';
export * from './promise-home.ts';
export * from './text.ts';
export * from './transitions.ts';
export * from './validation.ts';
